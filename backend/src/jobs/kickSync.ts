import cron from 'node-cron';
import { StreamerService } from '../services/streamerService';
import { cacheStats } from '../cron/cache-stats';
import { cacheStreamers } from '../cron/cache-streamers';

const service = new StreamerService();

// Every 2 minutes 🎉
export const kickSyncJob = cron.schedule('*/3 * * * *', async () => {
  console.log('\n⏰ [CRON] Kick sync triggered');
  try {
    await service.syncKickStreamers();
    await cacheStats();
    await cacheStreamers();
  } catch (error) {
    console.error('❌ [CRON] Kick sync failed:', error);
  }
}, {
  scheduled: false
});