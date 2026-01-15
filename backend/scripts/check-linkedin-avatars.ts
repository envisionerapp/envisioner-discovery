/**
 * Check LinkedIn avatar status and identify placeholders
 */

import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

async function checkAvatarSize(url: string): Promise<number> {
  try {
    const baseUrl = url.split('?')[0];
    const response = await axios.head(baseUrl, { timeout: 5000 });
    return parseInt(response.headers['content-length'] || '0');
  } catch {
    return 0;
  }
}

async function main() {
  console.log('===========================================');
  console.log('   LINKEDIN AVATAR CHECK');
  console.log('===========================================\n');

  const profiles = await prisma.streamer.findMany({
    where: { platform: 'LINKEDIN' },
    select: { id: true, username: true, displayName: true, avatarUrl: true, followers: true },
    orderBy: { followers: 'desc' }
  });

  console.log(`Checking ${profiles.length} LinkedIn profiles...\n`);

  let good = 0;
  let placeholder = 0;
  let missing = 0;
  const placeholderProfiles: { username: string; displayName: string | null; followers: number | null }[] = [];

  for (let i = 0; i < profiles.length; i++) {
    const p = profiles[i];

    if (!p.avatarUrl) {
      missing++;
      placeholderProfiles.push({ username: p.username, displayName: p.displayName, followers: p.followers });
      continue;
    }

    const size = await checkAvatarSize(p.avatarUrl);

    if (size > 1000) {
      good++;
    } else {
      placeholder++;
      placeholderProfiles.push({ username: p.username, displayName: p.displayName, followers: p.followers });
    }

    // Progress every 50
    if ((i + 1) % 50 === 0) {
      console.log(`Progress: ${i + 1}/${profiles.length} - Good: ${good}, Placeholder: ${placeholder}, Missing: ${missing}`);
    }
  }

  console.log('\n===========================================');
  console.log('   RESULTS');
  console.log('===========================================');
  console.log(`Total profiles: ${profiles.length}`);
  console.log(`Good avatars (>1KB): ${good}`);
  console.log(`Placeholder/broken: ${placeholder}`);
  console.log(`Missing: ${missing}`);
  console.log(`Need fixing: ${placeholderProfiles.length}`);

  console.log('\n=== PROFILES NEEDING AVATAR FIX ===');
  placeholderProfiles.slice(0, 50).forEach((p, i) => {
    console.log(`${i + 1}. ${p.displayName || p.username} (@${p.username}) - ${(p.followers || 0).toLocaleString()} followers`);
  });

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
