import { db } from '../src/utils/database';

async function main() {
  // Total by platform
  console.log('=== TOTAL CREATORS BY PLATFORM ===');
  const byPlatform = await db.streamer.groupBy({
    by: ['platform'],
    _count: true,
    orderBy: { _count: { platform: 'desc' } }
  });
  for (const p of byPlatform) {
    console.log(`  ${p.platform}: ${p._count.toLocaleString()}`);
  }

  // Discovery sources
  console.log('\n=== TOP DISCOVERY SOURCES ===');
  const sources = await db.streamer.groupBy({
    by: ['discoveredVia'],
    _count: true,
    orderBy: { _count: { discoveredVia: 'desc' } },
    take: 25
  });
  for (const s of sources) {
    console.log(`  ${s.discoveredVia || 'NULL'}: ${s._count.toLocaleString()}`);
  }

  // Recent discoveries (last 7 days)
  console.log('\n=== DISCOVERIES LAST 7 DAYS ===');
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recent = await db.streamer.groupBy({
    by: ['platform'],
    where: { createdAt: { gte: weekAgo } },
    _count: true,
  });
  let totalRecent = 0;
  for (const r of recent) {
    console.log(`  ${r.platform}: ${r._count.toLocaleString()}`);
    totalRecent += r._count;
  }
  console.log(`  TOTAL: ${totalRecent.toLocaleString()}`);

  // Last 24 hours
  console.log('\n=== DISCOVERIES LAST 24 HOURS ===');
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const today = await db.streamer.groupBy({
    by: ['platform'],
    where: { createdAt: { gte: dayAgo } },
    _count: true,
  });
  let totalToday = 0;
  for (const t of today) {
    console.log(`  ${t.platform}: ${t._count.toLocaleString()}`);
    totalToday += t._count;
  }
  console.log(`  TOTAL: ${totalToday.toLocaleString()}`);

  // Discovery by method breakdown
  console.log('\n=== DISCOVERY METHODS BREAKDOWN ===');
  const methodCounts: Record<string, number> = {};
  for (const s of sources) {
    const via = s.discoveredVia || '';
    let method = 'other';
    if (via.startsWith('twitch:')) method = 'twitch-api';
    else if (via.startsWith('kick:')) method = 'kick-api';
    else if (via.startsWith('youtube:')) method = 'youtube-api';
    else if (via.startsWith('scrapecreators:')) method = 'scrapecreators';
    else if (via.startsWith('csv')) method = 'csv-import';
    else if (!via) method = 'unknown';
    methodCounts[method] = (methodCounts[method] || 0) + s._count;
  }
  const sortedMethods = Object.entries(methodCounts).sort((a, b) => b[1] - a[1]);
  for (const [method, count] of sortedMethods) {
    console.log(`  ${method}: ${count.toLocaleString()}`);
  }

  // With social links
  console.log('\n=== SOCIAL LINKS COVERAGE ===');
  for (const p of byPlatform) {
    const all = await db.streamer.findMany({
      where: { platform: p.platform },
      select: { socialLinks: true }
    });
    const withSocial = all.filter(s => s.socialLinks && (s.socialLinks as string[]).length > 0).length;
    const pct = p._count > 0 ? ((withSocial / p._count) * 100).toFixed(1) : '0';
    console.log(`  ${p.platform}: ${withSocial.toLocaleString()}/${p._count.toLocaleString()} (${pct}%)`);
  }

  await db.$disconnect();
}

main().catch(console.error);
