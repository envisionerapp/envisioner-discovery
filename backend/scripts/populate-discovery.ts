/**
 * Discovery Population Script
 *
 * This script:
 * 1. Extracts social media handles (TikTok, Instagram, X, Facebook, LinkedIn)
 *    from existing Twitch/Kick/YouTube streamer profiles
 * 2. Adds them to the sync queue
 * 3. Processes the queue using ScrapeCreators API
 *
 * Usage:
 *   npx ts-node scripts/populate-discovery.ts              # Extract only
 *   npx ts-node scripts/populate-discovery.ts --sync       # Extract + sync all platforms
 *   npx ts-node scripts/populate-discovery.ts --sync --batch=100  # Custom batch size
 *   npx ts-node scripts/populate-discovery.ts --platform=TIKTOK   # Sync specific platform
 */

import { db } from '../src/utils/database';
import { scrapeCreatorsService } from '../src/services/scrapeCreatorsService';
import { Platform } from '@prisma/client';

async function main() {
  const args = process.argv.slice(2);
  const shouldSync = args.includes('--sync');
  const batchArg = args.find(a => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : 50;
  const platformArg = args.find(a => a.startsWith('--platform='));
  const targetPlatform = platformArg ? platformArg.split('=')[1].toUpperCase() : null;

  console.log('========================================');
  console.log('🔍 DISCOVERY POPULATION SCRIPT');
  console.log('========================================\n');

  // Step 1: Show current stats
  console.log('📊 Current Database Stats:');
  const [twitchCount, kickCount, youtubeCount] = await Promise.all([
    db.streamer.count({ where: { platform: 'TWITCH' } }),
    db.streamer.count({ where: { platform: 'KICK' } }),
    db.streamer.count({ where: { platform: 'YOUTUBE' } }),
  ]);
  console.log(`   Twitch streamers: ${twitchCount.toLocaleString()}`);
  console.log(`   Kick streamers: ${kickCount.toLocaleString()}`);
  console.log(`   YouTube streamers: ${youtubeCount.toLocaleString()}`);

  // Count streamers with social links
  const streamersWithSocialLinks = await db.streamer.count({
    where: {
      platform: { in: ['TWITCH', 'KICK', 'YOUTUBE'] },
      OR: [
        { socialLinks: { not: '[]' } },
        { profileDescription: { not: null } },
      ]
    }
  });
  console.log(`   Streamers with social links/bio: ${streamersWithSocialLinks.toLocaleString()}`);

  // Show queue stats before
  console.log('\n📋 Sync Queue Stats (Before):');
  const statsBefore = await scrapeCreatorsService.getQueueStats();
  for (const [platform, stats] of Object.entries(statsBefore)) {
    console.log(`   ${platform}: ${stats.pending} pending, ${stats.completed} completed, ${stats.failed} failed`);
  }

  // Step 2: Extract social handles
  console.log('\n🔍 Extracting social handles from Twitch/Kick/YouTube profiles...');
  const extractResult = await scrapeCreatorsService.extractSocialHandlesFromStreamers();

  console.log('\n✅ Extraction complete:');
  console.log(`   TikTok handles found: ${extractResult.tiktok}`);
  console.log(`   Instagram handles found: ${extractResult.instagram}`);
  console.log(`   X (Twitter) handles found: ${extractResult.x}`);
  console.log(`   Facebook handles found: ${extractResult.facebook}`);
  console.log(`   LinkedIn handles found: ${extractResult.linkedin}`);

  const totalExtracted = extractResult.tiktok + extractResult.instagram + extractResult.x + extractResult.facebook + extractResult.linkedin;
  console.log(`   Total handles extracted: ${totalExtracted}`);

  // Show queue stats after extraction
  console.log('\n📋 Sync Queue Stats (After Extraction):');
  const statsAfter = await scrapeCreatorsService.getQueueStats();
  for (const [platform, stats] of Object.entries(statsAfter)) {
    console.log(`   ${platform}: ${stats.pending} pending, ${stats.completed} completed, ${stats.failed} failed`);
  }

  const totalPending = Object.values(statsAfter).reduce((sum, s) => sum + s.pending, 0);
  console.log(`\n💰 Estimated credits needed: ${totalPending} (1 credit per profile)`);

  // Step 3: Sync if requested
  if (shouldSync) {
    console.log('\n========================================');
    console.log('🚀 STARTING SYNC PROCESS');
    console.log(`   Batch size: ${batchSize}`);
    if (targetPlatform) {
      console.log(`   Target platform: ${targetPlatform}`);
    }
    console.log('========================================\n');

    const platforms: Platform[] = targetPlatform
      ? [targetPlatform as Platform]
      : ['TIKTOK', 'INSTAGRAM', 'X', 'FACEBOOK', 'LINKEDIN'];

    let totalCreditsUsed = 0;
    const results: Record<string, any> = {};

    for (const platform of platforms) {
      console.log(`\n🌐 Syncing ${platform}...`);
      try {
        const result = await scrapeCreatorsService.syncPlatform(platform, batchSize);
        results[platform] = result;
        totalCreditsUsed += result.credits;
        console.log(`   ✅ ${platform}: ${result.success} synced, ${result.errors} errors (${result.credits} credits)`);
      } catch (error: any) {
        console.log(`   ❌ ${platform}: Error - ${error.message}`);
        results[platform] = { error: error.message };
      }
    }

    console.log('\n========================================');
    console.log('📊 SYNC RESULTS');
    console.log('========================================');
    for (const [platform, result] of Object.entries(results)) {
      if (result.error) {
        console.log(`   ${platform}: ERROR - ${result.error}`);
      } else {
        console.log(`   ${platform}: ${result.success}/${result.total} synced (${result.errors} errors)`);
      }
    }
    console.log(`\n💰 Total credits used: ${totalCreditsUsed}`);
  } else {
    console.log('\n💡 To sync the queue, run with --sync flag:');
    console.log('   npx ts-node scripts/populate-discovery.ts --sync');
    console.log('   npx ts-node scripts/populate-discovery.ts --sync --batch=100');
    console.log('   npx ts-node scripts/populate-discovery.ts --sync --platform=TIKTOK');
  }

  // Show final social platform counts
  console.log('\n📊 Social Platform Counts in Discovery:');
  const [tiktokCount, instagramCount, xCount, facebookCount, linkedinCount] = await Promise.all([
    db.streamer.count({ where: { platform: 'TIKTOK' } }),
    db.streamer.count({ where: { platform: 'INSTAGRAM' } }),
    db.streamer.count({ where: { platform: 'X' } }),
    db.streamer.count({ where: { platform: 'FACEBOOK' } }),
    db.streamer.count({ where: { platform: 'LINKEDIN' } }),
  ]);
  console.log(`   TikTok: ${tiktokCount.toLocaleString()}`);
  console.log(`   Instagram: ${instagramCount.toLocaleString()}`);
  console.log(`   X: ${xCount.toLocaleString()}`);
  console.log(`   Facebook: ${facebookCount.toLocaleString()}`);
  console.log(`   LinkedIn: ${linkedinCount.toLocaleString()}`);

  console.log('\n✅ Done!');
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error('❌ Script failed:', error);
  await db.$disconnect();
  process.exit(1);
});
