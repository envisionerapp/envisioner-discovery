import express from 'express';
import { NotesController } from '../controllers/notesController';

const router = express.Router();
const notesController = new NotesController();

// Get all notes for user
router.get('/', notesController.getNotes);

// Get notes as map (streamerId -> content)
router.get('/map', notesController.getNotesMap);

// Get note for specific creator
router.get('/:streamerId', notesController.getNote);

// Save or update note
router.post('/', notesController.saveNote);

// Delete note
router.delete('/', notesController.deleteNote);

export { router as notesRoutes };
