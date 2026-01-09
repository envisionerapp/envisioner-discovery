import cron from 'node-cron';
import { ScrapingJobQueue } from './scrapingQueue';
import { db, logger } from '../utils/database';
import { Platform } from '@prisma/client';
import { TwitchScraper } from '../scrapers/twitchScraper';
import { YouTubeScraper } from '../scrapers/youtubeScraper';
import { KickScraper } from '../scrapers/kickScraper';

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

  // Incremental scraping every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    try {
      logger.info('Starting scheduled incremental scraping...');
      const queueStats = await scrapingQueue.getQueueStats();

      if (queueStats.active < 2 && queueStats.waiting < 5) {
        await scrapingQueue.addIncrementalJob();
      } else {
        logger.info('Skipping incremental scraping - queue is busy', queueStats);
      }
    } catch (error) {
      logger.error('Error starting scheduled incremental scraping:', error);
    }
  });

  // Platform-specific trending scraping every 30 minutes (staggered)
  cron.schedule('5,35 * * * *', async () => {
    try {
      logger.info('Starting Twitch trending scraping...');
      await scrapingQueue.addTrendingScrapingJob(Platform.TWITCH, 50);
    } catch (error) {
      logger.error('Error starting Twitch trending scraping:', error);
    }
  });

  // DISABLED: YouTube trending scraping
  // cron.schedule('15,45 * * * *', async () => {
  //   try {
  //     logger.info('Starting YouTube trending scraping...');
  //     await scrapingQueue.addTrendingScrapingJob(Platform.YOUTUBE, 30);
  //   } catch (error) {
  //     logger.error('Error starting YouTube trending scraping:', error);
  //   }
  // });

  cron.schedule('25,55 * * * *', async () => {
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

  logger.info('Scheduled jobs initialized');
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
