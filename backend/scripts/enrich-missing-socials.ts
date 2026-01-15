/**
 * Enrich Missing Socials Script
 *
 * Finds creators with missing avatars/followers and adds them to sync queue,
 * then processes via ScrapeCreators API with Bunny CDN upload.
 *
 * Usage:
 *   npx ts-node scripts/enrich-missing-socials.ts
 *   npx ts-node scripts/enrich-missing-socials.ts --platform=INSTAGRAM
 *   npx ts-node scripts/enrich-missing-socials.ts --batch=100
 */

import { db } from '../src/utils/database';
import { scrapeCreatorsService } from '../src/services/scrapeCreatorsService';
import { Platform } from '@prisma/client';

async function main() {
  const args = process.argv.slice(2);
  const platformArg = args.find(a => a.startsWith('--platform='));
  const batchArg = args.find(a => a.startsWith('--batch='));

  const targetPlatform = platformArg ? platformArg.split('=')[1].toUpperCase() as Platform : null;
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : 100;

  console.log('========================================');
  console.log('🔄 ENRICH MISSING SOCIALS');
  console.log('========================================\n');
  console.log(`Platform: ${targetPlatform || 'ALL'}`);
  console.log(`Batch size: ${batchSize}`);

  // Platforms that use ScrapeCreators (not Twitch/Kick/YouTube which have their own APIs)
  const platforms: Platform[] = targetPlatform
    ? [targetPlatform]
    : ['INSTAGRAM', 'TIKTOK', 'X', 'FACEBOOK', 'LINKEDIN'];

  let totalQueued = 0;

  for (const platform of platforms) {
    console.log(`\n📊 Checking ${platform}...`);

    // Find creators with missing data
    const needsEnrichment = await db.streamer.findMany({
      where: {
        platform,
        OR: [
          { avatarUrl: null },
          { avatarUrl: '' },
          { followers: 0 }
        ]
      },
      select: { id: true, username: true, followers: true },
      take: batchSize,
      orderBy: { createdAt: 'desc' }
    });

    if (needsEnrichment.length === 0) {
      console.log(`   ✅ No missing data for ${platform}`);
      continue;
    }

    console.log(`   Found ${needsEnrichment.length} creators needing enrichment`);

    // Add to sync queue
    const queueItems = needsEnrichment.map(creator => ({
      id: '',
      platform,
      username: creator.username,
      priority: 50,
      sourceStreamerId: creator.id
    }));

    const added = await scrapeCreatorsService.addToSyncQueue(queueItems);
    console.log(`   Added ${added} to sync queue`);
    totalQueued += added;
  }

  if (totalQueued === 0) {
    console.log('\n✅ Nothing to sync - all data complete!');
    await db.$disconnect();
    return;
  }

  console.log(`\n📋 Total queued: ${totalQueued}`);
  console.log('💰 Estimated credits: ' + totalQueued);

  // Now sync the queued items
  console.log('\n🚀 Starting sync...\n');

  for (const platform of platforms) {
    const stats = await scrapeCreatorsService.getQueueStats();
    const platformStats = stats[platform];

    if (!platformStats || platformStats.pending === 0) {
      continue;
    }

    console.log(`\n🌐 Syncing ${platform}...`);
    console.log(`   Pending: ${platformStats.pending}`);

    try {
      const result = await scrapeCreatorsService.syncPlatform(platform, batchSize);
      console.log(`   ✅ Success: ${result.success}/${result.total}`);
      console.log(`   ❌ Errors: ${result.errors}`);
      console.log(`   💰 Credits: ${result.credits}`);
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  // Final summary
  console.log('\n========================================');
  console.log('📊 ENRICHMENT COMPLETE');
  console.log('========================================');

  for (const platform of platforms) {
    const total = await db.streamer.count({ where: { platform } });
    const noAvatar = await db.streamer.count({
      where: { platform, OR: [{ avatarUrl: null }, { avatarUrl: '' }] }
    });
    const noFollowers = await db.streamer.count({
      where: { platform, followers: 0 }
    });

    const avatarPct = total > 0 ? ((total - noAvatar) / total * 100).toFixed(1) : '0';
    const followerPct = total > 0 ? ((total - noFollowers) / total * 100).toFixed(1) : '0';

    console.log(`${platform}: Avatars ${avatarPct}%, Followers ${followerPct}%`);
  }

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
