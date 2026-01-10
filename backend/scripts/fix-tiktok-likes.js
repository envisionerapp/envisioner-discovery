require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const db = new PrismaClient();

const API_KEY = process.env.SCRAPECREATORS_API_KEY;

async function fixTikTokLikes() {
  const tiktok = await db.streamer.findMany({
    where: { platform: 'TIKTOK' },
    select: { id: true, username: true, displayName: true }
  });

  console.log('Fixing', tiktok.length, 'TikTok entries...\n');

  for (const t of tiktok) {
    try {
      const response = await axios.get('https://api.scrapecreators.com/v1/tiktok/profile', {
        params: { handle: t.username },
        headers: { 'x-api-key': API_KEY }
      });

      const hearts = parseInt(response.data?.statsV2?.heartCount || response.data?.stats?.heartCount || '0');
      const videos = parseInt(response.data?.statsV2?.videoCount || response.data?.stats?.videoCount || '0');

      await db.streamer.update({
        where: { id: t.id },
        data: {
          totalLikes: BigInt(hearts),
          totalViews: BigInt(videos),
        }
      });

      console.log('✅', t.displayName, '- Likes:', hearts.toLocaleString(), '- Videos:', videos);
      await new Promise(r => setTimeout(r, 100));
    } catch (e) {
      console.log('❌', t.username, e.message);
    }
  }

  console.log('\n✅ Done! Verifying...\n');

  const updated = await db.streamer.findMany({
    where: { platform: 'TIKTOK' },
    select: { displayName: true, followers: true, totalLikes: true, totalViews: true },
    orderBy: { followers: 'desc' },
    take: 5
  });

  console.log('Top 5 TikTok by followers:');
  updated.forEach(u => {
    console.log(' ', u.displayName);
    console.log('    Followers:', u.followers?.toLocaleString());
    console.log('    Likes:', u.totalLikes?.toString());
    console.log('    Videos:', u.totalViews?.toString());
  });

  await db.$disconnect();
}

fixTikTokLikes();
