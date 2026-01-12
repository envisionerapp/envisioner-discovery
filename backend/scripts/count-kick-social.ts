import { db } from '../src/utils/database';

async function count() {
  const withSocial = await db.streamer.count({
    where: {
      platform: 'KICK',
      NOT: { socialLinks: { equals: [] } }
    }
  });

  const totalKick = await db.streamer.count({ where: { platform: 'KICK' } });

  console.log('Kick streamers with socialLinks:', withSocial, '/', totalKick);
  console.log('Success rate:', ((withSocial / totalKick) * 100).toFixed(1) + '%');

  // Count pending in sync queue
  const pending = await db.socialSyncQueue.count({ where: { status: 'PENDING' } });
  console.log('\nPending in sync queue:', pending);

  // Group by platform
  const byPlatform = await db.socialSyncQueue.groupBy({
    by: ['platform'],
    where: { status: 'PENDING' },
    _count: true
  });

  console.log('\nPending by platform:');
  byPlatform.forEach(p => console.log('  ' + p.platform + ':', p._count));

  await db.$disconnect();
}

count().catch(console.error);
