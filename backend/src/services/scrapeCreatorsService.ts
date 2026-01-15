import axios, { AxiosInstance } from 'axios';
import { db, logger } from '../utils/database';
import { Platform, Region } from '@prisma/client';
import { getConfig } from '../utils/configFromDb';
import { bunnyService } from './bunnyService';

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
  // Raw API fields (nested structure)
  avatar?: { image_url?: string };
  core?: { name?: string; screen_name?: string };
  legacy?: {
    profile_image_url_https?: string;
    description?: string;
    followers_count?: number;
    friends_count?: number;
    statuses_count?: number;
    listed_count?: number;
    location?: string;
    name?: string;
    screen_name?: string;
  };
}

interface FacebookProfile {
  id: string;
  username?: string;
  name: string;
  url?: string;
  profilePicLarge?: string;
  profilePicMedium?: string;
  profilePicSmall?: string;
  pageIntro?: string;
  category?: string;
  about?: string;
  followerCount?: number;
  likeCount?: number;
}

interface LinkedInProfile {
  id: string;
  public_identifier: string;
  first_name: string;
  last_name: string;
  headline: string;
  image: string;  // API returns 'image', not 'profile_pic_url'
  summary?: string;
  about?: string;
  follower_count?: number;
  followers?: number;
  connections_count?: number;
  location?: string;
  city?: string;
  country?: string;
  country_code?: string;
  geo_location?: string;
  name?: string;  // Full name from API
}

interface YouTubeChannel {
  channelId: string;
  channel: string;
  name: string;
  avatar?: {
    image?: {
      sources?: Array<{ url: string; width: number; height: number }>;
    };
  };
  description?: string;
  subscriberCount?: number;
  subscriberCountText?: string;
  videoCountText?: string;
  viewCountText?: string;
  tags?: string;
  email?: string | null;
  store?: string | null;
  twitter?: string | null;
  instagram?: string | null;
  linkedin?: string | null;
  tiktok?: string | null;
  links?: string[];
  country?: string;
}

// Normalized YouTube profile from API
interface YouTubeProfile {
  username: string;
  displayName: string;
  bio: string;
  followers: number;
  avatarUrl?: string;
  isVerified: boolean;
  profileUrl: string;
  location?: string;
  socialLinks?: string[];
}

type SocialProfile = TikTokProfile | InstagramProfile | XProfile | FacebookProfile | LinkedInProfile | YouTubeProfile;

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
      if (!await this.ensureApiKey()) return null;

      const cleanHandle = handle.replace('@', '');
      const response = await this.client.get('/v1/twitter/profile', {
        params: { handle: cleanHandle }
      });
      const data = response.data?.data || response.data;
      if (data) {
        // Ensure username is populated from handle if API doesn't return it
        data.username = data.username || data.screen_name || cleanHandle;
      }
      return data;
    } catch (error: any) {
      logger.error(`X profile fetch failed for ${handle}:`, error.response?.data || error.message);
      return null;
    }
  }

  async getFacebookProfile(handle: string): Promise<FacebookProfile | null> {
    try {
      if (!await this.ensureApiKey()) return null;

      // API requires full URL, not just handle
      const url = `https://www.facebook.com/${handle}`;
      const response = await this.client.get('/v1/facebook/profile', {
        params: { url }
      });
      const data = response.data?.data || response.data;
      if (data) {
        // Add username from handle since API may not return it
        data.username = data.username || handle;
      }
      return data;
    } catch (error: any) {
      logger.error(`Facebook profile fetch failed for ${handle}:`, error.response?.data || error.message);
      return null;
    }
  }

  async getLinkedInProfile(handleOrUrl: string): Promise<LinkedInProfile | null> {
    try {
      if (!await this.ensureApiKey()) return null;

      let url: string;
      let endpoint: string;
      let cleanHandle: string;

      // Check if it's a full URL or just a handle
      if (handleOrUrl.includes('linkedin.com/')) {
        // It's a full URL - use it directly
        url = handleOrUrl;
        if (url.includes('/company/')) {
          endpoint = '/v1/linkedin/company';
          cleanHandle = url.split('/company/')[1]?.split(/[/?#]/)[0] || '';
        } else {
          endpoint = '/v1/linkedin/profile';
          cleanHandle = url.split('/in/')[1]?.split(/[/?#]/)[0] || '';
        }
        logger.info(`Fetching LinkedIn via ${endpoint}: ${url}`);
      } else if (handleOrUrl.startsWith('company:')) {
        // Legacy format: company:companyname
        cleanHandle = handleOrUrl.replace('company:', '');
        url = `https://www.linkedin.com/company/${cleanHandle}`;
        endpoint = '/v1/linkedin/company';
        logger.info(`Fetching LinkedIn company page: ${url}`);
      } else {
        // Legacy format: just a username
        cleanHandle = handleOrUrl;
        url = `https://www.linkedin.com/in/${handleOrUrl}`;
        endpoint = '/v1/linkedin/profile';
        logger.info(`Fetching LinkedIn profile: ${url}`);
      }

      logger.info(`Making API request to ${endpoint} with url param: ${url}`);
      const response = await this.client.get(endpoint, {
        params: { url }
      });
      logger.info(`API response status: ${response.status}, data keys: ${Object.keys(response.data || {}).join(', ')}`);

      const data = response.data?.data || response.data;
      if (!data || (data.success === false)) {
        logger.warn(`API returned no data or error for ${url}: ${JSON.stringify(response.data)}`);
        return null;
      }
      if (data) {
        // Add public_identifier from handle since API doesn't return it
        data.public_identifier = cleanHandle;
      }
      return data;
    } catch (error: any) {
      logger.error(`LinkedIn profile fetch failed for ${handleOrUrl}:`, error.response?.data || error.message);
      return null;
    }
  }

  async getYouTubeChannel(handle: string): Promise<YouTubeChannel | null> {
    try {
      if (!await this.ensureApiKey()) return null;

      // Clean handle - remove @ if present
      const cleanHandle = handle.replace('@', '');

      const response = await this.client.get('/v1/youtube/channel', {
        params: { handle: cleanHandle }
      });

      const data = response.data;
      if (!data || !data.channelId) {
        logger.warn(`No YouTube channel data for ${handle}`);
        return null;
      }

      return data;
    } catch (error: any) {
      logger.error(`YouTube channel fetch failed for ${handle}:`, error.response?.data || error.message);
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

  // Atomically claim an item for processing - returns true if claimed, false if already taken
  async claimItem(id: string): Promise<boolean> {
    const result = await db.socialSyncQueue.updateMany({
      where: {
        id,
        status: 'PENDING', // Only claim if still pending
      },
      data: {
        processedAt: new Date(), // Mark as being processed
      }
    });
    return result.count > 0;
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
        // Atomically claim item - skip if another process already took it
        const claimed = await this.claimItem(item.id);
        if (!claimed) {
          console.log(`⏭️ [${platform}] Skipping @${item.username} - already being processed`);
          continue;
        }

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
      case 'YOUTUBE':
        return this.getYouTubeProfile(username);
      default:
        return null;
    }
  }

  /**
   * Fetch YouTube channel and convert to YouTubeProfile format
   */
  private async getYouTubeProfile(handle: string): Promise<YouTubeProfile | null> {
    const channel = await this.getYouTubeChannel(handle);
    if (!channel) return null;

    // Get avatar URL from nested structure (prefer largest/first source)
    let avatarUrl: string | undefined;
    if (channel.avatar?.image?.sources && channel.avatar.image.sources.length > 0) {
      // Sort by width descending to get largest
      const sorted = [...channel.avatar.image.sources].sort((a, b) => b.width - a.width);
      avatarUrl = sorted[0]?.url;
    }

    // Extract social links from API response
    const socialLinks: string[] = [];
    if (channel.twitter) socialLinks.push(`https://twitter.com/${channel.twitter}`);
    if (channel.instagram) socialLinks.push(`https://instagram.com/${channel.instagram}`);
    if (channel.tiktok) socialLinks.push(`https://tiktok.com/@${channel.tiktok}`);
    if (channel.linkedin) socialLinks.push(`https://linkedin.com/in/${channel.linkedin}`);
    if (channel.links && Array.isArray(channel.links)) {
      socialLinks.push(...channel.links);
    }

    return {
      username: channel.channel || handle,
      displayName: channel.name || handle,
      bio: channel.description || '',
      followers: channel.subscriberCount || 0,
      avatarUrl,
      isVerified: false,
      profileUrl: `https://www.youtube.com/@${channel.channel || handle}`,
      location: channel.country || undefined,
      socialLinks: socialLinks.length > 0 ? socialLinks : undefined,
    };
  }

  private async upsertStreamer(platform: Platform, profile: SocialProfile, sourceStreamerId?: string): Promise<void> {
    const data = this.mapProfileToStreamer(platform, profile);

    // Skip if no username (API returned incomplete data)
    if (!data.username) {
      logger.warn(`Skipping ${platform} profile - no username in API response`);
      return;
    }

    // Upload avatar to Bunny CDN (platform CDN URLs expire)
    if (data.avatarUrl) {
      try {
        if (platform === 'INSTAGRAM') {
          data.avatarUrl = await bunnyService.uploadInstagramAvatar(data.username, data.avatarUrl);
        } else if (platform === 'TIKTOK') {
          data.avatarUrl = await bunnyService.uploadTikTokAvatar(data.username, data.avatarUrl);
        } else if (platform === 'LINKEDIN') {
          data.avatarUrl = await bunnyService.uploadLinkedInAvatar(data.username, data.avatarUrl);
        } else if (platform === 'FACEBOOK') {
          data.avatarUrl = await bunnyService.uploadFacebookAvatar(data.username, data.avatarUrl);
        } else if (platform === 'X') {
          data.avatarUrl = await bunnyService.uploadXAvatar(data.username, data.avatarUrl);
        } else if (platform === 'YOUTUBE') {
          data.avatarUrl = await bunnyService.uploadYouTubeAvatar(data.username, data.avatarUrl);
        }
      } catch (error: any) {
        logger.warn(`Failed to upload avatar to Bunny CDN for ${platform}/${data.username}: ${error.message}`);
        // Continue with original URL if upload fails
      }
    }

    // Extract social links from profile description/bio
    const extractedHandles = this.extractHandlesFromContent(data.profileDescription || '');
    const discoveredLinks: string[] = [];

    if (extractedHandles.tiktok && platform !== 'TIKTOK') {
      discoveredLinks.push(`https://tiktok.com/@${extractedHandles.tiktok}`);
    }
    if (extractedHandles.instagram && platform !== 'INSTAGRAM') {
      discoveredLinks.push(`https://instagram.com/${extractedHandles.instagram}`);
    }
    if (extractedHandles.x && platform !== 'X') {
      discoveredLinks.push(`https://x.com/${extractedHandles.x}`);
    }
    if (extractedHandles.facebook && platform !== 'FACEBOOK') {
      discoveredLinks.push(`https://facebook.com/${extractedHandles.facebook}`);
    }
    if (extractedHandles.linkedin && platform !== 'LINKEDIN') {
      discoveredLinks.push(`https://linkedin.com/in/${extractedHandles.linkedin}`);
    }
    if (extractedHandles.twitch && platform !== 'TWITCH') {
      discoveredLinks.push(`https://twitch.tv/${extractedHandles.twitch}`);
    }
    if (extractedHandles.youtube && platform !== 'YOUTUBE') {
      discoveredLinks.push(`https://youtube.com/@${extractedHandles.youtube}`);
    }

    // Merge socialLinks from API (e.g. YouTube) with discovered links from bio
    const apiLinks = (data.socialLinks as string[]) || [];
    const allLinks = [...new Set([...apiLinks, ...discoveredLinks])]; // dedupe

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
        region: data.region || Region.WORLDWIDE,
        lastScrapedAt: new Date(),
        socialLinks: allLinks.length > 0 ? allLinks : undefined,
      },
      update: {
        ...data,
        lastScrapedAt: new Date(),
        ...(allLinks.length > 0 && {
          socialLinks: allLinks,
        }),
      }
    });

    // Log discovered links
    if (allLinks.length > 0) {
      logger.info(`🔗 [${platform}] ${allLinks.length} social links for @${data.username} (${apiLinks.length} from API, ${discoveredLinks.length} from bio)`);
    }

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
        // Handle nested API structure: avatar.image_url, core.name, legacy.followers_count
        const avatarUrl = p.avatar?.image_url || p.legacy?.profile_image_url_https || p.profile_image_url;
        // Get higher resolution by replacing _normal with _400x400
        const highResAvatar = avatarUrl?.replace('_normal.', '_400x400.');
        // Get location from API response (API returns nested: data.location.location or data.legacy.location)
        const location = p.legacy?.location || (p.location as any)?.location || '';
        return {
          username: p.username || p.core?.screen_name || p.legacy?.screen_name || '',
          displayName: p.name || p.core?.name || p.legacy?.name || p.username || '',
          profileUrl: `https://x.com/${p.username || p.core?.screen_name || p.legacy?.screen_name}`,
          avatarUrl: highResAvatar,
          followers: p.followers_count || p.legacy?.followers_count || 0,
          profileDescription: p.description || p.legacy?.description,
          region: this.mapLocationToRegion(location),
        };
      }
      case 'FACEBOOK': {
        const p = profile as FacebookProfile;
        // Extract username from URL if not provided (e.g., https://facebook.com/username)
        const urlUsername = p.url?.match(/facebook\.com\/([^/?]+)/)?.[1];
        return {
          username: p.username || urlUsername || p.id,
          displayName: p.name || p.username || urlUsername || p.id || '',
          profileUrl: p.url || `https://facebook.com/${p.username || p.id}`,
          avatarUrl: p.profilePicLarge || p.profilePicMedium || p.profilePicSmall,
          followers: p.followerCount || 0,
          totalLikes: BigInt(p.likeCount || 0),
          profileDescription: p.pageIntro || p.about,
        };
      }
      case 'LINKEDIN': {
        const p = profile as LinkedInProfile;
        // Build description with location if available
        const locationStr = p.city && p.country ? `${p.city}, ${p.country}` :
                           p.location || p.geo_location || '';
        const headline = p.headline || p.about || '';
        const description = locationStr ? `${headline} | ${locationStr}` : headline;

        return {
          username: p.public_identifier,
          displayName: p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
          profileUrl: `https://linkedin.com/in/${p.public_identifier}`,
          avatarUrl: p.image,
          followers: p.followers || p.follower_count || 0,
          profileDescription: description,
          region: this.mapLocationToRegion(p.location || p.geo_location, p.country, p.country_code),
        };
      }
      case 'YOUTUBE': {
        const p = profile as YouTubeProfile;
        return {
          username: p.username,
          displayName: p.displayName,
          profileUrl: p.profileUrl,
          avatarUrl: p.avatarUrl,
          followers: p.followers || 0,
          profileDescription: p.bio,
          region: this.mapLocationToRegion(p.location),
          socialLinks: p.socialLinks,
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

  /**
   * Map LinkedIn location string to Region enum
   */
  private mapLocationToRegion(location?: string | object, country?: string | object, countryCode?: string | object): Region {
    // Priority: country_code > country > location parsing
    // Handle cases where values might be objects instead of strings
    const toString = (val: unknown): string => {
      if (!val) return '';
      if (typeof val === 'string') return val;
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    };
    const code = toString(countryCode).toUpperCase();
    const countryStr = toString(country || location).toLowerCase();

    // Country code mapping
    const codeMap: Record<string, Region> = {
      'US': Region.USA, 'USA': Region.USA,
      'CA': Region.CANADA, 'CAN': Region.CANADA,
      'MX': Region.MEXICO, 'MEX': Region.MEXICO,
      'GB': Region.UK, 'UK': Region.UK, 'GBR': Region.UK,
      'ES': Region.SPAIN, 'ESP': Region.SPAIN,
      'DE': Region.GERMANY, 'DEU': Region.GERMANY,
      'FR': Region.FRANCE, 'FRA': Region.FRANCE,
      'IT': Region.ITALY, 'ITA': Region.ITALY,
      'PT': Region.PORTUGAL, 'PRT': Region.PORTUGAL,
      'NL': Region.NETHERLANDS, 'NLD': Region.NETHERLANDS,
      'SE': Region.SWEDEN, 'SWE': Region.SWEDEN,
      'NO': Region.NORWAY, 'NOR': Region.NORWAY,
      'DK': Region.DENMARK, 'DNK': Region.DENMARK,
      'FI': Region.FINLAND, 'FIN': Region.FINLAND,
      'PL': Region.POLAND, 'POL': Region.POLAND,
      'RU': Region.RUSSIA, 'RUS': Region.RUSSIA,
      'JP': Region.JAPAN, 'JPN': Region.JAPAN,
      'KR': Region.KOREA, 'KOR': Region.KOREA,
      'CN': Region.CHINA, 'CHN': Region.CHINA,
      'IN': Region.INDIA, 'IND': Region.INDIA,
      'ID': Region.INDONESIA, 'IDN': Region.INDONESIA,
      'PH': Region.PHILIPPINES, 'PHL': Region.PHILIPPINES,
      'TH': Region.THAILAND, 'THA': Region.THAILAND,
      'VN': Region.VIETNAM, 'VNM': Region.VIETNAM,
      'MY': Region.MALAYSIA, 'MYS': Region.MALAYSIA,
      'SG': Region.SINGAPORE, 'SGP': Region.SINGAPORE,
      'AU': Region.AUSTRALIA, 'AUS': Region.AUSTRALIA,
      'NZ': Region.NEW_ZEALAND, 'NZL': Region.NEW_ZEALAND,
      'BR': Region.BRAZIL, 'BRA': Region.BRAZIL,
      'CO': Region.COLOMBIA, 'COL': Region.COLOMBIA,
      'AR': Region.ARGENTINA, 'ARG': Region.ARGENTINA,
      'CL': Region.CHILE, 'CHL': Region.CHILE,
      'PE': Region.PERU, 'PER': Region.PERU,
      'VE': Region.VENEZUELA, 'VEN': Region.VENEZUELA,
      'EC': Region.ECUADOR, 'ECU': Region.ECUADOR,
      'DO': Region.DOMINICAN_REPUBLIC, 'DOM': Region.DOMINICAN_REPUBLIC,
      'PR': Region.PUERTO_RICO, 'PRI': Region.PUERTO_RICO,
      'UY': Region.URUGUAY, 'URY': Region.URUGUAY,
      'PA': Region.PANAMA, 'PAN': Region.PANAMA,
      'CR': Region.COSTA_RICA, 'CRI': Region.COSTA_RICA,
      'GT': Region.GUATEMALA, 'GTM': Region.GUATEMALA,
      'SV': Region.EL_SALVADOR, 'SLV': Region.EL_SALVADOR,
      'HN': Region.HONDURAS, 'HND': Region.HONDURAS,
      'NI': Region.NICARAGUA, 'NIC': Region.NICARAGUA,
      'BO': Region.BOLIVIA, 'BOL': Region.BOLIVIA,
      'PY': Region.PARAGUAY, 'PRY': Region.PARAGUAY,
    };

    if (code && codeMap[code]) {
      return codeMap[code];
    }

    // Country name mapping (partial match)
    const nameMap: Array<[string[], Region]> = [
      [['united states', 'usa', 'u.s.', 'u.s.a', 'california', 'new york', 'texas', 'florida', 'san francisco', 'los angeles', 'seattle', 'chicago', 'boston', 'austin', 'denver', 'atlanta', 'estados unidos'], Region.USA],
      [['canada', 'toronto', 'vancouver', 'montreal', 'ottawa', 'calgary', 'edmonton', 'winnipeg', 'quebec', 'québec', 'ontario', 'alberta', 'british columbia', 'laval'], Region.CANADA],
      [['united kingdom', 'uk', 'england', 'london', 'scotland', 'wales', 'reino unido', 'inglaterra', 'manchester', 'birmingham', 'liverpool', 'leeds'], Region.UK],
      [['spain', 'españa', 'espanha', 'madrid', 'barcelona', 'valencia', 'sevilla', 'malaga', 'bilbao', 'santander', 'catalonia', 'catalunya', 'andalucia', 'comunidad de madrid', 'galicia'], Region.SPAIN],
      [['germany', 'deutschland', 'berlin', 'berlim', 'munich', 'münchen', 'frankfurt', 'hamburg', 'alemanha', 'alemania'], Region.GERMANY],
      [['france', 'francia', 'frança', 'paris', 'lyon', 'marseille', 'toulouse', 'nice'], Region.FRANCE],
      [['italy', 'italia', 'rome', 'milan', 'milano'], Region.ITALY],
      [['netherlands', 'holland', 'amsterdam'], Region.NETHERLANDS],
      [['sweden', 'stockholm'], Region.SWEDEN],
      [['norway', 'oslo'], Region.NORWAY],
      [['denmark', 'copenhagen'], Region.DENMARK],
      [['finland', 'helsinki'], Region.FINLAND],
      [['poland', 'warsaw'], Region.POLAND],
      [['russia', 'moscow'], Region.RUSSIA],
      [['japan', 'tokyo', 'osaka'], Region.JAPAN],
      [['korea', 'south korea', 'seoul'], Region.KOREA],
      [['china', 'beijing', 'shanghai', 'shenzhen'], Region.CHINA],
      [['india', 'mumbai', 'bangalore', 'delhi', 'hyderabad'], Region.INDIA],
      [['indonesia', 'jakarta'], Region.INDONESIA],
      [['philippines', 'manila'], Region.PHILIPPINES],
      [['thailand', 'bangkok'], Region.THAILAND],
      [['vietnam', 'ho chi minh', 'hanoi'], Region.VIETNAM],
      [['malaysia', 'kuala lumpur'], Region.MALAYSIA],
      [['singapore'], Region.SINGAPORE],
      [['australia', 'sydney', 'melbourne', 'brisbane'], Region.AUSTRALIA],
      [['new zealand', 'auckland', 'wellington'], Region.NEW_ZEALAND],
      [['brazil', 'brasil', 'são paulo', 'rio de janeiro'], Region.BRAZIL],
      [['mexico', 'méxico', 'mexico city'], Region.MEXICO],
      [['colombia', 'bogota', 'bogotá', 'medellin', 'medellín'], Region.COLOMBIA],
      [['argentina', 'buenos aires'], Region.ARGENTINA],
      [['chile', 'santiago'], Region.CHILE],
      [['peru', 'lima'], Region.PERU],
      [['venezuela', 'caracas'], Region.VENEZUELA],
      [['ecuador', 'quito', 'guayaquil'], Region.ECUADOR],
      [['dominican republic', 'santo domingo', 'república dominicana', 'punta cana'], Region.DOMINICAN_REPUBLIC],
      [['puerto rico', 'san juan'], Region.PUERTO_RICO],
      [['uruguay', 'montevideo'], Region.URUGUAY],
      [['panama', 'panamá'], Region.PANAMA],
      [['costa rica', 'san josé'], Region.COSTA_RICA],
      [['guatemala'], Region.GUATEMALA],
      [['el salvador', 'san salvador'], Region.EL_SALVADOR],
      [['honduras', 'tegucigalpa'], Region.HONDURAS],
      [['nicaragua', 'managua'], Region.NICARAGUA],
      [['bolivia', 'la paz'], Region.BOLIVIA],
      [['paraguay', 'asunción', 'asuncion'], Region.PARAGUAY],
      [['portugal', 'lisbon', 'porto'], Region.PORTUGAL],
    ];

    for (const [keywords, region] of nameMap) {
      if (keywords.some(kw => countryStr.includes(kw))) {
        return region;
      }
    }

    return Region.WORLDWIDE;
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
    twitch?: string;
    youtube?: string;
  } {
    const handles: any = {};

    // TikTok patterns
    const tiktokMatch = content.match(/tiktok\.com\/@?([a-zA-Z0-9_.]+)/i) ||
                        content.match(/(?:tiktok)[:\s]*@?([a-zA-Z0-9_.]+)/i);
    if (tiktokMatch) handles.tiktok = tiktokMatch[1].replace('@', '');

    // Instagram patterns
    const instaMatch = content.match(/instagram\.com\/([a-zA-Z0-9_.]+)/i) ||
                       content.match(/(?:ig|insta|instagram)[:\s]*@?([a-zA-Z0-9_.]+)/i);
    if (instaMatch) handles.instagram = instaMatch[1].replace('@', '');

    // X/Twitter patterns
    const xMatch = content.match(/(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/i) ||
                   content.match(/(?:twitter)[:\s]*@?([a-zA-Z0-9_]+)/i);
    if (xMatch) handles.x = xMatch[1].replace('@', '');

    // Facebook patterns
    const fbMatch = content.match(/facebook\.com\/([a-zA-Z0-9_.]+)/i) ||
                    content.match(/fb\.com\/([a-zA-Z0-9_.]+)/i);
    if (fbMatch) handles.facebook = fbMatch[1];

    // LinkedIn patterns
    const linkedinMatch = content.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i);
    if (linkedinMatch) handles.linkedin = linkedinMatch[1];

    // Twitch patterns
    const twitchMatch = content.match(/twitch\.tv\/([a-zA-Z0-9_]+)/i) ||
                        content.match(/(?:twitch)[:\s]*@?([a-zA-Z0-9_]+)/i);
    if (twitchMatch) handles.twitch = twitchMatch[1].replace('@', '');

    // YouTube patterns
    const ytMatch = content.match(/youtube\.com\/@([a-zA-Z0-9_-]+)/i) ||
                    content.match(/youtube\.com\/(?:c|channel|user)\/([a-zA-Z0-9_-]+)/i) ||
                    content.match(/(?:youtube|yt)[:\s]*@?([a-zA-Z0-9_-]+)/i);
    if (ytMatch) handles.youtube = ytMatch[1].replace('@', '');

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
