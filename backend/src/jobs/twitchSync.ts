import cron from 'node-cron';
import { StreamerService } from '../services/streamerService';
import { cacheStats } from '../cron/cache-stats';
import { cacheStreamers } from '../cron/cache-streamers';

const service = new StreamerService();

// Every 2 minutes
export const twitchSyncJob = cron.schedule('*/3 * * * *', async () => {
  console.log('\n⏰ [CRON] Twitch sync triggered');
  try {
    await service.syncTwitchStreamers();
    await cacheStats();
    await cacheStreamers(); 
  } catch (error) {
    console.error('❌ [CRON] Twitch sync failed:', error);
  }
}, {
  scheduled: false
});