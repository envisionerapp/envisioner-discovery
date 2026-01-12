import cron from 'node-cron';
import { ScrapingJobQueue } from './scrapingQueue';
import { db, logger } from '../utils/database';
import { Platform, SyncTier } from '@prisma/client';
import { TwitchScraper } from '../scrapers/twitchScraper';
import { YouTubeScraper } from '../scrapers/youtubeScraper';
import { KickScraper } from '../scrapers/kickScraper';
import { syncOptimization } from '../services/syncOptimizationService';
// Social Extraction Jobs - extract social links from existing profiles
import {
  twitchExtractionJob,
  kickExtractionJob,
  youtubeExtractionJob,
} from './socialExtractionJob';

// DISABLED: Keyword-based discovery has poor results (~500 creators from keywords vs 14,000+ from imports)
// Keeping imports for reference but not using them
// import { runDiscovery, runQuickDiscovery, runFullDiscovery } from './discoveryJob';
// import { runSocialDiscovery, runQuickSocialDiscovery, runFullSocialDiscovery, runInfluencerDiscovery } from './socialDiscoveryJob';
// import { runEnhancedTwitchDiscovery, runQuickTwitchDiscovery } from './enhancedTwitchDiscovery';
// import { runYouTubeDiscovery, runQuickYouTubeDiscovery } from './youtubeDiscoveryJob';

const scrapingQueue = new ScrapingJobQueue();
let healthCheckScrapers: {
  twitch: TwitchScraper;
  youtube: YouTubeScraper;
  kick: KickScraper;
} | null = null;

const initializeHealthCheckScrapers = async () => {
  if (!healthCheckScrapers) {
    healthCheckScrapers = {
      twitch: new TwitchScraper(),
      youtube: new YouTubeScraper(),
      kick: new KickScraper()
    };
  }
};

export const startScheduledJobs = async () => {
  logger.info('Starting scheduled jobs...');
  await initializeHealthCheckScrapers();

  // LEGACY: Incremental scraping disabled - replaced by tiered sync
  // Now using tier-based sync (HOT/ACTIVE/STANDARD/COLD) for better credit optimization
  // See tiered sync jobs below

  // Platform-specific trending scraping every hour (reduced from 30 min)
  cron.schedule('5 * * * *', async () => {
    try {
      logger.info('Starting Twitch trending scraping...');
      await scrapingQueue.addTrendingScrapingJob(Platform.TWITCH, 50);
    } catch (error) {
      logger.error('Error starting Twitch trending scraping:', error);
    }
  });

  cron.schedule('35 * * * *', async () => {
    try {
      logger.info('Starting Kick trending scraping...');
      await scrapingQueue.addTrendingScrapingJob(Platform.KICK, 25);
    } catch (error) {
      logger.error('Error starting Kick trending scraping:', error);
    }
  });

  // Full refresh weekly (Sunday at 2 AM)
  cron.schedule('0 2 * * 0', async () => {
    try {
      logger.info('Starting scheduled full refresh scraping...');
      await scrapingQueue.addFullScrapingJob();
    } catch (error) {
      logger.error('Error starting full refresh scraping:', error);
    }
  });

  // Clean up old data monthly (first day at 1 AM)
  cron.schedule('0 1 1 * *', async () => {
    try {
      logger.info('Starting monthly cleanup...');
      await performMonthlyCleanup();
    } catch (error) {
      logger.error('Error running monthly cleanup:', error);
    }
  });

  // Health check and system monitoring every hour
  cron.schedule('0 * * * *', async () => {
    try {
      logger.info('Running hourly health check...');
      await performHealthCheck();
    } catch (error) {
      logger.error('Error running health check:', error);
    }
  });

  // Queue statistics logging every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      const stats = await scrapingQueue.getQueueStats();
      logger.info('Queue statistics', stats);

      if (stats.failed > 10) {
        logger.warn('High number of failed jobs detected', { failedJobs: stats.failed });
      }

      if (stats.active === 0 && stats.waiting > 20) {
        logger.warn('Queue appears stalled', stats);
        await scrapingQueue.resumeQueue();
      }
    } catch (error) {
      logger.error('Error getting queue statistics:', error);
    }
  });

  // Database optimization weekly (Saturday at 3 AM)
  cron.schedule('0 3 * * 6', async () => {
    try {
      logger.info('Starting database optimization...');
      await performDatabaseOptimization();
    } catch (error) {
      logger.error('Error running database optimization:', error);
    }
  });

  // ============================================
  // TIERED SYNC OPTIMIZATION JOBS
  // ============================================

  // HOT tier sync - every 5 minutes (live streamers, high viewers)
  cron.schedule('*/5 * * * *', async () => {
    try {
      const hasBudget = await syncOptimization.hasBudget('twitch');
      if (!hasBudget) {
        logger.warn('Skipping HOT tier sync - daily budget exhausted for Twitch');
        return;
      }

      const streamersToSync = await syncOptimization.getStreamersNeedingSync(
        SyncTier.HOT,
        'platform',
        50
      );

      if (streamersToSync.length > 0) {
        logger.info(`HOT tier sync: ${streamersToSync.length} streamers need syncing`);
        await scrapingQueue.addSpecificScrapingJob(
          streamersToSync.map(s => s.id),
          'HOT tier sync'
        );
      }
    } catch (error) {
      logger.error('Error in HOT tier sync:', error);
    }
  });

  // ACTIVE tier sync - every 30 minutes
  cron.schedule('*/30 * * * *', async () => {
    try {
      const streamersToSync = await syncOptimization.getStreamersNeedingSync(
        SyncTier.ACTIVE,
        'platform',
        100
      );

      if (streamersToSync.length > 0) {
        logger.info(`ACTIVE tier sync: ${streamersToSync.length} streamers need syncing`);
        await scrapingQueue.addSpecificScrapingJob(
          streamersToSync.map(s => s.id),
          'ACTIVE tier sync'
        );
      }
    } catch (error) {
      logger.error('Error in ACTIVE tier sync:', error);
    }
  });

  // STANDARD tier sync - every 2 hours
  cron.schedule('0 */2 * * *', async () => {
    try {
      const streamersToSync = await syncOptimization.getStreamersNeedingSync(
        SyncTier.STANDARD,
        'platform',
        100
      );

      if (streamersToSync.length > 0) {
        logger.info(`STANDARD tier sync: ${streamersToSync.length} streamers need syncing`);
        await scrapingQueue.addSpecificScrapingJob(
          streamersToSync.map(s => s.id),
          'STANDARD tier sync'
        );
      }
    } catch (error) {
      logger.error('Error in STANDARD tier sync:', error);
    }
  });

  // COLD tier sync - daily at 4 AM
  cron.schedule('0 4 * * *', async () => {
    try {
      const streamersToSync = await syncOptimization.getStreamersNeedingSync(
        SyncTier.COLD,
        'platform',
        200
      );

      if (streamersToSync.length > 0) {
        logger.info(`COLD tier sync: ${streamersToSync.length} streamers need syncing`);
        await scrapingQueue.addSpecificScrapingJob(
          streamersToSync.map(s => s.id),
          'COLD tier sync'
        );
      }
    } catch (error) {
      logger.error('Error in COLD tier sync:', error);
    }
  });

  // Tier recalculation - daily at 3 AM
  cron.schedule('0 3 * * *', async () => {
    try {
      logger.info('Starting daily tier recalculation...');
      const result = await syncOptimization.recalculateAllTiers();
      logger.info('Tier recalculation complete', result);
    } catch (error) {
      logger.error('Error in tier recalculation:', error);
    }
  });

  // Credit usage report - every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    try {
      const stats = await syncOptimization.getSyncStats();
      logger.info('Sync optimization stats', {
        tierDistribution: stats.tierDistribution,
        dailyCredits: stats.dailyCredits,
      });

      // Warn if approaching budget limits
      const scrapecreatorsBudget = 3300; // Daily budget
      if (stats.dailyCredits.byProvider['scrapecreators'] > scrapecreatorsBudget * 0.8) {
        logger.warn('ScrapeCreators credits at 80% of daily budget', stats.dailyCredits);
      }
    } catch (error) {
      logger.error('Error generating credit usage report:', error);
    }
  });

  // ============================================
  // SOCIAL EXTRACTION JOBS - Extract social links from existing profiles
  // ============================================
  // This replaces keyword-based discovery which had poor results.
  // Stats showed: ~500 creators from keywords vs 14,000+ from imports
  // The real value is extracting social links from profiles we already have.

  // Start the social extraction jobs
  twitchExtractionJob.start();
  kickExtractionJob.start();
  youtubeExtractionJob.start();

  logger.info('🔗 Social extraction jobs started:');
  logger.info('   - Twitch: Every 2 hours (FREE - Twitch GQL API)');
  logger.info('   - Kick: Every 2 hours offset 30min (FREE - Kick API)');
  logger.info('   - YouTube: Every 4 hours (~100 credits/run = 600/day)');

  // ============================================
  // DISABLED: Keyword-based discovery jobs
  // ============================================
  // These jobs are disabled because they have very poor results:
  // - Discovery keywords are too narrow (e.g., "slots streamer")
  // - Only ~500 creators found via keyword discovery
  // - Most creators came from CSV imports, not automated discovery
  //
  // If you need to re-enable, uncomment the imports at the top of this file
  // and uncomment the job schedules below.
  //
  // Previously enabled jobs:
  // - Quick discovery every 2 hours
  // - Full discovery every 6 hours
  // - iGaming discovery every 4 hours
  // - Quick social discovery every 3 hours
  // - Full social discovery daily at 6 AM
  // - Influencer discovery twice daily
  // - Enhanced Twitch Discovery 4x daily
  // - Quick Twitch Discovery 2x daily
  // - YouTube Discovery 3x daily
  // - Quick YouTube Discovery 2x daily

  logger.info('Scheduled jobs initialized (with tiered sync + social extraction)');
};

const performHealthCheck = async (): Promise<void> => {
  if (!healthCheckScrapers) {
    await initializeHealthCheckScrapers();
  }

  const healthResults = {
    twitch: false,
    youtube: false,
    kick: false,
    database: false,
    queue: false
  };

  try {
    healthResults.twitch = await healthCheckScrapers!.twitch.healthCheck();
    healthResults.youtube = await healthCheckScrapers!.youtube.healthCheck();
    healthResults.kick = await healthCheckScrapers!.kick.healthCheck();

    healthResults.database = await testDatabaseConnection();
    healthResults.queue = await testQueueConnection();

    const healthyServices = Object.values(healthResults).filter(Boolean).length;
    const totalServices = Object.keys(healthResults).length;

    logger.info(`System health check completed: ${healthyServices}/${totalServices} services healthy`, healthResults);

    if (healthyServices < totalServices * 0.8) {
      logger.error('System health critical - multiple services failing', healthResults);
    }

    await logSystemHealth(healthResults);
  } catch (error) {
    logger.error('Health check failed:', error);
  }
};

const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
};

const testQueueConnection = async (): Promise<boolean> => {
  try {
    await scrapingQueue.getQueueStats();
    return true;
  } catch (error) {
    logger.error('Queue health check failed:', error);
    return false;
  }
};

const logSystemHealth = async (healthResults: Record<string, boolean>): Promise<void> => {
  try {
    const healthScore = Object.values(healthResults).filter(Boolean).length / Object.keys(healthResults).length;

    await db.systemConfig.upsert({
      where: { key: 'last_health_check' },
      update: {
        value: JSON.stringify({
          timestamp: new Date().toISOString(),
          score: healthScore,
          details: healthResults
        })
      },
      create: {
        key: 'last_health_check',
        value: JSON.stringify({
          timestamp: new Date().toISOString(),
          score: healthScore,
          details: healthResults
        })
      }
    });
  } catch (error) {
    logger.error('Error logging system health:', error);
  }
};

const performMonthlyCleanup = async (): Promise<void> => {
  try {
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const cleanupTasks = await Promise.allSettled([
      db.chatMessage.deleteMany({
        where: {
          timestamp: { lt: threeMonthsAgo }
        }
      }),

      db.scrapingLog.deleteMany({
        where: {
          startedAt: { lt: oneMonthAgo }
        }
      }),

      db.streamer.updateMany({
        where: {
          lastScrapedAt: { lt: threeMonthsAgo },
          isLive: false
        },
        data: {
          fraudCheck: 'PENDING_REVIEW'
        }
      })
    ]);

    const results = cleanupTasks.map((task, index) => {
      const taskNames = ['chat_messages', 'scraping_logs', 'inactive_streamers'];
      if (task.status === 'fulfilled') {
        return `${taskNames[index]}: ${(task.value as any).count || 0} records processed`;
      } else {
        return `${taskNames[index]}: failed - ${task.reason}`;
      }
    });

    logger.info('Monthly cleanup completed:', results);
  } catch (error) {
    logger.error('Monthly cleanup failed:', error);
  }
};

const performDatabaseOptimization = async (): Promise<void> => {
  try {
    logger.info('Running database optimization...');

    await Promise.allSettled([
      db.$executeRaw`VACUUM ANALYZE;`,
      db.$executeRaw`REINDEX DATABASE;`
    ]);

    const dbStats = await Promise.allSettled([
      db.streamer.count(),
      db.chatMessage.count(),
      db.scrapingLog.count(),
      db.campaign.count()
    ]);

    const stats = {
      streamers: dbStats[0].status === 'fulfilled' ? dbStats[0].value : 0,
      chatMessages: dbStats[1].status === 'fulfilled' ? dbStats[1].value : 0,
      scrapingLogs: dbStats[2].status === 'fulfilled' ? dbStats[2].value : 0,
      campaigns: dbStats[3].status === 'fulfilled' ? dbStats[3].value : 0
    };

    logger.info('Database optimization completed', stats);

    await db.systemConfig.upsert({
      where: { key: 'last_db_optimization' },
      update: {
        value: JSON.stringify({
          timestamp: new Date().toISOString(),
          stats
        })
      },
      create: {
        key: 'last_db_optimization',
        value: JSON.stringify({
          timestamp: new Date().toISOString(),
          stats
        })
      }
    });

  } catch (error) {
    logger.error('Database optimization failed:', error);
  }
};

export const stopScheduledJobs = async (): Promise<void> => {
  try {
    // node-cron does not expose a global destroy; tasks are stopped individually when needed

    if (healthCheckScrapers) {
      await Promise.all([
        healthCheckScrapers.twitch.close(),
        healthCheckScrapers.youtube.close(),
        healthCheckScrapers.kick.close()
      ]);
      healthCheckScrapers = null;
    }

    await scrapingQueue.closeQueue();
    logger.info('All scheduled jobs stopped');
  } catch (error) {
    logger.error('Error stopping scheduled jobs:', error);
  }
};

export { scrapingQueue };
