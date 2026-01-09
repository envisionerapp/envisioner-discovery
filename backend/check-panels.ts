import { db } from './src/utils/database';
import { Prisma } from '@prisma/client';

async function checkPanels() {
  const streamersWithPanels = await db.streamer.findMany({
    where: {
      panelImages: { not: Prisma.DbNull }
    },
    select: {
      username: true,
      displayName: true,
      platform: true,
      panelImages: true,
      followers: true
    },
    orderBy: { followers: 'desc' }
  });

  console.log(`\n📊 Streamers with panel images: ${streamersWithPanels.length}\n`);

  streamersWithPanels.forEach(s => {
    const panels = typeof s.panelImages === 'string' ? JSON.parse(s.panelImages) : s.panelImages;
    const panelCount = Array.isArray(panels) ? panels.length : 0;

    console.log(`✅ ${s.username} (${s.platform}) - ${panelCount} panels - ${s.followers.toLocaleString()} followers`);

    if (panelCount > 0 && Array.isArray(panels)) {
      panels.slice(0, 2).forEach((p: any, i: number) => {
        console.log(`   ${i + 1}. ${p.url}`);
      });
    }
    console.log();
  });

  await db.$disconnect();
  process.exit(0);
}

checkPanels();
