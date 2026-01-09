const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

// Local database
const localPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

// Production database
const prodPrisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://mielo_dbms_user:UxAYpbAFawKzxltS9OBrq8UvzBQfwxu7@dpg-d33j19odl3ps738uaoi0-a.oregon-postgres.render.com/mielo_dbms"
    }
  }
});

async function syncLocalToProduction() {
  try {
    console.log('🔄 SYNCING LOCAL DATABASE TO PRODUCTION...');

    // Get all local streamers
    console.log('📦 Reading all streamers from local database...');
    const localStreamers = await localPrisma.streamer.findMany();
    console.log(`📊 Found ${localStreamers.length} streamers in local database`);

    // Clear production first (already done, but just in case)
    console.log('🗑️ Ensuring production is clean...');
    await prodPrisma.streamer.deleteMany({});
    console.log('✅ Production cleared');

    // Import all streamers in batches
    console.log('📥 Importing streamers to production...');
    const batchSize = 100;
    let imported = 0;

    for (let i = 0; i < localStreamers.length; i += batchSize) {
      const batch = localStreamers.slice(i, i + batchSize);

      // Clean the data for production (remove id, timestamps will be auto-generated)
      const cleanBatch = batch.map(streamer => ({
        platform: streamer.platform,
        username: streamer.username,
        displayName: streamer.displayName,
        profileUrl: streamer.profileUrl,
        avatarUrl: streamer.avatarUrl, // This includes all your working avatar URLs!
        followers: streamer.followers,
        currentViewers: streamer.currentViewers,
        highestViewers: streamer.highestViewers,
        lastStreamed: streamer.lastStreamed,
        isLive: streamer.isLive,
        currentGame: streamer.currentGame,
        topGames: streamer.topGames,
        tags: streamer.tags,
        region: streamer.region,
        language: streamer.language,
        socialLinks: streamer.socialLinks || [],
        usesCamera: streamer.usesCamera,
        isVtuber: streamer.isVtuber,
        fraudCheck: streamer.fraudCheck,
        notes: streamer.notes,
        lastScrapedAt: streamer.lastScrapedAt
      }));

      await prodPrisma.streamer.createMany({
        data: cleanBatch,
        skipDuplicates: false
      });

      imported += batch.length;
      console.log(`📈 Imported ${imported}/${localStreamers.length} streamers...`);
    }

    // Verify the sync
    console.log('🔍 Verifying sync...');
    const prodCount = await prodPrisma.streamer.count();
    console.log(`📊 Production now has ${prodCount} streamers`);

    // Check avatar coverage
    const prodWithAvatars = await prodPrisma.streamer.count({
      where: {
        avatarUrl: { not: null }
      }
    });
    console.log(`🖼️ Streamers with avatars: ${prodWithAvatars}`);

    if (prodCount === localStreamers.length) {
      console.log('✅ SUCCESS! Local database perfectly synced to production!');
      console.log('🎉 All your streamer data including avatar URLs are now live in production!');
    } else {
      console.log(`⚠️ Warning: Local has ${localStreamers.length} but production has ${prodCount}`);
    }

  } catch (error) {
    console.error('❌ Sync failed:', error);
  } finally {
    await localPrisma.$disconnect();
    await prodPrisma.$disconnect();
  }
}

syncLocalToProduction();