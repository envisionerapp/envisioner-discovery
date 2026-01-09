import React, { createContext, useContext, useState, useEffect } from 'react';
import { streamerService } from '@/services/streamerService';

interface LiveCountContextType {
  liveCount: number;
  totalCount: number;
  refreshCounts: () => Promise<void>;
  isLoading: boolean;
}

const LiveCountContext = createContext<LiveCountContextType | undefined>(undefined);

export const LiveCountProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [liveCount, setLiveCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const refreshCounts = async () => {
    try {
      setIsLoading(true);
      const stats = await streamerService.getRegionStats();
      setLiveCount(stats.liveCount || 0);
      setTotalCount(stats.total || 0);
    } catch (error) {
      console.error('Failed to fetch live counts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    refreshCounts();

    // Refresh every 30 seconds
    const interval = setInterval(refreshCounts, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <LiveCountContext.Provider value={{ liveCount, totalCount, refreshCounts, isLoading }}>
      {children}
    </LiveCountContext.Provider>
  );
};

export const useLiveCount = () => {
  const context = useContext(LiveCountContext);
  if (context === undefined) {
    throw new Error('useLiveCount must be used within a LiveCountProvider');
  }
  return context;
};
