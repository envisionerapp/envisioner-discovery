import { db } from '../src/utils/database';

async function main() {
  console.log('=== INSTAGRAM SYNC ANALYSIS ===\n');

  // Check completed Instagram syncs
  const completed = await db.socialSyncQueue.findMany({
    where: { platform: 'INSTAGRAM', status: 'COMPLETED' },
    orderBy: { processedAt: 'desc' },
    take: 20,
    select: { username: true, processedAt: true }
  });

  console.log('Recent completed Instagram syncs:');
  for (const c of completed) {
    const exists = await db.streamer.findUnique({
      where: { platform_username: { platform: 'INSTAGRAM', username: c.username } },
      select: { username: true, followers: true, displayName: true }
    });
    const status = exists ? `✅ Created (${exists.followers?.toLocaleString()} followers)` : '❌ NOT in streamers table';
    console.log(`  @${c.username}: ${status}`);
  }

  // Check failed syncs
  const failed = await db.socialSyncQueue.findMany({
    where: { platform: 'INSTAGRAM', status: 'FAILED' },
    take: 10,
    select: { username: true, errorMessage: true }
  });

  console.log('\nFailed Instagram syncs:');
  for (const f of failed) {
    console.log(`  @${f.username}: ${f.errorMessage}`);
  }

  // Timing analysis
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const completedLastHour = await db.socialSyncQueue.count({
    where: {
      platform: 'INSTAGRAM',
      status: 'COMPLETED',
      processedAt: { gte: oneHourAgo }
    }
  });

  const pending = await db.socialSyncQueue.count({
    where: { platform: 'INSTAGRAM', status: 'PENDING' }
  });

  console.log('\n=== SYNC RATE ===');
  console.log(`Completed in last hour: ${completedLastHour}`);
  console.log(`Pending: ${pending.toLocaleString()}`);

  if (completedLastHour > 0) {
    const hoursToComplete = pending / completedLastHour;
    console.log(`Estimated time to clear queue: ${hoursToComplete.toFixed(1)} hours`);
  } else {
    console.log('No syncs in last hour - sync job may not be running');
  }

  // Current job settings
  console.log('\n=== CURRENT SETTINGS ===');
  console.log('socialSyncJob: Every 10 min, 50 per platform');
  console.log('Expected rate: 300/hour per platform');
  console.log(`Time to clear 7,239: ~24 hours`);

  await db.$disconnect();
}

main().catch(console.error);
