import { db } from '../src/utils/database';

async function showAnyEnriched() {
  try {
    console.log('🔍 Checking for any enriched streamers...\n');

    // First, count how many have lastEnrichmentUpdate
    const enrichedCount = await db.streamer.count({
      where: {
        lastEnrichmentUpdate: { not: null }
      }
    });

    console.log(`Found ${enrichedCount} streamers with lastEnrichmentUpdate\n`);

    // Get any streamer with lastEnrichmentUpdate
    const streamer = await db.streamer.findFirst({
      where: {
        lastEnrichmentUpdate: { not: null }
      },
      select: {
        username: true,
        displayName: true,
        platform: true,
        profileDescription: true,
        bannerText: true,
        panelTexts: true,
        aboutSection: true,
        externalLinks: true,
        streamTitles: true,
        chatKeywords: true,
        webPresence: true,
        contentAnalysis: true,
        lastEnrichmentUpdate: true
      },
      orderBy: {
        lastEnrichmentUpdate: 'desc'
      }
    });

    if (!streamer) {
      console.log('❌ No enriched streamers found in database');
      process.exit(0);
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📺 STREAMER: ${streamer.displayName || streamer.username}`);
    console.log(`👤 Username: ${streamer.username}`);
    console.log(`🎮 PLATFORM: ${streamer.platform}`);
    console.log(`🕐 Last Updated: ${streamer.lastEnrichmentUpdate}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('📊 DATA AVAILABILITY:');
    console.log(`  profileDescription: ${streamer.profileDescription ? '✅ ' + streamer.profileDescription.length + ' chars' : '❌ null'}`);
    console.log(`  aboutSection: ${streamer.aboutSection ? '✅ ' + streamer.aboutSection.length + ' chars' : '❌ null'}`);
    console.log(`  bannerText: ${streamer.bannerText ? '✅ ' + streamer.bannerText.length + ' chars' : '❌ null'}`);
    console.log(`  panelTexts: ${streamer.panelTexts?.length || 0} items`);
    console.log(`  streamTitles: ${streamer.streamTitles?.length || 0} items`);
    console.log(`  chatKeywords: ${streamer.chatKeywords?.length || 0} items`);
    console.log(`  externalLinks: ${streamer.externalLinks ? '✅' : '❌'}`);
    console.log(`  webPresence: ${streamer.webPresence ? '✅' : '❌'}`);
    console.log(`  contentAnalysis: ${streamer.contentAnalysis ? '✅' : '❌'}`);
    console.log('');

    if (streamer.profileDescription) {
      console.log('📝 PROFILE DESCRIPTION:');
      console.log(streamer.profileDescription);
      console.log('');
    }

    if (streamer.aboutSection && streamer.aboutSection !== streamer.profileDescription) {
      console.log('ℹ️  ABOUT SECTION:');
      console.log(streamer.aboutSection);
      console.log('');
    }

    if (streamer.panelTexts && streamer.panelTexts.length > 0) {
      console.log('📋 PANEL TEXTS:');
      streamer.panelTexts.forEach((text, i) => {
        console.log(`  ${i + 1}. ${text}`);
      });
      console.log('');
    }

    if (streamer.streamTitles && streamer.streamTitles.length > 0) {
      console.log('🎬 RECENT STREAM TITLES:');
      streamer.streamTitles.forEach((title, i) => {
        console.log(`  ${i + 1}. ${title}`);
      });
      console.log('');
    }

    if (streamer.chatKeywords && streamer.chatKeywords.length > 0) {
      console.log('💬 CHAT KEYWORDS:');
      console.log(streamer.chatKeywords.join(', '));
      console.log('');
    }

    if (streamer.externalLinks) {
      console.log('🔗 EXTERNAL LINKS:');
      console.log(JSON.stringify(streamer.externalLinks, null, 2));
      console.log('');
    }

    if (streamer.webPresence) {
      console.log('🌐 WEB PRESENCE:');
      console.log(JSON.stringify(streamer.webPresence, null, 2));
      console.log('');
    }

    if (streamer.contentAnalysis) {
      console.log('🤖 AI CONTENT ANALYSIS:');
      console.log(JSON.stringify(streamer.contentAnalysis, null, 2));
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════════');

  } catch (error) {
    console.error('❌ Error fetching data:', error);
  } finally {
    await db.$disconnect();
    process.exit(0);
  }
}

showAnyEnriched();
