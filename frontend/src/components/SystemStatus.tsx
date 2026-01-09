import React from 'react';
import { useSystemStatus } from '@/hooks/useSystemStatus';
import { formatDistanceToNow } from 'date-fns';

export const SystemStatus: React.FC = () => {
  const { data, isLoading, error } = useSystemStatus();

  if (isLoading) {
    return (
      <div className="chip-glass rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-100 mb-3">System Status</h4>
        <p className="text-xs text-gray-400">Loading...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="chip-glass rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-100 mb-3">System Status</h4>
        <p className="text-xs text-red-400">Failed to load system status</p>
      </div>
    );
  }

  const formatTimestamp = (timestamp: string | null | undefined) => {
    if (!timestamp) return 'Never';
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return 'Invalid date';
    }
  };

  const getStatusColor = (status: string | boolean) => {
    if (typeof status === 'boolean') {
      return status ? 'text-green-400' : 'text-red-400';
    }
    switch (status?.toLowerCase()) {
      case 'completed':
      case 'success':
        return 'text-green-400';
      case 'failed':
      case 'error':
        return 'text-red-400';
      case 'running':
      case 'in_progress':
        return 'text-yellow-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusDot = (status: string | boolean) => {
    const color = getStatusColor(status);
    return <span className={`inline-block w-1.5 h-1.5 rounded-full ${color.replace('text-', 'bg-')}`} />;
  };

  return (
    <div className="chip-glass rounded-lg p-4">
      <h4 className="text-sm font-medium text-gray-100 mb-3">System Status</h4>

      <div className="space-y-3">
        {/* Last Live Check */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            {data.lastLiveCheck && getStatusDot(data.lastLiveCheck.success)}
            <span className="text-xs font-medium text-gray-300">Live Status Check</span>
          </div>
          <p className="text-[10px] text-gray-500 pl-3.5">
            {data.lastLiveCheck ? `${data.lastLiveCheck.platform} · ${formatTimestamp(data.lastLiveCheck.startedAt)}` : 'Never'}
          </p>
        </div>

        {/* Health Check */}
        {data.health && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              {getStatusDot(data.health.score > 0.8)}
              <span className="text-xs font-medium text-gray-300">System Health</span>
            </div>
            <p className="text-[10px] text-gray-500 pl-3.5">
              {formatTimestamp(data.health.timestamp)} · {Math.round(data.health.score * 100)}% healthy
            </p>
            <div className="flex gap-1.5 mt-1 pl-3.5 flex-wrap">
              {Object.entries(data.health.details).map(([key, value]) => (
                <span
                  key={key}
                  className={`text-[9px] px-1.5 py-0.5 rounded ${
                    value ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                  }`}
                >
                  {key}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Recent Scraping Activity */}
        {data.recentScrapingLogs && data.recentScrapingLogs.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              {getStatusDot(data.recentScrapingLogs[0].success)}
              <span className="text-xs font-medium text-gray-300">Last Scraping Job</span>
            </div>
            <p className="text-[10px] text-gray-500 pl-3.5">
              {data.recentScrapingLogs[0].platform} · {formatTimestamp(data.recentScrapingLogs[0].startedAt)}
            </p>
            <p className="text-[10px] text-gray-500 pl-3.5">
              Found: {data.recentScrapingLogs[0].recordsFound.toLocaleString()} · Updated: {data.recentScrapingLogs[0].recordsUpdated.toLocaleString()}
              {data.recentScrapingLogs[0].duration && ` · ${Math.round(data.recentScrapingLogs[0].duration / 1000)}s`}
            </p>
          </div>
        )}

        {/* Database Optimization */}
        {data.dbOptimization && (
          <div>
            <div className="flex items-center gap-2 mb-1">
              {getStatusDot(true)}
              <span className="text-xs font-medium text-gray-300">DB Optimization</span>
            </div>
            <p className="text-[10px] text-gray-500 pl-3.5">
              {formatTimestamp(data.dbOptimization.timestamp)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
