#!/usr/bin/env node

const fs = require('fs');

// First, get streamers from local backend
async function exportLocalStreamers() {
  try {
    console.log('📥 Fetching streamers from local database...');
    const response = await fetch('http://localhost:8080/api/streamers?limit=12000');
    const data = await response.json();
    const streamers = data.data;

    console.log(`✅ Found ${streamers.length} streamers locally`);
    return streamers;
  } catch (error) {
    console.error('❌ Failed to fetch local streamers:', error.message);
    throw error;
  }
}

// Then push to production
async function pushToProduction(streamers) {
  try {
    console.log('🚀 Pushing streamers to production...');

    // We need to login first to get auth token
    const loginResponse = await fetch('https://api.miela.cc/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'abiola@miela.cc',
        password: 'Abo!la-Mielo2025'
      })
    });

    const loginData = await loginResponse.json();

    if (!loginResponse.ok || !loginData.success) {
      throw new Error(`Login failed: ${loginData.error || 'Unknown error'}`);
    }

    const token = loginData.token;
    console.log('🔐 Authenticated with production API');

    // Transform streamers to match the expected format
    const transformedStreamers = streamers.map(streamer => ({
      platform: streamer.platform,
      username: streamer.username.toLowerCase(),
      displayName: streamer.displayName,
      profileUrl: streamer.profileUrl || '',
      avatarUrl: streamer.avatarUrl,
      followers: streamer.followers || 0,
      currentViewers: streamer.currentViewers,
      highestViewers: streamer.highestViewers,
      isLive: streamer.isLive || false,
      currentGame: streamer.currentGame,
      topGames: streamer.topGames || [],
      tags: streamer.tags || ['GAMING'],
      region: streamer.region,
      language: streamer.language || 'es',
      usesCamera: false,
      isVtuber: false,
      fraudCheck: streamer.fraudCheck || 'CLEAN',
    }));

    // Send in batches to avoid payload size limits
    const batchSize = 100;
    let created = 0, updated = 0, skipped = 0;

    for (let i = 0; i < transformedStreamers.length; i += batchSize) {
      const batch = transformedStreamers.slice(i, i + batchSize);
      console.log(`📦 Sending batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(transformedStreamers.length/batchSize)} (${batch.length} streamers)`);

      const response = await fetch('https://api.miela.cc/api/admin/bulk-import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ streamers: batch })
      });

      const responseData = await response.json();

      if (responseData.success) {
        created += responseData.data.created;
        updated += responseData.data.updated;
        skipped += responseData.data.skipped;
        console.log(`✅ Batch completed: +${responseData.data.created} created, ~${responseData.data.updated} updated`);
      } else {
        console.error(`❌ Batch failed:`, responseData);
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`🎉 Production sync complete!`);
    console.log(`📊 Summary: ${created} created, ${updated} updated, ${skipped} skipped`);

    // Verify the count
    const statsResponse = await fetch('https://api.miela.cc/api/streamers/stats');
    const statsData = await statsResponse.json();
    console.log(`🔍 Production now has ${statsData.data.total} total streamers`);

  } catch (error) {
    console.error('❌ Failed to push to production:', error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Starting production sync...\n');

    const streamers = await exportLocalStreamers();
    await pushToProduction(streamers);

    console.log('\n✅ All done! Production should now have streamer data.');
  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    process.exit(1);
  }
}

main();