import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { db, logger } from '../utils/database';
import { Platform, Region, FraudStatus } from '@prisma/client';
import { discoveryService } from '../services/discoveryService';
import { runDiscovery, runQuickDiscovery, runFullDiscovery } from '../jobs/discoveryJob';
import { runSocialDiscovery, runQuickSocialDiscovery, runFullSocialDiscovery, runInfluencerDiscovery, runPlatformDiscovery } from '../jobs/socialDiscoveryJob';
import multer from 'multer';
import { parse } from 'csv-parse/sync';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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

  // Cache search results briefly
  res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');

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

  // Cache creator details for 2 minutes
  res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');

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

// ==================== DISCOVERY ENDPOINTS ====================

/**
 * POST /api/discovery/populate
 * Run multi-category discovery to populate new creators (Twitch + Kick)
 * Categories: Slots, Poker, Just Chatting, Sports, Gaming, etc.
 */
router.post('/populate', asyncHandler(async (req: Request, res: Response) => {
  const { mode = 'quick', platforms, limitPerCategory = 100 } = req.body;

  logger.info('Discovery populate requested', { mode, platforms, limitPerCategory });

  let result;

  switch (mode) {
    case 'quick':
      // Priority categories only (Slots, Poker, Just Chatting)
      result = await runQuickDiscovery();
      break;
    case 'full':
      // All categories
      result = await runFullDiscovery();
      break;
    case 'custom':
      // Custom options
      result = await runDiscovery({
        platforms: platforms || ['twitch', 'kick'],
        priorityOnly: false,
        limitPerCategory,
      });
      break;
    default:
      return res.status(400).json({ success: false, error: 'Invalid mode. Use: quick, full, or custom' });
  }

  res.json({
    success: true,
    data: {
      ...result,
      mode,
    }
  });
}));

/**
 * POST /api/discovery/social
 * Run social platform discovery using ScrapeCreators
 *
 * Platforms supported:
 * - TikTok: keyword search, hashtag search, trending, popular creators
 * - Instagram: reels search (via Google)
 * - Facebook: ad library search (find advertisers)
 * - LinkedIn: ad library search (B2B advertisers)
 *
 * Note: YouTube NOT supported via ScrapeCreators (no search API).
 * Use youtubeDiscoveryJob.ts with YouTube Data API instead.
 */
router.post('/social', asyncHandler(async (req: Request, res: Response) => {
  const {
    mode = 'quick',
    platforms = ['tiktok', 'instagram', 'facebook', 'linkedin'],
    methods = ['keyword', 'hashtag', 'trending', 'popular', 'ads'],
    keywordSet = 'primary',
    maxResultsPerQuery = 10,
    maxCredits = 500,
    platform, // For single platform mode
  } = req.body;

  logger.info('Social discovery requested', { mode, platforms, methods, keywordSet, maxCredits });

  let result;

  switch (mode) {
    case 'quick':
      // TikTok + YouTube, primary keywords, limited results
      result = await runQuickSocialDiscovery();
      break;
    case 'full':
      // All platforms, all methods, full budget
      result = await runFullSocialDiscovery();
      break;
    case 'influencer':
      // Search for known big names on TikTok/YouTube/Instagram
      result = await runInfluencerDiscovery();
      break;
    case 'platform':
      // Single platform discovery
      if (!platform || !['tiktok', 'instagram', 'facebook', 'linkedin'].includes(platform)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid platform. Use: tiktok, instagram, facebook, or linkedin (YouTube not supported via ScrapeCreators)',
        });
      }
      result = await runPlatformDiscovery(platform);
      break;
    case 'custom':
      // Custom options
      result = await runSocialDiscovery({
        platforms: platforms as ('tiktok' | 'instagram' | 'facebook' | 'linkedin')[],
        methods: methods as ('keyword' | 'hashtag' | 'trending' | 'popular' | 'ads')[],
        keywordSet: keywordSet as 'primary' | 'secondary' | 'influencer' | 'all',
        maxResultsPerQuery,
        maxCredits,
      });
      break;
    default:
      return res.status(400).json({
        success: false,
        error: 'Invalid mode. Use: quick, full, influencer, platform, or custom',
      });
  }

  res.json({
    success: true,
    data: {
      ...result,
      mode,
      description: 'Social discovery finds NEW creators across TikTok, YouTube, Instagram, Facebook, LinkedIn',
    },
  });
}));

/**
 * POST /api/discovery/run
 * Run discovery to find new streamers from APIs
 */
router.post('/run', asyncHandler(async (req: Request, res: Response) => {
  const { type = 'full', gameId, keyword, platform, limit = 100 } = req.body;

  logger.info('Discovery run requested', { type, gameId, keyword, platform, limit });

  let result;

  switch (type) {
    case 'full':
      result = await discoveryService.runFullDiscovery();
      break;
    case 'twitch-game':
      if (!gameId) {
        return res.status(400).json({ success: false, error: 'gameId required for twitch-game discovery' });
      }
      result = await discoveryService.discoverTwitchByGame(gameId, limit);
      break;
    case 'twitch-keyword':
      if (!keyword) {
        return res.status(400).json({ success: false, error: 'keyword required for twitch-keyword discovery' });
      }
      result = await discoveryService.discoverTwitchByKeyword(keyword, limit);
      break;
    case 'twitch-top':
      result = await discoveryService.discoverTwitchTopStreams(limit);
      break;
    case 'kick-top':
      result = await discoveryService.discoverKickTopStreams(limit);
      break;
    case 'kick-category':
      const { categorySlug } = req.body;
      if (!categorySlug) {
        return res.status(400).json({ success: false, error: 'categorySlug required for kick-category discovery' });
      }
      result = await discoveryService.discoverKickByCategory(categorySlug, limit);
      break;
    default:
      return res.status(400).json({ success: false, error: 'Invalid discovery type' });
  }

  res.json({
    success: true,
    data: result
  });
}));

/**
 * POST /api/discovery/backfill-followers
 * Backfill missing follower counts from Twitch API
 */
router.post('/backfill-followers', asyncHandler(async (req: Request, res: Response) => {
  const { limit = 500 } = req.body;

  logger.info('Follower backfill requested', { limit });

  const result = await discoveryService.backfillTwitchFollowers(limit);

  res.json({
    success: true,
    data: result
  });
}));

// ==================== CSV IMPORT ENDPOINTS ====================

/**
 * POST /api/discovery/import/csv
 * Bulk import streamers from CSV file
 */
router.post('/import/csv', upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
  const file = (req as any).file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }

  logger.info('CSV import started', { filename: file.originalname, size: file.size });

  const content = file.buffer.toString('utf8');
  const rows = parse(content, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, any>[];

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      // Flexible column mapping
      const platform = mapPlatform(row.Platform || row.platform || row.PLATFORM);
      const username = (row['Channel name'] || row.Username || row.username || row['Channel Name'] || row.channel_name || '').trim();
      const displayName = row['Display Name'] || row.displayName || row['Channel name'] || username;
      const profileUrl = (row['Channel url'] || row.URL || row.url || row.profileUrl || row['Profile URL'] || '').trim();
      const region = mapRegion(row.Country || row.Region || row.country || row.region);
      const language = mapLanguage(row.Language || row.language);
      const followers = toInt(row.Followers || row.followers) || 0;
      const peakViewers = toInt(row['Peak Viewers'] || row.peakViewers || row['Highest Viewers']);
      const avgViewers = toInt(row['Average Viewers'] || row.avgViewers);
      const topGame = (row['Top Game'] || row.topGame || row.Game || row.game || '').trim();

      if (!platform || !username) {
        skipped++;
        continue;
      }

      const existing = await db.streamer.findFirst({
        where: { platform, username: username.toLowerCase() }
      });

      if (existing) {
        await db.streamer.update({
          where: { id: existing.id },
          data: {
            displayName: displayName || existing.displayName,
            profileUrl: profileUrl || existing.profileUrl,
            followers: followers || existing.followers,
            highestViewers: peakViewers ?? existing.highestViewers,
            currentGame: topGame || existing.currentGame,
            topGames: topGame ? [topGame] : existing.topGames as string[],
            region: region || existing.region,
            language: language || existing.language,
            lastScrapedAt: new Date(),
          },
        });
        updated++;
      } else {
        await db.streamer.create({
          data: {
            platform,
            username: username.toLowerCase(),
            displayName: displayName || username,
            profileUrl,
            followers,
            currentViewers: avgViewers || 0,
            highestViewers: peakViewers,
            isLive: false,
            currentGame: topGame || null,
            topGames: topGame ? [topGame] : [],
            tags: [],
            region: region || Region.MEXICO,
            language: language || 'es',
            usesCamera: false,
            isVtuber: false,
            fraudCheck: FraudStatus.PENDING_REVIEW,
          },
        });
        created++;
      }
    } catch (e: any) {
      skipped++;
      if (errors.length < 10) {
        errors.push(e.message);
      }
    }
  }

  const totalStreamers = await db.streamer.count();

  logger.info('CSV import complete', { created, updated, skipped, total: totalStreamers });

  res.json({
    success: true,
    data: {
      created,
      updated,
      skipped,
      totalStreamers,
      errors: errors.length > 0 ? errors : undefined
    }
  });
}));

/**
 * POST /api/discovery/import/json
 * Bulk import streamers from JSON array
 */
router.post('/import/json', asyncHandler(async (req: Request, res: Response) => {
  const { streamers } = req.body;

  if (!Array.isArray(streamers)) {
    return res.status(400).json({ success: false, error: 'streamers must be an array' });
  }

  logger.info('JSON import started', { count: streamers.length });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const s of streamers) {
    try {
      const platform = mapPlatform(s.platform);
      const username = (s.username || s.channel_name || '').trim().toLowerCase();

      if (!platform || !username) {
        skipped++;
        continue;
      }

      const existing = await db.streamer.findFirst({
        where: { platform, username }
      });

      if (existing) {
        await db.streamer.update({
          where: { id: existing.id },
          data: {
            displayName: s.displayName || s.display_name || existing.displayName,
            profileUrl: s.profileUrl || s.profile_url || existing.profileUrl,
            avatarUrl: s.avatarUrl || s.avatar_url || existing.avatarUrl,
            followers: s.followers || existing.followers,
            highestViewers: s.peakViewers || s.peak_viewers || existing.highestViewers,
            region: mapRegion(s.region || s.country) || existing.region,
            language: s.language || existing.language,
            lastScrapedAt: new Date(),
          },
        });
        updated++;
      } else {
        await db.streamer.create({
          data: {
            platform,
            username,
            displayName: s.displayName || s.display_name || username,
            profileUrl: s.profileUrl || s.profile_url || `https://${platform.toLowerCase()}.tv/${username}`,
            avatarUrl: s.avatarUrl || s.avatar_url,
            followers: s.followers || 0,
            highestViewers: s.peakViewers || s.peak_viewers,
            isLive: false,
            region: mapRegion(s.region || s.country) || Region.MEXICO,
            language: s.language || 'es',
            tags: s.tags || [],
            usesCamera: false,
            isVtuber: false,
            fraudCheck: FraudStatus.PENDING_REVIEW,
          },
        });
        created++;
      }
    } catch (e) {
      skipped++;
    }
  }

  const totalStreamers = await db.streamer.count();

  logger.info('JSON import complete', { created, updated, skipped, total: totalStreamers });

  res.json({
    success: true,
    data: { created, updated, skipped, totalStreamers }
  });
}));

// ==================== HELPER FUNCTIONS ====================

function mapPlatform(p: string | undefined): Platform | null {
  if (!p) return null;
  const v = p.toLowerCase();
  if (v.includes('twitch')) return Platform.TWITCH;
  if (v.includes('youtube')) return Platform.YOUTUBE;
  if (v.includes('kick')) return Platform.KICK;
  if (v.includes('facebook')) return Platform.FACEBOOK;
  if (v.includes('tiktok')) return Platform.TIKTOK;
  if (v.includes('instagram')) return Platform.INSTAGRAM;
  if (v === 'x' || v.includes('twitter')) return Platform.X;
  if (v.includes('linkedin')) return Platform.LINKEDIN;
  return null;
}

function mapRegion(country: string | undefined): Region | null {
  if (!country) return null;
  const c = country.toLowerCase();
  const map: Record<string, Region> = {
    mexico: Region.MEXICO, méxico: Region.MEXICO,
    colombia: Region.COLOMBIA,
    argentina: Region.ARGENTINA,
    chile: Region.CHILE,
    peru: Region.PERU, perú: Region.PERU,
    venezuela: Region.VENEZUELA,
    ecuador: Region.ECUADOR,
    bolivia: Region.BOLIVIA,
    paraguay: Region.PARAGUAY,
    uruguay: Region.URUGUAY,
    'costa rica': Region.COSTA_RICA,
    panama: Region.PANAMA, panamá: Region.PANAMA,
    guatemala: Region.GUATEMALA,
    'el salvador': Region.EL_SALVADOR,
    honduras: Region.HONDURAS,
    nicaragua: Region.NICARAGUA,
    'dominican republic': Region.DOMINICAN_REPUBLIC,
    'puerto rico': Region.PUERTO_RICO,
    brazil: Region.BRAZIL, brasil: Region.BRAZIL,
  };
  return map[c] ?? null;
}

function mapLanguage(lang: string | undefined): string {
  if (!lang) return 'es';
  const l = lang.toLowerCase();
  if (l.startsWith('spanish') || l === 'es') return 'es';
  if (l.startsWith('portuguese') || l === 'pt') return 'pt';
  if (l.startsWith('english') || l === 'en') return 'en';
  return l.slice(0, 2);
}

function toInt(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[, ]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : null;
}

export const discoveryRoutes = router;
