/**
 * Discovery Deduplication Cache
 *
 * In-memory cache of existing usernames for fast lookup.
 * Prevents wasted API calls on streamers already in the database.
 */

import { db, logger } from './database';
import { Platform } from '@prisma/client';

class DiscoveryDeduplicationCache {
  private cache: Map<Platform, Set<string>> = new Map();
  private initialized = false;
  private lastRefresh: Date | null = null;

  /**
   * Initialize cache with all existing usernames from database
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug('Dedup cache already initialized, skipping');
      return;
    }

    logger.info('Initializing discovery deduplication cache...');
    const startTime = Date.now();

    try {
      // Clear existing cache
      this.cache.clear();

      // Load all existing usernames grouped by platform
      const streamers = await db.streamer.findMany({
        select: { platform: true, username: true }
      });

      for (const s of streamers) {
        if (!this.cache.has(s.platform)) {
          this.cache.set(s.platform, new Set());
        }
        this.cache.get(s.platform)!.add(s.username.toLowerCase());
      }

      this.initialized = true;
      this.lastRefresh = new Date();

      const duration = Date.now() - startTime;
      const stats = this.getStats();

      logger.info(`Dedup cache initialized in ${duration}ms`, stats);
    } catch (error) {
      logger.error('Failed to initialize dedup cache:', error);
      throw error;
    }
  }

  /**
   * Check if a streamer already exists in the database
   */
  exists(platform: Platform, username: string): boolean {
    if (!this.initialized) {
      logger.warn('Dedup cache not initialized, returning false');
      return false;
    }
    return this.cache.get(platform)?.has(username.toLowerCase()) ?? false;
  }

  /**
   * Add a newly discovered streamer to the cache
   */
  add(platform: Platform, username: string): void {
    if (!this.cache.has(platform)) {
      this.cache.set(platform, new Set());
    }
    this.cache.get(platform)!.add(username.toLowerCase());
  }

  /**
   * Filter out existing streamers from a list
   * Returns only NEW streamers not in the cache
   */
  filterNew<T extends { username: string }>(
    platform: Platform,
    streamers: T[]
  ): T[] {
    if (!this.initialized) {
      logger.warn('Dedup cache not initialized, returning all');
      return streamers;
    }

    const platformCache = this.cache.get(platform);
    if (!platformCache) {
      return streamers;
    }

    return streamers.filter(s => !platformCache.has(s.username.toLowerCase()));
  }

  /**
   * Get count of new streamers without filtering
   */
  countNew(platform: Platform, usernames: string[]): number {
    if (!this.initialized) return usernames.length;

    const platformCache = this.cache.get(platform);
    if (!platformCache) return usernames.length;

    return usernames.filter(u => !platformCache.has(u.toLowerCase())).length;
  }

  /**
   * Refresh the cache from database
   */
  async refresh(): Promise<void> {
    this.initialized = false;
    await this.initialize();
  }

  /**
   * Get cache statistics
   */
  getStats(): Record<string, number> {
    const stats: Record<string, number> = { total: 0 };

    for (const [platform, usernames] of this.cache) {
      stats[platform] = usernames.size;
      stats.total += usernames.size;
    }

    return stats;
  }

  /**
   * Check if cache needs refresh (older than 1 hour)
   */
  needsRefresh(): boolean {
    if (!this.lastRefresh) return true;
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return this.lastRefresh < hourAgo;
  }

  /**
   * Get size for a specific platform
   */
  size(platform: Platform): number {
    return this.cache.get(platform)?.size ?? 0;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Singleton instance
export const dedupCache = new DiscoveryDeduplicationCache();

// Helper function to ensure cache is ready
export async function ensureDedupCache(): Promise<void> {
  if (!dedupCache.isInitialized() || dedupCache.needsRefresh()) {
    await dedupCache.initialize();
  }
}
