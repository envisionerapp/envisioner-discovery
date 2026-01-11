import axios, { AxiosInstance } from 'axios';
import { db, logger } from '../utils/database';
import { Platform, Region } from '@prisma/client';
import { getConfig } from '../utils/configFromDb';

// API Response interfaces
interface TikTokProfile {
  id: string;
  uniqueId: string;
  nickname: string;
  avatarLarger: string;
  avatarMedium?: string;
  signature: string;
  verified: boolean;
  followerCount: number | string;
  followingCount: number | string;
  heart: number | string;
  heartCount: number | string;
  videoCount: number | string;
  diggCount: number | string;
}

interface TikTokSearchResult {
  user_info: {
    unique_id: string;
    nickname: string;
    follower_count: number;
    custom_verify?: string;
    avatar_168x168?: { url_list: string[] };
  };
}

interface InstagramProfile {
  id: string;
  username: string;
  full_name: string;
  profile_pic_url: string;
  biography: string;
  is_verified: boolean;
  follower_count: number;
  following_count: number;
  media_count: number;
  total_likes?: number;
  total_comments?: number;
}
interface InstagramRelatedProfile {
  id: string;
  username: string;
  full_name: string;
  is_verified: boolean;
  is_private: boolean;
  profile_pic_url: string;
}


interface XProfile {
  id: string;
  username: string;
  name: string;
  profile_image_url: string;
  description: string;
  verified: boolean;
  followers_count: number;
  following_count: number;
  tweet_count: number;
  listed_count: number;
  location?: string;
}

interface FacebookProfile {
  id: string;
  username: string;
  name: string;
  profile_pic_url: string;
  about?: string;
  follower_count: number;
  following_count?: number;
  likes_count?: number;
}

interface LinkedInProfile {
  id: string;
  public_identifier: string;
  first_name: string;
  last_name: string;
  headline: string;
  profile_pic_url: string;
  summary?: string;
  follower_count: number;
  connections_count?: number;
}

type SocialProfile = TikTokProfile | InstagramProfile | XProfile | FacebookProfile | LinkedInProfile;

interface SyncQueueItem {
  id: string;
  platform: Platform;
  username: string;
  priority: number;
  sourceStreamerId?: string;
}

export class ScrapeCreatorsService {
  private client: AxiosInstance;
  private readonly BASE_URL = 'https://api.scrapecreators.com';
  private apiKeyLoaded: boolean = false;

  constructor() {
    // Initialize with env var, will try database on first use if not set
    const apiKey = process.env.SCRAPECREATORS_API_KEY;

    this.client = axios.create({
      baseURL: this.BASE_URL,
      headers: {
        'x-api-key': apiKey || '',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    if (!apiKey) {
      logger.warn('SCRAPECREATORS_API_KEY not in env, will try database config');
    } else {
      this.apiKeyLoaded = true;
    }
  }

  /**
   * Ensure API key is loaded (from env or database)
   */
  private async ensureApiKey(): Promise<boolean> {
    if (this.apiKeyLoaded) return true;

    const apiKey = await getConfig('SCRAPECREATORS_API_KEY');
    if (apiKey) {
      this.client.defaults.headers['x-api-key'] = apiKey;
      this.apiKeyLoaded = true;
      logger.info('Loaded SCRAPECREATORS_API_KEY from database config');
      return true;
    }

    logger.error('SCRAPECREATORS_API_KEY not found in env or database');
    return false;
  }

  // ==================== PROFILE ENDPOINTS (1 credit each) ====================

  async getTikTokProfile(handle: string): Promise<TikTokProfile | null> {
    try {
      if (!await this.ensureApiKey()) return null;

      const response = await this.client.get('/v1/tiktok/profile', {
        params: { handle: handle.replace('@', '') }
      });
      // API returns { success, user, stats } - combine user and stats
      const data = response.data;
      if (data?.user) {
        return {
          ...data.user,
          ...data.stats,
          ...data.statsV2,
        };
      }
      return null;
    } catch (error: any) {
      logger.error(`TikTok profile fetch failed for ${handle}:`, error.response?.data || error.message);
      return null;
    }
  }

  // ==================== SEARCH/DISCOVERY ENDPOINTS ====================

  async searchTikTokUsers(query: string): Promise<TikTokSearchResult[]> {
    try {
      if (!await this.ensureApiKey()) return [];

      const response = await this.client.get('/v1/tiktok/search/users', {
        params: { query }
      });
      return response.data?.user_list || [];
    } catch (error: any) {
      logger.error(`TikTok search failed for "${query}":`, error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Search TikTok by hashtag - finds videos/creators using a hashtag
   */
  async searchTikTokByHashtag(hashtag: string): Promise<any[]> {
    try {
      if (!await this.ensureApiKey()) return [];

      const response = await this.client.get('/v1/tiktok/search/hashtag', {
        params: { hashtag: hashtag.replace('#', '') }
      });
      return response.data?.videos || response.data?.data || [];
    } catch (error: any) {
      logger.error(`TikTok hashtag search failed for "${hashtag}":`, error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Get TikTok trending feed - discover trending creators
   */
  async getTikTokTrending(): Promise<any[]> {
    try {
      if (!await this.ensureApiKey()) return [];

      const response = await this.client.get('/v1/tiktok/trending');
      return response.data?.videos || response.data?.data || [];
    } catch (error: any) {
      logger.error(`TikTok trending failed:`, error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Get TikTok popular creators
   */
  async getTikTokPopularCreators(): Promise<any[]> {
    try {
      if (!await this.ensureApiKey()) return [];

      const response = await this.client.get('/v1/tiktok/popular/creators');
      return response.data?.creators || response.data?.data || [];
    } catch (error: any) {
      logger.error(`TikTok popular creators failed:`, error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Get YouTube channel details (Note: No YouTube search endpoint exists in ScrapeCreators)
   */
  async getYouTubeChannel(handleOrId: string): Promise<any> {
    try {
      if (!await this.ensureApiKey()) return null;

      const response = await this.client.get('/v1/youtube/channel', {
        params: { handle: handleOrId.replace('@', '') }
      });
      return response.data?.channel || response.data?.data || response.data;
    } catch (error: any) {
      logger.error(`YouTube channel failed for ${handleOrId}:`, error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Search Instagram Reels by keyword (uses Google search internally)
   * Endpoint: GET /v1/instagram/reels/search?query=xxx
   */
  async searchInstagramReels(query: string): Promise<any[]> {
    try {
      if (!await this.ensureApiKey()) return [];

      const response = await this.client.get('/v1/instagram/reels/search', {
        params: { query }
      });
      return response.data?.reels || response.data?.results || response.data?.data || [];
    } catch (error: any) {
      logger.error(`Instagram reels search failed for "${query}":`, error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Search Facebook Ad Library - find advertisers
   * Endpoint: GET /v1/facebook/adLibrary/search/ads?query=xxx
   */
  async searchFacebookAds(query: string, country: string = 'US'): Promise<any[]> {
    try {
      if (!await this.ensureApiKey()) return [];

      const response = await this.client.get('/v1/facebook/adLibrary/search/ads', {
        params: { query }
      });
      return response.data?.searchResults || response.data?.ads || response.data?.data || [];
    } catch (error: any) {
      logger.error(`Facebook ads search failed for "${query}":`, error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Search LinkedIn Ad Library - find B2B advertisers
   * Endpoint: GET /v1/linkedin/ads/search?keyword=xxx
   */
  async searchLinkedInAds(query: string): Promise<any[]> {
    try {
      if (!await this.ensureApiKey()) return [];

      const response = await this.client.get('/v1/linkedin/ads/search', {
        params: { keyword: query }
      });
      return response.data?.ads || response.data?.results || response.data?.data || [];
    } catch (error: any) {
      logger.error(`LinkedIn ads search failed for "${query}":`, error.response?.data || error.message);
      return [];
    }
  }

  /**
   * Smart search: Find best matching TikTok profile by display name
   * Uses search + verification to find the real account
   */
  async findTikTokByDisplayName(displayName: string, expectedFollowers: number): Promise<TikTokProfile | null> {
    try {
      // Search by display name
      const results = await this.searchTikTokUsers(displayName);

      if (results.length === 0) {
        logger.info(`No TikTok results for "${displayName}"`);
        return null;
      }

      // Score each result
      const scored = results.map(r => {
        const info = r.user_info;
        let score = 0;

        // Verified accounts get high priority
        if (info.custom_verify) score += 100;

        // Higher followers = higher score (log scale)
        score += Math.log10(info.follower_count + 1) * 10;

        // Name similarity bonus
        const nameLower = displayName.toLowerCase();
        const nickLower = info.nickname?.toLowerCase() || '';
        const uniqueLower = info.unique_id?.toLowerCase() || '';
        if (nickLower.includes(nameLower) || nameLower.includes(nickLower)) score += 20;
        if (uniqueLower.includes(nameLower.replace(/\s/g, ''))) score += 15;

        // Follower ratio check (if Twitch has 10M, TikTok should have at least 100k)
        const minExpected = expectedFollowers * 0.01; // At least 1% of Twitch followers
        if (info.follower_count >= minExpected) score += 30;

        return { result: r, score, followers: info.follower_count };
      });

      // Sort by score descending
      scored.sort((a, b) => b.score - a.score);

      const best = scored[0];
      logger.info(`Best TikTok match for "${displayName}": @${best.result.user_info.unique_id} (${best.followers.toLocaleString()} followers, score: ${best.score})`);

      // Fetch full profile for the best match
      return this.getTikTokProfile(best.result.user_info.unique_id);

    } catch (error: any) {
      logger.error(`Smart TikTok search failed for "${displayName}":`, error.message);
      return null;
    }
  }


  /**
   * Debug method to get raw Instagram API response
   */
  async getInstagramProfileRaw(handle: string): Promise<any> {
    try {
      if (!await this.ensureApiKey()) return { error: 'No API key' };

      const response = await this.client.get('/v1/instagram/profile', {
        params: { handle: handle.replace('@', '') }
      });
      return {
        responseDataKeys: Object.keys(response.data || {}),
        responseData: response.data,
      };
    } catch (error: any) {
      return { error: error.response?.data || error.message };
    }
  }

  async getInstagramProfileDebug(handle: string): Promise<{ profile: InstagramProfile | null; debug: any }> {
    try {
      if (!await this.ensureApiKey()) return { profile: null, debug: { error: 'No API key' } };

      const response = await this.client.get('/v1/instagram/profile', {
        params: { handle: handle.replace('@', '') }
      });

      const debug = {
        responseDataKeys: Object.keys(response.data || {}),
        dataKeys: Object.keys(response.data?.data || {}),
        userExists: !!response.data?.data?.user,
        userKeys: response.data?.data?.user ? Object.keys(response.data.data.user).slice(0, 15) : [],
        edge_followed_by: response.data?.data?.user?.edge_followed_by,
        biography: response.data?.data?.user?.biography?.substring(0, 50),
        username: response.data?.data?.user?.username,
      };

      const raw = response.data?.data?.user || response.data?.user || response.data?.data || response.data;
      if (!raw) return { profile: null, debug: { ...debug, error: 'raw is null' } };

      const profile: InstagramProfile = {
        id: raw.id || raw.pk || '',
        username: raw.username || handle,
        full_name: raw.full_name || '',
        profile_pic_url: raw.profile_pic_url_hd || raw.profile_pic_url || '',
        biography: raw.biography || '',
        is_verified: raw.is_verified || false,
        follower_count: raw.follower_count ?? raw.edge_followed_by?.count ?? 0,
        following_count: raw.following_count ?? raw.edge_follow?.count ?? 0,
        media_count: raw.media_count ?? raw.edge_owner_to_timeline_media?.count ?? 0,
        total_likes: raw.total_likes || 0,
        total_comments: raw.total_comments || 0,
      };

      return { profile, debug };
    } catch (error: any) {
      return { profile: null, debug: { error: error.response?.data || error.message } };
    }
  }

  /**
   * Get related profiles for an Instagram user
   * These are accounts Instagram suggests as similar
   */
  async getInstagramRelatedProfiles(handle: string): Promise<InstagramRelatedProfile[]> {
    try {
      if (!await this.ensureApiKey()) return [];

      const response = await this.client.get('/v1/instagram/profile', {
        params: { handle: handle.replace('@', '') }
      });

      const user = response.data?.data?.user || response.data?.user;
      if (!user) return [];

      const edges = user.edge_related_profiles?.edges || [];
      return edges.map((edge: any) => ({
        id: edge.node?.id || '',
        username: edge.node?.username || '',
        full_name: edge.node?.full_name || '',
        is_verified: edge.node?.is_verified || false,
        is_private: edge.node?.is_private || false,
        profile_pic_url: edge.node?.profile_pic_url || '',
      })).filter((p: InstagramRelatedProfile) => p.username && !p.is_private);
    } catch (error: any) {
      logger.error(`Failed to get related profiles for ${handle}:`, error.response?.data || error.message);
      return [];
    }
  }


  async getInstagramProfile(handle: string): Promise<InstagramProfile | null> {
    try {
      if (!await this.ensureApiKey()) return null;

      const response = await this.client.get('/v1/instagram/profile', {
        params: { handle: handle.replace('@', '') }
      });

      // API returns { success, data: { user: {...} } }
      logger.info(`Instagram API response.data keys: ${Object.keys(response.data || {}).join(', ')}`);
      logger.info(`Instagram response.data.data keys: ${Object.keys(response.data?.data || {}).join(', ')}`);
      logger.info(`Instagram response.data.data.user exists: ${!!response.data?.data?.user}`);

      const raw = response.data?.data?.user || response.data?.user || response.data?.data || response.data;
      if (!raw) {
        logger.warn(`Instagram profile raw is null for ${handle}`);
        return null;
      }

      logger.info(`Instagram raw object keys: ${Object.keys(raw).slice(0, 10).join(', ')}`);
      logger.info(`Instagram raw.edge_followed_by: ${JSON.stringify(raw.edge_followed_by)}`);
      logger.info(`Instagram raw.biography: ${raw.biography?.substring(0, 50)}`);

      // Map Instagram's native GraphQL structure to our interface
      // Native fields: edge_followed_by.count, edge_follow.count, edge_owner_to_timeline_media.count
      const profile: InstagramProfile = {
        id: raw.id || raw.pk || '',
        username: raw.username || handle,
        full_name: raw.full_name || '',
        profile_pic_url: raw.profile_pic_url_hd || raw.profile_pic_url || '',
        biography: raw.biography || '',
        is_verified: raw.is_verified || false,
        follower_count: raw.follower_count ?? raw.edge_followed_by?.count ?? 0,
        following_count: raw.following_count ?? raw.edge_follow?.count ?? 0,
        media_count: raw.media_count ?? raw.edge_owner_to_timeline_media?.count ?? 0,
        total_likes: raw.total_likes || 0,
        total_comments: raw.total_comments || 0,
      };

      logger.debug(`Instagram profile for ${handle}: ${profile.follower_count?.toLocaleString()} followers`);
      return profile;
    } catch (error: any) {
      logger.error(`Instagram profile fetch failed for ${handle}:`, error.response?.data || error.message);
      return null;
    }
  }

  async searchInstagramUsers(query: string): Promise<any[]> {
    try {
      const response = await this.client.get('/v1/instagram/search', {
        params: { query }
      });
      return response.data?.users || [];
    } catch (error: any) {
      logger.error(`Instagram search failed for "${query}":`, error.response?.data || error.message);
      return [];
    }
  }

  async findInstagramByDisplayName(displayName: string, expectedFollowers: number): Promise<InstagramProfile | null> {
    try {
      const results = await this.searchInstagramUsers(displayName);

      if (results.length === 0) {
        return null;
      }

      // Pick best match by follower count and name similarity
      const scored = results.map((r: any) => {
        let score = 0;
        if (r.is_verified) score += 100;
        score += Math.log10((r.follower_count || 0) + 1) * 10;

        const nameLower = displayName.toLowerCase();
        if (r.full_name?.toLowerCase().includes(nameLower)) score += 20;
        if (r.username?.toLowerCase().includes(nameLower.replace(/\s/g, ''))) score += 15;

        const minExpected = expectedFollowers * 0.01;
        if ((r.follower_count || 0) >= minExpected) score += 30;

        return { result: r, score };
      });

      scored.sort((a: any, b: any) => b.score - a.score);
      return this.getInstagramProfile(scored[0].result.username);

    } catch (error: any) {
      logger.error(`Smart Instagram search failed for "${displayName}":`, error.message);
      return null;
    }
  }

  async getXProfile(handle: string): Promise<XProfile | null> {
    try {
      const response = await this.client.get('/v1/twitter/profile', {
        params: { handle: handle.replace('@', '') }
      });
      return response.data?.data || response.data;
    } catch (error: any) {
      logger.error(`X profile fetch failed for ${handle}:`, error.response?.data || error.message);
      return null;
    }
  }

  async getFacebookProfile(handle: string): Promise<FacebookProfile | null> {
    try {
      const response = await this.client.get('/v1/facebook/profile', {
        params: { handle }
      });
      return response.data?.data || response.data;
    } catch (error: any) {
      logger.error(`Facebook profile fetch failed for ${handle}:`, error.response?.data || error.message);
      return null;
    }
  }

  async getLinkedInProfile(handle: string): Promise<LinkedInProfile | null> {
    try {
      const response = await this.client.get('/v1/linkedin/profile', {
        params: { handle }
      });
      return response.data?.data || response.data;
    } catch (error: any) {
      logger.error(`LinkedIn profile fetch failed for ${handle}:`, error.response?.data || error.message);
      return null;
    }
  }

  // ==================== SYNC QUEUE MANAGEMENT ====================

  async addToSyncQueue(items: SyncQueueItem[]): Promise<number> {
    let added = 0;

    for (const item of items) {
      try {
        await db.socialSyncQueue.upsert({
          where: {
            platform_username: {
              platform: item.platform,
              username: item.username.toLowerCase(),
            }
          },
          create: {
            platform: item.platform,
            username: item.username.toLowerCase(),
            priority: item.priority,
            sourceStreamerId: item.sourceStreamerId,
            status: 'PENDING',
          },
          update: {
            priority: item.priority,
            sourceStreamerId: item.sourceStreamerId,
            // Don't update status if already processed
          }
        });
        added++;
      } catch (error) {
        logger.error(`Failed to add ${item.platform}/${item.username} to queue:`, error);
      }
    }

    return added;
  }

  async getNextBatch(platform: Platform, batchSize: number = 50): Promise<any[]> {
    return db.socialSyncQueue.findMany({
      where: {
        platform,
        status: 'PENDING',
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ],
      take: batchSize,
    });
  }

  async markAsProcessed(id: string, success: boolean, error?: string): Promise<void> {
    await db.socialSyncQueue.update({
      where: { id },
      data: {
        status: success ? 'COMPLETED' : 'FAILED',
        processedAt: new Date(),
        errorMessage: error,
        retryCount: success ? undefined : { increment: 1 },
      }
    });
  }

  // ==================== SYNC STREAMERS ====================

  async syncPlatform(platform: Platform, batchSize: number = 50): Promise<{
    total: number;
    success: number;
    errors: number;
    credits: number;
  }> {
    const startTime = Date.now();
    const platformEmoji = this.getPlatformEmoji(platform);
    console.log(`${platformEmoji} [${platform}] Starting sync...`);

    const queue = await this.getNextBatch(platform, batchSize);

    if (queue.length === 0) {
      console.log(`${platformEmoji} [${platform}] No items in queue`);
      return { total: 0, success: 0, errors: 0, credits: 0 };
    }

    console.log(`📊 [${platform}] Processing ${queue.length} creators`);

    let success = 0;
    let errors = 0;

    for (const item of queue) {
      try {
        const profile = await this.fetchProfile(platform, item.username);

        if (profile) {
          await this.upsertStreamer(platform, profile, item.sourceStreamerId);
          await this.markAsProcessed(item.id, true);
          success++;
        } else {
          await this.markAsProcessed(item.id, false, 'Profile not found');
          errors++;
        }

        // Rate limiting: 100ms between requests (no rate limit on their end, but be respectful)
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error: any) {
        await this.markAsProcessed(item.id, false, error.message);
        errors++;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`🎉 [${platform}] Sync complete: ${queue.length} total, ${success} success, ${errors} errors in ${duration}s`);
    console.log(`💰 [${platform}] Credits used: ${queue.length}`);

    return {
      total: queue.length,
      success,
      errors,
      credits: queue.length, // 1 credit per profile fetch
    };
  }

  /**
   * Smart sync: Search by display name from existing Twitch/Kick/YouTube streamers
   * More accurate than username matching, costs 2 credits per streamer (search + profile)
   */
  async smartSyncFromStreamers(
    targetPlatform: 'TIKTOK' | 'INSTAGRAM',
    options: {
      minFollowers?: number;  // Only sync streamers with at least this many followers
      limit?: number;         // Max streamers to process
      skipExisting?: boolean; // Skip if already have this platform linked
    } = {}
  ): Promise<{
    processed: number;
    found: number;
    notFound: number;
    credits: number;
  }> {
    const { minFollowers = 100000, limit = 50, skipExisting = true } = options;
    const platformEmoji = targetPlatform === 'TIKTOK' ? '🎵' : '📸';

    console.log(`${platformEmoji} [SMART SYNC] Finding ${targetPlatform} accounts for top streamers...`);
    console.log(`   Min followers: ${minFollowers.toLocaleString()}, Limit: ${limit}`);

    // Get top streamers from Twitch/Kick/YouTube that don't have this platform yet
    const streamers = await db.streamer.findMany({
      where: {
        platform: { in: ['TWITCH', 'KICK', 'YOUTUBE'] },
        followers: { gte: minFollowers },
      },
      orderBy: { followers: 'desc' },
      take: limit * 2, // Fetch extra in case some are skipped
      select: {
        id: true,
        displayName: true,
        username: true,
        followers: true,
        platform: true,
        socialLinks: true,
      },
    });

    let processed = 0;
    let found = 0;
    let notFound = 0;
    let credits = 0;

    for (const streamer of streamers) {
      if (processed >= limit) break;

      // Skip if already has this platform linked
      if (skipExisting) {
        const links = (streamer.socialLinks as string[]) || [];
        const platformDomain = targetPlatform === 'TIKTOK' ? 'tiktok.com' : 'instagram.com';
        if (links.some(l => l.includes(platformDomain))) {
          continue;
        }
      }

      processed++;
      console.log(`\n[${processed}/${limit}] Searching ${targetPlatform} for: ${streamer.displayName} (${streamer.followers.toLocaleString()} followers on ${streamer.platform})`);

      try {
        let profile: SocialProfile | null = null;

        if (targetPlatform === 'TIKTOK') {
          profile = await this.findTikTokByDisplayName(streamer.displayName, streamer.followers);
          credits += 2; // 1 for search, 1 for profile
        } else if (targetPlatform === 'INSTAGRAM') {
          profile = await this.findInstagramByDisplayName(streamer.displayName, streamer.followers);
          credits += 2;
        }

        if (profile) {
          await this.upsertStreamer(targetPlatform, profile, streamer.id);
          found++;
          console.log(`   ✅ Found and saved!`);
        } else {
          notFound++;
          console.log(`   ❌ Not found`);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}`);
        notFound++;
      }
    }

    console.log(`\n${platformEmoji} [SMART SYNC] Complete!`);
    console.log(`   Processed: ${processed}, Found: ${found}, Not found: ${notFound}`);
    console.log(`   Credits used: ~${credits}`);

    return { processed, found, notFound, credits };
  }

  private async fetchProfile(platform: Platform, username: string): Promise<SocialProfile | null> {
    switch (platform) {
      case 'TIKTOK':
        return this.getTikTokProfile(username);
      case 'INSTAGRAM':
        return this.getInstagramProfile(username);
      case 'X':
        return this.getXProfile(username);
      case 'FACEBOOK':
        return this.getFacebookProfile(username);
      case 'LINKEDIN':
        return this.getLinkedInProfile(username);
      default:
        return null;
    }
  }

  private async upsertStreamer(platform: Platform, profile: SocialProfile, sourceStreamerId?: string): Promise<void> {
    const data = this.mapProfileToStreamer(platform, profile);

    // Skip if no username (API returned incomplete data)
    if (!data.username) {
      logger.warn(`Skipping ${platform} profile - no username in API response`);
      return;
    }

    await db.streamer.upsert({
      where: {
        platform_username: {
          platform,
          username: data.username.toLowerCase(),
        }
      },
      create: {
        ...data,
        platform,
        region: Region.WORLDWIDE, // Default, can be enriched later
        lastScrapedAt: new Date(),
      },
      update: {
        ...data,
        lastScrapedAt: new Date(),
      }
    });

    // Also update the influencers table if this username exists there
    await this.updateInfluencersTable(platform, data.username, data.followers || 0);

    // If this was discovered from an existing streamer, link them in socialLinks
    if (sourceStreamerId) {
      await this.linkSocialProfile(sourceStreamerId, platform, data.username);
    }
  }

  /**
   * Update the influencers table with followers from ScrapeCreators API
   */
  private async updateInfluencersTable(platform: Platform, username: string, followers: number): Promise<void> {
    try {
      // Build the channel URL pattern to match
      const platformPatterns: Record<string, string> = {
        TIKTOK: `tiktok.com/@${username}`,
        INSTAGRAM: `instagram.com/${username}`,
        X: `x.com/${username}`,
        FACEBOOK: `facebook.com/${username}`,
        LINKEDIN: `linkedin.com/in/${username}`,
      };

      const pattern = platformPatterns[platform];
      if (!pattern) return;

      // Update influencers table where channel_url matches
      const result = await db.$executeRawUnsafe(`
        UPDATE influencers
        SET subscribers = $1, stats_updated_at = NOW()
        WHERE channel_url ILIKE $2
           OR channel_url ILIKE $3
      `, followers, `%${pattern}%`, `%twitter.com/${username}%`);

      if (result > 0) {
        logger.info(`📊 Updated influencers table: ${username} on ${platform} with ${followers} followers`);
      }
    } catch (error: any) {
      logger.error(`Failed to update influencers table for ${username}:`, error.message);
    }
  }

  private mapProfileToStreamer(platform: Platform, profile: SocialProfile): any {
    switch (platform) {
      case 'TIKTOK': {
        const p = profile as TikTokProfile;
        const followers = typeof p.followerCount === 'string' ? parseInt(p.followerCount) : (p.followerCount || 0);
        const hearts = typeof p.heartCount === 'string' ? parseInt(p.heartCount) : (p.heartCount || 0);
        const videos = typeof p.videoCount === 'string' ? parseInt(p.videoCount) : (p.videoCount || 0);
        const diggs = typeof p.diggCount === 'string' ? parseInt(p.diggCount) : (p.diggCount || 0);

        return {
          username: p.uniqueId || '',
          displayName: p.nickname || p.uniqueId || '',
          profileUrl: `https://tiktok.com/@${p.uniqueId || ''}`,
          avatarUrl: p.avatarLarger || p.avatarMedium,
          followers: followers,
          totalLikes: BigInt(hearts),  // heartCount = likes received
          totalViews: BigInt(videos),  // videoCount for reference
          profileDescription: p.signature || '',
          engagementRate: this.calculateEngagementRate(followers, hearts, videos),
        };
      }
      case 'INSTAGRAM': {
        const p = profile as InstagramProfile;
        return {
          username: p.username,
          displayName: p.full_name || p.username,
          profileUrl: `https://instagram.com/${p.username}`,
          avatarUrl: p.profile_pic_url,
          followers: p.follower_count || 0,
          totalLikes: BigInt(p.total_likes || 0),
          totalComments: BigInt(p.total_comments || 0),
          profileDescription: p.biography,
          engagementRate: this.calculateEngagementRate(p.follower_count, (p.total_likes || 0) + (p.total_comments || 0), p.media_count),
        };
      }
      case 'X': {
        const p = profile as XProfile;
        return {
          username: p.username,
          displayName: p.name || p.username,
          profileUrl: `https://x.com/${p.username}`,
          avatarUrl: p.profile_image_url,
          followers: p.followers_count || 0,
          profileDescription: p.description,
        };
      }
      case 'FACEBOOK': {
        const p = profile as FacebookProfile;
        return {
          username: p.username || p.id,
          displayName: p.name,
          profileUrl: `https://facebook.com/${p.username || p.id}`,
          avatarUrl: p.profile_pic_url,
          followers: p.follower_count || 0,
          totalLikes: BigInt(p.likes_count || 0),
          profileDescription: p.about,
        };
      }
      case 'LINKEDIN': {
        const p = profile as LinkedInProfile;
        return {
          username: p.public_identifier,
          displayName: `${p.first_name} ${p.last_name}`.trim(),
          profileUrl: `https://linkedin.com/in/${p.public_identifier}`,
          avatarUrl: p.profile_pic_url,
          followers: p.follower_count || 0,
          profileDescription: p.headline,
        };
      }
      default:
        return {};
    }
  }

  private calculateEngagementRate(followers: number, engagements: number, posts: number): number {
    if (!followers || !posts || posts === 0) return 0;
    const avgEngagementsPerPost = engagements / posts;
    return Math.min((avgEngagementsPerPost / followers) * 100, 100);
  }

  private async linkSocialProfile(streamerId: string, platform: Platform, username: string): Promise<void> {
    try {
      const streamer = await db.streamer.findUnique({
        where: { id: streamerId },
        select: { socialLinks: true }
      });

      const socialLinks = (streamer?.socialLinks as any[]) || [];
      const platformUrls: Record<string, string> = {
        TIKTOK: `https://tiktok.com/@${username}`,
        INSTAGRAM: `https://instagram.com/${username}`,
        X: `https://x.com/${username}`,
        FACEBOOK: `https://facebook.com/${username}`,
        LINKEDIN: `https://linkedin.com/in/${username}`,
      };

      const newLink = platformUrls[platform];
      if (newLink && !socialLinks.includes(newLink)) {
        await db.streamer.update({
          where: { id: streamerId },
          data: {
            socialLinks: [...socialLinks, newLink]
          }
        });
      }
    } catch (error) {
      logger.error(`Failed to link social profile:`, error);
    }
  }

  private getPlatformEmoji(platform: Platform): string {
    const emojis: Record<string, string> = {
      TIKTOK: '🎵',
      INSTAGRAM: '📸',
      X: '𝕏',
      FACEBOOK: '📘',
      LINKEDIN: '💼',
    };
    return emojis[platform] || '🌐';
  }

  // ==================== EXTRACT SOCIAL HANDLES FROM EXISTING STREAMERS ====================

  async extractSocialHandlesFromStreamers(): Promise<{
    tiktok: number;
    instagram: number;
    x: number;
    facebook: number;
    linkedin: number;
  }> {
    console.log('🔍 Extracting social handles from existing streamers...');

    const streamers = await db.streamer.findMany({
      where: {
        platform: { in: ['TWITCH', 'KICK', 'YOUTUBE'] }
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        socialLinks: true,
        profileDescription: true,
        followers: true,
      }
    });

    const counts = { tiktok: 0, instagram: 0, x: 0, facebook: 0, linkedin: 0 };
    const queueItems: SyncQueueItem[] = [];

    for (const streamer of streamers) {
      const links = (streamer.socialLinks as string[]) || [];
      const description = streamer.profileDescription || '';

      // Parse social links and description for handles
      const handles = this.extractHandlesFromContent([...links, description].join(' '));

      // Calculate priority based on follower count (higher followers = higher priority)
      const priority = Math.min(Math.floor(Math.log10(streamer.followers + 1) * 10), 100);

      if (handles.tiktok) {
        queueItems.push({
          id: '',
          platform: Platform.TIKTOK,
          username: handles.tiktok,
          priority,
          sourceStreamerId: streamer.id,
        });
        counts.tiktok++;
      }

      if (handles.instagram) {
        queueItems.push({
          id: '',
          platform: Platform.INSTAGRAM,
          username: handles.instagram,
          priority,
          sourceStreamerId: streamer.id,
        });
        counts.instagram++;
      }

      if (handles.x) {
        queueItems.push({
          id: '',
          platform: Platform.X,
          username: handles.x,
          priority,
          sourceStreamerId: streamer.id,
        });
        counts.x++;
      }

      if (handles.facebook) {
        queueItems.push({
          id: '',
          platform: Platform.FACEBOOK,
          username: handles.facebook,
          priority,
          sourceStreamerId: streamer.id,
        });
        counts.facebook++;
      }

      if (handles.linkedin) {
        queueItems.push({
          id: '',
          platform: Platform.LINKEDIN,
          username: handles.linkedin,
          priority,
          sourceStreamerId: streamer.id,
        });
        counts.linkedin++;
      }
    }

    // Add all to queue
    if (queueItems.length > 0) {
      await this.addToSyncQueue(queueItems);
    }

    console.log(`📊 Extracted handles:`, counts);
    console.log(`📋 Added ${queueItems.length} items to sync queue`);

    return counts;
  }

  private extractHandlesFromContent(content: string): {
    tiktok?: string;
    instagram?: string;
    x?: string;
    facebook?: string;
    linkedin?: string;
  } {
    const handles: any = {};

    // TikTok patterns
    const tiktokMatch = content.match(/tiktok\.com\/@?([a-zA-Z0-9_.]+)/i) ||
                        content.match(/@([a-zA-Z0-9_.]+)\s*\(?tiktok\)?/i);
    if (tiktokMatch) handles.tiktok = tiktokMatch[1].replace('@', '');

    // Instagram patterns
    const instaMatch = content.match(/instagram\.com\/([a-zA-Z0-9_.]+)/i) ||
                       content.match(/(?:ig|insta|instagram)[:\s]*@?([a-zA-Z0-9_.]+)/i);
    if (instaMatch) handles.instagram = instaMatch[1].replace('@', '');

    // X/Twitter patterns
    const xMatch = content.match(/(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/i) ||
                   content.match(/(?:twitter|x)[:\s]*@?([a-zA-Z0-9_]+)/i);
    if (xMatch) handles.x = xMatch[1].replace('@', '');

    // Facebook patterns
    const fbMatch = content.match(/facebook\.com\/([a-zA-Z0-9_.]+)/i) ||
                    content.match(/fb\.com\/([a-zA-Z0-9_.]+)/i);
    if (fbMatch) handles.facebook = fbMatch[1];

    // LinkedIn patterns
    const linkedinMatch = content.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i);
    if (linkedinMatch) handles.linkedin = linkedinMatch[1];

    return handles;
  }

  // ==================== SEED QUEUE FROM USERNAMES ====================

  async seedQueueFromUsernames(platform: Platform, usernames: string[], priority: number = 50): Promise<number> {
    const items: SyncQueueItem[] = usernames.map(username => ({
      id: '',
      platform,
      username: username.replace('@', '').toLowerCase(),
      priority,
    }));

    return this.addToSyncQueue(items);
  }

  // ==================== STATS ====================

  async getQueueStats(): Promise<Record<string, { pending: number; completed: number; failed: number }>> {
    const platforms: Platform[] = ['TIKTOK', 'INSTAGRAM', 'X', 'FACEBOOK', 'LINKEDIN'];
    const stats: Record<string, any> = {};

    for (const platform of platforms) {
      const [pending, completed, failed] = await Promise.all([
        db.socialSyncQueue.count({ where: { platform, status: 'PENDING' } }),
        db.socialSyncQueue.count({ where: { platform, status: 'COMPLETED' } }),
        db.socialSyncQueue.count({ where: { platform, status: 'FAILED' } }),
      ]);

      stats[platform] = { pending, completed, failed };
    }

    return stats;
  }
}

export const scrapeCreatorsService = new ScrapeCreatorsService();
