import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { db, logger } from '../src/utils/database';
import { Platform } from '@prisma/client';

// Load env from backend/.env or root .env
const backendEnv = path.resolve(__dirname, '..', '.env');
const rootEnv = path.resolve(__dirname, '..', '..', '.env');
if (fs.existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv });
} else if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else {
  dotenv.config();
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

async function run() {
  const limit = parseInt(process.env.BACKFILL_LIMIT || '1000', 10);
  const missing = await db.streamer.findMany({
    where: { OR: [{ avatarUrl: null }, { avatarUrl: '' }] },
    select: { id: true, platform: true, username: true, profileUrl: true },
    take: limit,
  });

  let updated = 0;
  for (const s of missing) {
    const url = unavatarFor(s.platform, s.username, s.profileUrl);
    if (!url) continue;
    try {
      await db.streamer.update({ where: { id: s.id }, data: { avatarUrl: url } });
      updated++;
    } catch (e) {
      logger.warn('Failed to set avatarUrl', { id: s.id, e });
    }
  }

  logger.info(`Backfill avatars complete. Candidates: ${missing.length}, Updated: ${updated}`);
  await db.$disconnect();
}

run().catch(async (e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});

