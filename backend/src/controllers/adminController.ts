import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { db, logger } from '../utils/database';
import { seedFromCsvIfEmpty } from '../utils/seedFromCsv';
import { replaceAllStreamersWithLocal } from '../utils/replaceAllStreamers';
import { tagScrapingService } from '../services/tagScrapingService';
import { StreamerService } from '../services/streamerService';

// Removed AuthRequest interface - using basic Request for now

export class AdminController {
  getSystemStats = asyncHandler(async (req: Request, res: Response) => {
    try {
      // Fetch last health check from system config
      const healthCheck = await db.systemConfig.findUnique({
        where: { key: 'last_health_check' }
      });

      // Fetch last db optimization
      const dbOptimization = await db.systemConfig.findUnique({
        where: { key: 'last_db_optimization' }
      });

      // Fetch recent scraping logs
      const recentScrapingLogs = await db.scrapingLog.findMany({
        orderBy: { startedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          platform: true,
          success: true,
          startedAt: true,
          completedAt: true,
          recordsFound: true,
          recordsUpdated: true,
          errors: true,
          duration: true
        }
      });

      // Get last live status check (most recent scraping log)
      const lastLiveCheck = await db.scrapingLog.findFirst({
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true, completedAt: true, success: true, platform: true }
      });

      const healthData = healthCheck?.value ? JSON.parse(healthCheck.value) : null;
      const dbOptData = dbOptimization?.value ? JSON.parse(dbOptimization.value) : null;

      res.status(200).json({
        success: true,
        data: {
          health: healthData,
          lastLiveCheck,
          recentScrapingLogs,
          dbOptimization: dbOptData
        },
      });
    } catch (error) {
      logger.error('Error fetching system stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch system stats',
        data: {},
      });
    }
  });

  getScrapingLogs = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Scraping logs coming soon',
      data: [],
    });
  });

  startScraping = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Scraping start coming soon',
    });
  });

  stopScraping = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Scraping stop coming soon',
    });
  });

  getScrapingStatus = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Scraping status coming soon',
      data: {},
    });
  });

  clearCache = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Cache clearing coming soon',
    });
  });

  getUsers = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'User management coming soon',
      data: [],
    });
  });

  disableUserMfa = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'MFA disable coming soon',
    });
  });

  /**
   * Remove duplicate avatar URLs across streamers (keep 1, clear others),
   * and clear known generic/default avatar patterns.
   */
  dedupeAvatars = asyncHandler(async (_req: Request, res: Response) => {
    let duplicatesCleared = 0;
    let duplicateGroups = 0;
    let genericCleared = 0;

    const streamers = await db.streamer.findMany({
      where: { avatarUrl: { not: null } },
      select: { id: true, username: true, avatarUrl: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const groups = new Map<string, typeof streamers>();
    for (const s of streamers) {
      const url = s.avatarUrl!;
      if (!groups.has(url)) groups.set(url, [] as any);
      (groups.get(url) as any).push(s);
    }

    for (const [url, list] of groups) {
      if (list.length > 1) {
        duplicateGroups++;
        // Keep the earliest created; clear others
        const toKeep = list[0];
        const toClear = list.slice(1);
        for (const s of toClear) {
          await db.streamer.update({ where: { id: s.id }, data: { avatarUrl: null } });
          duplicatesCleared++;
        }
        logger.info('Cleared duplicate avatar URLs', { url, kept: toKeep.username, cleared: toClear.length });
      }
    }

    // Known generic/default avatar fragments to clear
    const genericAvatarIds = [
      '46a38d3a-a39c-4c43-ac12-c331b1c469c2',
      '41263278-9819-4b00-ba22-1a8e86ec656c',
      'bf6a04cf-3f44-4986-8eed-5c36bfad542b',
      '9f431098-e65f-4983-a52c-056223a2fdf6',
      '0e09ed56-067f-465a-95db-a8b8c80fdc2a',
      '38d3c5b2-bfe5-4e85-a1b4-3ee7da45b8e9',
    ];

    for (const fragment of genericAvatarIds) {
      const result = await db.streamer.updateMany({
        where: { avatarUrl: { contains: fragment } },
        data: { avatarUrl: null },
      });
      genericCleared += result.count;
    }

    const remainingWithAvatars = await db.streamer.count({ where: { avatarUrl: { not: null } } });
    const [{ count: uniqueCount }] = (await db.$queryRaw`
      SELECT COUNT(DISTINCT "avatarUrl") as count FROM "streamers" WHERE "avatarUrl" IS NOT NULL
    `) as [{ count: bigint }];

    return res.status(200).json({
      success: true,
      data: {
        duplicateGroups,
        duplicatesCleared,
        genericCleared,
        totalWithAvatars: remainingWithAvatars,
        uniqueAvatarUrls: Number(uniqueCount),
      },
      message: 'Duplicate avatars cleared where found',
    });
  });

  scrapeStreamerTags = asyncHandler(async (req: Request, res: Response) => {
    try {
      logger.info('Starting tag scraping for all streamers');

      // Run tag scraping in background
      tagScrapingService.scrapeAllStreamerTags()
        .then(result => {
          logger.info('Tag scraping completed', result);
        })
        .catch(error => {
          logger.error('Tag scraping failed', { error });
        });

      res.status(200).json({
        success: true,
        message: 'Tag scraping started in background',
      });
    } catch (error) {
      logger.error('Failed to start tag scraping', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to start tag scraping',
      });
    }
  });

  importCsvData = asyncHandler(async (req: Request, res: Response) => {
    try {
      logger.info('Starting CSV import for production database');
      const result = await seedFromCsvIfEmpty();
      const total = await db.streamer.count();

      res.status(200).json({
        success: true,
        message: 'CSV import completed successfully',
        data: {
          totalStreamers: total,
        }
      });
    } catch (error) {
      logger.error('CSV import failed', { error });
      res.status(500).json({
        success: false,
        message: 'CSV import failed',
        error: process.env.NODE_ENV === 'development' ? error : 'Internal server error'
      });
    }
  });

  bulkImportStreamers = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { streamers } = req.body;
      if (!streamers || !Array.isArray(streamers)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid data format. Expected array of streamers.'
        });
      }

      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const data of streamers) {
        try {
          const existing = await db.streamer.findFirst({
            where: {
              platform: data.platform,
              username: data.username
            }
          });

          if (existing) {
            await db.streamer.update({
              where: { id: existing.id },
              data: {
                ...data,
                updatedAt: new Date(),
              },
            });
            updated++;
          } else {
            await db.streamer.create({ data });
            created++;
          }
        } catch (err) {
          logger.warn('Failed to import streamer', { data, err });
          skipped++;
        }
      }

      const total = await db.streamer.count();
      logger.info(`Bulk import complete. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Total: ${total}`);

      res.status(200).json({
        success: true,
        message: 'Bulk import completed successfully',
        data: {
          created,
          updated,
          skipped,
          totalStreamers: total,
        }
      });
    } catch (error) {
      logger.error('Bulk import failed', { error });
      res.status(500).json({
        success: false,
        message: 'Bulk import failed',
        error: process.env.NODE_ENV === 'development' ? error : 'Internal server error'
      });
    }
  });

  replaceAllStreamersWithLocal = asyncHandler(async (req: Request, res: Response) => {
    try {
      logger.info('🔄 ADMIN: Starting complete replacement of production data with local');

      const result = await replaceAllStreamersWithLocal();
      const total = await db.streamer.count();

      logger.info(`🔄 ADMIN: Full sync complete! Replaced ${result.replaced} streamers, total now: ${total}`);

      res.status(200).json({
        success: true,
        message: 'Successfully replaced all production data with local data',
        data: {
          replacedStreamers: result.replaced,
          totalStreamers: total,
        }
      });
    } catch (error) {
      logger.error('🔄 ADMIN: Full sync failed', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to replace production data with local data',
        error: process.env.NODE_ENV === 'development' ? error : 'Internal server error'
      });
    }
  });

  /**
   * Backfill avatars for streamers without profile pictures
   */
  backfillAvatars = asyncHandler(async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const platform = (req.query.platform as string)?.toUpperCase() || 'ALL';

      logger.info(`🖼️ ADMIN: Starting avatar backfill`, { platform, limit });

      const streamerService = new StreamerService();
      const results: { platform: string; updated: number; errors: number }[] = [];

      if (platform === 'ALL' || platform === 'TWITCH') {
        const twitchResult = await streamerService.backfillTwitchAvatars(limit);
        results.push({ platform: 'TWITCH', ...twitchResult });
      }

      if (platform === 'ALL' || platform === 'KICK') {
        const kickResult = await streamerService.backfillKickAvatars(limit);
        results.push({ platform: 'KICK', ...kickResult });
      }

      const totalUpdated = results.reduce((sum, r) => sum + r.updated, 0);
      const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

      const streamersWithAvatars = await db.streamer.count({ where: { avatarUrl: { not: null } } });

      logger.info(`🖼️ ADMIN: Avatar backfill complete`, { totalUpdated, totalErrors, streamersWithAvatars });

      res.status(200).json({
        success: true,
        message: 'Avatar backfill completed',
        data: {
          results,
          totalUpdated,
          totalErrors,
          streamersWithAvatars,
        }
      });
    } catch (error) {
      logger.error('🖼️ ADMIN: Avatar backfill failed', { error });
      res.status(500).json({
        success: false,
        message: 'Avatar backfill failed',
        error: process.env.NODE_ENV === 'development' ? error : 'Internal server error'
      });
    }
  });
}
