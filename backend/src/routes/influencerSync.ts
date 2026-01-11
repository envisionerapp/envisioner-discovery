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

export { router as influencerSyncRoutes };
