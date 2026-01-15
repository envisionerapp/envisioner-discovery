/**
 * Bulk Import Creators Script
 *
 * Parses social media URLs and enriches them using the existing APIs.
 * Supports: Instagram, YouTube, TikTok, Twitch, Kick, X/Twitter, Facebook, LinkedIn
 *
 * Features:
 * - Parses URLs from file or embedded list
 * - Fetches full profile data including followers, bio, location
 * - Uploads avatars to Bunny CDN (handled by scrapeCreatorsService)
 * - Extracts cross-platform social links from profiles
 * - Maps locations to regions
 * - Handles YouTube channels with the ScrapeCreators API
 *
 * Usage:
 *   npx ts-node scripts/bulk-import-creators.ts                    # Uses URLs from file
 *   npx ts-node scripts/bulk-import-creators.ts --batch=50         # Process 50 per platform
 *   npx ts-node scripts/bulk-import-creators.ts --dry-run          # Just parse, don't save
 *   npx ts-node scripts/bulk-import-creators.ts --sync-only        # Only process queue, don't add new
 */

import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load env before imports that need it
const backendEnv = path.resolve(__dirname, '..', '.env');
const rootEnv = path.resolve(__dirname, '..', '..', '.env');
if (fs.existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv });
} else if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else {
  dotenv.config();
}

import { db } from '../src/utils/database';
import { scrapeCreatorsService } from '../src/services/scrapeCreatorsService';
import { Platform, Region, FraudStatus } from '@prisma/client';

// ==================== URL PARSING ====================

interface ParsedCreator {
  platform: Platform;
  username: string;
  url: string;
  linkedUrl?: string; // Secondary URL (e.g., Instagram linked from YouTube page)
}

function extractPlatformAndUsername(url: string): ParsedCreator | null {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  try {
    // Normalize URL
    let normalized = trimmed;
    if (!normalized.startsWith('http')) {
      normalized = 'https://' + normalized;
    }

    const urlObj = new URL(normalized);
    const hostname = urlObj.hostname.toLowerCase().replace('www.', '');
    const pathname = urlObj.pathname.replace(/\/$/, ''); // Remove trailing slash

    // Instagram
    if (hostname.includes('instagram.com')) {
      const match = pathname.match(/^\/([a-zA-Z0-9._]+)/);
      if (match && !['p', 'reel', 'reels', 'stories', 'explore', 'accounts', 'direct'].includes(match[1])) {
        return { platform: Platform.INSTAGRAM, username: match[1].toLowerCase(), url: trimmed };
      }
    }

    // YouTube
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      // Skip video URLs
      if (pathname.startsWith('/watch') || pathname.startsWith('/shorts')) return null;

      // @handle format
      let match = pathname.match(/^\/@([a-zA-Z0-9_-]+)/);
      if (match) {
        return { platform: Platform.YOUTUBE, username: match[1], url: trimmed };
      }

      // /c/channelname format
      match = pathname.match(/^\/c\/([a-zA-Z0-9_-]+)/);
      if (match) {
        return { platform: Platform.YOUTUBE, username: match[1], url: trimmed };
      }

      // /channel/UCxxxx format
      match = pathname.match(/^\/channel\/([a-zA-Z0-9_-]+)/);
      if (match) {
        return { platform: Platform.YOUTUBE, username: match[1], url: trimmed };
      }

      // /user/username format
      match = pathname.match(/^\/user\/([a-zA-Z0-9_-]+)/);
      if (match) {
        return { platform: Platform.YOUTUBE, username: match[1], url: trimmed };
      }

      // Direct channel path (e.g., /ChannelName)
      match = pathname.match(/^\/([a-zA-Z0-9_-]+)$/);
      if (match && !['feed', 'gaming', 'music', 'premium', 'kids'].includes(match[1].toLowerCase())) {
        return { platform: Platform.YOUTUBE, username: match[1], url: trimmed };
      }
    }

    // TikTok
    if (hostname.includes('tiktok.com')) {
      const match = pathname.match(/^\/@?([a-zA-Z0-9._]+)/);
      if (match && !['foryou', 'following', 'live', 'discover'].includes(match[1].toLowerCase())) {
        return { platform: Platform.TIKTOK, username: match[1].replace('@', ''), url: trimmed };
      }
    }

    // Twitch
    if (hostname.includes('twitch.tv')) {
      const match = pathname.match(/^\/([a-zA-Z0-9_]+)/);
      if (match && !['directory', 'videos', 'downloads', 'p', 'settings', 'subscriptions'].includes(match[1].toLowerCase())) {
        return { platform: Platform.TWITCH, username: match[1].toLowerCase(), url: trimmed };
      }
    }

    // Kick
    if (hostname.includes('kick.com')) {
      const match = pathname.match(/^\/([a-zA-Z0-9_-]+)/);
      if (match && !['categories', 'following', 'browse'].includes(match[1].toLowerCase())) {
        return { platform: Platform.KICK, username: match[1].toLowerCase(), url: trimmed };
      }
    }

    // X (Twitter)
    if (hostname.includes('x.com') || hostname.includes('twitter.com')) {
      const match = pathname.match(/^\/([a-zA-Z0-9_]+)/);
      if (match && !['home', 'explore', 'notifications', 'messages', 'settings', 'i', 'search'].includes(match[1].toLowerCase())) {
        return { platform: Platform.X, username: match[1], url: trimmed };
      }
    }

    // Facebook
    if (hostname.includes('facebook.com') || hostname.includes('fb.com')) {
      const match = pathname.match(/^\/([a-zA-Z0-9._-]+)/);
      if (match && !['login', 'watch', 'marketplace', 'groups', 'events', 'pages', 'profile.php', 'people'].includes(match[1].toLowerCase())) {
        return { platform: Platform.FACEBOOK, username: match[1], url: trimmed };
      }
    }

    // LinkedIn
    if (hostname.includes('linkedin.com')) {
      // Personal profile
      let match = pathname.match(/^\/in\/([a-zA-Z0-9_-]+)/);
      if (match) {
        return { platform: Platform.LINKEDIN, username: match[1], url: trimmed };
      }

      // Company page
      match = pathname.match(/^\/company\/([a-zA-Z0-9_-]+)/);
      if (match) {
        return { platform: Platform.LINKEDIN, username: `company:${match[1]}`, url: trimmed };
      }
    }

    return null;
  } catch (e) {
    return null;
  }
}

function parseUrls(input: string): ParsedCreator[] {
  const lines = input.split(/[\n\r]+/);
  const parsed: ParsedCreator[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    // Handle multiple URLs on the same line (separated by spaces)
    const urls = line.split(/\s+/).filter(u => u.includes('.'));

    for (const url of urls) {
      const creator = extractPlatformAndUsername(url);
      if (creator) {
        const key = `${creator.platform}:${creator.username.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          parsed.push(creator);
        }
      }
    }
  }

  return parsed;
}

// ==================== MAIN SCRIPT ====================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fileArg = args.find(a => a.startsWith('--file='));
  const batchArg = args.find(a => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : 100;

  console.log('========================================');
  console.log('🚀 BULK IMPORT CREATORS');
  console.log('========================================\n');

  // Get URLs from file (default: data/bulk-creators-urls.txt)
  let urlInput: string;
  const defaultFile = path.resolve(__dirname, '..', 'data', 'bulk-creators-urls.txt');

  if (fileArg) {
    const filePath = fileArg.split('=')[1];
    urlInput = fs.readFileSync(filePath, 'utf-8');
    console.log(`📄 Reading URLs from: ${filePath}`);
  } else if (fs.existsSync(defaultFile)) {
    urlInput = fs.readFileSync(defaultFile, 'utf-8');
    console.log(`📄 Reading URLs from: ${defaultFile}`);
  } else {
    console.log('❌ No URLs file found. Create data/bulk-creators-urls.txt or use --file=path');
    await db.$disconnect();
    return;
  }

  // Parse URLs
  const parsed = parseUrls(urlInput);

  // Count by platform
  const platformCounts: Record<string, number> = {};
  for (const p of parsed) {
    platformCounts[p.platform] = (platformCounts[p.platform] || 0) + 1;
  }

  console.log(`\n📊 Parsed ${parsed.length} unique creators:`);
  for (const [platform, count] of Object.entries(platformCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${platform}: ${count}`);
  }

  if (dryRun) {
    console.log('\n🧪 DRY RUN - Not saving to database');
    console.log('\nSample parsed URLs:');
    for (const p of parsed.slice(0, 20)) {
      console.log(`   ${p.platform}: @${p.username}`);
    }
    await db.$disconnect();
    return;
  }

  // Check for existing creators and filter them out
  console.log('\n🔍 Checking for existing creators...');

  const newCreators: ParsedCreator[] = [];
  const existingCount: Record<string, number> = {};

  for (const p of parsed) {
    const existing = await db.streamer.findFirst({
      where: {
        platform: p.platform,
        username: p.username.toLowerCase(),
      },
      select: { id: true }
    });

    if (existing) {
      existingCount[p.platform] = (existingCount[p.platform] || 0) + 1;
    } else {
      newCreators.push(p);
    }
  }

  // Log skipped counts
  if (Object.keys(existingCount).length > 0) {
    console.log('   Skipped existing creators:');
    for (const [platform, count] of Object.entries(existingCount).sort((a, b) => b[1] - a[1])) {
      console.log(`      ${platform}: ${count}`);
    }
    console.log(`   Total skipped: ${Object.values(existingCount).reduce((a, b) => a + b, 0)}`);
  }

  console.log(`   New creators to import: ${newCreators.length}`);

  if (newCreators.length === 0) {
    console.log('\n✅ All creators already exist in database!');
    await db.$disconnect();
    return;
  }

  // Add to sync queue (only new creators)
  console.log('\n📋 Adding to sync queue...');

  const queueItems = newCreators.map(p => ({
    id: '',
    platform: p.platform,
    username: p.username.toLowerCase(),
    priority: 50, // Default priority
  }));

  const added = await scrapeCreatorsService.addToSyncQueue(queueItems);
  console.log(`   Added ${added} items to queue`);

  // Also create basic records in streamers table for platforms we can't sync via API
  // (Twitch and Kick need their own API, but we can at least create placeholder records)
  console.log('\n📝 Creating placeholder records for streaming platforms...');

  let created = 0;
  let skipped = 0;

  for (const p of newCreators) {
    // For Twitch and Kick, create records directly (they use their own APIs)
    if (p.platform === Platform.TWITCH || p.platform === Platform.KICK) {
      try {
        const existing = await db.streamer.findFirst({
          where: {
            platform: p.platform,
            username: p.username.toLowerCase(),
          }
        });

        if (!existing) {
          await db.streamer.create({
            data: {
              platform: p.platform,
              username: p.username.toLowerCase(),
              displayName: p.username,
              profileUrl: p.url,
              followers: 0,
              region: Region.WORLDWIDE,
              language: 'es',
              tags: [],
              usesCamera: false,
              isVtuber: false,
              fraudCheck: FraudStatus.PENDING_REVIEW,
              discoveredVia: 'bulk-import',
            }
          });
          created++;
        } else {
          skipped++;
        }
      } catch (e) {
        // Ignore duplicates
      }
    }
  }

  console.log(`   Created ${created} new records`);
  console.log(`   Skipped ${skipped} already checked`);

  // Process the sync queue
  console.log('\n🌐 Processing sync queue...');
  console.log(`   Batch size: ${batchSize}`);

  // Recalculate platform counts for new creators only
  const newPlatformCounts: Record<string, number> = {};
  for (const p of newCreators) {
    newPlatformCounts[p.platform] = (newPlatformCounts[p.platform] || 0) + 1;
  }

  // Process each platform that has items
  const platforms: Platform[] = [Platform.INSTAGRAM, Platform.TIKTOK, Platform.X, Platform.FACEBOOK, Platform.LINKEDIN, Platform.YOUTUBE];

  let totalCredits = 0;
  let totalSuccess = 0;
  let totalErrors = 0;

  for (const platform of platforms) {
    const platformCount = newPlatformCounts[platform] || 0;
    if (platformCount === 0) continue;

    console.log(`\n   Processing ${platform}...`);

    try {
      const result = await scrapeCreatorsService.syncPlatform(platform, Math.min(batchSize, platformCount));
      totalCredits += result.credits;
      totalSuccess += result.success;
      totalErrors += result.errors;
      console.log(`   ✅ ${result.success} success, ❌ ${result.errors} errors (${result.credits} credits)`);
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    // Small delay between platforms
    await new Promise(r => setTimeout(r, 500));
  }

  // Final stats
  console.log('\n========================================');
  console.log('📊 FINAL STATS');
  console.log('========================================');
  console.log(`   Total parsed: ${parsed.length}`);
  console.log(`   Already existed: ${parsed.length - newCreators.length}`);
  console.log(`   New imported: ${newCreators.length}`);
  console.log(`   Total success: ${totalSuccess}`);
  console.log(`   Total errors: ${totalErrors}`);
  console.log(`   Credits used: ${totalCredits}`);

  // Check queue status
  const queueStats = await scrapeCreatorsService.getQueueStats();
  console.log('\n📋 Remaining Queue:');
  for (const [platform, stat] of Object.entries(queueStats)) {
    if (stat.pending > 0) {
      console.log(`   ${platform}: ${stat.pending} pending`);
    }
  }

  // Count total in DB
  const total = await db.streamer.count();
  console.log(`\n📊 Total creators in database: ${total}`);

  await db.$disconnect();
}

// No embedded URLs - uses data/bulk-creators-urls.txt by default

// Placeholder for backwards compatibility
const _PLACEHOLDER = `
https://www.instagram.com/heliorlol/
https://www.linkedin.com/in/felipepastenes/
https://x.com/Heliorlol
https://www.tiktok.com/@heliorlol
https://www.facebook.com/HeliorLoL/
https://www.youtube.com/@Helior
https://www.twitch.tv/helior
https://kick.com/heliord
https://www.instagram.com/brit_angelus/
https://www.instagram.com/acamal__/
https://www.instagram.com/thiareferch/
https://www.instagram.com/flaka.vane/
https://kick.com/desacatoo
https://kick.com/tomateee
https://www.twitch.tv/serllinogg
https://kick.com/zouldark
https://kick.com/jabiai
https://kick.com/tioallendenz
https://www.youtube.com/@BrunoSampieri
https://kick.com/quintanachile
https://kick.com/diegotayk
https://www.twitch.tv/panchaalel
https://www.twitch.tv/rociovalentinaa7
https://www.youtube.com/@TrisaborCL
https://www.twitch.tv/comandito81
https://www.twitch.tv/hatakegamingmx
https://kick.com/ifatality
https://www.instagram.com/goatpicksreal/
https://youtube.com/@wawanmks
https://www.youtube.com/@NoisyyTV
https://www.youtube.com/@RusmanDota2
https://www.youtube.com/@kameradzidan
https://www.youtube.com/@RyuzoZeven
https://www.youtube.com/@Pitucos.Marrones
https://kick.com/olengirlm
https://kick.com/eltioclinkzzz
https://kick.com/flocsss
https://kick.com/blaackz
https://www.twitch.tv/aawokes
https://www.instagram.com/cuncubinaa/
https://www.youtube.com/@adigitama
https://www.instagram.com/alexblan23/
https://www.twitch.tv/skrxface1
https://www.twitch.tv/safiro_fk
https://www.twitch.tv/iChurrox
https://www.youtube.com/@elcanaldeedson
https://www.twitch.tv/buggax
https://www.twitch.tv/imirre
https://www.twitch.tv/miitias
https://www.youtube.com/@LevelSatu
https://www.youtube.com/@kemaspakezmantapkali
https://www.youtube.com/@RickyCryptoJunkie
https://www.youtube.com/@wangkiid/streams
https://www.youtube.com/@UnderExpert/
https://www.youtube.com/@frecuencia_cruzada
https://www.youtube.com/@RepSul/
https://www.youtube.com/@hecatrollyt
https://www.youtube.com/@aseprocky10
https://www.youtube.com/@samsulch
https://www.youtube.com/@EANOfficial
https://www.youtube.com/@FogeryGG
https://www.youtube.com/@garudhamahameru
https://www.youtube.com/@eanisyzio
https://www.youtube.com/@UlerSakti
https://kick.com/breakelx
https://kick.com/pepalaloka
https://www.youtube.com/@PerroFutbol
https://www.youtube.com/@cesarluismerloCLM
https://www.instagram.com/roman10alvarado/
https://www.instagram.com/jhonnycarias_gt/
https://www.instagram.com/kamianif_23/
https://kick.com/gato_zombiie
https://www.youtube.com/@nabitewnymszlaku
https://kick.com/katrixx78
https://www.youtube.com/@AkemiGamingCh
https://kick.com/catatyyy
https://kick.com/x1nofps
https://www.twitch.tv/dilanzito/
https://kick.com/ccaaooss
https://kick.com/kategaming
https://kick.com/lonelys1
https://kick.com/elbegss
https://kick.com/maggodota
https://kick.com/techiessenior
https://www.youtube.com/@MONARICA
https://www.youtube.com/@akeminekomachi
https://www.youtube.com/@yaboishiru
https://www.youtube.com/@beczka.prochu
https://www.youtube.com/c/levelsatu
https://www.youtube.com/@DerAventurier/shorts
https://www.youtube.com/@KurierHistoryczny
https://kick.com/kskingg
https://www.twitch.tv/coteparrague
https://www.youtube.com/@aigeschichte
https://www.youtube.com/@Mineczek
https://www.youtube.com/@WasilijSaizev
https://www.youtube.com/@PARALIGHTWORX
https://www.youtube.com/@HistoryHiking
https://www.instagram.com/alonsogoleador/
https://www.twitch.tv/matijesuss
https://www.instagram.com/arturolugoo/
https://www.youtube.com/@FUTBOLTOTALECuio593
https://www.youtube.com/@VMDeporteschile
https://www.twitch.tv/jxrgeslots
https://www.youtube.com/@Los11deRojo
https://www.youtube.com/@FutbolyParrilla
https://www.twitch.tv/anak_7
https://www.twitch.tv/tefyyss_
https://www.youtube.com/@dontforgethistory_official
https://www.youtube.com/@LynisEPR
https://www.youtube.com/@AelisseEPR
https://www.youtube.com/@HousagiEPR
https://www.youtube.com/@TheonLightguardEPR
https://www.youtube.com/@pleivack
https://www.youtube.com/@LIGASPORTSCL
https://www.youtube.com/@BigChab
https://www.youtube.com/@SirCheeese
https://www.youtube.com/@ApaulPlaysHorror
https://www.youtube.com/@Wortelemes
https://www.instagram.com/ashlyy_obando/
https://www.youtube.com/@PanzerArcheology
https://www.youtube.com/@Madelta
https://www.youtube.com/@Chizure
https://www.youtube.com/@RafelAlva
https://www.youtube.com/@MrSonalibaba
https://www.twitch.tv/helior
https://www.twitch.tv/vulpeex
https://www.instagram.com/pankorazzo/
https://www.instagram.com/lahoradekingkong/
https://www.youtube.com/@futbolec21
https://kick.com/triplex
https://www.youtube.com/@KiraHyuuFamisa
https://www.youtube.com/@CorazonID
https://www.youtube.com/@FutbolcrudaEC
https://kick.com/asmongold
https://kick.com/onikir1
https://www.instagram.com/fabiancornejo9/
https://www.youtube.com/@LeoSalinas
https://kick.com/mandreva
https://www.youtube.com/@MakotoshiCh
https://www.youtube.com/@yuurayozakura
https://www.youtube.com/@microj99
https://www.twitch.tv/miawrsu
https://www.instagram.com/hiramfutbol/
https://www.youtube.com/@SoyCristianRey/
https://www.twitch.tv/pasteldepapas_
https://kick.com/elmiillor/
https://www.youtube.com/c/machetevilches8
https://www.youtube.com/@CafecitoGol/
https://kick.com/agusneta
https://kick.com/facuiriondo
https://kick.com/taffa
https://kick.com/pipant
https://www.twitch.tv/apoka
https://www.twitch.tv/enga10
https://www.twitch.tv/amargomate
https://www.twitch.tv/elpelotasssss
https://kick.com/brunitin
https://www.twitch.tv/bigjota
https://www.twitch.tv/santutu/
https://www.twitch.tv/kiaratuliano/
https://www.twitch.tv/nikozfps/
https://www.twitch.tv/venerancia/
https://www.twitch.tv/neamhel
https://www.youtube.com/@433tvoficial/
https://www.twitch.tv/themaxter
https://www.twitch.tv/eljorgitoretro
https://www.twitch.tv/mastervland
https://www.instagram.com/xcaresapo
https://www.youtube.com/@masalladelgol/
https://www.youtube.com/@VicenteCisnerosOficial/
https://kick.com/angelpg
https://kick.com/cosmokings
https://kick.com/zingaraez
https://kick.com/fat10
https://kick.com/baligamings
https://kick.com/luismeewis
https://kick.com/alejoplay
https://kick.com/yisuscollasem
https://kick.com/kotaromnzdota
https://kick.com/jume97
https://kick.com/accamary
https://kick.com/elmichij
https://kick.com/mmaed
https://www.twitch.tv/deadlymarkkk
https://www.twitch.tv/madhusito
https://kick.com/conero_gamers
https://kick.com/diealis
https://www.twitch.tv/mishavtuberowo
https://www.youtube.com/@josekajicrema.oficial/
https://www.twitch.tv/zuidehielo/
https://kick.com/gastilouno
https://www.twitch.tv/meeeenki
https://www.twitch.tv/salingtv
https://www.twitch.tv/koch0_
https://www.twitch.tv/nanoide/
https://www.twitch.tv/tellier50
https://www.twitch.tv/teniie
https://kick.com/garydelphin
https://www.twitch.tv/sadicaz
https://www.instagram.com/itsmidna/
https://www.instagram.com/goddessalfa/
https://www.twitch.tv/itsmidnaa
https://www.twitch.tv/evapartis
https://www.instagram.com/x_bluegame/
https://www.twitch.tv/rayitootv/
https://www.twitch.tv/apaulplays/
https://www.youtube.com/@ApaulPlaysHorror/
http://facebook.com/ApaulPlays
https://www.youtube.com/@MaysaKz/
http://instagram.com/maysakz
https://www.youtube.com/@AngBata11/
https://www.youtube.com/@PeenoisePlays/
http://instagram.com/PeenoiseRealm
https://www.youtube.com/@VonOrdonaYT/
http://instagram.com/vonordona
https://www.youtube.com/@FiqiAmd/
http://instagram.com/fiqiamd
https://www.youtube.com/@Anjasmara7/
http://instagram.com/adityaanapitu
https://www.twitch.tv/bellkunxtv/
https://www.instagram.com/bellkunxtv/
https://www.youtube.com/@DylandPROS/
https://www.youtube.com/@dylandmaximus/
https://www.youtube.com/@KristianPH/
https://www.instagram.com/kristianph_/
https://www.youtube.com/@pokopow/
http://instagram.com/pokopow
https://www.youtube.com/@ShanShineID/
http://instagram.com/shanshin_e
https://www.youtube.com/@letdahyper/
https://www.instagram.com/letda.hyper/reels/
https://www.youtube.com/@eanisyzio/
http://instagram.com/dffskh
https://www.youtube.com/@nafinay
http://instagram.com/nafinay
https://www.youtube.com/@wangkiid/
http://instagram.com/dewasyarif_
https://www.twitch.tv/noxplayroom
https://www.instagram.com/NoxPlayroom
https://www.youtube.com/@NoxPlayroom/
https://www.youtube.com/@EstibPLAYZ/
http://instagram.com/kuya_estib
https://www.tiktok.com/@megatoontv
https://www.youtube.com/@fixgamingchannel/
https://www.youtube.com/@istinok/
https://www.twitch.tv/itsyaboiborris
https://www.youtube.com/@jayce.journal/
http://instagram.com/jaycejournal
https://www.youtube.com/@JazonGaming/
http://tiktok.com/@jazongamingofficial
https://www.twitch.tv/jillipuff/
https://www.instagram.com/jilliansnts/
https://www.youtube.com/@JollySly/
http://instagram.com/JollySlyyy
https://www.twitch.tv/imurchonkycat/
https://www.youtube.com/@EJRMZombieCF/
https://www.youtube.com/@MrRazzieBinx/
http://instagram.com/RazzieBinx
https://www.youtube.com/@NobiplaysYT/
http://instagram.com/n0biplays
https://www.twitch.tv/okvenn
https://www.instagram.com/okvenn/
https://www.youtube.com/@paolulgaming/
https://www.youtube.com/@PatrickSantosPH/
https://www.twitch.tv/patricksantos_/
https://www.instagram.com/PatJLSantos
https://www.youtube.com/@PaylStation/
https://www.youtube.com/@PetixHD/
http://instagram.com/petixhd
https://www.youtube.com/@PlayWithBlaire/
https://www.youtube.com/@reeoch/
https://www.tiktok.com/@reeokunofficial
https://www.youtube.com/@SholaHey/
https://www.instagram.com/sholahey/
https://www.tiktok.com/@sholaheyy
https://www.youtube.com/@TriNhil/
https://www.instagram.com/trinhil/
https://www.tiktok.com/@trinhil
https://www.youtube.com/@VianPlays/
https://www.tiktok.com/@iamtherealvianca
https://www.youtube.com/@mariechanneru/
https://www.youtube.com/@PanVTuber/
https://www.youtube.com/@Ywuria/
https://www.twitch.tv/ywuria/
https://www.youtube.com/@BigChab/
https://www.instagram.com/ChaBigchab
https://www.youtube.com/@Chizure/
http://instagram.com/chizure1
https://www.youtube.com/@Madelta/
https://www.instagram.com/madeltangapung/
https://www.youtube.com/@RafelAlva/
https://www.instagram.com/rafelalva/
https://www.youtube.com/@SirCheeese/
https://www.tiktok.com/@sircheeese_
https://www.youtube.com/@MrSonalibaba/
http://instagram.com/sonalibaba
https://www.youtube.com/@Wortelemes/
https://www.tiktok.com/@Wortelemesss
https://www.instagram.com/Wortelemess
https://www.twitch.tv/summerseachels
https://www.youtube.com/@ShioriPon/
https://www.twitch.tv/shiori_p0n
https://www.instagram.com/shiori_p0n/
https://www.twitch.tv/kyunshino
https://www.twitch.tv/hamatvfps_
https://www.instagram.com/hamajle
https://www.twitch.tv/iancxz
https://www.instagram.com/iandlmnt
https://www.twitch.tv/xmercurialgg
https://www.tiktok.com/@xmercurialgg
https://www.twitch.tv/xuixai_ch
https://www.tiktok.com/@xuixai
https://www.youtube.com/@ThisIsChris09/
https://www.youtube.com/@PanVTuber/featured
https://www.twitch.tv/acesquare_
https://www.twitch.tv/archanny
https://www.instagram.com/joseldagc
https://www.twitch.tv/usersoraa
https://www.tiktok.com/@userrsoraa
https://www.youtube.com/@adiexce/
http://instagram.com/adimhrdka_
https://www.youtube.com/@AfifYulistian/
http://instagram.com/apiipp
https://www.youtube.com/@Ahoyy/
http://instagram.com/yudhafir
https://www.youtube.com/@aldyferdian/
http://instagram.com/aldy_ferdian
https://www.youtube.com/@Almerray/
http://instagram.com/almerrayy
https://www.youtube.com/@baqabaga/
http://instagram.com/baqabaga
https://www.youtube.com/@BlueZpotGaming/
https://www.youtube.com/@dflayer/
https://www.instagram.com/digital_fantasy_player/
https://www.youtube.com/@Diskusian/
http://instagram.com/wiranandawijaya
https://www.youtube.com/@edwinwijaya6/
https://www.instagram.com/edwinwjaya_/
https://www.tiktok.com/@edwinwjaya
https://www.twitch.tv/ezflashkidz/
https://www.instagram.com/_muamaarfhr/
https://www.youtube.com/@FogeryGG/
https://www.instagram.com/pramandanu_
https://www.tiktok.com/@fogerygg
https://www.youtube.com/@GamingPisan/
https://www.instagram.com/gaming_pisan/
https://www.youtube.com/@GemaShowIndo/
http://instagram.com/mister_funtastic
https://www.youtube.com/@gilangluigi/
https://www.instagram.com/realgilangluigi/
https://www.youtube.com/@Gurinzo/
http://tiktok.com/@gurinzo
https://www.youtube.com/@GWYofficiaL/
http://instagram.com/gwy.official
https://www.youtube.com/@Hasta666/
http://instagram.com/gervasius123
https://www.youtube.com/@ichmelda/
http://instagram.com/ichmelda
https://www.youtube.com/@IhsanLuminaire/
http://instagram.com/ihsanbesarik
https://www.youtube.com/@INGORPG/
https://www.youtube.com/@janitra/
http://instagram.com/janitraezra
https://www.youtube.com/@JLGamings/
http://instagram.com/johnsonloe
https://www.youtube.com/@JomeYT/
https://www.instagram.com/meirianitj/
http://tiktok.com/@kaiseravres
https://www.youtube.com/@KaiserAvres/
https://www.youtube.com/@knightking7215/
https://www.youtube.com/@KuroNaichi/
http://instagram.com/kuro.naichi
https://www.youtube.com/@leinxceed/
https://www.instagram.com/leinxceed
https://www.youtube.com/@LivanderGamedev
http://instagram.com/livandergamedev
https://www.youtube.com/@Madekes/
http://instagram.com/madekes
https://www.youtube.com/@Miawaug/
http://instagram.com/miawaug
https://www.youtube.com/@MisakiKurumiAM/
https://www.instagram.com/misaki_kurumi.am/
https://www.youtube.com/@odinofficial2/
https://www.youtube.com/@Otakurei/
https://www.youtube.com/@PAPABOYBR/s
https://www.instagram.com/boyrinaldi/
https://www.youtube.com/@playwithrega/
https://www.instagram.com/playwithrega/
https://www.youtube.com/@PWChandra20/
https://www.instagram.com/PWChandra2.0/
https://www.youtube.com/@Qorygore/
https://www.instagram.com/qorygore
https://www.youtube.com/@Queenuts/
http://instagram.com/queeenuts
https://www.youtube.com/@RendyEmperor/
https://www.youtube.com/@RendyRangers/
https://www.youtube.com/@ricokucing/
http://instagram.com/thomasriico
https://www.youtube.com/@Riplaygaming/
http://instagram.com/riplay.gaming
https://www.youtube.com/@shawafdr/
https://www.tiktok.com/@shawasabanta
https://www.youtube.com/@ShinonVyoma
https://www.instagram.com/shinonvyoma
https://www.youtube.com/@SuburGaming/
http://instagram.com/ipul.subur
https://www.youtube.com/@TAMPANGAMING/
http://instagram.com/dickyanati
https://www.youtube.com/@TheLazyMondayGaming/
https://www.instagram.com/thelazymonday/
https://www.youtube.com/@vanny.skuyyy/
https://www.instagram.com/vanny.skuy/
https://www.youtube.com/@VanSkadiGaming/
http://instagram.com/vanskadi
https://www.youtube.com/@VianoGamingID/
https://www.instagram.com/kevinviano
https://www.youtube.com/@WibiWibawa/
https://www.tiktok.com/@wibi.wibawa
https://www.instagram.com/wibii_
https://www.youtube.com/@zeeesh_/
https://www.instagram.com/zeee_ajah/
https://www.youtube.com/@zethFa/
http://instagram.com/zeth_fa
https://www.youtube.com/@ZimzAjaib/
https://www.youtube.com/@KiikuOrenjikaraCh/
https://www.youtube.com/@RinjuChannel/
https://www.youtube.com/@Fyurith/
https://www.instagram.com/fyurithgame
https://www.youtube.com/@gingehenna/
https://www.instagram.com/gingehenna
https://www.youtube.com/@HeraGaraleaCh/
https://www.youtube.com/@VforVierza/
https://www.instagram.com/vforvierza/
https://www.youtube.com/@SeinaGinevra/
https://www.instagram.com/seinaginevra/
https://www.youtube.com/@Shindari_ch/
https://www.youtube.com/@sherrysakura99/
https://www.instagram.com/sherrysakura99
https://www.youtube.com/@Vi.VTuber/
https://www.instagram.com/vi.vtuber/
https://www.youtube.com/@MiraFridayanti-Virtunix
http://instagram.com/mira_frdynt
https://www.youtube.com/@JellyKukis/
http://instagram.com/jellykukis
https://www.youtube.com/@CeciliaLieberia/
https://www.youtube.com/@rukaaci/
https://www.instagram.com/rukaaci/
https://www.youtube.com/@GentianaHelix/s
https://www.instagram.com/gentianahelix
https://www.youtube.com/@LaylaAlstroemeria/
https://www.youtube.com/@AntoniusAja/
http://instagram.com/antonius_05
https://www.youtube.com/@GabrielAbyssia/
http://instagram.com/gabrielabyssia
https://www.youtube.com/@AndyZuL/
http://instagram.com/andyzul88
https://www.youtube.com/@ToraraGo/
http://instagram.com/torarago
https://www.youtube.com/@tanwiruljojo/
https://www.youtube.com/@DVinecs2/
https://www.instagram.com/dvineexd/
https://www.youtube.com/@Raveanne/
https://www.instagram.com/raveanne_/
https://www.youtube.com/@NazelliaRyoku/
http://instagram.com/nazel_ryo
https://www.youtube.com/@AdelineFrostineCh/
https://www.instagram.com/adeline.frostine/
https://www.youtube.com/@mba_ninik/
https://www.instagram.com/mbaninik_/
https://www.youtube.com/@EgiMulhan/
https://www.instagram.com/egimulhan/
https://www.youtube.com/@rayrestufauzi/
https://www.instagram.com/rayrestufauzi/
https://www.youtube.com/@andhikanug/
https://www.instagram.com/andhikanug/
https://www.twitch.tv/acidk
https://www.twitch.tv/maybeitsyumi
https://www.instagram.com/maybeitsyumi/
https://www.twitch.tv/murasakuras
https://www.tiktok.com/@murasakuras
https://www.twitch.tv/mgchanz
https://www.instagram.com/mgchanz/
https://www.twitch.tv/ai_self
https://www.instagram.com/aise1f
https://www.twitch.tv/vulpeex
https://www.instagram.com/vul.peex
https://www.twitch.tv/spaghettipenelly
https://www.instagram.com/spaghettipenelly/
https://www.twitch.tv/brownykochara
https://www.instagram.com/browny_kochara
https://www.youtube.com/@yedijadimension/
https://www.instagram.com/ellenyedija/
https://www.youtube.com/@theresiaacn/
https://www.instagram.com/theresiaacn
https://www.youtube.com/@Daynusor/
http://instagram.com/daynusor
https://www.twitch.tv/eggytamagoki
http://youtube.com/@kukudota2
https://www.youtube.com/@CorazonID/
https://www.instagram.com/irgidp/
https://www.youtube.com/@MasJoli/
https://www.instagram.com/_masjoli/
https://www.youtube.com/@sonmvv
https://www.instagram.com/sonmv__/
https://www.youtube.com/@EciKazuchi
https://www.instagram.com/ecikazuchi/
https://www.youtube.com/@KiraHyuuFamisa/
https://www.instagram.com/kira_hyuu/
https://www.youtube.com/@IdrisPasta/
https://www.instagram.com/idris_pasta/
instagram.com/rafilnm
https://www.youtube.com/@RafiLNM/
https://www.youtube.com/@Hamzhen/
https://www.instagram.com/_mrboten/
https://www.youtube.com/@MrBoten/
https://www.instagram.com/lealiioo/
https://www.youtube.com/@lealioo/
https://www.youtube.com/@eviech/
https://www.instagram.com/xkaguma
https://www.instagram.com/fernandespetra/
https://www.youtube.com/@KhoPetra/
https://www.youtube.com/@ammanariaramadhan/
https://www.youtube.com/@ViolettaCalytrix/
https://www.instagram.com/drefecer
https://www.youtube.com/@Drefecer/
https://www.youtube.com/@nyomanuk/
https://www.instagram.com/nyomanagass/
https://www.youtube.com/@ApihKuy/
https://www.instagram.com/apih.kuy/
https://www.youtube.com/@microj99/
https://www.instagram.com/microj99/
https://www.youtube.com/@yogadtamp/
https://www.instagram.com/yogstamp_/
https://www.youtube.com/@pemalasyt/
https://www.instagram.com/pemalasyt/
https://www.youtube.com/@Bagasiid/
https://www.instagram.com/masghibs
https://www.youtube.com/@Masghib/
https://www.instagram.com/nezhi_main/
https://www.youtube.com/@NezhiMain/
https://www.youtube.com/@kadirpranata2014
https://www.instagram.com/adityya_p/
https://www.instagram.com/akaarri_/
https://www.youtube.com/@Akari_/
https://www.instagram.com/zet22._/
https://www.youtube.com/@Zet22./
https://www.instagram.com/nightdeh24/
https://www.youtube.com/@NightD24
https://www.instagram.com/00ikkan_/
https://www.youtube.com/@NakkiKun/
https://www.instagram.com/blackbeeid/
https://www.youtube.com/@BlackBeeId/
https://www.youtube.com/@MakotoshiCh
https://www.youtube.com/@yuurayozakura
https://www.youtube.com/@yamaagastya/
https://www.instagram.com/yamaagastya/
https://www.youtube.com/@WindahBasudara
https://www.youtube.com/@deanDEANKT/
https://www.youtube.com/@adigitama
https://www.youtube.com/@noisyytv
https://www.instagram.com/noisyytv/
https://www.youtube.com/wawanmks
https://www.instagram.com/wawanfortunaa/
https://www.youtube.com/@EstebanOpatrilYT/
http://instagram.com/estebaninversiones
https://www.youtube.com/@LautaroBergmann/
http://instagram.com/lautibergmann
https://www.youtube.com/@CryptoSheinix/
https://www.youtube.com/@somosbulls/
https://www.instagram.com/somosbullsok/
https://www.youtube.com/@KManuS88/
https://www.instagram.com/kmanus88
https://x.com/KmanuS88
https://www.youtube.com/@CriptoNorber/
https://www.instagram.com/CriptoNorber
https://www.linkedin.com/in/npgiudice
https://www.youtube.com/@CyberEmprendedor/
http://instagram.com/tonybuet
https://www.youtube.com/@TodoSobreChile/
http://instagram.com/todosobrechile
http://tiktok.com/@todosobrechile
https://www.youtube.com/@CarlosLeaEstrada7/
https://www.youtube.com/channel/UCrvDaze8Pju1cBi04LN-w0g
http://instagram.com/jordanwelch
https://www.youtube.com/@dinerofacilyt/
http://instagram.com/dinerofacil_ok
https://www.youtube.com/@INVERSIONAROK/
https://www.youtube.com/@sediferente/
https://www.instagram.com/gonzapereyrasaez
https://www.youtube.com/@adriannardelli/
http://instagram.com/adriannardellioficial
https://www.instagram.com/luchoocanovas/
https://www.youtube.com/@lubru/
https://www.youtube.com/channel/UCP7PV59jal4PobLeo5cSG_Q
http://instagram.com/santi_amat
https://www.youtube.com/@agustinhansen/
https://www.instagram.com/agushann/
https://www.youtube.com/@elhombredelabolsa/
https://www.instagram.com/elhombredelabolsaa/
https://www.youtube.com/@futuros_millonarios/
https://www.youtube.com/@SantiagoMagnin/
https://www.youtube.com/@KADICRYPTO/
https://x.com/SoyKadi
https://www.instagram.com/lautarokadar/
https://www.youtube.com/@santiagochavezirus/
https://www.instagram.com/santiagochavezirus/
https://www.youtube.com/@AgustinMarchetti/
https://www.youtube.com/@IchimokuFibonacci/
http://instagram.com/elhombredelabolsaa
https://www.youtube.com/@ArensCristian/
http://linkedin.com/in/arenscristian
https://www.instagram.com/arenscristian/
https://www.facebook.com/ArensCristian
https://www.youtube.com/@LuiscaFinanzas/
http://instagram.com/luiscafinanzas
https://www.youtube.com/@educatrader/
https://www.instagram.com/eduardomelo.o/
https://www.youtube.com/@investidorsardinha/
https://www.facebook.com/oraulsena
https://www.instagram.com/oraulsena
https://www.youtube.com/@HermannGreb/featured
https://www.facebook.com/hermanngreb
https://www.instagram.com/hermanngreb
https://www.youtube.com/@ACaraDaRiquezaOficial/featured
https://www.instagram.com/diego.bechara/
https://www.youtube.com/@BermanTraderInvestimentos/
https://www.instagram.com/bermantrader/
https://www.youtube.com/@canalbrunoom/
https://www.youtube.com/@geracaodividendoss/
http://instagram.com/ohleoalves
https://www.youtube.com/@Tassolago/
http://instagram.com/tassolago
https://www.youtube.com/@RodrigoTradestars/
http://instagram.com/rodrigotradestars
https://www.youtube.com/@magonicolas/
http://instagram.com/magonicolas
https://www.youtube.com/@camino.financiero/
https://www.instagram.com/camino.financiero/
https://www.youtube.com/@BRATTIA2021/
https://www.youtube.com/@franlisok/
https://www.instagram.com/franlisok/
https://www.youtube.com/@conperasyfinanzas/
https://www.youtube.com/@ExitoFinancieroOficial/
https://www.instagram.com/exitofinanciero.oficial/
https://www.youtube.com/@MisPropiasFinanzas/
https://www.youtube.com/@BitcoinyCriptos/
http://twitter.com/juanbiter
http://instagram.com/juanbiter
https://www.youtube.com/channel/UCOxHY2MWqwSpXakf0GxpVQA
https://www.tiktok.com/@crypto.lucho
http://instagram.com/luchousl
https://www.youtube.com/@arenaalfa/
https://www.instagram.com/arenaalfa/
https://x.com/ARENAALFA
https://www.youtube.com/@FinanzasPlus/
http://instagram.com/finanzasplus.co
https://www.youtube.com/channel/UCFrqHh-curjxlki4Yt6zW6A
http://instagram.com/karemsuarez
http://twitter.com/karemsuarezv
https://www.youtube.com/@ElMineroSudaka/
https://www.instagram.com/el_minero_sudaka/
https://www.youtube.com/@SoyExitoso/
https://www.youtube.com/@Thonyalvarez/
https://www.instagram.com/thonyalvarez_/
https://www.youtube.com/@EntrenadorFinanciero/
http://instagram.com/br.entrenadorfinanciero
https://www.youtube.com/@corazonfinanciero/
http://instagram.com/corazon.financiero
https://www.youtube.com/@corcobein/
https://www.instagram.com/corco.bein
https://www.tiktok.com/@corcobein
https://kick.com/luisinversionyfinanzas
https://www.youtube.com/c/LuisInversi%C3%B3nyFinanzas/
https://www.instagram.com/luis_inversion_y_finanzas
https://www.youtube.com/@alternativainversiones/
http://instagram.com/alternativainversiones/
https://www.youtube.com/@andresmania/
http://instagram.com/andresmania
https://www.youtube.com/@ClannishFX/
http://instagram.com/alexosorio.fx
https://www.youtube.com/@ZeroTrader/
https://www.youtube.com/@ElGafasTrading/
https://www.instagram.com/elgafastrading/
https://kick.com/linamchaves
https://www.instagram.com/linam.oficial
https://www.youtube.com/@PuntoCripto/
http://tiktok.com/@puntocripto
https://www.youtube.com/c/C%C3%A9sarDabi%C3%A1nFinanzas/
https://www.instagram.com/cesardabian/
https://www.facebook.com/cesardabianfreenanzas/
https://www.youtube.com/@KeviinRuiiz/featured
https://www.instagram.com/keviinruiiz21/
https://www.youtube.com/@andresgarzam/
https://www.linkedin.com/in/andresgarzam-
https://www.instagram.com/andresgarzam/
https://www.facebook.com/andresgarzam
https://www.youtube.com/@LuisMiNegocios/featured
https://www.instagram.com/luisminegocios
https://x.com/luisminegocios
https://www.youtube.com/@EduardoRosas/
https://www.youtube.com/@invierteconpepe_/
https://www.instagram.com/invierteconpepe_/
https://www.youtube.com/@omareducacionfinanciera/
https://www.facebook.com/people/Omar-Educaci%C3%B3n-Financiera-Oficial/61556410517762/
http://instagram.com/OmarEducacionFinanciera
https://www.youtube.com/@PepsGranados/
http://instagram.com/pepsgranadosv
http://twitter.com/PepsGranados
https://www.youtube.com/@MorisDieck/
http://facebook.com/morisdieck
http://twitter.com/MorisDieck
http://linkedin.com/in/morisdieck
https://www.youtube.com/@EllagodelosBusiness/
https://www.instagram.com/ellagodelosbusiness/
https://www.youtube.com/@gabrieldparra/
https://www.instagram.com/gabrieldparra
https://www.youtube.com/@CampeonesFinancieros/
https://www.youtube.com/@MasterTraderColombia/
https://www.instagram.com/davidvargas.mtc/
https://www.youtube.com/@wayocastellanos/
https://www.instagram.com/wayocastellanos_/
https://www.tiktok.com/@wayocastellanos
https://www.youtube.com/@CienFX/
https://www.youtube.com/@marcoloretdemola/
https://www.instagram.com/marcoloretdemola
https://www.linkedin.com/in/marco-loret-de-mola-832a3371/
https://www.youtube.com/@JuanLuisHuerta/
https://www.instagram.com/juanluishuertaa/
https://www.youtube.com/@BolsillosLlenos/
https://www.instagram.com/bolsillosllenos
https://www.youtube.com/@IngenioInversiones/
http://instagram.com/ingenioinversiones
https://www.youtube.com/@AldoDiazHabitosfinancieros/
http://instagram.com/aldodiazhabitosfinancieros
https://www.youtube.com/@RevoluciondelaRiqueza/
http://instagram.com/javiermorodo
https://www.youtube.com/@CryptoYodaOficial/
http://instagram.com/cryptoyodaguru
https://www.youtube.com/@btcenespanol/
https://www.youtube.com/@MADCRIPTOMX/
https://www.instagram.com/madcriptomx/
https://www.youtube.com/@MasterTradersl/
http://instagram.com/Mastertradersl
https://www.youtube.com/@DeGranoEnGrano/
https://www.youtube.com/@CRYPTOEMPRENDE/
http://instagram.com/cryptoemprende_
https://www.tiktok.com/@cryptoemprende
https://www.youtube.com/@fedetessore/
http://instagram.com/fedetesso
https://www.youtube.com/@SPORTSTOTHEBONE/
https://www.youtube.com/@HERNANPEREYRA_OPINA/
https://www.instagram.com/dinhooo.fut/
https://kick.com/elconventillo
https://www.instagram.com/elconduok
https://kick.com/pauchikita
https://www.instagram.com/pauchikita_
https://www.youtube.com/@balong/
https://www.instagram.com/fuerteperoalbalong
https://www.youtube.com/@sacosports/
https://www.instagram.com/m11rcoparra/
https://www.tiktok.com/@m11rcoparra
https://www.youtube.com/@SiemprePasaAlgoChile/
http://instagram.com/siemprepasaalgochile
https://www.youtube.com/@cienxcientohinchas2858/
https://www.instagram.com/cienxciento.hinchas/
https://www.instagram.com/manubascunant/
https://www.youtube.com/@jotefutbolero/
http://instagram.com/jotefutbolero
https://www.instagram.com/centralrustico/
https://www.youtube.com/@DrFutebol/
https://www.instagram.com/dr.fut_/
https://www.youtube.com/@TheMasterJA/
https://www.youtube.com/@LaHoraDeKingKong/
http://instagram.com/lahoradekingkong
https://www.tiktok.com/@lahoradekingkong
https://www.instagram.com/joseeyf/
https://www.youtube.com/@LIGASPORTSCL/
https://www.instagram.com/liga.sportscl/
https://www.instagram.com/maestro_pichanguero_mp/
https://www.instagram.com/nacho_abarca/
https://www.instagram.com/pankorazzo/
https://www.youtube.com/@Pankorazzo/
https://kick.com/triplex/
https://www.instagram.com/triplextrx/
https://www.instagram.com/nachogolazul/
https://www.instagram.com/dinoinostroza/
https://www.instagram.com/constanzasolar/
https://www.youtube.com/@lostrixx2/
https://www.youtube.com/@new_lucas_oficial/
https://www.instagram.com/new_lucas_oficial/
https://www.youtube.com/@wezexx/
https://www.instagram.com/wezexx/
https://www.youtube.com/@PicadoTV_Chile
https://www.instagram.com/picadotv_chile/
https://www.twitch.tv/wingz/
https://www.instagram.com/jaimewingz/
https://kick.com/naikor1p
https://www.instagram.com/naikor1p
https://www.twitch.tv/burrito
https://www.instagram.com/Burrito_ttv/
https://www.twitch.tv/zothve
https://www.instagram.com/zzzothve/
https://kick.com/donsebastian
https://www.instagram.com/donsebastian_m
https://www.twitch.tv/caprimint/
https://www.instagram.com/Caprimint
https://www.twitch.tv/churraaaa/
https://www.instagram.com/churrabsbg/
https://kick.com/ferragaamo/
https://www.instagram.com/elferragaamo
https://kick.com/dracul1nx
https://www.instagram.com/dracul1nx
https://kick.com/picklez
https://www.instagram.com/picklez___
https://www.twitch.tv/baaztycl/
https://www.instagram.com/baaztycl
https://www.youtube.com/@ianfreddy8908/
https://www.youtube.com/@FUTBOLCHILENOTV/
https://www.instagram.com/bonva_jr/
https://www.tiktok.com/@bonvajr
https://www.instagram.com/joacossiilva/
https://www.tiktok.com/@joacossiilva
https://www.instagram.com/elluchoreyes/
https://www.youtube.com/@cdonosos
https://www.instagram.com/fabiancornejo9/
https://www.tiktok.com/@fabiancornejo.9
https://www.instagram.com/felipekaponi23/
https://www.youtube.com/@FelipeKaponi23/
https://www.twitch.tv/chainavt/
https://www.instagram.com/chainavt/
https://www.twitch.tv/paumingg/
https://www.instagram.com/paumingg/
https://www.youtube.com/@Micanal-en10/
https://www.youtube.com/c/Jos%C3%A9Tom%C3%A1sFern%C3%A1ndez/featured
https://www.instagram.com/josetomasfernandezp
https://www.youtube.com/@RecreoDeportivo/
https://www.instagram.com/recreodeportivo
https://www.twitch.tv/miawrsu
https://www.instagram.com/miawrsu/
https://www.twitch.tv/peyukostream
https://www.instagram.com/peyukostream
https://www.instagram.com/elmemo_9/
https://www.instagram.com/_gritodegol/
https://kick.com/samuelon
https://www.instagram.com/imsamuelon
https://www.instagram.com/_catajvg/
https://kick.com/nwetwitch
https://www.twitch.tv/padgaro
https://www.instagram.com/padgaro/
https://www.instagram.com/mauriihd/
https://www.youtube.com/@MauriiHD/
https://www.instagram.com/funnystrukis/
https://www.twitch.tv/funnypink
https://www.instagram.com/chanchuuus/
https://www.twitch.tv/chanchuus
https://www.instagram.com/antoo.belennn/
https://www.instagram.com/andreahernan10/
https://www.instagram.com/diegosierra._/
https://www.instagram.com/shinipan_/
https://www.twitch.tv/shinipan/
https://www.instagram.com/dltsports/
https://www.youtube.com/@DLTSPORTSTV/
https://www.instagram.com/elfutbolsegunfran/
https://www.youtube.com/c/ElF%C3%BAtbolseg%C3%BAnFran/
https://www.instagram.com/kytaaaaa/
https://www.twitch.tv/kytaaaaa
https://www.instagram.com/patto_ram_esp
https://www.twitch.tv/patto_ram_esp
https://www.instagram.com/kira.shiny.gaming/
https://www.twitch.tv/corxea_desu
https://www.instagram.com/kalost/
https://www.twitch.tv/kalost/
https://www.instagram.com/bastislots
https://www.twitch.tv/ministeriocl/
https://www.instagram.com/comunidad_koghoul/
https://www.twitch.tv/koghoul
https://www.instagram.com/maxi_cardenas/
https://www.instagram.com/tecuentoconoscar/
https://www.instagram.com/ladiablayelalbo/
https://www.youtube.com/@ladiablayelalbo/
https://www.instagram.com/gonzofut/
https://www.instagram.com/bvrbenja_/
https://www.instagram.com/antunezsilva/
https://www.youtube.com/@antunezsilva10/
https://www.instagram.com/todoescanchaok
https://www.youtube.com/@TodoEsCanchaOK/
https://www.instagram.com/retro_fu/
https://www.youtube.com/@RetroFutCH/
https://www.youtube.com/@Vlog.cruzado/
https://www.instagram.com/vlog.cruzado/
https://www.instagram.com/futvaldes/
https://www.instagram.com/lafuriahispana/
https://www.youtube.com/@RumboDeportivoChile/
https://www.instagram.com/eljanojey/
https://www.twitch.tv/eljanojey/
https://www.instagram.com/valemsp
https://www.twitch.tv/valemsp/
https://www.instagram.com/dongarage1/
https://www.twitch.tv/dongarage/
https://kick.com/middori/
https://www.instagram.com/_.luismatias._
https://www.instagram.com/fritzsonfoot/
https://www.instagram.com/vozcacique/
https://www.instagram.com/diegoaaaat/
https://www.instagram.com/aravenaconstanzaa_/
https://www.instagram.com/flo_pulgardiaz/
https://www.instagram.com/meltyhitoru/
https://www.twitch.tv/meltyhitoru/
https://kick.com/pipewakatela/
https://www.instagram.com/pipewakatela
https://www.instagram.com/tenetesportscl/
https://www.instagram.com/rebeccare13/
https://www.twitch.tv/rebeccare
https://www.instagram.com/4lequiin/
https://www.twitch.tv/4lequiin
https://www.instagram.com/paw_pau_/
https://www.twitch.tv/pawpau/
https://www.instagram.com/nintenchio/
https://www.twitch.tv/nintenchio
https://www.instagram.com/oh.vickyvicky/
https://www.twitch.tv/ohvickyvicky/
https://www.instagram.com/skynoriosinbb/
https://www.twitch.tv/skynorio/
https://www.instagram.com/ayakazaphyr/
https://www.twitch.tv/ayakazaphyr/
https://www.instagram.com/panchaalel/
https://www.twitch.tv/panchaalel/
https://www.instagram.com/karmavt_/
https://www.twitch.tv/karmavt_/
https://www.twitch.tv/tutisvalentine/
https://www.instagram.com/tutisvalentine
https://www.instagram.com/claudiomichaux/
https://www.twitch.tv/claudiomichaux/
https://www.instagram.com/tommypervan
https://www.twitch.tv/tommypervan/
https://www.instagram.com/roberttson/
https://www.twitch.tv/roberttson/
https://www.instagram.com/moaigreal/
https://www.twitch.tv/moaigr/
https://www.instagram.com/lete_futbol/
https://www.instagram.com/futbol.a.la.vena/
https://www.instagram.com/deotroangulo.cl/
https://www.instagram.com/la_tia_cosa_ttv
https://www.twitch.tv/la_tia_cosa_/
https://www.youtube.com/c/JonathanMu%C3%B1iz1/
https://www.instagram.com/jonathan_smo98/
https://www.youtube.com/@bochadeportes/
https://www.tiktok.com/@guillegol.verdes
https://www.instagram.com/guillegolec/
https://www.youtube.com/@adrsportseladrio/
https://www.instagram.com/adrsport_eladrio/
https://www.youtube.com/@FutbolcrudaEC/
https://www.youtube.com/@futbolec21/
https://www.youtube.com/@WillChullita/
https://www.instagram.com/chullitawill1
https://www.youtube.com/@losmarginochas4383/
https://www.instagram.com/losmarginochas/
https://www.facebook.com/PelotazoEC
https://www.youtube.com/@TricoloresEC/
https://www.instagram.com/nathychong/
https://www.twitch.tv/blink_vt/
https://www.instagram.com/blinkdell
https://www.twitch.tv/gabrielcal17
https://www.instagram.com/gabrielcal17_/
https://www.twitch.tv/lianieto1/
https://www.instagram.com/lianieto1/
https://www.twitch.tv/anyway_jose
https://www.instagram.com/anyway_jose24/
https://kick.com/loddix/
https://www.instagram.com/diddier.lozada/
https://www.twitch.tv/safivtt/
https://www.instagram.com/safivtt/
https://www.twitch.tv/listh15
https://www.instagram.com/listh_15/
https://www.twitch.tv/tozura/
https://www.twitch.tv/leito_lf
https://www.instagram.com/leito_lf88/
https://www.twitch.tv/puchojuegamucho/
https://www.instagram.com/puchojuegamucho
https://www.twitch.tv/nimbolatte/
https://www.instagram.com/Nimbolatte/
https://kick.com/pizzamandy
https://www.instagram.com/pizzamandy10
https://www.twitch.tv/xbrysax
https://www.instagram.com/xbrysa/
https://www.youtube.com/@ecuasports/
https://www.youtube.com/@yofutbol24/
https://www.instagram.com/yo_futbol24/
https://www.youtube.com/@IDOGOLUIO/
https://www.instagram.com/idogol929/
https://www.youtube.com/@Washitoman/
https://www.youtube.com/@GaleriadelGol/
https://www.instagram.com/galeriadelgolec/
https://www.twitch.tv/idieride
https://www.instagram.com/idieridettv
https://kick.com/applesitogg/
https://www.instagram.com/applesitogg/
https://www.youtube.com/@FutbolerosEcOk/
https://www.instagram.com/valgavilanez/
https://www.twitch.tv/ladyeriivt/
https://www.instagram.com/ladyeriivt/
https://www.twitch.tv/macaste/
https://www.instagram.com/jccrespoalvarado/
https://www.instagram.com/tikofc_/
https://www.instagram.com/andevillamarin/
https://www.youtube.com/@poimandresfutbol/
https://www.instagram.com/pulpoabraham/
https://www.instagram.com/apugolec/
https://www.instagram.com/jamolestina/
https://www.youtube.com/@losasesdelastillero5170/
https://www.youtube.com/@SentimientoBarcelonesEC/
https://www.youtube.com/@futbol7sport2/
https://kick.com/markalvarado
https://www.instagram.com/markalvaradotv/
https://www.instagram.com/soyleandriny/
https://www.instagram.com/carlosgalvez21/
https://www.instagram.com/gabyalcivar_/
https://www.instagram.com/victorloorb/
https://www.instagram.com/schuberthsuingv/
https://www.instagram.com/studiofutbolweb/
https://www.instagram.com/somos90.ec/
https://www.instagram.com/brianentrecracks/
https://www.youtube.com/@nitrofm7/
https://www.instagram.com/jeancarloslopez7/
https://www.instagram.com/lossuplentesec
https://www.youtube.com/@LOSSUPLENTES/
https://www.instagram.com/pelotazoenlacara/
https://www.youtube.com/@PelotazoenlaCara-/
https://www.youtube.com/@gritodegolyt/
https://www.instagram.com/edigol_ec/
https://www.instagram.com/rubenruatab/
https://www.youtube.com/c/T%C3%ADoAlboEc/
https://www.youtube.com/@diamantefutbolero/
https://www.youtube.com/@LACANCHATVlacancha
https://www.instagram.com/donfutboloficial/
https://www.instagram.com/arlen_carrera/
https://www.instagram.com/benditofutbol/
https://www.instagram.com/sebastiandelpozof/
https://www.instagram.com/dorian_linzan/
https://www.instagram.com/maitemontalvo/
https://www.twitch.tv/alexmidiaz
https://www.instagram.com/alexmidiaz/
https://www.youtube.com/@ElMedalleroChapin/featured
https://www.tiktok.com/@elmedallerochapin
https://www.youtube.com/@ChapinSoccer/
https://www.youtube.com/@superligagt/
https://www.instagram.com/superliga_gt
https://www.youtube.com/@GolesGT/
https://www.youtube.com/@lapizarragt/
https://www.youtube.com/@PapaQuetzalGT/
https://www.youtube.com/@pleivack/
https://www.instagram.com/luispleivack/
https://www.youtube.com/@FutbolQuetzal/
https://www.instagram.com/futbolquetzal/
https://www.youtube.com/@Edgar_RTS/
https://www.instagram.com/edga_rrts/
https://www.instagram.com/hiedgar_/
https://www.tiktok.com/@edgar_rts
https://www.youtube.com/@NiMuyAngel/
https://www.instagram.com/nimuyangel/
https://www.youtube.com/@ciudaddeportivagt/
https://www.youtube.com/@guerrerosgt502/
https://www.instagram.com/guerreros_gt502
https://www.youtube.com/@JoserraFutGT/
https://www.instagram.com/joserra_futgt/
https://www.youtube.com/@KEVMANIA/
https://www.youtube.com/channel/UC1ajVvPGZ4HafKPt3fGCAlg
https://www.instagram.com/benditofutbol_gt/
https://www.youtube.com/@ElQuetzalitoFutbolero/
https://www.instagram.com/elquetzalitofutbolero/
https://www.tiktok.com/@elquetzalitofutbolero
https://www.youtube.com/@Pasion502Oficial/
http://instagram.com/pasion502guate
https://www.instagram.com/manuel_sosa_r/
https://www.instagram.com/cuilapameji6/
https://www.instagram.com/kenderson_12_navarro/
https://www.instagram.com/jonathafranco14/
https://www.instagram.com/92aparicio25/
https://www.twitch.tv/kiuwt
https://www.twitch.tv/tanibubble
https://www.instagram.com/tanibubble/
https://www.twitch.tv/xanniz
https://www.instagram.com/xannniz/
https://www.twitch.tv/hozitojones
https://www.youtube.com/@Hozitojones/
https://www.instagram.com/sebas_toriello/
https://www.twitch.tv/Naocchicat
https://www.instagram.com/naocchi94/
https://www.youtube.com/@ian.salguero/
https://www.instagram.com/ian.salguero/
https://www.twitch.tv/soylordhermoso/
https://www.instagram.com/lordhermoso/
https://kick.com/raeken
https://www.instagram.com/elgm56
https://kick.com/nanais
https://www.instagram.com/anahirm19
https://www.twitch.tv/mikaa_smr
https://www.instagram.com/mikaa_smr/
https://www.twitch.tv/xsacret/
https://www.instagram.com/xsaacret
https://www.twitch.tv/fervonlaiho/
https://www.instagram.com/fervonlaiho
https://www.twitch.tv/katlyne/
https://www.instagram.com/katlynest
https://www.twitch.tv/zanzupp/
https://www.instagram.com/zanzupp/
https://www.twitch.tv/wesos/
https://www.instagram.com/wesosxd/
https://www.instagram.com/delamorah/
https://www.youtube.com/@delamorah/
https://www.instagram.com/onceinicial_/
https://www.youtube.com/@OnceInicial/
https://www.instagram.com/barakfever/
https://www.youtube.com/@Barak-Fever/
https://www.instagram.com/pilotofootball
https://www.youtube.com/@PilotoFootball/
https://www.instagram.com/LaGambetaSports
https://www.youtube.com/@LaGambetaSports/
https://www.youtube.com/@naciongambyl/
https://www.instagram.com/ubaldo_mx/
https://www.youtube.com/@UbaldoShow/
https://www.instagram.com/rodrigopicks
https://www.youtube.com/@RodrigoPicks/
https://www.instagram.com/razo97_
https://kick.com/razo97
https://www.instagram.com/supertradeos/
https://www.twitch.tv/supertradeos
https://www.youtube.com/@NACIONFUTBOLMX
https://www.instagram.com/juegobalon/
https://www.youtube.com/@juegobalon/
https://www.instagram.com/los_expulsados
https://www.youtube.com/@LosExpulsados/
https://www.instagram.com/oscarl.duran/
https://www.youtube.com/@LeonelDuran3030/
https://www.instagram.com/decabecita_mx/
https://www.youtube.com/@FutbolDeCabecitaMX/
https://www.youtube.com/@MIANCAM/
https://www.instagram.com/miancam_
https://www.youtube.com/@LeoSalinas/
https://www.instagram.com/leosalinasfutbol/
https://www.instagram.com/hiramfutbol/
https://www.youtube.com/@gol90/
https://www.instagram.com/goal90global/
https://www.youtube.com/@SIGOALTRI/
https://www.instagram.com/sigoaltri.mx/
https://www.youtube.com/@AreaTecnicaMX/
http://instagram.com/areatecnicamx
https://www.instagram.com/soyisragram
https://www.youtube.com/@clinicadefutbol/
https://www.instagram.com/eddymedina10/
https://www.youtube.com/@ElFutboldelAlma/
https://www.youtube.com/@eltriky-t3x/
https://www.instagram.com/erickdbz1/
https://www.twitch.tv/erickdbz/
https://www.instagram.com/taitaicosplay/
https://www.twitch.tv/taitaigamer/
https://www.instagram.com/bunnita__/
https://www.twitch.tv/bunnita/
https://www.instagram.com/jupeson
https://www.twitch.tv/jupeson/
https://www.instagram.com/fapparamoar
https://www.twitch.tv/fapparamoar/
https://www.instagram.com/welchelass/
https://www.twitch.tv/welchelas/
https://www.instagram.com/varelabere/
https://www.twitch.tv/varelabere/
https://www.twitch.tv/flaiveth
https://www.instagram.com/flaiveth/
https://www.youtube.com/@LeyendaNica/
http://instagram.com/leyendanica
https://www.youtube.com/@JRcomediante/
http://instagram.com/jr_comediante_
https://www.youtube.com/@fofitotv5236/
https://www.instagram.com/fofitotv_oficial/
https://www.youtube.com/@ArcesVids/
https://www.youtube.com/@Destro32/
https://www.instagram.com/ciaranicolch/
https://www.instagram.com/keovanesky10/
https://www.tiktok.com/@keovanesky10
https://www.instagram.com/tatiana_artiles/
https://www.instagram.com/karla.gonzalez48/
https://www.instagram.com/dianabnoguera/
https://www.instagram.com/chegerardo23/
https://www.tiktok.com/@chegerardo
https://www.tiktok.com/@hectorelchatel
https://www.instagram.com/marcellacortes/
https://www.instagram.com/milton_vlogs/
https://www.instagram.com/jilmatorrez_of/
https://www.youtube.com/c/AJOTA_05
https://www.tiktok.com/@_ajota_05
http://instagram.com/ajota_05
https://www.twitch.tv/ladydonita/
https://www.instagram.com/_ladydonita/
https://www.tiktok.com/@ladydonita
https://www.instagram.com/august_mb08/
https://www.instagram.com/meliora.experience/
https://www.instagram.com/_jeanblaze_/
https://www.facebook.com/edrodc16/
https://www.youtube.com/@EdgardRodriguez
https://www.instagram.com/edgardrodriguezc/
https://www.tiktok.com/@elfufa_
https://www.youtube.com/@ElfufaYT/
https://kick.com/elfufa/
http://instagram.com/dsalguerajr
https://www.youtube.com/@ezequielblandon-ys3kx/
https://www.youtube.com/@TertuliaDeportiva/featured
https://www.tiktok.com/@gisaac_
https://www.instagram.com/josuequijano10/
https://www.facebook.com/josuequijano1024
https://www.instagram.com/baybonilla/
https://www.instagram.com/acevedo_55/
https://www.twitch.tv/josueortega505/
https://www.instagram.com/josueortega505tv/
https://www.tiktok.com/@josueorteganic505
https://www.facebook.com/josueortega505game
https://www.youtube.com/@xomas1000/
https://www.instagram.com/xomas3/
https://www.youtube.com/@LokuraFut/
https://www.instagram.com/lokura_fut
https://www.tiktok.com/@josehd4k
https://www.instagram.com/chepehd4k_/
https://www.facebook.com/joseismael1712/
https://www.twitch.tv/6tn_
https://www.instagram.com/gastondecuadro_/
https://www.twitch.tv/vladsuo
https://www.instagram.com/_manuuuu_7
https://www.instagram.com/apuestasborja/
https://www.youtube.com/@apuestasborjaoficial/
https://kick.com/hinchapelota/
https://www.twitch.tv/teniie/
https://www.instagram.com/soycristianrey/
https://www.instagram.com/laliguillamx/
https://www.twitch.tv/kafiona
https://www.instagram.com/kafionax/
https://www.instagram.com/waifu_eileen/
https://www.instagram.com/monsde.ucgm/
https://www.instagram.com/airi_han/
https://www.instagram.com/kapaqui/
https://www.instagram.com/andyuchiha_/
https://www.instagram.com/evy_rosas/
https://www.instagram.com/skadisita/
https://www.instagram.com/heyshika/
https://www.instagram.com/sylunh/
https://www.instagram.com/water_cita/
https://www.instagram.com/lunlamy/
https://www.instagram.com/elese_yt/
https://www.instagram.com/yodalina_/
https://www.instagram.com/jennsanli/
https://www.instagram.com/jinx.greyy/
https://www.instagram.com/shiroblossoms/
https://kick.com/joakocck
https://www.instagram.com/joakocck/
https://www.instagram.com/idisweek/
https://www.twitch.tv/idisweek
https://www.instagram.com/Jimrising12
https://www.instagram.com/tipomac
https://www.twitch.tv/tipomac/
https://www.instagram.com/hyliahale/
https://www.twitch.tv/hyliahale/
https://www.instagram.com/franzeroo_/
https://www.twitch.tv/franzero_
https://www.instagram.com/neeavee/
https://www.instagram.com/edueljefee/
https://www.instagram.com/savaquitaa/
https://www.twitch.tv/savaquita
https://www.instagram.com/jabiai/
https://www.twitch.tv/jabiai/
https://www.instagram.com/alexytely
https://www.twitch.tv/alextely/
https://www.instagram.com/tabathapacer/
https://www.twitch.tv/tabathapacer/
https://www.instagram.com/belenyaa_/
https://www.instagram.com/carowiza/
https://www.twitch.tv/carowiza/
https://www.instagram.com/arimychan/
https://www.twitch.tv/arimy/
https://www.instagram.com/_chicabyte/
https://www.twitch.tv/chicabyte/
https://www.twitch.tv/jackduvaltrades
https://www.twitch.tv/sheepsol
https://x.com/imsheepsol
`;

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
