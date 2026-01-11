import cron from 'node-cron';
import { influencerSyncService } from '../services/influencerSyncService';

// Every 5 minutes - sync new influencers to discovery
export const influencerSyncJob = cron.schedule('*/5 * * * *', async () => {
  console.log('\n🔄 [CRON] Influencer sync triggered');
  try {
    const result = await influencerSyncService.syncInfluencersToDiscovery();
    console.log(`🔄 [CRON] Influencer sync: ${result.synced} synced, ${result.skipped} skipped, ${result.errors} errors`);
  } catch (error) {
    console.error('❌ [CRON] Influencer sync failed:', error);
  }
}, {
  scheduled: false
});
