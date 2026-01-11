const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const db = new PrismaClient();

async function syncXStats() {
  console.log('Fetching X/Twitter stats for all X creators...\n');

  const apiKey = process.env.SCRAPECREATORS_API_KEY;
  if (!apiKey) {
    console.error('SCRAPECREATORS_API_KEY not configured');
    return;
  }

  // Get all X creators
  const xCreators = await db.streamer.findMany({
    where: { platform: 'X' },
  });

  console.log(`Found ${xCreators.length} X creators\n`);

  for (const creator of xCreators) {
    console.log(`Fetching stats for @${creator.username}...`);

    try {
      const response = await axios.get('https://api.scrapecreators.com/v1/twitter/profile', {
        params: { handle: creator.username },
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      const data = response.data?.data || response.data;

      if (data) {
        await db.streamer.update({
          where: { id: creator.id },
          data: {
            displayName: data.name || creator.displayName,
            avatarUrl: data.profile_image_url || creator.avatarUrl,
            followers: data.followers_count || 0,
            profileDescription: data.description || null,
            lastScrapedAt: new Date(),
            lastSeenLive: new Date(), // Mark as recently active
          },
        });
        console.log(`  ✅ Updated: ${data.followers_count?.toLocaleString() || 0} followers`);
      } else {
        console.log('  ❌ No data returned');
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.response?.data?.message || error.message}`);
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\nDone!');
}

syncXStats()
  .catch(console.error)
  .finally(() => db.$disconnect());
