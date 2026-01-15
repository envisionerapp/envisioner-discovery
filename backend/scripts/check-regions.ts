import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check Dominican Republic
  const drCount = await prisma.streamer.count({
    where: { region: 'DOMINICAN_REPUBLIC' }
  });
  console.log('Dominican Republic profiles:', drCount);

  // Show some DR profiles if any
  if (drCount > 0) {
    const drProfiles = await prisma.streamer.findMany({
      where: { region: 'DOMINICAN_REPUBLIC' },
      select: { username: true, platform: true, displayName: true },
      take: 5
    });
    console.log('Sample DR profiles:');
    drProfiles.forEach(p => console.log(`  - ${p.platform}/@${p.username}: ${p.displayName}`));
  }

  // Get all region counts
  const regions = await prisma.streamer.groupBy({
    by: ['region'],
    _count: { _all: true },
    orderBy: { _count: { region: 'desc' } }
  });

  console.log('\nAll regions by count:');
  regions.forEach(r => console.log(`  ${r.region}: ${r._count._all}`));

  await prisma.$disconnect();
}

main().catch(console.error);
