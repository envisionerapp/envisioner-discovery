import React, { useMemo, useState, useEffect } from 'react';
import { differenceInMinutes, formatDistanceToNow } from 'date-fns';
import { useQuery, useQueryClient } from 'react-query';
import { ArrowDownTrayIcon, PlusIcon, HashtagIcon, UserIcon, MapPinIcon, UsersIcon, EyeIcon, ClockIcon, ChevronUpIcon, ChevronDownIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { PlatformIcon } from '@/components/icons/PlatformIcon';
import { getStreamerAvatar } from '@/utils/avatars';
import { flagFor, regionLabel } from '@/utils/geo';
import { RegionsOverview } from '@/components/RegionsOverview';
import { SearchInput } from '@/components/SearchInput';
import { streamerService } from '@/services/streamerService';
import { subscribeToLiveStatusUpdates } from '@/utils/socket';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLiveCount } from '@/contexts/LiveCountContext';

// Compact number formatter for followers/viewers (e.g., 12.3k, 1.2m)
const formatCount = (val: any): string => {
  const n = typeof val === 'number' ? val : parseFloat(val);
  if (!isFinite(n)) return '-';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
};
// Minimal LastLive color chip used in legend preview
const LastLiveChip: React.FC<{ minutes: number; isLive?: boolean; mode: 'simple' | 'extended' | 'contrast'; label?: string }> = ({ minutes, isLive, mode, label }) => {
  const baseClass = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px]';
  if (isLive) {
    return (
      <span className="inline-flex items-center px-3 py-0 rounded-full text-[9px] animate-pulse" style={{ background: '#dc2626', backdropFilter: 'blur(12px)', border: '1px solid #ff0000', color: '#ffffff', fontWeight: '900', animationDuration: '2s' }}>
        <span style={{ fontSize: '7.56px', letterSpacing: '1.5px', fontWeight: '900' }}>{(label || 'Live').toUpperCase()}</span>
      </span>
    );
  }
  type Pal = { bg: string; border: string; dot: string; text: string };
  const pickPaletteSimple = (m: number): Pal => {
    if (m < 60) return { bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.35)', dot: '#ef4444', text: '#fca5a5' };
    if (m < 1440) return { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.30)', dot: '#f59e0b', text: '#fde68a' };
    return { bg: 'rgba(156,163,175,0.12)', border: 'rgba(156,163,175,0.30)', dot: '#9ca3af', text: '#e5e7eb' };
  };
  const pickPaletteExtended = (m: number): Pal => {
    if (m < 15) return { bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.35)', dot: '#ef4444', text: '#fca5a5' };
    if (m < 60) return { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.30)', dot: '#22c55e', text: '#bbf7d0' };
    if (m < 360) return { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.30)', dot: '#f59e0b', text: '#fde68a' };
    if (m < 1440) return { bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.30)', dot: '#fb923c', text: '#fed7aa' };
    if (m < 4320) return { bg: 'rgba(253,198,0,0.12)', border: 'rgba(253,198,0,0.30)', dot: '#fdc600', text: '#fef3c7' };
    if (m < 10080) return { bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.30)', dot: '#a78bfa', text: '#ddd6fe' };
    return { bg: 'rgba(156,163,175,0.12)', border: 'rgba(156,163,175,0.30)', dot: '#9ca3af', text: '#e5e7eb' };
  };
  const pickPaletteContrast = (m: number): Pal => {
    if (m < 60) return { bg: 'rgba(239,68,68,0.25)', border: 'rgba(239,68,68,0.50)', dot: '#ef4444', text: '#fecaca' };
    if (m < 1440) return { bg: 'rgba(234,179,8,0.25)', border: 'rgba(234,179,8,0.50)', dot: '#eab308', text: '#171717' };
    if (m < 4320) return { bg: 'rgba(253,198,0,0.25)', border: 'rgba(253,198,0,0.50)', dot: '#fdc600', text: '#0f172a' };
    return { bg: 'rgba(75,85,99,0.30)', border: 'rgba(75,85,99,0.55)', dot: '#6b7280', text: '#e5e7eb' };
  };
  const palette = mode === 'simple' ? pickPaletteSimple(minutes) : mode === 'contrast' ? pickPaletteContrast(minutes) : pickPaletteExtended(minutes);
  return (
    <span className={baseClass} style={{ background: palette.bg, border: `0.5px solid ${palette.border}`, color: palette.text }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: palette.dot }} />
      <span>{label}</span>
    </span>
  );
};

const StreamersPage: React.FC = () => {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const [limit] = useState(15); // Ultra-fast: 15 items per page
  const [sort, setSort] = useState<string>('viewers');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<'' | 'twitch' | 'youtube' | 'kick'>('');
  const [regionFilter, setRegionFilter] = useState<string>('');
  const queryClient = useQueryClient();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const toggleSort = (key: string) => {
    const normalized = key.toLowerCase();
    setPage(1);
    if (sort.toLowerCase() === normalized) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(normalized);
      // For numeric columns, default to descending (highest first)
      const numericColumns = ['viewers', 'followers', 'peak'];
      setDir(numericColumns.includes(normalized) ? 'desc' : 'asc');
    }
  };
  const { data: listData, isLoading } = useQuery(
    ['streamers', { page, limit, sort, dir, search: debouncedSearch, platform: platformFilter, region: regionFilter }],
    () => {
      console.log('Fetching streamers with filters:', { page, limit, sort, dir, search: debouncedSearch, platform: platformFilter, region: regionFilter });
      return streamerService.getStreamers({ page, limit, sort, dir, search: debouncedSearch, platform: platformFilter || undefined, region: regionFilter || undefined });
    },
    {
      keepPreviousData: false,
      staleTime: 0,
      cacheTime: 30000
    }
  );

  // Subscribe to real-time live status updates
  useEffect(() => {
    const unsubscribe = subscribeToLiveStatusUpdates((data) => {
      console.log('🔴 Live status updated in Streamers page:', data);
      // Invalidate and refetch both streamers and stats when updates are received
      queryClient.invalidateQueries(['streamers']);
      queryClient.invalidateQueries(['region-stats']);
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient]);

  const items = listData?.items || [];
  const pagination = listData?.pagination || { page: 1, limit, total: 0, totalPages: 1 };

  // Refetch region stats whenever streamers data changes
  useEffect(() => {
    if (listData) {
      queryClient.invalidateQueries(['region-stats']);
    }
  }, [listData, queryClient]);

  const [showDetails, setShowDetails] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const pageLabel = useMemo(() => {
    return `Page ${pagination.page} of ${pagination.totalPages} • ${pagination.total.toLocaleString()} rows • ${pagination.limit} per page`;
  }, [pagination]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Streamers</h1>
        <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">Manage and explore your LATAM streamer database.</p>
      </div>

      <div className="mb-4">
        <RegionsOverview onRegionClick={(region) => {
          console.log('Region clicked:', region);
          setRegionFilter(region);
          setPage(1);
        }} />
        {regionFilter && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-gray-400">Filtering by: {regionLabel(regionFilter)}</span>
            <button
              className="text-xs text-primary-500 hover:text-primary-400"
              onClick={() => {
                setRegionFilter('');
                setPage(1);
              }}
            >
              Clear filter
            </button>
          </div>
        )}
      </div>

      {/* Toolbar moved into table header */}

      <StatsCards />

      <div className="card">
        <div className="card-header rounded-t-xl" style={{ paddingTop: '16px', paddingBottom: '16px', paddingLeft: '16px', paddingRight: '16px', background: 'linear-gradient(90deg, rgba(253, 198, 0, 0.10) 0%, rgba(0, 0, 0, 0) 100%)' }}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-end gap-3">
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 w-full md:w-auto">
              <div className="rounded-xl p-1.5" style={{ border: '0.5px solid rgba(255,255,255,0.12)', background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(10px)' }}>
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
                              style={{ backgroundColor: '#fdc600', color: '#000000' }}
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
                        if (opt.key === 'twitch') { bg = '#9146FF'; color = '#ffffff'; }
                        else if (opt.key === 'youtube') { bg = '#FF0000'; color = '#ffffff'; }
                        else if (opt.key === 'kick') { bg = '#52FF00'; color = '#000000'; }
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
                            <PlatformIcon name={opt.key as any} className="h-3.5 w-3.5" style={{ color: '#9ca3af' }} />
                          )}
                        </button>
                      );
                    })()
                  ))}
                </div>
              </div>
              <div className="w-full sm:w-64">
                <SearchInput
                  containerClassName="w-full"
                  placeholder="Search streamers"
                  className="text-sm placeholder:text-sm text-right placeholder:text-right"
                  value={search}
                  onChange={(e) => { setPage(1); setSearch(e.target.value); }}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="card-body">
          {/* Mobile list view */}
          <div className="md:hidden space-y-3" style={{ transition: 'opacity 0.2s ease-in-out', opacity: isLoading ? 0.5 : 1 }}>
            {isLoading ? (
              <div className="p-3 rounded-xl chip-glass text-center text-gray-400">
                Loading streamers...
              </div>
            ) : items.length === 0 ? (
              <div className="p-3 rounded-xl chip-glass text-center text-gray-400">
                No streamers available.
              </div>
            ) : (
              items.map((s, idx) => {
                const region = (s as any).region?.toLowerCase?.() || '';
                const platform = (s as any).platform?.toLowerCase?.();
                const isLive = !!(s as any).isLive;
                // YouTube has no scraper, so don't show viewer data
                const viewers = (platform === 'youtube' || !isLive) ? 0 : ((s as any).currentViewers ?? 0);
                // YouTube has no scraper, so don't show Last Live data
                const lastStreamed = platform === 'youtube' ? null : ((s as any).lastStreamed ? new Date((s as any).lastStreamed) : null);
                let minutes = 999999;
                const refDate = isLive ? null : lastStreamed;
                if (!isLive && refDate) {
                  try { minutes = differenceInMinutes(new Date(), refDate); } catch {}
                }
                const lastLiveLabel = isLive
                  ? 'Live'
                  : isFinite(minutes as any) && minutes < 60
                    ? `${minutes}m`
                    : isFinite(minutes as any) && minutes < 1440
                      ? `${Math.round(minutes / 60)}h`
                      : isFinite(minutes as any) && minutes < 525600
                        ? `${Math.round(minutes / 1440)}d`
                        : '–';

                const p = (s as any).profileUrl as string | undefined;
                const username = (s as any).username;
                let href = p || '';
                if (!href && platform && username) {
                  const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
                  href = platform === 'twitch' ? `https://twitch.tv/${cleanUsername}` : platform === 'youtube' ? `https://www.youtube.com/@${cleanUsername}` : platform === 'kick' ? `https://kick.com/${cleanUsername}` : '';
                }

                const resolveAvatar = (s: any, idx: number) => {
                  return getStreamerAvatar(s, idx);
                };

                return (
                  <div
                    key={(s as any).id || `${(s as any).platform}:${(s as any).username}:${idx}`}
                    className="w-full text-left p-4 rounded-xl chip-glass"
                  >
                    {/* Header: Avatar + Name + Region */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="relative h-12 w-12 flex-shrink-0">
                        <div className="rounded-full overflow-hidden w-full h-full relative" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
                          <img className="block w-full h-full object-cover" src={resolveAvatar(s, idx)} alt={(s as any).displayName} loading="lazy" style={{ filter: 'brightness(0.9)' }} />
                          <span className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.12)' }} />
                        </div>
                        {platform && (
                          <span className={`absolute flex items-center justify-center rounded-full brand-${platform}`} style={{ bottom: -2, right: -2, width: 20, height: 20, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 3 }} title={platform}>
                            <PlatformIcon name={platform as any} className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-gray-100 truncate" title={(s as any).displayName}>{(s as any).displayName}</div>
                        <div className="text-xs text-gray-400 truncate">@{(s as any).username}</div>
                      </div>
                      <div className="flex-shrink-0">
                        <span className="region-chip"><span className="text-sm" aria-hidden>{flagFor(region)}</span><span>{regionLabel(region)}</span></span>
                      </div>
                    </div>

                    {/* Visit Channel Button */}
                    {(s as any).username && platform && (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full mb-3"
                      >
                        <button className="w-full py-2.5 px-4 rounded-lg font-bold text-sm text-black transition-all duration-200 hover:shadow-lg hover:shadow-primary-500/30 hover:scale-[1.01] active:scale-[0.99]"
                          style={{ background: 'linear-gradient(135deg, #FDC600 0%, #FFD700 100%)' }}>
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
                          <UsersIcon className="h-3.5 w-3.5 text-primary-500" />
                          <span className="text-[11px] text-gray-400 uppercase font-medium tracking-wide">Followers</span>
                        </div>
                        <div className="text-sm font-bold text-gray-100" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCount((s as any).followers)}</div>
                      </div>
                      <div className="chip-glass px-2 py-1.5 rounded-lg text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <EyeIcon className="h-3.5 w-3.5 text-primary-500" />
                          <span className="text-[11px] text-gray-400 uppercase font-medium tracking-wide">Viewers</span>
                        </div>
                        <div className="text-sm font-bold text-gray-100" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatCount((s as any).currentViewers || 0)}
                        </div>
                      </div>
                      <div className="chip-glass px-2 py-1.5 rounded-lg text-center">
                        {!isLive ? (
                          <>
                            <div className="flex items-center justify-center gap-1 mb-1">
                              <ClockIcon className="h-3.5 w-3.5 text-gray-400" />
                              <span className="text-[11px] text-gray-400 uppercase font-medium tracking-wide">Last Live</span>
                            </div>
                            <div className="flex items-center justify-center">
                              <LastLiveChip minutes={minutes} isLive={isLive} mode="contrast" label={lastLiveLabel} />
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center justify-center h-full py-2">
                            <span className="inline-flex items-center px-4 py-1 rounded-full text-xs animate-pulse" style={{ background: '#dc2626', backdropFilter: 'blur(12px)', border: '1px solid #ff0000', color: '#ffffff', fontWeight: '900', animationDuration: '2s' }}>
                              <span style={{ fontSize: '9px', letterSpacing: '2px', fontWeight: '900' }}>LIVE</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setSelected(s); setShowDetails(true); }}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold"
                        style={{ backgroundColor: '#fdc600', color: '#000000', flex: '1 1 0', minHeight: '36px', padding: '8px 12px' }}
                      >
                        <span>View Details</span>
                      </button>
                      {href && (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold"
                          style={{ backgroundColor: platform === 'twitch' ? '#9146FF' : platform === 'youtube' ? '#FF0000' : platform === 'kick' ? '#52FF00' : 'rgba(255,255,255,0.08)', color: platform === 'kick' ? '#000000' : '#ffffff', flex: '1 1 0', minHeight: '36px', padding: '8px 12px' }}
                        >
                          {platform && <PlatformIcon name={platform as any} className="h-3 w-3" />}
                          <span>Visit</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block overflow-hidden" style={{ transition: 'opacity 0.2s ease-in-out', opacity: isLoading ? 0.5 : 1 }}>
            <StreamerTable
              items={items}
              isLoading={isLoading}
              page={pagination.page}
              pageSize={pagination.limit}
              activeSort={sort}
              activeDir={dir}
              onToggleSort={toggleSort}
              onRowClick={(s) => {
                setSelected(s);
                setShowDetails(true);
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-4 px-2 sm:px-0">
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center sm:text-left order-2 sm:order-1">{pageLabel}</p>
        <div className="flex items-center gap-1.5 sm:gap-2 order-1 sm:order-2">
          <button
            className="btn-outline text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2 dark:border-gray-700 dark:text-gray-300"
            disabled={pagination.page <= 1}
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
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
                onClick={() => setPage(n)}
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
            onClick={() => setPage((p) => Math.min(p + 1, pagination.totalPages))}
          >
            Next
          </button>
        </div>
      </div>

      {showDetails && selected && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDetails(false)} />
          <div className="absolute inset-y-0 right-0 w-full sm:w-[580px] card overflow-y-auto" style={{ boxShadow: '-4px 0 24px rgba(0,0,0,0.5)' }}>
            {/* Header with Avatar */}
            <div className="sticky top-0 z-10 backdrop-blur-md border-b p-5 rounded-t-xl" style={{ background: 'linear-gradient(135deg, rgba(253, 198, 0, 0.12) 0%, rgba(0, 0, 0, 0.6) 100%)', borderColor: 'rgba(253, 198, 0, 0.25)' }}>
              <div className="flex items-start gap-4">
                <div className="relative">
                  <img
                    src={getStreamerAvatar(selected, 0)}
                    alt={selected.displayName}
                    className="w-16 h-16 rounded-full object-cover border-2 border-primary-500/30"
                  />
                  {selected.platform && (
                    <span className={`absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full ${
                      String(selected.platform).toLowerCase() === 'twitch' ? 'brand-twitch' :
                      String(selected.platform).toLowerCase() === 'youtube' ? 'brand-youtube' :
                      'brand-kick'
                    } w-5 h-5`} style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
                      <PlatformIcon name={String(selected.platform).toLowerCase() as any} className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold text-gray-100 mb-1">{selected.displayName}</h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {selected.region && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-800/60 text-gray-300 border border-gray-700">
                        <span className="text-sm">{flagFor(String(selected.region).toLowerCase())}</span>
                        <span>{regionLabel(String(selected.region))}</span>
                      </span>
                    )}
                    {selected.language && (
                      <span className="inline-flex items-center px-2 py-1 rounded-lg bg-gray-800/60 text-gray-300 border border-gray-700 uppercase">
                        {selected.language}
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
              {selected.username && selected.platform && (
                <a
                  href={(() => {
                    const cleanUsername = String(selected.username).startsWith('@') ? String(selected.username).slice(1) : String(selected.username);
                    const platform = String(selected.platform).toLowerCase();
                    return platform === 'twitch' ? `https://twitch.tv/${cleanUsername}` :
                           platform === 'youtube' ? `https://www.youtube.com/@${cleanUsername}` :
                           platform === 'kick' ? `https://kick.com/${cleanUsername}` : '#';
                  })()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full"
                >
                  <button className="w-full py-3 sm:py-4 px-4 rounded-xl font-bold text-sm sm:text-base text-black transition-all duration-200 hover:shadow-lg hover:shadow-primary-500/30 hover:scale-[1.02] active:scale-[0.98]"
                    style={{ background: 'linear-gradient(135deg, #FDC600 0%, #FFD700 100%)' }}>
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
                <div className="p-3 sm:p-4 rounded-xl border" style={{ background: 'linear-gradient(135deg, rgba(253, 198, 0, 0.08) 0%, rgba(0, 0, 0, 0.3) 100%)', borderColor: 'rgba(253, 198, 0, 0.15)' }}>
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                    <UsersIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-500" />
                    <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">Followers</p>
                  </div>
                  <p className="text-lg sm:text-2xl font-bold text-gray-100">{selected.followers?.toLocaleString?.() || '-'}</p>
                </div>
                <div className="p-3 sm:p-4 rounded-xl border" style={{ background: 'linear-gradient(135deg, rgba(253, 198, 0, 0.08) 0%, rgba(0, 0, 0, 0.3) 100%)', borderColor: 'rgba(253, 198, 0, 0.15)' }}>
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                    <TrophyIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500" />
                    <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">Peak Viewers</p>
                  </div>
                  <p className="text-lg sm:text-2xl font-bold text-amber-400">{selected.highestViewers?.toLocaleString?.() || '-'}</p>
                </div>
                <div className="p-3 sm:p-4 rounded-xl border" style={{ background: 'linear-gradient(135deg, rgba(253, 198, 0, 0.08) 0%, rgba(0, 0, 0, 0.3) 100%)', borderColor: 'rgba(253, 198, 0, 0.15)' }}>
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                    <EyeIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-500" />
                    <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">Current Viewers</p>
                  </div>
                  <p className="text-lg sm:text-2xl font-bold text-gray-100">{selected.currentViewers?.toLocaleString?.() || '-'}</p>
                </div>
                <div className="p-3 sm:p-4 rounded-xl border" style={{ background: 'linear-gradient(135deg, rgba(253, 198, 0, 0.08) 0%, rgba(0, 0, 0, 0.3) 100%)', borderColor: 'rgba(253, 198, 0, 0.15)' }}>
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                    <ClockIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-500" />
                    <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wide">Last Streamed</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selected.isLive ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] sm:text-[10px] font-black bg-red-600 border border-red-400 animate-pulse" style={{ animationDuration: '2s' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        LIVE NOW
                      </span>
                    ) : (
                      <p className="text-xs sm:text-sm font-semibold text-gray-300">
                        {selected.lastStreamed ? new Date(selected.lastStreamed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Bio / Description */}
              {selected.profileDescription && (
                <div className="p-3 sm:p-4 rounded-xl border" style={{ background: 'linear-gradient(135deg, rgba(253, 198, 0, 0.08) 0%, rgba(0, 0, 0, 0.3) 100%)', borderColor: 'rgba(253, 198, 0, 0.15)' }}>
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <p className="text-xs sm:text-sm text-gray-400 uppercase tracking-wide">Bio</p>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-300 leading-relaxed">{selected.profileDescription}</p>
                </div>
              )}

              {/* Social Links */}
              {selected.externalLinks && Object.keys(selected.externalLinks).length > 0 && (
                <div className="p-3 sm:p-4 rounded-xl border" style={{ background: 'linear-gradient(135deg, rgba(253, 198, 0, 0.08) 0%, rgba(0, 0, 0, 0.3) 100%)', borderColor: 'rgba(253, 198, 0, 0.15)' }}>
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <p className="text-xs sm:text-sm text-gray-400 uppercase tracking-wide">Social Links</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selected.externalLinks.instagram && (
                      <a
                        href={selected.externalLinks.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold text-white hover:opacity-80 transition-opacity"
                        style={{ background: 'linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)' }}
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                        Instagram
                      </a>
                    )}
                    {selected.externalLinks.twitter && (
                      <a
                        href={selected.externalLinks.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-[#1DA1F2] text-white hover:opacity-80 transition-opacity"
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                        </svg>
                        Twitter
                      </a>
                    )}
                    {selected.externalLinks.youtube && (
                      <a
                        href={selected.externalLinks.youtube}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-[#FF0000] text-white hover:opacity-80 transition-opacity"
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                        YouTube
                      </a>
                    )}
                    {selected.externalLinks.tiktok && (
                      <a
                        href={selected.externalLinks.tiktok}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-black text-white hover:opacity-80 transition-opacity border border-gray-700"
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                        </svg>
                        TikTok
                      </a>
                    )}
                    {selected.externalLinks.discord && (
                      <a
                        href={selected.externalLinks.discord}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-[#5865F2] text-white hover:opacity-80 transition-opacity"
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                        </svg>
                        Discord
                      </a>
                    )}
                    {selected.externalLinks.facebook && (
                      <a
                        href={selected.externalLinks.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-[#1877F2] text-white hover:opacity-80 transition-opacity"
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                        Facebook
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Tags */}
              {selected.tags && selected.tags.length > 0 && (
                <div className="p-3 sm:p-4 rounded-xl border" style={{ background: 'linear-gradient(135deg, rgba(253, 198, 0, 0.08) 0%, rgba(0, 0, 0, 0.3) 100%)', borderColor: 'rgba(253, 198, 0, 0.15)' }}>
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <HashtagIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-500" />
                    <p className="text-xs sm:text-sm text-gray-400 uppercase tracking-wide">Tags</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {selected.tags.map((tag: string, idx: number) => (
                      <span key={idx} className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-primary-600/20 text-primary-300 border border-primary-600/30 text-xs sm:text-sm font-semibold">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Panel Images */}
              {selected.panelImages && selected.panelImages.length > 0 && (
                <div className="p-3 sm:p-4 rounded-xl border" style={{ background: 'linear-gradient(135deg, rgba(253, 198, 0, 0.08) 0%, rgba(0, 0, 0, 0.3) 100%)', borderColor: 'rgba(253, 198, 0, 0.15)' }}>
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-xs sm:text-sm text-gray-400 uppercase tracking-wide">Channel Panels</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {selected.panelImages.map((panel: { url: string; alt?: string; link?: string }, idx: number) => (
                      <div key={idx} className="group relative">
                        {panel.link ? (
                          <a href={panel.link} target="_blank" rel="noopener noreferrer" className="block">
                            <img
                              src={panel.url}
                              alt={panel.alt || `Panel ${idx + 1}`}
                              className="w-full rounded-lg border border-gray-700 hover:border-primary-600 transition-all duration-200 hover:scale-105 cursor-pointer"
                              loading="lazy"
                            />
                          </a>
                        ) : (
                          <img
                            src={panel.url}
                            alt={panel.alt || `Panel ${idx + 1}`}
                            className="w-full rounded-lg border border-gray-700"
                            loading="lazy"
                          />
                        )}
                        {panel.alt && (
                          <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg p-2 flex items-center justify-center">
                            <p className="text-[10px] text-gray-200 text-center line-clamp-3">{panel.alt}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stream History */}
              {selected.streamTitles && selected.streamTitles.length > 0 && (
                <div className="p-3 sm:p-4 rounded-xl border" style={{ background: 'linear-gradient(135deg, rgba(253, 198, 0, 0.08) 0%, rgba(0, 0, 0, 0.3) 100%)', borderColor: 'rgba(253, 198, 0, 0.15)' }}>
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <p className="text-xs sm:text-sm text-gray-400 uppercase tracking-wide">Stream History</p>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(253, 198, 0, 0.3) transparent' }}>
                    {selected.streamTitles.map((stream: { title: string; date: string }, idx: number) => (
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
              <div className="p-3 sm:p-4 rounded-xl border" style={{ background: 'linear-gradient(135deg, rgba(253, 198, 0, 0.08) 0%, rgba(0, 0, 0, 0.3) 100%)', borderColor: 'rgba(253, 198, 0, 0.15)' }}>
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
                  defaultValue={selected.notes || ''}
                />
              </div>

              {/* Assignments Section */}
              <div className="p-3 sm:p-4 rounded-xl border" style={{ background: 'linear-gradient(135deg, rgba(253, 198, 0, 0.08) 0%, rgba(0, 0, 0, 0.3) 100%)', borderColor: 'rgba(253, 198, 0, 0.15)' }}>
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <div className="flex items-center gap-2">
                    <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
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

export default StreamersPage;

const StatsCards: React.FC = () => {
  const { data } = useQuery(['streamer-stats'], () => streamerService.getRegionStats());
  const { liveCount } = useLiveCount();
  const total = data?.total ?? 0;
  const live = liveCount;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
      <div className="card p-4 sm:p-6 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(253, 198, 0, 0.12) 0%, rgba(202, 138, 4, 0.06) 100%)', border: '1px solid rgba(253, 198, 0, 0.25)' }}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary-600/10 rounded-full blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <UsersIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-500" />
            <p className="text-[10px] sm:text-xs font-semibold text-primary-200 uppercase tracking-wider">Total Streamers</p>
          </div>
          <div className="flex items-end justify-between">
            <span className="text-2xl sm:text-4xl font-black text-primary-500">
              {total.toLocaleString()}
            </span>
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-primary-600/20 backdrop-blur flex items-center justify-center border border-primary-500/30">
              <UsersIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary-500" />
            </div>
          </div>
        </div>
      </div>
      <div className="card p-4 sm:p-6 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.15) 0%, rgba(153, 27, 27, 0.08) 100%)', border: '1px solid rgba(220, 38, 38, 0.3)' }}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '3s' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-red-600 animate-pulse" style={{ animationDuration: '1.5s', boxShadow: '0 0 8px rgba(220, 38, 38, 0.8)' }} />
            <p className="text-[10px] sm:text-xs font-semibold text-red-200 uppercase tracking-wider">Live Now</p>
          </div>
          <div className="flex items-end justify-between">
            <span className="text-2xl sm:text-4xl font-black text-white animate-pulse" style={{ animationDuration: '2s', textShadow: '0 0 20px rgba(220, 38, 38, 0.5)' }}>
              {live.toLocaleString()}
            </span>
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-red-600/20 backdrop-blur flex items-center justify-center border border-red-500/30">
              <EyeIcon className="h-5 w-5 sm:h-6 sm:w-6 text-red-500 animate-pulse" style={{ animationDuration: '2.5s' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StreamerTable: React.FC<{
  items: any[];
  isLoading: boolean;
  page: number;
  pageSize: number;
  activeSort: string;
  activeDir: 'asc' | 'desc';
  onToggleSort: (key: string) => void;
  onRowClick: (s: any) => void;
}> = ({ items, isLoading, page, pageSize, activeSort, activeDir, onToggleSort, onRowClick }) => {
  const resolveAvatar = (s: any, idx: number) => {
    return getStreamerAvatar(s, idx);
  };
  return (
    <table className="table table-compact table-striped w-full" style={{ tableLayout: 'fixed' }}>
      <thead>
        <tr>
          <th style={{ width: '3%', paddingLeft: '8px', paddingRight: '4px' }} className="text-center"><span className="th text-primary-500">#</span></th>
          <th style={{ width: '20%' }}>
            <button type="button" className="th uppercase text-white" onClick={(e) => { e.preventDefault(); onToggleSort('displayname'); }}>
              <UserIcon className="text-primary-500" /><span>STREAMER</span> {activeSort.toLowerCase()==='displayname' && (activeDir==='asc' ? <ChevronUpIcon className="h-3.5 w-3.5 text-primary-500" /> : <ChevronDownIcon className="h-3.5 w-3.5 text-primary-500" />)}
            </button>
          </th>
          <th style={{ width: '10%' }}>
            <button type="button" className="th uppercase text-white" onClick={(e) => { e.preventDefault(); onToggleSort('region'); }}>
              <MapPinIcon className="text-primary-500" /><span>REGION</span> {activeSort.toLowerCase()==='region' && (activeDir==='asc' ? <ChevronUpIcon className="h-3.5 w-3.5 text-primary-500" /> : <ChevronDownIcon className="h-3.5 w-3.5 text-primary-500" />)}
            </button>
          </th>
          <th style={{ width: '11%' }}>
            <button type="button" className="th uppercase text-white" onClick={(e) => { e.preventDefault(); onToggleSort('followers'); }}>
              <UsersIcon className="text-primary-500" /><span className="hidden xl:inline">FOLLOWERS</span><span className="xl:hidden">FOLLOW</span> {activeSort.toLowerCase()==='followers' && (activeDir==='asc' ? <ChevronUpIcon className="h-3.5 w-3.5 text-primary-500" /> : <ChevronDownIcon className="h-3.5 w-3.5 text-primary-500" />)}
            </button>
          </th>
          <th style={{ width: '11%' }}>
            <button type="button" className="th uppercase whitespace-nowrap text-white" onClick={(e) => { e.preventDefault(); onToggleSort('laststreamed'); }}>
              <ClockIcon className="text-primary-500" /><span className="hidden xl:inline">LAST LIVE</span><span className="xl:hidden">LAST</span> {activeSort.toLowerCase()==='laststreamed' && (activeDir==='asc' ? <ChevronUpIcon className="h-3.5 w-3.5 text-primary-500" /> : <ChevronDownIcon className="h-3.5 w-3.5 text-primary-500" />)}
            </button>
          </th>
          <th style={{ width: '11%' }}>
            <button type="button" className="th uppercase text-white" onClick={(e) => { e.preventDefault(); onToggleSort('viewers'); }}>
              <EyeIcon className="text-primary-500" /><span className="hidden xl:inline">VIEWERS</span><span className="xl:hidden">VIEW</span> {activeSort.toLowerCase()==='viewers' && (activeDir==='asc' ? <ChevronUpIcon className="h-3.5 w-3.5 text-primary-500" /> : <ChevronDownIcon className="h-3.5 w-3.5 text-primary-500" />)}
            </button>
          </th>
          <th style={{ width: '10%' }}>
            <button type="button" className="th uppercase text-white" onClick={(e) => { e.preventDefault(); onToggleSort('peak'); }}>
              <TrophyIcon className="text-primary-500" /><span>PEAK</span> {activeSort.toLowerCase()==='peak' && (activeDir==='asc' ? <ChevronUpIcon className="h-3.5 w-3.5 text-primary-500" /> : <ChevronDownIcon className="h-3.5 w-3.5 text-primary-500" />)}
            </button>
          </th>
          <th style={{ width: '24%' }} className="pr-2 md:pr-4 text-right"></th>
        </tr>
      </thead>
      <tbody className="divide-y" style={{ borderColor: 'rgba(156, 163, 175, 0.3)' }}>
        {isLoading ? (
          <tr><td colSpan={8} className="text-center py-8 text-gray-400">Loading streamers...</td></tr>
        ) : items.length === 0 ? (
          <tr><td colSpan={8} className="text-center py-8 text-gray-400">No streamers available.</td></tr>
        ) : (
          items.map((s, idx) => {
            const region = (s as any).region?.toLowerCase?.() || '';
            const platform = (s as any).platform?.toLowerCase?.();
            const isLive = !!(s as any).isLive;
            // YouTube has no scraper, so don't show viewer data
            const viewers = (platform === 'youtube' || !isLive) ? 0 : ((s as any).currentViewers ?? 0);

            // Debug: Log first few live streamers
            if (idx < 3 && isLive) {
              console.log(`Streamer ${idx}:`, {
                name: (s as any).displayName,
                isLive,
                currentViewers: (s as any).currentViewers,
                viewers
              });
            }
            // YouTube has no scraper, so don't show Last Live data
            const lastStreamed = platform === 'youtube' ? null : ((s as any).lastStreamed ? new Date((s as any).lastStreamed) : null);
            // Minimal label: LIVE, Xm, Xh, Xd, or –
            let minutes = 999999;
            const refDate = lastStreamed;
            if (!isLive && refDate) {
              try { minutes = differenceInMinutes(new Date(), refDate); } catch {}
            }
            const lastLiveLabel = isLive
              ? 'LIVE'
              : isFinite(minutes as any) && minutes < 60
                ? `${minutes}m`
                : isFinite(minutes as any) && minutes < 1440
                  ? `${Math.round(minutes / 60)}h`
                  : isFinite(minutes as any) && minutes < 525600
                    ? `${Math.round(minutes / 1440)}d`
                    : '–';
            const lastLiveBadge = (() => {
              if (isLive) {
                return (
                  <span className="inline-flex items-center px-3 py-0 rounded-full text-[9px] animate-pulse" style={{ background: '#dc2626', backdropFilter: 'blur(12px)', border: '1px solid #ff0000', color: '#ffffff', fontWeight: '900', animationDuration: '2s' }}>
                    <span style={{ fontSize: '7.56px', letterSpacing: '1.5px', fontWeight: '900' }}>LIVE</span>
                  </span>
                );
              }
              // minutes already computed above
              type Pal = { bg: string; border: string; dot: string; text: string };
              const pickPaletteExtended = (m: number): Pal => {
                if (m < 15) return { bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.35)', dot: '#ef4444', text: '#fca5a5' };
                if (m < 60) return { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.30)', dot: '#22c55e', text: '#bbf7d0' };
                if (m < 360) return { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.30)', dot: '#f59e0b', text: '#fde68a' };
                if (m < 1440) return { bg: 'rgba(251,146,60,0.12)', border: 'rgba(251,146,60,0.30)', dot: '#fb923c', text: '#fed7aa' };
                if (m < 4320) return { bg: 'rgba(253,198,0,0.12)', border: 'rgba(253,198,0,0.30)', dot: '#fdc600', text: '#fef3c7' };
                if (m < 10080) return { bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.30)', dot: '#a78bfa', text: '#ddd6fe' };
                return { bg: 'rgba(156,163,175,0.12)', border: 'rgba(156,163,175,0.30)', dot: '#9ca3af', text: '#e5e7eb' };
              };
              const palette = pickPaletteExtended(minutes);
              const title = refDate ? `Last live: ${refDate.toLocaleString()}` : 'Last live: unknown';
              return (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px]" style={{ background: palette.bg, border: `0.5px solid ${palette.border}`, color: palette.text }} title={title}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: palette.dot }} />
                  <span>{lastLiveLabel}</span>
                </span>
              );
            })();
            return (
              <tr key={s.id}>
                <td className="align-middle text-center" style={{ paddingLeft: '8px', paddingRight: '4px' }}>
                  <div className="flex-shrink-0 w-5 h-5 rounded-md bg-gradient-to-br from-primary-600/20 to-primary-600/5 border border-primary-600/30 flex items-center justify-center mx-auto">
                    <span className="text-[9px] font-black text-primary-500">{(page - 1) * pageSize + idx + 1}</span>
                  </div>
                </td>
                <td className="align-middle">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="relative inline-flex items-center justify-center"
                      style={{ width: 40, height: 40, minWidth: 40, minHeight: 40 }}
                    >
                      <div
                        className="rounded-full overflow-hidden w-full h-full relative"
                        style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
                      >
                        <img
                          className="block w-full h-full object-cover"
                        src={resolveAvatar(s, idx)}
                        alt={s.displayName}
                        loading="lazy"
                        style={{ filter: 'brightness(0.9)' }}
                      />
                        <span className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.12)' }} />
                      </div>
                      {platform && (
                        <span
                          className={`absolute flex items-center justify-center rounded-full brand-${platform}`}
                          style={{
                            bottom: -4,
                            right: -4,
                            width: 18,
                            height: 18,
                            backgroundColor: 'rgba(0,0,0,0.75)',
                            zIndex: 3,
                          }}
                          title={platform}
                        >
                          <PlatformIcon name={platform as any} className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-gray-100 truncate leading-none" title={s.displayName}>{s.displayName}</div>
                    </div>
                  </div>
                </td>
                <td className="align-middle">
                  <span className="region-chip truncate block max-w-full"><span className="text-sm" aria-hidden>{flagFor(region)}</span><span className="truncate">{regionLabel(region)}</span></span>
                </td>
                <td className="text-left text-gray-300 align-middle">
                  {(() => {
                    const followers = (s as any).followers || 0;
                    const followersColor = followers >= 1000000 ? '#8b5cf6'
                      : followers >= 100000 ? '#3b82f6'
                      : followers >= 10000 ? '#06b6d4'
                      : '#6b7280';
                    const followersBg = followers >= 1000000 ? 'rgba(139,92,246,0.12)'
                      : followers >= 100000 ? 'rgba(59,130,246,0.12)'
                      : followers >= 10000 ? 'rgba(6,182,212,0.12)'
                      : 'rgba(75,85,99,0.08)';
                    return (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold"
                        style={{
                          backgroundColor: followersBg,
                          color: followersColor,
                          border: `1px solid ${followersColor}33`,
                          fontVariantNumeric: 'tabular-nums'
                        }}
                      >
                        <UsersIcon className="h-3.5 w-3.5" />
                        <span>{formatCount(followers)}</span>
                      </span>
                    );
                  })()}
                </td>
                <td className="align-middle whitespace-nowrap">{lastLiveBadge}</td>
                <td className="text-left text-gray-300 align-middle">
                  {(() => {
                    // Get actual viewer count from database
                    const actualViewers = (s as any).currentViewers || 0;
                    const viewersColor = isLive
                      ? actualViewers >= 10000 ? '#10b981'
                      : actualViewers >= 1000 ? '#f59e0b'
                      : '#ef4444'
                      : '#6b7280';
                    const viewersBg = isLive
                      ? actualViewers >= 10000 ? 'rgba(16,185,129,0.12)'
                      : actualViewers >= 1000 ? 'rgba(245,158,11,0.12)'
                      : 'rgba(239,68,68,0.12)'
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
                        <span>{formatCount(actualViewers)}</span>
                      </span>
                    );
                  })()}
                </td>
                <td className="text-left text-gray-300 align-middle">
                  <span className="chip-glass inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-semibold text-amber-400">
                    <TrophyIcon className="h-3.5 w-3.5 opacity-90" />
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCount((s as any).highestViewers || 0)}</span>
                  </span>
                </td>
                <td className="align-middle text-right pr-2 md:pr-4">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => onRowClick(s)}
                      className="inline-flex items-center gap-1 rounded-lg text-[10px] font-bold align-middle"
                      style={{ backgroundColor: '#fdc600', color: '#000000', padding: '4px 8px', minHeight: '26px' }}
                    >
                      <span>View</span>
                    </button>
                    {(() => {
                      const p = (s as any).profileUrl as string | undefined;
                      const plat = (s as any).platform?.toLowerCase?.();
                      const username = (s as any).username;
                      let href = p || '';
                      if (!href && plat && username) {
                        const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
                        href = plat === 'twitch' ? `https://twitch.tv/${cleanUsername}` : plat === 'youtube' ? `https://www.youtube.com/@${cleanUsername}` : plat === 'kick' ? `https://kick.com/${cleanUsername}` : '';
                      }
                      return (
                        href ? (
                          (() => {
                            const bg = plat === 'twitch' ? '#9146FF' : plat === 'youtube' ? '#FF0000' : plat === 'kick' ? '#52FF00' : 'rgba(255,255,255,0.08)';
                            const color = plat === 'kick' ? '#000000' : '#ffffff';
                            return (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg text-[10px] font-bold align-middle"
                                style={{ backgroundColor: bg, color, padding: '4px 8px', minHeight: '26px' }}
                              >
                                {plat && <PlatformIcon name={plat as any} className="h-2.5 w-2.5" />}
                                <span>Visit</span>
                              </a>
                            );
                          })()
                        ) : null
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
  );
};
