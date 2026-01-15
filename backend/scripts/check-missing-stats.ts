/**
 * Check missing stats for streaming platforms
 */

import { db } from '../src/utils/database';

async function main() {
  console.log('=== MISSING DATA SUMMARY ===\n');

  // Check Twitch
  const twitchTotal = await db.streamer.count({ where: { platform: 'TWITCH' } });
  const twitchNoAvatar = await db.streamer.count({
    where: { platform: 'TWITCH', OR: [{ avatarUrl: null }, { avatarUrl: '' }] }
  });
  const twitchNoFollowers = await db.streamer.count({
    where: { platform: 'TWITCH', followers: 0 }
  });

  console.log(`TWITCH (${twitchTotal.toLocaleString()} total):`);
  console.log(`  No avatar: ${twitchNoAvatar.toLocaleString()}`);
  console.log(`  No followers (0): ${twitchNoFollowers.toLocaleString()}`);
  console.log('');

  // Check YouTube
  const youtubeTotal = await db.streamer.count({ where: { platform: 'YOUTUBE' } });
  const youtubeNoAvatar = await db.streamer.count({
    where: { platform: 'YOUTUBE', OR: [{ avatarUrl: null }, { avatarUrl: '' }] }
  });
  const youtubeNoFollowers = await db.streamer.count({
    where: { platform: 'YOUTUBE', followers: 0 }
  });

  console.log(`YOUTUBE (${youtubeTotal.toLocaleString()} total):`);
  console.log(`  No avatar: ${youtubeNoAvatar.toLocaleString()}`);
  console.log(`  No followers (0): ${youtubeNoFollowers.toLocaleString()}`);
  console.log('');

  // Check Kick
  const kickTotal = await db.streamer.count({ where: { platform: 'KICK' } });
  const kickNoAvatar = await db.streamer.count({
    where: { platform: 'KICK', OR: [{ avatarUrl: null }, { avatarUrl: '' }] }
  });
  const kickNoFollowers = await db.streamer.count({
    where: { platform: 'KICK', followers: 0 }
  });

  console.log(`KICK (${kickTotal.toLocaleString()} total):`);
  console.log(`  No avatar: ${kickNoAvatar.toLocaleString()}`);
  console.log(`  No followers (0): ${kickNoFollowers.toLocaleString()}`);
  console.log('');

  // Sample some that need enrichment
  console.log('=== SAMPLE CHANNELS NEEDING ENRICHMENT ===\n');

  const twitchSample = await db.streamer.findMany({
    where: { platform: 'TWITCH', followers: 0 },
    select: { username: true, avatarUrl: true },
    take: 5
  });
  if (twitchSample.length > 0) {
    console.log('Twitch samples:');
    twitchSample.forEach(s => console.log(`  - ${s.username} (avatar: ${s.avatarUrl ? 'yes' : 'no'})`));
    console.log('');
  }

  const youtubeSample = await db.streamer.findMany({
    where: { platform: 'YOUTUBE', followers: 0 },
    select: { username: true, avatarUrl: true },
    take: 5
  });
  if (youtubeSample.length > 0) {
    console.log('YouTube samples:');
    youtubeSample.forEach(s => console.log(`  - ${s.username} (avatar: ${s.avatarUrl ? 'yes' : 'no'})`));
    console.log('');
  }

  const kickSample = await db.streamer.findMany({
    where: { platform: 'KICK', followers: 0 },
    select: { username: true, avatarUrl: true },
    take: 5
  });
  if (kickSample.length > 0) {
    console.log('Kick samples:');
    kickSample.forEach(s => console.log(`  - ${s.username} (avatar: ${s.avatarUrl ? 'yes' : 'no'})`));
  }

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
