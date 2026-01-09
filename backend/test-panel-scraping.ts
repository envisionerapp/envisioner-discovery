import { intelligentEnrichmentService } from './src/services/intelligentEnrichmentService';
import { db } from './src/utils/database';

async function testPanelScraping() {
  console.log('🔍 Testing Twitch panel scraping...\n');
  
  // Find a popular Twitch streamer
  const streamer = await db.streamer.findFirst({
    where: { 
      platform: 'TWITCH',
      followers: { gt: 1000000 }
    },
    select: { id: true, username: true, followers: true }
  });
  
  if (!streamer) {
    console.log('No Twitch streamers found');
    await db.$disconnect();
    process.exit(0);
  }
  
  console.log('Testing with:', streamer.username, `(${streamer.followers.toLocaleString()} followers)`);
  
  // Mark for enrichment
  await db.streamer.update({
    where: { id: streamer.id },
    data: { lastEnrichmentUpdate: null }
  });
  
  // Run enrichment
  console.log('\nEnriching...');
  await intelligentEnrichmentService.enrichAllStreamers(1);
  
  // Check results
  const result = await db.streamer.findUnique({
    where: { id: streamer.id },
    select: { 
      username: true, 
      panelImages: true, 
      panelTexts: true,
      profileDescription: true,
      streamTitles: true,
      externalLinks: true
    }
  });
  
  console.log('\n✅ SCRAPING RESULTS:\n');
  console.log('Bio:', result?.profileDescription?.substring(0, 120) || 'None');
  console.log('Stream Titles:', Array.isArray(result?.streamTitles) ? result.streamTitles.length : 0);
  console.log('Panel Texts:', result?.panelTexts?.length || 0);
  console.log('External Links:', result?.externalLinks ? (typeof result.externalLinks === 'string' ? JSON.parse(result.externalLinks).length : Object.keys(result.externalLinks).length) : 0);
  
  if (result?.panelImages) {
    const panels = typeof result.panelImages === 'string' 
      ? JSON.parse(result.panelImages) 
      : result.panelImages;
    console.log('\n🖼️  PANEL IMAGES:', panels.length);
    panels.slice(0, 5).forEach((p: any, i: number) => {
      console.log(`\n${i+1}. ${p.url}`);
      if (p.alt) console.log(`   Alt: ${p.alt.substring(0, 100)}`);
      if (p.link) console.log(`   Link: ${p.link}`);
    });
  } else {
    console.log('\n⚠️  No panel images scraped');
  }
  
  await db.$disconnect();
  process.exit(0);
}

testPanelScraping();
