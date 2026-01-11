const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function testApiResponse() {
  console.log('Testing API response format...\n');

  // Simulate what the frontend API call returns
  const items = await db.streamer.findMany({
    take: 5,
    orderBy: { lastSeenLive: { sort: 'desc', nulls: 'last' } },
    select: {
      id: true,
      platform: true,
      username: true,
      displayName: true,
      profileUrl: true,
      avatarUrl: true,
      followers: true,
      currentViewers: true,
      highestViewers: true,
      isLive: true,
      currentGame: true,
      primaryCategory: true,
      tags: true,
      region: true,
      language: true,
      totalViews: true,
      totalLikes: true,
      totalComments: true,
      totalShares: true,
      avgViewers: true,
      minutesWatched: true,
      durationMinutes: true,
      engagementRate: true,
      lastScrapedAt: true,
      lastStreamed: true,
      lastSeenLive: true,
    },
  });

  // Convert BigInt to Number (like the API does)
  const serializedItems = items.map(item => ({
    ...item,
    totalViews: Number(item.totalViews),
    totalLikes: Number(item.totalLikes),
    totalComments: Number(item.totalComments),
    totalShares: Number(item.totalShares),
    minutesWatched: Number(item.minutesWatched),
  }));

  console.log('=== SAMPLE API RESPONSE ===');
  console.log(JSON.stringify(serializedItems, null, 2));

  // Count total
  const total = await db.streamer.count();
  console.log(`\nTotal streamers: ${total}`);

  // Count with lastSeenLive
  const withLastSeen = await db.streamer.count({
    where: { lastSeenLive: { not: null } },
  });
  console.log(`Streamers with lastSeenLive: ${withLastSeen}`);
}

testApiResponse()
  .catch(console.error)
  .finally(() => db.$disconnect());
