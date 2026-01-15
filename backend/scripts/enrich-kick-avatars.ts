/**
 * Enrich Kick Avatars Script
 *
 * Re-fetches Kick profiles to get avatars and uploads to Bunny CDN.
 * The Kick API sometimes doesn't return avatars on first fetch.
 */

import { db } from '../src/utils/database';
import * as bunnyService from '../src/services/bunnyService';
import axios from 'axios';

const KICK_API_V2 = 'https://kick.com/api/v2/channels';

interface KickProfile {
  username: string;
  avatarUrl: string | null;
}

async function fetchKickAvatar(username: string): Promise<string | null> {
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

    // Avatar can be in multiple places
    const avatarUrl = data.user?.profile_pic ||
                      data.profile_pic ||
                      data.user?.profilepic ||
                      data.profilepic;

    return avatarUrl || null;
  } catch (error: any) {
    if (error.response?.status !== 404) {
      console.error(`   ❌ API error for ${username}: ${error.message}`);
    }
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const batchArg = args.find(a => a.startsWith('--batch='));
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : 100;

  console.log('========================================');
  console.log('🟢 ENRICH KICK AVATARS');
  console.log('========================================\n');
  console.log(`Batch size: ${batchSize}`);
  console.log(`Bunny CDN: ${bunnyService.isConfigured() ? '✅ Configured' : '❌ Not configured'}`);

  // Get Kick creators without avatars
  const kickNoAvatar = await db.streamer.findMany({
    where: {
      platform: 'KICK',
      OR: [{ avatarUrl: null }, { avatarUrl: '' }]
    },
    select: { id: true, username: true },
    take: batchSize,
    orderBy: { followers: 'desc' } // Prioritize by followers
  });

  if (kickNoAvatar.length === 0) {
    console.log('\n✅ All Kick creators have avatars!');
    await db.$disconnect();
    return;
  }

  console.log(`\n📊 Found ${kickNoAvatar.length} Kick creators without avatars`);

  let success = 0;
  let noAvatar = 0;
  let errors = 0;

  for (const creator of kickNoAvatar) {
    try {
      const avatarUrl = await fetchKickAvatar(creator.username);

      if (!avatarUrl) {
        noAvatar++;
        continue;
      }

      // Upload to Bunny CDN
      let finalUrl = avatarUrl;
      if (bunnyService.isConfigured()) {
        const cdnUrl = await bunnyService.uploadFromUrl(
          avatarUrl,
          `avatars/kick/${creator.username.toLowerCase()}.jpg`
        );
        if (cdnUrl) finalUrl = cdnUrl;
      }

      // Update database
      await db.streamer.update({
        where: { id: creator.id },
        data: { avatarUrl: finalUrl }
      });

      success++;
      console.log(`   ✅ ${creator.username}`);

      // Rate limit
      await new Promise(r => setTimeout(r, 200));

    } catch (error: any) {
      errors++;
      console.error(`   ❌ ${creator.username}: ${error.message}`);
    }
  }

  console.log('\n========================================');
  console.log('📊 ENRICHMENT COMPLETE');
  console.log('========================================');
  console.log(`   Success: ${success}`);
  console.log(`   No avatar available: ${noAvatar}`);
  console.log(`   Errors: ${errors}`);

  // Remaining count
  const remaining = await db.streamer.count({
    where: { platform: 'KICK', OR: [{ avatarUrl: null }, { avatarUrl: '' }] }
  });
  console.log(`\n   Remaining without avatar: ${remaining}`);
  if (remaining > 0) {
    console.log('   Run again to process more.');
  }

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
