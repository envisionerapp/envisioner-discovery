import { db } from '../src/utils/database';

async function check() {
  const streamer = await db.streamer.findFirst({
    where: {
      username: { equals: 'ac7ionman', mode: 'insensitive' },
      platform: 'KICK'
    }
  });

  if (streamer) {
    console.log('Found in DB:');
    console.log('  username:', streamer.username);
    console.log('  followers:', streamer.followers);
    console.log('  socialLinks:', JSON.stringify(streamer.socialLinks));
    console.log('  profileDescription:', streamer.profileDescription);
  } else {
    console.log('Not found in DB');
  }

  // Count Kick streamers total
  const kickCount = await db.streamer.count({ where: { platform: 'KICK' } });
  console.log('\nTotal Kick streamers:', kickCount);

  // Sample some with socialLinks
  const withSocial = await db.streamer.findMany({
    where: {
      platform: 'KICK',
      NOT: { socialLinks: { equals: [] } }
    },
    take: 5
  });

  console.log('\nKick streamers with socialLinks:', withSocial.length);
  withSocial.forEach(s => {
    console.log(`  ${s.username}: ${JSON.stringify(s.socialLinks)}`);
  });

  await db.$disconnect();
}

check().catch(console.error);
