#!/usr/bin/env ts-node
/**
 * Sync enriched tags from local database to production
 */

import { PrismaClient } from '@prisma/client';

const LOCAL_DB = 'postgresql://bheelz@localhost:5432/mielo';
const PROD_DB = 'postgresql://mielo_dbms_user:UxAYpbAFawKzxltS9OBrq8UvzBQfwxu7@dpg-d33j19odl3ps738uaoi0-a.oregon-postgres.render.com/mielo_dbms';

const localDb = new PrismaClient({
  datasources: { db: { url: LOCAL_DB } }
});

const prodDb = new PrismaClient({
  datasources: { db: { url: PROD_DB } }
});

async function syncTags() {
  try {
    console.log('🔄 Fetching streamers with enriched tags from local...');

    // Get all streamers with tags from local
    const localStreamers = await localDb.streamer.findMany({
      where: {
        tags: { isEmpty: false }
      },
      select: {
        username: true,
        tags: true
      }
    });

    console.log(`📤 Found ${localStreamers.length} streamers with tags in local database`);

    let updatedCount = 0;
    let errorCount = 0;
    const batchSize = 100;

    // Update in batches
    for (let i = 0; i < localStreamers.length; i += batchSize) {
      const batch = localStreamers.slice(i, i + batchSize);

      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(localStreamers.length / batchSize)}...`);

      await Promise.all(
        batch.map(async (streamer) => {
          try {
            await prodDb.streamer.updateMany({
              where: { username: streamer.username },
              data: { tags: streamer.tags }
            });
            updatedCount++;
          } catch (error) {
            console.error(`Failed to update ${streamer.username}:`, error);
            errorCount++;
          }
        })
      );
    }

    console.log('\n✅ Tag sync complete!');
    console.log(`   Updated: ${updatedCount} streamers`);
    console.log(`   Errors: ${errorCount}`);

    // Verify sync
    const prodStats = await prodDb.streamer.findMany({
      where: {
        tags: { isEmpty: false }
      },
      select: {
        username: true,
        tags: true
      },
      take: 5
    });

    console.log('\n📊 Sample of synced tags in production:');
    prodStats.forEach(s => {
      console.log(`   ${s.username}: [${s.tags.join(', ')}]`);
    });

  } catch (error) {
    console.error('❌ Tag sync failed:', error);
    process.exit(1);
  } finally {
    await localDb.$disconnect();
    await prodDb.$disconnect();
  }
}

syncTags();
