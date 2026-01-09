import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '.env') });

import { liveStatusService } from './src/services/liveStatusService';

// Test with known live 24/7 channels
const TEST_CHANNELS = [
  { name: 'Lofi Girl', id: 'UCSJ4gkVC6NrvII8umztf0Ow' },
  { name: 'NASA', id: 'UCLA_DiR1FfKNvjuUpBHmylQ' },
  { name: 'ChilledCow', id: 'UCsIg9WMfxjZZvwROleiVsQg' },
];

async function testYouTubeAPI() {
  console.log('🧪 Testing YouTube Data API v3 Integration\n');
  console.log(`API Key configured: ${process.env.YOUTUBE_API_KEY ? '✅ Yes' : '❌ No'}\n`);

  for (const channel of TEST_CHANNELS) {
    console.log(`\n━━━ ${channel.name} (${channel.id}) ━━━`);

    try {
      const result = await liveStatusService.checkYouTubeLiveStatus(channel.id);

      if (result.isLive) {
        console.log('🔴 Status: LIVE');
        console.log(`👥 Viewers: ${result.viewers?.toLocaleString() || 'N/A'}`);
        console.log(`📺 Title: ${result.title || 'N/A'}`);
        console.log(`⏰ Started: ${result.startedAt?.toISOString() || 'N/A'}`);

        // Validate the data
        if (result.viewers && result.viewers > 0 && result.viewers < 10000000) {
          console.log('✅ Viewer count looks accurate');
        } else if (result.viewers && result.viewers > 10000000) {
          console.log('⚠️  WARNING: Viewer count seems inflated!');
        }

        if (result.startedAt && !isNaN(result.startedAt.getTime())) {
          const age = Date.now() - result.startedAt.getTime();
          const hours = Math.floor(age / (1000 * 60 * 60));
          console.log(`✅ Stream age: ${hours} hours`);
        }
      } else {
        console.log('⚪ Status: NOT LIVE');
      }
    } catch (error: any) {
      console.error('❌ Error:', error.message);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Test Complete');
}

testYouTubeAPI().then(() => process.exit(0)).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
