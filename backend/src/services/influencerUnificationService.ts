import { db, logger } from '../utils/database';
import { Platform } from '@prisma/client';

interface StreamerData {
  id: string;
  platform: Platform;
  username: string;
  displayName: string;
  followers: number;
  avatarUrl: string | null;
  profileUrl: string;
  language: string;
  region: string;
  tags: string[];
  socialLinks: any;
  primaryCategory: string | null;
}

interface UnifiedInfluencer {
  displayName: string;
  country: string | null;
  language: string | null;
  primaryCategory: string | null;
  tags: string[];
  sourceStreamerIds: string[];

  // Platform-specific data
  twitch?: PlatformData;
  youtube?: PlatformData;
  kick?: PlatformData;
  tiktok?: PlatformData;
  instagram?: PlatformData;
  x?: PlatformData;
  facebook?: PlatformData;
  linkedin?: PlatformData;
}

interface PlatformData {
  id: string;
  username: string;
  displayName: string;
  followers: number;
  avatar: string | null;
  url: string;
  verified: boolean;
}

export class InfluencerUnificationService {

  /**
   * Unify all existing streamers into Influencer profiles
   * Groups by: same person across platforms
   */
  async unifyAllStreamers(): Promise<{
    created: number;
    updated: number;
    errors: number;
  }> {
    console.log('🔗 Starting influencer unification...');

    let created = 0;
    let updated = 0;
    let errors = 0;

    // Step 1: Get all streamers grouped by base platforms (Twitch, YouTube, Kick)
    const baseStreamers = await db.streamer.findMany({
      where: {
        platform: { in: ['TWITCH', 'YOUTUBE', 'KICK'] }
      },
      orderBy: { followers: 'desc' },
    });

    console.log(`📊 Found ${baseStreamers.length} base streamers (Twitch/YouTube/Kick)`);

    // Step 2: Get all social platform streamers
    const socialStreamers = await db.streamer.findMany({
      where: {
        platform: { in: ['TIKTOK', 'INSTAGRAM', 'X', 'FACEBOOK', 'LINKEDIN'] }
      },
    });

    console.log(`📊 Found ${socialStreamers.length} social streamers (TikTok/Instagram/X/etc)`);

    // Create lookup maps for social streamers
    const socialByUsername = new Map<string, StreamerData[]>();
    for (const s of socialStreamers) {
      const key = s.username.toLowerCase();
      if (!socialByUsername.has(key)) {
        socialByUsername.set(key, []);
      }
      socialByUsername.get(key)!.push(s as StreamerData);
    }

    // Step 3: Process each base streamer
    for (const streamer of baseStreamers) {
      try {
        const unified = await this.buildUnifiedProfile(streamer as StreamerData, socialByUsername);

        if (unified) {
          const result = await this.upsertInfluencer(unified);
          if (result === 'created') created++;
          else if (result === 'updated') updated++;
        }
      } catch (error: any) {
        logger.error(`Failed to unify ${streamer.username}:`, error.message);
        errors++;
      }
    }

    // Step 4: Handle orphan social streamers (those not linked to any base streamer)
    const processedIds = new Set<string>();
    const influencers = await db.influencer.findMany({
      select: { sourceStreamerIds: true }
    });
    for (const inf of influencers) {
      for (const id of inf.sourceStreamerIds) {
        processedIds.add(id);
      }
    }

    for (const social of socialStreamers) {
      if (!processedIds.has(social.id)) {
        try {
          const unified = this.createStandaloneInfluencer(social as StreamerData);
          const result = await this.upsertInfluencer(unified);
          if (result === 'created') created++;
          else if (result === 'updated') updated++;
        } catch (error: any) {
          errors++;
        }
      }
    }

    console.log(`\n✅ Unification complete!`);
    console.log(`   Created: ${created}, Updated: ${updated}, Errors: ${errors}`);

    return { created, updated, errors };
  }

  /**
   * Build a unified profile from a base streamer + matched social accounts
   */
  private async buildUnifiedProfile(
    baseStreamer: StreamerData,
    socialByUsername: Map<string, StreamerData[]>
  ): Promise<UnifiedInfluencer | null> {
    const unified: UnifiedInfluencer = {
      displayName: baseStreamer.displayName,
      country: this.regionToCountry(baseStreamer.region),
      language: baseStreamer.language,
      primaryCategory: baseStreamer.primaryCategory,
      tags: baseStreamer.tags || [],
      sourceStreamerIds: [baseStreamer.id],
    };

    // Add base platform data
    this.addPlatformData(unified, baseStreamer);

    // Try to find matching social accounts
    const possibleMatches = [
      baseStreamer.username.toLowerCase(),
      baseStreamer.displayName.toLowerCase().replace(/\s+/g, ''),
    ];

    for (const key of possibleMatches) {
      const matches = socialByUsername.get(key);
      if (matches) {
        for (const match of matches) {
          this.addPlatformData(unified, match);
          unified.sourceStreamerIds.push(match.id);
        }
      }
    }

    // Also check socialLinks for explicit links
    const socialLinks = (baseStreamer.socialLinks as string[]) || [];
    for (const link of socialLinks) {
      const parsed = this.parseSocialLink(link);
      if (parsed) {
        const matches = socialByUsername.get(parsed.username.toLowerCase());
        if (matches) {
          const match = matches.find(m => m.platform === parsed.platform);
          if (match && !unified.sourceStreamerIds.includes(match.id)) {
            this.addPlatformData(unified, match);
            unified.sourceStreamerIds.push(match.id);
          }
        }
      }
    }

    return unified;
  }

  private createStandaloneInfluencer(streamer: StreamerData): UnifiedInfluencer {
    const unified: UnifiedInfluencer = {
      displayName: streamer.displayName,
      country: this.regionToCountry(streamer.region),
      language: streamer.language,
      primaryCategory: streamer.primaryCategory,
      tags: streamer.tags || [],
      sourceStreamerIds: [streamer.id],
    };

    this.addPlatformData(unified, streamer);
    return unified;
  }

  private addPlatformData(unified: UnifiedInfluencer, streamer: StreamerData): void {
    const data: PlatformData = {
      id: streamer.id,
      username: streamer.username,
      displayName: streamer.displayName,
      followers: streamer.followers,
      avatar: streamer.avatarUrl,
      url: streamer.profileUrl,
      verified: false, // Can be enriched later
    };

    switch (streamer.platform) {
      case 'TWITCH': unified.twitch = data; break;
      case 'YOUTUBE': unified.youtube = data; break;
      case 'KICK': unified.kick = data; break;
      case 'TIKTOK': unified.tiktok = data; break;
      case 'INSTAGRAM': unified.instagram = data; break;
      case 'X': unified.x = data; break;
      case 'FACEBOOK': unified.facebook = data; break;
      case 'LINKEDIN': unified.linkedin = data; break;
    }
  }

  private async upsertInfluencer(unified: UnifiedInfluencer): Promise<'created' | 'updated'> {
    // Calculate aggregated metrics
    const platforms = [
      unified.twitch,
      unified.youtube,
      unified.kick,
      unified.tiktok,
      unified.instagram,
      unified.x,
      unified.facebook,
      unified.linkedin,
    ].filter(Boolean);

    const totalReach = platforms.reduce((sum, p) => sum + (p?.followers || 0), 0);
    const platformCount = platforms.length;

    // Find best avatar (prefer verified or highest followers)
    const bestAvatar = platforms
      .sort((a, b) => (b?.followers || 0) - (a?.followers || 0))
      .find(p => p?.avatar)?.avatar;

    // Check if already exists
    const existing = await db.influencer.findFirst({
      where: {
        OR: [
          unified.twitch ? { twitchId: unified.twitch.id } : {},
          unified.youtube ? { youtubeId: unified.youtube.id } : {},
          unified.kick ? { kickId: unified.kick.id } : {},
        ].filter(o => Object.keys(o).length > 0)
      }
    });

    const data = {
      displayName: unified.displayName,
      country: unified.country,
      language: unified.language,
      primaryCategory: unified.primaryCategory,
      tags: unified.tags,
      sourceStreamerIds: unified.sourceStreamerIds,

      // Twitch
      twitchId: unified.twitch?.id,
      twitchUsername: unified.twitch?.username,
      twitchDisplayName: unified.twitch?.displayName,
      twitchFollowers: unified.twitch?.followers,
      twitchAvatar: unified.twitch?.avatar,
      twitchUrl: unified.twitch?.url,
      twitchVerified: unified.twitch?.verified || false,

      // YouTube
      youtubeId: unified.youtube?.id,
      youtubeUsername: unified.youtube?.username,
      youtubeDisplayName: unified.youtube?.displayName,
      youtubeFollowers: unified.youtube?.followers,
      youtubeAvatar: unified.youtube?.avatar,
      youtubeUrl: unified.youtube?.url,
      youtubeVerified: unified.youtube?.verified || false,

      // Kick
      kickId: unified.kick?.id,
      kickUsername: unified.kick?.username,
      kickDisplayName: unified.kick?.displayName,
      kickFollowers: unified.kick?.followers,
      kickAvatar: unified.kick?.avatar,
      kickUrl: unified.kick?.url,
      kickVerified: unified.kick?.verified || false,

      // TikTok
      tiktokId: unified.tiktok?.id,
      tiktokUsername: unified.tiktok?.username,
      tiktokDisplayName: unified.tiktok?.displayName,
      tiktokFollowers: unified.tiktok?.followers,
      tiktokAvatar: unified.tiktok?.avatar,
      tiktokUrl: unified.tiktok?.url,
      tiktokVerified: unified.tiktok?.verified || false,

      // Instagram
      instagramId: unified.instagram?.id,
      instagramUsername: unified.instagram?.username,
      instagramDisplayName: unified.instagram?.displayName,
      instagramFollowers: unified.instagram?.followers,
      instagramAvatar: unified.instagram?.avatar,
      instagramUrl: unified.instagram?.url,
      instagramVerified: unified.instagram?.verified || false,

      // X
      xId: unified.x?.id,
      xUsername: unified.x?.username,
      xDisplayName: unified.x?.displayName,
      xFollowers: unified.x?.followers,
      xAvatar: unified.x?.avatar,
      xUrl: unified.x?.url,
      xVerified: unified.x?.verified || false,

      // Facebook
      facebookId: unified.facebook?.id,
      facebookUsername: unified.facebook?.username,
      facebookDisplayName: unified.facebook?.displayName,
      facebookFollowers: unified.facebook?.followers,
      facebookAvatar: unified.facebook?.avatar,
      facebookUrl: unified.facebook?.url,
      facebookVerified: unified.facebook?.verified || false,

      // LinkedIn
      linkedinId: unified.linkedin?.id,
      linkedinUsername: unified.linkedin?.username,
      linkedinDisplayName: unified.linkedin?.displayName,
      linkedinFollowers: unified.linkedin?.followers,
      linkedinAvatar: unified.linkedin?.avatar,
      linkedinUrl: unified.linkedin?.url,
      linkedinVerified: unified.linkedin?.verified || false,

      // Aggregated
      totalReach: BigInt(totalReach),
      platformCount,
      lastVerifiedAt: new Date(),
    };

    if (existing) {
      await db.influencer.update({
        where: { id: existing.id },
        data,
      });
      return 'updated';
    } else {
      await db.influencer.create({
        data: {
          ...data,
          id: undefined, // Let Prisma generate
        } as any,
      });
      return 'created';
    }
  }

  private regionToCountry(region: string): string | null {
    const regionMap: Record<string, string | null> = {
      'MEXICO': 'MX',
      'COLOMBIA': 'CO',
      'ARGENTINA': 'AR',
      'CHILE': 'CL',
      'PERU': 'PE',
      'VENEZUELA': 'VE',
      'ECUADOR': 'EC',
      'BRAZIL': 'BR',
      'USA': 'US',
      'CANADA': 'CA',
      'UK': 'GB',
      'SPAIN': 'ES',
      'GERMANY': 'DE',
      'FRANCE': 'FR',
      'JAPAN': 'JP',
      'KOREA': 'KR',
      'WORLDWIDE': null,
      'OTHER': null,
    };
    return regionMap[region] ?? null;
  }

  private parseSocialLink(url: string): { platform: Platform; username: string } | null {
    const patterns: { pattern: RegExp; platform: Platform }[] = [
      { pattern: /tiktok\.com\/@?([a-zA-Z0-9_.]+)/i, platform: 'TIKTOK' },
      { pattern: /instagram\.com\/([a-zA-Z0-9_.]+)/i, platform: 'INSTAGRAM' },
      { pattern: /(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/i, platform: 'X' },
      { pattern: /facebook\.com\/([a-zA-Z0-9_.]+)/i, platform: 'FACEBOOK' },
      { pattern: /linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i, platform: 'LINKEDIN' },
    ];

    for (const { pattern, platform } of patterns) {
      const match = url.match(pattern);
      if (match) {
        return { platform, username: match[1] };
      }
    }
    return null;
  }

  /**
   * Get stats about the unified influencer table
   */
  async getStats(): Promise<{
    total: number;
    byPlatformCount: Record<number, number>;
    withTiktok: number;
    withInstagram: number;
    topByReach: any[];
  }> {
    const total = await db.influencer.count();

    const byPlatformCount: Record<number, number> = {};
    for (let i = 1; i <= 8; i++) {
      byPlatformCount[i] = await db.influencer.count({
        where: { platformCount: i }
      });
    }

    const withTiktok = await db.influencer.count({
      where: { tiktokUsername: { not: null } }
    });

    const withInstagram = await db.influencer.count({
      where: { instagramUsername: { not: null } }
    });

    const topByReach = await db.influencer.findMany({
      orderBy: { totalReach: 'desc' },
      take: 10,
      select: {
        displayName: true,
        totalReach: true,
        platformCount: true,
        twitchUsername: true,
        youtubeUsername: true,
        tiktokUsername: true,
        instagramUsername: true,
      }
    });

    return {
      total,
      byPlatformCount,
      withTiktok,
      withInstagram,
      topByReach,
    };
  }
}

export const influencerUnificationService = new InfluencerUnificationService();
