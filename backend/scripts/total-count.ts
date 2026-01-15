import { db } from '../src/utils/database';

async function main() {
  const total = await db.streamer.count();

  const byPlatform = await db.streamer.groupBy({
    by: ['platform'],
    _count: true,
    orderBy: { _count: { platform: 'desc' } }
  });

  const pending = await db.socialSyncQueue.count({ where: { status: 'PENDING' } });
  const failed = await db.socialSyncQueue.count({ where: { status: 'FAILED' } });

  console.log('');
  console.log('==========================================');
  console.log('       TOTAL CREATORS: ' + total.toLocaleString());
  console.log('==========================================');
  console.log('');
  console.log('By Platform:');
  for (const p of byPlatform) {
    console.log('  ' + p.platform.padEnd(12) + ': ' + p._count.toLocaleString());
  }

  console.log('');
  console.log('Sync Queue:');
  console.log('  Pending: ' + pending.toLocaleString());
  console.log('  Failed: ' + failed.toLocaleString());

  if (pending > 0) {
    console.log('');
    console.log('⚠️  NOT COMPLETE - ' + pending + ' items still in queue');
  } else {
    console.log('');
    console.log('✅ COMPLETE - queue is empty');
  }

  await db.$disconnect();
}

main();
