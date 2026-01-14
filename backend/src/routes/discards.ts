import express from 'express';
import { DiscardsController } from '../controllers/discardsController';
import { requireSoftrWithUser, validateUserOwnership, dataRateLimit } from '../middleware/auth';

const router = express.Router();
const discardsController = new DiscardsController();

// Apply rate limiting and Softr auth with userId validation to all routes
router.use(dataRateLimit);
router.use(requireSoftrWithUser);
router.use(validateUserOwnership);

// All routes now require valid Softr context + userId validation
router.get('/', discardsController.getDiscarded);
router.get('/ids', discardsController.getDiscardedIds);
router.post('/', discardsController.addDiscarded);
router.delete('/', discardsController.removeDiscarded);
router.post('/toggle', discardsController.toggleDiscarded);

export { router as discardsRoutes };
