import { db } from '../utils/database';
import { processBatch } from '../utils/rateLimiter';
import axios from 'axios';

interface StreamerData {
  id: string;
  username: string;
  platform: string;
  profileUrl?: string;
  highestViewers: number | null;
  streamTitles: any;
}

interface StreamStatus {
  isLive: boolean;
  viewers?: number;
  title?: string;
  game?: string;
  startedAt?: Date;
}

export class StreamerService {
  private twitchToken: string | null = null;
  private twitchTokenExpiry: number = 0;
  
  private kickToken: string | null = null;
  private kickTokenExpiry: number = 0;

  // ==================== TWITCH ====================
  
  private async getTwitchToken(): Promise<string|null> {
    const now = Date.now();
    
    if (this.twitchToken && this.twitchTokenExpiry > now) {
      return this.twitchToken;
    }

    try {
      const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
        params: {
          client_id: process.env.TWITCH_CLIENT_ID,
          client_secret: process.env.TWITCH_CLIENT_SECRET,
          grant_type: 'client_credentials'
        }
      });

      this.twitchToken = response.data.access_token;
      this.twitchTokenExpiry = now + (response.data.expires_in * 1000) - 60000;
      
      console.log('✅ Twitch token refreshed');
      return this.twitchToken;
    } catch (error) {
      console.error('❌ Failed to get Twitch token:', error);
      throw error;
    }
  }

  async syncTwitchStreamers(): Promise<{
    total: number;
    live: number;
    errors: number;
    duration: number;
  }> {
    const startTime = Date.now();
    console.log('🟣 [TWITCH] Starting sync...');

    try {
      const streamers = await db.streamer.findMany({
        where: { platform: 'TWITCH' },
        select: {
          id: true,
          username: true,
          platform: true,
          profileUrl: true,
          highestViewers: true,
          streamTitles: true
        }
      });

      console.log(`📊 [TWITCH] Found ${streamers.length} streamers`);

      const token = await this.getTwitchToken();
      let liveCount = 0;
      let errors = 0;

      const BATCH_SIZE = 100;
      const batches = Math.ceil(streamers.length / BATCH_SIZE);

      for (let i = 0; i < batches; i++) {
        const batch = streamers.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        const usernames = batch.map(s => s.username);

        try {
          const response = await axios.get('https://api.twitch.tv/helix/streams', {
            headers: {
              'Client-ID': process.env.TWITCH_CLIENT_ID!,
              'Authorization': `Bearer ${token}`
            },
            params: {
              user_login: usernames
            }
          });

          const liveStreams = response.data.data;
          const liveMap = new Map(
            liveStreams.map((stream: any) => [
              stream.user_login.toLowerCase(),
              stream
            ])
          );

          const updates = batch.map(streamer => {
            const liveData:any = liveMap.get(streamer.username.toLowerCase());
            const status: StreamStatus = liveData ? {
              isLive: true,
              viewers: liveData.viewer_count,
              title: liveData.title,
              game: liveData.game_name,
              startedAt: new Date(liveData.started_at)
            } : {
              isLive: false,
              viewers: 0
            };

            if (status.isLive) liveCount++;

            return this.buildUpdateData(streamer, status);
          });

          await processBatch(
            updates,
            async (update:any) => {
              try {
                await db.streamer.update({
                  where: { id: update.id },
                  data: update.data
                });
              } catch (error) {
                console.error(`Error updating ${update.id}:`, error);
                errors++;
              }
            },
            5
          );

          console.log(`✅ [TWITCH] Batch ${i + 1}/${batches} complete (${batch.length} streamers)`);

          if (i < batches - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

        } catch (error: any) {
          console.error(`❌ [TWITCH] Batch ${i + 1} failed:`, error.message);
          errors += batch.length;
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`🎉 [TWITCH] Sync complete: ${streamers.length} total, ${liveCount} live, ${errors} errors in ${duration}s`);

      return {
        total: streamers.length,
        live: liveCount,
        errors,
        duration: parseFloat(duration)
      };

    } catch (error) {
      console.error('💥 [TWITCH] Sync failed:', error);
      throw error;
    }
  }

  // ==================== KICK ====================

  private async getKickToken(): Promise<string|null> {
    const now = Date.now();
    
    if (this.kickToken && this.kickTokenExpiry > now) {
      return this.kickToken;
    }

    try {
      const response = await axios.post(
        'https://id.kick.com/oauth/token',
        new URLSearchParams({
          client_id: process.env.KICK_CLIENT_ID!,
          client_secret: process.env.KICK_CLIENT_SECRET!,
          grant_type: 'client_credentials'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.kickToken = response.data.access_token;
      // Kick tokens suelen durar 1 hora, restamos 5 min de margen
      this.kickTokenExpiry = now + (55 * 60 * 1000);
      
      console.log('✅ Kick token refreshed');
      return this.kickToken;
    } catch (error: any) {
      console.error('❌ Failed to get Kick token:', error.response?.data || error.message);
      throw error;
    }
  }

  async syncKickStreamers(): Promise<{
    total: number;
    live: number;
    errors: number;
    duration: number;
  }> {
    const startTime = Date.now();
    console.log('🟢 [KICK] Starting sync...');

    try {
      const streamers = await db.streamer.findMany({
        where: { platform: 'KICK' },
        select: {
          id: true,
          username: true,
          platform: true,
          profileUrl: true,
          highestViewers: true,
          streamTitles: true
        }
      });

      console.log(`📊 [KICK] Found ${streamers.length} streamers`);

      const token = await this.getKickToken();
      let liveCount = 0;
      let errors = 0;

      // Batch de 30 streamers (límite de Kick API)
      const BATCH_SIZE = 30;
      const batches = Math.ceil(streamers.length / BATCH_SIZE);

      for (let i = 0; i < batches; i++) {
        const batch = streamers.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        const slugs = batch.map(s => s.username);

        try {
          // Construir URL con múltiples parámetros slug
          const params = new URLSearchParams();
          slugs.forEach(slug => params.append('slug', slug));
          const url = `https://api.kick.com/public/v1/channels?${params.toString()}`; 
          const response = await axios.get(
            url,
            {
              headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              timeout: 15000
            }
          );

          // La respuesta debería ser un array de canales
          const channels = Array.isArray(response.data?.data) ? response.data.data : [];
          // Crear mapa de slug -> channel data
          const channelMap = new Map(
            channels.map((channel: any) => [
              channel.slug.toLowerCase(),
              channel
            ])
          );

          const updates = batch.map(streamer => {
            const channelData:any = channelMap.get(streamer.username.toLowerCase());
            
            let status: StreamStatus = { isLive: false, viewers: 0 };

            if (channelData) {
              const livestream = channelData.stream;
              const isLive = livestream?.is_live || false;

              if (isLive) {
                status = {
                  isLive: true,
                  viewers: livestream.viewer_count || 0,
                  title: channelData.stream_title || '',
                  game: channelData.category?.name || '',
                  startedAt: livestream.created_at ? new Date(livestream.start_time) : undefined
                };
                liveCount++;
              }
            }

            return this.buildUpdateData(streamer, status);
          });

          // Actualizar DB con concurrencia controlada
          await processBatch(
            updates,
            async (update:any) => {
              try {
                await db.streamer.update({
                  where: { id: update.id },
                  data: update.data
                });
              } catch (error) {
                console.error(`Error updating ${update.id}:`, error);
                errors++;
              }
            },
            5
          );

          console.log(`✅ [KICK] Batch ${i + 1}/${batches} complete (${batch.length} streamers, ${liveCount} live so far)`);

          // Delay conservador entre batches (100ms)
          if (i < batches - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

        } catch (error: any) {
          console.error(`❌ [KICK] Batch ${i + 1} failed:`, error.response?.data || error.message);
          errors += batch.length;
          
          // Si falla el token, invalidarlo para que se renueve
          if (error.response?.status === 401) {
            this.kickToken = null;
            this.kickTokenExpiry = 0;
          }
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`🎉 [KICK] Sync complete: ${streamers.length} total, ${liveCount} live, ${errors} errors in ${duration}s`);

      return {
        total: streamers.length,
        live: liveCount,
        errors,
        duration: parseFloat(duration)
      };

    } catch (error) {
      console.error('💥 [KICK] Sync failed:', error);
      throw error;
    }
  }

  // ==================== HELPERS ====================

  private buildUpdateData(streamer: StreamerData, status: StreamStatus) {
    let streamTitles = (streamer.streamTitles as Array<{title: string, date: string}>) || [];

    if (status.isLive && status.title) {
      const newEntry = {
        title: status.title,
        date: new Date().toISOString()
      };

      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const isDuplicate = streamTitles.some(entry =>
        entry.title === status.title &&
        new Date(entry.date) > oneDayAgo
      );

      if (!isDuplicate) {
        streamTitles = [newEntry, ...streamTitles].slice(0, 50);
      }
    }

    const updateData: any = {
      isLive: status.isLive,
      currentViewers: status.viewers || 0,
      currentGame: status.game,
      streamTitles: streamTitles,
      lastScrapedAt: new Date(), // Always update lastScrapedAt
    };

    if (status.isLive && status.viewers && streamer.highestViewers) {
      const currentPeak = streamer.highestViewers || 0;
      if (status.viewers > currentPeak) {
        updateData.highestViewers = status.viewers;
      }
    }

    if (status.isLive && status.startedAt && !isNaN(status.startedAt.getTime())) {
      updateData.lastStreamed = status.startedAt;
    }

    return {
      id: streamer.id,
      data: updateData
    };
  }

  // ==================== BACKFILL TWITCH AVATARS ====================

  async backfillTwitchAvatars(limit: number = 100): Promise<{ updated: number; errors: number }> {
    console.log(`🖼️ [TWITCH] Backfilling avatars for ${limit} streamers...`);

    try {
      // Get streamers without avatars
      const streamers = await db.streamer.findMany({
        where: {
          platform: 'TWITCH',
          avatarUrl: null
        },
        select: { id: true, username: true },
        take: limit
      });

      if (streamers.length === 0) {
        console.log('✅ All Twitch streamers have avatars');
        return { updated: 0, errors: 0 };
      }

      const token = await this.getTwitchToken();
      let updated = 0;
      let errors = 0;

      // Batch by 100 (Twitch API limit)
      const BATCH_SIZE = 100;
      const batches = Math.ceil(streamers.length / BATCH_SIZE);

      for (let i = 0; i < batches; i++) {
        const batch = streamers.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        const usernames = batch.map(s => s.username);

        try {
          // Get user info including profile image
          const response = await axios.get('https://api.twitch.tv/helix/users', {
            headers: {
              'Client-ID': process.env.TWITCH_CLIENT_ID!,
              'Authorization': `Bearer ${token}`
            },
            params: { login: usernames }
          });

          const userMap = new Map(
            response.data.data.map((user: any) => [
              user.login.toLowerCase(),
              user
            ])
          );

          for (const streamer of batch) {
            const userData: any = userMap.get(streamer.username.toLowerCase());
            if (userData && userData.profile_image_url) {
              try {
                await db.streamer.update({
                  where: { id: streamer.id },
                  data: {
                    avatarUrl: userData.profile_image_url,
                    lastScrapedAt: new Date()
                  }
                });
                updated++;
              } catch (e) {
                errors++;
              }
            }
          }

          console.log(`✅ [TWITCH] Avatar batch ${i + 1}/${batches} complete`);

          if (i < batches - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error: any) {
          console.error(`❌ [TWITCH] Avatar batch ${i + 1} failed:`, error.message);
          errors += batch.length;
        }
      }

      console.log(`🎉 [TWITCH] Avatar backfill complete: ${updated} updated, ${errors} errors`);
      return { updated, errors };
    } catch (error) {
      console.error('💥 [TWITCH] Avatar backfill failed:', error);
      throw error;
    }
  }

  // ==================== BACKFILL KICK AVATARS ====================

  async backfillKickAvatars(limit: number = 100): Promise<{ updated: number; errors: number }> {
    console.log(`🖼️ [KICK] Backfilling avatars for ${limit} streamers...`);

    try {
      const streamers = await db.streamer.findMany({
        where: {
          platform: 'KICK',
          avatarUrl: null
        },
        select: { id: true, username: true },
        take: limit
      });

      if (streamers.length === 0) {
        console.log('✅ All Kick streamers have avatars');
        return { updated: 0, errors: 0 };
      }

      let updated = 0;
      let errors = 0;

      for (const streamer of streamers) {
        try {
          // Kick public API for channel info
          const response = await axios.get(`https://kick.com/api/v2/channels/${streamer.username}`, {
            timeout: 5000
          });

          if (response.data?.user?.profile_pic) {
            await db.streamer.update({
              where: { id: streamer.id },
              data: {
                avatarUrl: response.data.user.profile_pic,
                lastScrapedAt: new Date()
              }
            });
            updated++;
          }

          // Rate limit: 1 request per 200ms
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (e) {
          errors++;
        }
      }

      console.log(`🎉 [KICK] Avatar backfill complete: ${updated} updated, ${errors} errors`);
      return { updated, errors };
    } catch (error) {
      console.error('💥 [KICK] Avatar backfill failed:', error);
      throw error;
    }
  }

  // ==================== BACKFILL YOUTUBE HANDLES ====================

  async backfillYouTubeHandles(limit: number = 100): Promise<{ updated: number; errors: number; skipped: number }> {
    console.log(`🎬 [YOUTUBE] Backfilling handles for ${limit} streamers...`);

    try {
      // Find YouTube streamers that don't have a handle yet (username contains spaces or doesn't start with channel name pattern)
      const streamers = await db.streamer.findMany({
        where: {
          platform: 'YOUTUBE',
          profileUrl: { not: '' },
          // Username contains space = likely display name, not handle
          username: { contains: ' ' }
        },
        select: { id: true, username: true, profileUrl: true, displayName: true },
        take: limit
      });

      if (streamers.length === 0) {
        console.log('✅ All YouTube streamers have handles');
        return { updated: 0, errors: 0, skipped: 0 };
      }

      console.log(`📊 [YOUTUBE] Found ${streamers.length} streamers needing handle backfill`);

      const apiKey = process.env.YOUTUBE_API_KEY;
      if (!apiKey) {
        throw new Error('YOUTUBE_API_KEY not configured');
      }

      let updated = 0;
      let errors = 0;
      let skipped = 0;

      // Batch by 50 (YouTube API limit for ids parameter)
      const BATCH_SIZE = 50;
      const batches = Math.ceil(streamers.length / BATCH_SIZE);

      for (let i = 0; i < batches; i++) {
        const batch = streamers.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);

        // Extract channel IDs from profileUrls
        const channelIds: { id: string; streamerId: string; displayName: string }[] = [];
        for (const streamer of batch) {
          if (streamer.profileUrl) {
            // Extract channel ID from URL like https://www.youtube.com/channel/UCoQm-PeHC-cbJclKJYJ8LzA
            const match = streamer.profileUrl.match(/\/channel\/([^\/\?]+)/);
            if (match) {
              channelIds.push({
                id: match[1],
                streamerId: streamer.id,
                displayName: streamer.displayName || streamer.username
              });
            } else {
              skipped++;
            }
          }
        }

        if (channelIds.length === 0) continue;

        try {
          // Call YouTube API
          const response = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
            params: {
              key: apiKey,
              id: channelIds.map(c => c.id).join(','),
              part: 'snippet'
            },
            timeout: 15000
          });

          const channels = response.data.items || [];
          const channelMap = new Map(
            channels.map((ch: any) => [ch.id, ch.snippet])
          );

          // Update each streamer
          for (const { id, streamerId, displayName } of channelIds) {
            const snippet: any = channelMap.get(id);
            if (snippet?.customUrl) {
              // customUrl is like "@FedeVigevani" - store without @ prefix
              const handle = snippet.customUrl.startsWith('@')
                ? snippet.customUrl.substring(1)
                : snippet.customUrl;

              try {
                await db.streamer.update({
                  where: { id: streamerId },
                  data: {
                    username: handle,
                    lastScrapedAt: new Date()
                  }
                });
                updated++;
                console.log(`✅ Updated: ${displayName} -> @${handle}`);
              } catch (e) {
                errors++;
              }
            } else {
              // No customUrl, keep as is
              skipped++;
            }
          }

          console.log(`✅ [YOUTUBE] Batch ${i + 1}/${batches} complete`);

          // Rate limit: wait between batches
          if (i < batches - 1) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }

        } catch (error: any) {
          console.error(`❌ [YOUTUBE] Batch ${i + 1} failed:`, error.response?.data || error.message);
          errors += batch.length;
        }
      }

      console.log(`🎉 [YOUTUBE] Handle backfill complete: ${updated} updated, ${errors} errors, ${skipped} skipped`);
      return { updated, errors, skipped };
    } catch (error) {
      console.error('💥 [YOUTUBE] Handle backfill failed:', error);
      throw error;
    }
  }
}