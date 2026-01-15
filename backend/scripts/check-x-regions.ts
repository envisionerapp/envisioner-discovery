import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Get X platform region counts
  const regions = await prisma.streamer.groupBy({
    by: ['region'],
    where: { platform: 'X' },
    _count: { _all: true },
    orderBy: { _count: { region: 'desc' } }
  });

  console.log('X (Twitter) profiles by region:');
  regions.forEach(r => console.log(`  ${r.region}: ${r._count._all}`));

  const total = regions.reduce((sum, r) => sum + r._count._all, 0);
  console.log('\nTotal X profiles:', total);

  // Sample some with WORLDWIDE
  const worldwide = await prisma.streamer.findMany({
    where: { platform: 'X', region: 'WORLDWIDE' },
    take: 10,
    select: { username: true, profileDescription: true }
  });

  console.log('\nSample WORLDWIDE X profiles:');
  worldwide.forEach(p => {
    const desc = p.profileDescription?.substring(0, 60) || '(no desc)';
    console.log(`  @${p.username}: ${desc}`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
