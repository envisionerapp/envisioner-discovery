import { tagScrapingService } from './src/services/tagScrapingService';
import { db } from './src/utils/database';

async function scrapeTopStreamers() {
  console.log('Scraping tags for top streamers...\n');

  // Get top 50 streamers by highest viewers
  const topStreamers = await db.streamer.findMany({
    where: {
      highestViewers: { gt: 0 }
    },
    orderBy: { highestViewers: 'desc' },
    take: 50,
    select: {
      id: true,
      username: true,
      platform: true,
      profileUrl: true,
      tags: true
    }
  });

  console.log(`Found ${topStreamers.length} top streamers\n`);

  let updated = 0;
  let errors = 0;

  for (const streamer of topStreamers) {
    try {
      const tags = await (tagScrapingService as any).scrapeTagsForStreamer(
        streamer.platform,
        streamer.username
      );

      if (tags.length > 0) {
        await db.streamer.update({
          where: { id: streamer.id },
          data: { tags }
        });
        console.log(`✓ ${streamer.username} (${streamer.platform}): ${tags.join(', ')}`);
        updated++;
      } else {
        console.log(`- ${streamer.username} (${streamer.platform}): No tags found`);
      }
    } catch (error: any) {
      console.log(`✗ ${streamer.username} (${streamer.platform}): ${error.message}`);
      errors++;
    }
  }

  console.log(`\nCompleted: ${updated} updated, ${errors} errors`);
  process.exit(0);
}

scrapeTopStreamers().catch(console.error);
