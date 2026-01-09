#!/usr/bin/env ts-node
/**
 * Cron job to pre-cache top streamers with all fields
 * Run every 10 minutes on Render
 */

import { db, logger } from '../utils/database';

export async function cacheStreamers() {
  try {
    logger.info('Starting streamers caching...');

    // Cache top 100 live streamers (most commonly viewed)
    const liveStreamers = await db.streamer.findMany({
      where: { isLive: true },
      orderBy: [
        { currentViewers: 'desc' },
        { followers: 'desc' },
      ],
      take: 100,
    });

    await db.cachedStats.upsert({
      where: { key: 'top_live_streamers' },
      create: {
        key: 'top_live_streamers',
        value: liveStreamers,
      },
      update: {
        value: liveStreamers,
      },
    });

    // Cache top 100 streamers by followers (for default view)
    const topStreamers = await db.streamer.findMany({
      orderBy: [
        { isLive: 'desc' },
        { currentViewers: 'desc' },
        { followers: 'desc' },
      ],
      take: 100,
    });

    await db.cachedStats.upsert({
      where: { key: 'top_streamers' },
      create: {
        key: 'top_streamers',
        value: topStreamers,
      },
      update: {
        value: topStreamers,
      },
    });

    logger.info('✅ Streamers cached successfully', {
      liveCount: liveStreamers.length,
      topCount: topStreamers.length,
    });

    await db.$disconnect();
  } catch (error) {
    logger.error('❌ Streamers caching failed:', error);
    await db.$disconnect();
  }
}
