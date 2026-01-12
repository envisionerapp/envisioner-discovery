/**
 * Backfill YouTube Social Links
 *
 * Fetches social links from ScrapeCreators YouTube API for all YouTube streamers
 * and updates the database + adds to sync queue.
 *
 * Usage:
 *   npx ts-node scripts/backfill-youtube-social.ts          # Process 100 streamers
 *   npx ts-node scripts/backfill-youtube-social.ts 500      # Process 500 streamers
 */

import 'dotenv/config';
import axios from 'axios';
import { db } from '../src/utils/database';
import { Platform } from '@prisma/client';

const API_URL = 'https://api.scrapecreators.com/v1/youtube/channel';

interface YouTubeSocialLinks {
  instagram?: string;
  facebook?: string;
  tik_tok?: string;
  twitter?: string;
  linkedin?: string;
  links?: string[];
}

async function getYouTubeChannelData(profileUrl: string | null, username: string): Promise<{
  social: YouTubeSocialLinks;
  subscribers: number;
  description: string | null;
  name: string | null;
  avatar: string | null;
} | null> {
  try {
    const apiKey = process.env.SCRAPECREATORS_API_KEY;
    if (!apiKey) {
      console.error('SCRAPECREATORS_API_KEY not set');
      return null;
    }

    // Use profileUrl if available (channel ID URL), otherwise construct from username
    let url: string;
    if (profileUrl && (profileUrl.includes('/channel/') || profileUrl.includes('/@'))) {
      url = profileUrl;
    } else {
      url = username.startsWith('@')
        ? `https://www.youtube.com/${username}`
        : `https://www.youtube.com/@${username}`;
    }

    const response = await axios.get(API_URL, {
      headers: { 'x-api-key': apiKey },
      params: { url },
      timeout: 15000
    });

    const data = response.data;
    if (!data.success) return null;

    // Get highest resolution avatar
    const avatarSources = data.avatar?.image?.sources || [];
    const avatar = avatarSources.length > 0
      ? avatarSources[avatarSources.length - 1].url
      : null;

    // Parse links array for social links not in dedicated fields
    const links = data.links || [];
    let instagram = data.instagram;
    let facebook = data.facebook;
    let tik_tok = data.tik_tok;
    let twitter = data.twitter;
    let linkedin = data.linkedin;

    for (const link of links) {
      if (!instagram && link.includes('instagram.com')) {
        instagram = link;
      }
      if (!facebook && link.includes('facebook.com')) {
        facebook = link;
      }
      if (!tik_tok && link.includes('tiktok.com')) {
        tik_tok = link;
      }
      if (!twitter && (link.includes('twitter.com') || link.includes('x.com'))) {
        twitter = link;
      }
      if (!linkedin && link.includes('linkedin.com')) {
        linkedin = link;
      }
    }

    return {
      social: {
        instagram: instagram || undefined,
        facebook: facebook || undefined,
        tik_tok: tik_tok || undefined,
        twitter: twitter || undefined,
        linkedin: linkedin || undefined,
        links,
      },
      subscribers: data.subscriberCount || 0,
      description: data.description || null,
      name: data.name || null,
      avatar,
    };
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

function extractHandleFromUrl(url: string, platform: string): string | null {
  try {
    if (platform === 'instagram') {
      const match = url.match(/instagram\.com\/([^/?]+)/);
      return match ? match[1] : null;
    } else if (platform === 'facebook') {
      const match = url.match(/facebook\.com\/([^/?]+)/);
      return match ? match[1] : null;
    } else if (platform === 'tiktok') {
      const match = url.match(/tiktok\.com\/@?([^/?]+)/);
      return match ? match[1].replace('@', '') : null;
    } else if (platform === 'twitter' || platform === 'x') {
      const match = url.match(/(?:twitter|x)\.com\/([^/?]+)/);
      return match ? match[1] : null;
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
  const limit = parseInt(process.argv[2] || '100');

  console.log('========================================');
  console.log('🔴 YOUTUBE SOCIAL LINKS BACKFILL');
  console.log('========================================\n');

  // Get YouTube streamers ordered by followers
  const streamers = await db.streamer.findMany({
    where: {
      platform: 'YOUTUBE',
    },
    orderBy: { followers: 'desc' },
    take: limit,
    select: {
      id: true,
      username: true,
      profileUrl: true,
      socialLinks: true,
      followers: true,
    }
  });

  console.log(`Found ${streamers.length} YouTube streamers to process\n`);

  let processed = 0;
  let withSocial = 0;
  let updated = 0;
  let errors = 0;
  let creditsUsed = 0;
  const socialHandles: { platform: Platform; username: string }[] = [];

  for (const streamer of streamers) {
    try {
      process.stdout.write(`[${processed + 1}/${streamers.length}] ${streamer.username}... `);

      const data = await getYouTubeChannelData(streamer.profileUrl, streamer.username);
      creditsUsed++;

      if (!data) {
        console.log('❌ not found');
        processed++;
        continue;
      }

      const social = data.social;
      const hasSocial = social.instagram || social.facebook || social.tik_tok || social.twitter || social.linkedin;

      // Build social links array (full URLs)
      const socialLinksArray: string[] = [];
      if (social.instagram) socialLinksArray.push(social.instagram);
      if (social.facebook) socialLinksArray.push(social.facebook);
      if (social.tik_tok) socialLinksArray.push(social.tik_tok);
      if (social.twitter) socialLinksArray.push(social.twitter);
      if (social.linkedin) socialLinksArray.push(social.linkedin);

      if (hasSocial) {
        withSocial++;

        // Extract handles for sync queue
        if (social.instagram) {
          const handle = extractHandleFromUrl(social.instagram, 'instagram');
          if (handle) socialHandles.push({ platform: 'INSTAGRAM', username: handle });
        }
        if (social.facebook) {
          const handle = extractHandleFromUrl(social.facebook, 'facebook');
          if (handle) socialHandles.push({ platform: 'FACEBOOK', username: handle });
        }
        if (social.tik_tok) {
          const handle = extractHandleFromUrl(social.tik_tok, 'tiktok');
          if (handle) socialHandles.push({ platform: 'TIKTOK', username: handle });
        }
        if (social.twitter) {
          const handle = extractHandleFromUrl(social.twitter, 'twitter');
          if (handle) socialHandles.push({ platform: 'X', username: handle });
        }
        // Note: LinkedIn is stored in socialLinks but not synced to queue
        // (ScrapeCreators doesn't have a sync queue for LinkedIn yet)

        // Update database
        await db.streamer.update({
          where: { id: streamer.id },
          data: {
            socialLinks: socialLinksArray,
            followers: data.subscribers || streamer.followers,
            profileDescription: data.description || undefined,
            displayName: data.name || undefined,
            avatarUrl: data.avatar || undefined,
          }
        });
        updated++;

        const socialList = [
          social.instagram ? 'IG' : null,
          social.facebook ? 'FB' : null,
          social.tik_tok ? 'TT' : null,
          social.twitter ? 'X' : null,
          social.linkedin ? 'LI' : null,
        ].filter(Boolean).join(', ');
        console.log(`✅ ${socialList} (${data.subscribers?.toLocaleString()} subs)`);
      } else {
        // Still update followers and description
        await db.streamer.update({
          where: { id: streamer.id },
          data: {
            followers: data.subscribers || streamer.followers,
            profileDescription: data.description || undefined,
            displayName: data.name || undefined,
            avatarUrl: data.avatar || undefined,
          }
        });
        console.log(`📋 no social (${data.subscribers?.toLocaleString()} subs)`);
      }

      processed++;

      // Rate limit - 200ms between requests
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error: any) {
      console.log(`❌ error: ${error.message}`);
      errors++;
      processed++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('\n========================================');
  console.log('📊 RESULTS');
  console.log('========================================');
  console.log(`Processed: ${processed}`);
  console.log(`With social links: ${withSocial}`);
  console.log(`Updated in DB: ${updated}`);
  console.log(`Errors: ${errors}`);
  console.log(`Credits used: ${creditsUsed}`);

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
            priority: 50, // Medium priority for YouTube-sourced handles
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
