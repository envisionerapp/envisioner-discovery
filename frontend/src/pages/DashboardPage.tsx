import React, { useState, useEffect } from 'react';
import { differenceInMinutes, formatDistanceToNow } from 'date-fns';
import { HashtagIcon, UserIcon, MapPinIcon, EyeIcon, ClockIcon, ChartBarIcon, UsersIcon, RocketLaunchIcon, CheckCircleIcon, ChevronUpIcon, ChevronDownIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { PlatformIcon } from '@/components/icons/PlatformIcon';
import { getStreamerAvatar, DEFAULT_AVATAR } from '@/utils/avatars';
import { flagFor, regionLabel } from '@/utils/geo';

// Handle image load errors by falling back to placeholder
const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  if (img.src !== DEFAULT_AVATAR) {
    img.src = DEFAULT_AVATAR;
  }
};
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useLiveCount } from '@/contexts/LiveCountContext';
import { withBase } from '@/utils/api';

const timeRanges = ['24h','7d','30d','90d'];

// Demo rows for Live Streamers (replace with real data when available)
const demoLiveRows = [
  { n: 'Streamer_1', p: 'twitch' as const, r: 'mexico', v: 5400, g: 'RPG', ll: '2h ago' },
  { n: 'Streamer_2', p: 'youtube' as const, r: 'colombia', v: 3100, g: 'Just Chatting', ll: '5h ago' },
  { n: 'Streamer_3', p: 'kick' as const, r: 'chile', v: 1800, g: 'Shooter', ll: '1d ago' },
  { n: 'Streamer_4', p: 'twitch' as const, r: 'peru', v: 2200, g: 'IRL', ll: '30m ago' },
  { n: 'Streamer_5', p: 'youtube' as const, r: 'argentina', v: 4100, g: 'Music', ll: '12h ago' },
];

interface LiveStreamer {
  id: string;
  displayName: string;
  platform: 'TWITCH' | 'YOUTUBE' | 'KICK' | 'FACEBOOK' | 'TIKTOK';
  region: string;
  currentViewers: number;
  highestViewers: number;
  currentGame: string;
  lastStreamed: string;
  avatarUrl: string;
  isLive: boolean;
}

interface TopCategory {
  game: string;
  totalViewers: number;
  streamerCount: number;
  rank: number;
  avgViewers: number;
}

const DashboardPage: React.FC = () => {
  const { stats, isLoading: statsLoading } = useDashboardStats();
  const { liveCount, isLoading: liveCountLoading } = useLiveCount();
  const [liveStreamers, setLiveStreamers] = useState<LiveStreamer[]>([]);
  const [topStreamers, setTopStreamers] = useState<LiveStreamer[]>([]);
  const [topCategories, setTopCategories] = useState<TopCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isHidden, setIsHidden] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [sort, setSort] = useState<string>('viewers');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [platformFilter, setPlatformFilter] = useState<'' | 'twitch' | 'youtube' | 'kick'>('');
  const [showDetails, setShowDetails] = useState(false);
  const [selectedStreamer, setSelectedStreamer] = useState<any | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1
  });

  const isSortingRef = React.useRef(false);
  const scrollPositionRef = React.useRef(0);

  const toggleSort = (key: string) => {
    const normalized = key.toLowerCase();
    setPage(1);
    if (sort.toLowerCase() === normalized) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(normalized);
      setDir('asc');
    }
  };

  const handlePageChange = (newPage: number) => {
    // Only hide if actually changing pages
    if (newPage !== page) {
      setIsHidden(true);
      setPage(newPage);
    }
  };

  // Helper function to format streamer data for display
  const formatStreamerForDisplay = (streamer: LiveStreamer, index: number) => {
    const formatTimeAgo = (dateString: string) => {
      if (!dateString) return 'Unknown';
      const date = new Date(dateString);
      const now = new Date();
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
      const diffInHours = Math.floor(diffInMinutes / 60);
      if (diffInHours < 24) return `${diffInHours}h ago`;
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    };

    return {
      n: streamer.displayName,
      p: streamer.platform.toLowerCase() as 'twitch' | 'youtube' | 'kick' | 'facebook' | 'tiktok',
      r: streamer.region.toLowerCase(),
      v: streamer.currentViewers || 0,
      peak: streamer.highestViewers || 0,
      g: streamer.currentGame || 'Unknown',
      ll: streamer.isLive ? 'Live' : formatTimeAgo(streamer.lastStreamed),
      avatar: getStreamerAvatar(streamer)
    };
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);

        // Fetch live streamers, top streamers, and top categories in parallel
        const platformParam = platformFilter ? `&platform=${platformFilter}` : '';
        const [liveResponse, topStreamersResponse, topCategoriesResponse] = await Promise.all([
          fetch(withBase(`/api/chat/dashboard/live?page=${page}&limit=${limit}&sort=${sort}&dir=${dir}${platformParam}`)),
          fetch(withBase(`/api/chat/dashboard/top-streamers?limit=25${platformParam}`)),
          fetch(withBase('/api/chat/dashboard/top-categories?limit=10'))
        ]);

        if (liveResponse.ok) {
          const liveResult = await liveResponse.json();
          if (liveResult.success) {
            setLiveStreamers(liveResult.data);
            // Update pagination if provided by API
            if (liveResult.pagination) {
              setPagination(liveResult.pagination);
            } else {
              // Fallback pagination calculation
              setPagination({
                page,
                limit,
                total: liveResult.data.length,
                totalPages: Math.ceil(liveResult.data.length / limit)
              });
            }
          }
        }

        if (topStreamersResponse.ok) {
          const topStreamersResult = await topStreamersResponse.json();
          if (topStreamersResult.success) {
            setTopStreamers(topStreamersResult.data);
          }
        }

        if (topCategoriesResponse.ok) {
          const topCategoriesResult = await topCategoriesResponse.json();
          if (topCategoriesResult.success) {
            setTopCategories(topCategoriesResult.data);
          }
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setIsLoading(false);
        // Show content after data finishes loading
        setIsHidden(false);
      }
    };

    fetchDashboardData();
  }, [page, limit, sort, dir, platformFilter]);

  // Restore scroll position after data loads (only after sorting)
  useEffect(() => {
    if (!isLoading && isSortingRef.current) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        window.scrollTo({
          top: scrollPositionRef.current,
          behavior: 'auto'
        });
        isSortingRef.current = false;
        scrollPositionRef.current = 0;
      });
    }
  }, [isLoading]);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
        <p className="text-gray-400">Stream performance and campaign overview</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6" style={{ opacity: isHidden ? 0 : 1, transition: 'opacity 0.15s ease' }}>
        <div className="card p-4 sm:p-6 relative overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid rgba(20, 28, 46, 0.15)' }}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-600/10 rounded-full blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <UsersIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-500" />
              <p className="text-[10px] sm:text-xs font-semibold text-primary-200 uppercase tracking-wider">Total Streamers</p>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-2xl sm:text-4xl font-black text-primary-500">
                {statsLoading ? '...' : stats.totalStreamers.toLocaleString()}
              </span>
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-primary-600/20 backdrop-blur flex items-center justify-center border border-primary-500/30">
                <UsersIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary-500" />
              </div>
            </div>
          </div>
        </div>
        <div className="card p-4 sm:p-6 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(255, 107, 53, 0.15) 0%, rgba(153, 27, 27, 0.08) 100%)', border: '1px solid rgba(255, 107, 53, 0.3)' }}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF6B35]/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '3s' }} />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-[#FF6B35] animate-pulse" style={{ animationDuration: '1.5s', boxShadow: '0 0 8px rgba(255, 107, 53, 0.8)' }} />
              <p className="text-[10px] sm:text-xs font-semibold text-[#FF6B35] uppercase tracking-wider">Live Now</p>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-2xl sm:text-4xl font-black text-white animate-pulse" style={{ animationDuration: '2s', textShadow: '0 0 20px rgba(255, 107, 53, 0.5)' }}>
                {liveCountLoading ? '...' : liveCount.toLocaleString()}
              </span>
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-[#FF6B35]/20 backdrop-blur flex items-center justify-center border border-[#FF6B35]/30">
                <RocketLaunchIcon className="h-5 w-5 sm:h-6 sm:w-6 text-[#FF6B35] animate-pulse" style={{ animationDuration: '2.5s' }} />
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Top lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6" style={{ opacity: isHidden ? 0 : 1, transition: 'opacity 0.15s ease' }}>
        <div className="card overflow-hidden">
          <div className="px-4 sm:px-6 py-3 border-b border-gray-800/30 rounded-t-xl" style={{ background: '#FFFFFF' }}>
            <div className="flex items-center gap-2">
              <TrophyIcon className="h-4 w-4 sm:h-4 sm:w-4 text-primary-500 flex-shrink-0" />
              <h3 className="text-xs sm:text-sm font-semibold text-gray-400 uppercase tracking-wide">Top Streamers</h3>
              <span className="text-[9px] sm:text-xs text-gray-500 ml-auto hidden sm:inline whitespace-nowrap">By Peak Viewers</span>
            </div>
          </div>
          <div className="p-2">
            <div className="divide-y overflow-y-auto" style={{ maxHeight: '400px', scrollbarWidth: 'thin', scrollbarColor: '#141C2E rgba(31, 41, 55, 0.3)', borderColor: 'rgba(156, 163, 175, 0.3)' }}>
            {isLoading ? (
              <div className="text-center py-4 text-gray-500">Loading...</div>
            ) : topStreamers.length === 0 ? (
              <div className="text-center py-4 text-gray-500">No streamers</div>
            ) : (
              topStreamers.map((streamer, i) => {
                const p = streamer.platform.toLowerCase();
                const meta = `${p} • ${regionLabel(streamer.region?.toLowerCase() || '')}`;
                const brand = p==='twitch'?'brand-twitch':p==='youtube'?'brand-youtube':'brand-kick';

                // Generate profile URL
                const username = (streamer as any).username;
                let profileUrl = '';
                if (username) {
                  const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
                  profileUrl = p === 'twitch'
                    ? `https://twitch.tv/${cleanUsername}`
                    : p === 'youtube'
                    ? `https://www.youtube.com/@${cleanUsername}`
                    : p === 'kick'
                    ? `https://kick.com/${cleanUsername}`
                    : '';
                }

                return (
                  <div key={streamer.id} className="group relative p-2 sm:p-2.5 transition-all" style={{ paddingLeft: '8px', backgroundColor: i % 2 === 0 ? 'rgba(156, 163, 175, 0.08)' : 'rgba(0, 0, 0, 0.3)' }}>
                    <div className="flex items-center gap-2 sm:gap-3">
                      {/* Rank Badge */}
                      <div className="flex-shrink-0 w-6 h-6 rounded-md bg-gradient-to-br from-primary-600/20 to-primary-600/5 border border-primary-600/30 flex items-center justify-center">
                        <span className="text-[10px] font-black text-primary-500">{i + 1}</span>
                      </div>

                      {/* Avatar */}
                      <div className="relative w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0">
                        <img className="w-full h-full rounded-md sm:rounded-lg object-cover ring-1 sm:ring-2 ring-gray-800 group-hover:ring-primary-600/50 transition-all" src={getStreamerAvatar(streamer)} alt="avatar" onError={handleImageError} />
                        <span className={`absolute -bottom-0.5 -right-0.5 sm:-bottom-1 sm:-right-1 flex items-center justify-center rounded-sm sm:rounded-md ${brand} w-4 h-4 sm:w-5 sm:h-5`} style={{ backgroundColor: 'rgba(0,0,0,0.9)', border: '1px solid rgba(0,0,0,1)' }}>
                          <PlatformIcon name={p as any} className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        </span>
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-semibold text-gray-100 truncate group-hover:text-primary-400 transition-colors">{streamer.displayName}</p>
                        <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-gray-400">
                          {flagFor(streamer.region?.toLowerCase() || '') && (
                            <>
                              <span className="text-sm">{flagFor(streamer.region?.toLowerCase() || '')}</span>
                              <span className="truncate hidden sm:inline">{regionLabel(streamer.region?.toLowerCase() || '')}</span>
                              <span className="truncate sm:hidden">{regionLabel(streamer.region?.toLowerCase() || '').substring(0, 10)}</span>
                              <span className="hidden sm:inline">•</span>
                            </>
                          )}
                          <div className="flex items-center gap-0.5 sm:gap-1">
                            <TrophyIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-[#FF6B35]" />
                            <span className="font-semibold text-[#FF6B35]">{(streamer.highestViewers / 1000).toFixed(1)}k</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => {
                            setSelectedStreamer(streamer);
                            setShowDetails(true);
                          }}
                          className="inline-flex items-center justify-center px-2 sm:px-2.5 py-1.5 rounded-md text-[10px] sm:text-xs font-bold transition-all hover:scale-105"
                          style={{
                            backgroundColor: '#FF6B35',
                            color: '#141C2E',
                            minHeight: '28px'
                          }}
                        >
                          View
                        </button>
                        {profileUrl && (
                          <a
                            href={profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center px-2 sm:px-2.5 py-1.5 rounded-md text-xs font-bold transition-all hover:scale-105"
                            style={{
                              backgroundColor: p === 'twitch' ? '#FF6B35' : p === 'youtube' ? '#FF6B35' : p === 'kick' ? '#FF6B35' : 'rgba(255,255,255,0.08)',
                              color: p === 'kick' ? '#141C2E' : '#ffffff',
                              minHeight: '28px'
                            }}
                          >
                            <PlatformIcon name={p as any} className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-4 sm:px-6 py-3 border-b border-gray-800/30 rounded-t-xl" style={{ background: '#FFFFFF' }}>
            <div className="flex items-center gap-2">
              <HashtagIcon className="h-4 w-4 sm:h-4 sm:w-4 text-primary-500 flex-shrink-0" />
              <h3 className="text-xs sm:text-sm font-semibold text-gray-400 uppercase tracking-wide">Top Categories</h3>
              <span className="text-[9px] sm:text-xs text-gray-500 ml-auto hidden sm:inline whitespace-nowrap">By Total Viewers</span>
            </div>
          </div>
          <div className="p-2">
            <div
              className="divide-y overflow-y-auto"
              style={{
                maxHeight: '400px',
                scrollbarWidth: 'thin',
                scrollbarColor: '#141C2E rgba(31, 41, 55, 0.3)',
                borderColor: 'rgba(156, 163, 175, 0.3)'
              }}
            >
            {isLoading ? (
              <div className="text-center py-4 text-gray-500">Loading...</div>
            ) : topCategories.length === 0 ? (
              <div className="text-center py-4 text-gray-500">No categories</div>
            ) : (
              topCategories.map((category, i) => {
                const maxViewers = topCategories[0]?.totalViewers || 1;
                const percentage = (category.totalViewers / maxViewers) * 100;
                return (
                  <div key={category.game} className="group relative p-2 sm:p-2.5 transition-all" style={{ paddingLeft: '8px', backgroundColor: i % 2 === 0 ? 'rgba(156, 163, 175, 0.08)' : 'rgba(0, 0, 0, 0.3)' }}>
                    <div className="flex items-center gap-2 sm:gap-3 mb-2">
                      {/* Rank Badge */}
                      <div className="flex-shrink-0 w-6 h-6 rounded-md bg-gradient-to-br from-primary-600/20 to-primary-600/5 border border-primary-600/30 flex items-center justify-center">
                        <span className="text-[10px] font-black text-primary-500">{category.rank}</span>
                      </div>

                      {/* Game Name */}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-semibold text-gray-100 truncate group-hover:text-primary-400 transition-colors">{category.game}</p>
                        <div className="flex items-center gap-1 sm:gap-2 text-[10px] sm:text-xs text-gray-400">
                          <div className="flex items-center gap-0.5 sm:gap-1">
                            <EyeIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-primary-500" />
                            <span className="font-semibold text-primary-400">{(category.totalViewers / 1000).toFixed(1)}k</span>
                          </div>
                          <span className="hidden sm:inline">•</span>
                          <span className="hidden sm:inline">{category.streamerCount} streamer{category.streamerCount !== 1 ? 's' : ''}</span>
                        </div>
                      </div>

                      {/* Avg Viewers */}
                      <div className="flex-shrink-0 text-right hidden sm:block">
                        <p className="text-xs text-gray-400">Avg</p>
                        <p className="text-xs font-bold text-[#FF6B35]">{(category.avgViewers / 1000).toFixed(1)}k</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-1 sm:h-1.5 bg-gray-800/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
          </div>
        </div>
      </div>

      {/* Live Streamers (full width) */}
      <div className="grid grid-cols-1 gap-4" id="live-streamers-table">
        <div className="card">
          <div className="px-4 sm:px-6 py-3 border-b border-gray-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-t-xl" style={{ background: '#FFFFFF' }}>
            <h3 className="text-xs sm:text-sm font-semibold text-gray-400 uppercase tracking-wide text-center sm:text-left">Live Streamers</h3>
            <div className="rounded-xl p-1.5 mx-auto sm:mx-0" style={{ border: '0.5px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(10px)' }}>
              <div className="flex items-center gap-2">
                {[
                  { key: '', label: 'All' },
                  { key: 'twitch', label: 'Twitch' },
                  { key: 'youtube', label: 'YouTube' },
                  { key: 'kick', label: 'Kick' },
                ].map((opt) => (
                  (() => {
                    const active = platformFilter === (opt.key as any);
                    const common = 'inline-flex items-center justify-center rounded-lg h-7 w-7 md:h-8 md:w-8';
                    if (active) {
                      if (opt.key === '') {
                        return (
                          <button
                            key={opt.key || 'all'}
                            className={`${common}`}
                            style={{ backgroundColor: '#FF6B35', color: '#141C2E' }}
                            title="All"
                            aria-label="All platforms"
                            onClick={() => { setPage(1); setPlatformFilter(opt.key as any); }}
                          >
                            <UsersIcon className="h-3.5 w-3.5" />
                          </button>
                        );
                      }
                      let bg = 'rgba(255,255,255,0.08)';
                      let color = '#ffffff';
                      if (opt.key === 'twitch') { bg = '#FF6B35'; color = '#ffffff'; }
                      else if (opt.key === 'youtube') { bg = '#FF6B35'; color = '#ffffff'; }
                      else if (opt.key === 'kick') { bg = '#FF6B35'; color = '#141C2E'; }
                      return (
                        <button
                          key={opt.key}
                          className={`${common}`}
                          style={{ backgroundColor: bg, color }}
                          title={opt.label}
                          aria-label={opt.label}
                          onClick={() => { setPage(1); setPlatformFilter(opt.key as any); }}
                        >
                          <PlatformIcon name={opt.key as any} className="h-3.5 w-3.5" />
                        </button>
                      );
                    }
                    // inactive
                    return (
                      <button
                        key={opt.key || 'all'}
                        className={`${common} hover:bg-white/5`}
                        style={{ backgroundColor: 'rgba(0,0,0,0.20)', border: '0.5px solid rgba(255,255,255,0.15)' }}
                        title={opt.label}
                        aria-label={opt.label}
                        onClick={() => { setPage(1); setPlatformFilter(opt.key as any); }}
                      >
                        {opt.key === '' ? (
                          <UsersIcon className="h-3.5 w-3.5 text-gray-400" />
                        ) : (
                          <PlatformIcon name={opt.key as any} className="h-3.5 w-3.5" style={{ color: '#141C2E' }} />
                        )}
                      </button>
                    );
                  })()
                ))}
              </div>
            </div>
          </div>
          <div className="card-body" style={{ minHeight: '600px' }}>
            {/* Mobile list view */}
            <div className="md:hidden space-y-3" style={{ transition: 'opacity 0.2s ease-in-out', opacity: isLoading ? 0.5 : 1 }}>
              {isLoading ? (
                <div className="p-3 rounded-xl chip-glass text-center text-gray-400">
                  Loading live streamers...
                </div>
              ) : liveStreamers.length === 0 ? (
                <div className="p-3 rounded-xl chip-glass text-center text-gray-400">
                  No live streamers found
                </div>
              ) : (
                liveStreamers.map((streamer, i) => {
                  const row = formatStreamerForDisplay(streamer, i);
                const bg = row.p === 'twitch' ? '#FF6B35' : row.p === 'youtube' ? '#FF6B35' : '#FF6B35';
                const color = row.p === 'kick' ? '#141C2E' : '#ffffff';
                const slug = row.n.replace(/\s+/g,'').toLowerCase();
                const url = row.p === 'twitch'
                  ? `https://twitch.tv/${slug}`
                  : row.p === 'youtube'
                    ? `https://www.youtube.com/@${slug}`
                    : `https://kick.com/${slug}`;
                const ll = row.ll.toLowerCase();
                const live = ll.includes('now') || ll.includes('live');
                const soon = ll.includes('m');
                const recent = ll.includes('h');
                const day = ll.includes('d');
                const style = live
                  ? { bg: 'rgba(16,185,129,0.18)', border: 'rgba(16,185,129,0.40)', dot: '#FF6B35', text: '#FF6B35' }
                  : soon || recent
                    ? { bg: 'rgba(255,107,53,0.12)', border: 'rgba(255,107,53,0.30)', dot: '#FF6B35', text: '#FF6B35' }
                    : day
                      ? { bg: 'rgba(255,107,53,0.12)', border: 'rgba(255,107,53,0.30)', dot: '#FF6B35', text: '#FF6B35' }
                      : { bg: 'rgba(20,28,46,0.12)', border: 'rgba(20,28,46,0.30)', dot: '#141C2E', text: '#FFFFFF' };
                return (
                  <div key={i} className="p-4 rounded-xl chip-glass">
                    {/* Header: Avatar + Name + Region */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="relative h-12 w-12 flex-shrink-0">
                        <div className="rounded-full overflow-hidden w-full h-full relative" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
                          <img className="block w-full h-full object-cover" src={row.avatar} alt="avatar" loading="lazy" style={{ filter: 'brightness(0.9)' }} onError={handleImageError} />
                          <span className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.12)' }} />
                        </div>
                        <span className={`absolute flex items-center justify-center rounded-full ${row.p==='twitch'?'brand-twitch':row.p==='youtube'?'brand-youtube':'brand-kick'}`} style={{ bottom: -2, right: -2, width: 20, height: 20, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 3 }}>
                          <PlatformIcon name={row.p as any} className="h-3.5 w-3.5" />
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-gray-100 truncate" title={row.n}>{row.n}</div>
                        <div className="text-xs text-gray-400 truncate">{row.g}</div>
                      </div>
                      <div className="flex-shrink-0">
                        <span className="region-chip"><span className="text-sm">{flagFor(row.r)}</span><span>{regionLabel(row.r)}</span></span>
                      </div>
                    </div>

                    {/* Visit Channel Button */}
                    {row.username && row.platform && (
                      <a
                        href={(() => {
                          const cleanUsername = String(row.username).startsWith('@') ? String(row.username).slice(1) : String(row.username);
                          const platform = String(row.platform).toLowerCase();
                          return platform === 'twitch' ? `https://twitch.tv/${cleanUsername}` :
                                 platform === 'youtube' ? `https://www.youtube.com/@${cleanUsername}` :
                                 platform === 'kick' ? `https://kick.com/${cleanUsername}` : '#';
                        })()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full mb-3"
                      >
                        <button className="w-full py-2.5 px-4 rounded-lg font-bold text-sm text-black transition-all duration-200 hover:shadow-lg hover:shadow-primary-500/30 hover:scale-[1.01] active:scale-[0.99]"
                          style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #FF6B35 100%)' }}>
                          <div className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            <span>Visit Channel</span>
                          </div>
                        </button>
                      </a>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="chip-glass px-2 py-1.5 rounded-lg text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <EyeIcon className="h-3.5 w-3.5 text-primary-500" />
                          <span className="text-[11px] text-gray-400 uppercase font-medium tracking-wide">Viewers</span>
                        </div>
                        <div className="text-sm font-bold text-gray-100" style={{ fontVariantNumeric: 'tabular-nums' }}>{row.v.toLocaleString()}</div>
                      </div>
                      <div className="chip-glass px-2 py-1.5 rounded-lg text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <TrophyIcon className="h-3.5 w-3.5 text-[#FF6B35]" />
                          <span className="text-[11px] text-gray-400 uppercase font-medium tracking-wide">Peak</span>
                        </div>
                        <div className="text-sm font-bold text-gray-100" style={{ fontVariantNumeric: 'tabular-nums' }}>{row.peak.toLocaleString()}</div>
                      </div>
                      <div className="chip-glass px-2 py-1.5 rounded-lg text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <ClockIcon className="h-3.5 w-3.5 text-gray-400" />
                          <span className="text-[11px] text-gray-400 uppercase font-medium tracking-wide">Status</span>
                        </div>
                        <div className="flex items-center justify-center">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px]" style={{ background: style.bg, border: `0.5px solid ${style.border}`, color: style.text }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.dot }} />
                            <span>{row.ll}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedStreamer(streamer);
                          setShowDetails(true);
                        }}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold"
                        style={{ backgroundColor: '#FF6B35', color: '#141C2E', flex: '1 1 0', minHeight: '36px', padding: '8px 12px' }}
                      >
                        <span>View Details</span>
                      </button>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold"
                        style={{ backgroundColor: bg, color, flex: '1 1 0', minHeight: '36px', padding: '8px 12px' }}
                      >
                        <PlatformIcon name={row.p as any} className="h-3 w-3" />
                        <span>Watch</span>
                      </a>
                    </div>
                  </div>
                );
                })
              )}
            </div>

            {/* Desktop table view */}
            <div className="hidden md:block overflow-x-auto">
              <table className="table table-compact table-striped w-full" style={{ transition: 'opacity 0.2s ease-in-out', opacity: isLoading ? 0.5 : 1 }}>
                <thead>
                  <tr>
                    <th style={{ width: '5%', paddingLeft: '12px', paddingRight: '12px' }} className="text-center"><span className="th text-primary-500">#</span></th>
                    <th style={{ width: '25%' }}>
                      <button type="button" className="th uppercase text-white" onClick={(e) => { e.preventDefault(); toggleSort('displayname'); }}>
                        <UserIcon className="text-primary-500" /><span>STREAMER</span> {sort.toLowerCase()==='displayname' && (dir==='asc' ? <ChevronUpIcon className="h-3.5 w-3.5 text-primary-500" /> : <ChevronDownIcon className="h-3.5 w-3.5 text-primary-500" />)}
                      </button>
                    </th>
                    <th style={{ width: '14%' }}>
                      <button type="button" className="th uppercase text-white" onClick={(e) => { e.preventDefault(); toggleSort('region'); }}>
                        <MapPinIcon className="text-primary-500" /><span>REGION</span> {sort.toLowerCase()==='region' && (dir==='asc' ? <ChevronUpIcon className="h-3.5 w-3.5 text-primary-500" /> : <ChevronDownIcon className="h-3.5 w-3.5 text-primary-500" />)}
                      </button>
                    </th>
                    <th style={{ width: '14%' }}>
                      <span className="th uppercase text-white"><ClockIcon className="text-primary-500" />Last Live</span>
                    </th>
                    <th style={{ width: '14%' }}>
                      <button type="button" className="th uppercase text-white" onClick={(e) => { e.preventDefault(); toggleSort('viewers'); }}>
                        <EyeIcon className="text-primary-500" /><span>VIEWERS</span> {sort.toLowerCase()==='viewers' && (dir==='asc' ? <ChevronUpIcon className="h-3.5 w-3.5 text-primary-500" /> : <ChevronDownIcon className="h-3.5 w-3.5 text-primary-500" />)}
                      </button>
                    </th>
                    <th style={{ width: '14%' }}>
                      <button type="button" className="th uppercase text-white" onClick={(e) => { e.preventDefault(); toggleSort('peak'); }}>
                        <TrophyIcon className="text-primary-500" /><span>PEAK</span> {sort.toLowerCase()==='peak' && (dir==='asc' ? <ChevronUpIcon className="h-3.5 w-3.5 text-primary-500" /> : <ChevronDownIcon className="h-3.5 w-3.5 text-primary-500" />)}
                      </button>
                    </th>
                    <th style={{ width: '14%' }} className="text-right pr-6 md:pr-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'rgba(156, 163, 175, 0.3)' }}>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-400">
                        Loading live streamers...
                      </td>
                    </tr>
                  ) : liveStreamers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-400">
                        No live streamers found
                      </td>
                    </tr>
                  ) : (
                    liveStreamers.map((streamer, i) => {
                      const row = formatStreamerForDisplay(streamer, i);
                      const rowNumber = (page - 1) * limit + i + 1;
                      return (
                    <tr key={i} className="animate-fade-in">
                      <td className="align-middle text-center" style={{ paddingLeft: '12px', paddingRight: '12px' }}>
                        <div className="flex-shrink-0 w-6 h-6 rounded-md bg-gradient-to-br from-primary-600/20 to-primary-600/5 border border-primary-600/30 flex items-center justify-center mx-auto">
                          <span className="text-[10px] font-black text-primary-500">{rowNumber}</span>
                        </div>
                      </td>
                      <td className="text-gray-100">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative h-8 w-8 sm:h-9 sm:w-9">
                            <div className="rounded-full overflow-hidden w-full h-full relative" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
                              <img className="block w-full h-full object-cover" src={row.avatar} alt="avatar" loading="lazy" style={{ filter: 'brightness(0.9)' }} onError={handleImageError} />
                              <span className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.12)' }} />
                            </div>
                            <span className={`absolute flex items-center justify-center rounded-full ${row.p==='twitch'?'brand-twitch':row.p==='youtube'?'brand-youtube':'brand-kick'}`} style={{ bottom: -4, right: -4, width: 16, height: 16, backgroundColor: 'rgba(0,0,0,0.75)' }}>
                              <PlatformIcon name={row.p as any} className="h-3 w-3" />
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm">{row.n}</div>
                            <div className="text-xs text-gray-400 truncate">{row.g}</div>
                          </div>
                        </div>
                      </td>
                      <td className="align-middle"><span className="region-chip"><span className="text-sm">{flagFor(row.r)}</span><span>{regionLabel(row.r)}</span></span></td>
                      <td className="align-middle whitespace-nowrap">
                        {(() => {
                          const ll = row.ll.toLowerCase();
                          const live = ll.includes('now') || ll.includes('live');
                          const soon = ll.includes('m');
                          const recent = ll.includes('h');
                          const day = ll.includes('d');
                          const style = live
                            ? { bg: '#FF6B35', border: 'transparent', dot: '#ffffff', text: '#ffffff' }
                            : soon || recent
                              ? { bg: 'rgba(255,107,53,0.12)', border: 'rgba(255,107,53,0.30)', dot: '#FF6B35', text: '#FF6B35' }
                              : day
                                ? { bg: 'rgba(255,107,53,0.12)', border: 'rgba(255,107,53,0.30)', dot: '#FF6B35', text: '#FF6B35' }
                                : { bg: 'rgba(20,28,46,0.12)', border: 'rgba(20,28,46,0.30)', dot: '#141C2E', text: '#FFFFFF' };
                          return (
                            <span className={live ? "inline-flex items-center px-3 py-0 rounded-full text-[9px] animate-pulse" : "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px]"} style={{ background: live ? '#FF6B35' : style.bg, backdropFilter: live ? 'blur(12px)' : undefined, border: live ? '1px solid #FF6B35' : `0.5px solid ${style.border}`, color: style.text, fontWeight: live ? '900' : 'normal', animationDuration: live ? '2s' : undefined }}>
                              {!live && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.dot }} />}
                              <span style={live ? { fontSize: '7.56px', letterSpacing: '1.5px', fontWeight: '900' } : {}}>{live ? 'LIVE' : row.ll}</span>
                            </span>
                          );
                        })()}
                      </td>
                      <td className="text-left text-gray-300 align-middle">
                        {(() => {
                          const ll = row.ll.toLowerCase();
                          const isLive = ll.includes('now') || ll.includes('live');
                          const viewers = row.v;
                          const viewersColor = isLive
                            ? viewers >= 10000 ? '#FF6B35'
                            : viewers >= 1000 ? '#FF6B35'
                            : '#FF6B35'
                            : '#141C2E';
                          const viewersBg = isLive
                            ? viewers >= 10000 ? 'rgba(16,185,129,0.12)'
                            : viewers >= 1000 ? 'rgba(255,107,53,0.12)'
                            : 'rgba(255,107,53,0.12)'
                            : 'rgba(75,85,99,0.08)';
                          return (
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold"
                              style={{
                                backgroundColor: viewersBg,
                                color: viewersColor,
                                border: `1px solid ${viewersColor}33`,
                                fontVariantNumeric: 'tabular-nums'
                              }}
                            >
                              <EyeIcon className="h-3.5 w-3.5" />
                              <span>{viewers.toLocaleString()}</span>
                            </span>
                          );
                        })()}
                      </td>
                      <td className="text-left text-gray-300 align-middle">
                        <span className="chip-glass inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-semibold text-[#FF6B35]">
                          <TrophyIcon className="h-3.5 w-3.5 opacity-90" />
                          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{row.peak.toLocaleString()}</span>
                        </span>
                      </td>
                      <td className="align-middle text-right pr-6 md:pr-8">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedStreamer(streamer);
                              setShowDetails(true);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg text-[11px] font-bold align-middle"
                            style={{ backgroundColor: '#FF6B35', color: '#141C2E', padding: '4px 12px', minHeight: '28px' }}
                          >
                            <span>View</span>
                          </button>
                          {(() => {
                            const bg = row.p === 'twitch' ? '#FF6B35' : row.p === 'youtube' ? '#FF6B35' : '#FF6B35';
                            const slug = row.n.replace(/\s+/g,'').toLowerCase();
                            const url = row.p === 'twitch'
                              ? `https://twitch.tv/${slug}`
                              : row.p === 'youtube'
                                ? `https://www.youtube.com/@${slug}`
                                : `https://kick.com/${slug}`;
                            const color = row.p === 'kick' ? '#141C2E' : '#ffffff';
                            return (
                              <a
                                href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg text-[11px] font-bold align-middle"
                              style={{ backgroundColor: bg, color, padding: '4px 12px', minHeight: '28px' }}
                            >
                              <PlatformIcon name={row.p as any} className="h-3 w-3" />
                              <span>Watch</span>
                            </a>
                          );
                        })()}
                        </div>
                      </td>
                    </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          {!isLoading && liveStreamers.length > 0 && (
            <div className="card-body border-t border-gray-200 dark:border-gray-800">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 px-2 sm:px-0">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center sm:text-left order-2 sm:order-1">
                  Page {pagination.page} of {pagination.totalPages} • {pagination.total.toLocaleString()} live streamers
                </p>
                <div className="flex items-center gap-1.5 sm:gap-2 order-1 sm:order-2">
                  <button
                    className="btn-outline text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2 dark:border-gray-700 dark:text-gray-300"
                    disabled={pagination.page <= 1}
                    onClick={() => handlePageChange(Math.max(page - 1, 1))}
                  >
                    <span className="hidden sm:inline">Previous</span>
                    <span className="sm:hidden">Prev</span>
                  </button>
                  {(() => {
                    const totalPages = pagination.totalPages || 1;
                    const current = pagination.page || 1;
                    const makeBtn = (n: number) => (
                      <button
                        key={n}
                        className={`text-xs sm:text-sm px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg border ${n === current ? 'bg-primary-600 text-white border-transparent font-semibold' : 'dark:border-gray-700 dark:text-gray-300 hover:bg-gray-800'}`}
                        onClick={() => handlePageChange(n)}
                      >
                        {n}
                      </button>
                    );
                    const items: (number | string)[] = [];
                    if (totalPages <= 10) {
                      for (let i = 1; i <= totalPages; i++) items.push(i);
                    } else {
                      items.push(1, 2);
                      if (current > 4) items.push('…');
                      const start = Math.max(3, current - 1);
                      const end = Math.min(totalPages - 2, current + 1);
                      for (let i = start; i <= end; i++) items.push(i);
                      if (current < totalPages - 3) items.push('…');
                      items.push(totalPages - 1, totalPages);
                    }
                    return (
                      <>
                        {items.map((it, idx) => (
                          typeof it === 'number' ? (
                            makeBtn(it)
                          ) : (
                            <span key={`gap-${idx}`} className="text-xs sm:text-sm text-gray-500">{it}</span>
                          )
                        ))}
                      </>
                    );
                  })()}
                  <button
                    className="btn-outline text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2 dark:border-gray-700 dark:text-gray-300"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => handlePageChange(Math.min(page + 1, pagination.totalPages))}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showDetails && selectedStreamer && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDetails(false)} />
          <div className="absolute inset-y-0 right-0 w-full sm:w-[580px] card overflow-y-auto" style={{ boxShadow: '-4px 0 24px rgba(0,0,0,0.5)' }}>
            {/* Header with Avatar */}
            <div className="sticky top-0 z-10 backdrop-blur-md border-b p-5 rounded-t-xl" style={{ background: '#FFFFFF', borderColor: 'rgba(20, 28, 46, 0.15)' }}>
              <div className="flex items-start gap-4">
                <div className="relative">
                  <img
                    src={getStreamerAvatar(selectedStreamer)}
                    alt={selectedStreamer.displayName}
                    className="w-16 h-16 rounded-full object-cover border-2 border-primary-500/30"
                    onError={handleImageError}
                  />
                  {selectedStreamer.platform && (
                    <span className={`absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full ${
                      String(selectedStreamer.platform).toLowerCase() === 'twitch' ? 'brand-twitch' :
                      String(selectedStreamer.platform).toLowerCase() === 'youtube' ? 'brand-youtube' :
                      'brand-kick'
                    } w-5 h-5`} style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
                      <PlatformIcon name={String(selectedStreamer.platform).toLowerCase() as any} className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-gray-100 mb-1">{selectedStreamer.displayName}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {flagFor(String(selectedStreamer.region || '').toLowerCase()) && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-800/60 text-gray-300 border border-gray-700">
                        <span className="text-sm">{flagFor(String(selectedStreamer.region).toLowerCase())}</span>
                        <span>{regionLabel(String(selectedStreamer.region))}</span>
                      </span>
                    )}
                    {selectedStreamer.language && (
                      <span className="inline-flex items-center px-2 py-1 rounded-lg bg-gray-800/60 text-gray-300 border border-gray-700 uppercase">
                        {selectedStreamer.language}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className="flex-shrink-0 p-2 rounded-lg hover:bg-gray-800/60 text-gray-400 hover:text-gray-200 transition-colors"
                  onClick={() => setShowDetails(false)}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-3 sm:p-5 space-y-4 sm:space-y-5">
              {/* Visit Channel Button */}
              {selectedStreamer.username && selectedStreamer.platform && (
                <a
                  href={(() => {
                    const cleanUsername = String(selectedStreamer.username).startsWith('@') ? String(selectedStreamer.username).slice(1) : String(selectedStreamer.username);
                    const platform = String(selectedStreamer.platform).toLowerCase();
                    return platform === 'twitch' ? `https://twitch.tv/${cleanUsername}` :
                           platform === 'youtube' ? `https://www.youtube.com/@${cleanUsername}` :
                           platform === 'kick' ? `https://kick.com/${cleanUsername}` : '#';
                  })()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full"
                >
                  <button className="w-full py-3 sm:py-4 px-4 rounded-xl font-bold text-sm sm:text-base text-black transition-all duration-200 hover:shadow-lg hover:shadow-primary-500/30 hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: 'linear-gradient(135deg, #FF6B35 0%, #FF6B35 100%)' }}>
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      <span>Visit Channel</span>
                    </div>
                  </button>
                </a>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="p-3 sm:p-4 rounded-xl border" style={{ background: '#FFFFFF', borderColor: 'rgba(20, 28, 46, 0.1)' }}>
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                    <UsersIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-500" />
                    <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">Followers</p>
                  </div>
                  <p className="text-lg sm:text-2xl font-bold text-gray-100">{selectedStreamer.followers?.toLocaleString?.() || '-'}</p>
                </div>
                <div className="p-3 sm:p-4 rounded-xl border" style={{ background: '#FFFFFF', borderColor: 'rgba(20, 28, 46, 0.1)' }}>
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                    <TrophyIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#FF6B35]" />
                    <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">Peak Viewers</p>
                  </div>
                  <p className="text-lg sm:text-2xl font-bold text-[#FF6B35]">{selectedStreamer.highestViewers?.toLocaleString?.() || '-'}</p>
                </div>
                <div className="p-3 sm:p-4 rounded-xl border" style={{ background: '#FFFFFF', borderColor: 'rgba(20, 28, 46, 0.1)' }}>
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                    <EyeIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-500" />
                    <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">Current Viewers</p>
                  </div>
                  <p className="text-lg sm:text-2xl font-bold text-gray-100">{selectedStreamer.currentViewers?.toLocaleString?.() || '-'}</p>
                </div>
                <div className="p-3 sm:p-4 rounded-xl border" style={{ background: '#FFFFFF', borderColor: 'rgba(20, 28, 46, 0.1)' }}>
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                    <ClockIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-500" />
                    <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">Last Streamed</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedStreamer.isLive ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] sm:text-[10px] font-black bg-[#FF6B35] border border-[#FF6B35] animate-pulse" style={{ animationDuration: '2s' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        LIVE NOW
                      </span>
                    ) : (
                      <p className="text-xs sm:text-sm font-semibold text-gray-300">
                        {selectedStreamer.lastStreamed ? new Date(selectedStreamer.lastStreamed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Tags */}
              {selectedStreamer.tags && selectedStreamer.tags.length > 0 && (
                <div className="p-3 sm:p-4 rounded-xl border" style={{ background: '#FFFFFF', borderColor: 'rgba(20, 28, 46, 0.1)' }}>
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <HashtagIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-500" />
                    <p className="text-xs sm:text-sm text-gray-400 uppercase tracking-wide font-semibold">Tags</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {selectedStreamer.tags.map((tag: string, idx: number) => (
                      <span key={idx} className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-primary-600/20 text-primary-300 border border-primary-600/30 text-xs sm:text-sm font-semibold">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Stream History */}
              {selectedStreamer.streamTitles && selectedStreamer.streamTitles.length > 0 && (
                <div className="p-3 sm:p-4 rounded-xl border" style={{ background: '#FFFFFF', borderColor: 'rgba(20, 28, 46, 0.1)' }}>
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <p className="text-xs sm:text-sm text-gray-400 uppercase tracking-wide font-semibold">Stream History</p>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(20, 28, 46, 0.2) transparent' }}>
                    {selectedStreamer.streamTitles.map((stream: { title: string; date: string }, idx: number) => (
                      <div key={idx} className="p-2 sm:p-2.5 rounded-lg bg-gray-900/60 border border-gray-700/50 hover:border-gray-600/50 transition-colors">
                        <p className="text-xs sm:text-sm text-gray-200 mb-1 line-clamp-2">{stream.title}</p>
                        <p className="text-[10px] sm:text-xs text-gray-500">
                          {formatDistanceToNow(new Date(stream.date), { addSuffix: true })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes Section */}
              <div className="p-3 sm:p-4 rounded-xl border" style={{ background: '#FFFFFF', borderColor: 'rgba(20, 28, 46, 0.1)' }}>
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <p className="text-xs sm:text-sm text-gray-400 uppercase tracking-wide">Notes</p>
                </div>
                <textarea
                  className="w-full bg-gray-900/60 border border-gray-700 rounded-lg p-2.5 sm:p-3 text-xs sm:text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-primary-600 focus:ring-1 focus:ring-primary-600"
                  rows={4}
                  placeholder="Add notes about this streamer..."
                  defaultValue={selectedStreamer.notes || ''}
                />
              </div>

              {/* Assignments Section */}
              <div className="p-3 sm:p-4 rounded-xl border" style={{ background: '#FFFFFF', borderColor: 'rgba(20, 28, 46, 0.1)' }}>
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="flex items-center gap-2">
                    <ChartBarIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-500" />
                    <p className="text-xs sm:text-sm text-gray-400 uppercase tracking-wide">Campaign Assignments</p>
                  </div>
                  <button className="px-2.5 sm:px-3 py-1 rounded-lg bg-primary-600 text-black text-[10px] sm:text-xs font-bold hover:bg-primary-500 transition-colors">
                    + Assign
                  </button>
                </div>
                <div className="text-xs sm:text-sm text-gray-400 text-center py-3 sm:py-4">
                  No campaign assignments yet
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
