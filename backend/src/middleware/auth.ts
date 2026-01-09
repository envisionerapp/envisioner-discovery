import { Request, Response, NextFunction } from 'express';
import { AppError, asyncHandler } from './errorHandler';
import { db } from '../utils/database';
import { verify as jwtVerify } from 'jsonwebtoken';

// Simplified middleware - no AuthRequest interface for now
export const protect = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // Check if embed mode
  const isEmbedMode = req.headers['x-embed-mode'] === 'true';

  if (isEmbedMode) {
    // Validate referrer
    const referrer = (req.headers['referer'] || req.headers['x-embed-referrer']) as string;
    const allowedDomains = (process.env.ALLOWED_EMBED_DOMAINS || 'softr.app,softr.io,envisioner.io').split(',');
    console.log('Embed mode enabled-------->>>>', { referrer, allowedDomains });
    const isValidReferrer = allowedDomains.some(domain =>
      referrer?.toLowerCase().includes(domain.toLowerCase().trim())
    ) || !referrer; // Allow empty referrer for testing
    console.log('isValidReferrer------->>>>>>><:', isValidReferrer);
    if (isValidReferrer) {
      (req as any).user = {
        id: 'embed-user',
        email: 'embed@envisioner.io',
        mfaEnabled: false
      };
      return next();
    } else {
      throw new AppError('Invalid embed referrer', 403);
    }
  }

  // JWT auth normal
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.split(' ')[1] : '';
  if (!token) {
    throw new AppError('Unauthorized', 401);
  }
  try {
    const decoded = jwtVerify(token, process.env.JWT_SECRET as string) as any;
    const user = await db.user.findUnique({ where: { id: decoded.id } });
    if (!user) throw new AppError('Unauthorized', 401);
    (req as any).user = { id: user.id, email: user.email, mfaEnabled: user.mfaEnabled };
    next();
  } catch (e) {
    throw new AppError('Unauthorized', 401);
  }
});

export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // For now, just allow all requests
    next();
  };
};

export const optionalAuth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // Check if embed mode
  const isEmbedMode = req.headers['x-embed-mode'] === 'true';

  if (isEmbedMode) {
    // Validate referrer
    const referrer = (req.headers['referer'] || req.headers['x-embed-referrer']) as string;
    const allowedDomains = (process.env.ALLOWED_EMBED_DOMAINS || 'softr.app,softr.io').split(',');

    const isValidReferrer = allowedDomains.some(domain =>
      referrer?.toLowerCase().includes(domain.toLowerCase().trim())
    ) || !referrer;

    if (isValidReferrer) {
      (req as any).user = {
        id: 'embed-user',
        email: 'embed@envisioner.io',
        mfaEnabled: false
      };
    }
    return next();
  }

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

export const checkMfaStatus = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // For now, just continue
  next();
});

export const authRateLimit = (windowMs: number = 15 * 60 * 1000, max: number = 5) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // For now, just continue without rate limiting
    next();
  };
};
