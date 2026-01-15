/**
 * Check missing stats for ALL social platforms
 */

import { db } from '../src/utils/database';
import { Platform } from '@prisma/client';

async function main() {
  console.log('=== ALL PLATFORMS - MISSING DATA ===\n');

  const platforms: Platform[] = ['TWITCH', 'KICK', 'YOUTUBE', 'INSTAGRAM', 'TIKTOK', 'X', 'FACEBOOK', 'LINKEDIN'];

  for (const platform of platforms) {
    const total = await db.streamer.count({ where: { platform } });
    const noAvatar = await db.streamer.count({
      where: { platform, OR: [{ avatarUrl: null }, { avatarUrl: '' }] }
    });
    const noFollowers = await db.streamer.count({
      where: { platform, followers: 0 }
    });

    const avatarPct = total > 0 ? ((total - noAvatar) / total * 100).toFixed(1) : '0';
    const followerPct = total > 0 ? ((total - noFollowers) / total * 100).toFixed(1) : '0';

    console.log(`${platform} (${total.toLocaleString()} total):`);
    console.log(`  Avatars: ${avatarPct}% complete (${noAvatar.toLocaleString()} missing)`);
    console.log(`  Followers: ${followerPct}% complete (${noFollowers.toLocaleString()} missing)`);
    console.log('');
  }

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
