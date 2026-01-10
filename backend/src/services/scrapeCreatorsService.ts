import axios, { AxiosInstance } from 'axios';
import { db, logger } from '../utils/database';
import { Platform, Region } from '@prisma/client';

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

  constructor() {
    const apiKey = process.env.SCRAPECREATORS_API_KEY;

    if (!apiKey) {
      logger.warn('SCRAPECREATORS_API_KEY not configured');
    }

    this.client = axios.create({
      baseURL: this.BASE_URL,
      headers: {
        'x-api-key': apiKey || '',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  // ==================== PROFILE ENDPOINTS (1 credit each) ====================

  async getTikTokProfile(handle: string): Promise<TikTokProfile | null> {
    try {
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

  async getInstagramProfile(handle: string): Promise<InstagramProfile | null> {
    try {
      const response = await this.client.get('/v1/instagram/profile', {
        params: { handle: handle.replace('@', '') }
      });
      return response.data?.data || response.data;
    } catch (error: any) {
      logger.error(`Instagram profile fetch failed for ${handle}:`, error.response?.data || error.message);
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

    // If this was discovered from an existing streamer, link them in socialLinks
    if (sourceStreamerId) {
      await this.linkSocialProfile(sourceStreamerId, platform, data.username);
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
          totalViews: BigInt(hearts),
          totalLikes: BigInt(diggs),
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
