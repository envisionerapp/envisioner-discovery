import axios from 'axios';
import { db, logger } from '../utils/database';
import { Platform, Region, FraudStatus } from '@prisma/client';

interface DiscoveredStreamer {
  username: string;
  displayName: string;
  platform: Platform;
  profileUrl: string;
  avatarUrl?: string;
  followers: number;
  isLive: boolean;
  currentViewers?: number;
  currentGame?: string;
  language?: string;
}

// iGaming related game IDs on Twitch
const IGAMING_GAME_IDS = [
  '498566',   // Slots
  '29452',    // Virtual Casino
  '509658',   // Just Chatting (many iGaming streamers here)
  '27284',    // Retro Games
  '518203',   // Sports Betting
  '512710',   // Call of Duty
  '33214',    // Fortnite
  '21779',    // League of Legends
  '516575',   // VALORANT
];

// iGaming keywords to search
const IGAMING_KEYWORDS = [
  'slots', 'casino', 'gambling', 'blackjack', 'roulette', 'poker',
  'stake', 'pragmatic', 'bonus', 'giveaway', 'apuestas', 'tragamonedas',
  'ruleta', 'dinero', 'casino en vivo', 'slot machine'
];

export class DiscoveryService {
  private twitchToken: string | null = null;
  private twitchTokenExpiry: number = 0;
  private kickToken: string | null = null;
  private kickTokenExpiry: number = 0;

  // ==================== TWITCH TOKEN ====================

  private async getTwitchToken(): Promise<string> {
    const now = Date.now();

    if (this.twitchToken && this.twitchTokenExpiry > now) {
      return this.twitchToken;
    }

    const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: {
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials'
      }
    });

    this.twitchToken = response.data.access_token;
    this.twitchTokenExpiry = now + (response.data.expires_in * 1000) - 60000;

    logger.info('✅ Discovery: Twitch token refreshed');
    return this.twitchToken!;
  }

  // ==================== KICK TOKEN ====================

  private async getKickToken(): Promise<string> {
    const now = Date.now();

    if (this.kickToken && this.kickTokenExpiry > now) {
      return this.kickToken;
    }

    const response = await axios.post(
      'https://id.kick.com/oauth/token',
      new URLSearchParams({
        client_id: process.env.KICK_CLIENT_ID!,
        client_secret: process.env.KICK_CLIENT_SECRET!,
        grant_type: 'client_credentials'
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    this.kickToken = response.data.access_token;
    this.kickTokenExpiry = now + (55 * 60 * 1000);

    logger.info('✅ Discovery: Kick token refreshed');
    return this.kickToken!;
  }

  // ==================== TWITCH DISCOVERY ====================

  /**
   * Discover streamers from Twitch live streams in specific games
   * Uses ~1 request per 100 streamers (batch endpoint)
   */
  async discoverTwitchByGame(gameId: string, maxStreamers: number = 100): Promise<{
    discovered: number;
    added: number;
    existing: number;
  }> {
    logger.info(`🔍 [TWITCH] Discovering streamers for game ${gameId}...`);

    const token = await this.getTwitchToken();
    const discovered: DiscoveredStreamer[] = [];
    let cursor: string | undefined;

    // Paginate through streams (100 per page, max 800 req/min)
    while (discovered.length < maxStreamers) {
      const params: any = {
        game_id: gameId,
        first: 100,
        language: ['es', 'pt', 'en'] // LATAM languages
      };
      if (cursor) params.after = cursor;

      const response = await axios.get('https://api.twitch.tv/helix/streams', {
        headers: {
          'Client-ID': process.env.TWITCH_CLIENT_ID!,
          'Authorization': `Bearer ${token}`
        },
        params
      });

      const streams = response.data.data;
      if (streams.length === 0) break;

      for (const stream of streams) {
        discovered.push({
          username: stream.user_login.toLowerCase(),
          displayName: stream.user_name,
          platform: Platform.TWITCH,
          profileUrl: `https://twitch.tv/${stream.user_login}`,
          followers: 0, // Will be fetched separately
          isLive: true,
          currentViewers: stream.viewer_count,
          currentGame: stream.game_name,
          language: stream.language
        });
      }

      cursor = response.data.pagination?.cursor;
      if (!cursor) break;

      // Rate limit delay
      await new Promise(r => setTimeout(r, 50));
    }

    return this.saveDiscoveredStreamers(discovered.slice(0, maxStreamers), Platform.TWITCH);
  }

  /**
   * Discover streamers by searching Twitch channels
   * Uses search/channels endpoint
   */
  async discoverTwitchByKeyword(keyword: string, maxStreamers: number = 100): Promise<{
    discovered: number;
    added: number;
    existing: number;
  }> {
    logger.info(`🔍 [TWITCH] Searching for "${keyword}"...`);

    const token = await this.getTwitchToken();
    const discovered: DiscoveredStreamer[] = [];
    let cursor: string | undefined;

    while (discovered.length < maxStreamers) {
      const params: any = {
        query: keyword,
        first: 100,
        live_only: false // Get both live and offline
      };
      if (cursor) params.after = cursor;

      const response = await axios.get('https://api.twitch.tv/helix/search/channels', {
        headers: {
          'Client-ID': process.env.TWITCH_CLIENT_ID!,
          'Authorization': `Bearer ${token}`
        },
        params
      });

      const channels = response.data.data;
      if (channels.length === 0) break;

      for (const channel of channels) {
        // Filter for Spanish/Portuguese content
        if (['es', 'pt', 'en'].includes(channel.broadcaster_language)) {
          discovered.push({
            username: channel.broadcaster_login.toLowerCase(),
            displayName: channel.display_name,
            platform: Platform.TWITCH,
            profileUrl: `https://twitch.tv/${channel.broadcaster_login}`,
            avatarUrl: channel.thumbnail_url,
            followers: 0,
            isLive: channel.is_live,
            currentGame: channel.game_name,
            language: channel.broadcaster_language
          });
        }
      }

      cursor = response.data.pagination?.cursor;
      if (!cursor) break;

      await new Promise(r => setTimeout(r, 50));
    }

    return this.saveDiscoveredStreamers(discovered.slice(0, maxStreamers), Platform.TWITCH);
  }

  /**
   * Get top live streams on Twitch (any game, LATAM languages)
   */
  async discoverTwitchTopStreams(maxStreamers: number = 500): Promise<{
    discovered: number;
    added: number;
    existing: number;
  }> {
    logger.info(`🔍 [TWITCH] Discovering top live streams...`);

    const token = await this.getTwitchToken();
    const discovered: DiscoveredStreamer[] = [];
    let cursor: string | undefined;

    while (discovered.length < maxStreamers) {
      const params: any = {
        first: 100,
        language: ['es', 'pt'] // LATAM languages only
      };
      if (cursor) params.after = cursor;

      const response = await axios.get('https://api.twitch.tv/helix/streams', {
        headers: {
          'Client-ID': process.env.TWITCH_CLIENT_ID!,
          'Authorization': `Bearer ${token}`
        },
        params
      });

      const streams = response.data.data;
      if (streams.length === 0) break;

      for (const stream of streams) {
        discovered.push({
          username: stream.user_login.toLowerCase(),
          displayName: stream.user_name,
          platform: Platform.TWITCH,
          profileUrl: `https://twitch.tv/${stream.user_login}`,
          followers: 0,
          isLive: true,
          currentViewers: stream.viewer_count,
          currentGame: stream.game_name,
          language: stream.language
        });
      }

      cursor = response.data.pagination?.cursor;
      if (!cursor) break;

      await new Promise(r => setTimeout(r, 50));
    }

    return this.saveDiscoveredStreamers(discovered.slice(0, maxStreamers), Platform.TWITCH);
  }

  /**
   * Backfill follower counts for streamers missing them
   */
  async backfillTwitchFollowers(limit: number = 500): Promise<{
    updated: number;
    errors: number;
  }> {
    logger.info(`📊 [TWITCH] Backfilling followers for up to ${limit} streamers...`);

    const streamers = await db.streamer.findMany({
      where: {
        platform: Platform.TWITCH,
        followers: { lte: 0 }
      },
      select: { id: true, username: true },
      take: limit
    });

    if (streamers.length === 0) {
      logger.info('✅ All Twitch streamers have follower counts');
      return { updated: 0, errors: 0 };
    }

    const token = await this.getTwitchToken();
    let updated = 0;
    let errors = 0;

    // Batch by 100 (Twitch API limit)
    const BATCH_SIZE = 100;
    const batches = Math.ceil(streamers.length / BATCH_SIZE);

    for (let i = 0; i < batches; i++) {
      const batch = streamers.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
      const usernames = batch.map(s => s.username);

      try {
        // Get user info
        const response = await axios.get('https://api.twitch.tv/helix/users', {
          headers: {
            'Client-ID': process.env.TWITCH_CLIENT_ID!,
            'Authorization': `Bearer ${token}`
          },
          params: { login: usernames }
        });

        const userIds = response.data.data.map((u: any) => u.id);
        const userMap = new Map(response.data.data.map((u: any) => [u.login.toLowerCase(), u]));

        // Get follower counts (requires separate calls per user in new API)
        // Using channels endpoint which includes follower count
        for (const streamer of batch) {
          const userData: any = userMap.get(streamer.username.toLowerCase());
          if (userData) {
            try {
              // Get channel info which includes follower count
              const channelResponse = await axios.get('https://api.twitch.tv/helix/channels', {
                headers: {
                  'Client-ID': process.env.TWITCH_CLIENT_ID!,
                  'Authorization': `Bearer ${token}`
                },
                params: { broadcaster_id: userData.id }
              });

              // Get follower count
              const followerResponse = await axios.get('https://api.twitch.tv/helix/channels/followers', {
                headers: {
                  'Client-ID': process.env.TWITCH_CLIENT_ID!,
                  'Authorization': `Bearer ${token}`
                },
                params: { broadcaster_id: userData.id }
              });

              const followers = followerResponse.data.total || 0;

              await db.streamer.update({
                where: { id: streamer.id },
                data: {
                  followers,
                  avatarUrl: userData.profile_image_url,
                  lastScrapedAt: new Date()
                }
              });
              updated++;
            } catch (e) {
              errors++;
            }
          }
        }

        logger.info(`✅ [TWITCH] Follower batch ${i + 1}/${batches} complete`);
        await new Promise(r => setTimeout(r, 100));
      } catch (error: any) {
        logger.error(`❌ [TWITCH] Follower batch ${i + 1} failed:`, error.message);
        errors += batch.length;
      }
    }

    logger.info(`🎉 [TWITCH] Follower backfill complete: ${updated} updated, ${errors} errors`);
    return { updated, errors };
  }

  // ==================== KICK DISCOVERY ====================

  /**
   * Discover streamers from Kick categories
   */
  async discoverKickByCategory(categorySlug: string, maxStreamers: number = 100): Promise<{
    discovered: number;
    added: number;
    existing: number;
  }> {
    logger.info(`🔍 [KICK] Discovering streamers in category ${categorySlug}...`);

    const token = await this.getKickToken();
    const discovered: DiscoveredStreamer[] = [];

    try {
      const response = await axios.get(
        `https://api.kick.com/public/v1/categories/${categorySlug}/livestreams`,
        {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          params: { limit: Math.min(maxStreamers, 100) }
        }
      );

      const streams = response.data?.data || [];

      for (const stream of streams) {
        discovered.push({
          username: stream.channel?.slug?.toLowerCase() || '',
          displayName: stream.channel?.user?.username || stream.channel?.slug || '',
          platform: Platform.KICK,
          profileUrl: `https://kick.com/${stream.channel?.slug}`,
          avatarUrl: stream.channel?.user?.profile_pic,
          followers: stream.channel?.followers_count || 0,
          isLive: true,
          currentViewers: stream.viewer_count || 0,
          currentGame: stream.category?.name,
          language: stream.language || 'es'
        });
      }
    } catch (error: any) {
      logger.error(`❌ [KICK] Category discovery failed:`, error.message);
    }

    return this.saveDiscoveredStreamers(discovered, Platform.KICK);
  }

  /**
   * Discover top live Kick streamers
   */
  async discoverKickTopStreams(maxStreamers: number = 100): Promise<{
    discovered: number;
    added: number;
    existing: number;
  }> {
    logger.info(`🔍 [KICK] Discovering top live streams...`);

    const token = await this.getKickToken();
    const discovered: DiscoveredStreamer[] = [];

    try {
      const response = await axios.get(
        'https://api.kick.com/public/v1/livestreams',
        {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          params: {
            limit: Math.min(maxStreamers, 100),
            sort: 'viewers'
          }
        }
      );

      const streams = response.data?.data || [];

      for (const stream of streams) {
        // Filter for Spanish/Portuguese/English
        const lang = (stream.language || '').toLowerCase();
        if (!['es', 'pt', 'en', 'spanish', 'portuguese', 'english'].some(l => lang.includes(l))) {
          continue;
        }

        discovered.push({
          username: stream.channel?.slug?.toLowerCase() || '',
          displayName: stream.channel?.user?.username || stream.channel?.slug || '',
          platform: Platform.KICK,
          profileUrl: `https://kick.com/${stream.channel?.slug}`,
          avatarUrl: stream.channel?.user?.profile_pic,
          followers: stream.channel?.followers_count || 0,
          isLive: true,
          currentViewers: stream.viewer_count || 0,
          currentGame: stream.category?.name,
          language: lang
        });
      }
    } catch (error: any) {
      logger.error(`❌ [KICK] Top streams discovery failed:`, error.message);
    }

    return this.saveDiscoveredStreamers(discovered, Platform.KICK);
  }

  // ==================== SAVE HELPERS ====================

  private async saveDiscoveredStreamers(
    streamers: DiscoveredStreamer[],
    platform: Platform
  ): Promise<{ discovered: number; added: number; existing: number }> {
    let added = 0;
    let existing = 0;

    for (const streamer of streamers) {
      if (!streamer.username) continue;

      try {
        const exists = await db.streamer.findFirst({
          where: {
            platform,
            username: streamer.username.toLowerCase()
          }
        });

        if (exists) {
          existing++;
          // Update live status if live
          if (streamer.isLive) {
            await db.streamer.update({
              where: { id: exists.id },
              data: {
                isLive: true,
                currentViewers: streamer.currentViewers || 0,
                currentGame: streamer.currentGame,
                lastScrapedAt: new Date(),
                lastSeenLive: new Date() // Track when we saw them live
              }
            });
          }
        } else {
          await db.streamer.create({
            data: {
              platform,
              username: streamer.username.toLowerCase(),
              displayName: streamer.displayName || streamer.username,
              profileUrl: streamer.profileUrl,
              avatarUrl: streamer.avatarUrl,
              followers: streamer.followers || 0,
              isLive: streamer.isLive,
              currentViewers: streamer.currentViewers || 0,
              currentGame: streamer.currentGame,
              language: streamer.language || 'es',
              region: Region.MEXICO, // Default, will be enriched later
              tags: [],
              usesCamera: false,
              isVtuber: false,
              fraudCheck: FraudStatus.PENDING_REVIEW,
              lastScrapedAt: new Date(),
              lastSeenLive: streamer.isLive ? new Date() : null // Only set if live
            }
          });
          added++;
        }
      } catch (error: any) {
        logger.error(`Error saving streamer ${streamer.username}:`, error.message);
      }
    }

    logger.info(`📊 Discovery results: ${streamers.length} found, ${added} added, ${existing} existing`);
    return { discovered: streamers.length, added, existing };
  }

  // ==================== BULK DISCOVERY ====================

  /**
   * Run full discovery across all iGaming categories
   */
  async runFullDiscovery(): Promise<{
    totalDiscovered: number;
    totalAdded: number;
    totalExisting: number;
  }> {
    logger.info('🚀 Starting full discovery run...');

    let totalDiscovered = 0;
    let totalAdded = 0;
    let totalExisting = 0;

    // 1. Discover from Twitch top streams (LATAM)
    const topStreams = await this.discoverTwitchTopStreams(500);
    totalDiscovered += topStreams.discovered;
    totalAdded += topStreams.added;
    totalExisting += topStreams.existing;

    // 2. Discover from iGaming game categories
    for (const gameId of IGAMING_GAME_IDS.slice(0, 3)) { // Limit to first 3 to save API calls
      const result = await this.discoverTwitchByGame(gameId, 100);
      totalDiscovered += result.discovered;
      totalAdded += result.added;
      totalExisting += result.existing;
      await new Promise(r => setTimeout(r, 200));
    }

    // 3. Search by keywords
    for (const keyword of IGAMING_KEYWORDS.slice(0, 5)) { // Limit to first 5
      const result = await this.discoverTwitchByKeyword(keyword, 50);
      totalDiscovered += result.discovered;
      totalAdded += result.added;
      totalExisting += result.existing;
      await new Promise(r => setTimeout(r, 200));
    }

    // 4. Discover from Kick
    const kickTop = await this.discoverKickTopStreams(100);
    totalDiscovered += kickTop.discovered;
    totalAdded += kickTop.added;
    totalExisting += kickTop.existing;

    logger.info(`🎉 Full discovery complete: ${totalDiscovered} discovered, ${totalAdded} added, ${totalExisting} existing`);

    return { totalDiscovered, totalAdded, totalExisting };
  }
}

export const discoveryService = new DiscoveryService();
