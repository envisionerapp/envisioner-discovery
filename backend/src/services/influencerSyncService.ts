import { db, logger } from '../utils/database';
import { Platform } from '@prisma/client';

interface ExternalInfluencer {
  id: number;
  influencer: string;
  clean_name: string;
  channel_url: string | null;
  thumbnail: string | null;
  subscribers: number | null;
  views: string | null;
  videos: number | null;
  stats_updated_at: string | null; // Used for lastSeenLive/lastScrapedAt
}

/**
 * Sync influencers from the external `influencers` table to `discovery_creators` (Streamer model)
 * This allows manually added influencers to appear in the discovery tool
 */
export class InfluencerSyncService {

  /**
   * Parse channel URL to extract platform and username
   */
  private parseChannelUrl(url: string): { platform: Platform; username: string } | null {
    if (!url) return null;

    const patterns: { pattern: RegExp; platform: Platform }[] = [
      // Streaming platforms
      { pattern: /twitch\.tv\/([a-zA-Z0-9_]+)/i, platform: 'TWITCH' },
      { pattern: /youtube\.com\/@?([a-zA-Z0-9_-]+)/i, platform: 'YOUTUBE' },
      { pattern: /youtu\.be\/([a-zA-Z0-9_-]+)/i, platform: 'YOUTUBE' },
      { pattern: /kick\.com\/([a-zA-Z0-9_]+)/i, platform: 'KICK' },
      // Social platforms
      { pattern: /tiktok\.com\/@?([a-zA-Z0-9_.]+)/i, platform: 'TIKTOK' },
      { pattern: /instagram\.com\/([a-zA-Z0-9_.]+)/i, platform: 'INSTAGRAM' },
      { pattern: /(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/i, platform: 'X' },
      { pattern: /facebook\.com\/([a-zA-Z0-9_.]+)/i, platform: 'FACEBOOK' },
      { pattern: /fb\.com\/([a-zA-Z0-9_.]+)/i, platform: 'FACEBOOK' },
      { pattern: /linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i, platform: 'LINKEDIN' },
      // Additional patterns
      { pattern: /vm\.tiktok\.com\/([a-zA-Z0-9_]+)/i, platform: 'TIKTOK' },
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
   * Sync all influencers from the external table to discovery_creators
   */
  async syncInfluencersToDiscovery(): Promise<{
    synced: number;
    skipped: number;
    errors: number;
  }> {
    logger.info('🔄 Starting sync from influencers table to discovery_creators...');

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    try {
      // Fetch all influencers from the external table
      // Note: The influencers table only has subscribers/views/videos - no platform-specific metrics
      // like avgViewers, peakViewers, totalLikes (those come from platform APIs)
      const influencers = await db.$queryRawUnsafe<ExternalInfluencer[]>(`
        SELECT id, influencer, clean_name, channel_url, thumbnail, subscribers,
               views::text as views, videos, stats_updated_at::text as stats_updated_at
        FROM influencers
        WHERE channel_url IS NOT NULL AND channel_url != ''
      `);

      logger.info(`📊 Found ${influencers.length} influencers with channel URLs`);

      for (const inf of influencers) {
        try {
          const parsed = this.parseChannelUrl(inf.channel_url || '');
          if (!parsed) {
            logger.warn(`⚠️ Could not parse channel URL: ${inf.channel_url}`);
            skipped++;
            continue;
          }

          const { platform, username } = parsed;

          // Check if already exists in discovery_creators
          const existing = await db.streamer.findFirst({
            where: {
              platform,
              username: { equals: username, mode: 'insensitive' },
            },
          });

          if (existing) {
            // Update with latest metrics from influencers table
            const updates: any = {};
            if (inf.thumbnail && inf.thumbnail !== existing.avatarUrl) {
              updates.avatarUrl = inf.thumbnail;
            }
            if (inf.subscribers && inf.subscribers !== existing.followers) {
              updates.followers = inf.subscribers;
            }
            if (inf.views) {
              const viewsBigInt = BigInt(inf.views);
              if (viewsBigInt !== existing.totalViews) {
                updates.totalViews = viewsBigInt;
              }
            }
            // Use stats_updated_at as proxy for last activity
            if (inf.stats_updated_at) {
              const statsDate = new Date(inf.stats_updated_at);
              if (!existing.lastSeenLive || statsDate > existing.lastSeenLive) {
                updates.lastSeenLive = statsDate;
                updates.lastScrapedAt = statsDate;
              }
            }

            if (Object.keys(updates).length > 0) {
              await db.streamer.update({
                where: { id: existing.id },
                data: updates,
              });
              logger.info(`📝 Updated ${username} on ${platform} with followers=${inf.subscribers}, views=${inf.views}`);
              synced++;
            } else {
              skipped++;
            }
            continue;
          }

          // Create new streamer record
          // Use stats_updated_at as proxy for last activity
          const lastActiveDate = inf.stats_updated_at ? new Date(inf.stats_updated_at) : null;

          await db.streamer.create({
            data: {
              platform,
              username: username.toLowerCase(),
              displayName: inf.influencer || inf.clean_name || username,
              avatarUrl: inf.thumbnail,
              profileUrl: inf.channel_url || '',
              followers: inf.subscribers || 0,
              totalViews: inf.views ? BigInt(inf.views) : BigInt(0),
              region: 'WORLDWIDE',
              language: 'es',
              isLive: false,
              currentViewers: 0,
              highestViewers: 0,
              tags: [],
              // Set last active dates from stats_updated_at
              lastSeenLive: lastActiveDate,
              lastScrapedAt: lastActiveDate,
            },
          });

          logger.info(`✅ Created ${username} on ${platform}`);
          synced++;

        } catch (error: any) {
          logger.error(`❌ Error syncing influencer ${inf.influencer}: ${error.message}`);
          errors++;
        }
      }

    } catch (error: any) {
      logger.error(`❌ Sync failed: ${error.message}`);
      throw error;
    }

    logger.info(`\n🔄 Sync complete! Synced: ${synced}, Skipped: ${skipped}, Errors: ${errors}`);
    return { synced, skipped, errors };
  }

  /**
   * Get count of influencers not yet in discovery
   */
  async getPendingSyncCount(): Promise<number> {
    const result = await db.$queryRawUnsafe<{ count: string }[]>(`
      SELECT COUNT(*) as count
      FROM influencers i
      WHERE i.channel_url IS NOT NULL
        AND i.channel_url != ''
        AND NOT EXISTS (
          SELECT 1 FROM "Streamer" s
          WHERE LOWER(s.username) = LOWER(i.clean_name)
        )
    `);
    return parseInt(result[0]?.count || '0', 10);
  }
}

export const influencerSyncService = new InfluencerSyncService();
