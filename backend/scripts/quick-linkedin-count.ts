import { db } from '../src/utils/database';

async function main() {
  const count = await db.streamer.count({ where: { platform: 'LINKEDIN' } });
  console.log('LinkedIn count:', count);

  const recent = await db.streamer.findMany({
    where: { platform: 'LINKEDIN' },
    select: { username: true, displayName: true, discoveredVia: true, followers: true },
    orderBy: { createdAt: 'desc' },
    take: 20
  });

  console.log('\nRecent LinkedIn entries:');
  recent.forEach(e => {
    console.log(`  ${e.displayName} (@${e.username}) - ${e.followers} followers - ${e.discoveredVia}`);
  });

  await db.$disconnect();
}

main().catch(console.error);
