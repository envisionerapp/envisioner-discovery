import cron from 'node-cron';
import { scrapeCreatorsService } from '../services/scrapeCreatorsService';
import { Platform } from '@prisma/client';

// Sync social platforms - runs every 10 minutes
// Processes 50 creators per platform per run = 250 credits per run max
// At 6 runs/hour = 1,500 credits/hour = 36,000 credits/day max

const BATCH_SIZE = 50; // Creators per platform per run

export const socialSyncJob = cron.schedule('*/10 * * * *', async () => {
  console.log('\n⏰ [CRON] Social platforms sync triggered');

  try {
    const platforms: Platform[] = ['TIKTOK', 'INSTAGRAM', 'X', 'FACEBOOK', 'LINKEDIN'];
    let totalCredits = 0;

    for (const platform of platforms) {
      const result = await scrapeCreatorsService.syncPlatform(platform, BATCH_SIZE);
      totalCredits += result.credits;

      // Small delay between platforms
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`💰 [SOCIAL] Total credits used this run: ${totalCredits}`);

  } catch (error) {
    console.error('❌ [CRON] Social sync failed:', error);
  }
}, {
  scheduled: false
});

// Individual platform jobs (can be triggered separately)

export const tiktokSyncJob = cron.schedule('*/15 * * * *', async () => {
  console.log('\n🎵 [CRON] TikTok sync triggered');
  try {
    await scrapeCreatorsService.syncPlatform('TIKTOK', BATCH_SIZE);
  } catch (error) {
    console.error('❌ [CRON] TikTok sync failed:', error);
  }
}, {
  scheduled: false
});

export const instagramSyncJob = cron.schedule('*/15 * * * *', async () => {
  console.log('\n📸 [CRON] Instagram sync triggered');
  try {
    await scrapeCreatorsService.syncPlatform('INSTAGRAM', BATCH_SIZE);
  } catch (error) {
    console.error('❌ [CRON] Instagram sync failed:', error);
  }
}, {
  scheduled: false
});

export const xSyncJob = cron.schedule('*/15 * * * *', async () => {
  console.log('\n𝕏 [CRON] X sync triggered');
  try {
    await scrapeCreatorsService.syncPlatform('X', BATCH_SIZE);
  } catch (error) {
    console.error('❌ [CRON] X sync failed:', error);
  }
}, {
  scheduled: false
});

export const facebookSyncJob = cron.schedule('*/20 * * * *', async () => {
  console.log('\n📘 [CRON] Facebook sync triggered');
  try {
    await scrapeCreatorsService.syncPlatform('FACEBOOK', BATCH_SIZE);
  } catch (error) {
    console.error('❌ [CRON] Facebook sync failed:', error);
  }
}, {
  scheduled: false
});

export const linkedinSyncJob = cron.schedule('*/30 * * * *', async () => {
  console.log('\n💼 [CRON] LinkedIn sync triggered');
  try {
    await scrapeCreatorsService.syncPlatform('LINKEDIN', BATCH_SIZE);
  } catch (error) {
    console.error('❌ [CRON] LinkedIn sync failed:', error);
  }
}, {
  scheduled: false
});
