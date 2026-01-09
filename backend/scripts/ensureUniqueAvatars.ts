#!/usr/bin/env npx ts-node

import { db, logger } from '../src/utils/database';

async function ensureUniqueAvatars() {
  console.log('🔍 Ensuring all streamers have unique avatars...');
  console.log('═'.repeat(50));

  // Step 1: Find all duplicates
  const streamersWithAvatars = await db.streamer.findMany({
    where: {
      avatarUrl: { not: null }
    },
    select: {
      id: true,
      username: true,
      avatarUrl: true
    }
  });

  console.log(`📊 Total streamers with avatars: ${streamersWithAvatars.length}`);

  // Group by avatar URL to find duplicates
  const avatarGroups = new Map<string, typeof streamersWithAvatars>();
  streamersWithAvatars.forEach(streamer => {
    const url = streamer.avatarUrl!;
    if (!avatarGroups.has(url)) {
      avatarGroups.set(url, []);
    }
    avatarGroups.get(url)!.push(streamer);
  });

  // Step 2: Clear duplicates (keep first, remove others)
  let duplicatesCleared = 0;
  let duplicateGroups = 0;

  for (const [avatarUrl, streamers] of avatarGroups) {
    if (streamers.length > 1) {
      duplicateGroups++;
      const streamersToKeep = streamers.slice(0, 1); // Keep first one
      const streamersToUpdate = streamers.slice(1); // Remove others

      console.log(`\n🔄 Found ${streamers.length} streamers with duplicate avatar:`);
      console.log(`   URL: ${avatarUrl}`);
      console.log(`   Keeping: ${streamersToKeep[0].username}`);
      console.log(`   Clearing: ${streamersToUpdate.map(s => s.username).join(', ')}`);

      // Clear avatars for duplicates
      for (const streamer of streamersToUpdate) {
        await db.streamer.update({
          where: { id: streamer.id },
          data: { avatarUrl: null }
        });
        duplicatesCleared++;
        console.log(`   ✅ Cleared avatar for ${streamer.username}`);
      }
    }
  }

  // Step 3: Also clear known generic/default avatars
  const genericAvatarIds = [
    '46a38d3a-a39c-4c43-ac12-c331b1c469c2', // Most common default
    '41263278-9819-4b00-ba22-1a8e86ec656c', // Another common default
    'bf6a04cf-3f44-4986-8eed-5c36bfad542b', // Another generic avatar
    '9f431098-e65f-4983-a52c-056223a2fdf6', // Another repeated generic avatar
    '0e09ed56-067f-465a-95db-a8b8c80fdc2a', // Generic avatar
    '38d3c5b2-bfe5-4e85-a1b4-3ee7da45b8e9', // Generic avatar
  ];

  let genericCleared = 0;
  for (const avatarId of genericAvatarIds) {
    const result = await db.streamer.updateMany({
      where: {
        avatarUrl: {
          contains: avatarId
        }
      },
      data: {
        avatarUrl: null
      }
    });

    if (result.count > 0) {
      genericCleared += result.count;
      console.log(`\n🧹 Cleared ${result.count} generic avatars with ID: ${avatarId}`);
    }
  }

  // Step 4: Final summary
  const finalCount = await db.streamer.count({
    where: {
      avatarUrl: { not: null }
    }
  });

  const finalUniqueCount = await db.$queryRaw`
    SELECT COUNT(DISTINCT "avatarUrl") as count
    FROM "streamers"
    WHERE "avatarUrl" IS NOT NULL
  ` as [{ count: bigint }];

  console.log('\n📋 SUMMARY');
  console.log('═'.repeat(30));
  console.log(`Duplicate groups found: ${duplicateGroups}`);
  console.log(`Duplicates cleared: ${duplicatesCleared}`);
  console.log(`Generic avatars cleared: ${genericCleared}`);
  console.log(`Total streamers with avatars: ${finalCount}`);
  console.log(`Unique avatar URLs: ${Number(finalUniqueCount[0].count)}`);
  console.log(`Uniqueness rate: ${finalCount > 0 ? ((Number(finalUniqueCount[0].count) / finalCount) * 100).toFixed(1) : 0}%`);

  if (finalCount === Number(finalUniqueCount[0].count)) {
    console.log('\n✅ SUCCESS: All avatars are now unique!');
  } else {
    console.log('\n⚠️  Some duplicates may still exist. Run script again to check.');
  }

  await db.$disconnect();
}

if (require.main === module) {
  ensureUniqueAvatars().catch(console.error);
}