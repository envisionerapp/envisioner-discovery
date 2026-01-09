import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { db } from '../utils/database';
import bcrypt from 'bcryptjs';
import { sign as jwtSign, verify as jwtVerify } from 'jsonwebtoken';

export class AuthController {
  login = asyncHandler(async (req: Request, res: Response) => {
    const body = (req as any).body || {};
    const email = (body.email ?? '').toString();
    const password = (body.password ?? '').toString();
    const normalizedEmail = email.trim().toLowerCase();

    // Simple validation
    if (!normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    // Restrict to @miela.cc domain (ADMIN_EMAIL is for superuser privileges, not access restriction)
    if (!normalizedEmail.endsWith('@miela.cc')) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Select only required fields for faster query
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        password: true,
        mfaEnabled: true,
      },
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Minimal JWT payload for smaller tokens
    const accessToken = jwtSign({ id: user.id, email: user.email }, process.env.JWT_SECRET as string, { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any });
    const refreshToken = jwtSign({ id: user.id }, (process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET) as string, { expiresIn: (process.env.REFRESH_TOKEN_EXPIRES_IN || '30d') as any });

    res.status(200).json({
      success: true,
      data: {
        tokens: {
          accessToken,
          refreshToken,
        },
        user: {
          id: user.id,
          email: user.email,
          mfaEnabled: user.mfaEnabled,
        },
      },
    });
  });

  verifyMfa = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'MFA verification coming soon',
    });
  });

  setupMfa = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'MFA setup coming soon',
    });
  });

  disableMfa = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'MFA disable coming soon',
    });
  });

  refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = (req.body?.refreshToken || '').toString();
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh token required' });
    }
    try {
      const decoded = jwtVerify(refreshToken, (process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET) as string ) as any;
      const user = await db.user.findUnique({ where: { id: decoded.id } });
      if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });
      const accessToken = jwtSign({ id: user.id, email: user.email }, process.env.JWT_SECRET as string, { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any });
      return res.status(200).json({ success: true, data: { accessToken, refreshToken } });
    } catch (e) {
      return res.status(401).json({ success: false, error: 'Invalid refresh token' });
    }
  });

  logout = asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  });

  getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
    try {
      const auth = (req.headers.authorization || '').split(' ')[1];
      const decoded = jwtVerify(auth, process.env.JWT_SECRET as string) as any;
      const user = await db.user.findUnique({ where: { id: decoded.id } });
      if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });
      return res.status(200).json({ success: true, data: { id: user.id, email: user.email, mfaEnabled: user.mfaEnabled } });
    } catch (e) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
  });
}
