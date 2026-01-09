import { db } from './src/utils/database';
import axios from 'axios';

async function scrapePanelsViaGraphQL() {
  console.log('🔍 Attempting to get panels via Twitch GraphQL API...\n');

  // Get a Twitch streamer from database
  const streamer = await db.streamer.findFirst({
    where: {
      platform: 'TWITCH',
      followers: { gt: 1000000 }
    },
    select: { id: true, username: true, displayName: true, followers: true },
    orderBy: { followers: 'desc' }
  });

  if (!streamer) {
    console.log('❌ No Twitch streamers found');
    await db.$disconnect();
    process.exit(1);
  }

  console.log(`Testing with: ${streamer.displayName || streamer.username} (@${streamer.username})`);
  console.log(`Followers: ${streamer.followers.toLocaleString()}\n`);

  try {
    // Try Twitch's GraphQL API - test different field names
    const graphqlQuery = {
      operationName: 'ChannelPanels',
      variables: {
        login: streamer.username
      },
      query: `query ChannelPanels($login: String!) {
        user(login: $login) {
          id
          login
          displayName
          panels {
            __typename
            id
            ... on DefaultPanel {
              title
              description
              imageURL
              linkURL
            }
          }
        }
      }`
    };

    console.log('Sending GraphQL request...\n');

    const response = await axios.post('https://gql.twitch.tv/gql', graphqlQuery, {
      headers: {
        'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko', // Twitch's web client ID
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));

    if (response.data?.data?.user?.panels) {
      const panels = response.data.data.user.panels;
      console.log(`\n✅ Found ${panels.length} panels!\n`);

      const panelImages = panels
        .filter((p: any) => p.imageURL)
        .map((p: any) => ({
          url: p.imageURL,
          alt: p.title || p.description,
          link: p.linkURL
        }));

      console.log('📸 Panel Images:');
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

      console.log(`\n✅ SAVED ${panelImages.length} panel images to database!`);
      console.log(`🎯 SUCCESS! Real panel data obtained for ${streamer.username}\n`);

    } else {
      console.log('\n⚠️  No panels found in GraphQL response');
    }

  } catch (error: any) {
    console.log(`❌ Error: ${error.message}`);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }

  await db.$disconnect();
  process.exit(0);
}

scrapePanelsViaGraphQL();
