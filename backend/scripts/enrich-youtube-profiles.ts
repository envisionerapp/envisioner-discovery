/**
 * Enrich YouTube Profiles Script
 *
 * Fetches full profile data for YouTube placeholder records
 * that were created with 0 followers and no avatars.
 *
 * Uses YouTube Data API v3 to get channel info.
 *
 * Usage:
 *   npx ts-node scripts/enrich-youtube-profiles.ts
 *   npx ts-node scripts/enrich-youtube-profiles.ts --batch=100
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
import { Region } from '@prisma/client';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const API_BASE = 'https://www.googleapis.com/youtube/v3';

// ==================== REGION MAPPING ====================

const countryToRegion: Record<string, Region> = {
  'MX': Region.MEXICO,
  'CO': Region.COLOMBIA,
  'AR': Region.ARGENTINA,
  'CL': Region.CHILE,
  'PE': Region.PERU,
  'VE': Region.VENEZUELA,
  'EC': Region.ECUADOR,
  'BO': Region.BOLIVIA,
  'PY': Region.PARAGUAY,
  'UY': Region.URUGUAY,
  'CR': Region.COSTA_RICA,
  'PA': Region.PANAMA,
  'GT': Region.GUATEMALA,
  'SV': Region.EL_SALVADOR,
  'HN': Region.HONDURAS,
  'NI': Region.NICARAGUA,
  'DO': Region.DOMINICAN_REPUBLIC,
  'PR': Region.PUERTO_RICO,
  'BR': Region.BRAZIL,
  'US': Region.USA,
  'CA': Region.CANADA,
  'ES': Region.SPAIN,
  'DE': Region.GERMANY,
  'FR': Region.FRANCE,
  'IT': Region.ITALY,
  'PT': Region.PORTUGAL,
  'GB': Region.UK,
  'NL': Region.NETHERLANDS,
  'SE': Region.SWEDEN,
  'NO': Region.NORWAY,
  'DK': Region.DENMARK,
  'FI': Region.FINLAND,
  'PL': Region.POLAND,
  'RU': Region.RUSSIA,
  'JP': Region.JAPAN,
  'KR': Region.KOREA,
  'CN': Region.CHINA,
  'IN': Region.INDIA,
  'ID': Region.INDONESIA,
  'PH': Region.PHILIPPINES,
  'TH': Region.THAILAND,
  'VN': Region.VIETNAM,
  'MY': Region.MALAYSIA,
  'SG': Region.SINGAPORE,
  'AU': Region.AUSTRALIA,
  'NZ': Region.NEW_ZEALAND,
};

// ==================== YOUTUBE API ====================

interface YouTubeChannelData {
  channelId: string;
  displayName: string;
  description: string;
  avatarUrl: string;
  subscriberCount: number;
  viewCount: number;
  videoCount: number;
  country?: string;
}

/**
 * Search for a YouTube channel by handle/username
 */
async function searchChannel(query: string): Promise<string | null> {
  try {
    const url = `${API_BASE}/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=1&key=${YOUTUBE_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`   API error searching ${query}: ${response.status} - ${errorText}`);
      return null;
    }

    const data: any = await response.json();
    return data.items?.[0]?.id?.channelId || null;
  } catch (error: any) {
    console.error(`   Error searching for ${query}: ${error.message}`);
    return null;
  }
}

/**
 * Get channel details by channel ID
 */
async function getChannelDetails(channelId: string): Promise<YouTubeChannelData | null> {
  try {
    const url = `${API_BASE}/channels?part=snippet,statistics&id=${channelId}&key=${YOUTUBE_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`   API error getting channel ${channelId}: ${response.status} - ${errorText}`);
      return null;
    }

    const data: any = await response.json();
    const channel = data.items?.[0];

    if (!channel) return null;

    return {
      channelId: channel.id,
      displayName: channel.snippet.title,
      description: channel.snippet.description || '',
      avatarUrl: channel.snippet.thumbnails?.high?.url || channel.snippet.thumbnails?.medium?.url || '',
      subscriberCount: parseInt(channel.statistics.subscriberCount) || 0,
      viewCount: parseInt(channel.statistics.viewCount) || 0,
      videoCount: parseInt(channel.statistics.videoCount) || 0,
      country: channel.snippet.country,
    };
  } catch (error: any) {
    console.error(`   Error getting channel ${channelId}: ${error.message}`);
    return null;
  }
}

/**
 * Get channel by handle (e.g., @username)
 */
async function getChannelByHandle(handle: string): Promise<YouTubeChannelData | null> {
  try {
    // Clean handle - remove @ if present
    const cleanHandle = handle.startsWith('@') ? handle : `@${handle}`;

    const url = `${API_BASE}/channels?part=snippet,statistics&forHandle=${encodeURIComponent(cleanHandle)}&key=${YOUTUBE_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      // If handle lookup fails, try search
      return null;
    }

    const data: any = await response.json();
    const channel = data.items?.[0];

    if (!channel) return null;

    return {
      channelId: channel.id,
      displayName: channel.snippet.title,
      description: channel.snippet.description || '',
      avatarUrl: channel.snippet.thumbnails?.high?.url || channel.snippet.thumbnails?.medium?.url || '',
      subscriberCount: parseInt(channel.statistics.subscriberCount) || 0,
      viewCount: parseInt(channel.statistics.viewCount) || 0,
      videoCount: parseInt(channel.statistics.videoCount) || 0,
      country: channel.snippet.country,
    };
  } catch (error: any) {
    return null;
  }
}

// ==================== ENRICHMENT ====================

async function enrichYouTubeProfiles(batchSize: number): Promise<{ processed: number; success: number; errors: number }> {
  const result = { processed: 0, success: 0, errors: 0 };

  // Get YouTube streamers with 0 followers (placeholders) or missing avatars
  const streamers = await db.streamer.findMany({
    where: {
      platform: 'YOUTUBE',
      OR: [
        { followers: 0 },
        { avatarUrl: null },
        { avatarUrl: '' }
      ]
    },
    orderBy: { createdAt: 'desc' },
    take: batchSize,
    select: { id: true, username: true, displayName: true, profileUrl: true, avatarUrl: true, followers: true }
  });

  if (streamers.length === 0) {
    console.log('   No YouTube placeholders found');
    return result;
  }

  console.log(`   Found ${streamers.length} YouTube channels to enrich`);

  for (const streamer of streamers) {
    result.processed++;

    try {
      // Try to get channel info using different methods
      let channelData: YouTubeChannelData | null = null;

      // Method 1: Try handle lookup first (most efficient)
      channelData = await getChannelByHandle(streamer.username);

      // Method 2: If that fails, try search
      if (!channelData) {
        const channelId = await searchChannel(streamer.username);
        if (channelId) {
          channelData = await getChannelDetails(channelId);
        }
      }

      // Method 3: Try with display name if username fails
      if (!channelData && streamer.displayName !== streamer.username) {
        const channelId = await searchChannel(streamer.displayName);
        if (channelId) {
          channelData = await getChannelDetails(channelId);
        }
      }

      if (!channelData) {
        // Channel doesn't exist or hidden subscribers
        console.log(`   ⚠️ ${streamer.username}: Channel not found or private`);
        // Mark with -1 followers to skip in future
        await db.streamer.update({
          where: { id: streamer.id },
          data: { followers: -1 }
        });
        result.errors++;
        continue;
      }

      // Determine region from country code
      const region = channelData.country ? (countryToRegion[channelData.country] || Region.WORLDWIDE) : Region.WORLDWIDE;

      // Update streamer - YouTube avatars work directly (don't need Bunny CDN)
      const updateData: any = {
        displayName: channelData.displayName,
        profileDescription: channelData.description.substring(0, 2000), // Limit description length
        avatarUrl: channelData.avatarUrl || undefined,
        followers: channelData.subscriberCount,
        totalViews: BigInt(channelData.viewCount),
        region: region,
        countryCode: channelData.country || undefined,
        lastScrapedAt: new Date()
      };

      // Only update avatar if currently missing
      if (streamer.avatarUrl) {
        delete updateData.avatarUrl;
      }

      await db.streamer.update({
        where: { id: streamer.id },
        data: updateData
      });

      result.success++;
      console.log(`   ✅ ${streamer.username}: ${channelData.subscriberCount.toLocaleString()} subscribers${channelData.country ? ` (${channelData.country})` : ''}`);

      // Rate limit - YouTube API has quota limits
      await new Promise(r => setTimeout(r, 100));

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
  const batchArg = args.find(a => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : 100;

  console.log('========================================');
  console.log('🎬 ENRICH YOUTUBE PROFILES');
  console.log('========================================\n');
  console.log(`Batch size: ${batchSize}`);
  console.log(`YouTube API Key: ${YOUTUBE_API_KEY ? '✅ Configured' : '❌ Not configured'}`);

  if (!YOUTUBE_API_KEY) {
    console.error('\n❌ YOUTUBE_API_KEY not set in environment');
    process.exit(1);
  }

  console.log('\n🎬 Processing YouTube profiles...');
  const result = await enrichYouTubeProfiles(batchSize);

  console.log('\n========================================');
  console.log('📊 ENRICHMENT COMPLETE');
  console.log('========================================');
  console.log(`   Processed: ${result.processed}`);
  console.log(`   Success: ${result.success}`);
  console.log(`   Errors: ${result.errors}`);

  // Count remaining placeholders
  const remainingNoFollowers = await db.streamer.count({
    where: { platform: 'YOUTUBE', followers: 0 }
  });
  const remainingNoAvatar = await db.streamer.count({
    where: { platform: 'YOUTUBE', OR: [{ avatarUrl: null }, { avatarUrl: '' }] }
  });

  if (remainingNoFollowers > 0 || remainingNoAvatar > 0) {
    console.log('\n📋 Remaining placeholders:');
    console.log(`   No followers (0): ${remainingNoFollowers}`);
    console.log(`   No avatar: ${remainingNoAvatar}`);
    console.log('   Run again to process more.');
  }

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
