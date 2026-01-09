import { db, logger } from './database';
import { Platform } from '@prisma/client';
import { deriveUsernameFromUrl } from './username';

export async function normalizeUsernamesAndDedupe(): Promise<{ scanned: number; updated: number; removed: number; merged: number }> {
  const all = await db.streamer.findMany({
    select: {
      id: true,
      platform: true,
      username: true,
      displayName: true,
      profileUrl: true,
      followers: true,
      highestViewers: true,
      topGames: true,
      tags: true,
      currentGame: true,
      updatedAt: true,
    },
  });

  const byKey = new Map<string, typeof all[number][]>();
  let updated = 0;
  let removed = 0;
  let merged = 0;

  for (const s of all) {
    const canonical = deriveUsernameFromUrl(s.platform, s.profileUrl, s.username);
    const key = `${s.platform}:${canonical}`;
    const arr = byKey.get(key) || [];
    arr.push({ ...s, username: canonical });
    byKey.set(key, arr);
  }

  for (const [key, list] of byKey) {
    if (list.length === 0) continue;
    // Choose keeper: highest followers, then peak, then updatedAt
    const keeper = list
      .slice()
      .sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0) || (b.highestViewers ?? 0) - (a.highestViewers ?? 0) || (new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()))[0];

    // Ensure keeper has canonical username
    const [platform, canonical] = key.split(':');
    if (keeper.username !== canonical) {
      try {
        await db.streamer.update({ where: { id: keeper.id }, data: { username: canonical } });
        updated++;
      } catch (e) {
        // Unique conflict: find conflicting row and re-evaluate merging below
        logger.warn('Username update conflict', { key, keeper: keeper.id });
      }
    }

    // Merge and delete the rest
    for (const s of list) {
      if (s.id === keeper.id) continue;
      try {
        await db.streamer.update({
          where: { id: keeper.id },
          data: {
            followers: Math.max(keeper.followers ?? 0, s.followers ?? 0),
            highestViewers: Math.max(keeper.highestViewers ?? 0, s.highestViewers ?? 0) || null,
            topGames: Array.from(new Set([...(keeper.topGames || []), ...(s.topGames || [])].filter(Boolean))),
            tags: Array.from(new Set([...(keeper.tags || []), ...(s.tags || [])])),
            currentGame: keeper.currentGame || s.currentGame || undefined,
          },
        });
        await db.streamer.delete({ where: { id: s.id } });
        removed++;
        merged++;
      } catch (e) {
        logger.warn('Merge/delete failed', { key, keeper: keeper.id, victim: s.id, e });
      }
    }
  }

  logger.info(`Normalize/dedupe complete. Scanned: ${all.length}, Updated usernames: ${updated}, Merged: ${merged}, Removed: ${removed}`);
  return { scanned: all.length, updated, removed, merged };
}

