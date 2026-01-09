import axios from 'axios';
import puppeteer, { Browser, Page } from 'puppeteer';
import { db, logger } from '../utils/database';
import { Platform } from '@prisma/client';
import pRetry from 'p-retry';

interface EnrichedData {
  profileDescription?: string;
  bannerText?: string;
  panelTexts: string[];
  aboutSection?: string;
  externalLinks?: any;
  streamTitles: string[];
  chatKeywords: string[];
  communityPosts?: any;
  contentAnalysis?: any;
  webPresence?: any;
}

export class AdvancedEnrichmentService {
  private browser: Browser | null = null;
  private readonly userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ];

  /**
   * Initialize browser instance
   */
  private async initBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      logger.info('🚀 Launching Puppeteer browser...');
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920x1080'
        ]
      });
    }
    return this.browser;
  }

  /**
   * Close browser instance
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      logger.info('🔴 Browser closed');
    }
  }

  /**
   * Create new page with anti-detection measures
   */
  private async createPage(): Promise<Page> {
    const browser = await this.initBrowser();
    const page = await browser.newPage();

    // Randomize user agent
    const userAgent = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    await page.setUserAgent(userAgent);

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });

    return page;
  }

  /**
   * Retry wrapper with exponential backoff
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T | null> {
    try {
      return await pRetry(operation, {
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 10000,
        onFailedAttempt: (error: any) => {
          logger.warn(`${operationName} attempt ${error.attemptNumber} failed: ${error}`);
        }
      });
    } catch (error) {
      logger.error(`${operationName} failed after retries:`, error);
      return null;
    }
  }

  /**
   * Enrich streamer using comprehensive multi-source approach
   */
  async enrichStreamer(streamerId: string): Promise<void> {
    let page: Page | null = null;

    try {
      const streamer = await db.streamer.findUnique({
        where: { id: streamerId }
      });

      if (!streamer) {
        throw new Error(`Streamer not found: ${streamerId}`);
      }

      logger.info(`🔍 Advanced enrichment for: ${streamer.username} (${streamer.platform})`);

      const enrichedData: EnrichedData = {
        panelTexts: [],
        streamTitles: [],
        chatKeywords: [],
        externalLinks: { social: [], external: [] },
        communityPosts: {},
        webPresence: { socialMedia: [], mentions: [], websites: [] }
      };

      // Create browser page
      page = await this.createPage();

      // Platform-specific enrichment
      switch (streamer.platform) {
        case 'TWITCH':
          await this.enrichTwitchAdvanced(streamer, enrichedData, page);
          break;
        case 'YOUTUBE':
          await this.enrichYouTubeAdvanced(streamer, enrichedData, page);
          break;
        case 'KICK':
          await this.enrichKickAdvanced(streamer, enrichedData, page);
          break;
      }

      // Additional web presence scraping
      await this.enrichWebPresenceAdvanced(streamer, enrichedData, page);

      // AI analysis
      await this.analyzeContentWithAI(enrichedData);

      // Save to database
      await db.streamer.update({
        where: { id: streamerId },
        data: {
          profileDescription: enrichedData.profileDescription,
          bannerText: enrichedData.bannerText,
          panelTexts: enrichedData.panelTexts,
          aboutSection: enrichedData.aboutSection,
          externalLinks: enrichedData.externalLinks,
          streamTitles: enrichedData.streamTitles,
          chatKeywords: enrichedData.chatKeywords,
          communityPosts: enrichedData.communityPosts,
          contentAnalysis: enrichedData.contentAnalysis,
          webPresence: enrichedData.webPresence,
          lastEnrichmentUpdate: new Date()
        }
      });

      logger.info(`✅ Successfully enriched ${streamer.username}`);

      // Log what data was collected
      logger.info(`📊 Data collected:`, {
        username: streamer.username,
        profileDescription: !!enrichedData.profileDescription,
        panelTexts: enrichedData.panelTexts.length,
        streamTitles: enrichedData.streamTitles.length,
        externalLinks: Object.keys(enrichedData.externalLinks || {}).length,
        webPresence: Object.keys(enrichedData.webPresence || {}).length
      });

    } catch (error) {
      logger.error(`❌ Error enriching streamer ${streamerId}:`, error);
      throw error;
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }
  }

  /**
   * Advanced Twitch enrichment using GQL API + Puppeteer
   */
  private async enrichTwitchAdvanced(
    streamer: any,
    enrichedData: EnrichedData,
    page: Page
  ): Promise<void> {
    try {
      logger.info(`🎮 Enriching Twitch: ${streamer.username}`);

      // Method 1: Twitch GQL API (bypasses rate limits)
      await this.retryOperation(async () => {
        const gqlData = await this.fetchTwitchGQL(streamer.username);
        if (gqlData) {
          enrichedData.profileDescription = gqlData.description;
          enrichedData.aboutSection = gqlData.description;
          enrichedData.panelTexts = gqlData.panels || [];
          enrichedData.streamTitles = gqlData.videos || [];
        }
      }, 'Twitch GQL');

      // Method 2: Puppeteer scraping
      await this.retryOperation(async () => {
        const channelUrl = `https://www.twitch.tv/${streamer.username}`;
        await page.goto(channelUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for content to load
        await new Promise(resolve => setTimeout(resolve, 500));

        // Extract about section
        const aboutText = await page.evaluate(() => {
          const aboutElements = document.querySelectorAll('[data-a-target="about-panel"]');
          return Array.from(aboutElements).map(el => el.textContent?.trim()).filter(Boolean);
        });

        if (aboutText.length > 0 && !enrichedData.aboutSection) {
          enrichedData.aboutSection = aboutText.join('\n');
        }

        // Extract panels
        const panels:any = await page.evaluate(() => {
          const panelElements = document.querySelectorAll('.panel');
          return Array.from(panelElements).map(el => el.textContent?.trim()).filter(Boolean);
        });

        if (panels.length > 0) {
          enrichedData.panelTexts.push(...panels);
        }

        // Extract links
        const links = await page.evaluate(() => {
          const linkElements = document.querySelectorAll('a[href]');
          return Array.from(linkElements)
            .map(el => (el as HTMLAnchorElement).href)
            .filter(href => href && !href.includes('twitch.tv'));
        });

        const socialLinks: string[] = [];
        const externalLinks: string[] = [];
        const socialDomains = ['twitter.com', 'x.com', 'instagram.com', 'tiktok.com', 'youtube.com', 'discord.gg'];

        links.forEach(link => {
          if (socialDomains.some(domain => link.includes(domain))) {
            if (!socialLinks.includes(link)) socialLinks.push(link);
          } else {
            if (!externalLinks.includes(link)) externalLinks.push(link);
          }
        });

        enrichedData.externalLinks = {
          social: socialLinks.slice(0, 20),
          external: externalLinks.slice(0, 20)
        };

      }, 'Twitch Puppeteer');

      // Method 3: TwitchTracker for additional data
      await this.retryOperation(async () => {
        const trackerUrl = `https://twitchtracker.com/${streamer.username}`;
        await page.goto(trackerUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        const streamTitles = await page.evaluate(() => {
          const titleElements = document.querySelectorAll('.stream-title');
          return Array.from(titleElements)
            .map(el => el.textContent?.trim())
            .filter(Boolean) as string[];
        });

        if (streamTitles.length > 0) {
          enrichedData.streamTitles.push(...streamTitles.slice(0, 20));
        }
      }, 'TwitchTracker');

    } catch (error) {
      logger.error(`Error in Twitch advanced enrichment for ${streamer.username}:`, error);
    }
  }

  /**
   * Fetch Twitch data using GraphQL API (bypasses REST API rate limits)
   */
  private async fetchTwitchGQL(username: string): Promise<any> {
    try {
      const clientId = 'kimne78kx3ncx6brgo4mv6wki5h1ko'; // Public Twitch client ID

      const query = `
        query {
          user(login: "${username}") {
            description
            panels {
              ... on DefaultPanel {
                title
                description
                imageURL
                linkURL
              }
            }
            stream {
              title
            }
            videos(first: 20, type: ARCHIVE) {
              edges {
                node {
                  title
                  description
                }
              }
            }
          }
        }
      `;

      const response = await axios.post(
        'https://gql.twitch.tv/gql',
        { query },
        {
          headers: {
            'Client-ID': clientId,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data?.data?.user) {
        const user = response.data.data.user;
        return {
          description: user.description,
          panels: user.panels?.map((p: any) => `${p.title}: ${p.description}`).filter(Boolean),
          videos: user.videos?.edges?.map((e: any) => e.node.title).filter(Boolean)
        };
      }
    } catch (error: any) {
      logger.warn(`Twitch GQL failed for ${username}: ${error.message}`);
    }
    return null;
  }

  /**
   * Advanced YouTube enrichment
   */
  private async enrichYouTubeAdvanced(
    streamer: any,
    enrichedData: EnrichedData,
    page: Page
  ): Promise<void> {
    try {
      logger.info(`📺 Enriching YouTube: ${streamer.username}`);

      const channelUrl = streamer.profileUrl || `https://www.youtube.com/@${streamer.username}`;

      await this.retryOperation(async () => {
        await page.goto(channelUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 500));

        // Extract description
        const description = await page.evaluate(() => {
          const descMeta = document.querySelector('meta[name="description"]');
          return descMeta?.getAttribute('content') || '';
        });

        if (description) {
          enrichedData.profileDescription = description;
          enrichedData.aboutSection = description;
        }

        // Extract video titles
        const videoTitles = await page.evaluate(() => {
          const titleElements = document.querySelectorAll('#video-title');
          return Array.from(titleElements)
            .map(el => el.textContent?.trim())
            .filter(Boolean) as string[];
        });

        enrichedData.streamTitles = videoTitles.slice(0, 20);

        // Extract links
        const links = await page.evaluate(() => {
          const linkElements = document.querySelectorAll('a[href]');
          return Array.from(linkElements)
            .map(el => (el as HTMLAnchorElement).href)
            .filter(href => href && !href.includes('youtube.com'));
        });

        const socialLinks = links.filter(link =>
          ['twitter.com', 'x.com', 'instagram.com', 'tiktok.com', 'discord.gg'].some(d => link.includes(d))
        );

        enrichedData.externalLinks = {
          social: [...new Set(socialLinks)].slice(0, 20),
          external: [...new Set(links.filter(l => !socialLinks.includes(l)))].slice(0, 20)
        };

      }, 'YouTube Puppeteer');

    } catch (error) {
      logger.error(`Error in YouTube advanced enrichment for ${streamer.username}:`, error);
    }
  }

  /**
   * Advanced Kick enrichment
   */
  private async enrichKickAdvanced(
    streamer: any,
    enrichedData: EnrichedData,
    page: Page
  ): Promise<void> {
    try {
      logger.info(`⚽ Enriching Kick: ${streamer.username}`);

      const channelUrl = `https://kick.com/${streamer.username}`;

      await this.retryOperation(async () => {
        await page.goto(channelUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(resolve => setTimeout(resolve, 500));

        // Extract description
        const description = await page.evaluate(() => {
          const descElements = document.querySelectorAll('[class*="description"], [class*="bio"]');
          return Array.from(descElements)
            .map(el => el.textContent?.trim())
            .filter(Boolean)
            .join('\n');
        });

        if (description) {
          enrichedData.profileDescription = description;
          enrichedData.aboutSection = description;
        }

        // Extract stream titles from past streams
        const streamTitles = await page.evaluate(() => {
          const titleElements = document.querySelectorAll('[class*="stream-title"], [class*="video-title"]');
          return Array.from(titleElements)
            .map(el => el.textContent?.trim())
            .filter(Boolean) as string[];
        });

        enrichedData.streamTitles = streamTitles.slice(0, 20);

      }, 'Kick Puppeteer');

    } catch (error) {
      logger.error(`Error in Kick advanced enrichment for ${streamer.username}:`, error);
    }
  }

  /**
   * Advanced web presence enrichment
   */
  private async enrichWebPresenceAdvanced(
    streamer: any,
    enrichedData: EnrichedData,
    page: Page
  ): Promise<void> {
    try {
      logger.info(`🌐 Enriching web presence for: ${streamer.username}`);

      // Search social media platforms directly
      const platforms = [
        { name: 'Twitter/X', url: `https://twitter.com/${streamer.username}`, searchUrl: `https://twitter.com/search?q=${encodeURIComponent(streamer.displayName || streamer.username)}` },
        { name: 'Instagram', url: `https://instagram.com/${streamer.username}` },
        { name: 'TikTok', url: `https://tiktok.com/@${streamer.username}` }
      ];

      const socialMedia: string[] = [];

      for (const platform of platforms) {
        try {
          const response = await axios.head(platform.url, {
            timeout: 5000,
            validateStatus: (status) => status < 500
          });

          if (response.status === 200) {
            socialMedia.push(platform.url);
            logger.info(`✅ Found ${platform.name} profile: ${platform.url}`);
          }
        } catch (error) {
          // Profile doesn't exist, skip
        }
      }

      enrichedData.webPresence = {
        socialMedia,
        mentions: [],
        websites: []
      };

    } catch (error) {
      logger.error(`Error enriching web presence for ${streamer.username}:`, error);
    }
  }

  /**
   * Analyze content with AI
   */
  private async analyzeContentWithAI(enrichedData: EnrichedData): Promise<void> {
    try {
      const allText = [
        enrichedData.profileDescription,
        enrichedData.aboutSection,
        ...enrichedData.panelTexts,
        ...enrichedData.streamTitles
      ].filter(Boolean).join(' ');

      if (!allText || allText.length < 50) {
        return;
      }

      const { claudeService } = await import('./claudeService');
      const analysis = await claudeService.analyzeStreamerContent(allText);
      enrichedData.contentAnalysis = analysis;

    } catch (error) {
      logger.error('Error analyzing content with AI:', error);
    }
  }

  /**
   * Batch enrich with browser reuse
   */
  async enrichStreamers(streamerIds: string[], concurrency: number = 20): Promise<void> {
    logger.info(`🚀 Starting MAXIMUM SPEED batch enrichment for ${streamerIds.length} streamers (concurrency: ${concurrency})`);

    // Initialize browser once
    await this.initBrowser();

    const chunks = [];
    for (let i = 0; i < streamerIds.length; i += concurrency) {
      chunks.push(streamerIds.slice(i, i + concurrency));
    }

    let completed = 0;
    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(id => this.enrichStreamer(id))
      );

      completed += chunk.length;
      logger.info(`📊 Progress: ${completed}/${streamerIds.length} streamers enriched`);

      // NO delay - maximum speed
    }

    // Close browser after all enrichments
    await this.closeBrowser();

    logger.info(`✅ Completed advanced batch enrichment`);
  }

  /**
   * Enrich all unenriched streamers
   */
  async enrichAllStreamers(batchSize: number = 50): Promise<void> {
    logger.info('🚀 Starting full database advanced enrichment');

    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const streamers = await db.streamer.findMany({
        where: {
          lastEnrichmentUpdate: null
        },
        select: { id: true },
        take: batchSize,
        skip
      });

      if (streamers.length === 0) {
        hasMore = false;
        break;
      }

      const ids = streamers.map(s => s.id);
      await this.enrichStreamers(ids, 3);

      skip += batchSize;
      logger.info(`📊 Total enriched: ${skip} streamers`);
    }

    logger.info('✅ Completed full database advanced enrichment');
  }
}

export default new AdvancedEnrichmentService();
