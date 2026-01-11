import cron from 'node-cron';
import { StreamerService } from '../services/streamerService';

const service = new StreamerService();

// Every 10 minutes - backfill missing avatars
export const avatarBackfillJob = cron.schedule('*/10 * * * *', async () => {
  console.log('\n🖼️ [CRON] Avatar backfill triggered');
  try {
    // Backfill 50 avatars per platform each run
    const twitchResult = await service.backfillTwitchAvatars(50);
    console.log(`🖼️ [CRON] Twitch avatars: ${twitchResult.updated} updated, ${twitchResult.errors} errors`);

    const youtubeResult = await service.backfillYouTubeAvatars(50);
    console.log(`🖼️ [CRON] YouTube avatars: ${youtubeResult.updated} updated, ${youtubeResult.errors} errors`);

    const kickResult = await service.backfillKickAvatars(50);
    console.log(`🖼️ [CRON] Kick avatars: ${kickResult.updated} updated, ${kickResult.errors} errors`);

    const total = twitchResult.updated + youtubeResult.updated + kickResult.updated;
    console.log(`🖼️ [CRON] Avatar backfill complete: ${total} total updated`);
  } catch (error) {
    console.error('❌ [CRON] Avatar backfill failed:', error);
  }
}, {
  scheduled: false
});
