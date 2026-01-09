#!/usr/bin/env ts-node
/**
 * Cron job to update live status for streamers
 * Run every 5 minutes on Render
 */

import { db, logger } from '../utils/database';
import { liveStatusService } from '../services/liveStatusService';

async function updateLiveStatus() {
  try {
    logger.info('🔄 Starting live status update...');

    // Use lower concurrency for cron to avoid rate limits (50 concurrent to stay well under API limits)
    const result = await liveStatusService.updateStreamersLiveStatus(500, 50);

    logger.info('✅ Live status updated successfully', {
      totalChecked: result.totalChecked,
      liveCount: result.liveCount,
      errors: result.errors,
    });

    await db.$disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('❌ Live status update failed:', error);
    await db.$disconnect();
    process.exit(1);
  }
}

updateLiveStatus();
