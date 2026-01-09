import { db } from './src/utils/database';

async function showTwitchKickData() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 TWITCH & KICK ENRICHED DATA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Get Twitch streamers
  console.log('🟣 TWITCH STREAMERS:\n');
  const twitchStreamers = await db.streamer.findMany({
    where: {
      platform: 'TWITCH',
      lastEnrichmentUpdate: { not: null }
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
      panelTexts: true,
      lastEnrichmentUpdate: true
    },
    orderBy: { lastEnrichmentUpdate: 'desc' },
    take: 2
  });

  twitchStreamers.forEach((s, i) => {
    console.log(`${'═'.repeat(80)}`);
    console.log(`TWITCH ${i + 1}: ${s.displayName || s.username} (@${s.username})`);
    console.log(`${'═'.repeat(80)}\n`);
    printStreamerData(s);
  });

  // Get Kick streamers
  console.log('\n🟢 KICK STREAMERS:\n');
  const kickStreamers = await db.streamer.findMany({
    where: {
      platform: 'KICK',
      lastEnrichmentUpdate: { not: null }
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
    take: 2
  });

  kickStreamers.forEach((s, i) => {
    console.log(`${'═'.repeat(80)}`);
    console.log(`KICK ${i + 1}: ${s.displayName || s.username} (@${s.username})`);
    console.log(`${'═'.repeat(80)}\n`);
    printStreamerData(s);
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await db.$disconnect();
  process.exit(0);
}

function printStreamerData(streamer: any) {
  console.log(`🏷️  Tags: ${streamer.tags.slice(0, 5).join(', ')}${streamer.tags.length > 5 ? '...' : ''}`);
  console.log(`🎯 Current Game: ${streamer.currentGame || 'N/A'}`);
  console.log(`🔝 Top Games: ${streamer.topGames.slice(0, 3).join(', ')}`);
  
  console.log('\n📝 SCRAPED PROFILE DATA:');
  console.log(`   Bio/Description: ${streamer.profileDescription || 'N/A'}`);
  
  if (streamer.streamTitles && Array.isArray(streamer.streamTitles) && streamer.streamTitles.length > 0) {
    console.log('\n📺 SCRAPED STREAM TITLES:');
    const titles = streamer.streamTitles.slice(0, 3);
    titles.forEach((t: any, idx: number) => {
      const title = typeof t === 'string' ? t : (t.title || JSON.stringify(t));
      const date = t.date ? new Date(t.date).toLocaleDateString() : '';
      console.log(`   ${idx + 1}. ${title} ${date ? `(${date})` : ''}`);
    });
  }

  if (streamer.externalLinks && Array.isArray(streamer.externalLinks) && streamer.externalLinks.length > 0) {
    console.log('\n🔗 SCRAPED SOCIAL LINKS:');
    streamer.externalLinks.slice(0, 5).forEach((link: any) => {
      console.log(`   • ${link}`);
    });
  }

  if (streamer.panelTexts && Array.isArray(streamer.panelTexts) && streamer.panelTexts.length > 0) {
    console.log('\n📋 SCRAPED PANEL TEXTS:');
    streamer.panelTexts.slice(0, 3).forEach((text: any, idx: number) => {
      const panelText = typeof text === 'string' ? text : JSON.stringify(text);
      console.log(`   ${idx + 1}. ${panelText.substring(0, 80)}...`);
    });
  }

  console.log('\n🧠 AI GENERATED INTELLIGENCE:');
  console.log(`   🎯 iGaming Score: ${streamer.igamingScore}/100`);
  console.log(`   🛡️  Brand Safety: ${streamer.brandSafetyScore}/100`);
  console.log(`   🎰 Gambling Compatible: ${streamer.gamblingCompatibility ? 'YES ✅' : 'NO ❌'}`);

  if (streamer.audiencePsychology) {
    const psych = typeof streamer.audiencePsychology === 'string' 
      ? streamer.audiencePsychology 
      : JSON.stringify(streamer.audiencePsychology);
    console.log(`\n👥 AI AUDIENCE ANALYSIS:`);
    console.log(`   ${psych}`);
  }

  if (streamer.conversionPotential) {
    const cp = typeof streamer.conversionPotential === 'string'
      ? JSON.parse(streamer.conversionPotential)
      : streamer.conversionPotential;
    console.log(`\n💰 AI CONVERSION PREDICTION:`);
    console.log(`   Level: ${cp.level?.toUpperCase() || 'N/A'}`);
    console.log(`   Confidence: ${cp.confidence || 0}%`);
    if (cp.reasoning) {
      console.log(`   Reasoning: ${cp.reasoning}`);
    }
  }

  if (streamer.contentAnalysis) {
    const analysis = typeof streamer.contentAnalysis === 'string'
      ? streamer.contentAnalysis
      : JSON.stringify(streamer.contentAnalysis);
    console.log(`\n📊 AI CONTENT ANALYSIS:`);
    console.log(`   ${analysis}`);
  }

  console.log(`\n⏰ Enriched: ${streamer.lastEnrichmentUpdate?.toLocaleString()}\n`);
}

showTwitchKickData();
