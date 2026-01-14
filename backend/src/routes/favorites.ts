import express from 'express';
import { FavoritesController } from '../controllers/favoritesController';
import { requireSoftrWithUser, validateUserOwnership, dataRateLimit } from '../middleware/auth';

const router = express.Router();
const favoritesController = new FavoritesController();

// Apply rate limiting and Softr auth with userId validation to all routes
router.use(dataRateLimit);
router.use(requireSoftrWithUser);
router.use(validateUserOwnership);

// All routes now require valid Softr context + userId validation
router.get('/', favoritesController.getFavorites);
router.get('/ids', favoritesController.getFavoriteIds);
router.post('/', favoritesController.addFavorite);
router.delete('/', favoritesController.removeFavorite);
router.post('/toggle', favoritesController.toggleFavorite);

export { router as favoritesRoutes };
