#!/usr/bin/env npx ts-node

import { updateAllAvatars } from './updateAvatars';
import { logger } from '../src/utils/database';
import { Platform } from '@prisma/client';

async function runFullAvatarUpdate() {
  const platforms = [Platform.TWITCH, Platform.YOUTUBE, Platform.KICK];
  const batchSize = 100; // Process 100 streamers at a time per platform

  logger.info('Starting full avatar update process for all platforms');

  for (const platform of platforms) {
    logger.info(`Starting avatar update for ${platform} platform`);

    try {
      const stats = await updateAllAvatars({
        platform,
        limit: batchSize,
        forceUpdate: false
      });

      logger.info(`Completed ${platform} batch`, {
        total: stats.total,
        success: stats.success,
        failed: stats.failed,
        successRate: `${((stats.success / Math.max(stats.total, 1)) * 100).toFixed(1)}%`
      });

      // Wait 2 seconds between platforms to be respectful
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      logger.error(`Failed to update avatars for ${platform}:`, error);
    }
  }

  logger.info('Full avatar update process completed');
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    console.log(`
Full Avatar Update Script

This script will update avatars for all platforms in batches.

Usage: npx ts-node scripts/updateAllAvatars.ts

Options:
  --help    Show this help message

The script will process:
- Twitch streamers (100 at a time)
- YouTube streamers (100 at a time)
- Kick streamers (100 at a time)

Only streamers without existing avatars will be processed.
    `);
    process.exit(0);
  }

  try {
    await runFullAvatarUpdate();
    console.log('✅ All avatar updates completed successfully!');
  } catch (error) {
    logger.error('Full avatar update failed:', error);
    console.error('❌ Avatar update process failed. Check logs for details.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}