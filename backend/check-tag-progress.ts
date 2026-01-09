import { db } from './src/utils/database';

async function checkTagProgress() {
  console.log('📊 Checking tag scraping progress...\n');

  // Total streamers
  const totalStreamers = await db.streamer.count();

  // Streamers with tags
  const streamersWithTags = await db.streamer.count({
    where: {
      tags: {
        isEmpty: false
      }
    }
  });

  // Streamers without tags
  const withoutTags = totalStreamers - streamersWithTags;
  const taggedPercentage = ((streamersWithTags / totalStreamers) * 100).toFixed(2);

  console.log('═══════════════════════════════════════');
  console.log('🏷️  TAG SCRAPING STATISTICS');
  console.log('═══════════════════════════════════════');
  console.log(`Total Streamers:     ${totalStreamers.toLocaleString()}`);
  console.log(`With Tags:           ${streamersWithTags.toLocaleString()} (${taggedPercentage}%)`);
  console.log(`Without Tags:        ${withoutTags.toLocaleString()}`);
  console.log('═══════════════════════════════════════\n');

  // Tag distribution
  const tagStats = await db.streamer.groupBy({
    by: ['platform'],
    where: {
      tags: {
        isEmpty: false
      }
    },
    _count: true
  });

  console.log('📊 Tags by platform:');
  tagStats.forEach(stat => {
    console.log(`  ${stat.platform}: ${stat._count} streamers`);
  });
  console.log();

  // Show some examples
  const taggedExamples = await db.streamer.findMany({
    where: {
      tags: {
        isEmpty: false
      }
    },
    select: {
      displayName: true,
      platform: true,
      tags: true,
      updatedAt: true
    },
    orderBy: {
      updatedAt: 'desc'
    },
    take: 10
  });

  if (taggedExamples.length > 0) {
    console.log('🏷️  Recent tagged streamers:');
    taggedExamples.forEach(s => {
      console.log(`  ✓ ${s.displayName} (${s.platform}): ${s.tags.join(', ')}`);
    });
  }

  process.exit(0);
}

checkTagProgress().catch(console.error);
