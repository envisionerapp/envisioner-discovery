import { db } from './src/utils/database';
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

async function testTwitchPanels() {
  console.log('🔍 Finding Twitch streamers with panels...\n');
  
  const token = await getTwitchToken();
  
  // Test some popular streamers known to have panels
  const testStreamers = ['shroud', 'pokimane', 'xqc', 'summit1g', 'tfue'];
  
  for (const username of testStreamers) {
    try {
      // Get user ID
      const userResp = await axios.get(`https://api.twitch.tv/helix/users?login=${username}`, {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${token}`
        }
      });
      
      const userId = userResp.data.data[0]?.id;
      if (!userId) continue;
      
      // Try to get panels using Kraken API
      const panelsResp = await axios.get(`https://api.twitch.tv/kraken/channels/${userId}/panels`, {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Accept': 'application/vnd.twitchtv.v5+json'
        }
      });
      
      if (panelsResp.data && Array.isArray(panelsResp.data) && panelsResp.data.length > 0) {
        console.log(`✅ ${username} has ${panelsResp.data.length} panels!`);
        panelsResp.data.slice(0, 2).forEach((panel: any, i: number) => {
          console.log(`   Panel ${i+1}:`);
          if (panel.data?.image) console.log(`   Image: ${panel.data.image}`);
          if (panel.data?.title) console.log(`   Title: ${panel.data.title}`);
          if (panel.data?.link) console.log(`   Link: ${panel.data.link}`);
        });
        
        // Check if this streamer is in our DB
        const inDb = await db.streamer.findFirst({
          where: { platform: 'TWITCH', username },
          select: { id: true, username: true }
        });
        
        if (inDb) {
          console.log(`   🎯 Found in database! Enriching ${username}...\n`);
          
          // Save panels to database
          const panelImages = panelsResp.data
            .filter((p: any) => p.data?.image)
            .map((p: any) => ({
              url: p.data.image,
              alt: p.data.title || p.data.description,
              link: p.data.link
            }));
          
          await db.streamer.update({
            where: { id: inDb.id },
            data: { panelImages: panelImages }
          });
          
          console.log(`✅ Saved ${panelImages.length} panel images for ${username}!\n`);
          break; // Found one, that's enough
        } else {
          console.log(`   Not in database\n`);
        }
      }
    } catch (error: any) {
      console.log(`❌ ${username}: ${error.message}`);
    }
  }
  
  await db.$disconnect();
  process.exit(0);
}

testTwitchPanels();
