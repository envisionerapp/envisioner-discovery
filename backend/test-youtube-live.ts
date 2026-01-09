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
  console.log('🧪 Testing YouTube Live Status Service...\n');

  // Test with known large gaming YouTubers that frequently stream
  const testChannels = [
    { name: 'MrBeast Gaming', handle: '@MrBeastGaming' },
    { name: 'Ibai', handle: '@ibai' },
    { name: 'ElRubius', handle: '@elrubius' },
    { name: 'AuronPlay', handle: '@auronplay' },
    { name: 'TheGrefg', handle: '@TheGrefg' }
  ];

  console.log('Testing with popular gaming/streaming channels:\n');

  for (const channel of testChannels) {
    try {
      console.log(`📺 Checking: ${channel.name} (${channel.handle})`);
      const status = await liveStatusService.checkYouTubeLiveStatus(channel.handle);

      if (status.isLive) {
        console.log(`   ✅ LIVE! ${status.viewers || 0} viewers`);
        console.log(`   📝 Title: ${status.title}`);
        console.log(`   🕐 Started: ${status.startedAt || 'unknown'}\n`);
      } else {
        console.log(`   ⚫ Offline\n`);
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n✅ YouTube API test complete!');
  console.log('\nAPI Key Status:', process.env.YOUTUBE_API_KEY ? '✅ Configured' : '❌ Missing');

  process.exit(0);
}

testYouTubeLiveStatus().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
