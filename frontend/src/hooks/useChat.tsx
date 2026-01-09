import { useState, useCallback, useEffect } from 'react';
import { chatService, ChatMessage, ConversationSummary, Streamer } from '../services/chatService';

export interface ChatState {
  messages: ChatMessage[];
  streamers: Streamer[];
  totalCount?: number;
  isLoading: boolean;
  error: string | null;
  conversationId?: string;
  processingTime?: number;
}

export interface ConversationHistoryState {
  conversations: ConversationSummary[];
  isLoading: boolean;
  error: string | null;
}

export function useChat() {
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    streamers: [],
    isLoading: false,
    error: null
  });

  const [conversationHistory, setConversationHistory] = useState<ConversationHistoryState>({
    conversations: [],
    isLoading: false,
    error: null
  });

  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Add a message to the current conversation
  const addMessage = useCallback((message: Partial<ChatMessage>) => {
    const safeId = (() => {
      try { return (crypto as any).randomUUID?.() || `msg_${Date.now()}_${Math.random().toString(36).slice(2,7)}`; } catch { return `msg_${Date.now()}_${Math.random().toString(36).slice(2,7)}`; }
    })();

    setChatState(prev => {
      const newMessage: ChatMessage = {
        id: safeId,
        userId: 'current-user',
        conversationId: prev.conversationId || `conv_${Date.now()}`,
        message: message.message || '',
        type: message.type || 'user',
        timestamp: new Date(),
        ...message
      };

      // Check if message with this ID already exists (prevent duplicates)
      const messageExists = prev.messages.some(m => m.id === newMessage.id);
      if (messageExists) {
        return prev; // Don't add duplicate
      }

      return {
        ...prev,
        messages: [...prev.messages, newMessage],
        conversationId: newMessage.conversationId
      };
    });

    return {} as ChatMessage; // Return placeholder since we can't return the actual message from setState
  }, []); // Remove the dependency on chatState.conversationId

  // Update conversation history for new chat (needs to be defined before searchStreamers)
  const updateConversationHistoryForNewChat = useCallback((conversationId: string, firstMessage: string, lastResponse: string) => {
    setConversationHistory(prev => {
      // Check if this conversation already exists in history
      const existingConversation = prev.conversations.find(c => c.id === conversationId);

      if (existingConversation) {
        // Update existing conversation
        return {
          ...prev,
          conversations: prev.conversations.map(c =>
            c.id === conversationId
              ? {
                  ...c,
                  lastMessage: lastResponse,
                  lastActivity: new Date(),
                  messageCount: c.messageCount + 2 // user + assistant message
                }
              : c
          ).sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()) // Sort by most recent
        };
      } else {
        // Add new conversation to history
        const newConversation = {
          id: conversationId,
          title: firstMessage.length <= 30 ? firstMessage : firstMessage.split(' ').slice(0, 5).join(' ') + '...',
          lastMessage: lastResponse,
          lastActivity: new Date(),
          messageCount: 2
        };

        return {
          ...prev,
          conversations: [newConversation, ...prev.conversations]
        };
      }
    });
  }, []);

  // Search streamers directly
  const searchStreamers = useCallback(async (query: string, searchParams?: any, silent?: boolean) => {
    if (!query.trim()) return false;

    setChatState(prev => ({
      ...prev,
      isLoading: true,
      error: null
    }));

    try {
      const response = await chatService.searchStreamers(query, searchParams);

      if (response.success) {
        const conversationId = silent ? chatState.conversationId || `conv_${Date.now()}` : `conv_${Date.now()}`;

        // Only add messages if not silent (silent = filter change, not new search)
        if (!silent) {
          // Add user query message
          addMessage({
            message: query,
            type: 'user',
            conversationId
          });

          // Add AI response with results
          addMessage({
            id: `ai_${Date.now()}`,
            message: response.data.summary,
            type: 'assistant',
            streamers: response.data.streamers,
            processingTime: response.data.processingTime,
            conversationId
          });

          // Update conversation history for search-based chats too
          updateConversationHistoryForNewChat(conversationId, query, response.data.summary);
        }

        setChatState(prev => ({
          ...prev,
          streamers: response.data.streamers,
          totalCount: response.data.totalCount,
          processingTime: response.data.processingTime,
          isLoading: false,
          conversationId
        }));

        return true;
      } else {
        throw new Error('Search failed');
      }
    } catch (error) {
      console.error('Error searching streamers:', error);
      setChatState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Search failed'
      }));
      return false;
    }
  }, [addMessage, updateConversationHistoryForNewChat, chatState.conversationId]);

  // Send message to AI
  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim()) return;

    // Generate conversation ID if needed
    const conversationId = chatState.conversationId || `conv_${Date.now()}`;

    // Add user message immediately (optimistic update - temporary)
    const tempUserId = `temp_${Date.now()}`;
    addMessage({
      id: tempUserId,
      message: message.trim(),
      type: 'user',
      conversationId
    });

    setChatState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      conversationId
    }));

    try {
      // First try the authenticated sendMessage endpoint
      const response = await chatService.sendMessage(message, conversationId);

      if (response.success) {
        // Remove the temporary user message
        const filteredMessages = chatState.messages.filter(m => m.id !== tempUserId);

        // Create the real messages from backend response
        const userMessage: ChatMessage = {
          id: `${response.data.messageId}-user`,
          userId: 'current-user',
          conversationId: response.data.conversationId,
          message: message.trim(),
          type: 'user',
          timestamp: new Date(response.data.timestamp)
        };

        const assistantMessage: ChatMessage = {
          id: `${response.data.messageId}-assistant`,
          userId: 'current-user',
          conversationId: response.data.conversationId,
          message: response.data.response,
          type: 'assistant',
          timestamp: new Date(response.data.timestamp),
          streamers: response.data.streamers,
          processingTime: response.data.processingTime
        };

        // Update state with both messages
        setChatState(prev => ({
          ...prev,
          messages: [...filteredMessages, userMessage, assistantMessage],
          streamers: response.data.streamers,
          totalCount: response.data.streamers?.length || 0,
          conversationId: response.data.conversationId,
          processingTime: response.data.processingTime,
          isLoading: false
        }));

        // Update conversation history immediately for new conversations
        updateConversationHistoryForNewChat(response.data.conversationId, message.trim(), response.data.response);
        return;
      }

    } catch (error) {
      console.error('Error sending message:', error);

      // Add user message if not already added
      const messages = chatState.messages || [];
      if (messages.length === 0 || messages[messages.length - 1].message !== message.trim()) {
        addMessage({
          message: message.trim(),
          type: 'user'
        });
      }

      // Add error message
      addMessage({
        message: 'Sorry, I encountered an error processing your message. Please try again.',
        type: 'assistant'
      });

      setChatState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }));
    }
  }, [chatState.conversationId, chatState.messages, addMessage, searchStreamers, updateConversationHistoryForNewChat]);

  // Load conversation history
  const loadConversationHistory = useCallback(async () => {
    setConversationHistory(prev => ({
      ...prev,
      isLoading: true,
      error: null
    }));

    try {
      const response = await chatService.getChatHistory();
      if (response.success) {
        // Ensure lastActivity is a proper Date object
        const conversations = response.data.map(conv => ({
          ...conv,
          lastActivity: new Date(conv.lastActivity)
        }));
        setConversationHistory({
          conversations,
          isLoading: false,
          error: null
        });
      } else {
        throw new Error('Failed to load conversation history');
      }
    } catch (error) {
      console.error('Error loading conversation history:', error);
      setConversationHistory(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load history'
      }));
    }
  }, []);

  // Load conversation by ID
  const loadConversation = useCallback(async (conversationId: string) => {
    setChatState(prev => ({
      ...prev,
      isLoading: true,
      error: null
    }));

    try {
      const response = await chatService.getConversation(conversationId);
      if (response.success && response.data) {
        // Extract messages from conversation object
        const messages = response.data.messages || [];

        // Extract all streamers from all messages in this conversation
        const allStreamers: Streamer[] = [];
        messages.forEach(msg => {
          if (msg.streamers && Array.isArray(msg.streamers)) {
            allStreamers.push(...msg.streamers);
          }
        });

        setChatState({
          messages: messages,
          streamers: allStreamers,
          totalCount: allStreamers.length,
          isLoading: false,
          error: null,
          conversationId
        });
      } else {
        throw new Error('Failed to load conversation');
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      setChatState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load conversation'
      }));
    }
  }, []);

  // Delete conversation
  const deleteConversation = useCallback(async (conversationId: string) => {
    try {
      const response = await chatService.deleteConversation(conversationId);
      if (response.success) {
        // Remove from history
        setConversationHistory(prev => ({
          ...prev,
          conversations: prev.conversations.filter(c => c.id !== conversationId)
        }));

        // If it's the current conversation, clear it
        if (chatState.conversationId === conversationId) {
          setChatState({
            messages: [],
            streamers: [],
            isLoading: false,
            error: null
          });
        }
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  }, [chatState.conversationId]);

  // Start new conversation
  const startNewConversation = useCallback(() => {
    setChatState({
      messages: [],
      streamers: [],
      isLoading: false,
      error: null
    });
  }, []);

  // Clear all messages in current conversation
  const clearMessages = useCallback(() => {
    setChatState(prev => ({
      ...prev,
      messages: [],
      streamers: [],
      error: null
    }));
  }, []);

  // Clear all chat history
  const clearAllHistory = useCallback(async () => {
    try {
      const response = await chatService.clearChatHistory();
      if (response.success) {
        setConversationHistory({
          conversations: [],
          isLoading: false,
          error: null
        });
        startNewConversation();
      }
    } catch (error) {
      console.error('Error clearing chat history:', error);
    }
  }, [startNewConversation]);


  // Load initial data
  useEffect(() => {
    // Load conversation history
    const loadHistory = async () => {
      try {
        const response = await chatService.getChatHistory();
        if (response.success) {
          // Ensure lastActivity is a proper Date object
          const conversations = response.data.map(conv => ({
            ...conv,
            lastActivity: new Date(conv.lastActivity)
          }));
          setConversationHistory({
            conversations,
            isLoading: false,
            error: null
          });
        }
      } catch (error) {
        console.log('Chat history requires auth, using local session');
        setConversationHistory({
          conversations: [],
          isLoading: false,
          error: null
        });
      }
    };

    // Load suggestions
    const loadSugs = async () => {
      try {
        const response = await chatService.getConversationSuggestions();
        if (response.success) {
          setSuggestions(response.data);
        }
      } catch (error) {
        console.log('Suggestions require auth, using defaults');
        setSuggestions([
          "Find gaming streamers in Mexico with 100k+ followers",
          "Show me who is live streaming right now",
          "I need music creators in Colombia for a campaign",
          "What VTubers are popular in Argentina?"
        ]);
      }
    };

    loadHistory();
    loadSugs();
  }, []);

  return {
    chatState,
    conversationHistory,
    suggestions,
    sendMessage,
    searchStreamers,
    loadConversation,
    deleteConversation,
    startNewConversation,
    clearMessages,
    clearAllHistory,
    loadConversationHistory,
    addMessage
  };
}
