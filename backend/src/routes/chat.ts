import express from 'express';
import { ChatController } from '../controllers/chatController';
import { protect } from '../middleware/auth';

const router = express.Router();
const chatController = new ChatController();

// Health check (no auth required)
router.get('/health', chatController.healthCheck);

// Dashboard endpoints (public for demo)
router.get('/dashboard/stats', chatController.getDashboardStats);
router.get('/dashboard/live', chatController.getLiveStreamers);
router.get('/dashboard/top-streamers', chatController.getTopStreamers);
router.get('/dashboard/top-categories', chatController.getTopCategories);

// AI-powered streamer search endpoints (public for demo)
router.post('/search', chatController.searchStreamers);
router.get('/trending', chatController.getTrendingInsights);

// Protected routes require authentication
router.use(protect);

// Chat conversation endpoints (protected - user-specific)
router.post('/message', chatController.sendMessage);
router.get('/conversations/:conversationId', chatController.getConversation);
router.get('/history', chatController.getChatHistory);
router.delete('/conversations/:conversationId', chatController.deleteConversation);
router.delete('/history', chatController.clearChatHistory);
router.get('/suggestions', chatController.getConversationSuggestions);

// Advanced AI endpoints
router.post('/compare', chatController.compareStreamers);
router.get('/streamers/:streamerId/similar', chatController.findSimilarStreamers);

// Analytics endpoints
router.get('/analytics/chat', chatController.getChatAnalytics);
router.get('/analytics/search', chatController.getSearchAnalytics);

export { router as chatRoutes };