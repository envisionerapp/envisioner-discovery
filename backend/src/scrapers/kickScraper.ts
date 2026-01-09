import { Browser, Page, chromium } from 'playwright';
import { logger } from '../utils/database';
import { Platform, Region, FraudStatus } from '@prisma/client';

interface KickStreamData {
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

interface KickApiResponse {
  user?: {
    id: number;
    username: string;
    slug: string;
    profile_pic?: string;
    follower_count: number;
    following_count: number;
    verified: boolean;
    bio?: string;
  };
  channel?: {
    id: number;
    user_id: number;
    slug: string;
    is_live: boolean;
    viewer_count?: number;
    category?: {
      id: number;
      name: string;
      slug: string;
    };
    livestream?: {
      id: number;
      title: string;
      language: string;
      is_mature: boolean;
      viewer_count: number;
      created_at: string;
      session_title: string;
      source?: string;
      playback_url: string;
      thumbnail?: {
        responsive: string;
        url: string;
      };
    };
  };
}

export class KickScraper {
  private browser: Browser | null = null;
  private readonly BASE_URL = 'https://kick.com';
  private readonly API_BASE = 'https://kick.com/api/v1';

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
          '--disable-gpu',
          '--disable-features=VizDisplayCompositor'
        ],
      });
    }
  }

  private async fetchKickApiData(username: string): Promise<KickApiResponse | null> {
    try {
      const userResponse = await fetch(`${this.API_BASE}/users/${username}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/json',
        },
      });

      if (!userResponse.ok) {
        return null;
      }

      const userData: any = await userResponse.json();
      const user = userData;

      if (!user || !user.id) {
        return null;
      }

      const channelResponse = await fetch(`${this.API_BASE}/channels/${username}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/json',
        },
      });

      let channel = null;
      if (channelResponse.ok) {
        channel = await channelResponse.json() as any;
      }

      return { user, channel };
    } catch (error) {
      logger.error(`Error fetching Kick API data for ${username}:`, error);
      return null;
    }
  }

  private async scrapeKickPageData(username: string, page: Page): Promise<Partial<KickStreamData> | null> {
    try {
      await page.goto(`${this.BASE_URL}/${username}`, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      await page.waitForTimeout(3000);

      const pageData = await page.evaluate(() => {
        const extractFollowers = (): number => {
          const followersText = document.querySelector('[data-testid="followers-count"]')?.textContent ||
                                document.querySelector('.text-alt-2:contains("Followers")')?.textContent;
          if (!followersText) return 0;

          const match = followersText.match(/([\d,]+\.?\d*[KMB]?)/i);
          if (!match) return 0;

          const value = match[1].replace(/,/g, '');
          const num = parseFloat(value);

          if (value.includes('K')) return Math.floor(num * 1000);
          if (value.includes('M')) return Math.floor(num * 1000000);
          if (value.includes('B')) return Math.floor(num * 1000000000);

          return Math.floor(num);
        };

        const extractViewers = (): number => {
          const viewersText = document.querySelector('[data-testid="viewer-count"]')?.textContent ||
                             document.querySelector('.text-danger')?.textContent;
          if (!viewersText) return 0;

          const match = viewersText.match(/([\d,]+)/);
          return match ? parseInt(match[1].replace(/,/g, ''), 10) : 0;
        };

        const isLive = (): boolean => {
          return document.querySelector('[data-testid="live-indicator"]') !== null ||
                 document.querySelector('.bg-danger') !== null ||
                 document.querySelector('.text-danger:contains("LIVE")') !== null;
        };

        const getGameName = (): string | undefined => {
          return document.querySelector('[data-testid="category-name"]')?.textContent?.trim() ||
                 document.querySelector('.category-link')?.textContent?.trim() || undefined;
        };

        const getDisplayName = (): string => {
          return document.querySelector('[data-testid="channel-name"] h1')?.textContent?.trim() ||
                 document.querySelector('.channel-header h1')?.textContent?.trim() || '';
        };

        const getAvatarUrl = (): string | undefined => {
          const img = document.querySelector('[data-testid="channel-avatar"] img, .avatar img') as HTMLImageElement;
          return img?.src;
        };

        const getBio = (): string => {
          return document.querySelector('[data-testid="channel-bio"]')?.textContent?.trim() ||
                 document.querySelector('.channel-description')?.textContent?.trim() || '';
        };

        const getStreamTitle = (): string => {
          return document.querySelector('[data-testid="stream-title"]')?.textContent?.trim() ||
                 document.querySelector('.stream-title')?.textContent?.trim() || '';
        };

        return {
          followers: extractFollowers(),
          currentViewers: extractViewers(),
          isLive: isLive(),
          currentGame: getGameName(),
          displayName: getDisplayName(),
          avatarUrl: getAvatarUrl(),
          bio: getBio(),
          streamTitle: getStreamTitle()
        };
      });

      return pageData;
    } catch (error) {
      logger.error(`Error scraping Kick page for ${username}:`, error);
      return null;
    }
  }

  private detectRegionFromBio(bio?: string, language?: string): Region {
    if (bio) {
      const bioLower = bio.toLowerCase();
      if (bioLower.includes('méxico') || bioLower.includes('mexico')) return Region.MEXICO;
      if (bioLower.includes('colombia')) return Region.COLOMBIA;
      if (bioLower.includes('argentina')) return Region.ARGENTINA;
      if (bioLower.includes('chile')) return Region.CHILE;
      if (bioLower.includes('perú') || bioLower.includes('peru')) return Region.PERU;
      if (bioLower.includes('venezuela')) return Region.VENEZUELA;
      if (bioLower.includes('ecuador')) return Region.ECUADOR;
      if (bioLower.includes('bolivia')) return Region.BOLIVIA;
      if (bioLower.includes('paraguay')) return Region.PARAGUAY;
      if (bioLower.includes('uruguay')) return Region.URUGUAY;
    }

    const langRegionMap: Record<string, Region> = {
      'es': Region.MEXICO,
      'pt': Region.ARGENTINA,
      'en': Region.MEXICO,
    };

    return langRegionMap[language || 'es'] || Region.MEXICO;
  }

  private detectTags(category?: string, streamTitle?: string, bio?: string): string[] {
    const tags: Set<string> = new Set();
    const content = `${category || ''} ${streamTitle || ''} ${bio || ''}`.toLowerCase();

    if (content.includes('just chatting') || content.includes('talk') || content.includes('irl') || content.includes('charla')) {
      tags.add('IRL');
    }
    if (content.includes('gaming') || content.includes('juego') || content.includes('game')) {
      tags.add('GAMING');
    }
    if (content.includes('music') || content.includes('música') || content.includes('musica')) {
      tags.add('MUSIC');
    }
    if (content.includes('art') || content.includes('arte') || content.includes('drawing') || content.includes('painting')) {
      tags.add('ART');
    }
    if (content.includes('cooking') || content.includes('cocina') || content.includes('cook')) {
      tags.add('COOKING');
    }
    if (content.includes('fitness') || content.includes('gym') || content.includes('workout') || content.includes('exercise')) {
      tags.add('FITNESS');
    }
    if (content.includes('variety') || content.includes('variedad') || content.includes('varios')) {
      tags.add('VARIETY');
    }
    if (content.includes('fps') || content.includes('shooter') || content.includes('valorant') || content.includes('csgo')) {
      tags.add('FPS');
    }
    if (content.includes('rpg') || content.includes('role') || content.includes('adventure')) {
      tags.add('RPG');
    }
    if (content.includes('strategy') || content.includes('estrategia')) {
      tags.add('STRATEGY');
    }

    return Array.from(tags);
  }

  async scrapeStreamers(usernames: string[]): Promise<KickStreamData[]> {
    await this.initialize();

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const results: KickStreamData[] = [];
    const context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    });

    try {
      for (const username of usernames) {
        try {
          logger.info(`Scraping Kick data for: ${username}`);

          const apiData = await this.fetchKickApiData(username);
          const page = await context.newPage();
          const pageData = await this.scrapeKickPageData(username, page);
          await page.close();

          if (!apiData?.user && !pageData) {
            logger.warn(`No data found for Kick user: ${username}`);
            continue;
          }

          const user = apiData?.user;
          const channel = apiData?.channel;
          const livestream = channel?.livestream;

          const streamData: KickStreamData = {
            username: username.toLowerCase(),
            displayName: user?.username || pageData?.displayName || username,
            profileUrl: `${this.BASE_URL}/${username}`,
            avatarUrl: user?.profile_pic || pageData?.avatarUrl,
            followers: user?.follower_count || pageData?.followers || 0,
            currentViewers: livestream?.viewer_count || channel?.viewer_count || pageData?.currentViewers,
            isLive: channel?.is_live || pageData?.isLive || false,
            currentGame: channel?.category?.name || pageData?.currentGame,
            lastStreamed: livestream?.created_at ? new Date(livestream.created_at) : undefined,
            language: livestream?.language || 'es',
            tags: this.detectTags(
              channel?.category?.name,
              livestream?.session_title || (pageData as any)?.streamTitle,
              user?.bio || (pageData as any)?.bio
            ),
            region: this.detectRegionFromBio(user?.bio || (pageData as any)?.bio, livestream?.language),
            usesCamera: true,
            isVtuber: (user?.bio || '').toLowerCase().includes('vtuber'),
            socialLinks: [],
            streamTitle: livestream?.session_title || (pageData as any)?.streamTitle
          };

          results.push(streamData);
          logger.info(`Successfully scraped data for ${username}: ${streamData.followers} followers, live: ${streamData.isLive}`);

          await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
        } catch (error) {
          logger.error(`Error scraping ${username}:`, error);
        }
      }
    } finally {
      await context.close();
    }

    logger.info(`Kick scraping completed: ${results.length}/${usernames.length} streamers`);
    return results;
  }

  async scrapeTrendingStreamers(limit: number = 20): Promise<KickStreamData[]> {
    await this.initialize();

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const context = await this.browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto(`${this.BASE_URL}/categories/just-chatting`, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      await page.waitForTimeout(3000);

      const streamers = await page.evaluate((limit) => {
        const channelElements = document.querySelectorAll('[data-testid="channel-card"], .channel-card');
        const results: string[] = [];

        for (let i = 0; i < Math.min(channelElements.length, limit); i++) {
          const element = channelElements[i];
          const link = element.querySelector('a[href*="/"]')?.getAttribute('href');
          if (link) {
            const username = link.split('/').pop();
            if (username && !username.includes('?') && !username.includes('#')) {
              results.push(username);
            }
          }
        }

        return [...new Set(results)];
      }, limit);

      await context.close();

      return await this.scrapeStreamers(streamers.slice(0, limit));
    } catch (error) {
      logger.error('Error scraping trending Kick streamers:', error);
      await context.close();
      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.initialize();
      const response = await fetch(`${this.API_BASE}/channels/xqc`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      return response.ok;
    } catch (error) {
      logger.error('KickScraper health check failed:', error);
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