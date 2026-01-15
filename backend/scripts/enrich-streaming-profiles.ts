/**
 * Enrich Twitch/Kick Profiles Script
 *
 * Fetches full profile data for Twitch and Kick placeholder records
 * that were created with 0 followers and no avatars.
 *
 * Usage:
 *   npx ts-node scripts/enrich-streaming-profiles.ts                    # Enrich all
 *   npx ts-node scripts/enrich-streaming-profiles.ts --platform=TWITCH  # Only Twitch
 *   npx ts-node scripts/enrich-streaming-profiles.ts --platform=KICK    # Only Kick
 *   npx ts-node scripts/enrich-streaming-profiles.ts --batch=50         # Batch size
 */

import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import axios from 'axios';

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
import { Platform, Region } from '@prisma/client';
import * as bunnyService from '../src/services/bunnyService';

// ==================== API CONSTANTS ====================

// Twitch GraphQL API
const TWITCH_GQL_URL = 'https://gql.twitch.tv/gql';
const TWITCH_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

// Kick API
const KICK_API_V2 = 'https://kick.com/api/v2/channels';

// ==================== REGION MAPPING ====================

const locationToRegion: Record<string, Region> = {
  // Latin America
  'argentina': Region.ARGENTINA,
  'bolivia': Region.BOLIVIA,
  'brazil': Region.BRAZIL,
  'brasil': Region.BRAZIL,
  'chile': Region.CHILE,
  'colombia': Region.COLOMBIA,
  'costa rica': Region.COSTA_RICA,
  'dominican republic': Region.DOMINICAN_REPUBLIC,
  'ecuador': Region.ECUADOR,
  'el salvador': Region.EL_SALVADOR,
  'guatemala': Region.GUATEMALA,
  'honduras': Region.HONDURAS,
  'mexico': Region.MEXICO,
  'méxico': Region.MEXICO,
  'nicaragua': Region.NICARAGUA,
  'panama': Region.PANAMA,
  'panamá': Region.PANAMA,
  'paraguay': Region.PARAGUAY,
  'peru': Region.PERU,
  'perú': Region.PERU,
  'puerto rico': Region.PUERTO_RICO,
  'uruguay': Region.URUGUAY,
  'venezuela': Region.VENEZUELA,
  // North America
  'united states': Region.USA,
  'usa': Region.USA,
  'us': Region.USA,
  'canada': Region.CANADA,
  // Europe
  'spain': Region.SPAIN,
  'españa': Region.SPAIN,
  'france': Region.FRANCE,
  'germany': Region.GERMANY,
  'italy': Region.ITALY,
  'portugal': Region.PORTUGAL,
  'united kingdom': Region.UK,
  'uk': Region.UK,
  'netherlands': Region.NETHERLANDS,
  'sweden': Region.SWEDEN,
  'norway': Region.NORWAY,
  'denmark': Region.DENMARK,
  'finland': Region.FINLAND,
  'poland': Region.POLAND,
  'russia': Region.RUSSIA,
  // Asia
  'japan': Region.JAPAN,
  'south korea': Region.KOREA,
  'korea': Region.KOREA,
  'china': Region.CHINA,
  'india': Region.INDIA,
  'indonesia': Region.INDONESIA,
  'philippines': Region.PHILIPPINES,
  'thailand': Region.THAILAND,
  'vietnam': Region.VIETNAM,
  'malaysia': Region.MALAYSIA,
  // Oceania
  'australia': Region.AUSTRALIA,
  'new zealand': Region.NEW_ZEALAND,
};

function mapLocationToRegion(location?: string | null): Region {
  if (!location) return Region.WORLDWIDE;
  const normalized = location.toLowerCase().trim();
  return locationToRegion[normalized] || Region.WORLDWIDE;
}

// ==================== TWITCH API ====================

interface TwitchUserData {
  login: string;
  displayName: string;
  description: string;
  profileImageURL: string;
  followers: number;
  broadcastSettings: {
    language: string;
  };
  socialMedias: Array<{ name: string; url: string }>;
}

async function fetchTwitchProfile(login: string): Promise<TwitchUserData | null> {
  try {
    const query = {
      query: `
        query GetUserProfile($login: String!) {
          user(login: $login) {
            login
            displayName
            description
            profileImageURL(width: 300)
            followers {
              totalCount
            }
            broadcastSettings {
              language
            }
            channel {
              socialMedias {
                name
                url
              }
            }
          }
        }
      `,
      variables: { login }
    };

    const response = await axios.post(TWITCH_GQL_URL, query, {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Content-Type': 'application/json',
      },
      timeout: 10000
    });

    const user = response.data?.data?.user;
    if (!user) return null;

    return {
      login: user.login,
      displayName: user.displayName || user.login,
      description: user.description || '',
      profileImageURL: user.profileImageURL || '',
      followers: user.followers?.totalCount || 0,
      broadcastSettings: {
        language: user.broadcastSettings?.language || 'en',
      },
      socialMedias: user.channel?.socialMedias || [],
    };
  } catch (error: any) {
    console.error(`   ❌ Twitch API error for ${login}: ${error.message}`);
    return null;
  }
}

// ==================== KICK API ====================

interface KickUserData {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  followers: number;
  country: string | null;
  instagram?: string;
  twitter?: string;
  youtube?: string;
  tiktok?: string;
  facebook?: string;
}

async function fetchKickProfile(username: string): Promise<KickUserData | null> {
  try {
    const response = await axios.get(`${KICK_API_V2}/${username}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      timeout: 10000
    });

    const data = response.data;
    if (!data) return null;

    const user = data.user || {};

    return {
      username: data.slug || username,
      displayName: user.username || data.slug || username,
      bio: user.bio || '',
      avatarUrl: user.profile_pic || '',
      followers: data.followers_count || 0,
      country: user.country || null,
      instagram: user.instagram || undefined,
      twitter: user.twitter || undefined,
      youtube: user.youtube || undefined,
      tiktok: user.tiktok || undefined,
      facebook: user.facebook || undefined,
    };
  } catch (error: any) {
    if (error.response?.status === 404) {
      console.error(`   ❌ Kick channel not found: ${username}`);
    } else {
      console.error(`   ❌ Kick API error for ${username}: ${error.message}`);
    }
    return null;
  }
}

// ==================== ENRICHMENT FUNCTIONS ====================

async function enrichTwitchProfiles(batchSize: number): Promise<{ processed: number; success: number; errors: number }> {
  const result = { processed: 0, success: 0, errors: 0 };

  // Get Twitch streamers with 0 followers (placeholders)
  const streamers = await db.streamer.findMany({
    where: {
      platform: 'TWITCH',
      followers: 0,
    },
    orderBy: { createdAt: 'desc' },
    take: batchSize,
    select: { id: true, username: true }
  });

  if (streamers.length === 0) {
    console.log('   No Twitch placeholders found');
    return result;
  }

  console.log(`   Found ${streamers.length} Twitch placeholders to enrich`);

  for (const streamer of streamers) {
    result.processed++;

    try {
      const profile = await fetchTwitchProfile(streamer.username);

      if (!profile) {
        // Channel doesn't exist, mark with -1 followers to skip in future
        await db.streamer.update({
          where: { id: streamer.id },
          data: { followers: -1 }
        });
        result.errors++;
        continue;
      }

      // Upload avatar to Bunny CDN
      let avatarUrl = profile.profileImageURL;
      if (avatarUrl && bunnyService.isConfigured()) {
        const cdnUrl = await bunnyService.uploadFromUrl(
          avatarUrl,
          `avatars/twitch/${streamer.username.toLowerCase()}.jpg`
        );
        if (cdnUrl) avatarUrl = cdnUrl;
      }

      // Build social links array
      const socialLinks: string[] = profile.socialMedias
        .filter(sm => sm.url)
        .map(sm => sm.url);

      // Detect language from broadcast settings
      // Note: Twitch doesn't provide country, so we keep WORLDWIDE
      const langCode = profile.broadcastSettings.language || 'en';
      const region = Region.WORLDWIDE;

      // Update streamer
      await db.streamer.update({
        where: { id: streamer.id },
        data: {
          displayName: profile.displayName,
          profileDescription: profile.description,
          avatarUrl: avatarUrl || undefined,
          followers: profile.followers,
          language: langCode.split('-')[0],
          region: region,
          socialLinks: socialLinks.length > 0 ? socialLinks : [],
        }
      });

      result.success++;
      console.log(`   ✅ ${streamer.username}: ${profile.followers.toLocaleString()} followers`);

      // Rate limit
      await new Promise(r => setTimeout(r, 100));
    } catch (error: any) {
      console.error(`   ❌ Error enriching ${streamer.username}: ${error.message}`);
      result.errors++;
    }
  }

  return result;
}

async function enrichKickProfiles(batchSize: number): Promise<{ processed: number; success: number; errors: number }> {
  const result = { processed: 0, success: 0, errors: 0 };

  // Get Kick streamers with 0 followers (placeholders)
  const streamers = await db.streamer.findMany({
    where: {
      platform: 'KICK',
      followers: 0,
    },
    orderBy: { createdAt: 'desc' },
    take: batchSize,
    select: { id: true, username: true }
  });

  if (streamers.length === 0) {
    console.log('   No Kick placeholders found');
    return result;
  }

  console.log(`   Found ${streamers.length} Kick placeholders to enrich`);

  for (const streamer of streamers) {
    result.processed++;

    try {
      const profile = await fetchKickProfile(streamer.username);

      if (!profile) {
        // Channel doesn't exist, mark with -1 followers to skip in future
        await db.streamer.update({
          where: { id: streamer.id },
          data: { followers: -1 }
        });
        result.errors++;
        continue;
      }

      // Upload avatar to Bunny CDN
      let avatarUrl = profile.avatarUrl;
      if (avatarUrl && bunnyService.isConfigured()) {
        const cdnUrl = await bunnyService.uploadFromUrl(
          avatarUrl,
          `avatars/kick/${streamer.username.toLowerCase()}.jpg`
        );
        if (cdnUrl) avatarUrl = cdnUrl;
      }

      // Build social links array
      const socialLinks: string[] = [];
      if (profile.instagram) socialLinks.push(`https://instagram.com/${profile.instagram}`);
      if (profile.twitter) socialLinks.push(`https://twitter.com/${profile.twitter}`);
      if (profile.youtube) socialLinks.push(`https://youtube.com/${profile.youtube}`);
      if (profile.tiktok) socialLinks.push(`https://tiktok.com/@${profile.tiktok}`);
      if (profile.facebook) socialLinks.push(`https://facebook.com/${profile.facebook}`);

      // Map country to region
      const region = mapLocationToRegion(profile.country);

      // Update streamer
      await db.streamer.update({
        where: { id: streamer.id },
        data: {
          displayName: profile.displayName,
          profileDescription: profile.bio,
          avatarUrl: avatarUrl || undefined,
          followers: profile.followers,
          region: region,
          socialLinks: socialLinks.length > 0 ? socialLinks : [],
        }
      });

      result.success++;
      console.log(`   ✅ ${streamer.username}: ${profile.followers.toLocaleString()} followers${profile.country ? ` (${profile.country})` : ''}`);

      // Rate limit
      await new Promise(r => setTimeout(r, 200));
    } catch (error: any) {
      console.error(`   ❌ Error enriching ${streamer.username}: ${error.message}`);
      result.errors++;
    }
  }

  return result;
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);
  const platformArg = args.find(a => a.startsWith('--platform='));
  const batchArg = args.find(a => a.startsWith('--batch='));

  const platform = platformArg ? platformArg.split('=')[1].toUpperCase() : 'ALL';
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : 100;

  console.log('========================================');
  console.log('🔄 ENRICH STREAMING PROFILES');
  console.log('========================================\n');
  console.log(`Platform: ${platform}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Bunny CDN: ${bunnyService.isConfigured() ? '✅ Configured' : '❌ Not configured'}`);

  let totalProcessed = 0;
  let totalSuccess = 0;
  let totalErrors = 0;

  // Enrich Twitch
  if (platform === 'ALL' || platform === 'TWITCH') {
    console.log('\n📺 Processing Twitch profiles...');
    const twitchResult = await enrichTwitchProfiles(batchSize);
    totalProcessed += twitchResult.processed;
    totalSuccess += twitchResult.success;
    totalErrors += twitchResult.errors;
    console.log(`   Twitch: ${twitchResult.success} success, ${twitchResult.errors} errors`);
  }

  // Enrich Kick
  if (platform === 'ALL' || platform === 'KICK') {
    console.log('\n🟢 Processing Kick profiles...');
    const kickResult = await enrichKickProfiles(batchSize);
    totalProcessed += kickResult.processed;
    totalSuccess += kickResult.success;
    totalErrors += kickResult.errors;
    console.log(`   Kick: ${kickResult.success} success, ${kickResult.errors} errors`);
  }

  // Final stats
  console.log('\n========================================');
  console.log('📊 ENRICHMENT COMPLETE');
  console.log('========================================');
  console.log(`   Processed: ${totalProcessed}`);
  console.log(`   Success: ${totalSuccess}`);
  console.log(`   Errors: ${totalErrors}`);

  // Count remaining placeholders
  const remainingTwitch = await db.streamer.count({
    where: { platform: 'TWITCH', followers: 0 }
  });
  const remainingKick = await db.streamer.count({
    where: { platform: 'KICK', followers: 0 }
  });

  if (remainingTwitch > 0 || remainingKick > 0) {
    console.log('\n📋 Remaining placeholders:');
    if (remainingTwitch > 0) console.log(`   Twitch: ${remainingTwitch}`);
    if (remainingKick > 0) console.log(`   Kick: ${remainingKick}`);
    console.log('   Run again to process more.');
  }

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
