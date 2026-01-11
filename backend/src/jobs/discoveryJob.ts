/**
 * Discovery Job - Finds NEW creators across multiple platforms and categories
 *
 * This job actively populates the database with new creators by:
 * 1. Scraping trending streams from multiple Twitch/Kick categories
 * 2. Using Twitch Helix API for efficient bulk discovery
 * 3. Targeting iGaming-relevant categories (Slots, Poker, Sports Betting, etc.)
 */

import { db, logger } from '../utils/database';
import { Platform, Region } from '@prisma/client';
import { getConfig } from '../utils/configFromDb';

// Twitch API config - loaded from env or database
let TWITCH_CLIENT_ID: string | null = process.env.TWITCH_CLIENT_ID || null;
let TWITCH_CLIENT_SECRET: string | null = process.env.TWITCH_CLIENT_SECRET || null;
let twitchCredsLoaded = !!(TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET);

async function ensureTwitchCreds(): Promise<boolean> {
  if (twitchCredsLoaded) return true;

  TWITCH_CLIENT_ID = await getConfig('TWITCH_CLIENT_ID');
  TWITCH_CLIENT_SECRET = await getConfig('TWITCH_CLIENT_SECRET');

  if (TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET) {
    twitchCredsLoaded = true;
    logger.info('Loaded Twitch credentials from database config');
    return true;
  }

  logger.error('Twitch credentials not found in env or database');
  return false;
}
const TWITCH_API = 'https://api.twitch.tv/helix';

// Kick API config
const KICK_API = 'https://kick.com/api/v2';

// Categories to discover creators from (Twitch category IDs)
const DISCOVERY_CATEGORIES = {
  twitch: [
    { id: '509658', name: 'Just Chatting', priority: 1 },
    { id: '27284', name: 'Fortnite', priority: 2 },
    { id: '516575', name: 'VALORANT', priority: 2 },
    { id: '32982', name: 'Grand Theft Auto V', priority: 2 },
    { id: '518203', name: 'Sports', priority: 1 },
    { id: '498566', name: 'Slots', priority: 1 },       // iGaming
    { id: '509659', name: 'Poker', priority: 1 },       // iGaming
    { id: '29452', name: 'Virtual Casino', priority: 1 }, // iGaming
    { id: '66082', name: 'Games + Demos', priority: 3 },
    { id: '26936', name: 'Music', priority: 2 },
    { id: '509660', name: 'Art', priority: 3 },
    { id: '509670', name: 'Science & Technology', priority: 3 },
    { id: '518205', name: 'Crypto', priority: 2 },      // Related to gambling
    { id: '116747788', name: 'Pools, Hot Tubs, and Beaches', priority: 3 },
  ],
  kick: [
    { slug: 'slots', name: 'Slots', priority: 1 },
    { slug: 'gambling', name: 'Gambling', priority: 1 },
    { slug: 'just-chatting', name: 'Just Chatting', priority: 1 },
    { slug: 'poker', name: 'Poker', priority: 1 },
    { slug: 'sports', name: 'Sports', priority: 2 },
    { slug: 'irl', name: 'IRL', priority: 2 },
  ],
};

let twitchAccessToken: string | null = null;
let tokenExpiry: number = 0;

/**
 * Get Twitch access token
 */
async function getTwitchToken(): Promise<string | null> {
  if (twitchAccessToken && Date.now() < tokenExpiry) {
    return twitchAccessToken;
  }

  // Ensure credentials are loaded from env or database
  if (!await ensureTwitchCreds()) {
    logger.warn('Twitch credentials not configured');
    return null;
  }

  try {
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID!,
        client_secret: TWITCH_CLIENT_SECRET!,
        grant_type: 'client_credentials',
      }),
    });

    if (response.ok) {
      const data: any = await response.json();
      twitchAccessToken = data.access_token;
      tokenExpiry = Date.now() + (data.expires_in - 300) * 1000; // 5 min buffer
      return twitchAccessToken;
    }
  } catch (error) {
    logger.error('Failed to get Twitch token:', error);
  }
  return null;
}

/**
 * Discover streamers from a Twitch category using Helix API
 */
async function discoverTwitchCategory(
  categoryId: string,
  categoryName: string,
  limit: number = 100
): Promise<number> {
  const token = await getTwitchToken();
  if (!token || !TWITCH_CLIENT_ID) return 0;

  try {
    // Get live streams in category
    const response = await fetch(
      `${TWITCH_API}/streams?game_id=${categoryId}&first=${Math.min(limit, 100)}`,
      {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      logger.error(`Twitch API error for ${categoryName}: ${response.status}`);
      return 0;
    }

    const data: any = await response.json();
    const streams = data.data || [];

    if (streams.length === 0) return 0;

    // Get user details for all streamers
    const userIds = streams.map((s: any) => s.user_id);
    const usersResponse = await fetch(
      `${TWITCH_API}/users?id=${userIds.join('&id=')}`,
      {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    const usersData: any = await usersResponse.json();
    const users = usersData.data || [];
    const userMap = new Map(users.map((u: any) => [u.id, u]));

    // Get follower counts
    const followersMap = new Map<string, number>();
    for (const userId of userIds.slice(0, 20)) { // Limit to avoid rate limits
      try {
        const followResponse = await fetch(
          `${TWITCH_API}/channels/followers?broadcaster_id=${userId}&first=1`,
          {
            headers: {
              'Client-ID': TWITCH_CLIENT_ID,
              'Authorization': `Bearer ${token}`,
            },
          }
        );
        if (followResponse.ok) {
          const followData: any = await followResponse.json();
          followersMap.set(userId, followData.total || 0);
        }
      } catch (e) {
        // Skip follower count on error
      }
    }

    let created = 0;

    for (const stream of streams) {
      const user: any = userMap.get(stream.user_id);
      if (!user) continue;

      const username = (user.login || '').toLowerCase();

      // Check if already exists
      const existing = await db.streamer.findUnique({
        where: {
          platform_username: {
            platform: Platform.TWITCH,
            username,
          },
        },
      });

      if (existing) continue; // Skip existing

      // Determine region from language
      const langToRegion: Record<string, Region> = {
        en: Region.USA, es: Region.MEXICO, pt: Region.BRAZIL, de: Region.GERMANY, fr: Region.FRANCE,
        it: Region.ITALY, ru: Region.RUSSIA, ja: Region.JAPAN, ko: Region.KOREA, zh: Region.CHINA,
      };
      const region = langToRegion[stream.language] || Region.OTHER;

      try {
        await db.streamer.create({
          data: {
            platform: Platform.TWITCH,
            username,
            displayName: user.display_name,
            profileUrl: `https://twitch.tv/${username}`,
            avatarUrl: user.profile_image_url,
            followers: followersMap.get(stream.user_id) || 0,
            currentViewers: stream.viewer_count,
            isLive: true,
            currentGame: stream.game_name,
            language: stream.language || 'en',
            region,
            tags: stream.tags || [],
            socialLinks: [],
            streamTitles: [{
              title: stream.title,
              date: new Date().toISOString(),
            }],
            lastSeenLive: new Date(),
          },
        });
        created++;
      } catch (error) {
        // Likely duplicate, skip
      }
    }

    logger.info(`Discovered ${created} new Twitch streamers from ${categoryName}`);
    return created;
  } catch (error) {
    logger.error(`Error discovering from ${categoryName}:`, error);
    return 0;
  }
}

/**
 * Discover streamers from Kick categories
 */
async function discoverKickCategory(
  categorySlug: string,
  categoryName: string,
  limit: number = 50
): Promise<number> {
  try {
    const response = await fetch(
      `${KICK_API}/channels?category=${categorySlug}&sort=viewers&limit=${limit}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }
    );

    if (!response.ok) {
      // Try alternative endpoint
      const altResponse = await fetch(
        `https://kick.com/api/v1/subcategories/${categorySlug}/livestreams?page=1&limit=${limit}`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        }
      );

      if (!altResponse.ok) {
        logger.warn(`Kick API unavailable for ${categoryName}`);
        return 0;
      }

      const altData: any = await altResponse.json();
      return await processKickStreams(altData.data || [], categoryName);
    }

    const data: any = await response.json();
    return await processKickStreams(data.data || data || [], categoryName);
  } catch (error) {
    logger.error(`Error discovering Kick ${categoryName}:`, error);
    return 0;
  }
}

async function processKickStreams(streams: any[], categoryName: string): Promise<number> {
  let created = 0;

  for (const stream of streams) {
    const channel = stream.channel || stream;
    const username = (channel.slug || channel.username || '').toLowerCase();

    if (!username) continue;

    // Check if already exists
    const existing = await db.streamer.findUnique({
      where: {
        platform_username: {
          platform: Platform.KICK,
          username,
        },
      },
    });

    if (existing) continue;

    try {
      await db.streamer.create({
        data: {
          platform: Platform.KICK,
          username,
          displayName: channel.user?.username || username,
          profileUrl: `https://kick.com/${username}`,
          avatarUrl: channel.user?.profile_pic || channel.thumbnail?.url,
          followers: channel.followers_count || channel.followersCount || 0,
          currentViewers: stream.viewer_count || stream.viewers || 0,
          isLive: true,
          currentGame: stream.category?.name || categoryName,
          language: channel.language || 'en',
          region: 'OTHER' as Region,
          tags: [],
          socialLinks: [],
          streamTitles: stream.session_title ? [{
            title: stream.session_title,
            date: new Date().toISOString(),
          }] : [],
          lastSeenLive: new Date(),
        },
      });
      created++;
    } catch (error) {
      // Skip on error
    }
  }

  logger.info(`Discovered ${created} new Kick streamers from ${categoryName}`);
  return created;
}

/**
 * Run full discovery across all categories
 */
export async function runDiscovery(options: {
  platforms?: ('twitch' | 'kick')[];
  priorityOnly?: boolean;
  limitPerCategory?: number;
} = {}): Promise<{ totalDiscovered: number; byPlatform: Record<string, number> }> {
  const {
    platforms = ['twitch', 'kick'],
    priorityOnly = false,
    limitPerCategory = 100,
  } = options;

  logger.info('Starting creator discovery job', { platforms, priorityOnly });

  const results = {
    totalDiscovered: 0,
    byPlatform: { twitch: 0, kick: 0 } as Record<string, number>,
  };

  // Discover from Twitch
  if (platforms.includes('twitch')) {
    const categories = priorityOnly
      ? DISCOVERY_CATEGORIES.twitch.filter(c => c.priority === 1)
      : DISCOVERY_CATEGORIES.twitch;

    for (const category of categories) {
      const discovered = await discoverTwitchCategory(
        category.id,
        category.name,
        limitPerCategory
      );
      results.byPlatform.twitch += discovered;
      results.totalDiscovered += discovered;

      // Small delay between categories to avoid rate limits
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Discover from Kick
  if (platforms.includes('kick')) {
    const categories = priorityOnly
      ? DISCOVERY_CATEGORIES.kick.filter(c => c.priority === 1)
      : DISCOVERY_CATEGORIES.kick;

    for (const category of categories) {
      const discovered = await discoverKickCategory(
        category.slug,
        category.name,
        limitPerCategory
      );
      results.byPlatform.kick += discovered;
      results.totalDiscovered += discovered;

      await new Promise(r => setTimeout(r, 1000));
    }
  }

  logger.info('Discovery job complete', results);
  return results;
}

/**
 * Quick discovery - just priority categories (Slots, Poker, Just Chatting)
 */
export async function runQuickDiscovery(): Promise<{ totalDiscovered: number }> {
  return runDiscovery({ priorityOnly: true, limitPerCategory: 50 });
}

/**
 * Full discovery - all categories
 */
export async function runFullDiscovery(): Promise<{ totalDiscovered: number }> {
  return runDiscovery({ priorityOnly: false, limitPerCategory: 100 });
}
