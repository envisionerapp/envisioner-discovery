import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { db, logger } from './database';
import { Platform, Region, FraudStatus } from '@prisma/client';
import { deriveUsernameFromUrl } from './username';

type CsvRow = {
  Platform?: string;
  'Channel name'?: string;
  'Channel url'?: string;
  Country?: string;
  Language?: string;
  Followers?: string;
  'Top Game'?: string;
  'Peak Viewers'?: string;
};

const toInt = (val: string | number | null | undefined): number | null => {
  if (val === null || val === undefined) return null;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[, ]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : null;
};

const mapPlatform = (p: string | undefined): Platform | null => {
  if (!p) return null;
  const v = p.toLowerCase();
  if (v.includes('twitch')) return Platform.TWITCH;
  if (v.includes('youtube')) return Platform.YOUTUBE;
  if (v.includes('kick')) return Platform.KICK;
  if (v.includes('facebook')) return Platform.FACEBOOK;
  if (v.includes('tiktok')) return Platform.TIKTOK;
  return null;
};

const mapRegion = (country: string | undefined): Region | null => {
  if (!country) return null;
  const c = country.toLowerCase();
  const map: Record<string, Region> = {
    mexico: Region.MEXICO,
    colombia: Region.COLOMBIA,
    argentina: Region.ARGENTINA,
    chile: Region.CHILE,
    peru: Region.PERU,
    venezuela: Region.VENEZUELA,
    ecuador: Region.ECUADOR,
    bolivia: Region.BOLIVIA,
    paraguay: Region.PARAGUAY,
    uruguay: Region.URUGUAY,
    'costa rica': Region.COSTA_RICA,
    panama: Region.PANAMA,
    guatemala: Region.GUATEMALA,
    'el salvador': Region.EL_SALVADOR,
    honduras: Region.HONDURAS,
    nicaragua: Region.NICARAGUA,
    'dominican republic': Region.DOMINICAN_REPUBLIC,
    'puerto rico': Region.PUERTO_RICO,
    brazil: Region.BRAZIL,
  };
  return map[c] ?? null;
};

const mapLanguage = (lang: string | undefined): string => {
  if (!lang) return 'es';
  const l = lang.toLowerCase();
  if (l.startsWith('spanish')) return 'es';
  if (l.startsWith('portuguese') || l === 'pt') return 'pt';
  if (l.startsWith('english') || l === 'en') return 'en';
  return l.slice(0, 2);
};

const deriveTags = (topGame: string | undefined): string[] => {
  if (!topGame) return [];
  const g = topGame.toLowerCase();
  const tags: string[] = [];
  if (g.includes('irl') || g.includes('just chatting')) tags.push('IRL');
  if (g.includes('music')) tags.push('MUSIC');
  if (g.includes('horror')) tags.push('HORROR');
  if (g.includes('rpg')) tags.push('RPG');
  if (g.includes('strategy')) tags.push('STRATEGY');
  if (g.includes('sim')) tags.push('SIMULATION');
  if (tags.length === 0) tags.push('GAMING');
  return tags;
};

export async function csvSyncStrict(csvRelativePath: string = path.resolve(__dirname, '..', 'csv', 'combined.csv')): Promise<{ totalAfter: number; removed: number; upserts: number }> {
  if (!fs.existsSync(csvRelativePath)) {
    logger.warn(`CSV not found at ${csvRelativePath}; skipping strict sync.`);
    return { totalAfter: await db.streamer.count(), removed: 0, upserts: 0 };
  }
  const content = fs.readFileSync(csvRelativePath, 'utf8');
  const rows = parse(content, { columns: true, skip_empty_lines: true, trim: true }) as CsvRow[];

  const allowed = new Set<string>();
  const parsed: Array<{ platform: Platform; username: string; row: CsvRow }> = [];
  for (const row of rows) {
    const platform = mapPlatform(row.Platform || '') as Platform | null;
    if (!platform) continue;
    const username = deriveUsernameFromUrl(platform, row['Channel url'], row['Channel name']);
    if (!username) continue;
    const key = `${platform}:${username}`;
    if (!allowed.has(key)) {
      allowed.add(key);
      parsed.push({ platform, username, row });
    }
  }

  const existing = await db.streamer.findMany({ select: { id: true, platform: true, username: true } });
  const toRemove: string[] = [];
  for (const s of existing) {
    const key = `${s.platform}:${s.username}`;
    if (!allowed.has(key)) toRemove.push(s.id);
  }

  let removed = 0;
  if (toRemove.length) {
    const batchSize = 500;
    for (let i = 0; i < toRemove.length; i += batchSize) {
      const batch = toRemove.slice(i, i + batchSize);
      const res = await db.streamer.deleteMany({ where: { id: { in: batch } } });
      removed += res.count;
    }
    logger.info(`Strict CSV sync: removed ${removed} non-CSV rows`);
  }

  let upserts = 0;
  for (const item of parsed) {
    const row = item.row;
    const displayName = row['Channel name']?.trim() || item.username;
    const profileUrl = row['Channel url']?.trim() || '';
    const region = mapRegion(row.Country);
    const language = mapLanguage(row.Language);
    const followers = toInt(row.Followers) ?? 0;
    const topGame = row['Top Game']?.trim();
    const peakViewers = toInt(row['Peak Viewers']);

    await db.streamer.upsert({
      where: { platform_username: { platform: item.platform, username: item.username } },
      update: {
        displayName,
        profileUrl,
        followers,
        // Don't update currentViewers, isLive, or tags - preserve from enrichment and cron job
        highestViewers: peakViewers ?? undefined,
        currentGame: topGame,
        topGames: topGame ? [topGame] : [],
        // tags: deriveTags(topGame), // REMOVED - preserve enriched tags
        region: region ?? undefined as any,
        language,
        fraudCheck: FraudStatus.CLEAN,
        lastScrapedAt: new Date(),
      },
      create: {
        platform: item.platform,
        username: item.username,
        displayName,
        profileUrl,
        followers,
        currentViewers: null,
        highestViewers: peakViewers ?? undefined,
        isLive: false,
        currentGame: topGame,
        topGames: topGame ? [topGame] : [],
        tags: deriveTags(topGame),
        region: region ?? (Region.MEXICO as any),
        language,
        usesCamera: false,
        isVtuber: false,
        fraudCheck: FraudStatus.CLEAN,
      },
    });
    upserts++;
  }

  const totalAfter = await db.streamer.count();
  logger.info(`Strict CSV sync complete. Upserts: ${upserts}. Total now: ${totalAfter}`);
  return { totalAfter, removed, upserts };
}

