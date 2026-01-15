import { db } from '../src/utils/database';

async function main() {
  const kickTotal = await db.streamer.count({ where: { platform: 'KICK' } });

  const kickNoAvatar = await db.streamer.count({
    where: { platform: 'KICK', OR: [{ avatarUrl: null }, { avatarUrl: '' }] }
  });

  const kickOnBunny = await db.streamer.count({
    where: {
      platform: 'KICK',
      OR: [
        { avatarUrl: { contains: 'b-cdn.net' } },
        { avatarUrl: { contains: 'media.envr.io' } }
      ]
    }
  });

  const kickOnKickCdn = await db.streamer.count({
    where: {
      platform: 'KICK',
      avatarUrl: { contains: 'kick.com' }
    }
  });

  console.log('=== KICK Avatar Status ===');
  console.log(`Total Kick creators: ${kickTotal}`);
  console.log(`No avatar: ${kickNoAvatar}`);
  console.log(`On Bunny CDN: ${kickOnBunny}`);
  console.log(`On Kick CDN (may expire): ${kickOnKickCdn}`);
  console.log(`Other: ${kickTotal - kickNoAvatar - kickOnBunny - kickOnKickCdn}`);

  // Sample some that need migration
  const needsMigration = await db.streamer.findMany({
    where: {
      platform: 'KICK',
      avatarUrl: { contains: 'kick.com' }
    },
    select: { username: true, avatarUrl: true },
    take: 5
  });

  if (needsMigration.length > 0) {
    console.log('\nSample needing Bunny migration:');
    needsMigration.forEach(k => console.log(`  ${k.username}: ${k.avatarUrl?.substring(0, 60)}...`));
  }

  await db.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
