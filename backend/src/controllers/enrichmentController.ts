import { Request, Response } from 'express';
import webEnrichmentService from '../services/webEnrichmentService';
import advancedEnrichmentService from '../services/advancedEnrichmentService';
import { intelligentEnrichmentService } from '../services/intelligentEnrichmentService';
import { uploadPanelImages } from '../services/bunnyService';
import { db, logger } from '../utils/database';

/**
 * Start enrichment process for all streamers in database
 */
export const startBatchEnrichment = async (req: Request, res: Response) => {
  try {
    const { batchSize = 100, concurrency = 5 } = req.body;

    // Get total count of unenriched streamers
    const totalUnenriched = await db.streamer.count({
      where: {
        lastEnrichmentUpdate: null
      }
    });

    logger.info(`Starting ADVANCED batch enrichment for ${totalUnenriched} streamers`);

    // Start ADVANCED enrichment process in background
    advancedEnrichmentService.enrichAllStreamers(batchSize)
      .catch(error => {
        logger.error('Advanced batch enrichment error:', error);
      });

    res.json({
      success: true,
      message: 'Batch enrichment started',
      data: {
        totalStreamers: totalUnenriched,
        batchSize,
        concurrency
      }
    });
  } catch (error) {
    logger.error('Error starting batch enrichment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start batch enrichment'
    });
  }
};

/**
 * Enrich a single streamer by ID
 */
export const enrichStreamer = async (req: Request, res: Response) => {
  try {
    const { streamerId } = req.params;

    if (!streamerId) {
      return res.status(400).json({
        success: false,
        error: 'Streamer ID is required'
      });
    }

    await advancedEnrichmentService.enrichStreamer(streamerId);

    // Get updated streamer data
    const streamer = await db.streamer.findUnique({
      where: { id: streamerId },
      select: {
        id: true,
        username: true,
        platform: true,
        lastEnrichmentUpdate: true,
        profileDescription: true,
        panelTexts: true,
        streamTitles: true,
        contentAnalysis: true
      }
    });

    res.json({
      success: true,
      message: 'Streamer enriched successfully',
      data: streamer
    });
  } catch (error) {
    logger.error(`Error enriching streamer ${req.params.streamerId}:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to enrich streamer'
    });
  }
};

/**
 * Enrich multiple streamers by IDs
 */
export const enrichStreamers = async (req: Request, res: Response) => {
  try {
    const { streamerIds, concurrency = 5 } = req.body;

    if (!Array.isArray(streamerIds) || streamerIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Streamer IDs array is required'
      });
    }

    // Start ADVANCED enrichment in background
    advancedEnrichmentService.enrichStreamers(streamerIds, concurrency)
      .catch(error => {
        logger.error('Advanced batch enrichment error:', error);
      });

    res.json({
      success: true,
      message: 'Enrichment started for selected streamers',
      data: {
        count: streamerIds.length,
        concurrency
      }
    });
  } catch (error) {
    logger.error('Error enriching streamers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to enrich streamers'
    });
  }
};

/**
 * Get enrichment status and statistics
 */
export const getEnrichmentStatus = async (req: Request, res: Response) => {
  try {
    const [total, enriched, unenriched, recentlyEnriched] = await Promise.all([
      db.streamer.count(),
      db.streamer.count({
        where: {
          lastEnrichmentUpdate: {
            not: null
          }
        }
      }),
      db.streamer.count({
        where: {
          lastEnrichmentUpdate: null
        }
      }),
      db.streamer.count({
        where: {
          lastEnrichmentUpdate: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      })
    ]);

    const percentComplete = total > 0 ? ((enriched / total) * 100).toFixed(2) : '0';

    res.json({
      success: true,
      data: {
        totalStreamers: total,
        enrichedStreamers: enriched,
        unenrichedStreamers: unenriched,
        recentlyEnriched24h: recentlyEnriched,
        percentComplete: parseFloat(percentComplete)
      }
    });
  } catch (error) {
    logger.error('Error getting enrichment status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get enrichment status'
    });
  }
};

/**
 * Re-enrich streamers that haven't been updated in X days
 */
export const reEnrichStaleStreamers = async (req: Request, res: Response) => {
  try {
    const { daysOld = 30, batchSize = 100 } = req.body;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const staleStreamers = await db.streamer.findMany({
      where: {
        lastEnrichmentUpdate: {
          lt: cutoffDate
        }
      },
      select: { id: true },
      take: batchSize
    });

    const streamerIds = staleStreamers.map(s => s.id);

    if (streamerIds.length === 0) {
      return res.json({
        success: true,
        message: 'No stale streamers found',
        data: {
          count: 0
        }
      });
    }

    // Start re-enrichment in background
    webEnrichmentService.enrichStreamers(streamerIds, 5)
      .catch(error => {
        logger.error('Re-enrichment error:', error);
      });

    res.json({
      success: true,
      message: 'Re-enrichment started for stale streamers',
      data: {
        count: streamerIds.length,
        daysOld
      }
    });
  } catch (error) {
    logger.error('Error re-enriching stale streamers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to re-enrich stale streamers'
    });
  }
};

/**
 * Get enrichment sample data for a streamer
 */
export const getStreamerEnrichmentData = async (req: Request, res: Response) => {
  try {
    const { streamerId } = req.params;

    const streamer = await db.streamer.findUnique({
      where: { id: streamerId },
      select: {
        id: true,
        username: true,
        displayName: true,
        platform: true,
        profileDescription: true,
        bannerText: true,
        panelTexts: true,
        aboutSection: true,
        externalLinks: true,
        streamTitles: true,
        chatKeywords: true,
        communityPosts: true,
        contentAnalysis: true,
        webPresence: true,
        lastEnrichmentUpdate: true
      }
    });

    if (!streamer) {
      return res.status(404).json({
        success: false,
        error: 'Streamer not found'
      });
    }

    res.json({
      success: true,
      data: streamer
    });
  } catch (error) {
    logger.error('Error getting streamer enrichment data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get streamer enrichment data'
    });
  }
};

/**
 * Force re-enrich all streamers' panel images to Bunny CDN
 */
export const forceReEnrichPanelsToBunny = async (req: Request, res: Response) => {
  try {
    const { batchSize = 50, platform } = req.body;

    // Find streamers with panel images that aren't on Bunny CDN yet
    const whereClause: any = {
      panelImages: { not: null }
    };

    if (platform) {
      whereClause.platform = platform.toUpperCase();
    }

    const streamers = await db.streamer.findMany({
      where: whereClause,
      select: {
        id: true,
        username: true,
        platform: true,
        panelImages: true
      },
      take: batchSize
    });

    logger.info(`Found ${streamers.length} streamers with panel images to migrate to Bunny CDN`);

    // Start migration in background
    (async () => {
      let migrated = 0;
      let errors = 0;

      for (const streamer of streamers) {
        try {
          const panels = streamer.panelImages as Array<{ url: string; alt?: string; link?: string }>;

          if (!panels || panels.length === 0) continue;

          // Check if already on Bunny
          const needsMigration = panels.some(p => !p.url.includes('b-cdn.net') && !p.url.includes('media.envr.io'));

          if (!needsMigration) {
            logger.info(`${streamer.username} panels already on Bunny CDN`);
            continue;
          }

          logger.info(`Uploading ${panels.length} panels for ${streamer.username} to Bunny CDN...`);

          const updatedPanels = await uploadPanelImages(
            streamer.platform.toLowerCase(),
            streamer.username,
            panels
          );

          await db.streamer.update({
            where: { id: streamer.id },
            data: { panelImages: updatedPanels }
          });

          migrated++;
          logger.info(`✅ Migrated panels for ${streamer.username}`);

          // Small delay to avoid overwhelming Bunny API
          await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error: any) {
          errors++;
          logger.error(`Failed to migrate panels for ${streamer.username}:`, error.message);
        }
      }

      logger.info(`Panel migration complete: ${migrated} migrated, ${errors} errors`);
    })();

    res.json({
      success: true,
      message: 'Panel migration to Bunny CDN started in background',
      data: {
        streamersFound: streamers.length,
        batchSize
      }
    });

  } catch (error) {
    logger.error('Error starting panel migration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start panel migration'
    });
  }
};

/**
 * Full re-enrichment using intelligent service (with Bunny CDN uploads)
 */
export const intelligentReEnrich = async (req: Request, res: Response) => {
  try {
    const { limit = 100 } = req.body;

    logger.info(`Starting intelligent re-enrichment for ${limit} streamers`);

    // Start in background
    intelligentEnrichmentService.enrichAllStreamers(limit)
      .then(result => {
        logger.info('Intelligent re-enrichment completed', result);
      })
      .catch(error => {
        logger.error('Intelligent re-enrichment failed:', error);
      });

    res.json({
      success: true,
      message: 'Intelligent re-enrichment started in background',
      data: { limit }
    });

  } catch (error) {
    logger.error('Error starting intelligent re-enrichment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start intelligent re-enrichment'
    });
  }
};
