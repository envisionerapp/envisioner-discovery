import { db } from '../src/utils/database';

async function check() {
  // Count Twitch
  const twitchTotal = await db.streamer.count({ where: { platform: 'TWITCH' } });
  const twitchWithAvatar = await db.streamer.count({ where: { platform: 'TWITCH', avatarUrl: { not: null } } });
  const twitchWithFollowers = await db.streamer.count({ where: { platform: 'TWITCH', followers: { gt: 0 } } });

  // Count Kick
  const kickTotal = await db.streamer.count({ where: { platform: 'KICK' } });
  const kickWithAvatar = await db.streamer.count({ where: { platform: 'KICK', avatarUrl: { not: null } } });
  const kickWithFollowers = await db.streamer.count({ where: { platform: 'KICK', followers: { gt: 0 } } });

  // Count YouTube
  const ytTotal = await db.streamer.count({ where: { platform: 'YOUTUBE' } });
  const ytWithAvatar = await db.streamer.count({ where: { platform: 'YOUTUBE', avatarUrl: { not: null } } });
  const ytWithFollowers = await db.streamer.count({ where: { platform: 'YOUTUBE', followers: { gt: 0 } } });

  console.log('\n📊 FINAL DATABASE STATUS');
  console.log('========================');
  console.log('Platform  | Total | Avatars | Followers>0');
  console.log('----------|-------|---------|------------');
  console.log(`TWITCH    | ${twitchTotal.toString().padStart(5)} | ${twitchWithAvatar.toString().padStart(7)} | ${twitchWithFollowers.toString().padStart(11)}`);
  console.log(`KICK      | ${kickTotal.toString().padStart(5)} | ${kickWithAvatar.toString().padStart(7)} | ${kickWithFollowers.toString().padStart(11)}`);
  console.log(`YOUTUBE   | ${ytTotal.toString().padStart(5)} | ${ytWithAvatar.toString().padStart(7)} | ${ytWithFollowers.toString().padStart(11)}`);

  // Top from bulk import
  console.log('\n🌟 TOP CREATORS (bulk-import):');
  const topImported = await db.streamer.findMany({
    where: {
      platform: { in: ['TWITCH', 'KICK'] },
      discoveredVia: 'bulk-import'
    },
    orderBy: { followers: 'desc' },
    take: 15,
    select: { platform: true, username: true, followers: true, avatarUrl: true }
  });

  for (const s of topImported) {
    const avatar = s.avatarUrl?.includes('bunny') ? 'CDN' : (s.avatarUrl ? 'ext' : 'none');
    console.log(`  ${s.platform.padEnd(6)} ${s.username.padEnd(20)} ${s.followers.toLocaleString().padStart(10)} (${avatar})`);
  }

  await db.$disconnect();
}

check().catch(e => { console.error(e); process.exit(1); });
