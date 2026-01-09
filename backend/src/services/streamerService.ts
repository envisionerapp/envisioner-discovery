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
      streamTitles: streamTitles
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
}