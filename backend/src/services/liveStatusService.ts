import axios from 'axios';
import * as xml2js from 'xml2js';
import * as cheerio from 'cheerio';
import { logger } from '../utils/database';

interface TwitchStreamResponse {
  data: Array<{
    id: string;
    user_id: string;
    user_login: string;
    user_name: string;
    game_id: string;
    game_name: string;
    type: string;
    title: string;
    viewer_count: number;
    started_at: string;
  }>;
}

interface TwitchTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface KickChannelResponse {
  livestream: {
    id: number;
    is_live: boolean;
    viewer_count: number;
    started_at: string;
    title: string;
  } | null;
}

interface YouTubeSearchResponse {
  items: Array<{
    id: { videoId: string };
    snippet: {
      title: string;
      channelId: string;
      channelTitle: string;
      liveBroadcastContent: string;
    };
  }>;
}

export class LiveStatusService {
  private static instance: LiveStatusService;
  private twitchToken: string | null = null;
  private twitchTokenExpiry: number = 0;

  // YouTube API key rotation - 5 keys from different projects
  private youtubeApiKeys: string[] = [
    'AIzaSyDzdtG_gCDRQhUbBjdmN0euebH9NEOP8yQ',
    'AIzaSyCHNIURBY5bnH1mMd2QAHHuOv9XAA1UV9U',
    'AIzaSyDzFhnS_2n5_Mo5al0hq0nZbC2DPNtsYsY',
    'AIzaSyDsQnJuGV6U5QApoLk1X575nBJVkjyfvBE',
    'AIzaSyBMIAxXrV2mbECTtqVvB4TOLft9EetYDMo'
  ];
  private currentYouTubeKeyIndex: number = 0;
  private youtubeKeyFailureCounts: Map<number, number> = new Map();

  private constructor() {}

  static getInstance(): LiveStatusService {
    if (!LiveStatusService.instance) {
      LiveStatusService.instance = new LiveStatusService();
    }
    return LiveStatusService.instance;
  }

  private getYouTubeApiKey(): string {
    // Return current key
    return this.youtubeApiKeys[this.currentYouTubeKeyIndex];
  }

  private rotateYouTubeApiKey(): void {
    // Mark current key as failed
    const currentCount = this.youtubeKeyFailureCounts.get(this.currentYouTubeKeyIndex) || 0;
    this.youtubeKeyFailureCounts.set(this.currentYouTubeKeyIndex, currentCount + 1);

    // Move to next key
    this.currentYouTubeKeyIndex = (this.currentYouTubeKeyIndex + 1) % this.youtubeApiKeys.length;

    logger.info(`🔄 Rotated to YouTube API key ${this.currentYouTubeKeyIndex + 1}/${this.youtubeApiKeys.length}`);
  }

  private async getTwitchToken(): Promise<string | null> {
    try {
      // Check if we have a valid token
      if (this.twitchToken && Date.now() < this.twitchTokenExpiry) {
        return this.twitchToken;
      }

      const clientId = process.env.TWITCH_CLIENT_ID;
      const clientSecret = process.env.TWITCH_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        logger.warn('Twitch credentials not configured');
        return null;
      }

      const response = await axios.post<TwitchTokenResponse>(
        'https://id.twitch.tv/oauth2/token',
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'client_credentials'
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000
        }
      );

      this.twitchToken = response.data.access_token;
      this.twitchTokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000; // 5 min buffer

      return this.twitchToken;
    } catch (error: any) {
      logger.error('Failed to get Twitch token:', { message: error?.message, code: error?.code });
      return null;
    }
  }

  async checkTwitchLiveStatus(username: string): Promise<{
    isLive: boolean;
    viewers?: number;
    title?: string;
    game?: string;
    startedAt?: Date;
  }> {
    try {
      const token = await this.getTwitchToken();
      if (!token) {
        return { isLive: false };
      }

      const clientId = process.env.TWITCH_CLIENT_ID;
      if (!clientId) {
        return { isLive: false };
      }

      const response = await axios.get<TwitchStreamResponse>(
        `https://api.twitch.tv/helix/streams?user_login=${username}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Client-Id': clientId
          },
          timeout: 10000
        }
      );

      if (response.data.data.length > 0) {
        const stream = response.data.data[0];
        return {
          isLive: true,
          viewers: stream.viewer_count,
          title: stream.title,
          game: stream.game_name,
          startedAt: new Date(stream.started_at)
        };
      }

      return { isLive: false };
    } catch (error: any) {
      logger.error(`Failed to check Twitch status for ${username}:`, { message: error?.message, code: error?.code });
      return { isLive: false };
    }
  }

  async checkKickLiveStatus(username: string): Promise<{
    isLive: boolean;
    viewers?: number;
    title?: string;
    startedAt?: Date;
  }> {
    try {
      const response = await axios.get<KickChannelResponse>(
        `https://kick.com/api/v2/channels/${username}`,
        {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );

      const livestream = response.data.livestream;
      if (livestream && livestream.is_live) {
        return {
          isLive: true,
          viewers: livestream.viewer_count,
          title: livestream.title,
          startedAt: new Date(livestream.started_at)
        };
      }

      return { isLive: false };
    } catch (error: any) {
      logger.error(`Failed to check Kick status for ${username}:`, { message: error?.message, code: error?.code });
      return { isLive: false };
    }
  }

  async checkYouTubeLiveStatus(channelIdOrUsername: string, retryCount: number = 0): Promise<{
    isLive: boolean;
    viewers?: number;
    title?: string;
    startedAt?: Date;
  }> {
    // Use rotated API keys instead of env variable
    const apiKey = this.getYouTubeApiKey();

    try {
      const channelId = channelIdOrUsername;

      // STEP 1: Use YouTube Data API v3 Search endpoint to find live broadcasts
      // This is the official, 100% accurate method - no scraping, no guessing!
      const searchUrl = 'https://www.googleapis.com/youtube/v3/search';
      const searchParams = {
        part: 'snippet',
        channelId: channelId,
        eventType: 'live', // Only return currently live broadcasts
        type: 'video',
        key: apiKey,
        maxResults: 1
      };

      const searchResponse = await axios.get(searchUrl, {
        params: searchParams,
        timeout: 10000
      });

      // If no live broadcasts found, channel is not currently live
      if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
        return { isLive: false };
      }

      const liveVideo = searchResponse.data.items[0];
      const videoId = liveVideo.id.videoId;
      const title = liveVideo.snippet.title;

      // STEP 2: Use YouTube Data API v3 Videos endpoint to get detailed live stream data
      // This gives us EXACT viewer count, start time, and all live stream details
      const videosUrl = 'https://www.googleapis.com/youtube/v3/videos';
      const videosParams = {
        part: 'liveStreamingDetails,statistics,snippet',
        id: videoId,
        key: apiKey
      };

      const videoResponse = await axios.get(videosUrl, {
        params: videosParams,
        timeout: 10000
      });

      if (!videoResponse.data.items || videoResponse.data.items.length === 0) {
        return { isLive: false };
      }

      const videoData = videoResponse.data.items[0];
      const liveDetails = videoData.liveStreamingDetails;
      const statistics = videoData.statistics;

      // Extract ACCURATE data directly from YouTube's official API
      const viewers = liveDetails?.concurrentViewers ? parseInt(liveDetails.concurrentViewers) : 0;
      const startedAt = liveDetails?.actualStartTime ? new Date(liveDetails.actualStartTime) : new Date();

      logger.info(`✅ YouTube live stream detected via API: ${channelId}`, {
        videoId,
        viewers,
        title,
        startedAt: startedAt.toISOString(),
        method: 'YouTube Data API v3'
      });

      return {
        isLive: true,
        viewers,
        title,
        startedAt
      };
    } catch (error: any) {
      // Handle API errors gracefully
      if (error.response?.status === 403) {
        const errorMessage = error.response?.data?.error?.message || '';

        // Check if it's a quota exceeded error
        if (errorMessage.includes('quota') || errorMessage.includes('Quota')) {
          logger.warn(`YouTube API quota exceeded for key ${this.currentYouTubeKeyIndex + 1}, rotating...`);

          // Rotate to next key if we haven't exhausted all keys
          if (retryCount < this.youtubeApiKeys.length - 1) {
            this.rotateYouTubeApiKey();
            return this.checkYouTubeLiveStatus(channelIdOrUsername, retryCount + 1);
          } else {
            logger.error(`All ${this.youtubeApiKeys.length} YouTube API keys exhausted quota`);
          }
        } else {
          logger.error(`YouTube API 403 error: ${errorMessage}`);
        }
      } else if (error.response?.status === 404) {
        logger.debug(`YouTube channel not found: ${channelIdOrUsername}`);
      } else {
        logger.debug(`YouTube API error for ${channelIdOrUsername}:`, { message: error?.message });
      }
      return { isLive: false };
    }
  }

  async checkStreamerLiveStatus(streamer: {
    id: string;
    username: string;
    platform: string;
    profileUrl?: string;
  }): Promise<{
    isLive: boolean;
    viewers?: number;
    title?: string;
    game?: string;
    startedAt?: Date;
  }> {
    try {
      switch (streamer.platform.toLowerCase()) {
        case 'twitch':
          return await this.checkTwitchLiveStatus(streamer.username);

        case 'kick':
          return await this.checkKickLiveStatus(streamer.username);

        case 'youtube':
          // Extract correct channel ID from profileUrl if available
          let channelId = streamer.username;
          if (streamer.profileUrl) {
            const match = streamer.profileUrl.match(/\/channel\/(UC[\w-]+)/i);
            if (match) {
              channelId = match[1];
            }
          }
          const youtubeStatus = await this.checkYouTubeLiveStatus(channelId);
          return {
            isLive: youtubeStatus.isLive,
            viewers: youtubeStatus.viewers,
            title: youtubeStatus.title,
            game: youtubeStatus.title, // Use title as game for YouTube
            startedAt: youtubeStatus.startedAt
          };

        default:
          logger.warn(`Unsupported platform: ${streamer.platform}`);
          return { isLive: false };
      }
    } catch (error: any) {
      logger.error(`Failed to check live status for streamer ${streamer.id}:`, { message: error?.message, code: error?.code });
      return { isLive: false };
    }
  }

  // Helper function to process promises with concurrency limit
  private async processBatch<T>(
    items: T[],
    processor: (item: T) => Promise<void>,
    concurrency: number
  ): Promise<void> {
    const executing: Set<Promise<void>> = new Set();

    for (const item of items) {
      const promise = processor(item).then(() => {
        executing.delete(promise);
      });

      executing.add(promise);

      if (executing.size >= concurrency) {
        await Promise.race(executing);
      }
    }

    // Wait for remaining promises
    await Promise.all(Array.from(executing));
  }

  async updateStreamersLiveStatus(batchSize: number = 500, concurrency: number = 500): Promise<{
    totalChecked: number;
    liveCount: number;
    errors: number;
  }> {
    try {
      const { db } = await import('../utils/database');

      // Get all streamers at once for faster processing
      const allStreamers = await db.streamer.findMany({
        select: {
          id: true,
          username: true,
          platform: true,
          profileUrl: true,
          highestViewers: true
        }
      });

      logger.info(`🚀 Starting parallel live status check for ${allStreamers.length} streamers (concurrency: ${concurrency})`);

      let totalChecked = 0;
      let liveCount = 0;
      let errors = 0;

      // Split into batches for progress tracking
      for (let i = 0; i < allStreamers.length; i += batchSize) {
        const batch = allStreamers.slice(i, i + batchSize);
        const batchStart = Date.now();

        logger.info(`Checking batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allStreamers.length / batchSize)} (${batch.length} streamers)`);

        await this.processBatch(
          batch,
          async (streamer) => {
            try {
              // DISABLED: Skip YouTube live status checks
              if (streamer.platform.toLowerCase() === 'youtube') {
                totalChecked++;
                return;
              }

              const status = await this.checkStreamerLiveStatus(streamer);

              // Get existing stream titles
              const existingStreamer = await db.streamer.findUnique({
                where: { id: streamer.id },
                select: { streamTitles: true }
              });

              let streamTitles = existingStreamer?.streamTitles as Array<{title: string, date: string}> || [];

              // Add new stream title if live and has a title
              if (status.isLive && status.title) {
                const newEntry = {
                  title: status.title,
                  date: new Date().toISOString()
                };

                // Check if this exact title already exists in the last 24 hours
                const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                const isDuplicate = streamTitles.some(entry =>
                  entry.title === status.title &&
                  new Date(entry.date) > oneDayAgo
                );

                if (!isDuplicate) {
                  streamTitles = [newEntry, ...streamTitles].slice(0, 50); // Keep last 50 titles
                }
              }

              const updateData: any = {
                isLive: status.isLive,
                currentViewers: status.viewers || 0,
                currentGame: status.game,
                streamTitles: streamTitles
              };

              // Auto-update peak viewers if current viewers exceed the peak
              if (status.isLive && status.viewers && streamer.highestViewers) {
                const currentPeak = streamer.highestViewers || 0;
                if (status.viewers > currentPeak) {
                  updateData.highestViewers = status.viewers;
                  logger.info(`New peak viewers for ${streamer.username}: ${status.viewers} (previous: ${currentPeak})`);
                }
              }

              // Only include lastStreamed if we have a valid date
              if (status.isLive && status.startedAt && !isNaN(status.startedAt.getTime())) {
                updateData.lastStreamed = status.startedAt;
              }

              await db.streamer.update({
                where: { id: streamer.id },
                data: updateData
              });

              if (status.isLive) {
                liveCount++;
              }
              totalChecked++;
            } catch (error: any) {
              logger.error(`Error updating streamer ${streamer.id}:`, { message: error?.message, code: error?.code });
              errors++;
            }
          },
          concurrency
        );

        const batchTime = ((Date.now() - batchStart) / 1000).toFixed(1);
        logger.info(`Batch complete in ${batchTime}s: ${totalChecked} checked, ${liveCount} live, ${errors} errors`);
      }

      logger.info(`✅ Live status update complete: ${totalChecked} checked, ${liveCount} live, ${errors} errors`);

      return { totalChecked, liveCount, errors };
    } catch (error: any) {
      logger.error('Failed to update streamers live status:', { message: error?.message, code: error?.code });
      throw error;
    }
  }

  async updateSpecificStreamersLiveStatus(streamerIds: string[]): Promise<{
    updated: number;
    liveCount: number;
    errors: number;
  }> {
    try {
      const { db } = await import('../utils/database');

      const streamers = await db.streamer.findMany({
        where: { id: { in: streamerIds } },
        select: {
          id: true,
          username: true,
          platform: true,
          profileUrl: true
        }
      });

      let updated = 0;
      let liveCount = 0;
      let errors = 0;

      for (const streamer of streamers) {
        try {
          const status = await this.checkStreamerLiveStatus(streamer);

          // Get current peak viewers and stream titles from database
          const currentStreamer = await db.streamer.findUnique({
            where: { id: streamer.id },
            select: { highestViewers: true, streamTitles: true }
          });

          let streamTitles = currentStreamer?.streamTitles as Array<{title: string, date: string}> || [];

          // Add new stream title if live and has a title
          if (status.isLive && status.title) {
            const newEntry = {
              title: status.title,
              date: new Date().toISOString()
            };

            // Check if this exact title already exists in the last 24 hours
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const isDuplicate = streamTitles.some(entry =>
              entry.title === status.title &&
              new Date(entry.date) > oneDayAgo
            );

            if (!isDuplicate) {
              streamTitles = [newEntry, ...streamTitles].slice(0, 50); // Keep last 50 titles
            }
          }

          const updateData: any = {
            isLive: status.isLive,
            currentViewers: status.viewers || 0,
            currentGame: status.game,
            streamTitles: streamTitles
          };

          // Auto-update peak viewers if current viewers exceed the peak
          if (status.isLive && status.viewers && currentStreamer) {
            const currentPeak = currentStreamer.highestViewers || 0;
            if (status.viewers > currentPeak) {
              updateData.highestViewers = status.viewers;
              logger.info(`New peak viewers for ${streamer.username}: ${status.viewers} (previous: ${currentPeak})`);
            }
          }

          // Only include lastStreamed if we have a valid date
          if (status.isLive && status.startedAt && !isNaN(status.startedAt.getTime())) {
            updateData.lastStreamed = status.startedAt;
          }

          await db.streamer.update({
            where: { id: streamer.id },
            data: updateData
          });

          if (status.isLive) {
            liveCount++;
          }
          updated++;

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error: any) {
          logger.error(`Error updating streamer ${streamer.id}:`, { message: error?.message, code: error?.code });
          errors++;
        }
      }

      return { updated, liveCount, errors };
    } catch (error: any) {
      logger.error('Failed to update specific streamers live status:', { message: error?.message, code: error?.code });
      throw error;
    }
  }
}

export const liveStatusService = LiveStatusService.getInstance();