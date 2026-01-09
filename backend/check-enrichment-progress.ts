import { db } from './src/utils/database';

async function checkEnrichmentProgress() {
  console.log('📊 Checking enrichment progress...\n');

  // Total streamers
  const totalStreamers = await db.streamer.count();

  // Streamers with enrichment data
  const enrichedStreamers = await db.streamer.count({
    where: {
      lastEnrichmentUpdate: {
        not: null
      }
    }
  });

  // Streamers without enrichment
  const unenriched = totalStreamers - enrichedStreamers;
  const enrichedPercentage = ((enrichedStreamers / totalStreamers) * 100).toFixed(2);

  console.log('═══════════════════════════════════════');
  console.log('📈 ENRICHMENT STATISTICS');
  console.log('═══════════════════════════════════════');
  console.log(`Total Streamers:     ${totalStreamers.toLocaleString()}`);
  console.log(`Enriched:            ${enrichedStreamers.toLocaleString()} (${enrichedPercentage}%)`);
  console.log(`Not Enriched:        ${unenriched.toLocaleString()}`);
  console.log('═══════════════════════════════════════\n');

  // Show some enriched examples
  const enrichedExamples = await db.streamer.findMany({
    where: {
      lastEnrichmentUpdate: {
        not: null
      }
    },
    select: {
      displayName: true,
      platform: true,
      lastEnrichmentUpdate: true,
      contentAnalysis: true
    },
    orderBy: {
      lastEnrichmentUpdate: 'desc'
    },
    take: 5
  });

  if (enrichedExamples.length > 0) {
    console.log('📝 Recent enriched streamers:');
    enrichedExamples.forEach(s => {
      const content = s.contentAnalysis as any;
      const categories = content?.contentCategories?.join(', ') || 'N/A';
      console.log(`  ✓ ${s.displayName} (${s.platform}) - ${categories}`);
    });
  }

  process.exit(0);
}

checkEnrichmentProgress().catch(console.error);
