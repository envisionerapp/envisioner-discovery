import { db } from '../src/utils/database';

async function main() {
  console.log('=== LINKEDIN STATUS ===\n');

  const creators = await db.streamer.count({ where: { platform: 'LINKEDIN' } });
  console.log('LinkedIn creators in DB:', creators);

  const queue = await db.socialSyncQueue.count({ where: { platform: 'LINKEDIN' } });
  console.log('LinkedIn in sync queue:', queue);

  // Check social links for linkedin URLs
  const streamers = await db.streamer.findMany({
    where: {
      platform: { in: ['TWITCH', 'KICK', 'YOUTUBE'] },
    },
    select: { username: true, socialLinks: true }
  });

  let linkedinFound = 0;
  const examples: string[] = [];

  for (const s of streamers) {
    const links = s.socialLinks as string[] | null;
    if (links && Array.isArray(links)) {
      for (const link of links) {
        if (link?.toLowerCase().includes('linkedin')) {
          linkedinFound++;
          if (examples.length < 5) {
            examples.push(`${s.username}: ${link}`);
          }
        }
      }
    }
  }

  console.log('\nLinkedIn URLs found in socialLinks:', linkedinFound);
  if (examples.length > 0) {
    console.log('Examples:');
    for (const ex of examples) {
      console.log('  ' + ex);
    }
  }

  await db.$disconnect();
}

main().catch(console.error);
