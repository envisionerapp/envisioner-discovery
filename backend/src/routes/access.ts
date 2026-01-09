import express from 'express';
import { db } from '../utils/database';

const router = express.Router();

// Validate user access - checks Softr context and auto-creates user if needed
router.post('/validate', async (req, res) => {
  try {
    const { email, softrContext } = req.body;

    // 1. Check if request has Softr context (referer or header)
    const referer = req.headers.referer || req.headers.origin || '';
    const softrHeader = req.headers['x-softr-app'] as string;

    // Allow if referer contains softr domain OR has softr header OR softrContext flag
    const isSoftrContext =
      referer.includes('.softr.') ||
      referer.includes('softr.io') ||
      softrHeader === 'true' ||
      softrContext === true;

    // For development, also allow localhost
    const isDevelopment = referer.includes('localhost') || referer.includes('127.0.0.1');

    if (!isSoftrContext && !isDevelopment) {
      return res.status(403).json({
        success: false,
        error: 'ACCESS_DENIED',
        message: 'This application can only be accessed through Softr'
      });
    }

    // 2. Check if email is provided
    if (!email) {
      return res.status(401).json({
        success: false,
        error: 'NO_EMAIL',
        message: 'User email is required'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 3. Check if user exists in main users table
    const mainUser = await db.$queryRaw<{ email: string; firstName: string | null }[]>`
      SELECT email, "firstName" FROM users WHERE LOWER(email) = ${normalizedEmail}
      LIMIT 1
    `;

    // 4. Check if user exists in discovery_users table
    let discoveryUser = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, firstName: true }
    });

    // User must exist in main users table - no exceptions
    if (!mainUser || mainUser.length === 0) {
      console.log(`❌ Access denied - user not in users table: ${normalizedEmail}`);
      return res.status(403).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: 'Your account does not have access to this application'
      });
    }

    // 5. Auto-create discovery_users record if not exists
    if (!discoveryUser) {
      discoveryUser = await db.user.create({
        data: {
          email: normalizedEmail,
          firstName: mainUser[0].firstName,
          password: 'synced-from-users',
        },
        select: { id: true, email: true, firstName: true }
      });
      console.log(`✅ Synced user to discovery_users: ${normalizedEmail}`);
    }

    const user = {
      id: discoveryUser.id,
      email: discoveryUser.email,
      firstName: discoveryUser.firstName
    };

    // Success - user is valid
    console.log(`✅ Access granted: ${normalizedEmail}`);
    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName
      }
    });

  } catch (error: any) {
    console.error('Access validation error:', error);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to validate access'
    });
  }
});

export { router as accessRoutes };
