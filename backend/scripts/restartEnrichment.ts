import { PrismaClient } from '@prisma/client';
import { AdvancedEnrichmentService } from '../src/services/advancedEnrichmentService';

// Simple logger replacement
const logger = {
  info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
  error: (msg: string, data?: any) => console.error(`[ERROR] ${msg}`, data || ''),
};

// Create Prisma client with smaller connection pool
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?connection_limit=5&pool_timeout=30',
    },
  },
});

async function restartEnrichment() {
  try {
    logger.info('🔄 Restarting enrichment process...');

    const enrichmentService = new AdvancedEnrichmentService();

    // Get count of remaining streamers
    const totalStreamers = await prisma.streamer.count();
    const enrichedCount = await prisma.streamer.count({
      where: {
        lastEnrichmentUpdate: { not: null },
      },
    });

    const remaining = totalStreamers - enrichedCount;

    logger.info(`📊 Enrichment Status:`, {
      total: totalStreamers,
      enriched: enrichedCount,
      remaining: remaining,
      percentage: ((enrichedCount / totalStreamers) * 100).toFixed(2) + '%',
    });

    // Start continuous enrichment with better error handling
    logger.info('🚀 Starting continuous enrichment...');

    let processed = 0;
    let errors = 0;
    const batchSize = 10;

    while (true) {
      try {
        // Get unenriched streamers in small batches
        const unenrichedStreamers = await prisma.streamer.findMany({
          where: {
            lastEnrichmentUpdate: null,
          },
          take: batchSize,
          select: {
            id: true,
            username: true,
            platform: true,
          },
        });

        if (unenrichedStreamers.length === 0) {
          logger.info('✅ All streamers have been enriched!');
          break;
        }

        logger.info(`📦 Processing batch of ${unenrichedStreamers.length} streamers...`);

        // Process streamers one at a time to avoid overwhelming the system
        for (const streamer of unenrichedStreamers) {
          try {
            await enrichmentService.enrichStreamer(streamer.id);
            processed++;

            if (processed % 10 === 0) {
              logger.info(`✅ Progress: ${processed} streamers enriched, ${errors} errors`);
            }

            // Add delay between enrichments to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (error: any) {
            errors++;
            logger.error(`❌ Failed to enrich ${streamer.platform}:${streamer.username}`, {
              error: error.message,
            });

            // Continue with next streamer instead of stopping
            continue;
          }
        }

        // Longer delay between batches
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (batchError: any) {
        logger.error('❌ Batch processing error:', { error: batchError.message });

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }

    logger.info(`🎉 Enrichment completed! Processed: ${processed}, Errors: ${errors}`);

    await prisma.$disconnect();
    process.exit(0);
  } catch (error: any) {
    logger.error('❌ Fatal enrichment error:', { error: error.message });
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('⚠️  Received SIGINT, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('⚠️  Received SIGTERM, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

// Start enrichment
restartEnrichment();
