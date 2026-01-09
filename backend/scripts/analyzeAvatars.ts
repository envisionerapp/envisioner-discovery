#!/usr/bin/env npx ts-node

import { db } from '../src/utils/database';

async function analyzeAvatars() {
  const streamers = await db.streamer.findMany({
    where: {
      avatarUrl: { not: null }
    },
    select: {
      username: true,
      platform: true,
      avatarUrl: true
    }
  });

  console.log('=== Avatar Analysis ===');
  console.log(`Total streamers with avatars: ${streamers.length}`);

  // Group by avatar URL to find duplicates
  const avatarGroups = new Map<string, string[]>();
  streamers.forEach(s => {
    const url = s.avatarUrl!;
    if (!avatarGroups.has(url)) {
      avatarGroups.set(url, []);
    }
    avatarGroups.get(url)!.push(s.username);
  });

  console.log(`\nUnique avatar URLs: ${avatarGroups.size}`);

  // Show duplicates
  console.log('\n=== Duplicate Analysis ===');
  let duplicateCount = 0;
  let duplicateUsers = 0;
  avatarGroups.forEach((usernames, url) => {
    if (usernames.length > 1) {
      duplicateCount++;
      duplicateUsers += usernames.length;
      console.log(`\nURL: ${url}`);
      console.log(`Users (${usernames.length}): ${usernames.join(', ')}`);
    }
  });

  console.log(`\nDuplicate URLs: ${duplicateCount}`);
  console.log(`Users with duplicate avatars: ${duplicateUsers}`);

  // Show unique avatars
  console.log('\n=== Unique Avatars ===');
  let uniqueCount = 0;
  avatarGroups.forEach((usernames, url) => {
    if (usernames.length === 1) {
      uniqueCount++;
      console.log(`${usernames[0]}: ${url}`);
    }
  });

  console.log(`\nUnique avatars: ${uniqueCount}`);
  console.log(`Success rate: ${((uniqueCount / streamers.length) * 100).toFixed(1)}%`);

  await db.$disconnect();
}

analyzeAvatars().catch(console.error);