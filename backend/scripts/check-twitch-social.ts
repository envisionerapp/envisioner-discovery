import { db } from '../src/utils/database';

async function check() {
  const twitchWithSocial = await db.streamer.count({
    where: {
      platform: 'TWITCH',
      NOT: { socialLinks: { equals: [] } }
    }
  });
  const totalTwitch = await db.streamer.count({ where: { platform: 'TWITCH' } });
  console.log('Twitch streamers with social links:', twitchWithSocial, '/', totalTwitch);
  console.log('Success rate:', ((twitchWithSocial / totalTwitch) * 100).toFixed(1) + '%');

  // Sample some
  const samples = await db.streamer.findMany({
    where: {
      platform: 'TWITCH',
      NOT: { socialLinks: { equals: [] } }
    },
    take: 5,
    select: { username: true, socialLinks: true }
  });

  console.log('\nSamples:');
  samples.forEach(s => console.log(s.username + ':', JSON.stringify(s.socialLinks)));

  await db.$disconnect();
}

check().catch(console.error);
