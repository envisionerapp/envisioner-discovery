import express from 'express';
import { FavoritesController } from '../controllers/favoritesController';

const router = express.Router();
const favoritesController = new FavoritesController();

// No auth required for now (using userId from query/body)
router.get('/', favoritesController.getFavorites);
router.get('/ids', favoritesController.getFavoriteIds);
router.post('/', favoritesController.addFavorite);
router.delete('/', favoritesController.removeFavorite);
router.post('/toggle', favoritesController.toggleFavorite);

export { router as favoritesRoutes };
