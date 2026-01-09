import express from 'express';
import { AdminController } from '../controllers/adminController';
import { protect } from '../middleware/auth';

const router = express.Router();
const adminController = new AdminController();

// Require authentication for all admin endpoints
router.use(protect);

router.get('/system-stats', adminController.getSystemStats);
router.get('/scraping-logs', adminController.getScrapingLogs);
router.post('/scraping/start', adminController.startScraping);
router.post('/scraping/stop', adminController.stopScraping);
router.get('/scraping/status', adminController.getScrapingStatus);
router.post('/cache/clear', adminController.clearCache);
router.get('/users', adminController.getUsers);
router.post('/users/:id/disable-mfa', adminController.disableUserMfa);
router.post('/avatars/dedupe', adminController.dedupeAvatars);
router.post('/import-csv', adminController.importCsvData);
router.post('/bulk-import', adminController.bulkImportStreamers);
router.post('/sync/replace-all-streamers', adminController.replaceAllStreamersWithLocal);
router.post('/scrape-tags', adminController.scrapeStreamerTags);
router.post('/backfill-avatars', adminController.backfillAvatars);

export { router as adminRoutes };
