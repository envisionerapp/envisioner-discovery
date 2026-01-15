/**
 * Extract LinkedIn from Existing Social Links in Database
 *
 * This script scans all streamers that have socialLinks and extracts
 * any LinkedIn URLs to create LinkedIn streamer entries.
 * No API calls needed - just database operations.
 */

import { db, logger } from '../src/utils/database';
import { Platform, Region } from '@prisma/client';
import { bunnyService } from '../src/services/bunnyService';

function extractLinkedInUrl(links: string[]): string | null {
  for (const link of links) {
    if (typeof link === 'string' && link.toLowerCase().includes('linkedin.com')) {
      return link;
    }
  }
  return null;
}

function extractLinkedInHandle(url: string): string | null {
  const match = url.match(/linkedin\.com\/(?:in|company)\/([^/?#]+)/i);
  return match ? match[1] : null;
}

async function main() {
  console.log('===========================================');
  console.log('   EXTRACT LINKEDIN FROM EXISTING DATA');
  console.log('===========================================\n');

  const initialCount = await db.streamer.count({ where: { platform: 'LINKEDIN' } });
  console.log(`Initial LinkedIn count: ${initialCount}\n`);

  // Get all streamers with socialLinks
  const streamers = await db.streamer.findMany({
    where: {
      platform: { in: ['YOUTUBE', 'TWITCH', 'KICK'] },
      NOT: { socialLinks: { equals: [] } }
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      platform: true,
      socialLinks: true,
      avatarUrl: true,
      followers: true,
    }
  });

  console.log(`Found ${streamers.length} streamers with social links\n`);

  let linkedinFound = 0;
  let linkedinCreated = 0;

  for (const streamer of streamers) {
    const links = streamer.socialLinks as string[];
    if (!Array.isArray(links)) continue;

    const linkedinUrl = extractLinkedInUrl(links);
    if (!linkedinUrl) continue;

    linkedinFound++;
    const handle = extractLinkedInHandle(linkedinUrl);

    if (!handle) {
      console.log(`  ⚠️ Could not extract handle from: ${linkedinUrl}`);
      continue;
    }

    // Check if already exists
    const existing = await db.streamer.findUnique({
      where: {
        platform_username: { platform: 'LINKEDIN', username: handle.toLowerCase() }
      }
    });

    if (existing) {
      console.log(`  ⏭️ Already exists: ${handle} (from ${streamer.platform}/@${streamer.username})`);
      continue;
    }

    // Upload avatar to Bunny CDN if available
    let avatarUrl = streamer.avatarUrl;
    if (avatarUrl) {
      try {
        avatarUrl = await bunnyService.uploadLinkedInAvatar(handle, avatarUrl);
      } catch (e) {}
    }

    // Create LinkedIn entry
    try {
      await db.streamer.create({
        data: {
          platform: 'LINKEDIN',
          username: handle.toLowerCase(),
          displayName: streamer.displayName || handle,
          profileUrl: linkedinUrl.startsWith('http') ? linkedinUrl : `https://${linkedinUrl}`,
          avatarUrl: avatarUrl || undefined,
          followers: 0,
          profileDescription: `From ${streamer.platform}: @${streamer.username} (${streamer.followers?.toLocaleString()} followers)`,
          region: Region.WORLDWIDE,
          lastScrapedAt: new Date(),
          discoveredVia: `${streamer.platform.toLowerCase()}:@${streamer.username}`,
          socialLinks: [`https://${streamer.platform.toLowerCase() === 'youtube' ? 'youtube.com/@' : streamer.platform.toLowerCase() + '.com/'}${streamer.username}`],
        }
      });
      linkedinCreated++;
      console.log(`  ✅ Created: ${handle} (from ${streamer.platform}/@${streamer.username})`);
    } catch (error: any) {
      console.error(`  ❌ Error creating ${handle}:`, error.message);
    }
  }

  const finalCount = await db.streamer.count({ where: { platform: 'LINKEDIN' } });

  console.log('\n===========================================');
  console.log('   EXTRACTION COMPLETE');
  console.log('===========================================');
  console.log(`LinkedIn URLs found: ${linkedinFound}`);
  console.log(`New LinkedIn created: ${linkedinCreated}`);
  console.log(`Initial count: ${initialCount}`);
  console.log(`Final count: ${finalCount}`);

  // Show some examples of what was found
  const examples = await db.streamer.findMany({
    where: { platform: 'LINKEDIN' },
    select: { username: true, displayName: true, discoveredVia: true },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  console.log('\nRecent LinkedIn entries:');
  examples.forEach(e => {
    console.log(`  ${e.displayName} (@${e.username}) - ${e.discoveredVia}`);
  });

  await db.$disconnect();
}

main().catch(console.error);
