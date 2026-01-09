import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { db, logger } from '../utils/database';

const router = Router();

/**
 * Performance Sync API - Receives performance data from Envisioner
 *
 * This endpoint allows Envisioner to feed back campaign performance data
 * to Discovery, improving future recommendations with historical performance.
 */

interface PerformanceSyncPayload {
  discoveryCreatorId: string;
  envisionerInfluencerId?: string;
  envisionerCampaignId?: string;
  conversions: number;
  spent: number;
  cpa: number;
  roi?: number;
  campaignStatus?: 'active' | 'completed' | 'cancelled';
}

interface BulkPerformanceSyncPayload {
  updates: PerformanceSyncPayload[];
}

/**
 * POST /api/performance-sync
 * Sync single creator performance from Envisioner
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { discoveryCreatorId, envisionerInfluencerId, envisionerCampaignId, conversions, spent, cpa, roi, campaignStatus } = req.body as PerformanceSyncPayload;

  if (!discoveryCreatorId) {
    return res.status(400).json({
      success: false,
      error: 'discoveryCreatorId is required'
    });
  }

  logger.info('Performance sync received', { discoveryCreatorId, conversions, spent, cpa });

  try {
    // Find the creator
    const creator = await db.streamer.findUnique({
      where: { id: discoveryCreatorId }
    });

    if (!creator) {
      return res.status(404).json({
        success: false,
        error: 'Creator not found'
      });
    }

    // Update creator with performance data
    const updatedCreator = await db.streamer.update({
      where: { id: discoveryCreatorId },
      data: {
        historicalCpa: cpa ? (
          creator.historicalCpa
            ? (creator.historicalCpa + cpa) / 2 // Rolling average
            : cpa
        ) : creator.historicalCpa,
        historicalConversions: creator.historicalConversions + (conversions || 0),
        historicalCampaigns: creator.historicalCampaigns + (campaignStatus === 'completed' ? 1 : 0),
        avgRoi: roi ? (
          creator.avgRoi
            ? (creator.avgRoi + roi) / 2
            : roi
        ) : creator.avgRoi,
        lastPerformanceSync: new Date()
      }
    });

    // Update or create assignment record
    if (envisionerInfluencerId || envisionerCampaignId) {
      await db.discoveryAssignment.upsert({
        where: {
          id: `${discoveryCreatorId}-${envisionerCampaignId || 'default'}`
        },
        create: {
          id: `${discoveryCreatorId}-${envisionerCampaignId || 'default'}`,
          discoveryCreatorId,
          envisionerInfluencerId,
          envisionerCampaignId,
          totalConversions: conversions || 0,
          totalSpent: spent || 0,
          avgCpa: cpa,
          lastPerformanceSync: new Date()
        },
        update: {
          totalConversions: { increment: conversions || 0 },
          totalSpent: { increment: spent || 0 },
          avgCpa: cpa,
          lastPerformanceSync: new Date()
        }
      });
    }

    logger.info('Performance sync completed', {
      discoveryCreatorId,
      newHistoricalConversions: updatedCreator.historicalConversions,
      newHistoricalCpa: updatedCreator.historicalCpa
    });

    res.json({
      success: true,
      message: 'Performance data synced successfully',
      data: {
        creatorId: discoveryCreatorId,
        historicalConversions: updatedCreator.historicalConversions,
        historicalCampaigns: updatedCreator.historicalCampaigns,
        historicalCpa: updatedCreator.historicalCpa,
        avgRoi: updatedCreator.avgRoi
      }
    });

  } catch (error) {
    logger.error('Performance sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync performance data'
    });
  }
}));

/**
 * POST /api/performance-sync/bulk
 * Bulk sync performance data from Envisioner
 */
router.post('/bulk', asyncHandler(async (req: Request, res: Response) => {
  const { updates } = req.body as BulkPerformanceSyncPayload;

  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'updates array is required'
    });
  }

  logger.info('Bulk performance sync received', { count: updates.length });

  const results = {
    success: 0,
    failed: 0,
    errors: [] as string[]
  };

  for (const update of updates) {
    try {
      const creator = await db.streamer.findUnique({
        where: { id: update.discoveryCreatorId }
      });

      if (!creator) {
        results.failed++;
        results.errors.push(`Creator not found: ${update.discoveryCreatorId}`);
        continue;
      }

      await db.streamer.update({
        where: { id: update.discoveryCreatorId },
        data: {
          historicalCpa: update.cpa ? (
            creator.historicalCpa
              ? (creator.historicalCpa + update.cpa) / 2
              : update.cpa
          ) : creator.historicalCpa,
          historicalConversions: creator.historicalConversions + (update.conversions || 0),
          historicalCampaigns: creator.historicalCampaigns + (update.campaignStatus === 'completed' ? 1 : 0),
          avgRoi: update.roi ? (
            creator.avgRoi
              ? (creator.avgRoi + update.roi) / 2
              : update.roi
          ) : creator.avgRoi,
          lastPerformanceSync: new Date()
        }
      });

      results.success++;

    } catch (error: any) {
      results.failed++;
      results.errors.push(`Failed to update ${update.discoveryCreatorId}: ${error.message}`);
    }
  }

  logger.info('Bulk performance sync completed', results);

  res.json({
    success: true,
    message: `Synced ${results.success} of ${updates.length} updates`,
    data: results
  });
}));

/**
 * GET /api/performance-sync/stats
 * Get performance sync statistics
 */
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const totalSynced = await db.streamer.count({
    where: {
      lastPerformanceSync: { not: null }
    }
  });

  const recentSyncs = await db.streamer.count({
    where: {
      lastPerformanceSync: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
      }
    }
  });

  const topPerformers = await db.streamer.findMany({
    where: {
      historicalConversions: { gt: 0 }
    },
    orderBy: {
      historicalConversions: 'desc'
    },
    take: 10,
    select: {
      id: true,
      displayName: true,
      platform: true,
      historicalConversions: true,
      historicalCpa: true,
      avgRoi: true
    }
  });

  const avgStats = await db.streamer.aggregate({
    where: {
      historicalConversions: { gt: 0 }
    },
    _avg: {
      historicalCpa: true,
      avgRoi: true
    },
    _sum: {
      historicalConversions: true
    }
  });

  res.json({
    success: true,
    data: {
      totalCreatorsWithPerformanceData: totalSynced,
      recentSyncsLast7Days: recentSyncs,
      aggregates: {
        avgCpa: avgStats._avg.historicalCpa,
        avgRoi: avgStats._avg.avgRoi,
        totalConversions: avgStats._sum.historicalConversions
      },
      topPerformers
    }
  });
}));

/**
 * GET /api/performance-sync/creator/:id
 * Get performance data for a specific creator
 */
router.get('/creator/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const creator = await db.streamer.findUnique({
    where: { id },
    select: {
      id: true,
      displayName: true,
      username: true,
      platform: true,
      historicalCpa: true,
      historicalConversions: true,
      historicalCampaigns: true,
      avgRoi: true,
      lastPerformanceSync: true,
      igamingScore: true,
      brandSafetyScore: true,
      gamblingCompatibility: true
    }
  });

  if (!creator) {
    return res.status(404).json({
      success: false,
      error: 'Creator not found'
    });
  }

  // Get assignment history
  const assignments = await db.discoveryAssignment.findMany({
    where: {
      discoveryCreatorId: id
    },
    orderBy: {
      assignedAt: 'desc'
    }
  });

  res.json({
    success: true,
    data: {
      creator,
      assignments,
      performanceSummary: {
        totalCampaigns: creator.historicalCampaigns,
        totalConversions: creator.historicalConversions,
        avgCpa: creator.historicalCpa,
        avgRoi: creator.avgRoi,
        lastSync: creator.lastPerformanceSync,
        performanceRating: calculatePerformanceRating(creator)
      }
    }
  });
}));

/**
 * Calculate performance rating based on historical data
 */
function calculatePerformanceRating(creator: any): string {
  if (!creator.historicalConversions || creator.historicalConversions === 0) {
    return 'no_data';
  }

  // Rating based on CPA and ROI
  const cpScore = creator.historicalCpa
    ? (creator.historicalCpa < 30 ? 2 : creator.historicalCpa < 60 ? 1 : 0)
    : 0;

  const roiScore = creator.avgRoi
    ? (creator.avgRoi > 2 ? 2 : creator.avgRoi > 1 ? 1 : 0)
    : 0;

  const conversionScore = creator.historicalConversions > 100 ? 2 : creator.historicalConversions > 20 ? 1 : 0;

  const totalScore = cpScore + roiScore + conversionScore;

  if (totalScore >= 5) return 'excellent';
  if (totalScore >= 3) return 'good';
  if (totalScore >= 1) return 'average';
  return 'poor';
}

export const performanceSyncRoutes = router;
