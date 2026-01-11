import cron from 'node-cron';
import { db, logger } from '../utils/database';
import { scrapeCreatorsService } from '../services/scrapeCreatorsService';

// Every 5 minutes - enrich LinkedIn profiles with followers data
export const linkedinEnrichJob = cron.schedule('*/5 * * * *', async () => {
  console.log('\n🔗 [CRON] LinkedIn enrichment triggered');
  try {
    // Find LinkedIn creators without followers data
    const creators = await db.streamer.findMany({
      where: {
        platform: 'LINKEDIN',
        OR: [
          { followers: 0 },
          { followers: null },
        ]
      },
      select: { id: true, username: true },
      take: 20, // Process 20 per run to stay within rate limits
    });

    if (creators.length === 0) {
      console.log('🔗 [CRON] All LinkedIn profiles enriched');
      return;
    }

    console.log(`🔗 [CRON] Enriching ${creators.length} LinkedIn profiles...`);

    let updated = 0;
    let errors = 0;

    for (const creator of creators) {
      try {
        await scrapeCreatorsService.syncProfile('LINKEDIN', creator.username);
        updated++;

        // Rate limit: 500ms between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error: any) {
        console.error(`🔗 [CRON] Failed to enrich ${creator.username}:`, error.message);
        errors++;
      }
    }

    console.log(`🔗 [CRON] LinkedIn enrichment complete: ${updated} updated, ${errors} errors`);
  } catch (error) {
    console.error('❌ [CRON] LinkedIn enrichment failed:', error);
  }
}, {
  scheduled: false
});

// Also run immediately on startup for faster initial enrichment
export async function enrichLinkedInProfiles(limit: number = 50): Promise<{ updated: number; errors: number }> {
  logger.info(`🔗 Enriching LinkedIn profiles (limit: ${limit})...`);

  const creators = await db.streamer.findMany({
    where: {
      platform: 'LINKEDIN',
      OR: [
        { followers: 0 },
        { followers: null },
      ]
    },
    select: { id: true, username: true },
    take: limit,
  });

  if (creators.length === 0) {
    logger.info('🔗 All LinkedIn profiles already enriched');
    return { updated: 0, errors: 0 };
  }

  logger.info(`🔗 Found ${creators.length} LinkedIn profiles to enrich`);

  let updated = 0;
  let errors = 0;

  for (const creator of creators) {
    try {
      await scrapeCreatorsService.syncProfile('LINKEDIN', creator.username);
      updated++;

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error: any) {
      logger.error(`🔗 Failed to enrich ${creator.username}:`, error.message);
      errors++;
    }
  }

  logger.info(`🔗 LinkedIn enrichment complete: ${updated} updated, ${errors} errors`);
  return { updated, errors };
}
