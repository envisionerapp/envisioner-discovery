import React, { useState, useMemo, useEffect, useCallback } from 'react';
import './App.css';
import { fetchCreators, fetchFavoriteIds, toggleFavorite as apiToggleFavorite, fetchDiscardedIds, toggleDiscarded as apiToggleDiscarded, fetchNotesMap, saveNote as apiSaveNote, formatLastActive, ApiCreator, validateAccess, AccessValidationResult } from './api';
import { getStreamerAvatar, DEFAULT_AVATAR } from './utils/avatars';

// Handle image load errors by falling back to placeholder
const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  if (img.src !== DEFAULT_AVATAR) {
    img.src = DEFAULT_AVATAR;
  }
};

// ===========================================
// API HELPER FUNCTIONS
// ===========================================

// Get platform in lowercase for display/icons
const getPlatformKey = (platform: string): string => platform.toLowerCase();

// Format value or show "-" if not available
const formatOrDash = (value: number | null | undefined): string => {
  if (value === null || value === undefined || value === 0) return '-';
  return formatNumber(value);
};

// Get card metrics from API creator (flat structure)
// Shows available data, uses "-" for missing data
const getApiCardMetrics = (creator: ApiCreator): { label: string; value: string }[] => {
  const platform = creator.platform.toLowerCase();
  const lastActive = formatLastActive(creator.lastSeenLive, creator.isLive);
  const hasLastActive = creator.lastSeenLive || creator.isLive;

  // Twitch/Kick: Show followers, peak viewers, current game
  if (platform === 'twitch' || platform === 'kick') {
    return [
      { label: 'Followers', value: formatOrDash(creator.followers) },
      { label: 'Peak Viewers', value: formatOrDash(creator.highestViewers) },
      { label: 'Avg Viewers', value: creator.avgViewers > 0 ? formatNumber(creator.avgViewers) : formatOrDash(creator.currentViewers) },
      { label: 'Last Active', value: hasLastActive ? lastActive : '-' },
    ];
  }

  // YouTube: Show subscribers, peak viewers, category
  if (platform === 'youtube') {
    return [
      { label: 'Subscribers', value: formatOrDash(creator.followers) },
      { label: 'Peak Viewers', value: formatOrDash(creator.highestViewers) },
      { label: 'Views', value: creator.totalViews > 0 ? formatNumber(creator.totalViews) : '-' },
      { label: 'Last Active', value: hasLastActive ? lastActive : '-' },
    ];
  }

  // TikTok: followers, views, likes
  if (platform === 'tiktok') {
    return [
      { label: 'Followers', value: formatOrDash(creator.followers) },
      { label: 'Views', value: creator.totalViews > 0 ? formatNumber(creator.totalViews) : '-' },
      { label: 'Likes', value: creator.totalLikes > 0 ? formatNumber(creator.totalLikes) : '-' },
      { label: 'Last Active', value: hasLastActive ? lastActive : '-' },
    ];
  }

  // Instagram: followers, engagement (likes if available), category
  if (platform === 'instagram') {
    return [
      { label: 'Followers', value: formatOrDash(creator.followers) },
      { label: 'Likes', value: creator.totalLikes > 0 ? formatNumber(creator.totalLikes) : '-' },
      { label: 'Category', value: creator.primaryCategory || creator.inferredCategory || '-' },
      { label: 'Last Active', value: hasLastActive ? lastActive : '-' },
    ];
  }

  // Facebook, X, LinkedIn: followers, views, likes
  return [
    { label: 'Followers', value: formatOrDash(creator.followers) },
    { label: 'Views', value: creator.totalViews > 0 ? formatNumber(creator.totalViews) : '-' },
    { label: 'Likes', value: creator.totalLikes > 0 ? formatNumber(creator.totalLikes) : '-' },
    { label: 'Last Active', value: hasLastActive ? lastActive : '-' },
  ];
};

// Calculate engagement from API creator
const calculateApiEngagement = (creator: ApiCreator): number => {
  // Use stored engagement rate if available
  if (creator.engagementRate > 0) return creator.engagementRate;

  const platform = creator.platform.toLowerCase();

  if (platform === 'youtube' || platform === 'tiktok' || platform === 'instagram' || platform === 'facebook' || platform === 'x' || platform === 'linkedin') {
    const interactions = creator.totalLikes + creator.totalComments + (creator.totalShares || 0);
    return interactions > 0 && creator.totalViews > 0 ? creator.totalViews / interactions : 0;
  }

  // Streaming: use minutes watched / avg viewers
  if (creator.avgViewers > 0) {
    return creator.minutesWatched / creator.avgViewers;
  }

  return 0;
};

// Get all metrics for modal (full detail view) from API creator
const getAllApiMetrics = (creator: ApiCreator): { label: string; value: string }[] => {
  const platform = creator.platform.toLowerCase();
  const engagement = calculateApiEngagement(creator);
  const lastActive = formatLastActive(creator.lastSeenLive, creator.isLive);
  const hasLastActive = creator.lastSeenLive || creator.isLive;

  if (platform === 'twitch' || platform === 'kick') {
    return [
      { label: 'Peak Viewers', value: formatOrDash(creator.highestViewers) },
      { label: 'Avg Viewers', value: creator.avgViewers > 0 ? formatNumber(creator.avgViewers) : formatOrDash(creator.currentViewers) },
      { label: 'Watch Time', value: creator.minutesWatched > 0 ? formatMinutes(creator.minutesWatched) : '-' },
      { label: 'Last Active', value: hasLastActive ? lastActive : '-' },
    ];
  }

  if (platform === 'youtube') {
    return [
      { label: 'Peak Viewers', value: formatOrDash(creator.highestViewers) },
      { label: 'Views', value: creator.totalViews > 0 ? formatNumber(creator.totalViews) : '-' },
      { label: 'Likes', value: creator.totalLikes > 0 ? formatNumber(creator.totalLikes) : '-' },
    ];
  }

  if (platform === 'tiktok') {
    return [
      { label: 'Views', value: creator.totalViews > 0 ? formatNumber(creator.totalViews) : '-' },
      { label: 'Likes', value: creator.totalLikes > 0 ? formatNumber(creator.totalLikes) : '-' },
      { label: 'Comments', value: creator.totalComments > 0 ? formatNumber(creator.totalComments) : '-' },
    ];
  }

  // Instagram, Facebook, X, LinkedIn
  return [
    { label: 'Views', value: creator.totalViews > 0 ? formatNumber(creator.totalViews) : '-' },
    { label: 'Likes', value: creator.totalLikes > 0 ? formatNumber(creator.totalLikes) : '-' },
    { label: 'Comments', value: creator.totalComments > 0 ? formatNumber(creator.totalComments) : '-' },
  ];
};

// Generate a unique color based on string (for avatar placeholders)
const getAvatarColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Generate vibrant colors (avoid too dark/light)
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 65%, 45%)`;
};

// ===========================================
// PLATFORMS & METRICS CONFIGURATION
// ===========================================
const PLATFORMS = ['twitch', 'youtube', 'kick', 'facebook', 'tiktok', 'instagram', 'x', 'linkedin'] as const;
const REGIONS = ['USA', 'MEXICO', 'SPAIN', 'COLOMBIA', 'BRAZIL', 'ARGENTINA', 'CANADA', 'CHILE', 'PERU', 'SWEDEN', 'UK', 'GERMANY', 'FRANCE', 'PORTUGAL', 'ITALY'] as const;
const CATEGORIES = ['Gaming', 'iGaming', 'IRL'] as const;

type Platform = typeof PLATFORMS[number];
type Region = typeof REGIONS[number];
type Category = typeof CATEGORIES[number];

// Platform-specific metrics interfaces
interface YouTubeMetrics {
  views: number;
  likes: number;
  comments: number;
  avgViewers: number;
  minutesWatched: number;
  lastActive: string; // e.g., "2 days ago"
}

interface StreamingMetrics {
  avgViewers: number;
  minutesWatched: number;
  lastActive: string;
}

interface SocialMetrics {
  views: number;
  likes: number;
  comments: number;
  shares?: number; // TikTok only
  lastActive: string;
}

interface Creator {
  id: number;
  name: string;
  username: string;
  platform: Platform;
  region: Region;
  category: Category;
  followers: number;
  isLive: boolean;
  currentViewers: number;
  language: string;
  tags: string[];
  metrics: YouTubeMetrics | StreamingMetrics | SocialMetrics;
}

// Calculate engagement rate based on platform
const calculateEngagement = (creator: Creator): number => {
  const m = creator.metrics;

  if (creator.platform === 'youtube') {
    const yt = m as YouTubeMetrics;
    const interactions = yt.likes + yt.comments;
    return interactions > 0 ? yt.views / interactions : 0;
  }

  if (creator.platform === 'twitch' || creator.platform === 'kick') {
    // For streaming: use minutes watched / avg viewers as engagement proxy
    const st = m as StreamingMetrics;
    return st.avgViewers > 0 ? st.minutesWatched / st.avgViewers : 0;
  }

  if (creator.platform === 'tiktok') {
    const tt = m as SocialMetrics;
    const interactions = tt.likes + tt.comments + (tt.shares || 0);
    return interactions > 0 ? tt.views / interactions : 0;
  }

  // Facebook, Instagram, X, LinkedIn
  const social = m as SocialMetrics;
  const interactions = social.likes + social.comments;
  return interactions > 0 ? social.views / interactions : 0;
};

// Generate mock creators with platform-specific metrics
const MOCK_CREATORS: Creator[] = [
  // ===========================================
  // TWITCH - Metrics: avgViewers, minutesWatched, lastActive
  // ===========================================
  { id: 1, name: 'xQc', username: 'xqc', platform: 'twitch', region: 'Canada', category: 'Just Chatting', followers: 12400000, isLive: true, currentViewers: 52000, language: 'en', tags: ['variety', 'react'], metrics: { avgViewers: 45000, minutesWatched: 2840000, lastActive: 'Live now' } },
  { id: 2, name: 'Ibai', username: 'ibai', platform: 'twitch', region: 'Spain', category: 'Just Chatting', followers: 13800000, isLive: true, currentViewers: 61000, language: 'es', tags: ['esports', 'entertainment'], metrics: { avgViewers: 48000, minutesWatched: 1920000, lastActive: 'Live now' } },
  { id: 3, name: 'Auronplay', username: 'auronplay', platform: 'twitch', region: 'Spain', category: 'Gaming', followers: 14200000, isLive: false, currentViewers: 0, language: 'es', tags: ['minecraft', 'variety'], metrics: { avgViewers: 38000, minutesWatched: 1650000, lastActive: '3 days ago' } },
  { id: 10, name: 'Ninja', username: 'ninja', platform: 'twitch', region: 'USA', category: 'Gaming', followers: 18900000, isLive: false, currentViewers: 0, language: 'en', tags: ['fortnite', 'fps'], metrics: { avgViewers: 8000, minutesWatched: 4200000, lastActive: '1 week ago' } },
  { id: 11, name: 'Pokimane', username: 'pokimane', platform: 'twitch', region: 'USA', category: 'Just Chatting', followers: 9400000, isLive: true, currentViewers: 14000, language: 'en', tags: ['variety', 'react'], metrics: { avgViewers: 12000, minutesWatched: 3100000, lastActive: 'Live now' } },
  { id: 12, name: 'Shroud', username: 'shroud', platform: 'twitch', region: 'Canada', category: 'Gaming', followers: 10200000, isLive: true, currentViewers: 18000, language: 'en', tags: ['fps', 'valorant'], metrics: { avgViewers: 15000, minutesWatched: 5800000, lastActive: 'Live now' } },
  { id: 6, name: 'JuanSGuarnizo', username: 'juansguarnizo', platform: 'twitch', region: 'Colombia', category: 'Gaming', followers: 9100000, isLive: true, currentViewers: 25000, language: 'es', tags: ['gta', 'variety'], metrics: { avgViewers: 22000, minutesWatched: 2200000, lastActive: 'Live now' } },
  { id: 16, name: 'Amouranth', username: 'amouranth', platform: 'twitch', region: 'USA', category: 'Just Chatting', followers: 6400000, isLive: true, currentViewers: 9500, language: 'en', tags: ['irl', 'business'], metrics: { avgViewers: 8000, minutesWatched: 8760000, lastActive: 'Live now' } },
  { id: 17, name: 'Gaules', username: 'gaules', platform: 'twitch', region: 'Brazil', category: 'Gaming', followers: 4200000, isLive: true, currentViewers: 42000, language: 'pt', tags: ['csgo', 'esports'], metrics: { avgViewers: 35000, minutesWatched: 4100000, lastActive: 'Live now' } },
  { id: 18, name: 'Loud Coringa', username: 'loudcoringa', platform: 'twitch', region: 'Brazil', category: 'Gaming', followers: 3800000, isLive: false, currentViewers: 0, language: 'pt', tags: ['freefire', 'variety'], metrics: { avgViewers: 18000, minutesWatched: 1850000, lastActive: '2 days ago' } },

  // ===========================================
  // KICK - Metrics: avgViewers, minutesWatched, lastActive
  // ===========================================
  { id: 5, name: 'Adin Ross', username: 'adinross', platform: 'kick', region: 'USA', category: 'Just Chatting', followers: 8200000, isLive: true, currentViewers: 72000, language: 'en', tags: ['irl', 'gambling'], metrics: { avgViewers: 67000, minutesWatched: 1200000, lastActive: 'Live now' } },
  { id: 7, name: 'Roshtein', username: 'roshtein', platform: 'kick', region: 'Sweden', category: 'Slots', followers: 2100000, isLive: true, currentViewers: 31000, language: 'en', tags: ['casino', 'slots'], metrics: { avgViewers: 28000, minutesWatched: 3200000, lastActive: 'Live now' } },
  { id: 8, name: 'Trainwreckstv', username: 'trainwreckstv', platform: 'kick', region: 'USA', category: 'Slots', followers: 2800000, isLive: true, currentViewers: 42000, language: 'en', tags: ['gambling', 'slots'], metrics: { avgViewers: 35000, minutesWatched: 2800000, lastActive: 'Live now' } },
  { id: 25, name: 'xposed', username: 'xposed', platform: 'kick', region: 'Canada', category: 'Slots', followers: 1200000, isLive: false, currentViewers: 0, language: 'en', tags: ['gambling', 'casino'], metrics: { avgViewers: 12000, minutesWatched: 980000, lastActive: '1 day ago' } },

  // ===========================================
  // YOUTUBE - Metrics: views, likes, comments, avgViewers, minutesWatched, lastActive
  // ===========================================
  { id: 4, name: 'Rubius', username: 'rubius', platform: 'youtube', region: 'Spain', category: 'Entertainment', followers: 46000000, isLive: false, currentViewers: 0, language: 'es', tags: ['vlogs', 'gaming'], metrics: { views: 10200000000, likes: 890000000, comments: 45000000, avgViewers: 2500000, minutesWatched: 156000000, lastActive: '5 days ago' } },
  { id: 9, name: 'MrBeast', username: 'mrbeast', platform: 'youtube', region: 'USA', category: 'Entertainment', followers: 245000000, isLive: false, currentViewers: 0, language: 'en', tags: ['challenges', 'philanthropy'], metrics: { views: 47000000000, likes: 2100000000, comments: 89000000, avgViewers: 150000000, minutesWatched: 850000000, lastActive: '2 days ago' } },
  { id: 13, name: 'Luisito Comunica', username: 'luisitocomunica', platform: 'youtube', region: 'Mexico', category: 'IRL', followers: 42000000, isLive: false, currentViewers: 0, language: 'es', tags: ['travel', 'vlogs'], metrics: { views: 8900000000, likes: 620000000, comments: 28000000, avgViewers: 3200000, minutesWatched: 98000000, lastActive: '1 day ago' } },
  { id: 14, name: 'Werevertumorro', username: 'werevertumorro', platform: 'youtube', region: 'Mexico', category: 'Entertainment', followers: 18000000, isLive: false, currentViewers: 0, language: 'es', tags: ['comedy', 'sketches'], metrics: { views: 4200000000, likes: 280000000, comments: 12000000, avgViewers: 1800000, minutesWatched: 45000000, lastActive: '3 weeks ago' } },
  { id: 15, name: 'Fernanfloo', username: 'fernanfloo', platform: 'youtube', region: 'USA', category: 'Gaming', followers: 46000000, isLive: false, currentViewers: 0, language: 'es', tags: ['gaming', 'comedy'], metrics: { views: 10500000000, likes: 720000000, comments: 38000000, avgViewers: 2100000, minutesWatched: 120000000, lastActive: '2 months ago' } },
  { id: 26, name: 'PewDiePie', username: 'pewdiepie', platform: 'youtube', region: 'Sweden', category: 'Entertainment', followers: 111000000, isLive: false, currentViewers: 0, language: 'en', tags: ['gaming', 'commentary'], metrics: { views: 29000000000, likes: 1800000000, comments: 95000000, avgViewers: 4500000, minutesWatched: 320000000, lastActive: '1 week ago' } },

  // ===========================================
  // INSTAGRAM - Metrics: views, likes, comments
  // ===========================================
  { id: 19, name: 'Kylie Jenner', username: 'kyliejenner', platform: 'instagram', region: 'USA', category: 'Lifestyle', followers: 400000000, isLive: false, currentViewers: 0, language: 'en', tags: ['beauty', 'fashion'], metrics: { views: 850000000, likes: 8500000, comments: 45000, lastActive: '2 hours ago' } },
  { id: 20, name: 'Cristiano Ronaldo', username: 'cristiano', platform: 'instagram', region: 'Portugal', category: 'Sports', followers: 615000000, isLive: false, currentViewers: 0, language: 'en', tags: ['football', 'sports'], metrics: { views: 1200000000, likes: 12000000, comments: 85000, lastActive: '1 day ago' } },
  { id: 27, name: 'Selena Gomez', username: 'selenagomez', platform: 'instagram', region: 'USA', category: 'Entertainment', followers: 430000000, isLive: false, currentViewers: 0, language: 'en', tags: ['music', 'beauty'], metrics: { views: 920000000, likes: 9200000, comments: 62000, lastActive: '5 hours ago' } },
  { id: 28, name: 'Lionel Messi', username: 'leomessi', platform: 'instagram', region: 'Argentina', category: 'Sports', followers: 503000000, isLive: false, currentViewers: 0, language: 'es', tags: ['football', 'sports'], metrics: { views: 1100000000, likes: 11000000, comments: 78000, lastActive: '3 days ago' } },

  // ===========================================
  // TIKTOK - Metrics: views, likes, comments, shares
  // ===========================================
  { id: 21, name: 'Khaby Lame', username: 'khaby.lame', platform: 'tiktok', region: 'Italy', category: 'Entertainment', followers: 162000000, isLive: false, currentViewers: 0, language: 'en', tags: ['comedy', 'reactions'], metrics: { views: 45000000, likes: 4200000, comments: 28000, shares: 850000, lastActive: '6 hours ago' } },
  { id: 22, name: 'Charli D\'Amelio', username: 'charlidamelio', platform: 'tiktok', region: 'USA', category: 'Entertainment', followers: 151000000, isLive: false, currentViewers: 0, language: 'en', tags: ['dance', 'lifestyle'], metrics: { views: 28000000, likes: 3100000, comments: 45000, shares: 620000, lastActive: '1 day ago' } },
  { id: 29, name: 'Bella Poarch', username: 'bellapoarch', platform: 'tiktok', region: 'USA', category: 'Entertainment', followers: 93000000, isLive: false, currentViewers: 0, language: 'en', tags: ['music', 'comedy'], metrics: { views: 18000000, likes: 2800000, comments: 32000, shares: 420000, lastActive: '2 days ago' } },
  { id: 30, name: 'Addison Rae', username: 'addisonre', platform: 'tiktok', region: 'USA', category: 'Lifestyle', followers: 88000000, isLive: false, currentViewers: 0, language: 'en', tags: ['dance', 'fashion'], metrics: { views: 15000000, likes: 2200000, comments: 28000, shares: 380000, lastActive: '4 days ago' } },

  // ===========================================
  // FACEBOOK - Metrics: views, likes, comments
  // ===========================================
  { id: 31, name: 'JEXI', username: 'jexigaming', platform: 'facebook', region: 'Mexico', category: 'Gaming', followers: 12000000, isLive: true, currentViewers: 8500, language: 'es', tags: ['freefire', 'gaming'], metrics: { views: 45000000, likes: 1200000, comments: 85000, lastActive: 'Live now' } },
  { id: 32, name: 'Alodia Gosiengfiao', username: 'alolodia', platform: 'facebook', region: 'USA', category: 'Gaming', followers: 8500000, isLive: false, currentViewers: 0, language: 'en', tags: ['cosplay', 'gaming'], metrics: { views: 28000000, likes: 890000, comments: 45000, lastActive: '1 week ago' } },
  { id: 33, name: 'Esports Arena', username: 'esportsarena', platform: 'facebook', region: 'USA', category: 'Gaming', followers: 5200000, isLive: true, currentViewers: 12000, language: 'en', tags: ['esports', 'tournaments'], metrics: { views: 62000000, likes: 1500000, comments: 120000, lastActive: 'Live now' } },

  // ===========================================
  // X (Twitter) - Metrics: views, likes, comments
  // ===========================================
  { id: 23, name: 'Elon Musk', username: 'elonmusk', platform: 'x', region: 'USA', category: 'Business', followers: 170000000, isLive: false, currentViewers: 0, language: 'en', tags: ['tech', 'business'], metrics: { views: 45000000, likes: 520000, comments: 85000, lastActive: '30 min ago' } },
  { id: 34, name: 'Barack Obama', username: 'barackobama', platform: 'x', region: 'USA', category: 'News', followers: 133000000, isLive: false, currentViewers: 0, language: 'en', tags: ['politics', 'news'], metrics: { views: 12000000, likes: 280000, comments: 42000, lastActive: '2 days ago' } },
  { id: 35, name: 'Cristiano Ronaldo', username: 'cristiano', platform: 'x', region: 'Portugal', category: 'Sports', followers: 112000000, isLive: false, currentViewers: 0, language: 'en', tags: ['football', 'sports'], metrics: { views: 8500000, likes: 195000, comments: 28000, lastActive: '1 day ago' } },

  // ===========================================
  // LINKEDIN - Metrics: views, likes, comments
  // ===========================================
  { id: 24, name: 'Gary Vee', username: 'garyvee', platform: 'linkedin', region: 'USA', category: 'Business', followers: 5000000, isLive: false, currentViewers: 0, language: 'en', tags: ['marketing', 'entrepreneur'], metrics: { views: 2500000, likes: 12000, comments: 850, lastActive: '1 day ago' } },
  { id: 36, name: 'Bill Gates', username: 'billgates', platform: 'linkedin', region: 'USA', category: 'Tech', followers: 35000000, isLive: false, currentViewers: 0, language: 'en', tags: ['tech', 'philanthropy'], metrics: { views: 8500000, likes: 45000, comments: 3200, lastActive: '3 days ago' } },
  { id: 37, name: 'Satya Nadella', username: 'satyanadella', platform: 'linkedin', region: 'USA', category: 'Tech', followers: 12000000, isLive: false, currentViewers: 0, language: 'en', tags: ['tech', 'leadership'], metrics: { views: 4200000, likes: 28000, comments: 1800, lastActive: '5 days ago' } },
];

// ===========================================
// VIEW MODE
// ===========================================
type ViewMode = 'cards' | 'table';

const GridIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
);

const TableRowIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="4" rx="1"/>
    <rect x="3" y="10" width="18" height="4" rx="1"/>
    <rect x="3" y="16" width="18" height="4" rx="1"/>
  </svg>
);

// ===========================================
// ICONS
// ===========================================
const Icons = {
  search: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  filter: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  users: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  eye: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  x: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
  heart: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  heartFilled: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  trash: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>,
  note: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  noteFilled: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
};

const PlatformIcons: Record<Platform, JSX.Element> = {
  twitch: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/></svg>,
  youtube: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>,
  kick: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M1.333 0h8v5.333H12V2.667h2.667V0h8v8H20v2.667h-2.667v2.666H20V16h2.667v8h-8v-2.667H12v-2.666H9.333V24h-8Z"/></svg>,
  facebook: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>,
  tiktok: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>,
  instagram: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.897 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.897-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.757-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/></svg>,
  x: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>,
  linkedin: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>,
};

const PLATFORM_COLORS: Record<Platform, string> = {
  twitch: '#9146FF',
  youtube: '#FF0000',
  kick: '#53FC18',
  facebook: '#1877F2',
  tiktok: '#000000',
  instagram: '#E4405F',
  x: '#000000',
  linkedin: '#0A66C2',
};

const FLAGS: Record<string, string> = {
  'USA': '🇺🇸', 'MEXICO': '🇲🇽', 'SPAIN': '🇪🇸', 'COLOMBIA': '🇨🇴', 'BRAZIL': '🇧🇷',
  'ARGENTINA': '🇦🇷', 'CANADA': '🇨🇦', 'CHILE': '🇨🇱', 'PERU': '🇵🇪', 'SWEDEN': '🇸🇪',
  'UK': '🇬🇧', 'GERMANY': '🇩🇪', 'FRANCE': '🇫🇷', 'PORTUGAL': '🇵🇹', 'ITALY': '🇮🇹',
  'UNITED STATES': '🇺🇸', 'UNITED KINGDOM': '🇬🇧',
};

// ===========================================
// HELPERS
// ===========================================
const formatNumber = (n: number): string => {
  if (n >= 1000000000) return (n / 1000000000).toFixed(1) + 'B';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
};

const formatMinutes = (minutes: number): string => {
  if (minutes >= 1000000) return (minutes / 60000).toFixed(0) + 'K hrs';
  if (minutes >= 60000) return (minutes / 60).toFixed(0) + ' hrs';
  return minutes.toFixed(0) + ' min';
};

// Get card metrics based on platform (all in 2 rows max, 3 columns)
const getCardMetrics = (creator: Creator): { label: string; value: string }[] => {
  const m = creator.metrics;

  // TWITCH/KICK: 4 metrics = 2 rows (3+1)
  if (creator.platform === 'twitch' || creator.platform === 'kick') {
    const st = m as StreamingMetrics;
    return [
      { label: 'Followers', value: formatNumber(creator.followers) },
      { label: 'Avg Viewers', value: formatNumber(st.avgViewers) },
      { label: 'Watch Time', value: formatMinutes(st.minutesWatched) },
      { label: 'Last Active', value: st.lastActive },
    ];
  }

  // YOUTUBE: 6 metrics = 2 rows (3+3)
  if (creator.platform === 'youtube') {
    const yt = m as YouTubeMetrics;
    return [
      { label: 'Subscribers', value: formatNumber(creator.followers) },
      { label: 'Views', value: formatNumber(yt.views) },
      { label: 'Likes', value: formatNumber(yt.likes) },
      { label: 'Comments', value: formatNumber(yt.comments) },
      { label: 'Avg Live Viewers', value: formatNumber(yt.avgViewers) },
      { label: 'Last Active', value: yt.lastActive },
    ];
  }

  // TIKTOK: 6 metrics = 2 rows (3+3)
  if (creator.platform === 'tiktok') {
    const tt = m as SocialMetrics;
    return [
      { label: 'Followers', value: formatNumber(creator.followers) },
      { label: 'Views', value: formatNumber(tt.views) },
      { label: 'Likes', value: formatNumber(tt.likes) },
      { label: 'Comments', value: formatNumber(tt.comments) },
      { label: 'Shares', value: formatNumber(tt.shares || 0) },
      { label: 'Last Active', value: tt.lastActive },
    ];
  }

  // Instagram, Facebook, X, LinkedIn: 5 metrics = 2 rows (3+2)
  const social = m as SocialMetrics;
  return [
    { label: 'Followers', value: formatNumber(creator.followers) },
    { label: 'Views', value: formatNumber(social.views) },
    { label: 'Likes', value: formatNumber(social.likes) },
    { label: 'Comments', value: formatNumber(social.comments) },
    { label: 'Last Active', value: social.lastActive },
  ];
};

// Get all metrics for modal (full detail view)
const getAllMetrics = (creator: Creator): { label: string; value: string }[] => {
  const m = creator.metrics;
  const engagement = calculateEngagement(creator);

  if (creator.platform === 'twitch' || creator.platform === 'kick') {
    const st = m as StreamingMetrics;
    return [
      { label: 'Avg Viewers', value: formatNumber(st.avgViewers) },
      { label: 'Watch Time', value: formatMinutes(st.minutesWatched) },
      { label: 'Last Active', value: st.lastActive },
    ];
  }

  if (creator.platform === 'youtube') {
    const yt = m as YouTubeMetrics;
    return [
      { label: 'Views', value: formatNumber(yt.views) },
      { label: 'Likes', value: formatNumber(yt.likes) },
      { label: 'Comments', value: formatNumber(yt.comments) },
      { label: 'Avg Viewers', value: formatNumber(yt.avgViewers) },
      { label: 'Watch Time', value: formatMinutes(yt.minutesWatched) },
      { label: 'Last Active', value: yt.lastActive },
    ];
  }

  if (creator.platform === 'tiktok') {
    const tt = m as SocialMetrics;
    return [
      { label: 'Views', value: formatNumber(tt.views) },
      { label: 'Likes', value: formatNumber(tt.likes) },
      { label: 'Comments', value: formatNumber(tt.comments) },
      { label: 'Shares', value: formatNumber(tt.shares || 0) },
    ];
  }

  // Instagram, Facebook, X, LinkedIn
  const social = m as SocialMetrics;
  return [
    { label: 'Views', value: formatNumber(social.views) },
    { label: 'Likes', value: formatNumber(social.likes) },
    { label: 'Comments', value: formatNumber(social.comments) },
  ];
};

// ===========================================
// HELPER: Get views from creator metrics
// ===========================================
const getViews = (creator: Creator): number => {
  const m = creator.metrics;
  if ('views' in m) return m.views;
  return 0;
};

// Helper: Parse last active to days ago
const getLastActiveDays = (lastActive: string): number => {
  if (lastActive.toLowerCase().includes('live')) return 0;
  if (lastActive.includes('min')) return 0;
  if (lastActive.includes('hour')) return 0;
  const match = lastActive.match(/(\d+)/);
  if (!match) return 0;
  const num = parseInt(match[1]);
  if (lastActive.includes('day')) return num;
  if (lastActive.includes('week')) return num * 7;
  if (lastActive.includes('month')) return num * 30;
  return 0;
};

// Helper: Get avg viewers from creator
const getAvgViewers = (creator: Creator): number => {
  const m = creator.metrics;
  if ('avgViewers' in m) return m.avgViewers;
  return 0;
};

// ===========================================
// MAIN APP
// ===========================================
function App() {
  // Access control
  const [accessStatus, setAccessStatus] = useState<'checking' | 'granted' | 'denied'>('checking');
  const [accessError, setAccessError] = useState<AccessValidationResult | null>(null);
  const [currentUser, setCurrentUser] = useState<{ email: string; firstName: string | null } | null>(null);

  // Check access on mount
  useEffect(() => {
    validateAccess().then((result) => {
      if (result.success && result.user) {
        setAccessStatus('granted');
        setCurrentUser({ email: result.user.email, firstName: result.user.firstName });
      } else {
        setAccessStatus('denied');
        setAccessError(result);
      }
    });
  }, []);

  // API data
  const [creators, setCreators] = useState<ApiCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCreators, setTotalCreators] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<Region[]>([]);
  const [regionSearch, setRegionSearch] = useState('');
  const [regionDropdownOpen, setRegionDropdownOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [minFollowers, setMinFollowers] = useState<number>(0);
  const [maxFollowers, setMaxFollowers] = useState<number>(500000000);
  const [minEngagement, setMinEngagement] = useState<number>(0);
  const [maxLastActive, setMaxLastActive] = useState<number>(365); // days
  const [minAvgViewers, setMinAvgViewers] = useState<number>(0);
  const [maxAvgViewers, setMaxAvgViewers] = useState<number>(10000000);
  const [minViews, setMinViews] = useState<number>(0);
  const [maxViews, setMaxViews] = useState<number>(50000000000);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [discardedOnly, setDiscardedOnly] = useState(false);
  const [discarded, setDiscarded] = useState<string[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteModalCreator, setNoteModalCreator] = useState<ApiCreator | null>(null);
  const [noteContent, setNoteContent] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [sortBy, setSortBy] = useState<string>('lastactive');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 500;

  // Profile modal
  const [selectedCreator, setSelectedCreator] = useState<ApiCreator | null>(null);

  // Load favorites, discarded, and notes on mount
  useEffect(() => {
    fetchFavoriteIds().then(setFavorites).catch(console.error);
    fetchDiscardedIds().then(setDiscarded).catch(console.error);
    fetchNotesMap().then(setNotes).catch(console.error);
  }, []);

  // Build filter params (shared between initial load and load more)
  const getFilterParams = useCallback(() => ({
    limit: PAGE_SIZE,
    search: search || undefined,
    platforms: selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
    regions: selectedRegions.length > 0 ? selectedRegions : undefined,
    categories: selectedCategories.length > 0 ? selectedCategories : undefined,
    minFollowers: minFollowers > 0 ? minFollowers : undefined,
    maxFollowers: maxFollowers < 500000000 ? maxFollowers : undefined,
    minViews: minViews > 0 ? minViews : undefined,
    maxViews: maxViews < 50000000000 ? maxViews : undefined,
    minEngagement: minEngagement > 0 ? minEngagement : undefined,
    minAvgViewers: minAvgViewers > 0 ? minAvgViewers : undefined,
    maxAvgViewers: maxAvgViewers < 10000000 ? maxAvgViewers : undefined,
    maxLastActive: maxLastActive < 365 ? maxLastActive : undefined,
    favoritesOnly: favoritesOnly || undefined,
    discardedOnly: discardedOnly || undefined,
    hideDiscarded: !discardedOnly,
    sort: sortBy,
    dir: sortDir,
  }), [search, selectedPlatforms, selectedRegions, selectedCategories, minFollowers, maxFollowers, minViews, maxViews, minEngagement, minAvgViewers, maxAvgViewers, maxLastActive, favoritesOnly, discardedOnly, sortBy, sortDir]);

  // Fetch creators from API (initial load, page 1)
  const loadCreators = useCallback(async () => {
    setLoading(true);
    setPage(1);
    setHasMore(true);

    try {
      const response = await fetchCreators({ ...getFilterParams(), page: 1 });
      if (response.success) {
        setCreators(response.data);
        setTotalCreators(response.pagination?.total || response.data.length);
        setHasMore(response.data.length === PAGE_SIZE && (response.pagination?.total || 0) > PAGE_SIZE);
      }
    } catch (error) {
      console.error('Failed to fetch creators:', error);
    } finally {
      setLoading(false);
    }
  }, [getFilterParams]);

  // Load more creators (next page)
  const loadMoreCreators = async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    const nextPage = page + 1;

    try {
      const response = await fetchCreators({ ...getFilterParams(), page: nextPage });
      if (response.success) {
        setCreators(prev => [...prev, ...response.data]);
        setPage(nextPage);
        setTotalCreators(response.pagination?.total || response.data.length);
        setHasMore(response.data.length === PAGE_SIZE && (response.pagination?.total || 0) > nextPage * PAGE_SIZE);
      }
    } catch (error) {
      console.error('Failed to load more creators:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  // Debounce API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      loadCreators();
    }, 300);
    return () => clearTimeout(timer);
  }, [loadCreators]);

  // Toggle favorite via API (optimistic update for instant feedback)
  const toggleFavorite = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const wasFavorite = favorites.includes(id);

    // Optimistically update UI immediately
    if (wasFavorite) {
      setFavorites(prev => prev.filter(x => x !== id));
      // Instantly remove from view if in favoritesOnly mode
      if (favoritesOnly) {
        setCreators(prev => prev.filter(c => c.id !== id));
      }
    } else {
      setFavorites(prev => [...prev, id]);
    }

    try {
      await apiToggleFavorite(id);
    } catch (error) {
      // Revert on error
      console.error('Failed to toggle favorite:', error);
      if (wasFavorite) {
        setFavorites(prev => [...prev, id]);
        if (favoritesOnly) loadCreators();
      } else {
        setFavorites(prev => prev.filter(x => x !== id));
      }
    }
  };

  // Toggle discarded via API (optimistic update for instant feedback)
  const toggleDiscarded = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const wasDiscarded = discarded.includes(id);

    // Optimistically update UI immediately
    if (wasDiscarded) {
      setDiscarded(prev => prev.filter(x => x !== id));
      // Instantly remove from view if in discardedOnly mode (restoring)
      if (discardedOnly) {
        setCreators(prev => prev.filter(c => c.id !== id));
      }
    } else {
      setDiscarded(prev => [...prev, id]);
      // Instantly remove from view if not in discardedOnly mode (discarding)
      if (!discardedOnly) {
        setCreators(prev => prev.filter(c => c.id !== id));
      }
    }

    try {
      await apiToggleDiscarded(id);
    } catch (error) {
      // Revert on error
      console.error('Failed to toggle discarded:', error);
      if (wasDiscarded) {
        setDiscarded(prev => [...prev, id]);
        if (discardedOnly) loadCreators();
      } else {
        setDiscarded(prev => prev.filter(x => x !== id));
        if (!discardedOnly) loadCreators();
      }
    }
  };

  // Open note modal
  const openNoteModal = (creator: ApiCreator, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Opening note modal for:', creator.displayName);
    setNoteModalCreator(creator);
    setNoteContent(notes[creator.id] || '');
    setNoteModalOpen(true);
  };

  // Save note
  const handleSaveNote = async () => {
    if (!noteModalCreator) return;
    setNoteSaving(true);
    try {
      await apiSaveNote(noteModalCreator.id, noteContent);
      if (noteContent.trim()) {
        setNotes(prev => ({ ...prev, [noteModalCreator.id]: noteContent.trim() }));
      } else {
        setNotes(prev => {
          const newNotes = { ...prev };
          delete newNotes[noteModalCreator.id];
          return newNotes;
        });
      }
      setNoteModalOpen(false);
    } catch (error) {
      console.error('Failed to save note:', error);
    } finally {
      setNoteSaving(false);
    }
  };

  // Filtered regions for search
  const filteredRegions = useMemo(() => {
    if (!regionSearch) return [...REGIONS];
    return REGIONS.filter(r => r.toLowerCase().includes(regionSearch.toLowerCase()));
  }, [regionSearch]);

  // Use API creators directly (filtering done server-side)
  const filteredCreators = creators;

  const togglePlatform = (p: Platform) => {
    setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const toggleRegion = (r: Region) => {
    setSelectedRegions(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  };

  const toggleCategory = (c: Category) => {
    setSelectedCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedPlatforms([]);
    setSelectedRegions([]);
    setRegionSearch('');
    setSelectedCategories([]);
    setMinFollowers(0);
    setMaxFollowers(500000000);
    setMinEngagement(0);
    setMaxLastActive(365);
    setMinAvgViewers(0);
    setMinViews(0);
    setMaxViews(50000000000);
    setFavoritesOnly(false);
  };

  const activeFilterCount = selectedPlatforms.length + selectedRegions.length + selectedCategories.length +
    (minFollowers > 0 ? 1 : 0) + (maxFollowers < 500000000 ? 1 : 0) +
    (minEngagement > 0 ? 1 : 0) + (maxLastActive < 365 ? 1 : 0) +
    (minAvgViewers > 0 ? 1 : 0) + (maxAvgViewers < 10000000 ? 1 : 0) + (minViews > 0 ? 1 : 0) + (maxViews < 50000000000 ? 1 : 0) +
    (favoritesOnly ? 1 : 0);

  // Access gate - show loading or error screens
  if (accessStatus === 'checking') {
    return (
      <div className="access-gate">
        <div className="access-gate-content">
          <div className="access-gate-spinner"></div>
          <h2>Verifying access...</h2>
        </div>
      </div>
    );
  }

  if (accessStatus === 'denied') {
    return (
      <div className="access-gate denied">
        <div className="access-gate-content">
          <div className="access-gate-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M15 9l-6 6M9 9l6 6"/>
            </svg>
          </div>
          <h2>Access Denied</h2>
          <p>
            {accessError?.error === 'ACCESS_DENIED' && 'This application can only be accessed through the Envisioner platform.'}
            {accessError?.error === 'NO_EMAIL' && 'Please log in to access this application.'}
            {accessError?.error === 'USER_NOT_FOUND' && 'Your account does not have access to Envisioner Discovery.'}
            {accessError?.error === 'SERVER_ERROR' && 'Unable to connect to server. Please try again later.'}
          </p>
          <p className="access-gate-contact">
            Contact your administrator if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="content">
        {/* Filters Sidebar */}
        <aside className="filters">
          <div className="filters-header">
            <h3>Filters</h3>
            <div className="filters-header-right">
              <div className="view-toggle">
                <button
                  className={`view-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
                  onClick={() => setViewMode('cards')}
                  title="Card view"
                >
                  <GridIcon />
                </button>
                <button
                  className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                  onClick={() => setViewMode('table')}
                  title="Table view"
                >
                  <TableRowIcon />
                </button>
              </div>
              {activeFilterCount > 0 && <button className="clear-all" onClick={clearFilters}>Clear all</button>}
            </div>
          </div>

          {/* Search */}
          <div className="filter-group">
            <div className="search-box">
              {Icons.search}
              <input
                type="text"
                placeholder="Search by name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && <button className="clear-btn" onClick={() => setSearch('')}>{Icons.x}</button>}
            </div>
          </div>

          {/* Sort By */}
          <div className="filter-group">
            <h4>Sort by</h4>
            <select
              className="sort-select"
              value={`${sortBy}-${sortDir}`}
              onChange={e => {
                const [field, dir] = e.target.value.split('-');
                setSortBy(field);
                setSortDir(dir as 'asc' | 'desc');
              }}
            >
              <option value="lastactive-desc">Last Active (Recent first)</option>
              <option value="lastactive-asc">Last Active (Oldest first)</option>
              <option value="followers-desc">Followers (High to Low)</option>
              <option value="followers-asc">Followers (Low to High)</option>
              <option value="avgviewers-desc">Avg Viewers (High to Low)</option>
              <option value="avgviewers-asc">Avg Viewers (Low to High)</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
            </select>
          </div>

          {/* Favorites Filter */}
          <div className="filter-group">
            <label className="toggle-filter" onClick={() => { setFavoritesOnly(!favoritesOnly); setDiscardedOnly(false); }}>
              <div className={`toggle ${favoritesOnly ? 'on' : ''}`} />
              <span>Favorites only</span>
              {favorites.length > 0 && <span className="favorite-count">{favorites.length}</span>}
            </label>
          </div>

          {/* Discarded Filter */}
          <div className="filter-group">
            <label className="toggle-filter" onClick={() => { setDiscardedOnly(!discardedOnly); setFavoritesOnly(false); }}>
              <div className={`toggle ${discardedOnly ? 'on' : ''}`} style={discardedOnly ? { backgroundColor: '#ef4444' } : {}} />
              <span>Discarded only</span>
              {discarded.length > 0 && <span className="favorite-count" style={{ backgroundColor: '#ef4444' }}>{discarded.length}</span>}
            </label>
          </div>

          {/* Platforms */}
          <div className="filter-group">
            <h4>Platform</h4>
            <div className="filter-chips">
              {PLATFORMS.map(p => (
                <button
                  key={p}
                  className={`chip ${selectedPlatforms.includes(p) ? 'selected' : ''}`}
                  onClick={() => togglePlatform(p)}
                  style={selectedPlatforms.includes(p) ? { backgroundColor: PLATFORM_COLORS[p], borderColor: PLATFORM_COLORS[p] } : {}}
                >
                  <span className="chip-icon" style={{ color: selectedPlatforms.includes(p) ? '#fff' : PLATFORM_COLORS[p] }}>
                    {PlatformIcons[p]}
                  </span>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Regions - Smart Search Multi-select */}
          <div className="filter-group">
            <h4>Region</h4>
            <div className="region-select">
              <div className="region-search-box" onClick={() => setRegionDropdownOpen(!regionDropdownOpen)}>
                {Icons.search}
                <input
                  type="text"
                  placeholder="Search regions..."
                  value={regionSearch}
                  onChange={e => { setRegionSearch(e.target.value); setRegionDropdownOpen(true); }}
                  onFocus={() => setRegionDropdownOpen(true)}
                />
              </div>
              {selectedRegions.length > 0 && (
                <div className="selected-regions">
                  {selectedRegions.map(r => (
                    <span key={r} className="region-tag">
                      {FLAGS[r]} {r}
                      <button onClick={() => toggleRegion(r)}>{Icons.x}</button>
                    </span>
                  ))}
                </div>
              )}
              {regionDropdownOpen && (
                <div className="region-dropdown">
                  {filteredRegions.map(r => (
                    <button
                      key={r}
                      className={`region-option ${selectedRegions.includes(r) ? 'selected' : ''}`}
                      onClick={() => toggleRegion(r)}
                    >
                      <span>{FLAGS[r] || '🌍'} {r}</span>
                      {selectedRegions.includes(r) && Icons.check}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Categories */}
          <div className="filter-group">
            <h4>Category</h4>
            <div className="filter-chips">
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  className={`chip ${selectedCategories.includes(c) ? 'selected' : ''}`}
                  onClick={() => toggleCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Last Active - Max days */}
          <div className="filter-group">
            <h4>Last Active Within</h4>
            <div className="range-buttons">
              {[
                { value: 1, label: '24h' },
                { value: 7, label: '7 days' },
                { value: 30, label: '30 days' },
                { value: 90, label: '90 days' },
                { value: 365, label: 'Any' },
              ].map(opt => (
                <button
                  key={opt.value}
                  className={`range-btn ${maxLastActive === opt.value ? 'selected' : ''}`}
                  onClick={() => setMaxLastActive(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Followers Range Slider */}
          <div className="filter-group">
            <h4>Followers</h4>
            <div className="dual-range-slider">
              <div className="range-values">
                <span>{formatNumber(minFollowers)}</span>
                <span>{maxFollowers >= 500000000 ? 'Any' : formatNumber(maxFollowers)}</span>
              </div>
              <div className="slider-track">
                <div
                  className="slider-fill"
                  style={{
                    left: `${(Math.log10(minFollowers + 1) / Math.log10(500000001)) * 100}%`,
                    right: `${100 - (Math.log10(maxFollowers + 1) / Math.log10(500000001)) * 100}%`
                  }}
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={(Math.log10(minFollowers + 1) / Math.log10(500000001)) * 100}
                  onChange={e => {
                    const val = Math.round(Math.pow(10, (Number(e.target.value) / 100) * Math.log10(500000001)) - 1);
                    setMinFollowers(Math.min(val, maxFollowers - 1000));
                  }}
                  className="range-min"
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={(Math.log10(maxFollowers + 1) / Math.log10(500000001)) * 100}
                  onChange={e => {
                    const val = Math.round(Math.pow(10, (Number(e.target.value) / 100) * Math.log10(500000001)) - 1);
                    setMaxFollowers(Math.max(val, minFollowers + 1000));
                  }}
                  className="range-max"
                />
              </div>
            </div>
          </div>

          {/* Avg Viewers Range */}
          <div className="filter-group">
            <h4>Avg Viewers</h4>
            <div className="dual-range-slider">
              <div className="range-values">
                <span>{formatNumber(minAvgViewers)}</span>
                <span>{maxAvgViewers >= 10000000 ? 'Any' : formatNumber(maxAvgViewers)}</span>
              </div>
              <div className="slider-track">
                <div
                  className="slider-fill"
                  style={{
                    left: `${(Math.log10(minAvgViewers + 1) / Math.log10(10000001)) * 100}%`,
                    right: `${100 - (Math.log10(maxAvgViewers + 1) / Math.log10(10000001)) * 100}%`
                  }}
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={(Math.log10(minAvgViewers + 1) / Math.log10(10000001)) * 100}
                  onChange={e => {
                    const val = Math.round(Math.pow(10, (Number(e.target.value) / 100) * Math.log10(10000001)) - 1);
                    setMinAvgViewers(Math.min(val, maxAvgViewers - 100));
                  }}
                  className="range-min"
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={(Math.log10(maxAvgViewers + 1) / Math.log10(10000001)) * 100}
                  onChange={e => {
                    const val = Math.round(Math.pow(10, (Number(e.target.value) / 100) * Math.log10(10000001)) - 1);
                    setMaxAvgViewers(Math.max(val, minAvgViewers + 100));
                  }}
                  className="range-max"
                />
              </div>
            </div>
          </div>

          {/* Views Range Slider */}
          <div className="filter-group">
            <h4>Views</h4>
            <div className="dual-range-slider">
              <div className="range-values">
                <span>{formatNumber(minViews)}</span>
                <span>{maxViews >= 50000000000 ? 'Any' : formatNumber(maxViews)}</span>
              </div>
              <div className="slider-track">
                <div
                  className="slider-fill"
                  style={{
                    left: `${(Math.log10(minViews + 1) / Math.log10(50000000001)) * 100}%`,
                    right: `${100 - (Math.log10(maxViews + 1) / Math.log10(50000000001)) * 100}%`
                  }}
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={(Math.log10(minViews + 1) / Math.log10(50000000001)) * 100}
                  onChange={e => {
                    const val = Math.round(Math.pow(10, (Number(e.target.value) / 100) * Math.log10(50000000001)) - 1);
                    setMinViews(Math.min(val, maxViews - 1000));
                  }}
                  className="range-min"
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={(Math.log10(maxViews + 1) / Math.log10(50000000001)) * 100}
                  onChange={e => {
                    const val = Math.round(Math.pow(10, (Number(e.target.value) / 100) * Math.log10(50000000001)) - 1);
                    setMaxViews(Math.max(val, minViews + 1000));
                  }}
                  className="range-max"
                />
              </div>
            </div>
          </div>

          {/* Creators Found - Bottom */}
          <div className="filter-group creators-count">
            <span className="results-count">{hasMore ? '500+' : filteredCreators.length} creators found</span>
          </div>
        </aside>

        {/* Results */}
        <main className="results">
          {loading && <div className="loading">Loading creators...</div>}

          {/* Table View */}
          {viewMode === 'table' && !loading && filteredCreators.length > 0 && (
            <div className="creator-table-wrapper">
              <table className="creator-table">
                <thead>
                  <tr>
                    <th>Creator</th>
                    <th>Platform</th>
                    <th>Region</th>
                    <th>Category</th>
                    <th>Followers</th>
                    <th>Avg Viewers</th>
                    <th>Last Active</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCreators.map(creator => {
                    const platformKey = getPlatformKey(creator.platform) as Platform;
                    const displayName = creator.displayName || creator.username;
                    const category = creator.primaryCategory || creator.currentGame || '-';
                    const regionKey = creator.region as Region;
                    const lastActive = formatLastActive(creator.lastSeenLive, creator.isLive);
                    const channelUrl = creator.profileUrl || `https://${
                      platformKey === 'youtube' ? 'youtube.com/@' :
                      platformKey === 'instagram' ? 'instagram.com/' :
                      platformKey === 'tiktok' ? 'tiktok.com/@' :
                      platformKey === 'x' ? 'x.com/' :
                      platformKey === 'linkedin' ? 'linkedin.com/in/' :
                      platformKey === 'facebook' ? 'facebook.com/' :
                      platformKey + '.tv/'
                    }${creator.username}`;

                    return (
                      <tr key={creator.id} className="creator-row">
                        <td>
                          <a href={channelUrl} target="_blank" rel="noopener noreferrer" className="creator-cell">
                            <div className="creator-avatar-small">
                              <img src={getStreamerAvatar(creator)} alt={displayName} onError={handleImageError} />
                              <div className="platform-badge-small" style={{ backgroundColor: PLATFORM_COLORS[platformKey] }}>
                                {PlatformIcons[platformKey]}
                              </div>
                            </div>
                            <div className="creator-name-cell">
                              <span className="creator-display-name">{displayName}</span>
                              <span className="creator-username">@{creator.username}</span>
                            </div>
                          </a>
                        </td>
                        <td>
                          <span className="platform-chip" style={{ backgroundColor: PLATFORM_COLORS[platformKey] }}>
                            {platformKey.charAt(0).toUpperCase() + platformKey.slice(1)}
                          </span>
                        </td>
                        <td>{FLAGS[regionKey] || '🌍'} {creator.region}</td>
                        <td>{category}</td>
                        <td>{formatNumber(creator.followers)}</td>
                        <td>{creator.avgViewers > 0 ? formatNumber(creator.avgViewers) : '-'}</td>
                        <td>
                          {creator.isLive ? (
                            <span className="today-chip">Today</span>
                          ) : (
                            lastActive || '-'
                          )}
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              className={`action-btn-small ${favorites.includes(creator.id) ? 'active favorite' : ''}`}
                              onClick={(e) => toggleFavorite(creator.id, e)}
                              title={favorites.includes(creator.id) ? 'Remove from favorites' : 'Add to favorites'}
                            >
                              {favorites.includes(creator.id) ? Icons.heartFilled : Icons.heart}
                            </button>
                            <button
                              type="button"
                              className={`action-btn-small ${discarded.includes(creator.id) ? 'active discard' : ''}`}
                              onClick={(e) => toggleDiscarded(creator.id, e)}
                              title={discarded.includes(creator.id) ? 'Restore' : 'Discard'}
                            >
                              {Icons.trash}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Card View */}
          {viewMode === 'cards' && <div className="creator-grid">
            {filteredCreators.map(creator => {
              const platformKey = getPlatformKey(creator.platform) as Platform;
              const engagement = calculateApiEngagement(creator);
              const channelUrl = creator.profileUrl || `https://${
                platformKey === 'youtube' ? 'youtube.com/@' :
                platformKey === 'instagram' ? 'instagram.com/' :
                platformKey === 'tiktok' ? 'tiktok.com/@' :
                platformKey === 'x' ? 'x.com/' :
                platformKey === 'linkedin' ? 'linkedin.com/in/' :
                platformKey === 'facebook' ? 'facebook.com/' :
                platformKey + '.tv/'
              }${creator.username}`;
              const displayName = creator.displayName || creator.username;
              const category = creator.primaryCategory || creator.currentGame || 'Unknown';
              const regionKey = creator.region as Region;

              return (
                <a key={creator.id} className="creator-card" href={channelUrl} target="_blank" rel="noopener noreferrer">
                  <div className="creator-top">
                    <div className="creator-avatar">
                      <img src={getStreamerAvatar(creator)} alt={displayName} onError={handleImageError} />
                      <div className="platform-badge" style={{ backgroundColor: PLATFORM_COLORS[platformKey] }}>
                        {PlatformIcons[platformKey]}
                      </div>
                    </div>
                    <div className="creator-info">
                      <h3>{displayName}</h3>
                      <p>@{creator.username}</p>
                    </div>
                  </div>

                  <div className="creator-meta">
                    <span className="meta-item">{FLAGS[regionKey] || '🌍'} {creator.region}</span>
                    <span className="meta-item category">{category}</span>
                    <div className="card-actions">
                      <button
                        type="button"
                        className={`action-btn ${favorites.includes(creator.id) ? 'active favorite' : ''}`}
                        onClick={(e) => toggleFavorite(creator.id, e)}
                        title={favorites.includes(creator.id) ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        {favorites.includes(creator.id) ? Icons.heartFilled : Icons.heart}
                      </button>
                      <button
                        type="button"
                        className={`action-btn ${discarded.includes(creator.id) ? 'active discard' : ''}`}
                        onClick={(e) => toggleDiscarded(creator.id, e)}
                        title={discarded.includes(creator.id) ? 'Restore' : 'Discard'}
                      >
                        {Icons.trash}
                      </button>
                      <div className="note-wrapper">
                        <button
                          type="button"
                          className={`action-btn ${notes[creator.id] ? 'active note' : ''}`}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); openNoteModal(creator, e); }}
                          title={notes[creator.id] ? 'Edit note' : 'Add note'}
                        >
                          {notes[creator.id] ? Icons.noteFilled : Icons.note}
                        </button>
                        {noteModalOpen && noteModalCreator?.id === creator.id && (
                          <div className="note-popout" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} onMouseDown={(e) => e.stopPropagation()}>
                            <textarea
                              value={noteContent}
                              onChange={(e) => setNoteContent(e.target.value)}
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                              onMouseDown={(e) => e.stopPropagation()}
                              placeholder="Add a note..."
                              autoFocus
                            />
                            <div className="note-popout-actions">
                              <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setNoteModalOpen(false); }} onMouseDown={(e) => e.stopPropagation()}>Cancel</button>
                              <button type="button" className="save" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSaveNote(); }} onMouseDown={(e) => e.stopPropagation()} disabled={noteSaving}>
                                {noteSaving ? '...' : 'Save'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="creator-stats">
                    {(() => {
                      const metrics = getApiCardMetrics(creator);
                      const metricsWithoutLast = metrics.slice(0, -1);
                      const lastActive = metrics[metrics.length - 1];
                      const itemsInRow2 = Math.max(0, metricsWithoutLast.length - 3);
                      const lastActiveSpan = 3 - itemsInRow2;

                      return (
                        <>
                          {metricsWithoutLast.map((metric, idx) => (
                            <div key={idx} className="stat-item">
                              <span className="stat-value">{metric.value}</span>
                              <span className="stat-label">{metric.label}</span>
                            </div>
                          ))}
                          <div className={`stat-item span-${lastActiveSpan}`}>
                            <span className="stat-value">{lastActive.value}</span>
                            <span className="stat-label">{lastActive.label}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </a>
              );
            })}
          </div>}

          {/* Load More Button */}
          {!loading && hasMore && filteredCreators.length > 0 && (
            <div className="load-more-container">
              <button
                className="load-more-btn"
                onClick={loadMoreCreators}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}

          {/* All loaded message */}
          {!loading && !hasMore && filteredCreators.length > 0 && (
            <div className="load-more-container">
              <span className="all-loaded">All {totalCreators} creators loaded</span>
            </div>
          )}

          {filteredCreators.length === 0 && !loading && (
            <div className="no-results">
              <p>No creators found matching your filters</p>
              <button onClick={clearFilters}>Clear filters</button>
            </div>
          )}
        </main>
      </div>


      {selectedCreator && (() => {
        const modalPlatformKey = getPlatformKey(selectedCreator.platform) as Platform;
        const modalDisplayName = selectedCreator.displayName || selectedCreator.username;
        const modalCategory = selectedCreator.primaryCategory || selectedCreator.currentGame || 'Unknown';
        const modalRegionKey = selectedCreator.region as Region;
        const modalChannelUrl = selectedCreator.profileUrl || `https://${
          modalPlatformKey === 'youtube' ? 'youtube.com/@' :
          modalPlatformKey === 'instagram' ? 'instagram.com/' :
          modalPlatformKey === 'tiktok' ? 'tiktok.com/@' :
          modalPlatformKey === 'x' ? 'x.com/' :
          modalPlatformKey === 'linkedin' ? 'linkedin.com/in/' :
          modalPlatformKey === 'facebook' ? 'facebook.com/' :
          modalPlatformKey + '.tv/'
        }${selectedCreator.username}`;

        return (
          <div className="modal-overlay" onClick={() => setSelectedCreator(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setSelectedCreator(null)}>{Icons.x}</button>

              <div className="profile-header">
                <div className="profile-avatar">
                  <img src={getStreamerAvatar(selectedCreator)} alt={modalDisplayName} onError={handleImageError} />
                  <div className="platform-badge" style={{ backgroundColor: PLATFORM_COLORS[modalPlatformKey] }}>
                    {PlatformIcons[modalPlatformKey]}
                  </div>
                  {selectedCreator.isLive && <div className="live-badge">LIVE</div>}
                </div>
                <div className="profile-info">
                  <h2>{modalDisplayName}</h2>
                  <p>@{selectedCreator.username}</p>
                  <div className="profile-meta">
                    <span>{FLAGS[modalRegionKey] || '🌍'} {selectedCreator.region}</span>
                    <span>•</span>
                    <span>{modalCategory}</span>
                    <span>•</span>
                    <span>{selectedCreator.language.toUpperCase()}</span>
                  </div>
                </div>
              </div>

              {selectedCreator.isLive && selectedCreator.currentViewers && selectedCreator.currentViewers > 0 && (
                <div className="profile-live">
                  {Icons.eye} {formatNumber(selectedCreator.currentViewers)} watching live now
                </div>
              )}

              <div className="profile-stats">
                <div className="profile-stat">
                  <span className="profile-stat-value">{formatNumber(selectedCreator.followers)}</span>
                  <span className="profile-stat-label">Followers</span>
                </div>
                {getAllApiMetrics(selectedCreator).map((metric, idx) => (
                  <div key={idx} className="profile-stat">
                    <span className="profile-stat-value">{metric.value}</span>
                    <span className="profile-stat-label">{metric.label}</span>
                  </div>
                ))}
              </div>

              <div className="profile-section">
                <h4>Tags</h4>
                <div className="profile-tags">
                  {selectedCreator.tags.map(tag => (
                    <span key={tag} className="profile-tag">#{tag}</span>
                  ))}
                </div>
              </div>

              <div className="profile-section">
                <h4>Platform</h4>
                <div className="profile-platform" style={{ backgroundColor: PLATFORM_COLORS[modalPlatformKey] }}>
                  {PlatformIcons[modalPlatformKey]}
                  <span>{modalPlatformKey.charAt(0).toUpperCase() + modalPlatformKey.slice(1)}</span>
                </div>
              </div>

              <div className="profile-actions">
                <a
                  href={modalChannelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="profile-btn primary"
                >
                  Visit Channel
                </a>
                <button className="profile-btn secondary">Add to Campaign</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default App;
