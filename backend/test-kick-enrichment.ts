import { enrichKickStreamer } from './scripts/enrich-kick-streamers';
import { db, logger } from './src/utils/database';

/**
 * Test enrichment on a few Kick streamers
 */

async function testEnrichment() {
  console.log('\n🧪 Testing Kick enrichment on sample users...\n');

  try {
    // Get 5 Kick streamers to test
    const testStreamers = await db.streamer.findMany({
      where: {
        platform: 'KICK'
      },
      select: {
        id: true,
        username: true,
        tags: true,
        profileDescription: true
      },
      take: 5
    });

    console.log(`Testing with ${testStreamers.length} streamers:\n`);

    for (const streamer of testStreamers) {
      console.log(`\n--- Testing: ${streamer.username} ---`);
      console.log('Before:');
      console.log('  Tags:', streamer.tags);
      console.log('  Description:', streamer.profileDescription || 'None');

      // Enrich
      const enrichmentData = await enrichKickStreamer(streamer.username);

      if (enrichmentData) {
        console.log('\nEnriched data:');
        console.log('  Bio:', enrichmentData.bio || 'None');
        console.log('  Categories:', enrichmentData.categories);
        console.log('  Tags:', enrichmentData.tags);
        console.log('  Social Links:', Object.keys(enrichmentData.socialLinks));

        // Update database
        const existingTags = streamer.tags || [];
        const newTags = [...enrichmentData.categories, ...enrichmentData.tags];
        const mergedTags = [...new Set([...existingTags, ...newTags])];

        await db.streamer.update({
          where: { id: streamer.id },
          data: {
            profileDescription: enrichmentData.description,
            aboutSection: enrichmentData.description,
            panelTexts: enrichmentData.panelTexts,
            tags: mergedTags,
            externalLinks: enrichmentData.socialLinks,
            lastEnrichmentUpdate: new Date()
          }
        });

        console.log('\n✅ Updated successfully!');
        console.log('  New tags count:', mergedTags.length);
      } else {
        console.log('\n⚠️  No data found for this user');
      }

      // Delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n\n✅ Test completed successfully!');
    console.log('Check the database to verify the enrichment worked.');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

testEnrichment()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
