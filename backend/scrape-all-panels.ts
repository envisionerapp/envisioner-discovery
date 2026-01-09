import { db } from './src/utils/database';
import { Prisma } from '@prisma/client';
import axios from 'axios';

const BATCH_SIZE = 10;
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds
const DELAY_BETWEEN_REQUESTS = 500; // 0.5 seconds

async function scrapeAllPanels() {
  console.log('🚀 Starting panel scraping for all Twitch streamers...\n');

  // Get all Twitch streamers, prioritize by followers
  const twitchStreamers = await db.streamer.findMany({
    where: {
      platform: 'TWITCH'
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      followers: true,
      panelImages: true
    },
    orderBy: { followers: 'desc' }
  });

  console.log(`📊 Found ${twitchStreamers.length} Twitch streamers\n`);

  // Filter out streamers that already have panels
  const streamersWithoutPanels = twitchStreamers.filter(s => !s.panelImages || (Array.isArray(s.panelImages) && s.panelImages.length === 0));
  const streamersWithPanels = twitchStreamers.length - streamersWithoutPanels.length;

  console.log(`✅ ${streamersWithPanels} already have panels`);
  console.log(`⏳ ${streamersWithoutPanels.length} need panel scraping\n`);

  let scraped = 0;
  let withPanels = 0;
  let withoutPanels = 0;
  let errors = 0;

  // Process in batches
  for (let i = 0; i < streamersWithoutPanels.length; i += BATCH_SIZE) {
    const batch = streamersWithoutPanels.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(streamersWithoutPanels.length / BATCH_SIZE);

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📦 Batch ${batchNum}/${totalBatches} (${batch.length} streamers)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    for (const streamer of batch) {
      try {
        scraped++;
        const progress = `[${scraped}/${streamersWithoutPanels.length}]`;

        process.stdout.write(`${progress} ${streamer.username} (${streamer.followers.toLocaleString()} followers)... `);

        // GraphQL query to get panels
        const graphqlQuery = {
          operationName: 'ChannelPanels',
          variables: {
            login: streamer.username
          },
          query: `query ChannelPanels($login: String!) {
            user(login: $login) {
              id
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

        const response = await axios.post('https://gql.twitch.tv/gql', graphqlQuery, {
          headers: {
            'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });

        if (response.data?.data?.user?.panels) {
          const panels = response.data.data.user.panels;

          if (panels.length > 0) {
            const panelImages = panels
              .filter((p: any) => p.imageURL)
              .map((p: any) => ({
                url: p.imageURL,
                alt: p.title || p.description || undefined,
                link: p.linkURL || undefined
              }));

            if (panelImages.length > 0) {
              await db.streamer.update({
                where: { id: streamer.id },
                data: {
                  panelImages: panelImages,
                  lastEnrichmentUpdate: new Date()
                }
              });

              withPanels++;
              console.log(`✅ ${panelImages.length} panels`);
            } else {
              withoutPanels++;
              console.log(`⚠️  No images`);
            }
          } else {
            withoutPanels++;
            console.log(`⚠️  No panels`);
          }
        } else {
          withoutPanels++;
          console.log(`⚠️  No data`);
        }

        // Delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));

      } catch (error: any) {
        errors++;
        if (error.response?.status === 429) {
          console.log(`❌ Rate limited! Waiting 60s...`);
          await new Promise(resolve => setTimeout(resolve, 60000));
        } else {
          console.log(`❌ Error: ${error.message}`);
        }
      }
    }

    // Progress summary after each batch
    console.log(`\n📊 Progress: ${scraped}/${streamersWithoutPanels.length} (${Math.round(scraped / streamersWithoutPanels.length * 100)}%)`);
    console.log(`   ✅ With panels: ${withPanels}`);
    console.log(`   ⚠️  Without panels: ${withoutPanels}`);
    console.log(`   ❌ Errors: ${errors}`);

    // Delay between batches
    if (i + BATCH_SIZE < streamersWithoutPanels.length) {
      console.log(`\n⏸️  Waiting ${DELAY_BETWEEN_BATCHES / 1000}s before next batch...\n`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }

  // Final summary
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ PANEL SCRAPING COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`📊 Total streamers processed: ${scraped}`);
  console.log(`✅ Streamers with panels: ${withPanels + streamersWithPanels} (${withPanels} new + ${streamersWithPanels} existing)`);
  console.log(`⚠️  Streamers without panels: ${withoutPanels}`);
  console.log(`❌ Errors: ${errors}\n`);

  // Show some examples
  const examples = await db.streamer.findMany({
    where: {
      platform: 'TWITCH',
      panelImages: { not: Prisma.DbNull }
    },
    select: {
      username: true,
      panelImages: true
    },
    orderBy: { followers: 'desc' },
    take: 5
  });

  if (examples.length > 0) {
    console.log('🎨 Examples of streamers with panels:\n');
    examples.forEach(s => {
      const panels = typeof s.panelImages === 'string' ? JSON.parse(s.panelImages) : s.panelImages;
      const count = Array.isArray(panels) ? panels.length : 0;
      console.log(`   • ${s.username}: ${count} panels`);
    });
  }

  await db.$disconnect();
  process.exit(0);
}

scrapeAllPanels();
