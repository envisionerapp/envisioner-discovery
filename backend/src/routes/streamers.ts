import express from 'express';
import { StreamerController } from '../controllers/streamerController';
import { protect, requireSoftr, dataRateLimit } from '../middleware/auth';
import { StreamerService } from '../services/streamerService';
import { db } from '../utils/database';

const router = express.Router();
const streamerController = new StreamerController();

// Apply rate limiting to all routes
router.use(dataRateLimit);

// Public routes - require Softr context for scrape protection
router.get('/', requireSoftr, streamerController.getStreamers);
router.get('/stats', requireSoftr, streamerController.getStats);

// Backfill avatars - protected admin route
router.post('/backfill-avatars', protect, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const platform = (req.query.platform as string)?.toUpperCase() || 'ALL';

    console.log(`🖼️ Starting avatar backfill`, { platform, limit });

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

    console.log(`🖼️ Avatar backfill complete`, { totalUpdated, totalErrors, streamersWithAvatars });

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
  } catch (error: any) {
    console.error('🖼️ Avatar backfill failed', error);
    res.status(500).json({
      success: false,
      message: 'Avatar backfill failed',
      error: error.message
    });
  }
});

// Backfill YouTube handles - protected admin route
router.post('/backfill-youtube-handles', protect, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;

    console.log(`🎬 Starting YouTube handle backfill`, { limit });

    const streamerService = new StreamerService();
    const result = await streamerService.backfillYouTubeHandles(limit);

    console.log(`🎬 YouTube handle backfill complete`, result);

    res.status(200).json({
      success: true,
      message: 'YouTube handle backfill completed',
      data: result
    });
  } catch (error: any) {
    console.error('🎬 YouTube handle backfill failed', error);
    res.status(500).json({
      success: false,
      message: 'YouTube handle backfill failed',
      error: error.message
    });
  }
});

router.get('/:id', requireSoftr, streamerController.getStreamerById);

// Protected routes (require authentication)
router.get('/export', protect, streamerController.exportToCsv);
router.post('/scrape-now', protect, streamerController.scrapeNow);
router.post('/cache-stats', protect, streamerController.cacheStats);
router.post('/seed-csv', protect, streamerController.seedFromCsv);
router.post('/', protect, streamerController.createStreamer);
router.put('/:id', protect, streamerController.updateStreamer);
router.delete('/:id', protect, streamerController.deleteStreamer);
router.post('/bulk-update', protect, streamerController.bulkUpdateStreamers);

export { router as streamerRoutes };
