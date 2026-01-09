import { db } from '../src/utils/database';

async function viewAllEnriched() {
  try {
    console.log('🔍 Fetching all enriched streamers...\n');

    // Get enrichment statistics
    const [total, enriched, withPanelTexts, withStreamTitles, withAnalysis] = await Promise.all([
      db.streamer.count(),
      db.streamer.count({ where: { lastEnrichmentUpdate: { not: null } } }),
      db.streamer.count({ where: { panelTexts: { isEmpty: false } } }),
      db.streamer.count({ where: { streamTitles: { isEmpty: false } } }),
      db.streamer.count({ where: { NOT: { contentAnalysis: null } } })
    ]);

    console.log('📊 ENRICHMENT STATISTICS:');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`Total Streamers: ${total}`);
    console.log(`Enriched Streamers: ${enriched} (${((enriched/total)*100).toFixed(2)}%)`);
    console.log(`With Panel Texts: ${withPanelTexts}`);
    console.log(`With Stream Titles: ${withStreamTitles}`);
    console.log(`With AI Analysis: ${withAnalysis}`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Get sample of recently enriched streamers
    const recentlyEnriched = await db.streamer.findMany({
      where: {
        lastEnrichmentUpdate: { not: null }
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        platform: true,
        profileDescription: true,
        panelTexts: true,
        streamTitles: true,
        externalLinks: true,
        webPresence: true,
        contentAnalysis: true,
        lastEnrichmentUpdate: true
      },
      orderBy: {
        lastEnrichmentUpdate: 'desc'
      },
      take: 10
    });

    console.log(`📋 RECENTLY ENRICHED STREAMERS (Last ${recentlyEnriched.length}):\n`);

    recentlyEnriched.forEach((streamer, index) => {
      console.log(`${index + 1}. ${streamer.displayName || streamer.username} (@${streamer.username})`);
      console.log(`   Platform: ${streamer.platform}`);
      console.log(`   Enriched: ${streamer.lastEnrichmentUpdate}`);
      console.log(`   Data Collected:`);
      console.log(`     • Profile Description: ${streamer.profileDescription ? '✅' : '❌'}`);
      console.log(`     • Panel Texts: ${streamer.panelTexts?.length || 0} items`);
      console.log(`     • Stream Titles: ${streamer.streamTitles?.length || 0} items`);
      console.log(`     • External Links: ${streamer.externalLinks ? '✅' : '❌'}`);
      console.log(`     • Web Presence: ${streamer.webPresence ? '✅' : '❌'}`);
      console.log(`     • AI Analysis: ${streamer.contentAnalysis ? '✅' : '❌'}`);

      if (streamer.contentAnalysis) {
        const analysis: any = streamer.contentAnalysis;
        console.log(`   AI Insights:`);
        if (analysis.brandSafety) {
          console.log(`     • Brand Safety: ${analysis.brandSafety.score}/100`);
        }
        if (analysis.gamblingRelevance) {
          console.log(`     • Gambling Relevant: ${analysis.gamblingRelevance.isRelevant ? 'Yes' : 'No'} (${analysis.gamblingRelevance.confidence}% confidence)`);
        }
        if (analysis.language) {
          console.log(`     • Language: ${analysis.language}`);
        }
      }
      console.log('');
    });

    // Get streamers with most data
    console.log('\n🏆 TOP ENRICHED STREAMERS (Most Data):\n');

    const topEnriched = await db.streamer.findMany({
      where: {
        lastEnrichmentUpdate: { not: null }
      },
      select: {
        username: true,
        displayName: true,
        platform: true,
        panelTexts: true,
        streamTitles: true,
        contentAnalysis: true
      },
      take: 100
    });

    const sorted = topEnriched
      .map(s => ({
        ...s,
        dataScore: (s.panelTexts?.length || 0) + (s.streamTitles?.length || 0) + (s.contentAnalysis ? 10 : 0)
      }))
      .sort((a, b) => b.dataScore - a.dataScore)
      .slice(0, 5);

    sorted.forEach((streamer, index) => {
      console.log(`${index + 1}. ${streamer.displayName || streamer.username} (${streamer.platform})`);
      console.log(`   Data Score: ${streamer.dataScore}`);
      console.log(`   Panel Texts: ${streamer.panelTexts?.length || 0}`);
      console.log(`   Stream Titles: ${streamer.streamTitles?.length || 0}`);
      console.log(`   AI Analysis: ${streamer.contentAnalysis ? 'Yes' : 'No'}`);
      console.log('');
    });

    console.log('\n💡 TIP: To view detailed data for a specific streamer, use:');
    console.log('   curl http://localhost:8080/api/enrichment/streamer/STREAMER_ID\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.$disconnect();
    process.exit(0);
  }
}

viewAllEnriched();
