import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { db, logger } from '../utils/database';
import { Platform, Region } from '@prisma/client';

const router = Router();

/**
 * Discovery API - External Integration Endpoint
 *
 * This API is designed for Envisioner to consume when searching for
 * new creators to add to campaigns.
 */

interface DiscoverySearchParams {
  platforms?: Platform[];
  regions?: Region[];
  tags?: string[];
  minFollowers?: number;
  maxFollowers?: number;
  minViewers?: number;
  isLive?: boolean;
  language?: string;
  minIgamingScore?: number;
  hasPerformanceData?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * POST /api/discovery/search
 * Search for creators with filters
 */
router.post('/search', asyncHandler(async (req: Request, res: Response) => {
  const params: DiscoverySearchParams = req.body;
  const {
    platforms,
    regions,
    tags,
    minFollowers,
    maxFollowers,
    minViewers,
    isLive,
    language,
    minIgamingScore,
    hasPerformanceData,
    limit = 50,
    offset = 0
  } = params;

  logger.info('Discovery search request', { params });

  // Build where clause
  const where: any = {};

  if (platforms && platforms.length > 0) {
    where.platform = { in: platforms };
  }

  if (regions && regions.length > 0) {
    where.region = { in: regions };
  }

  if (tags && tags.length > 0) {
    where.tags = { hasSome: tags };
  }

  if (minFollowers) {
    where.followers = { ...where.followers, gte: minFollowers };
  }

  if (maxFollowers) {
    where.followers = { ...where.followers, lte: maxFollowers };
  }

  if (minViewers) {
    where.currentViewers = { gte: minViewers };
  }

  if (isLive !== undefined) {
    where.isLive = isLive;
  }

  if (language) {
    where.language = language;
  }

  if (minIgamingScore) {
    where.igamingScore = { gte: minIgamingScore };
  }

  if (hasPerformanceData) {
    where.historicalConversions = { gt: 0 };
  }

  // Execute search
  const [creators, totalCount] = await Promise.all([
    db.streamer.findMany({
      where,
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
        region: true,
        language: true,
        tags: true,
        igamingScore: true,
        brandSafetyScore: true,
        gamblingCompatibility: true,
        historicalCpa: true,
        historicalConversions: true,
        historicalCampaigns: true,
        avgRoi: true,
        lastPerformanceSync: true
      },
      orderBy: [
        { historicalConversions: 'desc' }, // Prioritize proven performers
        { followers: 'desc' }
      ],
      take: Math.min(limit, 100),
      skip: offset
    }),
    db.streamer.count({ where })
  ]);

  // Calculate performance tier for each creator
  const creatorsWithTier = creators.map(creator => ({
    ...creator,
    performanceTier: getPerformanceTier(creator),
    predicted: !creator.historicalConversions
  }));

  logger.info('Discovery search completed', { count: creators.length, total: totalCount });

  res.json({
    success: true,
    data: {
      creators: creatorsWithTier,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + creators.length < totalCount
      }
    }
  });
}));

/**
 * GET /api/discovery/creator/:id
 * Get detailed creator info for assignment
 */
router.get('/creator/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const creator = await db.streamer.findUnique({
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
      socialLinks: true,
      igamingScore: true,
      brandSafetyScore: true,
      gamblingCompatibility: true,
      conversionPotential: true,
      historicalCpa: true,
      historicalConversions: true,
      historicalCampaigns: true,
      avgRoi: true,
      lastPerformanceSync: true,
      panelImages: true,
      profileDescription: true
    }
  });

  if (!creator) {
    return res.status(404).json({
      success: false,
      error: 'Creator not found'
    });
  }

  res.json({
    success: true,
    data: {
      ...creator,
      performanceTier: getPerformanceTier(creator),
      recommendation: generateRecommendation(creator)
    }
  });
}));

/**
 * GET /api/discovery/recommend
 * AI-powered recommendations based on criteria
 */
router.post('/recommend', asyncHandler(async (req: Request, res: Response) => {
  const { campaignType, budget, targetRegion, preferPlatform } = req.body;

  logger.info('Discovery recommendation request', { campaignType, budget, targetRegion });

  // Build recommendation query based on campaign type
  const where: any = {};

  if (targetRegion) {
    where.region = targetRegion;
  }

  if (preferPlatform) {
    where.platform = preferPlatform;
  }

  // For iGaming campaigns, prioritize gambling compatibility
  if (campaignType === 'igaming' || campaignType === 'casino' || campaignType === 'betting') {
    where.gamblingCompatibility = true;
    where.igamingScore = { gte: 50 };
  }

  // Prioritize creators with proven performance
  const recommendations = await db.streamer.findMany({
    where: {
      ...where,
      OR: [
        { historicalConversions: { gt: 0 } },
        { followers: { gte: 10000 } }
      ]
    },
    select: {
      id: true,
      platform: true,
      username: true,
      displayName: true,
      profileUrl: true,
      avatarUrl: true,
      followers: true,
      currentViewers: true,
      isLive: true,
      region: true,
      tags: true,
      igamingScore: true,
      brandSafetyScore: true,
      historicalCpa: true,
      historicalConversions: true,
      avgRoi: true
    },
    orderBy: [
      { historicalConversions: 'desc' },
      { igamingScore: 'desc' },
      { followers: 'desc' }
    ],
    take: 10
  });

  // Add recommendation reasons
  const recommendationsWithReasons = recommendations.map(creator => ({
    ...creator,
    performanceTier: getPerformanceTier(creator),
    reasons: getRecommendationReasons(creator, campaignType)
  }));

  res.json({
    success: true,
    data: {
      recommendations: recommendationsWithReasons,
      criteria: { campaignType, budget, targetRegion, preferPlatform }
    }
  });
}));

/**
 * GET /api/discovery/live
 * Get currently live creators
 */
router.get('/live', asyncHandler(async (req: Request, res: Response) => {
  const { platform, region, limit = 20 } = req.query;

  const where: any = { isLive: true };

  if (platform) {
    where.platform = platform as Platform;
  }

  if (region) {
    where.region = region as Region;
  }

  const liveCreators = await db.streamer.findMany({
    where,
    select: {
      id: true,
      platform: true,
      username: true,
      displayName: true,
      profileUrl: true,
      avatarUrl: true,
      followers: true,
      currentViewers: true,
      currentGame: true,
      region: true,
      tags: true,
      igamingScore: true,
      historicalConversions: true,
      historicalCpa: true
    },
    orderBy: { currentViewers: 'desc' },
    take: Number(limit)
  });

  res.json({
    success: true,
    data: {
      live: liveCreators,
      count: liveCreators.length
    }
  });
}));

/**
 * GET /api/discovery/stats
 * Get discovery database statistics
 */
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const [totalCreators, platformStats, regionStats, performanceStats] = await Promise.all([
    db.streamer.count(),
    db.streamer.groupBy({
      by: ['platform'],
      _count: true
    }),
    db.streamer.groupBy({
      by: ['region'],
      _count: true,
      orderBy: { _count: { region: 'desc' } },
      take: 10
    }),
    db.streamer.aggregate({
      where: { historicalConversions: { gt: 0 } },
      _count: true,
      _avg: {
        historicalCpa: true,
        avgRoi: true
      },
      _sum: {
        historicalConversions: true
      }
    })
  ]);

  const liveCount = await db.streamer.count({ where: { isLive: true } });

  res.json({
    success: true,
    data: {
      totalCreators,
      liveNow: liveCount,
      byPlatform: platformStats.reduce((acc, p) => ({ ...acc, [p.platform]: p._count }), {}),
      topRegions: regionStats.map(r => ({ region: r.region, count: r._count })),
      performance: {
        creatorsWithData: performanceStats._count,
        avgCpa: performanceStats._avg.historicalCpa,
        avgRoi: performanceStats._avg.avgRoi,
        totalConversions: performanceStats._sum.historicalConversions
      }
    }
  });
}));

/**
 * Helper: Calculate performance tier
 */
function getPerformanceTier(creator: any): 'proven' | 'promising' | 'new' {
  if (creator.historicalConversions && creator.historicalConversions > 50) {
    return 'proven';
  }
  if (creator.historicalConversions && creator.historicalConversions > 0) {
    return 'promising';
  }
  return 'new';
}

/**
 * Helper: Generate recommendation text
 */
function generateRecommendation(creator: any): string {
  const parts = [];

  if (creator.historicalConversions > 0) {
    parts.push(`${creator.historicalConversions} conversions in past campaigns`);
  }

  if (creator.historicalCpa && creator.historicalCpa < 30) {
    parts.push(`excellent CPA ($${creator.historicalCpa.toFixed(2)})`);
  }

  if (creator.igamingScore > 70) {
    parts.push('strong iGaming fit');
  }

  if (creator.gamblingCompatibility) {
    parts.push('gambling content experience');
  }

  if (creator.followers > 100000) {
    parts.push(`${(creator.followers / 1000).toFixed(0)}K followers`);
  }

  return parts.length > 0
    ? `Recommended: ${parts.join(', ')}`
    : 'New creator - no historical data yet';
}

/**
 * Helper: Get recommendation reasons
 */
function getRecommendationReasons(creator: any, campaignType?: string): string[] {
  const reasons = [];

  if (creator.historicalConversions > 0) {
    reasons.push(`Proven performer with ${creator.historicalConversions} conversions`);
  }

  if (creator.historicalCpa && creator.historicalCpa < 40) {
    reasons.push(`Efficient CPA: $${creator.historicalCpa.toFixed(2)}`);
  }

  if ((campaignType === 'igaming' || campaignType === 'casino') && creator.igamingScore > 60) {
    reasons.push(`High iGaming score: ${creator.igamingScore}/100`);
  }

  if (creator.brandSafetyScore > 70) {
    reasons.push('Brand safe content');
  }

  if (creator.avgRoi && creator.avgRoi > 1.5) {
    reasons.push(`Strong ROI: ${creator.avgRoi.toFixed(1)}x`);
  }

  return reasons;
}

export const discoveryRoutes = router;
