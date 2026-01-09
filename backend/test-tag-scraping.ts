import { tagScrapingService } from './src/services/tagScrapingService';
import { db } from './src/utils/database';

async function test() {
  console.log('Testing tag scraping...');

  // Test with a small sample of streamers first
  const streamers = await db.streamer.findMany({
    take: 10,
    select: {
      id: true,
      username: true,
      platform: true,
      tags: true
    }
  });

  console.log(`\nFound ${streamers.length} streamers to test:`);
  streamers.forEach(s => {
    console.log(`- ${s.username} (${s.platform}) - Current tags: [${s.tags.join(', ')}]`);
  });

  console.log('\nStarting tag scraping...\n');
  const result = await tagScrapingService.scrapeAllStreamerTags();

  console.log(`\nResults: ${result.updated} updated, ${result.errors} errors`);

  // Show updated streamers
  const updatedStreamers = await db.streamer.findMany({
    where: {
      id: {
        in: streamers.map(s => s.id)
      }
    },
    select: {
      username: true,
      platform: true,
      tags: true
    }
  });

  console.log('\nUpdated streamers:');
  updatedStreamers.forEach(s => {
    console.log(`- ${s.username} (${s.platform}) - Tags: [${s.tags.join(', ')}]`);
  });

  process.exit(0);
}

test().catch(console.error);
