import express from 'express';
import { DiscardsController } from '../controllers/discardsController';

const router = express.Router();
const discardsController = new DiscardsController();

// No auth required for now (using userId from query/body)
router.get('/', discardsController.getDiscarded);
router.get('/ids', discardsController.getDiscardedIds);
router.post('/', discardsController.addDiscarded);
router.delete('/', discardsController.removeDiscarded);
router.post('/toggle', discardsController.toggleDiscarded);

export { router as discardsRoutes };
