import express from 'express';
import { AuthController } from '../controllers/authController';
import { authRateLimit } from '../middleware/auth';

const router = express.Router();
const authController = new AuthController();

// Apply rate limiting to auth routes
router.use(authRateLimit);

router.post('/login', authController.login);
router.post('/verify-mfa', authController.verifyMfa);
router.post('/setup-mfa', authController.setupMfa);
router.post('/disable-mfa', authController.disableMfa);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authController.logout);
router.get('/me', authController.getCurrentUser);

export { router as authRoutes };