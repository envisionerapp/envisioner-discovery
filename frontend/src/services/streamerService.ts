import axios from 'axios';
import { withBase } from '@/utils/api';

export interface RegionStatsResponse {
  regionCounts: Record<string, number>;
  total?: number;
  liveCount?: number;
  flaggedCount?: number;
}

class StreamerService {
  private baseURL = withBase('/api/streamers');

  async getRegionStats(): Promise<RegionStatsResponse> {
    const res = await axios.get(`${this.baseURL}/stats`);
    const data = res.data?.data || {};
    return {
      regionCounts: data.regionCounts || {},
      total: data.total,
      liveCount: data.liveCount,
      flaggedCount: data.flaggedCount,
    };
  }

  async getStreamers(params?: {
    page?: number;
    limit?: number;
    sort?: string;
    dir?: 'asc' | 'desc';
    search?: string;
    platform?: string;
    region?: string;
    category?: string;  // Category filter (Gaming, iGaming, IRL, Music, etc.)
    favoritesOnly?: boolean;
    discardedOnly?: boolean;
    hasEmail?: boolean;  // Only show creators with contact email
    userId?: string;
  }): Promise<{
    items: Array<{
      id: string;
      platform: string;
      username: string;
      displayName: string;
      profileUrl: string;
      avatarUrl?: string;
      followers: number;
      currentViewers?: number | null;
      highestViewers?: number | null;
      isLive: boolean;
      region: string;
      language: string;
      inferredCountry?: string | null;
      inferredCategory?: string | null;
      primaryCategory?: string | null;
      updatedAt: string;
    }>;
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.sort) query.append('sort', params.sort);
    if (params?.dir) query.append('dir', params.dir);
    if (params?.search) query.append('search', params.search);
    if (params?.platform) query.append('platforms', params.platform);
    if (params?.region) query.append('regions', params.region);
    if (params?.category) query.append('categories', params.category);
    if (params?.favoritesOnly) query.append('favoritesOnly', 'true');
    if (params?.discardedOnly) query.append('discardedOnly', 'true');
    if (params?.hasEmail) query.append('hasEmail', 'true');
    if (params?.userId) query.append('userId', params.userId);
    // Hide discarded by default unless showing discarded only
    if (!params?.discardedOnly && params?.userId) {
      query.append('hideDiscarded', 'true');
    }
    const res = await axios.get(`${this.baseURL}?${query.toString()}`);
    return {
      items: res.data?.data || [],
      pagination: res.data?.pagination || { page: 1, limit: params?.limit || 100, total: 0, totalPages: 1 },
    };
  }
}

export const streamerService = new StreamerService();
