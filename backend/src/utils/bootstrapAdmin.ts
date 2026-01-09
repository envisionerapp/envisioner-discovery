import bcrypt from 'bcryptjs';
import { db, logger } from './database';

export async function bootstrapAdminUser() {
  try {
    const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || '';
    const reset = String(process.env.ADMIN_RESET_PASSWORD || 'false').toLowerCase() === 'true';

    if (!email) {
      logger.info('ADMIN_EMAIL not set; skipping admin bootstrap');
      return;
    }

    // Ensure only miela.cc unless explicitly allowed
    if (!email.endsWith('@miela.cc')) {
      logger.warn('ADMIN_EMAIL is not @miela.cc; continuing but verify this is intentional');
    }

    const existing = await db.user.findUnique({ where: { email } });

    if (!existing) {
      if (!password) {
        logger.warn('ADMIN_PASSWORD not set; cannot create admin user');
        return;
      }
      const hash = await bcrypt.hash(password, 10);
      const user = await db.user.create({
        data: {
          email,
          password: hash,
          mfaEnabled: false,
        },
      });
      logger.info('Admin user created', { email: user.email });
      return;
    }

    if (reset && password) {
      const hash = await bcrypt.hash(password, 10);
      await db.user.update({ where: { email }, data: { password: hash } });
      logger.info('Admin user password reset', { email });
    }
  } catch (e) {
    logger.error('Admin bootstrap failed', { e });
  }
}

