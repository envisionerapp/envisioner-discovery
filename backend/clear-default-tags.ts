import { db } from './src/utils/database';

async function clearDefaultTags() {
  console.log('Clearing default GAMING and IRL tags from database...\n');

  // Clear tags that are only GAMING or only IRL (likely defaults)
  const result = await db.streamer.updateMany({
    where: {
      OR: [
        { tags: { equals: ['GAMING'] } },
        { tags: { equals: ['IRL'] } },
      ]
    },
    data: {
      tags: []
    }
  });

  console.log(`Cleared default tags from ${result.count} streamers`);

  // Show some streamers that still have tags (these should be properly scraped ones)
  const streamersWithTags = await db.streamer.findMany({
    where: {
      tags: {
        isEmpty: false
      }
    },
    take: 10,
    select: {
      username: true,
      platform: true,
      tags: true
    }
  });

  console.log(`\n${streamersWithTags.length} streamers still have tags (properly scraped):`);
  streamersWithTags.forEach(s => {
    console.log(`- ${s.username} (${s.platform}): ${s.tags.join(', ')}`);
  });

  process.exit(0);
}

clearDefaultTags().catch(console.error);
