import { db } from '../src/utils/database';

async function main() {
  console.log('=== EXTRACTION STATUS ===\n');

  const platforms = ['TWITCH', 'KICK', 'YOUTUBE'] as const;

  for (const platform of platforms) {
    const total = await db.streamer.count({ where: { platform } });

    // Get all and filter in JS since Prisma JSON filtering is tricky
    const all = await db.streamer.findMany({
      where: { platform },
      select: { socialLinks: true }
    });

    const withLinks = all.filter(s => s.socialLinks && (s.socialLinks as string[]).length > 0).length;
    const pct = total > 0 ? ((withLinks / total) * 100).toFixed(1) : '0';

    console.log(`${platform}: ${withLinks.toLocaleString()}/${total.toLocaleString()} have social links (${pct}%)`);
  }

  // Check sync queue status
  console.log('\n=== SYNC QUEUE STATUS ===\n');
  const queueStats = await db.socialSyncQueue.groupBy({
    by: ['platform', 'status'],
    _count: true,
  });

  const byPlatform: Record<string, Record<string, number>> = {};
  for (const stat of queueStats) {
    if (!byPlatform[stat.platform]) {
      byPlatform[stat.platform] = {};
    }
    byPlatform[stat.platform][stat.status] = stat._count;
  }

  for (const [platform, statuses] of Object.entries(byPlatform)) {
    const pending = statuses['PENDING'] || 0;
    const completed = statuses['COMPLETED'] || 0;
    const failed = statuses['FAILED'] || 0;
    console.log(`${platform}: ${pending} pending, ${completed} completed, ${failed} failed`);
  }

  await db.$disconnect();
}

main().catch(console.error);
