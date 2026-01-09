#!/usr/bin/env ts-node
/**
 * Cron job to pre-compute and cache expensive stats
 * Run every 5 minutes on Render
 */

import { db, logger } from '../utils/database';

export async function cacheStats() {
  try {
    logger.info('Starting stats caching...');

    // 1. Cache region stats
    const regionStats = await db.streamer.groupBy({
      by: ['region'],
      _count: { _all: true },
    });
    const regionCounts: Record<string, number> = {};
    for (const r of regionStats) {
      regionCounts[String(r.region).toLowerCase()] = r._count._all;
    }

    await db.cachedStats.upsert({
      where: { key: 'region_stats' },
      create: {
        key: 'region_stats',
        value: regionCounts,
      },
      update: {
        value: regionCounts,
      },
    });

    // 2. Cache total streamers count
    const totalStreamers = await db.streamer.count();
    await db.cachedStats.upsert({
      where: { key: 'total_streamers' },
      create: {
        key: 'total_streamers',
        value: totalStreamers,
      },
      update: {
        value: totalStreamers,
      },
    });

    // 3. Cache live streamers count
    const liveCount = await db.streamer.count({ where: { isLive: true } });
    await db.cachedStats.upsert({
      where: { key: 'live_count' },
      create: {
        key: 'live_count',
        value: liveCount,
      },
      update: {
        value: liveCount,
      },
    });

    // 4. Cache flagged count
    const flaggedCount = await db.streamer.count({ where: { fraudCheck: 'FLAGGED' } });
    await db.cachedStats.upsert({
      where: { key: 'flagged_count' },
      create: {
        key: 'flagged_count',
        value: flaggedCount,
      },
      update: {
        value: flaggedCount,
      },
    });

    logger.info('✅ Stats cached successfully', {
      totalStreamers,
      liveCount,
      flaggedCount,
      regions: Object.keys(regionCounts).length,
    });

    await db.$disconnect();
  } catch (error) {
    logger.error('❌ Stats caching failed:', error);
    await db.$disconnect();
  }
}
