#!/usr/bin/env npx ts-node

import { db, logger } from '../src/utils/database';
import { avatarService } from '../src/services/avatarService';
import { Platform } from '@prisma/client';

interface UpdateStats {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  byPlatform: Record<string, { success: number; failed: number; total: number }>;
}

async function updateAllAvatars(options: {
  forceUpdate?: boolean;
  platform?: Platform;
  limit?: number;
  dryRun?: boolean;
} = {}) {
  const { forceUpdate = false, platform, limit, dryRun = false } = options;

  logger.info('Starting avatar update process', { forceUpdate, platform, limit, dryRun });

  const stats: UpdateStats = {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    byPlatform: {}
  };

  try {
    // Get streamers that need avatar updates
    const whereCondition: any = {};

    if (platform) {
      whereCondition.platform = platform;
    }

    if (!forceUpdate) {
      whereCondition.OR = [
        { avatarUrl: null },
        { avatarUrl: '' }
      ];
    }

    const streamers = await db.streamer.findMany({
      where: whereCondition,
      select: {
        id: true,
        username: true,
        platform: true,
        avatarUrl: true,
        displayName: true
      },
      take: limit,
      orderBy: { updatedAt: 'desc' }
    });

    stats.total = streamers.length;
    logger.info(`Found ${streamers.length} streamers to process`);

    if (streamers.length === 0) {
      logger.info('No streamers need avatar updates');
      return stats;
    }

    // Initialize platform stats
    streamers.forEach(s => {
      if (!stats.byPlatform[s.platform]) {
        stats.byPlatform[s.platform] = { success: 0, failed: 0, total: 0 };
      }
      stats.byPlatform[s.platform].total++;
    });

    // Fetch avatars in batches
    const avatarData = streamers.map(s => ({
      username: s.username,
      platform: s.platform
    }));

    logger.info('Fetching avatars from platforms...');
    const results = await avatarService.fetchAvatarsBatch(avatarData);

    // Process results and update database
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const streamer = streamers[i];

      if (!result || !streamer) continue;

      try {
        if (result.success && result.avatarUrl) {
          if (!dryRun) {
            await db.streamer.update({
              where: { id: streamer.id },
              data: {
                avatarUrl: result.avatarUrl,
                updatedAt: new Date()
              }
            });
          }

          stats.success++;
          stats.byPlatform[streamer.platform].success++;

          logger.info(`✅ Updated avatar for ${streamer.displayName} (${streamer.platform}): ${result.avatarUrl}`);
        } else {
          stats.failed++;
          stats.byPlatform[streamer.platform].failed++;

          logger.warn(`❌ Failed to get avatar for ${streamer.displayName} (${streamer.platform}): ${result.error}`);
        }
      } catch (error) {
        stats.failed++;
        stats.byPlatform[streamer.platform].failed++;

        logger.error(`❌ Database update failed for ${streamer.displayName}:`, error);
      }
    }

  } catch (error) {
    logger.error('Avatar update process failed:', error);
    throw error;
  } finally {
    await avatarService.close();
  }

  // Print summary
  logger.info('Avatar update completed!', {
    total: stats.total,
    success: stats.success,
    failed: stats.failed,
    successRate: `${((stats.success / stats.total) * 100).toFixed(1)}%`
  });

  console.log('\n📊 AVATAR UPDATE SUMMARY');
  console.log('═'.repeat(50));
  console.log(`Total streamers processed: ${stats.total}`);
  console.log(`✅ Successful updates: ${stats.success}`);
  console.log(`❌ Failed updates: ${stats.failed}`);
  console.log(`📈 Success rate: ${((stats.success / stats.total) * 100).toFixed(1)}%`);

  if (dryRun) {
    console.log(`\n🔍 DRY RUN - No changes were made to the database`);
  }

  console.log('\n📱 By Platform:');
  for (const [platform, platformStats] of Object.entries(stats.byPlatform)) {
    const rate = platformStats.total > 0
      ? ((platformStats.success / platformStats.total) * 100).toFixed(1)
      : '0.0';
    console.log(`  ${platform}: ${platformStats.success}/${platformStats.total} (${rate}%)`);
  }

  return stats;
}

async function main() {
  const args = process.argv.slice(2);

  const options: Parameters<typeof updateAllAvatars>[0] = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--force':
        options.forceUpdate = true;
        break;
      case '--platform':
        const platformValue = args[++i];
        if (platformValue && Object.values(Platform).includes(platformValue as Platform)) {
          options.platform = platformValue as Platform;
        } else {
          console.error(`Invalid platform: ${platformValue}. Valid options: ${Object.values(Platform).join(', ')}`);
          process.exit(1);
        }
        break;
      case '--limit':
        const limitValue = parseInt(args[++i], 10);
        if (limitValue && limitValue > 0) {
          options.limit = limitValue;
        } else {
          console.error('Invalid limit value. Must be a positive number.');
          process.exit(1);
        }
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
        console.log(`
Avatar Update Script

Usage: npx ts-node scripts/updateAvatars.ts [options]

Options:
  --force         Update all streamers, even those with existing avatars
  --platform      Only update streamers from specific platform (${Object.values(Platform).join(', ')})
  --limit         Limit number of streamers to process
  --dry-run       Preview changes without updating database
  --help          Show this help message

Examples:
  npx ts-node scripts/updateAvatars.ts
  npx ts-node scripts/updateAvatars.ts --force --platform TWITCH
  npx ts-node scripts/updateAvatars.ts --limit 10 --dry-run
        `);
        process.exit(0);
      default:
        console.error(`Unknown option: ${arg}. Use --help for usage information.`);
        process.exit(1);
    }
  }

  try {
    const startTime = Date.now();
    const stats = await updateAllAvatars(options);
    const duration = Date.now() - startTime;

    console.log(`\n⏱️  Completed in ${(duration / 1000).toFixed(1)}s`);

    // Exit with error code if no successes
    if (stats.total > 0 && stats.success === 0) {
      process.exit(1);
    }
  } catch (error) {
    logger.error('Script execution failed:', error);
    console.error('❌ Script failed. Check logs for details.');
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

export { updateAllAvatars };