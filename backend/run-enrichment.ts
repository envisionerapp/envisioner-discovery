import { db } from './src/utils/database';
import { intelligentEnrichmentService } from './src/services/intelligentEnrichmentService';

async function runEnrichment() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧠 INTELLIGENT STREAMER ENRICHMENT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Get stats
  const totalStreamers = await db.streamer.count();
  const enrichedStreamers = await db.streamer.count({
    where: { lastEnrichmentUpdate: { not: null } }
  });

  console.log('📊 CURRENT STATUS:');
  console.log(`   Total streamers: ${totalStreamers.toLocaleString()}`);
  console.log(`   Already enriched: ${enrichedStreamers.toLocaleString()}`);
  console.log(`   Need enrichment: ${(totalStreamers - enrichedStreamers).toLocaleString()}`);

  // Ask how many to enrich
  const limit = parseInt(process.argv[2] || '100');
  console.log(`\n⚙️  Processing ${limit} streamers...\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const startTime = Date.now();

  try {
    const result = await intelligentEnrichmentService.enrichAllStreamers(limit);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ENRICHMENT COMPLETE!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`✅ Enriched: ${result.enriched}`);
    console.log(`❌ Errors: ${result.errors}`);
    console.log(`📈 Success rate: ${((result.enriched / (result.enriched + result.errors)) * 100).toFixed(1)}%`);

    // Show samples
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 ENRICHED STREAMER SAMPLES:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const samples = await db.streamer.findMany({
      where: {
        lastEnrichmentUpdate: { not: null },
        igamingScore: { gt: 0 }
      },
      select: {
        username: true,
        platform: true,
        igamingScore: true,
        brandSafetyScore: true,
        gamblingCompatibility: true,
        conversionPotential: true,
        audiencePsychology: true
      },
      orderBy: { lastEnrichmentUpdate: 'desc' },
      take: 10
    });

    samples.forEach((s, i) => {
      console.log(`${i + 1}. ${s.username.toUpperCase()} (${s.platform})`);
      console.log(`   🎯 iGaming Score: ${s.igamingScore}/100`);
      console.log(`   🛡️  Brand Safety: ${s.brandSafetyScore}/100`);
      console.log(`   🎰 Gambling Compatible: ${s.gamblingCompatibility ? 'YES' : 'NO'}`);
      if (s.conversionPotential) {
        const cp = typeof s.conversionPotential === 'string'
          ? JSON.parse(s.conversionPotential)
          : s.conversionPotential;
        console.log(`   💰 Conversion: ${cp.level?.toUpperCase()} (${cp.confidence}%)`);
      }
      if (s.audiencePsychology) {
        const psychText = typeof s.audiencePsychology === 'string' ? s.audiencePsychology : String(s.audiencePsychology);
        console.log(`   👥 Audience: ${psychText.substring(0, 80)}...`);
      }
      console.log('');
    });

    // Distribution stats
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📈 SCORE DISTRIBUTION:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const stats = await db.streamer.aggregate({
      where: { igamingScore: { gt: 0 } },
      _avg: { igamingScore: true, brandSafetyScore: true },
      _count: { gamblingCompatibility: true }
    });

    const gamblingCompatible = await db.streamer.count({
      where: { gamblingCompatibility: true }
    });

    console.log(`   Average iGaming Score: ${(stats._avg.igamingScore || 0).toFixed(1)}/100`);
    console.log(`   Average Brand Safety: ${(stats._avg.brandSafetyScore || 0).toFixed(1)}/100`);
    console.log(`   Gambling Compatible: ${gamblingCompatible} streamers`);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error during enrichment:', error);
  } finally {
    await db.$disconnect();
    process.exit(0);
  }
}

runEnrichment();
