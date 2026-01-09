import { Browser, Page, chromium } from 'playwright';
import { logger } from '../utils/database';
import { Platform, Region, FraudStatus } from '@prisma/client';

interface TwitchStreamData {
  username: string;
  displayName: string;
  profileUrl: string;
  avatarUrl?: string;
  followers: number;
  currentViewers?: number;
  isLive: boolean;
  currentGame?: string;
  lastStreamed?: Date;
  language: string;
  tags: string[];
  region: Region;
  usesCamera: boolean;
  isVtuber: boolean;
  socialLinks: any[];
  streamTitle?: string;
}

interface TwitchApiResponse {
  user?: {
    login: string;
    display_name: string;
    profile_image_url: string;
    description: string;
    view_count: number;
    follower_count: number;
    broadcaster_language: string;
    created_at: string;
  };
  stream?: {
    viewer_count: number;
    game_name: string;
    title: string;
    started_at: string;
    is_mature: boolean;
    language: string;
  };
}

export class TwitchScraper {
  private browser: Browser | null = null;
  private readonly BASE_URL = 'https://www.twitch.tv';
  private readonly API_BASE = 'https://api.twitch.tv/helix';
  private readonly CLIENT_ID = process.env.TWITCH_CLIENT_ID;
  private readonly CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
  private accessToken: string | null = null;

  async initialize(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ],
      });

      await this.getAccessToken();
    }
  }

  private async getAccessToken(): Promise<void> {
    if (!this.CLIENT_ID || !this.CLIENT_SECRET) {
      logger.warn('Twitch API credentials not configured, using web scraping only');
      return;
    }

    try {
      const response = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.CLIENT_ID,
          client_secret: this.CLIENT_SECRET,
          grant_type: 'client_credentials',
        }),
      });

      if (response.ok) {
        const data: any = await response.json();
        this.accessToken = data.access_token;
        logger.info('Twitch API access token obtained');
      }
    } catch (error) {
      logger.error('Failed to get Twitch access token:', error);
    }
  }

  private async fetchTwitchApiData(username: string): Promise<TwitchApiResponse | null> {
    if (!this.accessToken || !this.CLIENT_ID) {
      return null;
    }

    try {
      const userResponse = await fetch(`${this.API_BASE}/users?login=${username}`, {
        headers: {
          'Client-ID': this.CLIENT_ID,
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      if (!userResponse.ok) {
        return null;
      }

      const userData: any = await userResponse.json();
      const user = userData.data?.[0];

      if (!user) {
        return null;
      }

      const streamResponse = await fetch(`${this.API_BASE}/streams?user_login=${username}`, {
        headers: {
          'Client-ID': this.CLIENT_ID,
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      let stream = null;
      if (streamResponse.ok) {
        const streamData: any = await streamResponse.json();
        stream = streamData.data?.[0];
      }

      return { user, stream };
    } catch (error) {
      logger.error(`Error fetching Twitch API data for ${username}:`, error);
      return null;
    }
  }

  private async scrapeTwitchPageData(username: string, page: Page): Promise<Partial<TwitchStreamData> | null> {
    try {
      await page.goto(`${this.BASE_URL}/${username}`, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      await page.waitForTimeout(2000);

      const pageData = await page.evaluate(() => {
        const extractFollowers = (): number => {
          // Try multiple selectors for followers count
          const selectors = [
            '[data-test-selector="followers-count"]',
            '[data-a-target="followers-count"]',
            '.followers-count',
            '[aria-label*="follower"]',
            '.tw-stat-value',
            '[data-test-selector="channel-info-content"] p'
          ];

          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element?.textContent) {
              const text = element.textContent.toLowerCase();
              const match = text.match(/([\d,\.]+)\s*[km]?\s*follower/i) || text.match(/([\d,\.]+)\s*[km]?/);
              if (match) {
                let number = parseFloat(match[1].replace(/,/g, ''));
                if (text.includes('k')) number *= 1000;
                if (text.includes('m')) number *= 1000000;
                return Math.floor(number);
              }
            }
          }

          // Fallback: look for any text containing follower count patterns
          const bodyText = document.body.textContent || '';
          const followerMatch = bodyText.match(/(\d{1,3}(?:,\d{3})*|\d+(?:\.\d+)?[km]?)\s*followers?/i);
          if (followerMatch) {
            let number = parseFloat(followerMatch[1].replace(/,/g, ''));
            const text = followerMatch[0].toLowerCase();
            if (text.includes('k')) number *= 1000;
            if (text.includes('m')) number *= 1000000;
            return Math.floor(number);
          }

          return 0;
        };

        const extractViewers = (): number => {
          // Try multiple selectors for viewer count
          const selectors = [
            '[data-test-selector="viewers-count"]',
            '[data-a-target="viewers-count"]',
            '.viewer-count',
            '[aria-label*="viewer"]',
            '.tw-stat-value'
          ];

          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element?.textContent) {
              const text = element.textContent.toLowerCase();
              const match = text.match(/([\d,\.]+)\s*[km]?\s*viewer/i) || text.match(/([\d,\.]+)\s*[km]?/);
              if (match) {
                let number = parseFloat(match[1].replace(/,/g, ''));
                if (text.includes('k')) number *= 1000;
                if (text.includes('m')) number *= 1000000;
                return Math.floor(number);
              }
            }
          }

          return 0;
        };

        const isLive = (): boolean => {
          const liveSelectors = [
            '[data-test-selector="live-indicator"]',
            '[data-a-target="live-indicator"]',
            '.live-indicator',
            '[aria-label*="live"]',
            '.tw-channel-status-indicator--live',
            '.stream-type-indicator'
          ];

          return liveSelectors.some(selector => document.querySelector(selector) !== null) ||
                 (document.body.textContent || '').toLowerCase().includes('live') &&
                 !(document.body.textContent || '').toLowerCase().includes('offline');
        };

        const getGameName = (): string | undefined => {
          return document.querySelector('[data-test-selector="stream-game-link"]')?.textContent?.trim() || undefined;
        };

        const getDisplayName = (): string => {
          return document.querySelector('[data-test-selector="channel-display-name"]')?.textContent?.trim() || '';
        };

        const getAvatarUrl = (): string | undefined => {
          const img = document.querySelector('[data-test-selector="channel-avatar"] img') as HTMLImageElement;
          return img?.src;
        };

        const getDescription = (): string => {
          return document.querySelector('[data-test-selector="channel-description"]')?.textContent?.trim() || '';
        };

        return {
          followers: extractFollowers(),
          currentViewers: extractViewers(),
          isLive: isLive(),
          currentGame: getGameName(),
          displayName: getDisplayName(),
          avatarUrl: getAvatarUrl(),
          description: getDescription()
        };
      });

      return pageData;
    } catch (error) {
      logger.error(`Error scraping Twitch page for ${username}:`, error);
      return null;
    }
  }

  private detectRegionFromLanguage(language: string, description?: string): Region {
    const langRegionMap: Record<string, Region[]> = {
      'es': [Region.MEXICO, Region.COLOMBIA, Region.ARGENTINA, Region.CHILE],
      'pt': [Region.ARGENTINA],
      'en': [Region.MEXICO],
    };

    if (description) {
      const desc = description.toLowerCase();
      if (desc.includes('méxico') || desc.includes('mexico')) return Region.MEXICO;
      if (desc.includes('colombia')) return Region.COLOMBIA;
      if (desc.includes('argentina')) return Region.ARGENTINA;
      if (desc.includes('chile')) return Region.CHILE;
      if (desc.includes('perú') || desc.includes('peru')) return Region.PERU;
      if (desc.includes('venezuela')) return Region.VENEZUELA;
      if (desc.includes('ecuador')) return Region.ECUADOR;
    }

    const regions = langRegionMap[language] || [Region.MEXICO];
    return regions[0];
  }

  private detectTags(gameNames: string[], description?: string): string[] {
    const tags: Set<string> = new Set();
    const content = `${gameNames.join(' ')} ${description || ''}`.toLowerCase();

    if (content.includes('just chatting') || content.includes('talk') || content.includes('irl')) {
      tags.add('IRL');
    }
    if (content.includes('music') || content.includes('música')) {
      tags.add('MUSIC');
    }
    if (content.includes('art') || content.includes('arte') || content.includes('drawing')) {
      tags.add('ART');
    }
    if (content.includes('cooking') || content.includes('cocina')) {
      tags.add('COOKING');
    }
    if (content.includes('fitness') || content.includes('gym')) {
      tags.add('FITNESS');
    }
    if (content.includes('league of legends') || content.includes('valorant') || content.includes('csgo')) {
      tags.add('FPS');
    }
    if (content.includes('minecraft') || content.includes('fortnite')) {
      tags.add('GAMING');
    }

    return Array.from(tags);
  }

  async scrapeStreamers(usernames: string[]): Promise<TwitchStreamData[]> {
    await this.initialize();

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const results: TwitchStreamData[] = [];
    const context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    });

    try {
      for (const username of usernames) {
        try {
          logger.info(`Scraping Twitch data for: ${username}`);

          const apiData = await this.fetchTwitchApiData(username);
          const page = await context.newPage();
          const pageData = await this.scrapeTwitchPageData(username, page);
          await page.close();

          if (!apiData?.user && !pageData) {
            logger.warn(`No data found for Twitch user: ${username}`);
            continue;
          }

          const user = apiData?.user;
          const stream = apiData?.stream;

          const streamData: TwitchStreamData = {
            username: username.toLowerCase(),
            displayName: user?.display_name || pageData?.displayName || username,
            profileUrl: `${this.BASE_URL}/${username}`,
            avatarUrl: user?.profile_image_url || pageData?.avatarUrl,
            followers: user?.follower_count || pageData?.followers || 0,
            currentViewers: stream?.viewer_count || pageData?.currentViewers,
            isLive: !!stream || pageData?.isLive || false,
            currentGame: stream?.game_name || pageData?.currentGame,
            lastStreamed: stream ? new Date(stream.started_at) : undefined,
            language: user?.broadcaster_language || 'es',
            tags: this.detectTags([stream?.game_name || pageData?.currentGame || ''].filter(Boolean), user?.description),
            region: this.detectRegionFromLanguage(user?.broadcaster_language || 'es', user?.description),
            usesCamera: !!(stream?.game_name === 'Just Chatting' || stream?.game_name === 'Music'),
            isVtuber: (user?.description || '').toLowerCase().includes('vtuber'),
            socialLinks: [],
            streamTitle: stream?.title
          };

          results.push(streamData);
          logger.info(`Successfully scraped data for ${username}: ${streamData.followers} followers, live: ${streamData.isLive}`);

          await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
        } catch (error) {
          logger.error(`Error scraping ${username}:`, error);
        }
      }
    } finally {
      await context.close();
    }

    logger.info(`Twitch scraping completed: ${results.length}/${usernames.length} streamers`);
    return results;
  }

  async scrapeTrendingStreamers(limit: number = 50): Promise<TwitchStreamData[]> {
    await this.initialize();

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const context = await this.browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto(`${this.BASE_URL}/directory/game/Just%20Chatting`, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      await page.waitForTimeout(3000);

      const streamers = await page.evaluate((limit) => {
        const streamElements = document.querySelectorAll('[data-test-selector="stream-thumbnail"]');
        const results: string[] = [];

        for (let i = 0; i < Math.min(streamElements.length, limit); i++) {
          const element = streamElements[i];
          const link = element.querySelector('a[href*="/"]')?.getAttribute('href');
          if (link) {
            const username = link.split('/').pop();
            if (username) {
              results.push(username);
            }
          }
        }

        return results;
      }, limit);

      await context.close();

      return await this.scrapeStreamers(streamers.slice(0, limit));
    } catch (error) {
      logger.error('Error scraping trending Twitch streamers:', error);
      await context.close();
      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.initialize();
      return true;
    } catch (error) {
      logger.error('TwitchScraper health check failed:', error);
      return false;
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}