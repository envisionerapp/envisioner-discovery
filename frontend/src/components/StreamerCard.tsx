import React from 'react';
import { Streamer } from '../services/chatService';
import { PlatformIcon } from './icons/PlatformIcon';
import { flagFor, regionLabel } from '../utils/geo';
import { getStreamerAvatar, DEFAULT_AVATAR } from '../utils/avatars';

// Handle image load errors by falling back to placeholder
const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  if (img.src !== DEFAULT_AVATAR) {
    img.src = DEFAULT_AVATAR;
  }
};

// Handle panel image errors by hiding the broken image
const handlePanelImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  const container = img.parentElement;
  if (container) {
    container.style.display = 'none';
  }
};
import { formatDistanceToNow } from 'date-fns';
import { useLanguage } from '../contexts/LanguageContext';

// Category color mapping
const getCategoryColor = (category: string): string => {
  const colors: Record<string, string> = {
    'Gaming': 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
    'iGaming': 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    'IRL': 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
    'Music': 'bg-pink-500/20 text-pink-300 border border-pink-500/30',
    'Art': 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
    'Tech': 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
    'Sports': 'bg-green-500/20 text-green-300 border border-green-500/30',
    'Education': 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
    'Entertainment': 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
    'Other': 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
  };
  return colors[category] || colors['Other'];
};

interface StreamerCardProps {
  streamer: Streamer;
  index: number;
}

export const StreamerCard: React.FC<StreamerCardProps> = ({ streamer, index }) => {
  const { t } = useLanguage();
  const isWindows = typeof navigator !== 'undefined' && navigator.userAgent.includes('Win');

  const getStatusColor = () => {
    if (streamer.isLive) return 'text-[#FF6B35]';
    return 'text-gray-400';
  };

  const getStatusText = () => {
    if (streamer.isLive) {
      return streamer.currentViewers
        ? `🔴 ${t('streamers.card.live')} • ${streamer.currentViewers.toLocaleString()} ${t('streamers.card.viewers')}`
        : `🔴 ${t('streamers.card.live')}`;
    }
    return `⚫ ${t('streamers.card.offline').toUpperCase()}`;
  };

  const getPlatformColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'twitch': return 'bg-[#FF6B35]';
      case 'youtube': return 'bg-[#FF6B35]';
      case 'kick': return 'bg-[#FF6B35]';
      case 'facebook': return 'bg-[#FF6B35]';
      case 'tiktok': return 'bg-black';
      default: return 'bg-gray-600';
    }
  };

  return (
    <div className="card hover:bg-white/5 transition-colors">
      <div className="card-body p-4">
        {/* Header with avatar and basic info */}
        <div className="flex items-start gap-4 mb-3">
          <div className="relative">
            <div className="avatar avatar-md">
              <img
                className="w-full h-full rounded-full object-cover"
                src={getStreamerAvatar(streamer)}
                alt={streamer.displayName}
                loading="lazy"
                decoding="async"
                onError={handleImageError}
              />
              <span className={`platform-badge ${getPlatformColor(streamer.platform)}`}>
                <PlatformIcon name={streamer.platform.toLowerCase() as any} className="h-3 w-3" />
              </span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold text-gray-100 truncate">
                  {streamer.displayName}
                </h3>
                <p className="text-sm text-gray-400 truncate">
                  @{streamer.username}
                </p>
              </div>
              <div className="ml-2 flex-shrink-0 flex items-center gap-1.5">
                {/* Category badge */}
                {(streamer.inferredCategory || streamer.primaryCategory) && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${getCategoryColor(streamer.inferredCategory || streamer.primaryCategory || '')}`}>
                    {streamer.inferredCategory || streamer.primaryCategory}
                  </span>
                )}
                {/* Region/Country badge */}
                {flagFor(streamer.region?.toLowerCase() || '') && (
                  <span className="region-chip">
                    <span className="text-sm">{flagFor(streamer.region.toLowerCase())}</span>
                    <span>{regionLabel(streamer.region.toLowerCase())}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Live status and current game */}
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className={getStatusColor()}>
                {getStatusText()}
              </span>
              {streamer.currentGame && (
                <>
                  <span className="text-gray-500">•</span>
                  <span className="text-gray-300">{streamer.currentGame}</span>
                </>
              )}
            </div>

            {/* Most recent stream title */}
            {streamer.streamTitles && streamer.streamTitles.length > 0 && (
              <div className="mt-2 p-2 rounded-lg bg-gray-800/40 border border-gray-700/50">
                <div className="flex items-start gap-1.5">
                  <svg className="h-3.5 w-3.5 text-primary-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-300 line-clamp-1" title={streamer.streamTitles[0].title}>
                      {streamer.streamTitles[0].title}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      {formatDistanceToNow(new Date(streamer.streamTitles[0].date), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div className="stat-card">
            <div className="text-2xl font-bold text-gray-100">
              {streamer.followers.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400">{t('streamers.stats.followers')}</div>
          </div>
          {streamer.currentViewers !== undefined && streamer.isLive && (
            <div className="stat-card">
              <div className="text-2xl font-bold text-[#FF6B35]">
                {streamer.currentViewers.toLocaleString()}
              </div>
              <div className="text-xs text-gray-400">{t('streamers.stats.liveViewers')}</div>
            </div>
          )}
        </div>

        {/* Bio / Description */}
        {streamer.profileDescription && (
          <div className="mb-3 p-2 rounded-lg bg-gray-800/40 border border-gray-700/50">
            <p className="text-xs text-gray-300 line-clamp-2">
              {streamer.profileDescription}
            </p>
          </div>
        )}

        {/* Panel Images */}
        {streamer.panelImages && Array.isArray(streamer.panelImages) && streamer.panelImages.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {t('streamers.card.panelImages')}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {streamer.panelImages.slice(0, 4).map((panel, idx) => (
                <div key={idx} className="relative group">
                  <img
                    src={panel.url}
                    alt={panel.alt || `Panel ${idx + 1}`}
                    className="w-full h-20 object-cover rounded-lg border border-gray-700/50 group-hover:border-primary-500/50 transition-colors"
                    loading="lazy"
                    onError={handlePanelImageError}
                  />
                </div>
              ))}
            </div>
            {streamer.panelImages.length > 4 && (
              <p className="text-[10px] text-gray-500 mt-1">
                +{streamer.panelImages.length - 4} {t('streamers.card.moreImages')}
              </p>
            )}
          </div>
        )}

        {/* Email Contact */}
        {(streamer.email || streamer.businessEmail) && (
          <div className="mb-3">
            {isWindows ? (
              <button
                onClick={() => {
                  const email = streamer.businessEmail || streamer.email || '';
                  // Use prompt as reliable iframe fallback - text is pre-selected for Ctrl+C
                  window.prompt('Copy email (Ctrl+C):', email);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-[#EA4335] text-white hover:bg-[#D33426] transition-colors cursor-pointer"
                title={`Click to copy email (source: ${streamer.emailSource || 'profile'})`}
              >
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
                <span>{streamer.businessEmail || streamer.email}</span>
              </button>
            ) : (
              <a
                href={`mailto:${streamer.businessEmail || streamer.email}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-[#EA4335] text-white hover:bg-[#D33426] transition-colors"
                title={`Contact via email (source: ${streamer.emailSource || 'profile'})`}
              >
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
                <span>{streamer.businessEmail || streamer.email}</span>
              </a>
            )}
          </div>
        )}

        {/* Social Links */}
        {streamer.externalLinks && Object.keys(streamer.externalLinks).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {streamer.externalLinks.instagram && (
              <a
                href={streamer.externalLinks.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-gradient-to-br from-[#FF6B35] to-[#FF6B35] text-white hover:opacity-80 transition-opacity"
                title="Instagram"
              >
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                <span>IG</span>
              </a>
            )}
            {streamer.externalLinks.twitter && (
              <a
                href={streamer.externalLinks.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-black text-white hover:opacity-80 transition-opacity"
                title="Twitter/X"
              >
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                <span>X</span>
              </a>
            )}
            {streamer.externalLinks.youtube && (
              <a
                href={streamer.externalLinks.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-[#FF6B35] text-white hover:opacity-80 transition-opacity"
                title="YouTube"
              >
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                <span>YT</span>
              </a>
            )}
            {streamer.externalLinks.tiktok && (
              <a
                href={streamer.externalLinks.tiktok}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-black text-white hover:opacity-80 transition-opacity"
                title="TikTok"
              >
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                </svg>
                <span>TT</span>
              </a>
            )}
            {streamer.externalLinks.discord && (
              <a
                href={`https://discord.gg/${streamer.externalLinks.discord}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-[#FF6B35] text-white hover:opacity-80 transition-opacity"
                title="Discord"
              >
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                <span>DC</span>
              </a>
            )}
            {streamer.externalLinks.facebook && (
              <a
                href={streamer.externalLinks.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-[#FF6B35] text-white hover:opacity-80 transition-opacity"
                title="Facebook"
              >
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                <span>FB</span>
              </a>
            )}
          </div>
        )}

        {/* Tags */}
        {streamer.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {streamer.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-white/10 text-gray-300">
                {tag.toLowerCase()}
              </span>
            ))}
            {streamer.tags.length > 3 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-white/10 text-gray-400">
                +{streamer.tags.length - 3} {t('streamers.card.moreTags')}
              </span>
            )}
          </div>
        )}

        {/* Platform and language */}
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <span className="capitalize">{streamer.platform.toLowerCase()}</span>
            <span>•</span>
            <span>{streamer.language.toUpperCase()}</span>
          </div>
          {streamer.fraudCheck === 'CLEAN' ? (
            <span className="text-[#141C2E]">✓ {t('streamers.card.verified')}</span>
          ) : (
            <span className="text-[#FF6B35]">⚠ {t('streamers.card.review')}</span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-3 pt-3 border-t border-white/10">
          <button
            className="btn-outline flex-1 text-xs"
            onClick={() => window.open(streamer.profileUrl, '_blank')}
          >
            {t('streamers.card.viewProfile')}
          </button>
          <button className="btn-primary text-xs px-3">
            {t('streamers.card.addToCampaign')}
          </button>
        </div>
      </div>
    </div>
  );
};

// Compact table row for Excel-like view
interface StreamerTableRowProps {
  streamer: Streamer;
  index: number;
}

const StreamerTableRow: React.FC<StreamerTableRowProps> = ({ streamer, index }) => {
  const { t } = useLanguage();

  return (
    <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
      {/* Avatar & Name */}
      <td className="py-3 px-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <img
              className="w-8 h-8 rounded-full object-cover"
              src={getStreamerAvatar(streamer)}
              alt={streamer.displayName}
              loading="lazy"
              onError={handleImageError}
            />
            <span className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center ${
              streamer.platform.toLowerCase() === 'twitch' ? 'bg-[#9146FF]' :
              streamer.platform.toLowerCase() === 'youtube' ? 'bg-[#FF0000]' :
              streamer.platform.toLowerCase() === 'kick' ? 'bg-[#53FC18]' :
              'bg-gray-600'
            }`}>
              <PlatformIcon name={streamer.platform.toLowerCase() as any} className="h-2.5 w-2.5 text-white" />
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-100 truncate">{streamer.displayName}</p>
            <p className="text-xs text-gray-500 truncate">@{streamer.username}</p>
          </div>
        </div>
      </td>

      {/* Platform */}
      <td className="py-3 px-3">
        <span className="text-xs text-gray-300 capitalize">{streamer.platform.toLowerCase()}</span>
      </td>

      {/* Region */}
      <td className="py-3 px-3">
        {flagFor(streamer.region?.toLowerCase() || '') && (
          <span className="text-sm">
            {flagFor(streamer.region.toLowerCase())} {regionLabel(streamer.region.toLowerCase())}
          </span>
        )}
      </td>

      {/* Status */}
      <td className="py-3 px-3">
        {streamer.isLive ? (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-[#FF6B35]/20 text-[#FF6B35] border border-[#FF6B35]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B35] animate-pulse"></span>
            LIVE
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-gray-500/20 text-gray-400 border border-gray-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
            Offline
          </span>
        )}
      </td>

      {/* Followers */}
      <td className="py-3 px-3 text-right">
        <span className="text-sm text-gray-100">{streamer.followers.toLocaleString()}</span>
      </td>

      {/* Viewers */}
      <td className="py-3 px-3 text-right">
        {streamer.isLive && streamer.currentViewers !== undefined ? (
          <span className="text-sm text-[#FF6B35] font-medium">{streamer.currentViewers.toLocaleString()}</span>
        ) : (
          <span className="text-sm text-gray-500">-</span>
        )}
      </td>

      {/* Game/Category */}
      <td className="py-3 px-3">
        <div className="flex flex-col gap-1">
          {(streamer.inferredCategory || streamer.primaryCategory) && (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium w-fit ${getCategoryColor(streamer.inferredCategory || streamer.primaryCategory || '')}`}>
              {streamer.inferredCategory || streamer.primaryCategory}
            </span>
          )}
          <span className="text-xs text-gray-400 truncate block max-w-[150px]">
            {streamer.currentGame && streamer.currentGame.toLowerCase() !== 'unknown' ? streamer.currentGame : ''}
          </span>
        </div>
      </td>

      {/* Tags */}
      <td className="py-3 px-3">
        <div className="flex flex-wrap gap-1">
          {streamer.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-white/10 text-gray-400">
              {tag.toLowerCase()}
            </span>
          ))}
          {streamer.tags.length > 2 && (
            <span className="text-[10px] text-gray-500">+{streamer.tags.length - 2}</span>
          )}
        </div>
      </td>

      {/* Actions */}
      <td className="py-3 px-3">
        <div className="flex items-center gap-1">
          <button
            className="p-1.5 rounded hover:bg-white/10 transition-colors text-gray-400 hover:text-gray-200"
            onClick={() => window.open(streamer.profileUrl, '_blank')}
            title={t('streamers.card.viewProfile')}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
          <button
            className="p-1.5 rounded hover:bg-[#FF6B35]/20 transition-colors text-gray-400 hover:text-[#FF6B35]"
            title={t('streamers.card.addToCampaign')}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
};

// Table view for streamers
interface StreamerTableProps {
  streamers: Streamer[];
}

const StreamerTable: React.FC<StreamerTableProps> = ({ streamers }) => {
  const { t } = useLanguage();

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px]">
        <thead>
          <tr className="border-b border-white/10 text-left">
            <th className="py-3 px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Streamer</th>
            <th className="py-3 px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Platform</th>
            <th className="py-3 px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Region</th>
            <th className="py-3 px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
            <th className="py-3 px-3 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">Followers</th>
            <th className="py-3 px-3 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">Viewers</th>
            <th className="py-3 px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Category</th>
            <th className="py-3 px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Tags</th>
            <th className="py-3 px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody>
          {streamers.map((streamer, index) => (
            <StreamerTableRow key={streamer.id} streamer={streamer} index={index} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

// View mode toggle icons
const GridIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

const TableIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

// Grid layout for multiple streamers
type ViewMode = 'cards' | 'table';

interface StreamerGridProps {
  streamers: Streamer[];
  title?: string;
  subtitle?: string;
  defaultView?: ViewMode;
}

export const StreamerGrid: React.FC<StreamerGridProps> = ({
  streamers,
  title = "Search Results",
  subtitle,
  defaultView = 'cards'
}) => {
  const { t } = useLanguage();
  const [viewMode, setViewMode] = React.useState<ViewMode>(defaultView);

  if (streamers.length === 0) {
    return (
      <div className="card">
        <div className="card-body text-center py-12">
          <div className="text-gray-400 mb-2">
            <svg className="mx-auto h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-300 mb-1">{t('streamers.noResults')}</h3>
          <p className="text-sm text-gray-500">{t('streamers.noResultsDesc')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h3 className="text-lg font-semibold text-gray-100">{title}</h3>
          {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex items-center rounded-lg bg-white/5 p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'cards'
                  ? 'bg-[#FF6B35] text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Card view"
            >
              <GridIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'table'
                  ? 'bg-[#FF6B35] text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Table view"
            >
              <TableIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="chip-glass px-3 py-1">
            <span className="text-sm text-gray-300">
              {streamers.length} {streamers.length !== 1 ? t('chat.results.streamers') : t('chat.results.streamers')}
            </span>
          </div>
        </div>
      </div>
      <div className="card-body">
        {viewMode === 'cards' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {streamers.map((streamer, index) => (
              <StreamerCard
                key={streamer.id}
                streamer={streamer}
                index={index}
              />
            ))}
          </div>
        ) : (
          <StreamerTable streamers={streamers} />
        )}
      </div>
    </div>
  );
};