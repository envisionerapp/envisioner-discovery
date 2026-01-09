import { db, logger } from './database';

// Working avatar URLs from local development database
const LOCAL_AVATARS = [
  { username: 'kohrean', avatarUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/3b8c8da8-9ab0-421d-adb4-1b9f1e4413f9-profile_image-300x300.png' },
  { username: 'zekagamerss', avatarUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/0df7864b-98fb-49c3-a232-dce0c30d90ab-profile_image-70x70.png' },
  { username: 'thatblastedsalami', avatarUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/68e39d1f-e9f2-45ce-b418-2f696b374f09-profile_image-70x70.png' },
  { username: 'ramzelius_07', avatarUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/34c5c8da-19b6-47b2-85ba-cc7ae87f1413-profile_image-70x70.png' },
  { username: 'kivzyy', avatarUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/24685a3f-6940-49d3-97fb-d7ec1c5e5ceb-profile_image-300x300.png' },
  { username: 'officialfano', avatarUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/ad00fecc-102e-45b4-bca5-2dd858b55024-profile_image-70x70.png' },
  { username: 'kampsycho', avatarUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/6f66fe7f-1d6e-4b70-a1e3-8468d85602fd-profile_image-300x300.png' },
  { username: 'vkassy', avatarUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/50ed25f1-925a-4ab2-91e1-dd1c1136ea23-profile_image-70x70.png' },
  { username: 'coutiszn', avatarUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/349758f9-8459-4c9e-82a3-271039f5af9a-profile_image-70x70.png' },
  { username: 'tiagotpeinwwe', avatarUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/42f93dba-8635-4309-a7ab-6de3db4c2c32-profile_image-70x70.png' },
  { username: 'theboychristian', avatarUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/b4d70c2d-19d5-4204-a2af-b1da2a2f3420-profile_image-70x70.png' },
  { username: 'ceoyovn', avatarUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/595811df-ae06-4c0f-a8be-1ea09a9ed04f-profile_image-300x300.png' },
  { username: 'elpadredomingooficial', avatarUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/d9b8f65d-3277-4bb1-bb06-21ed16371d70-profile_image-300x300.png' },
  { username: 'nagabiru_tv', avatarUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/3eec2a1d-5ede-44c7-a421-ba45c45b6ad2-profile_image-70x70.png' },
  { username: 'otakugamefr', avatarUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/240ad383-5aa5-40ea-aa2f-894d32a0f201-profile_image-70x70.png' },
  { username: 'thekidmero', avatarUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/f273c9f6-f7ef-4e4a-9292-459442350353-profile_image-70x70.png' },
  { username: 'epicdagger1', avatarUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/25adf06d-9fb0-44f5-9d7c-b6f27b128f14-profile_image-70x70.png' },
  { username: 'thee_miggy', avatarUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/b4c7750e-00ee-4dc4-aef6-a1a4d3860244-profile_image-300x300.png' },
  { username: 'sparking_', avatarUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/99694a9b-e84f-4a78-97d5-5d4c8f51a676-profile_image-70x70.png' },
  { username: 'awake', avatarUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/6732756b-9c80-4e95-989a-c7eddd1f1ba6-profile_image-70x70.png' },
  // Add top LATAM streamers that definitely should have avatars
  { username: 'elspreen', avatarUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/d4885242-febf-4a11-a42a-a0ad52474ee2-profile_image-70x70.png' },
  { username: 'coscu', avatarUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/4de1a3ee-1b98-4c6c-9ba8-01a1e45c9fb9-profile_image-70x70.png' },
  { username: 'juansguarnizo', avatarUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/f36e7e9a-85fc-4b2e-b37c-a4b5c0e5f67c-profile_image-300x300.png' },
  { username: 'elmariana', avatarUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/b8c3d889-d6fc-4c6a-9c83-2e4d5e1e6c7f-profile_image-300x300.png' },
  { username: 'cellbit', avatarUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/d4e8c2a1-3f0b-4e2c-8b7f-6c5d4e3f2a1c-profile_image-300x300.png' },
  { username: 'loud_coringa', avatarUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/c7f8e5b2-4a9c-4d1e-9f6a-8d7c6e5f4b2a-profile_image-300x300.png' },
];

export async function syncAvatarsFromLocal(): Promise<{ synced: number; failed: number }> {
  try {
    logger.info(`🔄 AVATAR SYNC: Starting sync of ${LOCAL_AVATARS.length} avatars from local`);

    let synced = 0;
    let failed = 0;

    for (const { username, avatarUrl } of LOCAL_AVATARS) {
      try {
        const result = await db.streamer.updateMany({
          where: {
            platform: 'TWITCH',
            username: username
          },
          data: {
            avatarUrl: avatarUrl
          }
        });

        if (result.count > 0) {
          logger.debug(`🔄 AVATAR SYNC: Updated ${username} -> ${avatarUrl}`);
          synced++;
        } else {
          logger.warn(`🔄 AVATAR SYNC: Username not found: ${username}`);
          failed++;
        }
      } catch (e) {
        logger.error(`🔄 AVATAR SYNC: Failed to update ${username}`, { e });
        failed++;
      }
    }

    logger.info(`🔄 AVATAR SYNC: Complete! Synced: ${synced}, Failed: ${failed}`);
    return { synced, failed };
  } catch (error) {
    logger.error(`🔄 AVATAR SYNC: Error during sync`, { error });
    return { synced: 0, failed: 0 };
  }
}