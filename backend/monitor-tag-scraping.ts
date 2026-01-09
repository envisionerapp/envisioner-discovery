import { db, logger } from './src/utils/database';
import { tagScrapingService } from './src/services/tagScrapingService';

async function monitorTagScraping() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏷️  TAG SCRAPING MONITOR');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Get initial stats
  const totalStreamers = await db.streamer.count();
  const streamersWithTags = await db.streamer.count({
    where: { tags: { isEmpty: false } }
  });

  console.log('📊 INITIAL STATS:');
  console.log(`   Total streamers: ${totalStreamers.toLocaleString()}`);
  console.log(`   Streamers with tags: ${streamersWithTags.toLocaleString()}`);
  console.log(`   Streamers without tags: ${(totalStreamers - streamersWithTags).toLocaleString()}`);

  // Get platform breakdown
  const platformStats = await db.streamer.groupBy({
    by: ['platform'],
    _count: true
  });
  console.log('\n📍 BY PLATFORM:');
  platformStats.forEach(p => {
    console.log(`   ${p.platform.padEnd(10)}: ${p._count.toLocaleString()} streamers`);
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('⚡ STARTING SCRAPE...\n');

  const startTime = Date.now();
  let lastUpdate = Date.now();
  let updateCount = 0;
  let errorCount = 0;

  // Monitor progress in real-time
  const progressInterval = setInterval(async () => {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const rate = updateCount / (Date.now() - startTime) * 1000;
    console.log(`⏱️  ${elapsed}s elapsed | ✅ ${updateCount} updated | ❌ ${errorCount} errors | 🚀 ${rate.toFixed(1)}/s`);
  }, 5000);

  try {
    const result = await tagScrapingService.scrapeAllStreamerTags();

    clearInterval(progressInterval);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const rate = result.updated / (Date.now() - startTime) * 1000;

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ SCRAPING COMPLETE!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`✅ Updated: ${result.updated.toLocaleString()}`);
    console.log(`❌ Errors: ${result.errors.toLocaleString()}`);
    console.log(`📈 Success rate: ${((result.updated / (result.updated + result.errors)) * 100).toFixed(1)}%`);
    console.log(`🚀 Average rate: ${rate.toFixed(2)} streamers/second`);

    // Get final counts
    const finalWithTags = await db.streamer.count({
      where: { tags: { isEmpty: false } }
    });

    console.log('\n📊 FINAL STATS:');
    console.log(`   Streamers with tags: ${finalWithTags.toLocaleString()}`);
    console.log(`   New streamers tagged: ${(finalWithTags - streamersWithTags).toLocaleString()}`);

    // Show recently updated samples
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 RECENTLY UPDATED STREAMERS (Last 15):');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const samples = await db.streamer.findMany({
      where: { tags: { isEmpty: false } },
      select: {
        username: true,
        platform: true,
        tags: true,
        updatedAt: true
      },
      orderBy: { updatedAt: 'desc' },
      take: 15
    });

    samples.forEach((s, i) => {
      const num = `${i + 1}.`.padEnd(4);
      const platform = s.platform.padEnd(8);
      const username = s.username.padEnd(20);
      const tagPreview = s.tags.slice(0, 3).join(', ');
      const more = s.tags.length > 3 ? ` +${s.tags.length - 3} more` : '';
      console.log(`${num}${platform} | ${username} | ${tagPreview}${more}`);
    });

    // Show tag distribution
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏆 TOP 10 MOST COMMON TAGS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Stream results in batches to avoid memory overflow
    const tagCounts = new Map<string, number>();
    const batchSize = 1000;
    let offset = 0;
    let batch;

    do {
      batch = await db.streamer.findMany({
        where: { tags: { isEmpty: false } },
        select: { tags: true },
        skip: offset,
        take: batchSize
      });

      batch.forEach(s => {
        s.tags.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      });

      offset += batchSize;
    } while (batch.length === batchSize);

    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    topTags.forEach((([tag, count], i) => {
      const num = `${i + 1}.`.padEnd(4);
      const tagName = tag.padEnd(30);
      const bar = '█'.repeat(Math.min(50, Math.floor(count / topTags[0][1] * 50)));
      console.log(`${num}${tagName} ${count.toString().padStart(5)} ${bar}`);
    }));

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    clearInterval(progressInterval);
    console.error('❌ Error during scraping:', error);
  } finally {
    await db.$disconnect();
    process.exit(0);
  }
}

monitorTagScraping();
