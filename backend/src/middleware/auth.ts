import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { AppError, asyncHandler } from './errorHandler';
import { db } from '../utils/database';
import { verify as jwtVerify } from 'jsonwebtoken';

// =============================================================================
// RATE LIMITERS (using express-rate-limit)
// =============================================================================

// General API rate limiter - 100 requests per minute per IP
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { success: false, error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use userId if available, otherwise IP
    const userId = req.query.userId as string || req.body?.userId;
    return userId || req.ip || 'unknown';
  },
});

// Stricter rate limiter for auth endpoints - 10 requests per 15 minutes
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { success: false, error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiter for data-heavy endpoints - 30 requests per minute
export const dataRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: { success: false, error: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = req.query.userId as string || req.body?.userId;
    return userId || req.ip || 'unknown';
  },
});

// Very strict rate limiter for discovery/scraping endpoints - 5 per minute
export const discoveryRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { success: false, error: 'Discovery rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
});

// =============================================================================
// SOFTR VALIDATION HELPERS
// =============================================================================

const ALLOWED_DOMAINS = (process.env.ALLOWED_EMBED_DOMAINS || 'softr.app,softr.io,envisioner.io').split(',').map(d => d.trim().toLowerCase());

function isValidSoftrReferrer(referrer: string | undefined): boolean {
  if (!referrer) return false; // Empty referrer NOT allowed

  const lowerRef = referrer.toLowerCase();

  // Only allow in development mode with explicit NODE_ENV check
  if (process.env.NODE_ENV === 'development') {
    if (lowerRef.includes('localhost') || lowerRef.includes('127.0.0.1')) {
      return true;
    }
  }

  // Check against allowed Softr domains
  return ALLOWED_DOMAINS.some(domain => lowerRef.includes(domain));
}

function isSoftrContext(req: Request): boolean {
  const referer = req.headers.referer || req.headers.origin || '';
  const embedReferrer = req.headers['x-embed-referrer'] as string || '';
  const softrHeader = req.headers['x-softr-app'] as string;
  const isEmbedMode = req.headers['x-embed-mode'] === 'true';

  // Must have valid Softr referrer OR softr header
  const hasValidReferrer = isValidSoftrReferrer(referer) || isValidSoftrReferrer(embedReferrer);
  const hasSoftrHeader = softrHeader === 'true';

  return hasValidReferrer || (isEmbedMode && hasSoftrHeader);
}

// =============================================================================
// AUTH MIDDLEWARE
// =============================================================================

/**
 * Protect middleware - requires valid Softr context OR JWT token
 */
export const protect = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // Check if valid Softr embed context
  const isEmbedMode = req.headers['x-embed-mode'] === 'true';

  if (isEmbedMode) {
    const referrer = (req.headers['referer'] || req.headers['x-embed-referrer']) as string;

    if (isValidSoftrReferrer(referrer)) {
      // Valid Softr context - extract user from query/body
      const userId = req.query.userId as string || req.body?.userId;
      (req as any).user = {
        id: userId || 'embed-user',
        email: userId || 'embed@envisioner.io',
        mfaEnabled: false,
        isSoftrEmbed: true
      };
      return next();
    } else {
      throw new AppError('Invalid embed referrer - access denied', 403);
    }
  }

  // JWT auth fallback
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.split(' ')[1] : '';
  if (!token) {
    throw new AppError('Unauthorized - no token provided', 401);
  }

  try {
    const decoded = jwtVerify(token, process.env.JWT_SECRET as string) as any;
    const user = await db.user.findUnique({ where: { id: decoded.id } });
    if (!user) throw new AppError('Unauthorized - user not found', 401);
    (req as any).user = { id: user.id, email: user.email, mfaEnabled: user.mfaEnabled };
    next();
  } catch (e) {
    throw new AppError('Unauthorized - invalid token', 401);
  }
});

/**
 * Softr-only middleware - strictly requires valid Softr context (no JWT fallback)
 * Does NOT require userId - use validateUserOwnership after this for user-specific endpoints
 */
export const requireSoftr = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (!isSoftrContext(req)) {
    throw new AppError('This endpoint can only be accessed through Softr', 403);
  }

  // Extract user from Softr context if available
  const userId = req.query.userId as string || req.body?.userId;
  (req as any).user = {
    id: userId || 'softr-user',
    email: userId || 'softr@envisioner.io',
    mfaEnabled: false,
    isSoftrEmbed: true
  };

  next();
});

/**
 * Softr-only middleware that also requires userId
 * Use for user-specific endpoints like favorites, discards, notes
 */
export const requireSoftrWithUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (!isSoftrContext(req)) {
    throw new AppError('This endpoint can only be accessed through Softr', 403);
  }

  // Extract user from Softr context - REQUIRED
  const userId = req.query.userId as string || req.body?.userId;
  if (!userId) {
    throw new AppError('User identification required', 401);
  }

  (req as any).user = {
    id: userId,
    email: userId,
    mfaEnabled: false,
    isSoftrEmbed: true
  };

  next();
});

/**
 * Optional auth - sets user if available but doesn't require it
 */
export const optionalAuth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const isEmbedMode = req.headers['x-embed-mode'] === 'true';

  if (isEmbedMode) {
    const referrer = (req.headers['referer'] || req.headers['x-embed-referrer']) as string;

    if (isValidSoftrReferrer(referrer)) {
      const userId = req.query.userId as string || req.body?.userId;
      (req as any).user = {
        id: userId || 'embed-user',
        email: userId || 'embed@envisioner.io',
        mfaEnabled: false,
        isSoftrEmbed: true
      };
    }
    return next();
  }

  // Try JWT auth
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.split(' ')[1] : '';
  if (!token) return next();

  try {
    const decoded = jwtVerify(token, process.env.JWT_SECRET as string) as any;
    const user = await db.user.findUnique({ where: { id: decoded.id } });
    if (user) (req as any).user = { id: user.id, email: user.email, mfaEnabled: user.mfaEnabled };
  } catch {}
  next();
});

/**
 * Validate userId matches authenticated user
 * Use after protect/requireSoftr to ensure user can only access their own data
 */
export const validateUserOwnership = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const authenticatedUser = (req as any).user;
  const requestedUserId = req.query.userId as string || req.body?.userId || req.params.userId;

  if (!authenticatedUser) {
    throw new AppError('Authentication required', 401);
  }

  if (!requestedUserId) {
    throw new AppError('User ID required', 400);
  }

  // Normalize emails for comparison
  const authEmail = authenticatedUser.email?.toLowerCase().trim();
  const requestEmail = requestedUserId.toLowerCase().trim();

  // Allow if authenticated user matches requested user
  if (authEmail === requestEmail || authenticatedUser.id === requestedUserId) {
    return next();
  }

  // Log suspicious activity
  console.warn(`⚠️ User ownership mismatch: authenticated as ${authEmail}, requested ${requestEmail}`);

  throw new AppError('Access denied - you can only access your own data', 403);
});

export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // For now, just allow all requests
    next();
  };
};

export const checkMfaStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  next();
});
