import express from 'express';
import { NotesController } from '../controllers/notesController';
import { requireSoftrWithUser, validateUserOwnership, dataRateLimit } from '../middleware/auth';

const router = express.Router();
const notesController = new NotesController();

// Apply rate limiting and Softr auth with userId validation to all routes
router.use(dataRateLimit);
router.use(requireSoftrWithUser);
router.use(validateUserOwnership);

// All routes now require valid Softr context + userId validation
router.get('/', notesController.getNotes);
router.get('/map', notesController.getNotesMap);
router.get('/:streamerId', notesController.getNote);
router.post('/', notesController.saveNote);
router.delete('/', notesController.deleteNote);

export { router as notesRoutes };
