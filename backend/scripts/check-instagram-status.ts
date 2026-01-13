import { db } from '../src/utils/database';

async function main() {
  console.log('=== INSTAGRAM STATUS ===\n');

  // Instagram creators in DB
  const igCreators = await db.streamer.count({ where: { platform: 'INSTAGRAM' } });
  console.log('Instagram creators in DB:', igCreators);

  // Where did they come from?
  const sources = await db.streamer.groupBy({
    by: ['discoveredVia'],
    where: { platform: 'INSTAGRAM' },
    _count: true,
    orderBy: { _count: { discoveredVia: 'desc' } },
    take: 15
  });
  console.log('\nInstagram discovery sources:');
  for (const s of sources) {
    console.log(`  ${s.discoveredVia || 'NULL'}: ${s._count}`);
  }

  // Instagram in sync queue
  const queueStats = await db.socialSyncQueue.groupBy({
    by: ['status'],
    where: { platform: 'INSTAGRAM' },
    _count: true,
  });
  console.log('\nInstagram sync queue:');
  let totalQueue = 0;
  for (const s of queueStats) {
    console.log(`  ${s.status}: ${s._count}`);
    totalQueue += s._count;
  }
  console.log(`  TOTAL: ${totalQueue}`);

  // Sample pending Instagram handles
  const pending = await db.socialSyncQueue.findMany({
    where: { platform: 'INSTAGRAM', status: 'PENDING' },
    take: 10,
    select: { username: true, createdAt: true }
  });
  console.log('\nSample pending Instagram handles:');
  for (const p of pending) {
    console.log(`  @${p.username}`);
  }

  // Check if pending handles exist as streamers
  console.log('\n=== GAP ANALYSIS ===');
  const pendingHandles = await db.socialSyncQueue.findMany({
    where: { platform: 'INSTAGRAM', status: 'PENDING' },
    select: { username: true }
  });

  let existingCount = 0;
  let missingCount = 0;

  for (const h of pendingHandles.slice(0, 100)) {
    const exists = await db.streamer.findUnique({
      where: { platform_username: { platform: 'INSTAGRAM', username: h.username } }
    });
    if (exists) existingCount++;
    else missingCount++;
  }

  console.log(`Checked first 100 pending handles:`);
  console.log(`  Already in DB: ${existingCount}`);
  console.log(`  NOT in DB (will be created when synced): ${missingCount}`);

  // Extrapolate
  const totalPending = queueStats.find(s => s.status === 'PENDING')?._count || 0;
  const estimatedNew = Math.round((missingCount / 100) * totalPending);
  console.log(`\nEstimated new Instagram creators to be added: ~${estimatedNew.toLocaleString()}`);

  await db.$disconnect();
}

main().catch(console.error);
