import { db } from './src/utils/database';

async function showEnrichedData() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 ENRICHED STREAMER DATA SAMPLES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const enrichedStreamers = await db.streamer.findMany({
    where: {
      lastEnrichmentUpdate: { not: null },
      igamingScore: { gt: 0 }
    },
    select: {
      username: true,
      displayName: true,
      platform: true,
      tags: true,
      currentGame: true,
      topGames: true,
      igamingScore: true,
      brandSafetyScore: true,
      gamblingCompatibility: true,
      audiencePsychology: true,
      conversionPotential: true,
      riskAssessment: true,
      contentAnalysis: true,
      profileDescription: true,
      streamTitles: true,
      externalLinks: true,
      lastEnrichmentUpdate: true
    },
    orderBy: { lastEnrichmentUpdate: 'desc' },
    take: 3
  });

  enrichedStreamers.forEach((streamer, i) => {
    console.log(`${'='.repeat(80)}`);
    console.log(`STREAMER ${i + 1}: ${streamer.displayName || streamer.username} (@${streamer.username})`);
    console.log(`${'='.repeat(80)}\n`);

    console.log(`🎮 Platform: ${streamer.platform}`);
    console.log(`🏷️  Tags: ${streamer.tags.join(', ')}`);
    console.log(`🎯 Current Game: ${streamer.currentGame || 'N/A'}`);
    console.log(`🔝 Top Games: ${streamer.topGames.slice(0, 3).join(', ')}`);
    
    console.log('\n📝 PROFILE DATA:');
    console.log(`   Description: ${streamer.profileDescription || 'N/A'}`);
    
    if (streamer.streamTitles && Array.isArray(streamer.streamTitles) && streamer.streamTitles.length > 0) {
      console.log('\n📺 RECENT STREAM TITLES:');
      const titles = streamer.streamTitles.slice(0, 5);
      titles.forEach((t: any, idx: number) => {
        const title = typeof t === 'string' ? t : t.title;
        console.log(`   ${idx + 1}. ${title}`);
      });
    }

    if (streamer.externalLinks && Array.isArray(streamer.externalLinks) && streamer.externalLinks.length > 0) {
      console.log('\n🔗 SOCIAL LINKS:');
      streamer.externalLinks.forEach((link: any) => {
        console.log(`   • ${link}`);
      });
    }

    console.log('\n🧠 AI INTELLIGENCE:');
    console.log(`   🎯 iGaming Score: ${streamer.igamingScore}/100`);
    console.log(`   🛡️  Brand Safety: ${streamer.brandSafetyScore}/100`);
    console.log(`   🎰 Gambling Compatible: ${streamer.gamblingCompatibility ? 'YES ✅' : 'NO ❌'}`);

    if (streamer.audiencePsychology) {
      const psych = typeof streamer.audiencePsychology === 'string' 
        ? streamer.audiencePsychology 
        : JSON.stringify(streamer.audiencePsychology);
      console.log(`\n👥 AUDIENCE PSYCHOLOGY:`);
      console.log(`   ${psych}`);
    }

    if (streamer.conversionPotential) {
      const cp = typeof streamer.conversionPotential === 'string'
        ? JSON.parse(streamer.conversionPotential)
        : streamer.conversionPotential;
      console.log(`\n💰 CONVERSION POTENTIAL:`);
      console.log(`   Level: ${cp.level?.toUpperCase()}`);
      console.log(`   Confidence: ${cp.confidence}%`);
      console.log(`   Reasoning: ${cp.reasoning}`);
    }

    if (streamer.contentAnalysis) {
      const analysis = typeof streamer.contentAnalysis === 'string'
        ? streamer.contentAnalysis
        : JSON.stringify(streamer.contentAnalysis);
      console.log(`\n📊 CONTENT ANALYSIS:`);
      console.log(`   ${analysis}`);
    }

    if (streamer.riskAssessment) {
      const risk = typeof streamer.riskAssessment === 'string'
        ? streamer.riskAssessment
        : JSON.stringify(streamer.riskAssessment);
      console.log(`\n⚠️  RISK ASSESSMENT:`);
      console.log(`   ${risk}`);
    }

    console.log(`\n⏰ Last Updated: ${streamer.lastEnrichmentUpdate?.toLocaleString()}`);
    console.log('\n');
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await db.$disconnect();
  process.exit(0);
}

showEnrichedData();
