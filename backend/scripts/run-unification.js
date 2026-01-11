require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();

async function run() {
  console.log('🔗 Starting chunked influencer unification...\n');

  // Get all base streamers
  const baseStreamers = await db.streamer.findMany({
    where: { platform: { in: ['TWITCH', 'YOUTUBE', 'KICK'] } },
    orderBy: { followers: 'desc' },
  });

  console.log(`📊 Found ${baseStreamers.length} base streamers\n`);

  // Process in small chunks of 50
  const CHUNK_SIZE = 50;
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < baseStreamers.length; i += CHUNK_SIZE) {
    const chunk = baseStreamers.slice(i, i + CHUNK_SIZE);

    for (const streamer of chunk) {
      try {
        // Check if influencer already exists for this streamer
        let existing = null;
        if (streamer.platform === 'TWITCH') {
          existing = await db.influencer.findFirst({ where: { twitchId: streamer.id } });
        } else if (streamer.platform === 'YOUTUBE') {
          existing = await db.influencer.findFirst({ where: { youtubeId: streamer.id } });
        } else if (streamer.platform === 'KICK') {
          existing = await db.influencer.findFirst({ where: { kickId: streamer.id } });
        }

        if (existing) {
          skipped++;
          continue;
        }

        // Build platform data
        const platformData = {};
        if (streamer.platform === 'TWITCH') {
          platformData.twitchId = streamer.id;
          platformData.twitchUsername = streamer.username;
          platformData.twitchDisplayName = streamer.displayName;
          platformData.twitchFollowers = streamer.followers;
          platformData.twitchAvatar = streamer.avatarUrl;
          platformData.twitchUrl = streamer.profileUrl;
        } else if (streamer.platform === 'YOUTUBE') {
          platformData.youtubeId = streamer.id;
          platformData.youtubeUsername = streamer.username;
          platformData.youtubeDisplayName = streamer.displayName;
          platformData.youtubeFollowers = streamer.followers;
          platformData.youtubeAvatar = streamer.avatarUrl;
          platformData.youtubeUrl = streamer.profileUrl;
        } else if (streamer.platform === 'KICK') {
          platformData.kickId = streamer.id;
          platformData.kickUsername = streamer.username;
          platformData.kickDisplayName = streamer.displayName;
          platformData.kickFollowers = streamer.followers;
          platformData.kickAvatar = streamer.avatarUrl;
          platformData.kickUrl = streamer.profileUrl;
        }

        await db.influencer.create({
          data: {
            displayName: streamer.displayName,
            country: null,
            language: streamer.language,
            primaryCategory: streamer.primaryCategory,
            tags: streamer.tags || [],
            sourceStreamerIds: [streamer.id],
            totalReach: BigInt(streamer.followers),
            platformCount: 1,
            lastVerifiedAt: new Date(),
            ...platformData,
          }
        });

        created++;
      } catch (err) {
        errors++;
      }
    }

    console.log(`✅ ${Math.min(i + CHUNK_SIZE, baseStreamers.length)}/${baseStreamers.length} | +${created} new, ${skipped} exist, ${errors} err`);
  }

  console.log(`\n🎉 Done! Created: ${created}, Already existed: ${skipped}, Errors: ${errors}`);

  const total = await db.influencer.count();
  console.log(`📊 Total influencers in table: ${total}`);

  await db.$disconnect();
}

run().catch(console.error);
