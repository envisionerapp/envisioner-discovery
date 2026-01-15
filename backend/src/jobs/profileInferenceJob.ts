import cron from 'node-cron';
import { db, logger } from '../utils/database';
import { claudeService } from '../services/claudeService';
import { auditService } from '../services/auditService';

// Map ISO country codes to Region enum values
const countryToRegion: Record<string, string> = {
  'MX': 'MEXICO', 'CO': 'COLOMBIA', 'AR': 'ARGENTINA', 'CL': 'CHILE', 'PE': 'PERU',
  'VE': 'VENEZUELA', 'EC': 'ECUADOR', 'BO': 'BOLIVIA', 'PY': 'PARAGUAY', 'UY': 'URUGUAY',
  'CR': 'COSTA_RICA', 'PA': 'PANAMA', 'GT': 'GUATEMALA', 'SV': 'EL_SALVADOR',
  'HN': 'HONDURAS', 'NI': 'NICARAGUA', 'DO': 'DOMINICAN_REPUBLIC', 'PR': 'PUERTO_RICO',
  'BR': 'BRAZIL', 'US': 'USA', 'CA': 'CANADA', 'GB': 'UK', 'UK': 'UK',
  'ES': 'SPAIN', 'DE': 'GERMANY', 'FR': 'FRANCE', 'IT': 'ITALY', 'PT': 'PORTUGAL',
  'NL': 'NETHERLANDS', 'BE': 'BELGIUM', 'PL': 'POLAND', 'RU': 'RUSSIA',
  'JP': 'JAPAN', 'KR': 'KOREA', 'AU': 'AUSTRALIA', 'IN': 'INDIA', 'CN': 'CHINA',
  'TW': 'TAIWAN', 'PH': 'PHILIPPINES', 'TH': 'THAILAND', 'MY': 'MALAYSIA',
  'ID': 'INDONESIA', 'SG': 'SINGAPORE', 'TR': 'TURKEY', 'ZA': 'SOUTH_AFRICA',
  'EG': 'EGYPT', 'SA': 'SAUDI_ARABIA', 'AE': 'UAE', 'IL': 'ISRAEL'
};

/**
 * Run profile inference for streamers missing category or country data
 */
export async function runProfileInference(batchSize: number = 50, minConfidence: number = 60): Promise<{
  processed: number;
  updated: number;
  errors: number;
}> {
  logger.info(`🧠 [ProfileInference] Starting inference job (batch: ${batchSize})`);

  let processed = 0;
  let updated = 0;
  let errors = 0;

  try {
    // Find streamers that need inference (missing category OR country with enough profile data)
    const streamers = await db.streamer.findMany({
      where: {
        AND: [
          // Must be missing at least one inferred field
          {
            OR: [
              { inferredCategory: null },
              { inferredCountry: null }
            ]
          },
          // Must have some profile data to analyze
          {
            OR: [
              { profileDescription: { not: null } },
              { aboutSection: { not: null } },
              { NOT: { tags: { isEmpty: true } } },
              { currentGame: { not: null } },
              { NOT: { topGames: { isEmpty: true } } }
            ]
          }
        ]
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        profileDescription: true,
        aboutSection: true,
        tags: true,
        currentGame: true,
        topGames: true,
        streamTitles: true,
        panelTexts: true,
        language: true,
        externalLinks: true,
        platform: true,
        inferredCategory: true,
        inferredCountry: true
      },
      take: batchSize,
      orderBy: {
        followers: 'desc' // Prioritize high-follower accounts
      }
    });

    if (streamers.length === 0) {
      logger.info('🧠 [ProfileInference] No streamers need inference');
      return { processed: 0, updated: 0, errors: 0 };
    }

    logger.info(`🧠 [ProfileInference] Processing ${streamers.length} streamers`);

    // Process inference with batching
    const results = await claudeService.batchInferMetadata(
      streamers.map(s => ({
        ...s,
        streamTitles: s.streamTitles as Array<{ title: string }> | null
      })),
      5 // Concurrency limit
    );

    // Update database with results
    for (const streamer of streamers) {
      processed++;
      const inference = results.get(streamer.id);

      if (!inference) {
        errors++;
        continue;
      }

      try {
        const updateData: any = {};

        // Update category if confidence meets threshold and not already set
        if (inference.category && inference.categoryConfidence >= minConfidence && !streamer.inferredCategory) {
          updateData.inferredCategory = inference.category;
          updateData.inferredCategorySource = 'HAIKU_INFERENCE';
        }

        // Update country if confidence meets threshold and not already set
        if (inference.country && inference.countryConfidence >= minConfidence && !streamer.inferredCountry) {
          updateData.inferredCountry = inference.country;
          updateData.inferredCountrySource = 'HAIKU_INFERENCE';

          // Also update region if we can map the country
          const regionValue = countryToRegion[inference.country.toUpperCase()];
          if (regionValue) {
            updateData.region = regionValue;
          }
        }

        if (Object.keys(updateData).length > 0) {
          await db.streamer.update({
            where: { id: streamer.id },
            data: updateData
          });

          // Audit log the AI change
          await auditService.log({
            tableName: 'discovery_creators',
            recordId: streamer.id,
            action: 'UPDATE',
            changedBy: 'AI_HAIKU',
            oldValues: {
              inferredCategory: streamer.inferredCategory,
              inferredCountry: streamer.inferredCountry
            },
            newValues: updateData
          });

          updated++;
          logger.info(`🧠 [ProfileInference] Updated ${streamer.username}: category=${inference.category} (${inference.categoryConfidence}%), country=${inference.country} (${inference.countryConfidence}%)`);
        }
      } catch (updateError) {
        errors++;
        logger.error(`🧠 [ProfileInference] Error updating ${streamer.username}:`, updateError);
      }
    }

    logger.info(`🧠 [ProfileInference] Complete: ${processed} processed, ${updated} updated, ${errors} errors`);
    return { processed, updated, errors };

  } catch (error) {
    logger.error('🧠 [ProfileInference] Job failed:', error);
    return { processed, updated, errors: errors + 1 };
  }
}

/**
 * Run inference for a specific streamer by ID
 */
export async function inferStreamerMetadata(streamerId: string): Promise<{
  category: string | null;
  country: string | null;
  updated: boolean;
}> {
  try {
    const streamer = await db.streamer.findUnique({
      where: { id: streamerId },
      select: {
        id: true,
        username: true,
        displayName: true,
        profileDescription: true,
        aboutSection: true,
        tags: true,
        currentGame: true,
        topGames: true,
        streamTitles: true,
        panelTexts: true,
        language: true,
        externalLinks: true,
        platform: true
      }
    });

    if (!streamer) {
      throw new Error(`Streamer ${streamerId} not found`);
    }

    const inference = await claudeService.inferProfileMetadata({
      ...streamer,
      streamTitles: streamer.streamTitles as Array<{ title: string }> | null
    });

    const updateData: any = {};

    if (inference.category && inference.categoryConfidence >= 50) {
      updateData.inferredCategory = inference.category;
      updateData.inferredCategorySource = 'HAIKU_INFERENCE';
    }

    if (inference.country && inference.countryConfidence >= 50) {
      updateData.inferredCountry = inference.country;
      updateData.inferredCountrySource = 'HAIKU_INFERENCE';

      const regionValue = countryToRegion[inference.country.toUpperCase()];
      if (regionValue) {
        updateData.region = regionValue;
      }
    }

    if (Object.keys(updateData).length > 0) {
      await db.streamer.update({
        where: { id: streamerId },
        data: updateData
      });
    }

    return {
      category: inference.category,
      country: inference.country,
      updated: Object.keys(updateData).length > 0
    };

  } catch (error) {
    logger.error(`🧠 [ProfileInference] Error inferring metadata for ${streamerId}:`, error);
    throw error;
  }
}

// Cron job: Run every 30 minutes to process pending streamers
export const profileInferenceJob = cron.schedule('*/30 * * * *', async () => {
  console.log('\n🧠 [CRON] Profile inference job triggered');
  try {
    const result = await runProfileInference(50, 60);
    console.log(`🧠 [CRON] Profile inference complete: ${result.updated} updated`);
  } catch (error) {
    console.error('❌ [CRON] Profile inference failed:', error);
  }
}, {
  scheduled: false
});
