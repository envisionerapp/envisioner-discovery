import React from 'react';
import { useQuery } from 'react-query';
import { streamerService } from '@/services/streamerService';
import { flagFor, regionLabel } from '@/utils/geo';

export const RegionsOverview: React.FC<{ onRegionClick?: (region: string) => void }> = ({ onRegionClick }) => {
  const { data, isLoading } = useQuery(
    ['region-stats'],
    () => streamerService.getRegionStats(),
    {
      staleTime: 0,
      cacheTime: 30000
    }
  );

  const regionCounts = data?.regionCounts || {};
  const entries = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="card">
      <div className="px-4 sm:px-6 py-3 border-b border-gray-800/30 rounded-t-xl" style={{ background: 'linear-gradient(90deg, rgba(255, 107, 53, 0.10) 0%, rgba(255, 255, 255, 0) 100%)' }}>
        <h3 className="text-xs sm:text-sm font-semibold text-gray-400 uppercase tracking-wide">Regions</h3>
      </div>

      <div className="p-3 sm:p-4">
        {isLoading ? (
          <div className="text-xs text-gray-500 py-4">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="text-xs text-gray-500 py-4">No data</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {entries.map(([region, count]) => (
              <button
                key={region}
                className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all hover:scale-[1.02]"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.08) 0%, rgba(255, 255, 255, 0.95) 100%)',
                  border: '0.5px solid rgba(255, 107, 53, 0.15)'
                }}
                onClick={() => onRegionClick?.(region)}
              >
                <span className="text-base sm:text-lg">{flagFor(region)}</span>
                <span className="text-xs sm:text-sm text-gray-300 group-hover:text-primary-500 transition-colors">
                  {regionLabel(region)}
                </span>
                <span className="text-xs sm:text-sm font-bold text-gray-400 group-hover:text-primary-500 transition-colors tabular-nums">
                  {count.toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
