import { db, logger } from './database';

// This will completely replace production streamers with local data
export async function replaceAllStreamersWithLocal(): Promise<{ replaced: number }> {
  try {
    logger.info('🔄 FULL SYNC: Starting complete replacement of production data with local');

    // Clear all existing streamers
    await db.streamer.deleteMany({});
    logger.info('🔄 FULL SYNC: Cleared all existing streamers');

    // Get all local streamers data (hardcoded from your export)
    const localStreamers = await getLocalStreamersData();

    logger.info(`🔄 FULL SYNC: Importing ${localStreamers.length} streamers from local`);

    // Insert all streamers in batches
    const batchSize = 100;
    let imported = 0;

    for (let i = 0; i < localStreamers.length; i += batchSize) {
      const batch = localStreamers.slice(i, i + batchSize);

      await db.streamer.createMany({
        data: batch,
        skipDuplicates: true
      });

      imported += batch.length;

      if (imported % 1000 === 0) {
        logger.info(`🔄 FULL SYNC: Imported ${imported}/${localStreamers.length} streamers`);
      }
    }

    logger.info(`🔄 FULL SYNC: Complete! Imported ${imported} streamers`);
    return { replaced: imported };

  } catch (error) {
    logger.error('🔄 FULL SYNC: Error during full sync', { error });
    throw error;
  }
}

// Load the exported local streamers data
async function getLocalStreamersData() {
  const fs = require('fs');
  const path = require('path');

  try {
    // Try to read from the exported JSON file
    const dataPath = '/tmp/all_local_streamers.json';
    if (fs.existsSync(dataPath)) {
      const rawData = fs.readFileSync(dataPath, 'utf8');
      const streamers = JSON.parse(rawData);

      // Transform the data to match Prisma's expected format (remove id and timestamps)
      return streamers.map((streamer: any) => ({
        platform: streamer.platform,
        username: streamer.username,
        displayName: streamer.displayName,
        profileUrl: streamer.profileUrl,
        avatarUrl: streamer.avatarUrl,
        followers: streamer.followers,
        currentViewers: streamer.currentViewers,
        highestViewers: streamer.highestViewers,
        lastStreamed: streamer.lastStreamed ? new Date(streamer.lastStreamed) : null,
        isLive: streamer.isLive,
        currentGame: streamer.currentGame,
        topGames: streamer.topGames,
        tags: streamer.tags,
        region: streamer.region,
        language: streamer.language,
        socialLinks: streamer.socialLinks,
        usesCamera: streamer.usesCamera,
        isVtuber: streamer.isVtuber,
        fraudCheck: streamer.fraudCheck,
        notes: streamer.notes,
        lastScrapedAt: streamer.lastScrapedAt ? new Date(streamer.lastScrapedAt) : null
      }));
    }

    logger.error('🔄 FULL SYNC: Local streamers data file not found at /tmp/all_local_streamers.json');
    return [];
  } catch (error) {
    logger.error('🔄 FULL SYNC: Error loading local streamers data', { error });
    return [];
  }
}