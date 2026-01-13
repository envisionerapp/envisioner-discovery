import express from 'express';
import { influencerSyncService } from '../services/influencerSyncService';
import { enrichLinkedInProfiles } from '../jobs/linkedinEnrichJob';
import { db } from '../utils/database';
import { Platform } from '@prisma/client';

const router = express.Router();

// Sync influencers from external table to discovery_creators
router.post('/sync', async (req, res) => {
  try {
    const result = await influencerSyncService.syncInfluencersToDiscovery();
    res.json({
      success: true,
      message: 'Sync completed',
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get pending sync count
router.get('/pending', async (req, res) => {
  try {
    const count = await influencerSyncService.getPendingSyncCount();
    res.json({
      success: true,
      data: { pendingCount: count },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Enrich LinkedIn profiles with followers data from ScrapeCreators
router.post('/enrich-linkedin', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const result = await enrichLinkedInProfiles(limit);
    res.json({
      success: true,
      message: 'LinkedIn enrichment completed',
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Test ScrapeCreators LinkedIn API directly
router.get('/test-linkedin-api/:username', async (req, res) => {
  try {
    const { scrapeCreatorsService } = await import('../services/scrapeCreatorsService');
    const username = req.params.username;
    const profile = await scrapeCreatorsService.getLinkedInProfile(username);
    res.json({
      success: true,
      username,
      profile,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Debug endpoint to check sync queue
router.get('/debug-queue', async (req, res) => {
  try {
    const platform = ((req.query.platform as string)?.toUpperCase() || 'LINKEDIN') as Platform;

    const pending = await db.socialSyncQueue.count({
      where: { platform: platform as any, status: 'PENDING' }
    });
    const completed = await db.socialSyncQueue.count({
      where: { platform: platform as any, status: 'COMPLETED' }
    });
    const failed = await db.socialSyncQueue.count({
      where: { platform: platform as any, status: 'FAILED' }
    });
    const samples = await db.socialSyncQueue.findMany({
      where: { platform: platform as any, status: 'PENDING' },
      select: { username: true, priority: true, createdAt: true },
      take: 10,
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: {
        platform,
        pending,
        completed,
        failed,
        total: pending + completed + failed,
        samples
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug endpoint to check LinkedIn profiles
router.get('/debug-linkedin', async (req, res) => {
  try {
    const allLinkedIn = await db.streamer.count({
      where: { platform: Platform.LINKEDIN }
    });
    const needsEnrich = await db.streamer.findMany({
      where: {
        platform: Platform.LINKEDIN,
        lastScrapedAt: null,
      },
      select: { id: true, username: true, followers: true, lastScrapedAt: true },
      take: 5,
    });
    res.json({
      success: true,
      data: {
        totalLinkedIn: allLinkedIn,
        needsEnrichCount: needsEnrich.length,
        samples: needsEnrich,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Process pending LinkedIn profiles from queue
router.post('/process-linkedin-queue', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const { scrapeCreatorsService } = await import('../services/scrapeCreatorsService');

    // Check queue status first
    const pendingCount = await db.socialSyncQueue.count({
      where: { platform: 'LINKEDIN' as any, status: 'PENDING' }
    });

    if (pendingCount === 0) {
      return res.json({
        success: true,
        message: 'No pending LinkedIn profiles in queue',
        data: { processed: 0, pending: 0 }
      });
    }

    // Use existing syncPlatform method which processes the queue
    scrapeCreatorsService.syncPlatform('LINKEDIN', limit)
      .then(result => {
        console.log(`LinkedIn sync complete:`, result);
      })
      .catch(error => {
        console.error(`LinkedIn sync failed:`, error);
      });

    res.json({
      success: true,
      message: `Processing up to ${limit} LinkedIn profiles in background`,
      data: { pending: pendingCount, batchSize: limit }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reset LinkedIn profiles to re-enrich them
router.post('/reset-linkedin', async (req, res) => {
  try {
    const result = await db.streamer.updateMany({
      where: {
        platform: Platform.LINKEDIN,
        followers: 0, // Only reset those that didn't get enriched properly
      },
      data: { lastScrapedAt: null }
    });
    res.json({
      success: true,
      message: `Reset ${result.count} LinkedIn profiles for re-enrichment`,
      data: { resetCount: result.count },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export { router as influencerSyncRoutes };
