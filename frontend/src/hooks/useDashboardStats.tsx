import { useEffect } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { subscribeToLiveStatusUpdates } from '@/utils/socket';
import { withBase } from '@/utils/api';

interface DashboardStats {
  totalStreamers: number;
  liveStreamers: number;
  activeCampaigns: number;
}

export const useDashboardStats = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<DashboardStats>(
    ['dashboard-stats'],
    async () => {
      const response = await fetch(withBase('/api/chat/dashboard/stats'));
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats');
      }
      const result = await response.json();
      return result.data;
    },
    {
      staleTime: 30 * 1000, // 30 seconds
      refetchInterval: 60 * 1000, // Refetch every minute
    }
  );

  // Subscribe to real-time live status updates
  useEffect(() => {
    const unsubscribe = subscribeToLiveStatusUpdates(() => {
      console.log('🔴 Live status updated, invalidating dashboard stats');
      // Invalidate and refetch dashboard stats when live status changes
      queryClient.invalidateQueries(['dashboard-stats']);
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient]);

  return {
    stats: data || {
      totalStreamers: 0,
      liveStreamers: 0,
      activeCampaigns: 0,
    },
    isLoading,
    error,
  };
};
