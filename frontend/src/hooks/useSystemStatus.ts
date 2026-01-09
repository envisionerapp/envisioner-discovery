import { useQuery } from 'react-query';
import axios from 'axios';
import { withBase } from '@/utils/api';

interface SystemStatusData {
  health: {
    timestamp: string;
    score: number;
    details: {
      twitch: boolean;
      youtube: boolean;
      kick: boolean;
      database: boolean;
      queue: boolean;
    };
  } | null;
  lastLiveCheck: {
    startedAt: string;
    completedAt: string | null;
    success: boolean;
    platform: string;
  } | null;
  recentScrapingLogs: Array<{
    id: string;
    platform: string;
    success: boolean;
    startedAt: string;
    completedAt: string | null;
    recordsFound: number;
    recordsUpdated: number;
    errors: string[];
    duration: number | null;
  }>;
  dbOptimization: {
    timestamp: string;
    stats: {
      streamers: number;
      chatMessages: number;
      scrapingLogs: number;
      campaigns: number;
    };
  } | null;
}

export const useSystemStatus = () => {
  return useQuery<SystemStatusData>(
    ['systemStatus'],
    async () => {
      const response = await axios.get(withBase('/api/admin/system-stats'));
      return response.data.data;
    },
    {
      refetchInterval: 30000, // Refetch every 30 seconds
      staleTime: 20000, // Consider data stale after 20 seconds
    }
  );
};
