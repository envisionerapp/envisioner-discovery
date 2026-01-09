import { db, logger } from '../utils/database';
import { Platform } from '@prisma/client';
import axios from 'axios';

export class TagScrapingService {
  private readonly TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || '';
  private readonly TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || '';
  private twitchAccessToken: string | null = null;
  private static instance: TagScrapingService;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_DELAY = 100; // ms between requests

  constructor() {
    if (TagScrapingService.instance) {
      return TagScrapingService.instance;
    }
    TagScrapingService.instance = this;
  }

  /**
   * Scrape tags for all streamers in the database
   */
  async scrapeAllStreamerTags(): Promise<{ updated: number; errors: number }> {
    logger.info('Starting tag scraping for all streamers...');

    let updated = 0;
    let errors = 0;

    try {
      // Get all streamers
      const streamers = await db.streamer.findMany({
        select: {
          id: true,
          username: true,
          platform: true,
          profileUrl: true
        }
      });

      logger.info(`Found ${streamers.length} streamers to process`);

      // Process in batches, grouping by platform for optimization
      const BATCH_SIZE = 50;

      for (let i = 0; i < streamers.length; i += BATCH_SIZE) {
        const batch = streamers.slice(i, i + BATCH_SIZE);

        // Group by platform
        const byPlatform = {
          TWITCH: [] as typeof batch,
          KICK: [] as typeof batch,
          YOUTUBE: [] as typeof batch,
          FACEBOOK: [] as typeof batch,
          TIKTOK: [] as typeof batch,
          INSTAGRAM: [] as typeof batch,
          X: [] as typeof batch,
          LINKEDIN: [] as typeof batch
        };

        batch.forEach(s => {
          if (byPlatform[s.platform]) {
            byPlatform[s.platform].push(s);
          }
        });

        // Process Twitch in batches (100 at a time via batch API)
        if (byPlatform.TWITCH.length > 0) {
          const twitchUsernames = byPlatform.TWITCH.map(s => s.username);
          const twitchResults = await this.scrapeTwitchTagsBatch(twitchUsernames);

          for (const streamer of byPlatform.TWITCH) {
            const newTags = twitchResults.get(streamer.username.toLowerCase());
            if (newTags && newTags.length > 0) {
              try {
                // Get existing streamer data
                const existing = await db.streamer.findUnique({
                  where: { id: streamer.id },
                  select: { tags: true }
                });

                // Merge existing tags with new tags (remove duplicates)
                const existingTags = existing?.tags || [];
                const mergedTags = Array.from(new Set([...existingTags, ...newTags]));

                await db.streamer.update({
                  where: { id: streamer.id },
                  data: { tags: mergedTags }
                });
                updated++;
                logger.info(`Updated tags for ${streamer.username}`, {
                  oldTags: existingTags,
                  newTags,
                  mergedTags
                });
              } catch (error) {
                errors++;
                logger.error(`Failed to update ${streamer.username}`, { error });
              }
            } else {
              errors++;
            }
          }
          await this.delay(500); // Delay between platform batches
        }

        // Process Kick and YouTube individually (no batch API)
        for (const streamer of [...byPlatform.KICK, ...byPlatform.YOUTUBE, ...byPlatform.FACEBOOK, ...byPlatform.TIKTOK]) {
          try {
            const success = await this.scrapeAndUpdateStreamer(streamer);
            if (success) {
              updated++;
            } else {
              errors++;
            }
          } catch (error) {
            errors++;
            logger.error(`Failed to scrape tags for ${streamer.username}`, { error });
          }
          await this.delay(this.MIN_REQUEST_DELAY);
        }

        // Log progress
        if (i % 100 === 0 || i + BATCH_SIZE >= streamers.length) {
          logger.info(`Progress: ${Math.min(i + BATCH_SIZE, streamers.length)}/${streamers.length} streamers processed`, { updated, errors });
        }
      }

      logger.info('Tag scraping completed', { updated, errors });
      return { updated, errors };

    } catch (error) {
      logger.error('Tag scraping failed', { error });
      throw error;
    }
  }

  /**
   * Scrape and update a single streamer
   */
  private async scrapeAndUpdateStreamer(streamer: { id: string; username: string; platform: Platform; profileUrl: string }): Promise<boolean> {
    try {
      const newTags = await this.scrapeTagsForStreamer(streamer.platform, streamer.username);

      if (newTags.length > 0) {
        // Get existing tags
        const existing = await db.streamer.findUnique({
          where: { id: streamer.id },
          select: { tags: true }
        });

        // Merge existing tags with new tags (remove duplicates)
        const existingTags = existing?.tags || [];
        const mergedTags = Array.from(new Set([...existingTags, ...newTags]));

        await db.streamer.update({
          where: { id: streamer.id },
          data: { tags: mergedTags }
        });
        logger.info(`Updated tags for ${streamer.username}`, {
          oldTags: existingTags,
          newTags,
          mergedTags
        });
        return true;
      }
      return false;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Scrape tags for a specific streamer
   */
  private async scrapeTagsForStreamer(platform: Platform, username: string): Promise<string[]> {
    switch (platform) {
      case Platform.TWITCH:
        return await this.scrapeTwitchTags(username);
      case Platform.KICK:
        return await this.scrapeKickTags(username);
      case Platform.YOUTUBE:
        return await this.scrapeYouTubeTags(username);
      default:
        return [];
    }
  }

  /**
   * Scrape tags for multiple Twitch streamers in batch (up to 100)
   */
  private async scrapeTwitchTagsBatch(usernames: string[]): Promise<Map<string, string[]>> {
    const results = new Map<string, string[]>();

    try {
      // Ensure we have an access token
      if (!this.twitchAccessToken) {
        await this.getTwitchAccessToken();
      }

      // Twitch API supports up to 100 logins at once
      const loginParams = usernames.map(u => `login=${u}`).join('&');

      // Get user IDs in batch
      const userResponse = await axios.get(`https://api.twitch.tv/helix/users?${loginParams}`, {
        headers: {
          'Client-ID': this.TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${this.twitchAccessToken}`
        },
        timeout: 10000
      });

      if (!userResponse.data.data || userResponse.data.data.length === 0) {
        return results;
      }

      const userMap = new Map<string, string>();
      userResponse.data.data.forEach((user: any) => {
        userMap.set(user.login.toLowerCase(), user.id);
      });

      // Get channel info in batch (up to 100)
      const broadcasterIds = Array.from(userMap.values()).map(id => `broadcaster_id=${id}`).join('&');

      const channelResponse = await axios.get(`https://api.twitch.tv/helix/channels?${broadcasterIds}`, {
        headers: {
          'Client-ID': this.TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${this.twitchAccessToken}`
        },
        timeout: 10000
      });

      if (channelResponse.data.data) {
        channelResponse.data.data.forEach((channel: any) => {
          const username = Array.from(userMap.entries())
            .find(([_, id]) => id === channel.broadcaster_id)?.[0];

          if (username) {
            const twitchTags = channel.tags || [];
            const gameName = channel.game_name || '';
            const allTags = [...twitchTags];
            if (gameName) {
              allTags.push(gameName);
            }
            results.set(username, allTags);
          }
        });
      }

      return results;

    } catch (error: any) {
      if (error.response?.status === 401) {
        this.twitchAccessToken = null;
        await this.getTwitchAccessToken();
        return await this.scrapeTwitchTagsBatch(usernames);
      }

      if (error.response?.status === 429) {
        logger.warn('Rate limited on Twitch batch request, waiting 2s');
        await this.delay(2000);
        return await this.scrapeTwitchTagsBatch(usernames);
      }

      logger.error('Failed to scrape Twitch tags batch', { error: error.message, count: usernames.length });
      return results;
    }
  }

  /**
   * Scrape tags from Twitch - Returns EXACT tags from streamer's channel
   */
  private async scrapeTwitchTags(username: string): Promise<string[]> {
    const batch = await this.scrapeTwitchTagsBatch([username]);
    return batch.get(username.toLowerCase()) || [];
  }

  /**
   * Scrape tags from Kick - Returns EXACT tags from streamer's channel
   */
  private async scrapeKickTags(username: string): Promise<string[]> {
    try {
      const response = await axios.get(`https://kick.com/api/v2/channels/${username}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://kick.com/',
          'Origin': 'https://kick.com'
        },
        timeout: 10000
      });

      if (!response.data) {
        return [];
      }

      const channelData = response.data;
      const category = channelData.category?.name || '';
      const tags = channelData.tags || [];

      // Return RAW tags exactly as they are on Kick, plus add the category
      const allTags: string[] = [...tags];
      if (category) {
        allTags.push(category);
      }

      return allTags;

    } catch (error: any) {
      if (error.response?.status === 403 || error.response?.status === 429) {
        // Rate limited or blocked - wait longer
        await this.delay(2000);
      }
      logger.error(`Failed to scrape Kick tags for ${username}`, { error: error.message });
      return [];
    }
  }

  /**
   * Scrape tags from YouTube - Returns EXACT tags from streamer's channel
   */
  private async scrapeYouTubeTags(username: string): Promise<string[]> {
    try {
      // YouTube doesn't have a public tags API, so we return empty for now
      // You would need to use YouTube Data API v3 to get proper category/tags
      return [];

    } catch (error: any) {
      logger.error(`Failed to scrape YouTube tags for ${username}`, { error: error.message });
      return [];
    }
  }

  /**
   * Get Twitch OAuth token
   */
  private async getTwitchAccessToken(): Promise<void> {
    try {
      const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
        params: {
          client_id: this.TWITCH_CLIENT_ID,
          client_secret: this.TWITCH_CLIENT_SECRET,
          grant_type: 'client_credentials'
        }
      });

      this.twitchAccessToken = response.data.access_token;
      logger.info('Twitch access token obtained');

    } catch (error) {
      logger.error('Failed to get Twitch access token', { error });
      throw error;
    }
  }


  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const tagScrapingService = new TagScrapingService();
