import { Browser, Page, chromium } from 'playwright';
import { logger } from '../utils/database';
import { Platform, Region, FraudStatus } from '@prisma/client';

interface YouTubeStreamData {
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

interface YouTubeApiResponse {
  channel?: {
    id: string;
    title: string;
    description: string;
    thumbnail: string;
    subscriberCount: number;
    videoCount: number;
    viewCount: number;
    country?: string;
  };
  liveStream?: {
    title: string;
    viewerCount: number;
    scheduledStartTime: string;
    actualStartTime?: string;
    isLiveBroadcast: boolean;
  };
}

export class YouTubeScraper {
  private browser: Browser | null = null;
  private readonly BASE_URL = 'https://www.youtube.com';
  private readonly API_KEY = process.env.YOUTUBE_API_KEY;
  private readonly API_BASE = 'https://www.googleapis.com/youtube/v3';

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

  private async fetchYouTubeApiData(channelHandle: string): Promise<YouTubeApiResponse | null> {
    if (!this.API_KEY) {
      logger.warn('YouTube API key not configured, using web scraping only');
      return null;
    }

    try {
      const searchResponse = await fetch(
        `${this.API_BASE}/search?part=snippet&type=channel&q=${encodeURIComponent(channelHandle)}&key=${this.API_KEY}`
      );

      if (!searchResponse.ok) {
        return null;
      }

      const searchData: any = await searchResponse.json();
      const channelData = searchData.items?.[0];

      if (!channelData) {
        return null;
      }

      const channelId = channelData.id.channelId;

      const [channelResponse, liveResponse] = await Promise.all([
        fetch(
          `${this.API_BASE}/channels?part=snippet,statistics&id=${channelId}&key=${this.API_KEY}`
        ),
        fetch(
          `${this.API_BASE}/search?part=snippet&channelId=${channelId}&type=video&eventType=live&key=${this.API_KEY}`
        )
      ]);

      let channel: YouTubeApiResponse['channel'] | undefined = undefined;
      if (channelResponse.ok) {
        const channelInfo: any = await channelResponse.json();
        const channelDetails = channelInfo.items?.[0];
        if (channelDetails) {
          channel = {
            id: channelDetails.id,
            title: channelDetails.snippet.title,
            description: channelDetails.snippet.description,
            thumbnail: channelDetails.snippet.thumbnails.medium?.url,
            subscriberCount: parseInt(channelDetails.statistics.subscriberCount) || 0,
            videoCount: parseInt(channelDetails.statistics.videoCount) || 0,
            viewCount: parseInt(channelDetails.statistics.viewCount) || 0,
            country: channelDetails.snippet.country,
          };
        }
      }

      let liveStream: YouTubeApiResponse['liveStream'] | undefined = undefined;
      if (liveResponse.ok) {
        const liveData: any = await liveResponse.json();
        const liveVideo = liveData.items?.[0];
        if (liveVideo) {
          const videoId = liveVideo.id.videoId;
          const videoResponse = await fetch(
            `${this.API_BASE}/videos?part=snippet,liveStreamingDetails&id=${videoId}&key=${this.API_KEY}`
          );

          if (videoResponse.ok) {
            const videoData: any = await videoResponse.json();
            const video = videoData.items?.[0];
            if (video) {
              liveStream = {
                title: video.snippet.title,
                viewerCount: parseInt(video.liveStreamingDetails?.concurrentViewers) || 0,
                scheduledStartTime: video.liveStreamingDetails?.scheduledStartTime,
                actualStartTime: video.liveStreamingDetails?.actualStartTime,
                isLiveBroadcast: video.snippet.liveBroadcastContent === 'live'
              };
            }
          }
        }
      }

      return { channel: channel || undefined, liveStream: liveStream || undefined };
    } catch (error) {
      logger.error(`Error fetching YouTube API data for ${channelHandle}:`, error);
      return null;
    }
  }

  private async scrapeYouTubePageData(channelHandle: string, page: Page): Promise<Partial<YouTubeStreamData> | null> {
    try {
      const channelUrl = channelHandle.startsWith('@')
        ? `${this.BASE_URL}/${channelHandle}`
        : `${this.BASE_URL}/c/${channelHandle}`;

      await page.goto(channelUrl, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      await page.waitForTimeout(3000);

      const pageData = await page.evaluate(() => {
        const extractSubscribers = (): number => {
          const subsText = document.querySelector('#subscriber-count')?.textContent;
          if (!subsText) return 0;

          const match = subsText.match(/([\d,]+\.?\d*[KMB]?)/i);
          if (!match) return 0;

          const value = match[1].replace(/,/g, '');
          const num = parseFloat(value);

          if (value.includes('K')) return Math.floor(num * 1000);
          if (value.includes('M')) return Math.floor(num * 1000000);
          if (value.includes('B')) return Math.floor(num * 1000000000);

          return Math.floor(num);
        };

        const isLive = (): boolean => {
          return document.querySelector('[aria-label*="LIVE"]') !== null ||
                 document.querySelector('.badge-style-type-live-now') !== null;
        };

        const getDisplayName = (): string => {
          return document.querySelector('#channel-name')?.textContent?.trim() ||
                 document.querySelector('.ytd-channel-name h1')?.textContent?.trim() || '';
        };

        const getAvatarUrl = (): string | undefined => {
          const img = document.querySelector('#avatar img, .ytd-c4-tabbed-header-renderer img') as HTMLImageElement;
          return img?.src;
        };

        const getDescription = (): string => {
          return document.querySelector('#description-container')?.textContent?.trim() ||
                 document.querySelector('.about-description')?.textContent?.trim() || '';
        };

        const getCurrentViewers = (): number => {
          const viewersText = document.querySelector('[class*="watching"]')?.textContent;
          if (!viewersText) return 0;

          const match = viewersText.match(/([\d,]+)/);
          return match ? parseInt(match[1].replace(/,/g, ''), 10) : 0;
        };

        return {
          followers: extractSubscribers(),
          isLive: isLive(),
          displayName: getDisplayName(),
          avatarUrl: getAvatarUrl(),
          description: getDescription(),
          currentViewers: getCurrentViewers()
        };
      });

      return pageData;
    } catch (error) {
      logger.error(`Error scraping YouTube page for ${channelHandle}:`, error);
      return null;
    }
  }

  private detectRegionFromCountry(country?: string, description?: string): Region {
    const countryRegionMap: Record<string, Region> = {
      'MX': Region.MEXICO,
      'CO': Region.COLOMBIA,
      'AR': Region.ARGENTINA,
      'CL': Region.CHILE,
      'PE': Region.PERU,
      'VE': Region.VENEZUELA,
      'EC': Region.ECUADOR,
      'BO': Region.BOLIVIA,
      'PY': Region.PARAGUAY,
      'UY': Region.URUGUAY,
      'CR': Region.COSTA_RICA,
      'PA': Region.PANAMA,
      'GT': Region.GUATEMALA,
      'SV': Region.EL_SALVADOR,
      'HN': Region.HONDURAS,
      'NI': Region.NICARAGUA,
      'DO': Region.DOMINICAN_REPUBLIC,
      'PR': Region.PUERTO_RICO,
    };

    if (country && countryRegionMap[country]) {
      return countryRegionMap[country];
    }

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

    return Region.MEXICO;
  }

  private detectTags(title?: string, description?: string): string[] {
    const tags: Set<string> = new Set();
    const content = `${title || ''} ${description || ''}`.toLowerCase();

    if (content.includes('gaming') || content.includes('juego') || content.includes('gameplay')) {
      tags.add('GAMING');
    }
    if (content.includes('music') || content.includes('música') || content.includes('song')) {
      tags.add('MUSIC');
    }
    if (content.includes('art') || content.includes('arte') || content.includes('drawing') || content.includes('painting')) {
      tags.add('ART');
    }
    if (content.includes('cooking') || content.includes('cocina') || content.includes('recipe')) {
      tags.add('COOKING');
    }
    if (content.includes('fitness') || content.includes('gym') || content.includes('workout')) {
      tags.add('FITNESS');
    }
    if (content.includes('education') || content.includes('educational') || content.includes('tutorial')) {
      tags.add('EDUCATION');
    }
    if (content.includes('technology') || content.includes('tech') || content.includes('programming')) {
      tags.add('TECHNOLOGY');
    }
    if (content.includes('variety') || content.includes('variedad')) {
      tags.add('VARIETY');
    }
    if (content.includes('vlog') || content.includes('daily life') || content.includes('vida diaria')) {
      tags.add('IRL');
    }

    return Array.from(tags);
  }

  async scrapeStreamers(channelHandles: string[]): Promise<YouTubeStreamData[]> {
    await this.initialize();

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const results: YouTubeStreamData[] = [];
    const context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    });

    try {
      for (const channelHandle of channelHandles) {
        try {
          logger.info(`Scraping YouTube data for: ${channelHandle}`);

          const apiData = await this.fetchYouTubeApiData(channelHandle);
          const page = await context.newPage();
          const pageData = await this.scrapeYouTubePageData(channelHandle, page);
          await page.close();

          if (!apiData?.channel && !pageData) {
            logger.warn(`No data found for YouTube channel: ${channelHandle}`);
            continue;
          }

          const channel = apiData?.channel;
          const liveStream = apiData?.liveStream;

          const cleanHandle = channelHandle.startsWith('@') ? channelHandle.slice(1) : channelHandle;

          const streamData: YouTubeStreamData = {
            username: cleanHandle,
            displayName: channel?.title || pageData?.displayName || channelHandle,
            profileUrl: `${this.BASE_URL}/${channelHandle.startsWith('@') ? channelHandle : `c/${channelHandle}`}`,
            avatarUrl: channel?.thumbnail || pageData?.avatarUrl,
            followers: channel?.subscriberCount || pageData?.followers || 0,
            currentViewers: liveStream?.viewerCount || pageData?.currentViewers,
            isLive: liveStream?.isLiveBroadcast || pageData?.isLive || false,
            currentGame: liveStream?.title,
            lastStreamed: liveStream?.actualStartTime ? new Date(liveStream.actualStartTime) : undefined,
            language: 'es',
            tags: this.detectTags(liveStream?.title, channel?.description),
            region: this.detectRegionFromCountry(channel?.country, channel?.description),
            usesCamera: true,
            isVtuber: (channel?.description || '').toLowerCase().includes('vtuber'),
            socialLinks: [],
            streamTitle: liveStream?.title
          };

          results.push(streamData);
          logger.info(`Successfully scraped data for ${channelHandle}: ${streamData.followers} subscribers, live: ${streamData.isLive}`);

          await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 2000));
        } catch (error) {
          logger.error(`Error scraping ${channelHandle}:`, error);
        }
      }
    } finally {
      await context.close();
    }

    logger.info(`YouTube scraping completed: ${results.length}/${channelHandles.length} channels`);
    return results;
  }

  async scrapeTrendingStreamers(limit: number = 30): Promise<YouTubeStreamData[]> {
    await this.initialize();

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const context = await this.browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto(`${this.BASE_URL}/results?search_query=gaming+live&sp=EgJAAQ%253D%253D`, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      await page.waitForTimeout(3000);

      const channels = await page.evaluate((limit) => {
        const channelElements = document.querySelectorAll('ytd-video-renderer, ytd-grid-video-renderer');
        const results: string[] = [];

        for (let i = 0; i < Math.min(channelElements.length, limit); i++) {
          const element = channelElements[i];
          const channelLink = element.querySelector('a[href*="/channel/"], a[href*="/@"]')?.getAttribute('href');
          if (channelLink) {
            if (channelLink.includes('/@')) {
              const handle = channelLink.split('/@')[1]?.split('/')[0];
              if (handle) results.push(`@${handle}`);
            } else if (channelLink.includes('/channel/')) {
              const channelId = channelLink.split('/channel/')[1]?.split('/')[0];
              if (channelId) results.push(channelId);
            }
          }
        }

        return [...new Set(results)];
      }, limit);

      await context.close();

      return await this.scrapeStreamers(channels.slice(0, limit));
    } catch (error) {
      logger.error('Error scraping trending YouTube streamers:', error);
      await context.close();
      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.initialize();
      return true;
    } catch (error) {
      logger.error('YouTubeScraper health check failed:', error);
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
