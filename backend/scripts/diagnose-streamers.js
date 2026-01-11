const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  // 1. Total streamers count
  const totalCount = await db.streamer.count();
  console.log('=== STREAMER STATISTICS ===');
  console.log(`Total streamers: ${totalCount}`);

  // 2. Count by platform
  const platformCounts = await db.streamer.groupBy({
    by: ['platform'],
    _count: { _all: true },
  });
  console.log('\n=== BY PLATFORM ===');
  console.log(JSON.stringify(platformCounts, null, 2));

  // 3. Count by region
  const regionCounts = await db.streamer.groupBy({
    by: ['region'],
    _count: { _all: true },
  });
  console.log('\n=== BY REGION (Top 10) ===');
  const sortedRegions = regionCounts.sort((a, b) => b._count._all - a._count._all).slice(0, 10);
  console.log(JSON.stringify(sortedRegions, null, 2));

  // 4. Sample 5 random streamers
  const samples = await db.streamer.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      platform: true,
      username: true,
      displayName: true,
      followers: true,
      totalViews: true,
      avgViewers: true,
      highestViewers: true,
      region: true,
    },
  });
  console.log('\n=== RECENT 5 STREAMERS ===');
  console.log(JSON.stringify(samples.map(s => ({
    ...s,
    totalViews: Number(s.totalViews),
  })), null, 2));

  // 5. Check for any streamers with notes containing "Synced from influencers"
  const syncedStreamers = await db.streamer.count({
    where: { notes: { contains: 'Synced from influencers' } },
  });
  console.log(`\n=== SYNCED FROM INFLUENCERS TABLE ===`);
  console.log(`Synced streamers: ${syncedStreamers}`);

  // 6. Check for streamers with null/empty required fields
  const badStreamers = await db.streamer.count({
    where: {
      OR: [
        { username: '' },
        { displayName: '' },
        { profileUrl: '' },
      ],
    },
  });
  console.log(`\n=== STREAMERS WITH EMPTY FIELDS ===`);
  console.log(`Streamers with empty username/displayName/profileUrl: ${badStreamers}`);

  // 7. Sample API response (simulating frontend request)
  const apiResponse = await db.streamer.findMany({
    take: 10,
    orderBy: { lastSeenLive: { sort: 'desc', nulls: 'last' } },
    select: {
      id: true,
      platform: true,
      username: true,
      displayName: true,
      followers: true,
      lastSeenLive: true,
    },
  });
  console.log('\n=== SAMPLE API RESPONSE (sorted by lastSeenLive) ===');
  console.log(JSON.stringify(apiResponse, null, 2));
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
