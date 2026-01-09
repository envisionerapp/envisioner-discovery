import React, { useState, useMemo } from 'react';
import { differenceInMinutes } from 'date-fns';
import { Streamer } from '../services/chatService';
import { PlatformIcon } from './icons/PlatformIcon';
import { flagFor, regionLabel } from '../utils/geo';
import { getStreamerAvatar } from '../utils/avatars';
import { UsersIcon, EyeIcon, HashtagIcon, UserIcon, MapPinIcon, ClockIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, ChevronDownIcon, TrophyIcon } from '@heroicons/react/24/outline';

type SortField = 'displayName' | 'followers' | 'currentViewers' | 'peakViewers' | 'region' | 'lastLive';
type SortDirection = 'asc' | 'desc';

interface ChatStreamerTableProps {
  streamers: Streamer[];
  totalCount?: number;
  query?: string;
  onViewDetails?: (streamer: Streamer) => void;
  onPlatformFilter?: (platform: '' | 'twitch' | 'youtube' | 'kick') => void;
}

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
      <span className="inline-flex items-center px-3 py-0 rounded-full text-[9px] animate-pulse" style={{ background: '#FF6B35', backdropFilter: 'blur(12px)', border: '1px solid #FF6B35', color: '#ffffff', fontWeight: '900', animationDuration: '2s' }}>
        <span style={{ fontSize: '7.56px', letterSpacing: '1.5px', fontWeight: '900' }}>{(label || 'Live').toUpperCase()}</span>
      </span>
    );
  }
  type Pal = { bg: string; border: string; dot: string; text: string };
  const pickPaletteSimple = (m: number): Pal => {
    if (m < 60) return { bg: 'rgba(255,107,53,0.14)', border: 'rgba(255,107,53,0.35)', dot: '#FF6B35', text: '#FF6B35' };
    if (m < 1440) return { bg: 'rgba(255,107,53,0.12)', border: 'rgba(255,107,53,0.30)', dot: '#FF6B35', text: '#FF6B35' };
    return { bg: 'rgba(20,28,46,0.12)', border: 'rgba(20,28,46,0.30)', dot: '#141C2E', text: '#FFFFFF' };
  };
  const pickPaletteExtended = (m: number): Pal => {
    if (m < 15) return { bg: 'rgba(255,107,53,0.14)', border: 'rgba(255,107,53,0.35)', dot: '#FF6B35', text: '#FF6B35' };
    if (m < 60) return { bg: 'rgba(255,107,53,0.12)', border: 'rgba(255,107,53,0.30)', dot: '#FF6B35', text: '#FF6B35' };
    if (m < 360) return { bg: 'rgba(255,107,53,0.12)', border: 'rgba(255,107,53,0.30)', dot: '#FF6B35', text: '#FF6B35' };
    if (m < 1440) return { bg: 'rgba(255,107,53,0.12)', border: 'rgba(255,107,53,0.30)', dot: '#FF6B35', text: '#FF6B35' };
    if (m < 4320) return { bg: 'rgba(255,107,53,0.12)', border: 'rgba(255,107,53,0.30)', dot: '#FF6B35', text: '#FF6B35' };
    if (m < 10080) return { bg: 'rgba(255,107,53,0.12)', border: 'rgba(255,107,53,0.30)', dot: '#FF6B35', text: '#FF6B35' };
    return { bg: 'rgba(20,28,46,0.12)', border: 'rgba(20,28,46,0.30)', dot: '#141C2E', text: '#FFFFFF' };
  };
  const pickPaletteContrast = (m: number): Pal => {
    if (m < 60) return { bg: 'rgba(255,107,53,0.25)', border: 'rgba(255,107,53,0.50)', dot: '#FF6B35', text: '#FF6B35' };
    if (m < 1440) return { bg: 'rgba(255,107,53,0.25)', border: 'rgba(255,107,53,0.50)', dot: '#FF6B35', text: '#141C2E' };
    if (m < 4320) return { bg: 'rgba(255,107,53,0.25)', border: 'rgba(255,107,53,0.50)', dot: '#FF6B35', text: '#141C2E' };
    return { bg: 'rgba(75,85,99,0.30)', border: 'rgba(75,85,99,0.55)', dot: '#141C2E', text: '#FFFFFF' };
  };
  const palette = mode === 'simple' ? pickPaletteSimple(minutes) : mode === 'contrast' ? pickPaletteContrast(minutes) : pickPaletteExtended(minutes);
  return (
    <span className={baseClass} style={{ background: palette.bg, border: `0.5px solid ${palette.border}`, color: palette.text }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: palette.dot }} />
      <span>{label}</span>
    </span>
  );
};

export const ChatStreamerTable: React.FC<ChatStreamerTableProps> = ({ streamers, totalCount, query, onViewDetails, onPlatformFilter }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>('followers');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [platformFilter, setPlatformFilter] = useState<'' | 'twitch' | 'youtube' | 'kick'>('');
  const itemsPerPage = 20; // Show 20 streamers per page

  // Handle platform filter change
  const handlePlatformFilterChange = (platform: '' | 'twitch' | 'youtube' | 'kick') => {
    setPlatformFilter(platform);
    setCurrentPage(1);
    // Call the callback to trigger a new search with the platform filter
    if (onPlatformFilter) {
      onPlatformFilter(platform);
    }
  };

  // NO client-side filtering - server handles this
  const filteredStreamers = streamers;

  // Sort streamers
  const sortedStreamers = useMemo(() => {
    const sorted = [...filteredStreamers].sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortField) {
        case 'displayName':
          aValue = (a as any).displayName?.toLowerCase() || '';
          bValue = (b as any).displayName?.toLowerCase() || '';
          break;
        case 'followers':
          aValue = (a as any).followers || 0;
          bValue = (b as any).followers || 0;
          break;
        case 'currentViewers':
          aValue = (a as any).currentViewers || 0;
          bValue = (b as any).currentViewers || 0;
          break;
        case 'peakViewers':
          aValue = (a as any).highestViewers || 0;
          bValue = (b as any).highestViewers || 0;
          break;
        case 'region':
          aValue = (a as any).region || '';
          bValue = (b as any).region || '';
          break;
        case 'lastLive':
          const aLive = !!(a as any).isLive;
          const bLive = !!(b as any).isLive;
          if (aLive && !bLive) return -1;
          if (!aLive && bLive) return 1;

          const aTime = (a as any).lastStreamed || (a as any).updatedAt;
          const bTime = (b as any).lastStreamed || (b as any).updatedAt;
          aValue = aTime ? new Date(aTime).getTime() : 0;
          bValue = bTime ? new Date(bTime).getTime() : 0;
          break;
        default:
          return 0;
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return sorted;
  }, [filteredStreamers, sortField, sortDirection]);

  // Calculate pagination values
  const totalPages = Math.ceil(sortedStreamers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;

  // Get current page streamers
  const currentStreamers = useMemo(() => {
    return sortedStreamers.slice(startIndex, endIndex);
  }, [sortedStreamers, startIndex, endIndex]);

  // Reset to first page when streamers or sorting changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [streamers, sortField, sortDirection]);

  const hasStreamers = streamers && streamers.length > 0;

  const resolveAvatar = (s: any, idx: number) => {
    return getStreamerAvatar(s, idx);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of results when changing pages
    document.querySelector('.card')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronUpIcon className="h-3 w-3 opacity-50" />;
    }
    return sortDirection === 'asc' ? (
      <ChevronUpIcon className="h-3 w-3" />
    ) : (
      <ChevronDownIcon className="h-3 w-3" />
    );
  };

  return (
    <div className="card">
      <div className="card-header rounded-t-xl" style={{ paddingTop: '12px', paddingBottom: '12px', background: 'linear-gradient(90deg, rgba(253, 198, 0, 0.10) 0%, rgba(0, 0, 0, 0) 100%)' }}>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between w-full gap-3">
          <div className="text-center md:text-left">
            <h3 className="text-base md:text-lg font-semibold text-gray-100">Search Results</h3>
            <p className="text-xs md:text-sm text-gray-400 mt-1">
              Found {totalCount || streamers.length} streamer{(totalCount || streamers.length) !== 1 ? 's' : ''} matching your query
              {totalPages > 1 && (
                <span className="ml-2">
                  • Page {currentPage} of {totalPages}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center md:justify-end gap-3 w-full md:w-auto">
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
                            style={{ backgroundColor: '#FF6B35', color: '#141C2E' }}
                            title="All"
                            aria-label="All platforms"
                            onClick={() => handlePlatformFilterChange(opt.key as any)}
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
                          onClick={() => handlePlatformFilterChange(opt.key as any)}
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
                        onClick={() => handlePlatformFilterChange(opt.key as any)}
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
            <div className="chip-glass px-3 py-1.5">
              <span className="text-xs md:text-sm text-gray-300">
                {totalPages > 1 ? `${startIndex + 1}-${Math.min(endIndex, streamers.length)} of ${streamers.length}` : `${streamers.length} result${streamers.length !== 1 ? 's' : ''}`}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="card-body">
        {!hasStreamers ? (
          <div className="p-8 text-center">
            <div className="text-gray-400 mb-2">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg font-medium">
                No streamers found{query ? ` for "${query}"` : ''}
                {platformFilter && ` on ${platformFilter.charAt(0).toUpperCase() + platformFilter.slice(1)}`}
              </p>
              <p className="text-sm mt-2 text-gray-500">
                {platformFilter
                  ? 'Try selecting a different platform or adjusting your search'
                  : 'Try adjusting your search or filters'
                }
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Mobile list view */}
            <div className="md:hidden space-y-3">
              {currentStreamers.map((s, idx) => {
            const region = (s as any).region?.toLowerCase?.() || '';
            const platform = (s as any).platform?.toLowerCase?.();
            const peak = (s as any).highestViewers ?? (s as any).currentViewers ?? 0;
            const isLive = !!(s as any).isLive;
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

            return (
              <div
                key={(s as any).id || `${(s as any).platform}:${(s as any).username}:${idx}`}
                className="p-4 rounded-xl chip-glass hover:bg-white/10"
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
                      <TrophyIcon className="h-3.5 w-3.5 text-[#FF6B35]" />
                      <span className="text-[11px] text-gray-400 uppercase font-medium tracking-wide">Peak</span>
                    </div>
                    <div className="text-sm font-bold text-gray-100" style={{ fontVariantNumeric: 'tabular-nums' }}>{peak ? formatCount(peak) : '-'}</div>
                  </div>
                  <div className="chip-glass px-2 py-1.5 rounded-lg text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <ClockIcon className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-[11px] text-gray-400 uppercase font-medium tracking-wide">Last Live</span>
                    </div>
                    <div className="flex items-center justify-center">
                      <LastLiveChip minutes={minutes} isLive={isLive} mode="contrast" label={lastLiveLabel} />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onViewDetails?.(s)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold"
                    style={{ backgroundColor: '#FF6B35', color: '#141C2E', flex: '1 1 0', minHeight: '36px', padding: '8px 12px' }}
                  >
                    <span>View</span>
                  </button>
                  {href && (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold"
                      style={{ backgroundColor: platform === 'twitch' ? '#FF6B35' : platform === 'youtube' ? '#FF6B35' : platform === 'kick' ? '#FF6B35' : 'rgba(255,255,255,0.08)', color: platform === 'kick' ? '#141C2E' : '#ffffff', flex: '1 1 0', minHeight: '36px', padding: '8px 12px' }}
                    >
                      {platform && <PlatformIcon name={platform as any} className="h-3 w-3" />}
                      <span>Visit</span>
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop table view - no horizontal scroll */}
        <div className="hidden md:block w-full">
          <table className="table table-compact table-striped w-full" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '5%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="text-center" style={{ paddingLeft: '12px', paddingRight: '12px' }}><span className="th text-primary-500">#</span></th>
                <th>
                  <button
                    className="th uppercase text-white hover:bg-white/10 w-full text-left flex items-center gap-2"
                    onClick={() => handleSort('displayName')}
                  >
                    <UserIcon className="text-primary-500" />
                    <span>STREAMER</span>
                    {getSortIcon('displayName')}
                  </button>
                </th>
                <th>
                  <button
                    className="th uppercase text-white hover:bg-white/10 w-full text-left flex items-center gap-2"
                    onClick={() => handleSort('region')}
                  >
                    <MapPinIcon className="text-primary-500" />
                    <span>REGION</span>
                    {getSortIcon('region')}
                  </button>
                </th>
                <th>
                  <button
                    className="th uppercase text-white hover:bg-white/10 w-full text-left flex items-center gap-2"
                    onClick={() => handleSort('followers')}
                  >
                    <UsersIcon className="text-primary-500" />
                    <span>FOLLOWERS</span>
                    {getSortIcon('followers')}
                  </button>
                </th>
                <th>
                  <button
                    className="th uppercase whitespace-nowrap text-white hover:bg-white/10 w-full text-left flex items-center gap-2"
                    onClick={() => handleSort('lastLive')}
                  >
                    <ClockIcon className="text-primary-500" />
                    <span>LAST LIVE</span>
                    {getSortIcon('lastLive')}
                  </button>
                </th>
                <th>
                  <button
                    className="th uppercase text-white hover:bg-white/10 w-full text-left flex items-center gap-2"
                    onClick={() => handleSort('currentViewers')}
                  >
                    <EyeIcon className="text-primary-500" />
                    <span>VIEWERS</span>
                    {getSortIcon('currentViewers')}
                  </button>
                </th>
                <th>
                  <button
                    className="th uppercase text-white hover:bg-white/10 w-full text-left flex items-center gap-2"
                    onClick={() => handleSort('peakViewers')}
                  >
                    <TrophyIcon className="text-primary-500" />
                    <span>PEAK</span>
                    {getSortIcon('peakViewers')}
                  </button>
                </th>
                <th className="pr-4 md:pr-6 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'rgba(156, 163, 175, 0.3)' }}>
              {currentStreamers.map((s, idx) => {
                const region = (s as any).region?.toLowerCase?.() || '';
                const platform = (s as any).platform?.toLowerCase?.();
                const peak = (s as any).highestViewers ?? (s as any).currentViewers ?? 0;
                const isLive = !!(s as any).isLive;
                // YouTube has no scraper, so don't show Last Live data
                const lastStreamed = platform === 'youtube' ? null : ((s as any).lastStreamed ? new Date((s as any).lastStreamed) : null);
                let minutes = 999999;
                const refDate = lastStreamed;
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

                const lastLiveBadge = (() => {
                  const baseClass = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px]';
                  if (isLive) {
                    return (
                      <span className="inline-flex items-center px-3 py-0 rounded-full text-[9px] animate-pulse" style={{ background: '#FF6B35', backdropFilter: 'blur(12px)', border: '1px solid #FF6B35', color: '#ffffff', fontWeight: '900', animationDuration: '2s' }} title="Currently live">
                        <span style={{ fontSize: '7.56px', letterSpacing: '1.5px', fontWeight: '900' }}>LIVE</span>
                      </span>
                    );
                  }
                  type Pal = { bg: string; border: string; dot: string; text: string };
                  const pickPaletteExtended = (m: number): Pal => {
                    if (m < 15) return { bg: 'rgba(255,107,53,0.14)', border: 'rgba(255,107,53,0.35)', dot: '#FF6B35', text: '#FF6B35' };
                    if (m < 60) return { bg: 'rgba(255,107,53,0.12)', border: 'rgba(255,107,53,0.30)', dot: '#FF6B35', text: '#FF6B35' };
                    if (m < 360) return { bg: 'rgba(255,107,53,0.12)', border: 'rgba(255,107,53,0.30)', dot: '#FF6B35', text: '#FF6B35' };
                    if (m < 1440) return { bg: 'rgba(255,107,53,0.12)', border: 'rgba(255,107,53,0.30)', dot: '#FF6B35', text: '#FF6B35' };
                    if (m < 4320) return { bg: 'rgba(255,107,53,0.12)', border: 'rgba(255,107,53,0.30)', dot: '#FF6B35', text: '#FF6B35' };
                    if (m < 10080) return { bg: 'rgba(255,107,53,0.12)', border: 'rgba(255,107,53,0.30)', dot: '#FF6B35', text: '#FF6B35' };
                    return { bg: 'rgba(20,28,46,0.12)', border: 'rgba(20,28,46,0.30)', dot: '#141C2E', text: '#FFFFFF' };
                  };
                  const palette = pickPaletteExtended(minutes);
                  const title = refDate ? `Last live: ${refDate.toLocaleString()}` : 'Last live: unknown';
                  return (
                    <span className={`${baseClass}`} style={{ background: palette.bg, border: `0.5px solid ${palette.border}`, color: palette.text }} title={title}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: palette.dot }} />
                      <span>{lastLiveLabel}</span>
                    </span>
                  );
                })();

                return (
                  <tr key={(s as any).id} className="cursor-pointer hover:bg-gray-50/40 dark:hover:bg-gray-900/40">
                    <td className="align-middle text-center" style={{ paddingLeft: '12px', paddingRight: '12px' }}>
                      <div className="flex-shrink-0 w-6 h-6 rounded-md bg-gradient-to-br from-primary-600/20 to-primary-600/5 border border-primary-600/30 flex items-center justify-center mx-auto">
                        <span className="text-[10px] font-black text-primary-500">{startIndex + idx + 1}</span>
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
                              alt={(s as any).displayName}
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
                          <div className="text-sm text-gray-100 truncate leading-none" title={(s as any).displayName}>{(s as any).displayName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="align-middle">
                      <span className="region-chip"><span className="text-sm" aria-hidden>{flagFor(region)}</span><span>{regionLabel(region)}</span></span>
                    </td>
                    <td className="text-left text-gray-300 align-middle">
                      {(() => {
                        const followers = (s as any).followers || 0;
                        const followersColor = followers >= 1000000 ? '#FF6B35'
                          : followers >= 100000 ? '#FF6B35'
                          : followers >= 10000 ? '#FF6B35'
                          : '#141C2E';
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
                        const viewers = (s as any).currentViewers || 0;
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
                            <span>{formatCount(viewers)}</span>
                          </span>
                        );
                      })()}
                    </td>
                    <td className="text-left text-gray-300 align-middle">
                      <span className="chip-glass inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-semibold text-[#FF6B35]">
                        <TrophyIcon className="h-3.5 w-3.5 opacity-90" />
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{peak ? formatCount(peak) : '-'}</span>
                      </span>
                    </td>
                    <td className="align-middle text-right pr-4 md:pr-6">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onViewDetails?.(s)}
                          className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-lg text-[11px] font-bold align-middle"
                          style={{ backgroundColor: '#FF6B35', color: '#141C2E' }}
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
                                const bg = plat === 'twitch' ? '#FF6B35' : plat === 'youtube' ? '#FF6B35' : plat === 'kick' ? '#FF6B35' : 'rgba(255,255,255,0.08)';
                                const color = plat === 'kick' ? '#141C2E' : '#ffffff';
                                return (
                                  <a
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-lg text-[11px] font-bold align-middle"
                                    style={{ backgroundColor: bg, color }}
                                  >
                                    {plat && <PlatformIcon name={plat as any} className="h-3 w-3" />}
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
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-3 px-2 sm:px-0">
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center sm:text-left order-2 sm:order-1">
              Showing {startIndex + 1}-{Math.min(endIndex, streamers.length)} of {streamers.length} results
            </p>
            <div className="flex items-center gap-1.5 sm:gap-2 order-1 sm:order-2">
              <button
                className="btn-outline text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2 dark:border-gray-700 dark:text-gray-300"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <span className="hidden sm:inline">Previous</span>
                <span className="sm:hidden">Prev</span>
              </button>

              {(() => {
                const current = currentPage;
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
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
};
