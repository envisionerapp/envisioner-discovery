import express from 'express';
import { ShortlistController } from '../controllers/shortlistController';
import { requireSoftrWithUser, validateUserOwnership, dataRateLimit } from '../middleware/auth';

const router = express.Router();
const shortlistController = new ShortlistController();

// Apply rate limiting and Softr auth with userId validation to all routes
router.use(dataRateLimit);
router.use(requireSoftrWithUser);
router.use(validateUserOwnership);

// Get all shortlists for user (optionally filtered by list name)
router.get('/', shortlistController.getShortlists);

// Get shortlist IDs only (for quick lookup)
router.get('/ids', shortlistController.getShortlistIds);

// Get all list names for user
router.get('/lists', shortlistController.getListNames);

// Add to shortlist
router.post('/', shortlistController.addToShortlist);

// Remove from shortlist
router.delete('/', shortlistController.removeFromShortlist);

// Update shortlist entry (priority, notes)
router.patch('/', shortlistController.updateShortlistEntry);

// Reorder shortlist (bulk update priorities)
router.post('/reorder', shortlistController.reorderShortlist);

// Toggle shortlist (add/remove)
router.post('/toggle', shortlistController.toggleShortlist);

export { router as shortlistRoutes };
