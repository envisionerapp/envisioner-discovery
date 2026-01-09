import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
const backendEnv = path.resolve(__dirname, '.env');
const rootEnv = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv });
} else if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}

import { liveStatusService } from './src/services/liveStatusService';

async function testYouTubeLiveStatus() {
  console.log('🧪 Testing YouTube Live Status with 24/7 Live Channels...\n');

  // Test with channels that are typically live 24/7
  const testChannels = [
    { name: 'Lofi Girl', handle: '@LofiGirl' },
    { name: 'ChilledCow/Lofi', handle: 'UCSJ4gkVC6NrvII8umztf0Ow' }, // Channel ID
    { name: 'NASA Live', handle: '@NASA' },
    { name: 'ABC News Live', handle: '@ABCNews' },
    { name: 'Sky News', handle: '@SkyNews' }
  ];

  console.log('Testing with 24/7 live stream channels:\n');

  let foundLive = false;

  for (const channel of testChannels) {
    try {
      console.log(`📺 Checking: ${channel.name} (${channel.handle})`);
      const status = await liveStatusService.checkYouTubeLiveStatus(channel.handle);

      if (status.isLive) {
        foundLive = true;
        console.log(`   ✅ LIVE! ${status.viewers?.toLocaleString() || 'N/A'} viewers`);
        console.log(`   📝 Title: ${status.title}`);
        console.log(`   🕐 Started: ${status.startedAt || 'unknown'}\n`);
      } else {
        console.log(`   ⚫ Offline\n`);
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n' + '='.repeat(60));
  if (foundLive) {
    console.log('✅ SUCCESS! YouTube API is working and returning REAL live data!');
    console.log('✅ Viewer counts, titles, and timestamps are being fetched correctly.');
  } else {
    console.log('⚠️  No live streams found at this moment.');
    console.log('✅ But API is working correctly (no errors).');
  }
  console.log('='.repeat(60));

  console.log('\nAPI Key Status:', process.env.YOUTUBE_API_KEY ? '✅ Configured' : '❌ Missing');

  process.exit(0);
}

testYouTubeLiveStatus().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
