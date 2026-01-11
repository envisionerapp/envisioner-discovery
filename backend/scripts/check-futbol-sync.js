const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function check() {
  // Search for FutbolcrudaEC
  const streamer = await db.streamer.findFirst({
    where: { username: 'futbolcrudaec' },
    select: {
      id: true,
      username: true,
      displayName: true,
      followers: true,
      totalViews: true,
      totalLikes: true,
      totalComments: true,
    }
  });

  console.log('FutbolcrudaEC in discovery_creators:');
  if (streamer) {
    console.log(JSON.stringify({
      ...streamer,
      totalViews: Number(streamer.totalViews || 0),
      totalLikes: Number(streamer.totalLikes || 0),
      totalComments: Number(streamer.totalComments || 0),
    }, null, 2));
  } else {
    console.log('Not found');
  }

  await db.$disconnect();
}

check().catch(console.error);
