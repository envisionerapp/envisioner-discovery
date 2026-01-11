import Queue from 'bull';
import { db, logger } from '../utils/database';
import { TwitchScraper } from '../scrapers/twitchScraper';
import { YouTubeScraper } from '../scrapers/youtubeScraper';
import { KickScraper } from '../scrapers/kickScraper';
import { Platform, Streamer } from '@prisma/client';
import { inferCategory } from '../utils/categoryMapper';

interface ScrapingJobData {
  platform?: Platform;
  type: 'incremental' | 'full' | 'specific' | 'trending';
  streamerIds?: string[];
  usernames?: string[];
  limit?: number;
}

interface ScrapingResult {
  platform: Platform;
  success: boolean;
  recordsFound: number;
  recordsUpdated: number;
  recordsCreated: number;
  errors: string[];
  duration: number;
}

export class ScrapingJobQueue {
  private queue: Queue.Queue<ScrapingJobData>;
  private twitchScraper: TwitchScraper;
  private youtubeScraper: YouTubeScraper;
  private kickScraper: KickScraper;
  private readonly REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

  constructor() {
    this.queue = new Queue('scraping', this.REDIS_URL, {
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 20,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    });

    this.twitchScraper = new TwitchScraper();
    this.youtubeScraper = new YouTubeScraper();
    this.kickScraper = new KickScraper();

    this.setupJobProcessors();
    this.setupEventHandlers();
  }

  private setupJobProcessors(): void {
    this.queue.process('incremental-scraping', 2, this.processIncrementalScraping.bind(this));
    this.queue.process('full-scraping', 1, this.processFullScraping.bind(this));
    this.queue.process('specific-scraping', 3, this.processSpecificScraping.bind(this));
    this.queue.process('trending-scraping', 1, this.processTrendingScraping.bind(this));
  }

  private setupEventHandlers(): void {
    this.queue.on('completed', (job, result: ScrapingResult) => {
      logger.info(`Scraping job completed: ${job.name} for ${result.platform}`, {
        jobId: job.id,
        duration: result.duration,
        recordsUpdated: result.recordsUpdated,
        recordsCreated: result.recordsCreated
      });
    });

    this.queue.on('failed', (job, err) => {
      logger.error(`Scraping job failed: ${job.name}`, {
        jobId: job.id,
        error: err.message,
        data: job.data
      });
    });

    this.queue.on('stalled', (job) => {
      logger.warn(`Scraping job stalled: ${job.name}`, {
        jobId: job.id,
        data: job.data
      });
    });
  }

  private async processIncrementalScraping(job: Queue.Job<ScrapingJobData>): Promise<ScrapingResult> {
    const { platform } = job.data;
    const startTime = Date.now();

    logger.info(`Starting incremental scraping for platform: ${platform || 'all'}`);

    if (platform) {
      return await this.scrapeByPlatform(platform, 'incremental');
    }

    const results: ScrapingResult[] = [];
    for (const platformType of [Platform.TWITCH, Platform.YOUTUBE, Platform.KICK]) {
      try {
        const result = await this.scrapeByPlatform(platformType, 'incremental');
        results.push(result);
      } catch (error) {
        logger.error(`Error in incremental scraping for ${platformType}:`, error);
        results.push({
          platform: platformType,
          success: false,
          recordsFound: 0,
          recordsUpdated: 0,
          recordsCreated: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          duration: Date.now() - startTime
        });
      }
    }

    const aggregatedResult: ScrapingResult = {
      platform: Platform.TWITCH,
      success: results.some(r => r.success),
      recordsFound: results.reduce((sum, r) => sum + r.recordsFound, 0),
      recordsUpdated: results.reduce((sum, r) => sum + r.recordsUpdated, 0),
      recordsCreated: results.reduce((sum, r) => sum + r.recordsCreated, 0),
      errors: results.flatMap(r => r.errors),
      duration: Date.now() - startTime
    };

    await this.logScrapingResult(aggregatedResult);
    return aggregatedResult;
  }

  private async processFullScraping(job: Queue.Job<ScrapingJobData>): Promise<ScrapingResult> {
    const startTime = Date.now();
    logger.info('Starting full platform scraping');

    const results: ScrapingResult[] = [];
    for (const platform of [Platform.TWITCH, Platform.YOUTUBE, Platform.KICK]) {
      try {
        const result = await this.scrapeByPlatform(platform, 'full');
        results.push(result);
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error) {
        logger.error(`Error in full scraping for ${platform}:`, error);
        results.push({
          platform,
          success: false,
          recordsFound: 0,
          recordsUpdated: 0,
          recordsCreated: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          duration: Date.now() - startTime
        });
      }
    }

    const aggregatedResult: ScrapingResult = {
      platform: Platform.TWITCH,
      success: results.some(r => r.success),
      recordsFound: results.reduce((sum, r) => sum + r.recordsFound, 0),
      recordsUpdated: results.reduce((sum, r) => sum + r.recordsUpdated, 0),
      recordsCreated: results.reduce((sum, r) => sum + r.recordsCreated, 0),
      errors: results.flatMap(r => r.errors),
      duration: Date.now() - startTime
    };

    await this.logScrapingResult(aggregatedResult);
    return aggregatedResult;
  }

  private async processSpecificScraping(job: Queue.Job<ScrapingJobData>): Promise<ScrapingResult> {
    const { platform, usernames, streamerIds } = job.data;
    const startTime = Date.now();

    if (!platform) {
      throw new Error('Platform is required for specific scraping');
    }

    if (!usernames?.length && !streamerIds?.length) {
      throw new Error('Usernames or streamer IDs are required for specific scraping');
    }

    let targetUsernames = usernames || [];

    if (streamerIds?.length && !usernames?.length) {
      const streamers = await db.streamer.findMany({
        where: { id: { in: streamerIds }, platform },
        select: { username: true }
      });
      targetUsernames = streamers.map(s => s.username);
    }

    logger.info(`Starting specific scraping for ${targetUsernames.length} ${platform} streamers`);

    const result = await this.scrapeSpecificStreamers(platform, targetUsernames);
    await this.logScrapingResult(result);

    return result;
  }

  private async processTrendingScraping(job: Queue.Job<ScrapingJobData>): Promise<ScrapingResult> {
    const { platform, limit = 50 } = job.data;
    const startTime = Date.now();

    if (!platform) {
      throw new Error('Platform is required for trending scraping');
    }

    logger.info(`Starting trending scraping for ${platform} (limit: ${limit})`);

    const result = await this.scrapeTrendingStreamers(platform, limit);
    await this.logScrapingResult(result);

    return result;
  }

  private async scrapeByPlatform(platform: Platform, type: 'incremental' | 'full'): Promise<ScrapingResult> {
    const startTime = Date.now();
    const result: ScrapingResult = {
      platform,
      success: false,
      recordsFound: 0,
      recordsUpdated: 0,
      recordsCreated: 0,
      errors: [],
      duration: 0
    };

    try {
      if (type === 'incremental') {
        const existingStreamers = await db.streamer.findMany({
          where: {
            platform,
            OR: [
              { lastScrapedAt: { lt: new Date(Date.now() - 30 * 60 * 1000) } },
              { lastScrapedAt: null }
            ]
          },
          select: { username: true },
          take: 100
        });

        const usernames = existingStreamers.map(s => s.username);
        if (usernames.length > 0) {
          const scrapedData = await this.scrapeWithPlatform(platform, usernames);
          await this.saveStreamersToDatabase(platform, scrapedData);
          result.recordsFound = scrapedData.length;
          result.recordsUpdated = scrapedData.length;
        }
      } else {
        const scrapedData = await this.scrapeTrendingStreamers(platform, 100);
        result.recordsFound = scrapedData.recordsFound;
        result.recordsCreated = scrapedData.recordsCreated;
        result.recordsUpdated = scrapedData.recordsUpdated;
      }

      result.success = true;
      result.duration = Date.now() - startTime;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      result.duration = Date.now() - startTime;
      throw error;
    }

    return result;
  }

  private async scrapeSpecificStreamers(platform: Platform, usernames: string[]): Promise<ScrapingResult> {
    const startTime = Date.now();
    const result: ScrapingResult = {
      platform,
      success: false,
      recordsFound: 0,
      recordsUpdated: 0,
      recordsCreated: 0,
      errors: [],
      duration: 0
    };

    try {
      const scrapedData = await this.scrapeWithPlatform(platform, usernames);
      const dbResult = await this.saveStreamersToDatabase(platform, scrapedData);

      result.recordsFound = scrapedData.length;
      result.recordsCreated = dbResult.created;
      result.recordsUpdated = dbResult.updated;
      result.success = true;
      result.duration = Date.now() - startTime;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      result.duration = Date.now() - startTime;
      throw error;
    }

    return result;
  }

  private async scrapeTrendingStreamers(platform: Platform, limit: number): Promise<ScrapingResult> {
    const startTime = Date.now();
    const result: ScrapingResult = {
      platform,
      success: false,
      recordsFound: 0,
      recordsUpdated: 0,
      recordsCreated: 0,
      errors: [],
      duration: 0
    };

    try {
      let scrapedData: any[] = [];

      switch (platform) {
        case Platform.TWITCH:
          scrapedData = await this.twitchScraper.scrapeTrendingStreamers(limit);
          break;
        case Platform.YOUTUBE:
          scrapedData = await this.youtubeScraper.scrapeTrendingStreamers(limit);
          break;
        case Platform.KICK:
          scrapedData = await this.kickScraper.scrapeTrendingStreamers(limit);
          break;
      }

      const dbResult = await this.saveStreamersToDatabase(platform, scrapedData);

      result.recordsFound = scrapedData.length;
      result.recordsCreated = dbResult.created;
      result.recordsUpdated = dbResult.updated;
      result.success = true;
      result.duration = Date.now() - startTime;
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      result.duration = Date.now() - startTime;
      throw error;
    }

    return result;
  }

  private async scrapeWithPlatform(platform: Platform, usernames: string[]): Promise<any[]> {
    switch (platform) {
      case Platform.TWITCH:
        return await this.twitchScraper.scrapeStreamers(usernames);
      case Platform.YOUTUBE:
        return await this.youtubeScraper.scrapeStreamers(usernames);
      case Platform.KICK:
        return await this.kickScraper.scrapeStreamers(usernames);
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  private async saveStreamersToDatabase(platform: Platform, streamersData: any[]): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    for (const streamerData of streamersData) {
      try {
        const existingStreamer = await db.streamer.findUnique({
          where: {
            platform_username: {
              platform,
              username: streamerData.username
            }
          }
        });

        // Handle stream titles with dates
        let streamTitles = existingStreamer?.streamTitles as Array<{title: string, date: string}> || [];

        // Add new stream title if live and has a title
        if (streamerData.isLive && streamerData.streamTitle) {
          const newEntry = {
            title: streamerData.streamTitle,
            date: new Date().toISOString()
          };

          // Check if this exact title already exists in the last 24 hours
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const isDuplicate = streamTitles.some(entry =>
            entry.title === streamerData.streamTitle &&
            new Date(entry.date) > oneDayAgo
          );

          if (!isDuplicate) {
            streamTitles = [newEntry, ...streamTitles].slice(0, 50); // Keep last 50 titles
          }
        }

        const streamerRecord: Record<string, any> = {
          platform,
          username: streamerData.username,
          displayName: streamerData.displayName,
          profileUrl: streamerData.profileUrl,
          avatarUrl: streamerData.avatarUrl,
          followers: streamerData.followers,
          currentViewers: streamerData.currentViewers,
          isLive: streamerData.isLive,
          currentGame: streamerData.currentGame,
          lastStreamed: streamerData.lastStreamed,
          language: streamerData.language,
          tags: streamerData.tags,
          region: streamerData.region,
          usesCamera: streamerData.usesCamera,
          isVtuber: streamerData.isVtuber,
          socialLinks: streamerData.socialLinks,
          streamTitles: streamTitles,
          lastScrapedAt: new Date(),
          updatedAt: new Date()
        };

        // For YouTube, store the direct country code from the API
        // This is the most reliable country source and will be used for cross-platform unification
        if (platform === Platform.YOUTUBE && streamerData.countryCode) {
          streamerRecord.inferredCountry = streamerData.countryCode;
          streamerRecord.inferredCountrySource = 'YOUTUBE';
        }

        // Infer category from game/content - this makes "Gaming" cover all games
        const category = inferCategory(
          streamerData.currentGame,
          streamerData.topGames,
          streamerData.tags,
          streamerData.description
        );
        streamerRecord.primaryCategory = category;
        streamerRecord.inferredCategory = category;
        streamerRecord.inferredCategorySource = platform;

        if (existingStreamer) {
          await db.streamer.update({
            where: { id: existingStreamer.id },
            data: streamerRecord
          });
          updated++;
        } else {
          await db.streamer.create({
            data: streamerRecord
          });
          created++;
        }
      } catch (error) {
        logger.error(`Error saving streamer ${streamerData.username}:`, error);
      }
    }

    return { created, updated };
  }

  private async logScrapingResult(result: ScrapingResult): Promise<void> {
    try {
      await db.scrapingLog.create({
        data: {
          platform: result.platform,
          success: result.success,
          recordsFound: result.recordsFound,
          recordsUpdated: result.recordsUpdated + result.recordsCreated,
          errors: result.errors,
          startedAt: new Date(Date.now() - result.duration),
          completedAt: new Date(),
          duration: result.duration
        }
      });
    } catch (error) {
      logger.error('Error logging scraping result:', error);
    }
  }

  async addIncrementalJob(platform?: Platform): Promise<void> {
    await this.queue.add('incremental-scraping', {
      platform,
      type: 'incremental'
    }, {
      priority: 5,
      delay: 0
    });

    logger.info(`Added incremental scraping job for ${platform || 'all platforms'}`);
  }

  async addFullScrapingJob(): Promise<void> {
    await this.queue.add('full-scraping', {
      type: 'full'
    }, {
      priority: 1,
      delay: 0
    });

    logger.info('Added full scraping job');
  }

  async addSpecificStreamerJob(platform: Platform, usernames: string[]): Promise<void> {
    await this.queue.add('specific-scraping', {
      platform,
      type: 'specific',
      usernames
    }, {
      priority: 10,
      delay: 0
    });

    logger.info(`Added specific streamer job for ${usernames.length} ${platform} streamers`);
  }

  /**
   * Add a scraping job for specific streamer IDs (used by tiered sync)
   */
  async addSpecificScrapingJob(streamerIds: string[], description: string = 'Specific scraping'): Promise<void> {
    // Group streamers by platform
    const streamers = await db.streamer.findMany({
      where: { id: { in: streamerIds } },
      select: { id: true, platform: true, username: true }
    });

    const byPlatform = new Map<Platform, string[]>();
    for (const s of streamers) {
      if (!byPlatform.has(s.platform)) {
        byPlatform.set(s.platform, []);
      }
      byPlatform.get(s.platform)!.push(s.username);
    }

    // Add a job for each platform
    for (const [platform, usernames] of byPlatform) {
      await this.queue.add('specific-scraping', {
        platform,
        type: 'specific',
        usernames
      }, {
        priority: 8,
        delay: 0
      });
    }

    logger.info(`${description}: Added jobs for ${streamerIds.length} streamers across ${byPlatform.size} platforms`);
  }

  async addTrendingScrapingJob(platform: Platform, limit: number = 50): Promise<void> {
    await this.queue.add('trending-scraping', {
      platform,
      type: 'trending',
      limit
    }, {
      priority: 3,
      delay: 0
    });

    logger.info(`Added trending scraping job for ${platform} (limit: ${limit})`);
  }

  async getQueueStats() {
    const counts = await this.queue.getJobCounts();
    return {
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
    } as any;
  }

  async pauseQueue(): Promise<void> {
    await this.queue.pause();
    logger.info('Scraping queue paused');
  }

  async resumeQueue(): Promise<void> {
    await this.queue.resume();
    logger.info('Scraping queue resumed');
  }

  async clearQueue(): Promise<void> {
    await this.queue.empty();
    logger.info('Scraping queue cleared');
  }

  async closeQueue(): Promise<void> {
    await this.twitchScraper.close();
    await this.youtubeScraper.close();
    await this.kickScraper.close();
    await this.queue.close();
    logger.info('Scraping queue and scrapers closed');
  }
}
