/**
 * BULK AVATAR MIGRATION SCRIPT
 * Migrates all non-Bunny avatars to Bunny CDN
 * Processes 100 profiles at a time with parallel uploads
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const db = new PrismaClient();

const BATCH_SIZE = 50;
const PARALLEL_UPLOADS = 5;
const DELAY_BETWEEN_BATCHES = 2000;

let stats = {
  processed: 0,
  success: 0,
  failed: 0,
  skipped: 0,
  startTime: Date.now()
};

async function uploadToBunny(imageUrl, platform, username) {
  try {
    if (!imageUrl || imageUrl.includes('media.envr.io')) return imageUrl;

    const imageRes = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const buffer = Buffer.from(imageRes.data);

    const ext = imageUrl.includes('.png') ? 'png' : 'jpg';
    const filename = `avatars/${platform.toLowerCase()}/${username.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.${ext}`;
    const uploadUrl = `https://${process.env.BUNNY_STORAGE_REGION}.storage.bunnycdn.com/${process.env.BUNNY_STORAGE_ZONE}/${filename}`;

    await axios.put(uploadUrl, buffer, {
      headers: {
        'AccessKey': process.env.BUNNY_STORAGE_API_KEY,
        'Content-Type': `image/${ext}`
      },
      timeout: 30000
    });

    return `https://${process.env.BUNNY_CDN_HOSTNAME}/${filename}`;
  } catch (error) {
    return null;
  }
}

async function processProfile(profile) {
  stats.processed++;

  try {
    const newUrl = await uploadToBunny(profile.avatarUrl, profile.platform, profile.username);

    if (newUrl && newUrl.includes('media.envr.io')) {
      await db.streamer.update({
        where: { id: profile.id },
        data: { avatarUrl: newUrl, lastScrapedAt: new Date() }
      });
      stats.success++;
      return true;
    } else {
      stats.skipped++;
      return false;
    }
  } catch (e) {
    stats.failed++;
    return false;
  }
}

async function processBatch(profiles) {
  // Process in parallel (PARALLEL_UPLOADS at a time)
  for (let i = 0; i < profiles.length; i += PARALLEL_UPLOADS) {
    const chunk = profiles.slice(i, i + PARALLEL_UPLOADS);
    await Promise.all(chunk.map(p => processProfile(p)));
  }
}

function printProgress() {
  const elapsed = (Date.now() - stats.startTime) / 1000;
  const rate = stats.processed / elapsed;
  console.log(`Progress: ${stats.processed} processed | ${stats.success} success | ${stats.failed} failed | ${stats.skipped} skipped | ${rate.toFixed(1)}/sec`);
}

async function main() {
  console.log('=== BULK AVATAR MIGRATION ===\n');

  // Get total count
  const totalStale = await db.streamer.count({
    where: {
      avatarUrl: { not: null },
      NOT: { avatarUrl: { contains: 'media.envr.io' } }
    }
  });

  console.log(`Total stale avatars: ${totalStale}`);
  console.log(`Batch size: ${BATCH_SIZE}, Parallel: ${PARALLEL_UPLOADS}\n`);

  let offset = 0;

  while (true) {
    // Get next batch
    const profiles = await db.streamer.findMany({
      where: {
        avatarUrl: { not: null },
        NOT: { avatarUrl: { contains: 'media.envr.io' } }
      },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE
    });

    if (profiles.length === 0) break;

    await processBatch(profiles);
    printProgress();

    await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES));
    offset += profiles.length;
  }

  console.log('\n=== MIGRATION COMPLETE ===');
  console.log(`Total processed: ${stats.processed}`);
  console.log(`Success: ${stats.success}`);
  console.log(`Failed: ${stats.failed}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Duration: ${((Date.now() - stats.startTime) / 1000 / 60).toFixed(1)} minutes`);

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error('Fatal error:', e);
  await db.$disconnect();
  process.exit(1);
});
