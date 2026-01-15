import { Request, Response } from 'express';
import { db } from '../utils/database';
import { AppError, asyncHandler } from '../middleware/errorHandler';
import { seedFromCsvIfEmpty } from '../utils/seedFromCsv';

// Removed AuthRequest interface - using basic Request for now

export class StreamerController {
  getStreamers = asyncHandler(async (req: Request, res: Response) => {
    try {
      const page = Math.max(parseInt((req.query.page as string) || '1', 10), 1);
      const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '20', 10), 1), 500);
      const skip = (page - 1) * limit;

      const sort = (String(req.query.sort || '').toLowerCase());
      const dir = (String(req.query.dir || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';

      // Search filter
      const search = (req.query.search as string | undefined)?.trim();

      // Multi-select filters (comma-separated)
      const platforms = (req.query.platforms as string | undefined)?.split(',').map(p => p.trim().toUpperCase()).filter(Boolean);
      const regions = (req.query.regions as string | undefined)?.split(',').map(r => r.trim().toUpperCase()).filter(Boolean);
      const categories = (req.query.categories as string | undefined)?.split(',').map(c => c.trim()).filter(Boolean);

      // Range filters
      const minFollowers = parseInt(req.query.minFollowers as string) || 0;
      const maxFollowers = parseInt(req.query.maxFollowers as string) || undefined;
      const minViews = parseInt(req.query.minViews as string) || 0;
      const maxViews = parseInt(req.query.maxViews as string) || undefined;
      const minEngagement = parseFloat(req.query.minEngagement as string) || 0;
      const minAvgViewers = parseInt(req.query.minAvgViewers as string) || 0;
      const maxAvgViewers = parseInt(req.query.maxAvgViewers as string) || undefined;
      const maxLastActive = parseInt(req.query.maxLastActive as string) || undefined; // days

      // Favorites and discards filter
      const userId = req.query.userId as string | undefined;
      const favoritesOnly = req.query.favoritesOnly === 'true';
      const discardedOnly = req.query.discardedOnly === 'true';
      const hideDiscarded = req.query.hideDiscarded !== 'false'; // Default to true

      // Contact filter
      const hasEmail = req.query.hasEmail === 'true';

      // iGaming filters
      const gamblingCompatible = req.query.gamblingCompatible === 'true' ? true :
                                  req.query.gamblingCompatible === 'false' ? false : undefined;
      const minIgamingScore = parseInt(req.query.minIgamingScore as string) || 0;
      const maxIgamingScore = parseInt(req.query.maxIgamingScore as string) || undefined;
      const performanceTier = (req.query.performanceTier as string | undefined)?.toUpperCase();

      // Build where clause
      const where: any = {};

      // Search by name/username
      if (search) {
        where.OR = [
          { displayName: { contains: search, mode: 'insensitive' } },
          { username: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Multi-platform filter
      if (platforms && platforms.length > 0) {
        where.platform = { in: platforms };
      }

      // Multi-region filter
      if (regions && regions.length > 0) {
        where.region = { in: regions };
      }

      // Multi-category filter - uses inferredCategory which properly maps games to categories
      // e.g., "Gaming" includes all video games, "iGaming" includes slots/casino
      if (categories && categories.length > 0) {
        // Use AND with OR for category matching (doesn't conflict with other OR clauses)
        where.AND = [
          ...(where.AND || []),
          {
            OR: [
              { inferredCategory: { in: categories, mode: 'insensitive' } },
              { primaryCategory: { in: categories, mode: 'insensitive' } },
            ]
          }
        ];
      }

      // Followers range
      if (minFollowers > 0 || maxFollowers) {
        where.followers = {};
        if (minFollowers > 0) where.followers.gte = minFollowers;
        if (maxFollowers) where.followers.lte = maxFollowers;
      }

      // Views range
      if (minViews > 0 || maxViews) {
        where.totalViews = {};
        if (minViews > 0) where.totalViews.gte = BigInt(minViews);
        if (maxViews) where.totalViews.lte = BigInt(maxViews);
      }

      // Engagement filter
      if (minEngagement > 0) {
        where.engagementRate = { gte: minEngagement };
      }

      // Avg viewers filter (range)
      if (minAvgViewers > 0 || maxAvgViewers) {
        where.avgViewers = {};
        if (minAvgViewers > 0) where.avgViewers.gte = minAvgViewers;
        if (maxAvgViewers) where.avgViewers.lte = maxAvgViewers;
      }

      // Last active filter (days)
      if (maxLastActive && maxLastActive < 365) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - maxLastActive);
        where.OR = [
          ...(where.OR || []),
          { lastScrapedAt: { gte: cutoffDate } },
          { isLive: true }, // Live creators are always "active"
        ];
      }

      // Has email filter (only show creators with contact info)
      if (hasEmail) {
        where.email = { not: null };
      }

      // iGaming compatibility filter
      if (gamblingCompatible !== undefined) {
        where.gamblingCompatibility = gamblingCompatible;
      }

      // iGaming score range filter
      if (minIgamingScore > 0 || maxIgamingScore) {
        where.igamingScore = {};
        if (minIgamingScore > 0) where.igamingScore.gte = minIgamingScore;
        if (maxIgamingScore) where.igamingScore.lte = maxIgamingScore;
      }

      // Performance tier filter (S=90+, A=75-89, B=60-74, C=<60)
      if (performanceTier) {
        const tierRanges: Record<string, { min: number; max?: number }> = {
          'S': { min: 90 },
          'A': { min: 75, max: 89 },
          'B': { min: 60, max: 74 },
          'C': { min: 0, max: 59 },
        };
        const range = tierRanges[performanceTier];
        if (range) {
          where.igamingScore = {
            ...(where.igamingScore || {}),
            gte: range.min,
            ...(range.max !== undefined ? { lte: range.max } : {}),
          };
        }
      }

      // Favorites only filter
      let favoriteIds: string[] = [];
      if (favoritesOnly && userId) {
        const favorites = await db.discoveryFavorite.findMany({
          where: { userId },
          select: { streamerId: true },
        });
        favoriteIds = favorites.map(f => f.streamerId);
        if (favoriteIds.length === 0) {
          // No favorites = no results
          return res.status(200).json({
            success: true,
            data: [],
            pagination: { page: 1, limit, total: 0, totalPages: 0 },
          });
        }
        where.id = { in: favoriteIds };
      }

      // Discarded filter
      let discardedIds: string[] = [];
      if (userId) {
        const discarded = await db.discoveryDiscarded.findMany({
          where: { userId },
          select: { streamerId: true },
        });
        discardedIds = discarded.map(d => d.streamerId);
      }

      if (discardedOnly && userId) {
        // Show only discarded
        if (discardedIds.length === 0) {
          return res.status(200).json({
            success: true,
            data: [],
            pagination: { page: 1, limit, total: 0, totalPages: 0 },
          });
        }
        where.id = { in: discardedIds };
      } else if (hideDiscarded && userId && discardedIds.length > 0 && !discardedOnly) {
        // Hide discarded from general search
        if (where.id) {
          // Already filtering by ID (e.g., favorites), intersect with non-discarded
          where.id = { in: (where.id.in || []).filter((id: string) => !discardedIds.includes(id)) };
        } else {
          where.id = { notIn: discardedIds };
        }
      }

      // Build orderBy
      const orderBy: any[] = [];
      switch (sort) {
        case 'name':
          orderBy.push({ displayName: dir });
          break;
        case 'followers':
          orderBy.push({ followers: dir });
          break;
        case 'viewers':
          orderBy.push({ isLive: 'desc' }, { currentViewers: dir });
          break;
        case 'avgviewers':
          orderBy.push({ avgViewers: dir });
          break;
        case 'engagement':
          orderBy.push({ engagementRate: dir });
          break;
        case 'views':
          orderBy.push({ totalViews: dir });
          break;
        case 'lastactive':
          orderBy.push({ lastSeenLive: { sort: dir, nulls: 'last' } });
          break;
        case 'igamingscore':
          orderBy.push({ igamingScore: dir });
          break;
        case 'brandsafety':
          orderBy.push({ brandSafetyScore: dir });
          break;
        default:
          orderBy.push({ followers: 'desc' });
      }

      // Query database
      const [items, total] = await Promise.all([
        db.streamer.findMany({
          skip,
          take: limit,
          where,
          orderBy,
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
            isLive: true,
            currentGame: true,
            primaryCategory: true,
            tags: true,
            region: true,
            language: true,
            totalViews: true,
            totalLikes: true,
            totalComments: true,
            totalShares: true,
            avgViewers: true,
            minutesWatched: true,
            durationMinutes: true,
            engagementRate: true,
            lastScrapedAt: true,
            lastStreamed: true,
            lastSeenLive: true,
            // Cross-platform unified demographics
            inferredCountry: true,
            inferredCountrySource: true,
            inferredCategory: true,
            inferredCategorySource: true,
            unifiedTags: true,
            // Contact information
            email: true,
            businessEmail: true,
            emailSource: true,
          },
        }),
        db.streamer.count({ where }),
      ]);

      // Convert BigInt to Number for JSON serialization
      const serializedItems = items.map(item => ({
        ...item,
        totalViews: Number(item.totalViews),
        totalLikes: Number(item.totalLikes),
        totalComments: Number(item.totalComments),
        totalShares: Number(item.totalShares),
        minutesWatched: Number(item.minutesWatched),
      }));

      const totalPages = Math.max(Math.ceil(total / limit), 1);

      res.set({
        'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
        'X-Total-Count': total.toString(),
      });

      res.status(200).json({
        success: true,
        data: serializedItems,
        pagination: { page, limit, total, totalPages },
      });
    } catch (e) {
      console.error('getStreamers error:', e);
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
