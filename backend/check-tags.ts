import { db } from './src/utils/database';

async function checkTags() {
  console.log('Checking streamers with tags...\n');

  const streamersWithTags = await db.streamer.findMany({
    where: {
      tags: {
        isEmpty: false
      }
    },
    take: 20,
    select: {
      username: true,
      displayName: true,
      platform: true,
      tags: true
    },
    orderBy: {
      updatedAt: 'desc'
    }
  });

  console.log(`Found ${streamersWithTags.length} streamers with tags:\n`);

  streamersWithTags.forEach(s => {
    console.log(`${s.displayName} (${s.username}) - ${s.platform}`);
    console.log(`  Tags: ${s.tags.join(', ')}\n`);
  });

  process.exit(0);
}

checkTags().catch(console.error);
