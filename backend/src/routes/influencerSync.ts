import express from 'express';
import { influencerSyncService } from '../services/influencerSyncService';
import { enrichLinkedInProfiles } from '../jobs/linkedinEnrichJob';

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

export { router as influencerSyncRoutes };
