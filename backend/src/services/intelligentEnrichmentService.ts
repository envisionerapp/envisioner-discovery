import { db, logger } from '../utils/database';
import { Platform } from '@prisma/client';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { claudeService } from './claudeService';

interface EnrichmentData {
  profileDescription?: string;
  bannerText?: string;
  panelTexts: string[];
  panelImages?: Array<{ url: string; alt?: string; link?: string }>;
  aboutSection?: string;
  externalLinks: string[];
  streamTitles: Array<{ title: string; date: Date }>;
  chatKeywords: string[];
  communityPosts?: string;
}

interface AIIntelligence {
  igamingIntelligence?: string;
  igamingScore: number;
  audiencePsychology?: string;
  brandSafetyScore: number;
  gamblingCompatibility: boolean;
  riskAssessment?: string;
  conversionPotential?: {
    level: 'high' | 'medium' | 'low';
    confidence: number;
    reasoning: string;
  };
  contentAnalysis?: string;
  webPresence?: string;
}

export class IntelligentEnrichmentService {
  private readonly TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID || '';
  private readonly TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET || '';
  private twitchAccessToken: string | null = null;

  /**
   * Enrich all streamers with intelligent data
   */
  async enrichAllStreamers(limit?: number): Promise<{ enriched: number; errors: number }> {
    logger.info('Starting intelligent enrichment for all streamers...');

    let enriched = 0;
    let errors = 0;

    try {
      // Get streamers that need enrichment - PRIORITIZE TWITCH FIRST
      // First get Twitch streamers
      const twitchStreamers = await db.streamer.findMany({
        where: {
          platform: 'TWITCH',
          OR: [
            { lastEnrichmentUpdate: null },
            { lastEnrichmentUpdate: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
          ]
        },
        select: {
          id: true,
          username: true,
          platform: true,
          profileUrl: true,
          tags: true,
          currentGame: true,
          topGames: true
        },
        take: Math.min(limit || 100, 50),
        orderBy: { followers: 'desc' }
      });

      // Then get other platforms if we need more
      const remaining = (limit || 100) - twitchStreamers.length;
      const otherStreamers = remaining > 0 ? await db.streamer.findMany({
        where: {
          platform: { not: 'TWITCH' },
          OR: [
            { lastEnrichmentUpdate: null },
            { lastEnrichmentUpdate: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
          ]
        },
        select: {
          id: true,
          username: true,
          platform: true,
          profileUrl: true,
          tags: true,
          currentGame: true,
          topGames: true
        },
        take: remaining,
        orderBy: { followers: 'desc' }
      }) : [];

      const streamers = [...twitchStreamers, ...otherStreamers];

      logger.info(`Found ${streamers.length} streamers to enrich`);

      const BATCH_SIZE = 10;

      for (let i = 0; i < streamers.length; i += BATCH_SIZE) {
        const batch = streamers.slice(i, i + BATCH_SIZE);

        for (const streamer of batch) {
          try {
            logger.info(`Enriching ${streamer.username} (${streamer.platform})...`);

            // Step 1: Scrape raw data from multiple sources
            const rawData = await this.scrapeStreamerData(streamer);

            // Step 2: Use AI to analyze and generate intelligence
            const intelligence = await this.analyzeWithAI(streamer, rawData);

            // Step 3: Store enrichment data
            await db.streamer.update({
              where: { id: streamer.id },
              data: {
                ...rawData,
                ...intelligence,
                lastEnrichmentUpdate: new Date()
              }
            });

            enriched++;
            logger.info(`✅ Enriched ${streamer.username}`, {
              igamingScore: intelligence.igamingScore,
              brandSafety: intelligence.brandSafetyScore,
              gambling: intelligence.gamblingCompatibility
            });

            // Delay to avoid rate limits
            await this.delay(500);

          } catch (error) {
            errors++;
            logger.error(`Failed to enrich ${streamer.username}`, { error });
          }
        }

        // Log progress
        if (i % 50 === 0) {
          logger.info(`Progress: ${i}/${streamers.length}`, { enriched, errors });
        }
      }

      logger.info('Enrichment completed', { enriched, errors });
      return { enriched, errors };

    } catch (error) {
      logger.error('Enrichment failed', { error });
      throw error;
    }
  }

  /**
   * Scrape comprehensive data from multiple sources
   */
  private async scrapeStreamerData(streamer: {
    username: string;
    platform: Platform;
    profileUrl: string;
  }): Promise<EnrichmentData> {
    const data: EnrichmentData = {
      panelTexts: [],
      panelImages: [],
      externalLinks: [],
      streamTitles: [],
      chatKeywords: []
    };

    switch (streamer.platform) {
      case Platform.TWITCH:
        return await this.scrapeTwitchData(streamer.username);
      case Platform.KICK:
        return await this.scrapeKickData(streamer.username);
      case Platform.YOUTUBE:
        return await this.scrapeYouTubeData(streamer.username);
      default:
        return data;
    }
  }

  /**
   * Scrape Twitch profile for comprehensive data
   */
  private async scrapeTwitchData(username: string): Promise<EnrichmentData> {
    const data: EnrichmentData = {
      panelTexts: [],
      externalLinks: [],
      streamTitles: [],
      chatKeywords: []
    };

    try {
      // Ensure we have access token
      if (!this.twitchAccessToken) {
        await this.getTwitchAccessToken();
      }

      // Get user info
      const userResponse = await axios.get(`https://api.twitch.tv/helix/users?login=${username}`, {
        headers: {
          'Client-ID': this.TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${this.twitchAccessToken}`
        }
      });

      if (userResponse.data.data?.[0]) {
        const user = userResponse.data.data[0];
        data.profileDescription = user.description;
      }

      const userId = userResponse.data.data?.[0]?.id;
      if (!userId) return data;

      // Get channel panels using Twitch GraphQL API
      try {
        const graphqlQuery = {
          operationName: 'ChannelPanels',
          variables: {
            login: username
          },
          query: `query ChannelPanels($login: String!) {
            user(login: $login) {
              id
              panels {
                __typename
                id
                ... on DefaultPanel {
                  title
                  description
                  imageURL
                  linkURL
                }
              }
            }
          }`
        };

        const panelsResponse = await axios.post('https://gql.twitch.tv/gql', graphqlQuery, {
          headers: {
            'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko', // Twitch's web client ID
            'Content-Type': 'application/json'
          }
        });

        if (panelsResponse.data?.data?.user?.panels) {
          const panels = panelsResponse.data.data.user.panels;
          data.panelImages = [];

          panels.forEach((panel: any) => {
            // Extract panel image
            if (panel.imageURL) {
              data.panelImages!.push({
                url: panel.imageURL,
                alt: panel.title || panel.description || undefined,
                link: panel.linkURL || undefined
              });
            }

            // Extract panel description text
            if (panel.description) {
              data.panelTexts.push(panel.description);
            }

            // Extract links from panels
            if (panel.linkURL) {
              data.externalLinks.push(panel.linkURL);
            }
          });
        }
      } catch (error: any) {
        logger.warn(`Failed to fetch panels via GraphQL for ${username}`, { error: error.message });
      }

      // Get recent videos/streams for titles
      const videosResponse = await axios.get(`https://api.twitch.tv/helix/videos?user_id=${userId}&first=20`, {
        headers: {
          'Client-ID': this.TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${this.twitchAccessToken}`
        }
      });

      if (videosResponse.data.data) {
        data.streamTitles = videosResponse.data.data.map((video: any) => ({
          title: video.title,
          date: new Date(video.created_at)
        }));
      }

      // Scrape profile page for panels using web scraping
      try {
        const pageResponse = await axios.get(`https://www.twitch.tv/${username}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 10000
        });

        const $ = cheerio.load(pageResponse.data);

        // Extract panel texts and links
        $('a[href]').each((_, el) => {
          const href = $(el).attr('href');
          if (href && (href.includes('twitter.com') || href.includes('instagram.com') ||
                       href.includes('youtube.com') || href.includes('discord.gg') ||
                       href.includes('tiktok.com'))) {
            data.externalLinks.push(href);
          }
        });

      } catch (error) {
        logger.warn(`Failed to scrape Twitch page for ${username}`, { error });
      }

      return data;

    } catch (error: any) {
      if (error.response?.status === 401) {
        this.twitchAccessToken = null;
        await this.getTwitchAccessToken();
        return await this.scrapeTwitchData(username);
      }
      logger.error(`Failed to scrape Twitch data for ${username}`, { error });
      return data;
    }
  }

  /**
   * Scrape Kick profile data
   */
  private async scrapeKickData(username: string): Promise<EnrichmentData> {
    const data: EnrichmentData = {
      panelTexts: [],
      externalLinks: [],
      streamTitles: [],
      chatKeywords: []
    };

    try {
      const response = await axios.get(`https://kick.com/api/v2/channels/${username}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        },
        timeout: 10000
      });

      if (response.data) {
        const channel = response.data;
        data.profileDescription = channel.bio || channel.description;

        // Get recent stream data
        if (channel.previous_livestreams) {
          data.streamTitles = channel.previous_livestreams.slice(0, 20).map((stream: any) => ({
            title: stream.session_title || stream.title,
            date: new Date(stream.created_at)
          }));
        }

        // Extract social links from bio
        if (channel.bio) {
          const urlRegex = /(https?:\/\/[^\s]+)/g;
          const urls = channel.bio.match(urlRegex);
          if (urls) {
            data.externalLinks.push(...urls);
          }
        }
      }

      return data;

    } catch (error: any) {
      logger.error(`Failed to scrape Kick data for ${username}`, { error: error.message });
      return data;
    }
  }

  /**
   * Scrape YouTube channel data
   */
  private async scrapeYouTubeData(username: string): Promise<EnrichmentData> {
    const data: EnrichmentData = {
      panelTexts: [],
      externalLinks: [],
      streamTitles: [],
      chatKeywords: []
    };

    try {
      // Scrape YouTube channel page
      const response = await axios.get(`https://www.youtube.com/@${username}/about`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);

      // Try to extract description from page
      const scriptTags = $('script').toArray();
      for (const script of scriptTags) {
        const content = $(script).html();
        if (content && content.includes('description')) {
          // Extract JSON data that contains channel info
          const match = content.match(/"description":\s*"([^"]+)"/);
          if (match) {
            data.profileDescription = match[1];
            break;
          }
        }
      }

      return data;

    } catch (error: any) {
      logger.error(`Failed to scrape YouTube data for ${username}`, { error: error.message });
      return data;
    }
  }

  /**
   * Use AI to analyze scraped data and generate intelligence
   */
  private async analyzeWithAI(
    streamer: { username: string; platform: Platform; tags: string[]; currentGame?: string | null; topGames: string[] },
    rawData: EnrichmentData
  ): Promise<AIIntelligence> {
    try {
      const prompt = `Analyze this streamer profile and provide intelligence for iGaming/betting marketing:

STREAMER: ${streamer.username} (${streamer.platform})
TAGS: ${streamer.tags.join(', ')}
CURRENT GAME: ${streamer.currentGame || 'N/A'}
TOP GAMES: ${streamer.topGames.join(', ')}

PROFILE BIO: ${rawData.profileDescription || 'N/A'}
RECENT STREAM TITLES: ${rawData.streamTitles.slice(0, 5).map(s => s.title).join(' | ') || 'N/A'}
EXTERNAL LINKS: ${rawData.externalLinks.join(', ') || 'N/A'}

Provide a JSON analysis with:
1. igamingScore (0-100): How suitable for iGaming/betting campaigns
2. brandSafetyScore (0-100): How brand-safe (avoid controversial content)
3. gamblingCompatibility (boolean): Whether they already engage with gambling content
4. audiencePsychology (string): Brief description of their audience demographics and interests
5. conversionPotential (object): { level: 'high'|'medium'|'low', confidence: 0-100, reasoning: string }
6. riskAssessment (string): Any potential risks or concerns
7. contentAnalysis (string): Summary of their content style and themes

Focus on: gaming preferences, audience age/interests, content style, and suitability for betting promotions.`;

      const response = await claudeService.generateConversationResponse(prompt);

      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }
      const analysis = JSON.parse(jsonMatch[0]);

      return {
        igamingScore: Math.min(100, Math.max(0, analysis.igamingScore || 0)),
        brandSafetyScore: Math.min(100, Math.max(0, analysis.brandSafetyScore || 0)),
        gamblingCompatibility: !!analysis.gamblingCompatibility,
        audiencePsychology: analysis.audiencePsychology,
        conversionPotential: analysis.conversionPotential,
        riskAssessment: analysis.riskAssessment,
        contentAnalysis: analysis.contentAnalysis,
        igamingIntelligence: JSON.stringify(analysis),
        webPresence: rawData.externalLinks.length > 0 ? JSON.stringify({ links: rawData.externalLinks }) : undefined
      };

    } catch (error) {
      logger.error('AI analysis failed', { error });
      // Return default values
      return {
        igamingScore: 0,
        brandSafetyScore: 50,
        gamblingCompatibility: false
      };
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

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const intelligentEnrichmentService = new IntelligentEnrichmentService();
