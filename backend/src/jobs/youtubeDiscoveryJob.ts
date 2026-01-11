/**
 * YouTube Discovery Job
 *
 * Discovers 1,000+ new YouTube streamers/channels daily using:
 * 1. Keyword-based channel search
 * 2. Live stream discovery
 * 3. Related channel exploration
 */

import { db, logger } from '../utils/database';
import { Platform, Region } from '@prisma/client';
import { dedupCache, ensureDedupCache } from '../utils/discoveryDeduplication';
import { inferCategory } from '../utils/categoryMapper';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

// Minimum subscriber threshold
const MIN_SUBSCRIBERS = 1000;

// Discovery keywords - iGaming focused
const DISCOVERY_KEYWORDS = [
  // iGaming English
  'slots live stream', 'casino live stream', 'gambling stream',
  'poker live stream', 'blackjack live', 'roulette live',
  'stake slots', 'online casino', 'slot machine',
  'sports betting', 'bet stream',

  // Spanish iGaming
  'tragamonedas en vivo', 'casino en vivo', 'apuestas en vivo',
  'poker en vivo', 'ruleta en vivo', 'slots mexico',
  'casino latinoamerica', 'apuestas deportivas',

  // Portuguese iGaming
  'slots ao vivo', 'cassino ao vivo', 'apostas ao vivo',
  'poker ao vivo', 'roleta ao vivo', 'cassino brasil',

  // Popular streamer names (to find similar channels)
  'roshtein casino', 'trainwreckstv gambling', 'xposed slots',

  // Gaming (for variety)
  'gaming live stream', 'fortnite live', 'valorant stream',
];

// Country code to Region mapping
const COUNTRY_TO_REGION: Record<string, Region> = {
  US: Region.USA,
  MX: Region.MEXICO,
  ES: Region.SPAIN,
  CO: Region.COLOMBIA,
  AR: Region.ARGENTINA,
  BR: Region.BRAZIL,
  CL: Region.CHILE,
  PE: Region.PERU,
  CA: Region.CANADA,
  GB: Region.UK,
  DE: Region.GERMANY,
  FR: Region.FRANCE,
  IT: Region.ITALY,
  PT: Region.PORTUGAL,
  RU: Region.RUSSIA,
  JP: Region.JAPAN,
  KR: Region.KOREA,
  AU: Region.AUSTRALIA,
  SE: Region.SWEDEN,
  NL: Region.NETHERLANDS,
  PL: Region.POLAND,
  TR: Region.OTHER,
};

interface DiscoveredChannel {
  channelId: string;
  username: string;
  displayName: string;
  profileUrl: string;
  avatarUrl?: string;
  subscribers: number;
  videoCount: number;
  viewCount: number;
  country?: string;
  description?: string;
  isLive: boolean;
  currentViewers: number;
}

/**
 * YouTube API helper with error handling
 */
async function youtubeApi(endpoint: string): Promise<any> {
  if (!YOUTUBE_API_KEY) {
    logger.warn('YouTube API key not configured');
    return null;
  }

  const url = `${YOUTUBE_API_BASE}${endpoint}${endpoint.includes('?') ? '&' : '?'}key=${YOUTUBE_API_KEY}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      logger.error(`YouTube API error: ${response.status}`, error);
      return null;
    }

    return response.json();
  } catch (error) {
    logger.error('YouTube API fetch error:', error);
    return null;
  }
}

/**
 * Search for channels by keyword
 */
async function searchChannelsByKeyword(
  keyword: string,
  maxResults: number = 50
): Promise<DiscoveredChannel[]> {
  const discovered: DiscoveredChannel[] = [];
  let pageToken: string | null = null;
  let fetched = 0;

  while (fetched < maxResults) {
    const endpoint = `/search?part=snippet&type=channel&q=${encodeURIComponent(keyword)}&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const data = await youtubeApi(endpoint);

    if (!data?.items?.length) break;

    const channelIds = data.items.map((item: any) => item.id.channelId);

    // Get detailed channel info
    const channelsEndpoint = `/channels?part=snippet,statistics&id=${channelIds.join(',')}`;
    const channelsData = await youtubeApi(channelsEndpoint);

    if (channelsData?.items) {
      for (const channel of channelsData.items) {
        const stats = channel.statistics || {};
        const snippet = channel.snippet || {};

        discovered.push({
          channelId: channel.id,
          username: snippet.customUrl?.replace('@', '') || channel.id,
          displayName: snippet.title,
          profileUrl: `https://youtube.com/channel/${channel.id}`,
          avatarUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
          subscribers: parseInt(stats.subscriberCount) || 0,
          videoCount: parseInt(stats.videoCount) || 0,
          viewCount: parseInt(stats.viewCount) || 0,
          country: snippet.country,
          description: snippet.description,
          isLive: false,
          currentViewers: 0,
        });
      }
    }

    fetched += data.items.length;
    pageToken = data.nextPageToken;

    if (!pageToken) break;

    // Rate limit delay
    await new Promise(r => setTimeout(r, 100));
  }

  return discovered;
}

/**
 * Find currently live streams by keyword
 */
async function findLiveStreams(
  keyword: string,
  maxResults: number = 25
): Promise<DiscoveredChannel[]> {
  const discovered: DiscoveredChannel[] = [];

  const endpoint = `/search?part=snippet&type=video&eventType=live&q=${encodeURIComponent(keyword)}&maxResults=${Math.min(maxResults, 50)}`;
  const data = await youtubeApi(endpoint);

  if (!data?.items?.length) return discovered;

  // Get channel IDs from live videos
  const channelIds = [...new Set(data.items.map((item: any) => item.snippet.channelId))];

  // Get detailed channel info
  const channelsEndpoint = `/channels?part=snippet,statistics&id=${channelIds.join(',')}`;
  const channelsData = await youtubeApi(channelsEndpoint);

  if (channelsData?.items) {
    for (const channel of channelsData.items) {
      const stats = channel.statistics || {};
      const snippet = channel.snippet || {};

      discovered.push({
        channelId: channel.id,
        username: snippet.customUrl?.replace('@', '') || channel.id,
        displayName: snippet.title,
        profileUrl: `https://youtube.com/channel/${channel.id}`,
        avatarUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
        subscribers: parseInt(stats.subscriberCount) || 0,
        videoCount: parseInt(stats.videoCount) || 0,
        viewCount: parseInt(stats.viewCount) || 0,
        country: snippet.country,
        description: snippet.description,
        isLive: true,
        currentViewers: 0, // Would need video stats for this
      });
    }
  }

  return discovered;
}

/**
 * Save discovered channels to database
 */
async function saveChannels(
  channels: DiscoveredChannel[],
  source: string
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  for (const channel of channels) {
    // Skip if already in cache
    if (dedupCache.exists(Platform.YOUTUBE, channel.username)) {
      skipped++;
      continue;
    }

    // Also check by channel ID
    if (dedupCache.exists(Platform.YOUTUBE, channel.channelId)) {
      skipped++;
      continue;
    }

    // Quality filter
    if (channel.subscribers < MIN_SUBSCRIBERS) {
      skipped++;
      continue;
    }

    try {
      const region = channel.country ? (COUNTRY_TO_REGION[channel.country] || Region.OTHER) : Region.OTHER;
      const category = inferCategory(undefined, [], [], channel.description);

      await db.streamer.create({
        data: {
          platform: Platform.YOUTUBE,
          username: channel.username,
          displayName: channel.displayName,
          profileUrl: channel.profileUrl,
          avatarUrl: channel.avatarUrl,
          followers: channel.subscribers,
          totalViews: BigInt(channel.viewCount),
          currentViewers: channel.currentViewers,
          isLive: channel.isLive,
          language: 'en', // YouTube API doesn't provide language
          region,
          countryCode: channel.country,
          inferredCountry: channel.country,
          inferredCountrySource: 'YOUTUBE',
          primaryCategory: category,
          inferredCategory: category,
          inferredCategorySource: 'YOUTUBE',
          discoveredVia: source,
          profileDescription: channel.description?.substring(0, 5000),
          tags: [],
          socialLinks: [],
          streamTitles: [],
        },
      });

      // Add to cache
      dedupCache.add(Platform.YOUTUBE, channel.username);
      dedupCache.add(Platform.YOUTUBE, channel.channelId);
      created++;
    } catch (error) {
      // Likely duplicate
      skipped++;
    }
  }

  return { created, skipped };
}

/**
 * Run YouTube discovery
 */
export async function runYouTubeDiscovery(options: {
  targetNew?: number;
  keywordsLimit?: number;
} = {}): Promise<{
  discovered: number;
  byMethod: Record<string, number>;
  duration: number;
  quotaUsed: number;
}> {
  const { targetNew = 334, keywordsLimit = 15 } = options;
  const startTime = Date.now();

  if (!YOUTUBE_API_KEY) {
    logger.warn('YouTube discovery skipped - no API key configured');
    return { discovered: 0, byMethod: {}, duration: 0, quotaUsed: 0 };
  }

  logger.info('Starting YouTube discovery', { targetNew, keywordsLimit });

  // Initialize dedup cache
  await ensureDedupCache();

  const results = {
    discovered: 0,
    byMethod: {
      channelSearch: 0,
      liveStreams: 0,
    },
    duration: 0,
    quotaUsed: 0,
  };

  // Shuffle keywords to vary discovery each run
  const shuffledKeywords = [...DISCOVERY_KEYWORDS]
    .sort(() => Math.random() - 0.5)
    .slice(0, keywordsLimit);

  // Phase 1: Channel search
  logger.info(`Searching ${shuffledKeywords.length} keywords...`);

  for (const keyword of shuffledKeywords) {
    if (results.discovered >= targetNew) break;

    // Search for channels
    const channels = await searchChannelsByKeyword(keyword, 30);
    results.quotaUsed += 100 + Math.ceil(channels.length / 50); // Search + channels API

    // Filter to new only
    const newChannels = channels.filter(c =>
      !dedupCache.exists(Platform.YOUTUBE, c.username) &&
      !dedupCache.exists(Platform.YOUTUBE, c.channelId)
    );

    if (newChannels.length > 0) {
      const saved = await saveChannels(newChannels, `youtube:search:${keyword.replace(/\s+/g, '-')}`);
      results.byMethod.channelSearch += saved.created;
      results.discovered += saved.created;

      logger.debug(`Keyword "${keyword}": ${saved.created} new, ${saved.skipped} skipped`);
    }

    // Rate limit between keywords
    await new Promise(r => setTimeout(r, 200));
  }

  // Phase 2: Live stream discovery (if not at target)
  if (results.discovered < targetNew) {
    logger.info('Discovering from live streams...');

    for (const keyword of shuffledKeywords.slice(0, 5)) {
      if (results.discovered >= targetNew) break;

      const channels = await findLiveStreams(keyword, 20);
      results.quotaUsed += 100 + Math.ceil(channels.length / 50);

      const newChannels = channels.filter(c =>
        !dedupCache.exists(Platform.YOUTUBE, c.username) &&
        !dedupCache.exists(Platform.YOUTUBE, c.channelId)
      );

      if (newChannels.length > 0) {
        const saved = await saveChannels(newChannels, `youtube:live:${keyword.replace(/\s+/g, '-')}`);
        results.byMethod.liveStreams += saved.created;
        results.discovered += saved.created;
      }

      await new Promise(r => setTimeout(r, 200));
    }
  }

  results.duration = Date.now() - startTime;

  logger.info('YouTube discovery complete', results);
  return results;
}

/**
 * Quick YouTube discovery - fewer keywords
 */
export async function runQuickYouTubeDiscovery(): Promise<{ discovered: number }> {
  return runYouTubeDiscovery({ targetNew: 100, keywordsLimit: 5 });
}
