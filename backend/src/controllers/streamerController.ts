import { Request, Response } from 'express';
import { db } from '../utils/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { seedFromCsvIfEmpty } from '../utils/seedFromCsv';

// Removed AuthRequest interface - using basic Request for now

export class StreamerController {
  getStreamers = asyncHandler(async (req: Request, res: Response) => {
    try {
      // Ensure DB has baseline data in dev if empty
      try {
        const existing = await db.streamer.count();
        if (existing === 0) {
          await seedFromCsvIfEmpty();
        }
      } catch {}

      const page = Math.max(parseInt((req.query.page as string) || '1', 10), 1);
      // Ultra-fast initial load: 15 items per page
      const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '15', 10), 1), 50);
      const skip = (page - 1) * limit;

      const sort = (String(req.query.sort || '').toLowerCase());
      const dir = (String(req.query.dir || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';
      const search = (req.query.search as string | undefined)?.trim();
      const region = (req.query.region as string | undefined)?.trim();
      const platform = (req.query.platform as string | undefined)?.trim();

      const where: any = {};
      if (search) {
        where.OR = [
          { displayName: { contains: search, mode: 'insensitive' } },
          { username: { contains: search, mode: 'insensitive' } },
          { currentGame: { contains: search, mode: 'insensitive' } },
          { tags: { has: search.toUpperCase() } }, // Exact tag match (tags are uppercase)
          { tags: { hasSome: [search.toUpperCase()] } }, // Alternative syntax
        ];
      }
      if (region) {
        try { where.region = (region as any).toUpperCase(); } catch {}
      }
      if (platform) {
        try { where.platform = (platform as any).toUpperCase(); } catch {}
      }

      const orderBy: any[] = [];
      switch (sort) {
        case 'displayname':
        case 'name':
        case 'streamer':
          orderBy.push({ displayName: dir });
          break;
        case 'followers':
          // Sort by followers, then by currentViewers as tiebreaker
          orderBy.push({ followers: dir }, { currentViewers: dir });
          break;
        case 'viewers':
          // Sort by: live status (live first), then currentViewers, then peak viewers, then followers
          if (dir === 'desc') {
            orderBy.push(
              { isLive: 'desc' },
              { currentViewers: 'desc' },
              { highestViewers: 'desc' },
              { followers: 'desc' }
            );
          } else {
            orderBy.push(
              { isLive: 'asc' },
              { currentViewers: 'asc' },
              { highestViewers: 'asc' },
              { followers: 'asc' }
            );
          }
          break;
        case 'peak':
          // Sort by peak viewers, then by followers as tiebreaker
          orderBy.push({ highestViewers: dir }, { followers: dir });
          break;
        case 'region':
          orderBy.push({ region: dir });
          break;
        case 'lastlive':
        case 'laststreamed':
          if (dir === 'desc') {
            // Most recent first: live streamers at top (they are "now"), then by lastStreamed desc
            orderBy.push({ isLive: 'desc' }, { lastStreamed: { sort: 'desc', nulls: 'last' } });
          } else {
            // Oldest first: by lastStreamed asc, live streamers at bottom (they are "now" = newest)
            orderBy.push({ isLive: 'asc' }, { lastStreamed: { sort: 'asc', nulls: 'last' } });
          }
          break;
        default:
          orderBy.push({ isLive: 'desc' }, { currentViewers: 'desc' }, { followers: 'desc' });
      }

      // Always query database for accurate sorting
      const items = await db.streamer.findMany({
        skip,
        take: limit,
        where,
        orderBy,
      });

      // Only count on filtered queries or pagination for speed
      const shouldCount = page > 1 || search || region || platform;
      const total = shouldCount
        ? await db.streamer.count({ where })
        : (items.length < limit ? items.length : 10000);

      const totalPages = Math.max(Math.ceil(total / limit), 1);

      // Aggressive caching for maximum speed (60 seconds cache, 2 min stale-while-revalidate)
      res.set({
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
        'X-Total-Count': total.toString(),
      });

      res.status(200).json({
        success: true,
        data: items,
        pagination: { page, limit, total, totalPages },
      });
    } catch (e) {
      // Fallback gracefully for dev when DB is unavailable
      res.status(200).json({
        success: true,
        data: [],
        pagination: { page: 1, limit: 0, total: 0, totalPages: 1 },
      });
    }
  });

  getStreamerById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const streamer = await db.streamer.findUnique({
      where: { id },
      select: {
        id: true,
        platform: true,
        username: true,
        displayName: true,
        profileUrl: true,
        avatarUrl: true,
        followers: true,
        currentViewers: true,
        highestViewers: true,
        lastStreamed: true,
        isLive: true,
        currentGame: true,
        topGames: true,
        tags: true,
        region: true,
        language: true,
        fraudCheck: true,
        updatedAt: true,
        streamTitles: true,
        panelImages: true,
        notes: true,
        profileDescription: true,
        aboutSection: true,
        externalLinks: true,
      },
    });
    if (!streamer) {
      return res.status(404).json({ success: false, error: 'Streamer not found' });
    }
    res.status(200).json({ success: true, data: streamer });
  });

  createStreamer = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Streamer creation coming soon',
    });
  });

  updateStreamer = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Streamer update coming soon',
    });
  });

  deleteStreamer = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Streamer deletion coming soon',
    });
  });

  bulkUpdateStreamers = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Bulk streamer update coming soon',
    });
  });

  getStats = asyncHandler(async (req: Request, res: Response) => {
    try {
      // Serve from pre-computed cache for instant response
      const [regionStatsCache, totalCache, liveCache, flaggedCache] = await Promise.all([
        db.cachedStats.findUnique({ where: { key: 'region_stats' } }),
        db.cachedStats.findUnique({ where: { key: 'total_streamers' } }),
        db.cachedStats.findUnique({ where: { key: 'live_count' } }),
        db.cachedStats.findUnique({ where: { key: 'flagged_count' } }),
      ]);

      const regionCounts = (regionStatsCache?.value as Record<string, number>) || {};
      const total = (totalCache?.value as number) || 0;
      const liveCount = (liveCache?.value as number) || 0;
      const flaggedCount = (flaggedCache?.value as number) || 0;

      // Cache for 60 seconds
      res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');

      res.status(200).json({
        success: true,
        data: { regionCounts, total, liveCount, flaggedCount },
      });
    } catch (e) {
      res.status(200).json({
        success: true,
        data: { regionCounts: {}, total: 0, liveCount: 0, flaggedCount: 0 },
      });
    }
  });

  exportToCsv = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'CSV export coming soon',
    });
  });

  scrapeNow = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Manual scraping coming soon',
    });
  });

  cacheStats = asyncHandler(async (req: Request, res: Response) => {
    try {
      // 1. Cache region stats
      const regionStats = await db.streamer.groupBy({
        by: ['region'],
        _count: { _all: true },
      });
      const regionCounts: Record<string, number> = {};
      for (const r of regionStats) {
        regionCounts[String(r.region).toLowerCase()] = r._count._all;
      }

      await db.cachedStats.upsert({
        where: { key: 'region_stats' },
        create: { key: 'region_stats', value: regionCounts },
        update: { value: regionCounts },
      });

      // 2. Cache counts
      const [totalStreamers, liveCount, flaggedCount] = await Promise.all([
        db.streamer.count(),
        db.streamer.count({ where: { isLive: true } }),
        db.streamer.count({ where: { fraudCheck: 'FLAGGED' } }),
      ]);

      await Promise.all([
        db.cachedStats.upsert({
          where: { key: 'total_streamers' },
          create: { key: 'total_streamers', value: totalStreamers },
          update: { value: totalStreamers },
        }),
        db.cachedStats.upsert({
          where: { key: 'live_count' },
          create: { key: 'live_count', value: liveCount },
          update: { value: liveCount },
        }),
        db.cachedStats.upsert({
          where: { key: 'flagged_count' },
          create: { key: 'flagged_count', value: flaggedCount },
          update: { value: flaggedCount },
        }),
      ]);

      res.status(200).json({
        success: true,
        message: 'Stats cached successfully',
        data: { totalStreamers, liveCount, flaggedCount, regions: Object.keys(regionCounts).length },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Stats caching failed',
        error: process.env.NODE_ENV === 'development' ? error : 'Internal server error',
      });
    }
  });

  seedFromCsv = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { seedFromCsvIfEmpty } = require('../utils/seedFromCsv');
      const result = await seedFromCsvIfEmpty();
      const total = await db.streamer.count();

      res.status(200).json({
        success: true,
        message: 'CSV seeding completed',
        data: {
          ...result,
          totalStreamers: total,
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'CSV seeding failed',
        error: process.env.NODE_ENV === 'development' ? error : 'Internal server error'
      });
    }
  });

}
