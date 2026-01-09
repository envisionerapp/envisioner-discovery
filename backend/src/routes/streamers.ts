import express from 'express';
import { StreamerController } from '../controllers/streamerController';
import { protect } from '../middleware/auth';

const router = express.Router();
const streamerController = new StreamerController();

// All routes require authentication
router.use(protect);

router.get('/', streamerController.getStreamers);
router.get('/stats', streamerController.getStats);
router.get('/export', streamerController.exportToCsv);
router.post('/scrape-now', streamerController.scrapeNow);
router.post('/cache-stats', streamerController.cacheStats);
router.post('/seed-csv', streamerController.seedFromCsv);
router.get('/:id', streamerController.getStreamerById);
router.post('/', streamerController.createStreamer);
router.put('/:id', streamerController.updateStreamer);
router.delete('/:id', streamerController.deleteStreamer);
router.post('/bulk-update', streamerController.bulkUpdateStreamers);

export { router as streamerRoutes };
