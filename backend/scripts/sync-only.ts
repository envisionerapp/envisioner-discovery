/**
 * Direct sync script - processes existing queue without extracting new handles
 */

import { db } from '../src/utils/database';
import { scrapeCreatorsService } from '../src/services/scrapeCreatorsService';

async function main() {
  const args = process.argv.slice(2);
  const batchArg = args.find(a => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : 100;

  console.log('========================================');
  console.log('🚀 DIRECT SYNC SCRIPT');
  console.log('========================================\n');

  // Show queue stats
  console.log('📋 Current Sync Queue Stats:');
  const stats = await scrapeCreatorsService.getQueueStats();
  let totalPending = 0;
  for (const [platform, stat] of Object.entries(stats)) {
    console.log(`   ${platform}: ${stat.pending} pending, ${stat.completed} completed, ${stat.failed} failed`);
    totalPending += stat.pending;
  }
  console.log(`   Total pending: ${totalPending}`);

  console.log(`\n💰 Estimated credits needed: ${totalPending} (1 credit per profile)`);

  if (totalPending === 0) {
    console.log('\n✅ No pending items in queue!');
    await db.$disconnect();
    return;
  }

  // Process each platform
  const platforms = ['TIKTOK', 'INSTAGRAM', 'X', 'FACEBOOK'] as const;

  for (const platform of platforms) {
    const platformStats = stats[platform];
    if (!platformStats || platformStats.pending === 0) {
      console.log(`\n⏭️ Skipping ${platform} (no pending items)`);
      continue;
    }

    console.log(`\n🌐 Syncing ${platform}...`);
    console.log(`   Batch size: ${batchSize}`);
    console.log(`   Pending: ${platformStats.pending}`);

    try {
      const result = await scrapeCreatorsService.syncPlatform(platform, batchSize);
      console.log(`   ✅ Total: ${result.total}`);
      console.log(`   ✅ Success: ${result.success}`);
      console.log(`   ❌ Errors: ${result.errors}`);
      console.log(`   💰 Credits used: ${result.credits}`);
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  // Final stats
  console.log('\n📋 Final Sync Queue Stats:');
  const finalStats = await scrapeCreatorsService.getQueueStats();
  for (const [platform, stat] of Object.entries(finalStats)) {
    console.log(`   ${platform}: ${stat.pending} pending, ${stat.completed} completed, ${stat.failed} failed`);
  }

  await db.$disconnect();
}

main().catch(console.error);
