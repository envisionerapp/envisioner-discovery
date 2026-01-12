/**
 * Backfill Kick Social Links
 *
 * Fetches social links from Kick API v2 for all Kick streamers
 * and updates the database + adds to sync queue.
 *
 * Usage:
 *   npx ts-node scripts/backfill-kick-social.ts          # Process 100 streamers
 *   npx ts-node scripts/backfill-kick-social.ts 500      # Process 500 streamers
 */

import axios from 'axios';
import { db } from '../src/utils/database';
import { Platform } from '@prisma/client';

const KICK_API_V2 = 'https://kick.com/api/v2/channels';

interface KickSocialLinks {
  instagram?: string;
  twitter?: string;
  youtube?: string;
  tiktok?: string;
  facebook?: string;
  discord?: string;
}

async function getKickChannelData(username: string): Promise<{ user: any; followers: number } | null> {
  try {
    const response = await axios.get(`${KICK_API_V2}/${username}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      timeout: 10000
    });

    return {
      user: response.data?.user,
      followers: response.data?.followers_count || 0
    };
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

function extractSocialLinks(user: any): KickSocialLinks {
  return {
    instagram: user?.instagram || undefined,
    twitter: user?.twitter || undefined,
    youtube: user?.youtube || undefined,
    tiktok: user?.tiktok || undefined,
    facebook: user?.facebook || undefined,
    discord: user?.discord || undefined,
  };
}

function buildSocialLinksArray(social: KickSocialLinks): string[] {
  const links: string[] = [];

  if (social.instagram) links.push(`https://instagram.com/${social.instagram}`);
  if (social.twitter) links.push(`https://twitter.com/${social.twitter}`);
  if (social.youtube) links.push(`https://youtube.com/${social.youtube}`);
  if (social.tiktok) links.push(`https://tiktok.com/@${social.tiktok}`);
  if (social.facebook) links.push(`https://facebook.com/${social.facebook}`);

  return links;
}

async function main() {
  const limit = parseInt(process.argv[2] || '100');

  console.log('========================================');
  console.log('🟢 KICK SOCIAL LINKS BACKFILL');
  console.log('========================================\n');

  // Get Kick streamers that need social links
  const streamers = await db.streamer.findMany({
    where: {
      platform: 'KICK',
    },
    orderBy: { followers: 'desc' },
    take: limit,
    select: {
      id: true,
      username: true,
      socialLinks: true,
      followers: true,
    }
  });

  console.log(`Found ${streamers.length} Kick streamers to process\n`);

  let processed = 0;
  let withSocial = 0;
  let updated = 0;
  let errors = 0;
  const socialHandles: { platform: Platform; username: string }[] = [];

  for (const streamer of streamers) {
    try {
      process.stdout.write(`[${processed + 1}/${streamers.length}] ${streamer.username}... `);

      const data = await getKickChannelData(streamer.username);

      if (!data) {
        console.log('❌ not found');
        processed++;
        continue;
      }

      const social = extractSocialLinks(data.user);
      const socialLinksArray = buildSocialLinksArray(social);
      const hasSocial = Object.values(social).some(v => v && v.length > 0);

      if (hasSocial) {
        withSocial++;

        // Collect handles for sync queue
        if (social.instagram) socialHandles.push({ platform: 'INSTAGRAM', username: social.instagram });
        if (social.twitter) socialHandles.push({ platform: 'X', username: social.twitter });
        if (social.tiktok) socialHandles.push({ platform: 'TIKTOK', username: social.tiktok });
        if (social.facebook) socialHandles.push({ platform: 'FACEBOOK', username: social.facebook });

        // Update database
        await db.streamer.update({
          where: { id: streamer.id },
          data: {
            socialLinks: socialLinksArray,
            followers: data.followers || streamer.followers,
            profileDescription: data.user?.bio || undefined,
          }
        });
        updated++;

        const socialList = Object.entries(social)
          .filter(([_, v]) => v)
          .map(([k, v]) => `${k}:${v}`)
          .join(', ');
        console.log(`✅ ${socialList}`);
      } else {
        // Still update followers
        if (data.followers !== streamer.followers) {
          await db.streamer.update({
            where: { id: streamer.id },
            data: { followers: data.followers }
          });
        }
        console.log(`📋 no social (${data.followers.toLocaleString()} followers)`);
      }

      processed++;

      // Rate limit - 200ms between requests
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error: any) {
      console.log(`❌ error: ${error.message}`);
      errors++;
      processed++;
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait longer on error
    }
  }

  console.log('\n========================================');
  console.log('📊 RESULTS');
  console.log('========================================');
  console.log(`Processed: ${processed}`);
  console.log(`With social links: ${withSocial}`);
  console.log(`Updated in DB: ${updated}`);
  console.log(`Errors: ${errors}`);

  // Add to sync queue
  if (socialHandles.length > 0) {
    console.log(`\n📋 Adding ${socialHandles.length} handles to sync queue...`);

    let added = 0;
    for (const handle of socialHandles) {
      try {
        await db.socialSyncQueue.upsert({
          where: {
            platform_username: {
              platform: handle.platform,
              username: handle.username.toLowerCase(),
            }
          },
          create: {
            platform: handle.platform,
            username: handle.username.toLowerCase(),
            priority: 60, // Higher priority for Kick-sourced handles
            status: 'PENDING',
          },
          update: {}
        });
        added++;
      } catch (e) {
        // Ignore duplicates
      }
    }
    console.log(`✅ Added ${added} to sync queue`);
  }

  // Show summary by platform
  const byPlatform: Record<string, number> = {};
  for (const h of socialHandles) {
    byPlatform[h.platform] = (byPlatform[h.platform] || 0) + 1;
  }
  console.log('\nHandles by platform:');
  for (const [platform, count] of Object.entries(byPlatform)) {
    console.log(`  ${platform}: ${count}`);
  }

  await db.$disconnect();
  console.log('\n✅ Done!');
}

main().catch(async (error) => {
  console.error('❌ Script failed:', error);
  await db.$disconnect();
  process.exit(1);
});
