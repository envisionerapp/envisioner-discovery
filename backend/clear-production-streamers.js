const fetch = require('node-fetch');

const PRODUCTION_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImNtZmthdzhndTAwMDAyNnh1OHQ0bW0ya2oiLCJlbWFpbCI6ImFiaW9sYUBtaWVsYWRpZ2l0YWwuY29tIiwiaWF0IjoxNzU4MTkwMDkwLCJleHAiOjE3NTg3OTQ4OTB9._GGX0rxr7jRtBjREma1aSKRILNJD0prOhehnhOaD5rQ";

async function clearAllProductionStreamers() {
  try {
    console.log('🗑️ CLEARING ALL PRODUCTION STREAMERS...');

    // Get total count first
    console.log('📊 Checking current production database...');
    const statsResponse = await fetch('https://api.miela.cc/api/streamers/stats', {
      headers: { 'Authorization': `Bearer ${PRODUCTION_TOKEN}` }
    });

    if (!statsResponse.ok) {
      throw new Error(`Failed to get stats: ${statsResponse.status}`);
    }

    const stats = await statsResponse.json();
    const totalStreamers = stats.data.total;
    console.log(`📊 Found ${totalStreamers} streamers to delete`);

    if (totalStreamers === 0) {
      console.log('✅ Production database is already empty!');
      return;
    }

    // Since there's no bulk delete endpoint, we'll delete in batches by fetching IDs
    let deleted = 0;
    let page = 1;
    const limit = 100;

    while (deleted < totalStreamers) {
      console.log(`🔄 Processing batch ${page} (deleted: ${deleted}/${totalStreamers})`);

      // Get batch of streamers
      const streamersResponse = await fetch(`https://api.miela.cc/api/streamers?page=${page}&limit=${limit}`, {
        headers: { 'Authorization': `Bearer ${PRODUCTION_TOKEN}` }
      });

      if (!streamersResponse.ok) {
        throw new Error(`Failed to get streamers: ${streamersResponse.status}`);
      }

      const streamersData = await streamersResponse.json();
      const streamers = streamersData.data;

      if (!streamers || streamers.length === 0) {
        console.log('✅ No more streamers found');
        break;
      }

      // Delete each streamer individually (since there's no bulk delete)
      for (const streamer of streamers) {
        try {
          const deleteResponse = await fetch(`https://api.miela.cc/api/streamers/${streamer.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${PRODUCTION_TOKEN}` }
          });

          if (deleteResponse.ok) {
            deleted++;
            if (deleted % 50 === 0) {
              console.log(`🗑️ Deleted ${deleted}/${totalStreamers} streamers...`);
            }
          } else {
            console.warn(`⚠️ Failed to delete streamer ${streamer.username}: ${deleteResponse.status}`);
          }
        } catch (e) {
          console.warn(`⚠️ Error deleting streamer ${streamer.username}:`, e.message);
        }

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      page++;
    }

    // Verify deletion
    console.log('🔍 Verifying deletion...');
    const finalStatsResponse = await fetch('https://api.miela.cc/api/streamers/stats', {
      headers: { 'Authorization': `Bearer ${PRODUCTION_TOKEN}` }
    });

    if (finalStatsResponse.ok) {
      const finalStats = await finalStatsResponse.json();
      const remainingStreamers = finalStats.data.total;
      console.log(`📊 Final count: ${remainingStreamers} streamers remaining`);

      if (remainingStreamers === 0) {
        console.log('✅ SUCCESS! All production streamers have been cleared!');
      } else {
        console.log(`⚠️ ${remainingStreamers} streamers still remain`);
      }
    }

  } catch (error) {
    console.error('❌ Error clearing production streamers:', error.message);
  }
}

clearAllProductionStreamers();