/**
 * Force Re-sync Missing Data
 *
 * Resets sync queue status for creators with missing avatars/followers
 * so they can be re-synced via ScrapeCreators.
 */

import { db } from '../src/utils/database';
import { scrapeCreatorsService } from '../src/services/scrapeCreatorsService';
import { Platform } from '@prisma/client';

async function main() {
  const args = process.argv.slice(2);
  const platformArg = args.find(a => a.startsWith('--platform='));
  const batchArg = args.find(a => a.startsWith('--batch='));

  const platform = (platformArg?.split('=')[1]?.toUpperCase() || 'INSTAGRAM') as Platform;
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : 100;

  console.log('========================================');
  console.log('🔄 FORCE RE-SYNC MISSING DATA');
  console.log('========================================\n');
  console.log(`Platform: ${platform}`);
  console.log(`Batch size: ${batchSize}`);

  // Find creators with missing data
  const missing = await db.streamer.findMany({
    where: {
      platform,
      OR: [
        { avatarUrl: null },
        { avatarUrl: '' },
        { followers: 0 }
      ]
    },
    select: { id: true, username: true },
    take: batchSize
  });

  console.log(`\n📊 Found ${missing.length} creators with missing data`);

  if (missing.length === 0) {
    console.log('✅ No missing data!');
    await db.$disconnect();
    return;
  }

  // Reset their queue status to PENDING so they get re-synced
  const usernames = missing.map(m => m.username.toLowerCase());

  const resetResult = await db.socialSyncQueue.updateMany({
    where: {
      platform,
      username: { in: usernames },
      status: { in: ['COMPLETED', 'FAILED'] }
    },
    data: {
      status: 'PENDING',
      processedAt: null,
      errorMessage: null,
      retryCount: 0
    }
  });

  console.log(`   Reset ${resetResult.count} queue items to PENDING`);

  // Add any that aren't in queue at all
  const inQueue = await db.socialSyncQueue.findMany({
    where: { platform, username: { in: usernames } },
    select: { username: true }
  });
  const inQueueSet = new Set(inQueue.map(q => q.username));

  const notInQueue = missing.filter(m => !inQueueSet.has(m.username.toLowerCase()));
  if (notInQueue.length > 0) {
    const added = await scrapeCreatorsService.addToSyncQueue(
      notInQueue.map(m => ({
        id: '',
        platform,
        username: m.username,
        priority: 50,
        sourceStreamerId: m.id
      }))
    );
    console.log(`   Added ${added} new items to queue`);
  }

  // Now sync
  console.log('\n🚀 Starting sync...\n');

  const result = await scrapeCreatorsService.syncPlatform(platform, batchSize);

  console.log('\n========================================');
  console.log('📊 SYNC COMPLETE');
  console.log('========================================');
  console.log(`   Total: ${result.total}`);
  console.log(`   Success: ${result.success}`);
  console.log(`   Errors: ${result.errors}`);
  console.log(`   Credits used: ${result.credits}`);

  // Check remaining
  const stillMissing = await db.streamer.count({
    where: {
      platform,
      OR: [{ avatarUrl: null }, { avatarUrl: '' }, { followers: 0 }]
    }
  });
  console.log(`\n   Remaining with missing data: ${stillMissing}`);

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
