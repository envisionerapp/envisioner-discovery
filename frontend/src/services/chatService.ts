import axios from 'axios';
import { withBase } from '@/utils/api';

export interface Streamer {
  id: string;
  platform: string;
  username: string;
  displayName: string;
  profileUrl: string;
  avatarUrl?: string;
  followers: number;
  currentViewers?: number;
  isLive: boolean;
  currentGame?: string;
  tags: string[];
  region: string;
  language: string;
  fraudCheck: string;
  streamTitles?: Array<{ title: string; date: string }>;
  profileDescription?: string;
  aboutSection?: string;
  panelImages?: Array<{ url: string; alt?: string }>;
  externalLinks?: {
    instagram?: string;
    twitter?: string;
    youtube?: string;
    discord?: string;
    tiktok?: string;
    facebook?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  conversationId: string;
  message: string;
  response?: string;
  type: 'user' | 'assistant';
  timestamp: Date;
  streamers?: Streamer[];
  processingTime?: number;
  metadata?: any;
}

export interface ChatResponse {
  success: boolean;
  data: {
    messageId: string;
    conversationId: string;
    response: string;
    streamers: Streamer[];
    processingTime: number;
    timestamp: string;
  };
}

export interface SearchResponse {
  success: boolean;
  data: {
    query: string;
    streamers: Streamer[];
    totalCount: number;
    summary: string;
    searchParams: any;
    processingTime: number;
  };
}

export interface ConversationSummary {
  id: string;
  title: string;
  lastMessage: string;
  lastActivity: Date;
  messageCount: number;
}

export interface HealthStatus {
  success: boolean;
  data: {
    openai: boolean;
    chat: boolean;
    search: boolean;
    timestamp: string;
  };
}

export interface TrendingResponse {
  success: boolean;
  data: {
    streamers: Streamer[];
    insights: string;
  };
}

class ChatService {
  private baseURL = withBase('/api/chat');

  // Health check
  async healthCheck(): Promise<HealthStatus> {
    const response = await axios.get(`${this.baseURL}/health`);
    return response.data;
  }

  // Send chat message with AI processing
  async sendMessage(message: string, conversationId?: string): Promise<ChatResponse> {
    const response = await axios.post(`${this.baseURL}/message`, {
      message,
      conversationId
    });
    return response.data;
  }

  // Direct AI search
  async searchStreamers(query: string, searchParams?: any): Promise<SearchResponse> {
    const response = await axios.post(`${this.baseURL}/search`, {
      query,
      searchParams
    });
    return response.data;
  }

  // Get conversation history
  async getConversation(conversationId: string): Promise<{
    success: boolean;
    data: {
      id: string;
      messages: ChatMessage[];
    };
  }> {
    const response = await axios.get(`${this.baseURL}/conversations/${conversationId}`);
    return response.data;
  }

  // Get chat history (list of conversations)
  async getChatHistory(): Promise<{
    success: boolean;
    data: ConversationSummary[];
  }> {
    const response = await axios.get(`${this.baseURL}/history`);
    return response.data;
  }

  // Delete conversation
  async deleteConversation(conversationId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await axios.delete(`${this.baseURL}/conversations/${conversationId}`);
    return response.data;
  }

  // Clear chat history
  async clearChatHistory(): Promise<{
    success: boolean;
    message: string;
    data: { deletedCount: number };
  }> {
    const response = await axios.delete(`${this.baseURL}/history`);
    return response.data;
  }

  // Get conversation suggestions
  async getConversationSuggestions(): Promise<{
    success: boolean;
    data: string[];
  }> {
    const response = await axios.get(`${this.baseURL}/suggestions`);
    return response.data;
  }

  // Get trending insights
  async getTrendingInsights(region?: string, limit?: number): Promise<TrendingResponse> {
    const params = new URLSearchParams();
    if (region) params.append('region', region);
    if (limit) params.append('limit', limit.toString());

    const response = await axios.get(`${this.baseURL}/trending?${params.toString()}`);
    return response.data;
  }

  // Compare streamers
  async compareStreamers(streamerIds: string[]): Promise<{
    success: boolean;
    data: {
      comparison: any;
      recommendation: string;
    };
  }> {
    const response = await axios.post(`${this.baseURL}/compare`, {
      streamerIds
    });
    return response.data;
  }

  // Find similar streamers
  async findSimilarStreamers(streamerId: string, limit?: number): Promise<{
    success: boolean;
    data: Streamer[];
  }> {
    const params = limit ? `?limit=${limit}` : '';
    const response = await axios.get(`${this.baseURL}/streamers/${streamerId}/similar${params}`);
    return response.data;
  }

  // Get chat analytics
  async getChatAnalytics(days?: number): Promise<{
    success: boolean;
    data: {
      totalMessages: number;
      totalConversations: number;
      avgResponseTime: number;
      topQueries: string[];
      searchSuccessRate: number;
    };
  }> {
    const params = days ? `?days=${days}` : '';
    const response = await axios.get(`${this.baseURL}/analytics/chat${params}`);
    return response.data;
  }

  // Get search analytics
  async getSearchAnalytics(timeframe?: number): Promise<{
    success: boolean;
    data: {
      totalSearches: number;
      avgProcessingTime: number;
      popularRegions: Array<{ region: string; count: number }>;
      popularTags: Array<{ tag: string; count: number }>;
      avgResultsReturned: number;
    };
  }> {
    const params = timeframe ? `?timeframe=${timeframe}` : '';
    const response = await axios.get(`${this.baseURL}/analytics/search${params}`);
    return response.data;
  }
}

export const chatService = new ChatService();
