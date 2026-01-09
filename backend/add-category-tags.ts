import { db } from './src/utils/database';

/**
 * Tag categories for AI search
 * These are hidden meta-tags that help AI identify broader categories
 */
const TAG_CATEGORIES = {
  _CAT_GAMBLING: ['CASINO', 'SLOTS', 'BETTING', 'POKER', 'BLACKJACK', 'ROULETTE', 'GAMBLING', 'IGAMING'],
  _CAT_GAMING: ['GAMING', 'RPG', 'FPS', 'STRATEGY', 'SIMULATION', 'HORROR', 'ADVENTURE'],
  _CAT_LIFESTYLE: ['IRL', 'COOKING', 'FITNESS', 'FASHION', 'TRAVEL'],
  _CAT_CREATIVE: ['MUSIC', 'ART', 'COMEDY', 'VARIETY'],
  _CAT_EDUCATIONAL: ['EDUCATION', 'TECHNOLOGY', 'SPORTS']
};

async function addCategoryTags() {
  console.log('Adding category tags to streamers...\n');

  let totalUpdated = 0;

  for (const [categoryTag, realTags] of Object.entries(TAG_CATEGORIES)) {
    console.log(`\nProcessing category: ${categoryTag}`);
    console.log(`Real tags: ${realTags.join(', ')}`);

    // Find streamers with any of these real tags but missing the category tag
    const streamers = await db.streamer.findMany({
      where: {
        AND: [
          { tags: { hasSome: realTags } },
          { NOT: { tags: { has: categoryTag } } }
        ]
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        tags: true
      }
    });

    console.log(`Found ${streamers.length} streamers to tag with ${categoryTag}`);

    // Update each streamer to add the category tag
    for (const streamer of streamers) {
      await db.streamer.update({
        where: { id: streamer.id },
        data: {
          tags: {
            push: categoryTag
          }
        }
      });
      totalUpdated++;
    }

    console.log(`✓ Tagged ${streamers.length} streamers with ${categoryTag}`);
  }

  console.log(`\n✅ Total streamers updated: ${totalUpdated}`);

  // Show summary
  console.log('\n📊 Category Tag Summary:');
  for (const categoryTag of Object.keys(TAG_CATEGORIES)) {
    const count = await db.streamer.count({
      where: { tags: { has: categoryTag } }
    });
    console.log(`${categoryTag}: ${count} streamers`);
  }

  await db.$disconnect();
}

addCategoryTags().catch(console.error);
