import { db, logger } from './database';
import { Platform } from '@prisma/client';

async function validateAvatarUrl(url: string): Promise<boolean> {
  try {
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 3000);
    });

    const fetchPromise = fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MieloBot/1.0)'
      }
    });

    const response = await Promise.race([fetchPromise, timeoutPromise]);

    // Check if URL returns a valid image
    const contentType = response.headers.get('content-type') || '';
    const isValidImage = response.ok && contentType.startsWith('image/');

    // Additional check: reject common default/generic avatars
    if (isValidImage) {
      // Check for common Twitch default logo patterns
      const isTwitchDefault = url.includes('twitch') && (
        response.headers.get('content-length') === '12738' || // Common Twitch logo size
        response.headers.get('content-length') === '3027' ||  // Another common size
        url.includes('twitch-logo') ||
        url.includes('default')
      );

      if (isTwitchDefault) {
        logger.debug(`🖼️ AVATAR VALIDATION: Rejecting Twitch default logo ${url}`);
        return false;
      }
    }

    if (!isValidImage) {
      logger.debug(`🖼️ AVATAR VALIDATION: Invalid avatar URL ${url} - Status: ${response.status}, ContentType: ${contentType}`);
    }

    return isValidImage;
  } catch (error) {
    logger.debug(`🖼️ AVATAR VALIDATION: Failed to validate ${url}`, { error });
    return false;
  }
}

function unavatarFor(platform: Platform, username?: string | null, profileUrl?: string | null): string | null {
  const u = (username || '').trim();
  const p = (profileUrl || '').trim();
  switch (platform) {
    case 'TWITCH':
      if (u) return `https://unavatar.io/twitch/${encodeURIComponent(u)}`;
      if (p) return `https://unavatar.io/${encodeURIComponent(p)}`;
      return null;
    case 'YOUTUBE':
      if (u) return `https://unavatar.io/youtube/${encodeURIComponent(u)}`;
      if (p) return `https://unavatar.io/${encodeURIComponent(p)}`;
      return null;
    case 'KICK':
      if (u) return `https://unavatar.io/${encodeURIComponent(`https://kick.com/${u}`)}`;
      if (p) return `https://unavatar.io/${encodeURIComponent(p)}`;
      return null;
    default:
      if (p) return `https://unavatar.io/${encodeURIComponent(p)}`;
      return null;
  }
}

export async function backfillAvatars(limit: number = 500): Promise<{ candidates: number; updated: number }> {
  try {
    logger.info(`🖼️ AVATAR BACKFILL: Starting avatar backfill with limit ${limit}`);

    // First, clean up existing default Twitch logos
    const cleanedUp = await db.streamer.updateMany({
      where: {
        avatarUrl: {
          contains: 'twitch'
        }
      },
      data: {
        avatarUrl: null
      }
    });

    if (cleanedUp.count > 0) {
      logger.info(`🖼️ AVATAR CLEANUP: Removed ${cleanedUp.count} potential Twitch default avatars`);
    }

    const missing = await db.streamer.findMany({
      where: { OR: [{ avatarUrl: null }, { avatarUrl: '' }] },
      select: { id: true, platform: true, username: true, profileUrl: true },
      take: limit,
    });

    logger.info(`🖼️ AVATAR BACKFILL: Found ${missing.length} streamers with missing avatars`);

    if (missing.length === 0) {
      logger.info(`🖼️ AVATAR BACKFILL: No missing avatars to process`);
      return { candidates: 0, updated: 0 };
    }

    let updated = 0;
    let skipped = 0;

    for (const s of missing) {
      const url = unavatarFor(s.platform, s.username, s.profileUrl);
      logger.debug(`🖼️ AVATAR BACKFILL: Processing ${s.platform}/${s.username} -> ${url || 'NO_URL'}`);

      if (!url) {
        logger.warn(`🖼️ AVATAR BACKFILL: Could not generate URL for ${s.platform}/${s.username}`);
        skipped++;
        continue;
      }

      // Validate avatar URL before saving
      const isValid = await validateAvatarUrl(url);
      if (!isValid) {
        logger.warn(`🖼️ AVATAR BACKFILL: Skipping invalid avatar for ${s.platform}/${s.username} - ${url}`);
        skipped++;
        continue;
      }

      try {
        await db.streamer.update({ where: { id: s.id }, data: { avatarUrl: url } });
        updated++;
        if (updated % 25 === 0) {
          logger.info(`🖼️ AVATAR BACKFILL: Progress ${updated}/${missing.length} (skipped: ${skipped})`);
        }
      } catch (e) {
        logger.error(`🖼️ AVATAR BACKFILL: Failed to update ${s.id}`, { e });
        skipped++;
      }
    }

    logger.info(`🖼️ AVATAR BACKFILL: Complete! Candidates: ${missing.length}, Updated: ${updated}, Skipped: ${skipped}`);
    return { candidates: missing.length, updated };
  } catch (error) {
    logger.error(`🖼️ AVATAR BACKFILL: Error during backfill`, { error });
    return { candidates: 0, updated: 0 };
  }
}