import { db, logger } from '../utils/database';
import { aiSearchService } from './aiSearchService';
import { claudeService } from './claudeService';
import { igamingIntelligenceService, StreamerAnalysisResult } from './igamingIntelligenceService';
import { Server as SocketIOServer } from 'socket.io';

interface ChatMessage {
  id: string;
  userId: string;
  conversationId: string;
  message: string;
  response?: string;
  type: 'user' | 'assistant' | 'system';
  timestamp: Date;
  streamersReturned?: string[];
  processingTime?: number;
  metadata?: {
    searchParams?: any;
    resultCount?: number;
    reasoning?: string;
  };
}

interface ChatConversation {
  id: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

interface ChatContext {
  userId: string;
  conversationId: string;
  recentMessages: ChatMessage[];
  lastSearchResults?: any[];
  sessionStarted: Date;
}

export class ChatService {
  private io?: SocketIOServer;
  private activeContexts: Map<string, ChatContext> = new Map();

  constructor(io?: SocketIOServer) {
    this.io = io;
    logger.info('Chat service initialized');
  }

  /**
   * Process incoming chat message and generate AI response
   */
  async processMessage(
    userId: string,
    message: string,
    conversationId?: string
  ): Promise<{
    response: string;
    streamers?: any[];
    conversationId: string;
    messageId: string;
    processingTime: number;
  }> {
    const startTime = Date.now();

    try {
      // Get or create conversation
      let activeConversationId: string;

      // If conversationId provided, verify it exists in database
      if (conversationId) {
        const existingConversation = await db.conversation.findUnique({
          where: { id: conversationId }
        });

        // If conversation doesn't exist, create a new one
        if (existingConversation) {
          activeConversationId = conversationId;
        } else {
          activeConversationId = await this.createConversation(userId, message);
        }
      } else {
        // No conversationId provided, create new one
        activeConversationId = await this.createConversation(userId, message);
      }

      // Get conversation context
      const context = await this.getConversationContext(userId, activeConversationId);

      // Note: We'll store the user message along with the AI response as a pair

      // Emit typing indicator
      this.emitTypingIndicator(userId, activeConversationId, true);

      let response: string;
      let streamers: any[] = [];
      let metadata: any = {};

      // Use conversational AI to determine response type
      const conversationalResponse = await claudeService.processConversationalQuery(
        message,
        {
          userId,
          conversationId: activeConversationId,
          previousMessages: context.recentMessages.map(m => ({
            role: m.type === 'user' ? 'user' : 'assistant',
            content: m.type === 'user' ? m.message : (m.response || ''),
            timestamp: m.timestamp
          })),
          searchHistory: []
        }
      );

      logger.info('Conversational response received', {
        type: conversationalResponse.type,
        hasSearchParams: !!conversationalResponse.searchParams,
        searchParams: conversationalResponse.searchParams
      });

      if (conversationalResponse.type === 'question') {
        // AI decided to ask clarifying questions
        response = conversationalResponse.message;
        metadata = {
          responseType: 'question',
          suggestedQuestions: conversationalResponse.suggestedQuestions,
          reasoning: conversationalResponse.reasoning
        };

      } else if (conversationalResponse.type === 'search' && conversationalResponse.searchParams) {
        // AI decided to proceed with search
        const searchResult = await aiSearchService.searchStreamersWithAI({
          userId,
          query: message,
          conversationId: activeConversationId,
          searchParams: conversationalResponse.searchParams,
          context: {
            previousMessages: context.recentMessages.map(m => ({
              role: m.type === 'user' ? 'user' : 'assistant',
              content: m.type === 'user' ? m.message : (m.response || ''),
              timestamp: m.timestamp
            })),
            lastResults: context.lastSearchResults
          }
        });

        // Automatically infer brand context from message if not provided
        let brandContext = conversationalResponse.brandContext;
        if (!brandContext && (message.toLowerCase().includes('betting') || message.toLowerCase().includes('casino') || message.toLowerCase().includes('gambling'))) {
          brandContext = {
            industry: 'Gaming/Betting',
            campaignType: 'betting',
            targetAudience: '18-35 males interested in gaming and sports',
            brandPersonality: 'exciting, risk-taking, competitive',
            recommendations: ['Focus on gaming creators', 'Target competitive gaming audiences', 'Look for high engagement rates']
          };
        }

        // Use fast template-based summary for speed (skip OpenAI and iGaming analysis)
        response = searchResult.summary;
        streamers = searchResult.streamers;

        metadata = {
          responseType: 'search',
          searchParams: searchResult.searchParams,
          resultCount: searchResult.streamers.length,
          reasoning: conversationalResponse.reasoning,
          brandContext: conversationalResponse.brandContext
        };

        // Update context with results
        context.lastSearchResults = streamers;

      } else if (conversationalResponse.type === 'explanation') {
        // OVERRIDE: If user is asking for streamers/betting/gambling, force a search instead
        const lowerMsg = message.toLowerCase();
        const isStreamerRequest = lowerMsg.match(/streamer|influencer|creator|campaign|betting|casino|slots|gambling/);

        if (isStreamerRequest) {
          logger.info('Forcing search for streamer request despite AI choosing explanation');

          // Force search with gambling tags
          const forcedSearchParams: any = {
            limit: 20
          };

          if (lowerMsg.match(/betting|casino|slots|gambling|poker/)) {
            forcedSearchParams.tags = ['CASINO', 'SLOTS', 'GAMBLING', 'BETTING'];
          } else {
            forcedSearchParams.tags = ['GAMING'];
          }

          const searchResult = await aiSearchService.searchStreamersWithAI({
            userId,
            query: message,
            conversationId: activeConversationId,
            searchParams: forcedSearchParams,
            context: {
              previousMessages: context.recentMessages.map(m => ({
                role: m.type === 'user' ? 'user' : 'assistant',
                content: m.type === 'user' ? m.message : (m.response || ''),
                timestamp: m.timestamp
              })),
              lastResults: context.lastSearchResults
            }
          });

          response = `Found ${searchResult.streamers.length} streamers. Check the table below.`;
          streamers = searchResult.streamers;
          metadata = {
            responseType: 'search',
            searchParams: forcedSearchParams,
            resultCount: searchResult.streamers.length
          };
        } else {
          // AI provided explanation/reasoning (for non-streamer queries)
          response = conversationalResponse.message;
          metadata = {
            responseType: 'explanation',
            reasoning: conversationalResponse.reasoning,
            brandContext: conversationalResponse.brandContext
          };
        }

      } else {
        // Fallback to general conversation
        response = await claudeService.generateConversationResponse(
          message,
          {
            userId,
            conversationId: activeConversationId,
            previousMessages: context.recentMessages.map(m => ({
              role: m.type === 'user' ? 'user' : 'assistant',
              content: m.type === 'user' ? m.message : (m.response || ''),
              timestamp: m.timestamp
            })),
            searchHistory: []
          }
        );
        metadata = {
          responseType: 'conversation'
        };
      }

      // Store the complete message pair (user message + AI response)
      const messageId = await this.storeMessage({
        userId,
        conversationId: activeConversationId,
        message, // User's original message
        response, // AI's response
        type: 'assistant', // This represents the conversation pair
        timestamp: new Date(),
        streamersReturned: streamers.map(s => s.id),
        processingTime: Date.now() - startTime,
        metadata
      });

      // Add the new message to context for continuity
      context.recentMessages.push({
        id: messageId,
        userId,
        conversationId: activeConversationId,
        message,
        response,
        timestamp: new Date(),
        streamersReturned: streamers.map(s => s.id),
        processingTime: Date.now() - startTime
      } as any);

      // Keep only last 10 messages in context
      if (context.recentMessages.length > 10) {
        context.recentMessages = context.recentMessages.slice(-10);
      }

      // Update conversation timestamp
      await this.updateConversationTimestamp(activeConversationId);

      // Update conversation context
      await this.updateConversationContext(userId, activeConversationId, context);

      // Stop typing indicator
      this.emitTypingIndicator(userId, activeConversationId, false);

      // Emit response via WebSocket
      this.emitMessage(userId, {
        id: messageId,
        conversationId: activeConversationId,
        message: response,
        type: 'assistant',
        timestamp: new Date(),
        streamers,
        metadata
      });

      const processingTime = Date.now() - startTime;

      logger.info('Chat message processed successfully', {
        userId,
        conversationId: activeConversationId,
        resultCount: streamers.length,
        processingTime
      });

      return {
        response,
        streamers,
        conversationId: activeConversationId,
        messageId: messageId,
        processingTime
      };

    } catch (error) {
      logger.error('Error processing chat message:', error);

      // Stop typing indicator on error
      if (conversationId) {
        this.emitTypingIndicator(userId, conversationId, false);
      }

      throw new Error('I encountered an error processing your message. Please try again.');
    }
  }

  /**
   * Get conversation history
   */
  async getConversation(
    userId: string,
    conversationId: string,
    limit: number = 50
  ): Promise<ChatConversation | null> {
    try {
      const conversation = await db.conversation.findFirst({
        where: {
          id: conversationId,
          userId: userId // Ensure user can only access their own conversations
        },
        include: {
          messages: {
            orderBy: { timestamp: 'asc' },
            take: limit,
            include: {
              streamers: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  platform: true,
                  avatarUrl: true,
                  followers: true,
                  isLive: true,
                  currentViewers: true,
                  highestViewers: true,
                  region: true,
                  lastStreamed: true,
                  updatedAt: true,
                  profileUrl: true,
                  language: true
                }
              }
            }
          }
        }
      });

      if (!conversation) {
        logger.warn('Conversation not found or user not authorized', { userId, conversationId });
        return null;
      }

      // Convert to expected format - each database record represents a conversation pair
      const messages: any[] = [];
      conversation.messages.forEach(msg => {
        // Add user message
        if (msg.message) {
          messages.push({
            id: `${msg.id}-user`,
            userId: msg.userId,
            conversationId: msg.conversationId,
            message: msg.message,
            type: 'user',
            timestamp: msg.timestamp,
            streamersReturned: [],
            streamers: []
          });
        }

        // Add assistant response
        if (msg.response) {
          messages.push({
            id: `${msg.id}-assistant`,
            userId: msg.userId,
            conversationId: msg.conversationId,
            message: msg.response,
            response: msg.response,
            type: 'assistant',
            timestamp: msg.timestamp,
            streamersReturned: msg.streamersReturned,
            processingTime: msg.processingTime || undefined,
            streamers: msg.streamers
          });
        }
      });

      const chatConversation: ChatConversation = {
        id: conversation.id,
        userId: conversation.userId,
        title: conversation.title,
        messages: messages,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        isActive: true
      };

      return chatConversation;

    } catch (error) {
      logger.error('Error getting conversation:', error);
      return null;
    }
  }

  /**
   * List user's conversations
   */
  async getUserConversations(
    userId: string,
    limit: number = 20
  ): Promise<Array<{
    id: string;
    title: string;
    lastMessage: string;
    lastActivity: Date;
    messageCount: number;
  }>> {
    try {
      const conversations = await db.conversation.findMany({
        where: { userId },
        include: {
          messages: {
            orderBy: { timestamp: 'desc' },
            take: 1 // Get the latest message for lastMessage
          },
          _count: {
            select: { messages: true }
          }
        },
        orderBy: { updatedAt: 'desc' },
        take: limit
      });

      return conversations.map(conv => ({
        id: conv.id,
        title: conv.title,
        lastMessage: conv.messages[0]?.response || conv.messages[0]?.message || 'No messages',
        lastActivity: conv.updatedAt,
        messageCount: conv._count.messages
      }));

    } catch (error) {
      logger.error('Error getting user conversations:', error);
      return [];
    }
  }

  /**
   * Delete conversation
   */
  async deleteConversation(userId: string, conversationId: string): Promise<boolean> {
    try {
      // Delete the conversation (cascade will delete related messages)
      const deleteResult = await db.conversation.deleteMany({
        where: {
          id: conversationId,
          userId: userId // Ensure user can only delete their own conversations
        }
      });

      if (deleteResult.count === 0) {
        logger.warn('Conversation not found or user not authorized', { userId, conversationId });
        return false;
      }

      // Remove from active contexts
      this.activeContexts.delete(`${userId}-${conversationId}`);

      logger.info('Conversation deleted successfully', { userId, conversationId });
      return true;

    } catch (error) {
      logger.error('Error deleting conversation:', error);
      return false;
    }
  }

  /**
   * Get conversation suggestions based on user's search history
   */
  async getConversationSuggestions(userId: string): Promise<string[]> {
    try {
      const recentMessages = await db.chatMessage.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: 10
      });

      // Generate suggestions based on recent activity
      const suggestions = [
        "Find gaming streamers in Mexico with 50k+ followers",
        "Show me live streamers right now",
        "Who are the top IRL streamers in Colombia?",
        "Find VTubers in Argentina",
        "Compare engagement rates for these streamers"
      ];

      // Could use AI to generate personalized suggestions based on history
      return suggestions;

    } catch (error) {
      logger.error('Error getting conversation suggestions:', error);
      return [];
    }
  }

  /**
   * Store a message in the database
   */
  private async storeMessage(message: Omit<ChatMessage, 'id'>): Promise<string> {
    try {
      // Skip storing if no valid user ID
      if (!message.userId || message.userId === 'undefined') {
        logger.warn('Cannot store message: invalid user ID');
        return `temp_${Date.now()}`;
      }

      // First check if user exists
      const userExists = await db.user.findUnique({
        where: { id: message.userId }
      });

      if (!userExists) {
        logger.warn('Cannot store message: user not found', { userId: message.userId });
        return `temp_${Date.now()}`;
      }

      const stored = await db.chatMessage.create({
        data: {
          userId: message.userId,
          conversationId: message.conversationId,
          message: (message as any).message || '', // User's original message
          response: (message as any).response || undefined, // AI's response
          streamersReturned: message.streamersReturned || [],
          processingTime: message.processingTime,
          timestamp: message.timestamp,
          // Connect streamers relation
          streamers: {
            connect: (message.streamersReturned || []).map(id => ({ id }))
          }
        }
      });

      return stored.id;

    } catch (error) {
      logger.error('Error storing message:', error);
      // Return temp ID instead of throwing to prevent chat from breaking
      return `temp_${Date.now()}`;
    }
  }

  /**
   * Create a new conversation
   */
  private async createConversation(userId: string, firstMessage: string): Promise<string> {
    try {
      const conversation = await db.conversation.create({
        data: {
          userId,
          title: this.generateConversationTitle(firstMessage)
        }
      });

      // Initialize context
      this.activeContexts.set(`${userId}-${conversation.id}`, {
        userId,
        conversationId: conversation.id,
        recentMessages: [],
        sessionStarted: new Date()
      });

      logger.info('Created new conversation', { userId, conversationId: conversation.id });
      return conversation.id;

    } catch (error) {
      logger.error('Error creating conversation:', error);
      // Fallback to temp ID if database creation fails
      const fallbackId = `temp-${userId}-${Date.now()}`;
      this.activeContexts.set(`${userId}-${fallbackId}`, {
        userId,
        conversationId: fallbackId,
        recentMessages: [],
        sessionStarted: new Date()
      });
      return fallbackId;
    }
  }

  /**
   * Update conversation timestamp
   */
  private async updateConversationTimestamp(conversationId: string): Promise<void> {
    try {
      await db.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() }
      });
    } catch (error) {
      logger.error('Error updating conversation timestamp:', error);
      // Non-critical error, don't throw
    }
  }

  /**
   * Get conversation context
   */
  private async getConversationContext(userId: string, conversationId: string): Promise<ChatContext> {
    const contextKey = `${userId}-${conversationId}`;

    if (this.activeContexts.has(contextKey)) {
      return this.activeContexts.get(contextKey)!;
    }

    // Load recent messages from database to maintain context
    const recentMessages = await db.chatMessage.findMany({
      where: {
        conversationId,
        userId
      },
      orderBy: {
        timestamp: 'desc'
      },
      take: 10, // Last 10 messages for context
      select: {
        id: true,
        message: true,
        response: true,
        timestamp: true,
        streamersReturned: true,
        processingTime: true
      }
    });

    // Reverse to get chronological order
    const chronologicalMessages = recentMessages.reverse();

    // Create new context with loaded messages
    const context: ChatContext = {
      userId,
      conversationId,
      recentMessages: chronologicalMessages as any,
      sessionStarted: new Date()
    };

    this.activeContexts.set(contextKey, context);
    return context;
  }

  /**
   * Update conversation context
   */
  private async updateConversationContext(
    userId: string,
    conversationId: string,
    context: ChatContext
  ): Promise<void> {
    const contextKey = `${userId}-${conversationId}`;
    this.activeContexts.set(contextKey, context);

    // Clean up old contexts (keep last 50)
    if (this.activeContexts.size > 50) {
      const oldestKey = Array.from(this.activeContexts.keys())[0];
      this.activeContexts.delete(oldestKey);
    }
  }

  /**
   * Determine if message is a search query
   */
  private isSearchQuery(message: string): boolean {
    const searchTriggers = [
      'find', 'search', 'show me', 'who are', 'list', 'get me',
      'streamers', 'influencers', 'creators', 'channels',
      'gaming', 'live', 'followers', 'viewers'
    ];

    const lowerMessage = message.toLowerCase();
    return searchTriggers.some(trigger => lowerMessage.includes(trigger));
  }

  /**
   * Generate conversation title from first message
   */
  private generateConversationTitle(firstMessage: string): string {
    if (firstMessage.length <= 30) {
      return firstMessage;
    }

    // Extract key terms for title
    const words = firstMessage.split(' ').slice(0, 5);
    return words.join(' ') + '...';
  }

  /**
   * Emit message via WebSocket
   */
  private emitMessage(userId: string, message: any): void {
    if (this.io) {
      this.io.to(`user:${userId}`).emit('chat:message', message);
    }
  }

  /**
   * Emit typing indicator
   */
  private emitTypingIndicator(userId: string, conversationId: string, isTyping: boolean): void {
    if (this.io) {
      this.io.to(`user:${userId}`).emit('chat:typing', {
        conversationId,
        isTyping
      });
    }
  }

  /**
   * Clean up inactive contexts
   */
  public cleanupInactiveContexts(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    for (const [key, context] of this.activeContexts.entries()) {
      if (context.sessionStarted < oneHourAgo) {
        this.activeContexts.delete(key);
      }
    }

    logger.info(`Cleaned up inactive contexts. Active: ${this.activeContexts.size}`);
  }

  /**
   * Get chat analytics
   */
  async getChatAnalytics(userId?: string, days: number = 7): Promise<{
    totalMessages: number;
    totalConversations: number;
    avgResponseTime: number;
    topQueries: string[];
    searchSuccessRate: number;
  }> {
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const messages = await db.chatMessage.findMany({
        where: {
          ...(userId && { userId }),
          timestamp: { gte: since }
        }
      });

      const totalMessages = messages.length;
      const avgResponseTime = messages.length > 0
        ? messages.reduce((sum, m) => sum + (m.processingTime || 0), 0) / messages.length
        : 0;

      const messagesWithResults = messages.filter(m => m.streamersReturned.length > 0);
      const searchSuccessRate = totalMessages > 0
        ? (messagesWithResults.length / totalMessages) * 100
        : 0;

      return {
        totalMessages,
        totalConversations: Math.ceil(totalMessages / 5), // Rough estimate
        avgResponseTime,
        topQueries: [], // Would extract from message analysis
        searchSuccessRate
      };

    } catch (error) {
      logger.error('Error getting chat analytics:', error);
      throw error;
    }
  }
}

export const chatService = new ChatService();