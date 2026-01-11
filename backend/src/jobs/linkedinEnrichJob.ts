import cron from 'node-cron';
import { db, logger } from '../utils/database';
import { scrapeCreatorsService } from '../services/scrapeCreatorsService';
import { bunnyService } from '../services/bunnyService';
import { Platform } from '@prisma/client';

// Every 5 minutes - enrich LinkedIn profiles with followers data
export const linkedinEnrichJob = cron.schedule('*/5 * * * *', async () => {
  console.log('\n🔗 [CRON] LinkedIn enrichment triggered');
  try {
    // Find LinkedIn creators that haven't been enriched yet
    const creators = await db.streamer.findMany({
      where: {
        platform: Platform.LINKEDIN,
        lastScrapedAt: null, // Not yet enriched
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
        const profile = await scrapeCreatorsService.getLinkedInProfile(creator.username);
        if (profile) {
          const followers = profile.followers || profile.follower_count || 0;
          let avatarUrl = profile.image;

          // Upload avatar to Bunny CDN
          if (avatarUrl) {
            avatarUrl = await bunnyService.uploadLinkedInAvatar(creator.username, avatarUrl);
          }

          await db.streamer.update({
            where: { id: creator.id },
            data: {
              followers,
              avatarUrl: avatarUrl || undefined,
              displayName: profile.name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || undefined,
              profileDescription: profile.headline || profile.about || undefined,
              lastScrapedAt: new Date(),
            }
          });
          updated++;
        }

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
      platform: Platform.LINKEDIN,
      lastScrapedAt: null, // Not yet enriched
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
      const profile = await scrapeCreatorsService.getLinkedInProfile(creator.username);
      if (profile) {
        const followers = profile.followers || profile.follower_count || 0;
        let avatarUrl = profile.image;

        // Upload avatar to Bunny CDN
        if (avatarUrl) {
          avatarUrl = await bunnyService.uploadLinkedInAvatar(creator.username, avatarUrl);
        }

        await db.streamer.update({
          where: { id: creator.id },
          data: {
            followers,
            avatarUrl: avatarUrl || undefined,
            displayName: profile.name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || undefined,
            profileDescription: profile.headline || profile.about || undefined,
            lastScrapedAt: new Date(),
          }
        });
        updated++;
      }

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
