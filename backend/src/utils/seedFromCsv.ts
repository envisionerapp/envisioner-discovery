import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { db, logger } from './database';
import { Platform, Region, FraudStatus } from '@prisma/client';

type CsvRow = {
  Platform?: string;
  'Channel name'?: string;
  'Channel url'?: string;
  Country?: string;
  Language?: string;
  Followers?: string;
  'Top Game'?: string;
  'Peak Viewers'?: string;
  'Average Viewers'?: string;
  [key: string]: any;
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
    'venezuela (bolivarian republic of)': Region.VENEZUELA,
    'dominican republic (república dominicana)': Region.DOMINICAN_REPUBLIC,
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

export async function seedFromCsvIfEmpty(): Promise<{ created: number; updated: number; skipped: number }> {
  try {
    const total = await db.streamer.count();
    if (total > 0) {
      return { created: 0, updated: 0, skipped: 0 };
    }

    // In production (dist/), CSV is at dist/csv/combined.csv
    // In development, CSV is at src/../csv/combined.csv
    const csvPath = process.env.NODE_ENV === 'production'
      ? path.resolve(__dirname, 'csv', 'combined.csv')
      : path.resolve(__dirname, '..', 'csv', 'combined.csv');
    if (!fs.existsSync(csvPath)) {
      logger.warn(`CSV not found at ${csvPath}; skipping auto-seed.`);
      return { created: 0, updated: 0, skipped: 0 };
    }

    const content = fs.readFileSync(csvPath, 'utf8');
    const rows = parse(content, { columns: true, skip_empty_lines: true, trim: true }) as CsvRow[];

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      try {
        const platform = mapPlatform(row.Platform);
        const username = (row['Channel name'] || '').trim();
        const displayName = row['Channel name']?.trim() || username;
        const profileUrl = row['Channel url']?.trim() || '';
        const region = mapRegion(row.Country);
        const language = mapLanguage(row.Language);
        const followers = toInt(row.Followers) ?? 0;
        const topGame = row['Top Game']?.trim();
        const peakViewers = toInt(row['Peak Viewers']);

        if (!platform || !username || !region) {
          skipped++;
          continue;
        }

        const existing = await db.streamer.findFirst({ where: { platform, username: username.toLowerCase() } });
        if (existing) {
          await db.streamer.update({
            where: { id: existing.id },
            data: {
              displayName,
              profileUrl,
              followers,
              // Don't update currentViewers, isLive, or tags - preserve from enrichment and cron job
              highestViewers: peakViewers ?? undefined,
              currentGame: topGame,
              topGames: topGame ? [topGame] : [],
              // tags: deriveTags(topGame), // REMOVED - preserve enriched tags
              region,
              language,
              fraudCheck: FraudStatus.CLEAN,
              lastScrapedAt: new Date(),
            },
          });
          updated++;
        } else {
          await db.streamer.create({
            data: {
              platform,
              username: username.toLowerCase(),
              displayName,
              profileUrl,
              followers,
              currentViewers: null,
              highestViewers: peakViewers ?? undefined,
              isLive: false,
              currentGame: topGame,
              topGames: topGame ? [topGame] : [],
              tags: deriveTags(topGame),
              region,
              language,
              usesCamera: false,
              isVtuber: false,
              fraudCheck: FraudStatus.CLEAN,
            },
          });
          created++;
        }
      } catch (e) {
        skipped++;
      }
    }

    const after = await db.streamer.count();
    logger.info(`Auto-seed complete. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Total: ${after}`);
    return { created, updated, skipped };
  } catch (error) {
    logger.error('Auto-seed error', { error });
    return { created: 0, updated: 0, skipped: 0 };
  }
}

