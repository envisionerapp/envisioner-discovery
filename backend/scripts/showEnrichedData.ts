import { db } from '../src/utils/database';

async function showEnrichedData() {
  try {
    console.log('🔍 Fetching enriched streamer data...\n');

    const streamer = await db.streamer.findFirst({
      where: {
        lastEnrichmentUpdate: { not: null },
        OR: [
          { profileDescription: { not: null } },
          { panelTexts: { isEmpty: false } },
          { streamTitles: { isEmpty: false } }
        ]
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
      }
    });

    if (!streamer) {
      console.log('❌ No enriched streamer data found');
      process.exit(0);
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`📺 STREAMER: ${streamer.displayName || streamer.username}`);
    console.log(`🎮 PLATFORM: ${streamer.platform}`);
    console.log(`🕐 Last Updated: ${streamer.lastEnrichmentUpdate}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (streamer.profileDescription) {
      console.log('📝 PROFILE DESCRIPTION:');
      console.log(streamer.profileDescription);
      console.log('');
    }

    if (streamer.aboutSection) {
      console.log('ℹ️  ABOUT SECTION:');
      console.log(streamer.aboutSection);
      console.log('');
    }

    if (streamer.panelTexts && streamer.panelTexts.length > 0) {
      console.log('📋 PANEL TEXTS:');
      streamer.panelTexts.forEach((text, i) => {
        console.log(`  ${i + 1}. ${text.substring(0, 150)}${text.length > 150 ? '...' : ''}`);
      });
      console.log('');
    }

    if (streamer.streamTitles && streamer.streamTitles.length > 0) {
      console.log('🎬 RECENT STREAM TITLES:');
      streamer.streamTitles.slice(0, 10).forEach((title, i) => {
        console.log(`  ${i + 1}. ${title}`);
      });
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

showEnrichedData();
