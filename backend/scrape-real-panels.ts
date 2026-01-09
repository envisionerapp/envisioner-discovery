import { db } from './src/utils/database';
import { Prisma } from '@prisma/client';
import axios from 'axios';

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || '';
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || '';

async function getTwitchToken() {
  const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
    params: {
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_CLIENT_SECRET,
      grant_type: 'client_credentials'
    }
  });
  return response.data.access_token;
}

async function scrapePanels() {
  console.log('🔍 Finding Twitch streamers from database...\n');

  const token = await getTwitchToken();

  // Get actual Twitch streamers from our database
  const streamers = await db.streamer.findMany({
    where: {
      platform: 'TWITCH',
      followers: { gt: 500000 } // Popular streamers more likely to have panels
    },
    select: { id: true, username: true, followers: true },
    orderBy: { followers: 'desc' },
    take: 20
  });

  console.log(`Found ${streamers.length} Twitch streamers to test\n`);

  for (const streamer of streamers) {
    try {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Testing: ${streamer.username} (${streamer.followers.toLocaleString()} followers)`);

      // Get user ID using Helix API
      const userResp = await axios.get(`https://api.twitch.tv/helix/users?login=${streamer.username}`, {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${token}`
        }
      });

      const userId = userResp.data.data[0]?.id;
      if (!userId) {
        console.log('❌ Could not find user ID');
        continue;
      }

      console.log(`✅ User ID: ${userId}`);

      // Try to get panels using Kraken API
      try {
        const panelsResp = await axios.get(`https://api.twitch.tv/kraken/channels/${userId}/panels`, {
          headers: {
            'Client-ID': TWITCH_CLIENT_ID,
            'Accept': 'application/vnd.twitchtv.v5+json'
          }
        });

        if (panelsResp.data && Array.isArray(panelsResp.data)) {
          console.log(`✅ Found ${panelsResp.data.length} panels!`);

          if (panelsResp.data.length > 0) {
            // Save panels to database
            const panelImages = panelsResp.data
              .filter((p: any) => p.data?.image)
              .map((p: any) => ({
                url: p.data.image,
                alt: p.data.title || p.data.description,
                link: p.data.link
              }));

            console.log(`\n📸 Panel Images (${panelImages.length}):`);
            panelImages.forEach((img: any, i: number) => {
              console.log(`\n${i + 1}. ${img.url}`);
              if (img.alt) console.log(`   Alt: ${img.alt}`);
              if (img.link) console.log(`   Link: ${img.link}`);
            });

            // Save to database
            await db.streamer.update({
              where: { id: streamer.id },
              data: {
                panelImages: panelImages,
                lastEnrichmentUpdate: new Date()
              }
            });

            console.log(`\n✅ SAVED ${panelImages.length} panel images to database for ${streamer.username}!`);
            console.log(`\n🎯 SUCCESS! Found working panels. Stopping here.\n`);
            break; // Found one with panels, stop
          }
        } else {
          console.log('⚠️  No panels found (empty array)');
        }
      } catch (error: any) {
        if (error.response?.status === 404) {
          console.log('⚠️  404: Panels endpoint not found for this user');
        } else if (error.response?.status === 429) {
          console.log('⚠️  429: Rate limited, waiting 60 seconds...');
          await new Promise(resolve => setTimeout(resolve, 60000));
        } else {
          console.log(`❌ Error: ${error.message}`);
        }
      }

      // Delay between requests
      await new Promise(resolve => setTimeout(resolve, 1500));

    } catch (error: any) {
      console.log(`❌ Error with ${streamer.username}: ${error.message}`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Show any streamers that now have panel images
  const withPanels = await db.streamer.findMany({
    where: {
      platform: 'TWITCH',
      panelImages: { not: Prisma.DbNull }
    },
    select: { username: true, panelImages: true }
  });

  console.log(`\n📊 Total streamers with panel images: ${withPanels.length}`);
  withPanels.forEach(s => {
    const panels = typeof s.panelImages === 'string' ? JSON.parse(s.panelImages) : s.panelImages;
    console.log(`   • ${s.username}: ${Array.isArray(panels) ? panels.length : 0} panels`);
  });

  await db.$disconnect();
  process.exit(0);
}

scrapePanels();
