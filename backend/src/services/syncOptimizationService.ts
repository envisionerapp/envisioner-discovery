/**
 * Sync Optimization Service
 * Manages tiered sync frequency and API credit tracking for the discovery platform.
 *
 * Tier Strategy:
 * - HOT: Currently live OR >10k avg viewers - sync every 5 min
 * - ACTIVE: Posted in last 7 days OR >1k followers - sync every 30 min
 * - STANDARD: Posted in last 30 days - sync every 2 hours
 * - COLD: No activity 30+ days - sync every 24 hours
 */

import { db, logger } from '../utils/database';
import { SyncTier, Platform } from '@prisma/client';

// Tier thresholds
const TIER_CONFIG = {
  HOT: {
    minAvgViewers: 10000,
    syncIntervalMinutes: 5,
  },
  ACTIVE: {
    minFollowers: 1000,
    lastActivityDays: 7,
    syncIntervalMinutes: 30,
  },
  STANDARD: {
    lastActivityDays: 30,
    syncIntervalMinutes: 120, // 2 hours
  },
  COLD: {
    syncIntervalMinutes: 1440, // 24 hours
  },
};

// Credit budgets per provider (daily)
// DIRECT APIs (free/quota-based):
// - twitch: Twitch Helix API (free, ~1M calls/month limit)
// - youtube: YouTube Data API v3 (10k quota/day per key, we have 5 keys)
// - kick: Kick API (free, no hard limits)
//
// VIA SCRAPECREATORS (credit-based):
// - tiktok, instagram, x, facebook, linkedin all use ScrapeCreators credits
const DAILY_CREDIT_BUDGETS = {
  scrapecreators: 3300, // ~100k/month for TikTok, Instagram, X, Facebook, LinkedIn
  youtube: 10000,       // Direct API - 10k quota units/day
  twitch: 50000,        // Direct API - essentially free
  kick: 50000,          // Direct API - essentially free
};

export class SyncOptimizationService {
  private static instance: SyncOptimizationService;

  private constructor() {}

  static getInstance(): SyncOptimizationService {
    if (!SyncOptimizationService.instance) {
      SyncOptimizationService.instance = new SyncOptimizationService();
    }
    return SyncOptimizationService.instance;
  }

  /**
   * Calculate the appropriate sync tier for a streamer based on their activity
   */
  calculateTier(streamer: {
    isLive: boolean;
    avgViewers: number;
    followers: number;
    lastSeenLive?: Date | null;
    lastScrapedAt?: Date | null;
    updatedAt?: Date | null;
  }): SyncTier {
    const now = new Date();

    // HOT tier: Currently live OR >10k avg viewers
    if (streamer.isLive || streamer.avgViewers >= TIER_CONFIG.HOT.minAvgViewers) {
      return SyncTier.HOT;
    }

    // ACTIVE tier: Recent activity OR decent following
    const lastActivity = streamer.lastSeenLive || streamer.updatedAt;
    if (lastActivity) {
      const daysSinceActivity = (now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceActivity <= TIER_CONFIG.ACTIVE.lastActivityDays) {
        return SyncTier.ACTIVE;
      }
    }
    if (streamer.followers >= TIER_CONFIG.ACTIVE.minFollowers) {
      return SyncTier.ACTIVE;
    }

    // STANDARD tier: Some activity in last 30 days
    if (lastActivity) {
      const daysSinceActivity = (now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceActivity <= TIER_CONFIG.STANDARD.lastActivityDays) {
        return SyncTier.STANDARD;
      }
    }

    // COLD tier: No recent activity
    return SyncTier.COLD;
  }

  /**
   * Check if a streamer needs to be synced based on their tier
   */
  needsSync(streamer: {
    syncTier: SyncTier;
    lastScrapedAt?: Date | null;
    socialSyncedAt?: Date | null;
  }, syncType: 'platform' | 'social' = 'platform'): boolean {
    const lastSync = syncType === 'social' ? streamer.socialSyncedAt : streamer.lastScrapedAt;
    if (!lastSync) return true;

    const now = new Date();
    const minutesSinceSync = (now.getTime() - new Date(lastSync).getTime()) / (1000 * 60);
    const tierInterval = TIER_CONFIG[streamer.syncTier].syncIntervalMinutes;

    return minutesSinceSync >= tierInterval;
  }

  /**
   * Update all streamer tiers based on current activity
   * Run this daily or after significant data updates
   */
  async recalculateAllTiers(): Promise<{ updated: number; byTier: Record<SyncTier, number> }> {
    logger.info('Starting tier recalculation for all streamers');

    const streamers = await db.streamer.findMany({
      select: {
        id: true,
        isLive: true,
        avgViewers: true,
        followers: true,
        lastSeenLive: true,
        lastScrapedAt: true,
        updatedAt: true,
        syncTier: true,
      },
    });

    const tierCounts: Record<SyncTier, number> = {
      HOT: 0,
      ACTIVE: 0,
      STANDARD: 0,
      COLD: 0,
    };

    let updated = 0;

    for (const streamer of streamers) {
      const newTier = this.calculateTier(streamer);
      tierCounts[newTier]++;

      if (newTier !== streamer.syncTier) {
        await db.streamer.update({
          where: { id: streamer.id },
          data: { syncTier: newTier },
        });
        updated++;
      }
    }

    logger.info(`Tier recalculation complete: ${updated} streamers updated`, { tierCounts });

    return { updated, byTier: tierCounts };
  }

  /**
   * Get streamers that need syncing for a specific tier
   */
  async getStreamersNeedingSync(
    tier: SyncTier,
    syncType: 'platform' | 'social' = 'platform',
    limit: number = 100
  ): Promise<Array<{ id: string; username: string; platform: Platform }>> {
    const interval = TIER_CONFIG[tier].syncIntervalMinutes;
    const cutoff = new Date(Date.now() - interval * 60 * 1000);

    const where = syncType === 'social'
      ? {
          syncTier: tier,
          OR: [
            { socialSyncedAt: null },
            { socialSyncedAt: { lt: cutoff } },
          ],
        }
      : {
          syncTier: tier,
          OR: [
            { lastScrapedAt: null },
            { lastScrapedAt: { lt: cutoff } },
          ],
        };

    const streamers = await db.streamer.findMany({
      where,
      select: {
        id: true,
        username: true,
        platform: true,
      },
      take: limit,
      orderBy: syncType === 'social'
        ? { socialSyncedAt: 'asc' }
        : { lastScrapedAt: 'asc' },
    });

    return streamers;
  }

  /**
   * Track an API call for credit monitoring
   */
  async trackApiCall(
    provider: 'scrapecreators' | 'youtube' | 'twitch' | 'kick',
    endpoint: string | null = null,
    credits: number = 1,
    success: boolean = true,
    errorCode: string | null = null
  ): Promise<void> {
    try {
      await db.apiUsage.create({
        data: {
          provider,
          endpoint,
          creditsUsed: credits,
          project: 'discovery',
          success,
          errorCode,
        },
      });
    } catch (error) {
      // Don't let tracking failures break the main flow
      logger.error('API usage tracking failed', { error });
    }
  }

  /**
   * Get current daily credit usage
   */
  async getDailyUsage(provider?: string): Promise<{ total: number; byProvider: Record<string, number> }> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const usage = await db.apiUsage.groupBy({
      by: ['provider'],
      where: {
        recordedAt: { gte: oneDayAgo },
        ...(provider ? { provider } : {}),
      },
      _sum: {
        creditsUsed: true,
      },
    });

    const byProvider: Record<string, number> = {};
    let total = 0;

    for (const row of usage) {
      const credits = row._sum.creditsUsed || 0;
      byProvider[row.provider] = credits;
      total += credits;
    }

    return { total, byProvider };
  }

  /**
   * Check if we have budget remaining for a provider
   */
  async hasBudget(provider: 'scrapecreators' | 'youtube' | 'twitch' | 'kick'): Promise<boolean> {
    const { byProvider } = await this.getDailyUsage(provider);
    const used = byProvider[provider] || 0;
    const budget = DAILY_CREDIT_BUDGETS[provider] || Infinity;
    return used < budget;
  }

  /**
   * Get sync statistics for monitoring
   */
  async getSyncStats(): Promise<{
    tierDistribution: Record<SyncTier, number>;
    pendingByTier: Record<SyncTier, { platform: number; social: number }>;
    dailyCredits: { total: number; byProvider: Record<string, number> };
  }> {
    // Tier distribution
    const tierCounts = await db.streamer.groupBy({
      by: ['syncTier'],
      _count: true,
    });

    const tierDistribution: Record<SyncTier, number> = {
      HOT: 0,
      ACTIVE: 0,
      STANDARD: 0,
      COLD: 0,
    };

    for (const row of tierCounts) {
      tierDistribution[row.syncTier] = row._count;
    }

    // Pending syncs by tier
    const pendingByTier: Record<SyncTier, { platform: number; social: number }> = {
      HOT: { platform: 0, social: 0 },
      ACTIVE: { platform: 0, social: 0 },
      STANDARD: { platform: 0, social: 0 },
      COLD: { platform: 0, social: 0 },
    };

    for (const tier of Object.keys(TIER_CONFIG) as SyncTier[]) {
      const platformPending = await this.getStreamersNeedingSync(tier, 'platform', 1);
      const socialPending = await this.getStreamersNeedingSync(tier, 'social', 1);
      pendingByTier[tier] = {
        platform: platformPending.length > 0 ? (await db.streamer.count({
          where: {
            syncTier: tier,
            OR: [
              { lastScrapedAt: null },
              { lastScrapedAt: { lt: new Date(Date.now() - TIER_CONFIG[tier].syncIntervalMinutes * 60 * 1000) } },
            ],
          },
        })) : 0,
        social: socialPending.length > 0 ? (await db.streamer.count({
          where: {
            syncTier: tier,
            OR: [
              { socialSyncedAt: null },
              { socialSyncedAt: { lt: new Date(Date.now() - TIER_CONFIG[tier].syncIntervalMinutes * 60 * 1000) } },
            ],
          },
        })) : 0,
      };
    }

    // Daily credits
    const dailyCredits = await this.getDailyUsage();

    return {
      tierDistribution,
      pendingByTier,
      dailyCredits,
    };
  }

  /**
   * Mark a streamer as synced
   */
  async markSynced(
    streamerId: string,
    syncType: 'platform' | 'social'
  ): Promise<void> {
    const data = syncType === 'social'
      ? { socialSyncedAt: new Date() }
      : { lastScrapedAt: new Date() };

    await db.streamer.update({
      where: { id: streamerId },
      data,
    });
  }
}

export const syncOptimization = SyncOptimizationService.getInstance();
