import { db, logger } from './database';
import { Platform } from '@prisma/client';

type Group = {
  platform: Platform;
  key: string; // normalized displayName
  ids: string[];
};

export async function dedupeStreamersByDisplayName(): Promise<{ groups: number; removed: number; updated: number }> {
  const all = await db.streamer.findMany({
    select: {
      id: true,
      platform: true,
      displayName: true,
      followers: true,
      highestViewers: true,
      topGames: true,
      tags: true,
      currentGame: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  const map = new Map<string, typeof all>();
  for (const s of all) {
    const name = (s.displayName || '').trim();
    if (!name) continue;
    const key = `${s.platform}:${name.toLowerCase()}`;
    const arr = map.get(key) ?? [];
    arr.push(s);
    map.set(key, arr);
  }

  let groups = 0;
  let removed = 0;
  let updated = 0;

  for (const [key, list] of map) {
    if (list.length <= 1) continue;
    groups++;

    // Pick best to keep: highest followers, then highest viewers, then latest updatedAt
    const keep = list
      .slice()
      .sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0) || (b.highestViewers ?? 0) - (a.highestViewers ?? 0) || (b.updatedAt?.getTime?.() ?? 0) - (a.updatedAt?.getTime?.() ?? 0))[0];

    const toDelete = list.filter((x) => x.id !== keep.id);
    const maxFollowers = Math.max(...list.map((x) => x.followers ?? 0));
    const maxPeak = Math.max(...list.map((x) => x.highestViewers ?? 0));
    const unionGames = Array.from(new Set(list.flatMap((x) => x.topGames || []).filter(Boolean)));
    const unionTags = Array.from(new Set(list.flatMap((x) => x.tags || []).filter(Boolean)));
    const currentGame = keep.currentGame || list.find((x) => x.currentGame)?.currentGame || null;

    try {
      // Update the kept record with merged stats
      await db.streamer.update({
        where: { id: keep.id },
        data: {
          followers: maxFollowers,
          highestViewers: maxPeak || null,
          topGames: unionGames,
          tags: unionTags,
          currentGame: currentGame || undefined,
        },
      });
      updated++;
    } catch (e) {
      logger.warn('Dedupe update failed', { key, keep: keep.id, e });
    }

    if (toDelete.length > 0) {
      try {
        const del = await db.streamer.deleteMany({ where: { id: { in: toDelete.map((x) => x.id) } } });
        removed += del.count;
      } catch (e) {
        logger.warn('Dedupe delete failed', { key, ids: toDelete.map((x) => x.id), e });
      }
    }
  }

  logger.info(`Dedupe complete. Groups: ${groups}, Removed: ${removed}, Updated kept: ${updated}`);
  return { groups, removed, updated };
}

