import express from 'express';
import { CampaignController } from '../controllers/campaignController';
import { protect, restrictTo } from '../middleware/auth';

const router = express.Router();
const campaignController = new CampaignController();

// All routes require authentication (simplified for now)

router.get('/', campaignController.getCampaigns);
router.get('/stats', campaignController.getCampaignStats);
router.get('/:id', campaignController.getCampaignById);
router.post('/', campaignController.createCampaign);
router.put('/:id', campaignController.updateCampaign);
router.delete('/:id', campaignController.deleteCampaign);
router.post('/:id/assign/:streamerId', campaignController.assignStreamerToCampaign);
router.delete('/:id/unassign/:streamerId', campaignController.unassignStreamerFromCampaign);
router.get('/:id/streamers', campaignController.getCampaignStreamers);

export { router as campaignRoutes };