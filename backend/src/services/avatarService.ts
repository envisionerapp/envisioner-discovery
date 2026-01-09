import { Browser, Page, chromium } from 'playwright';
import { logger } from '../utils/database';
import { Platform } from '@prisma/client';

interface AvatarResult {
  username: string;
  platform: Platform;
  avatarUrl: string | null;
  success: boolean;
  error?: string;
}

export class AvatarService {
  private browser: Browser | null = null;

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
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ],
      });
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private async fetchTwitchAvatar(username: string, page: Page): Promise<string | null> {
    try {
      await page.goto(`https://www.twitch.tv/${username}`, {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      });

      await page.waitForTimeout(3000); // Increased wait time for better loading

      const avatarUrl = await page.evaluate((username) => {
        // Known default/generic Twitch avatar IDs to avoid
        const defaultAvatarIds = [
          '46a38d3a-a39c-4c43-ac12-c331b1c469c2', // Most common default
          '41263278-9819-4b00-ba22-1a8e86ec656c', // Another common default
          'bf6a04cf-3f44-4986-8eed-5c36bfad542b', // Another generic avatar (found in testing)
          '9f431098-e65f-4983-a52c-056223a2fdf6', // Another repeated generic avatar
          '0e09ed56-067f-465a-95db-a8b8c80fdc2a', // Generic avatar
          '38d3c5b2-bfe5-4e85-a1b4-3ee7da45b8e9', // Generic avatar
        ];

        const isValidAvatar = (src: string) => {
          if (!src || !src.includes('profile_image')) return false;
          // Check if it's a generic/default avatar
          return !defaultAvatarIds.some(id => src.includes(id));
        };

        // Strategy 1: Look for channel owner's avatar in the channel header area
        let channelAvatar = document.querySelector('[data-a-target="channel-header-avatar"] img, [data-a-target="channel-header-right"] img[src*="profile_image"]') as HTMLImageElement;
        if (channelAvatar?.src && isValidAvatar(channelAvatar.src)) {
          return channelAvatar.src;
        }

        // Strategy 2: Look in the about section specifically for channel owner
        let aboutAvatar = document.querySelector('[data-a-target="about-panel"] img[src*="profile_image"]') as HTMLImageElement;
        if (aboutAvatar?.src && isValidAvatar(aboutAvatar.src)) {
          return aboutAvatar.src;
        }

        // Strategy 3: Look for channel info bar avatar
        let infoBarAvatar = document.querySelector('[data-a-target="channel-info-bar"] img[src*="profile_image"]') as HTMLImageElement;
        if (infoBarAvatar?.src && isValidAvatar(infoBarAvatar.src)) {
          return infoBarAvatar.src;
        }

        // Strategy 4: Look for larger avatars that are likely channel owners (not chat participants)
        const allProfileImages = Array.from(document.querySelectorAll('img[src*="profile_image"]')) as HTMLImageElement[];

        if (allProfileImages.length > 0) {
          // Filter for larger images (channel owner avatars are typically 70x70 or bigger)
          const largerImages = allProfileImages.filter(img => {
            const rect = img.getBoundingClientRect();
            return rect.width >= 60 && rect.height >= 60 && isValidAvatar(img.src);
          });

          if (largerImages.length > 0) {
            // Sort by size (biggest first) and return the largest valid one
            largerImages.sort((a, b) => {
              const aSize = a.getBoundingClientRect().width * a.getBoundingClientRect().height;
              const bSize = b.getBoundingClientRect().width * b.getBoundingClientRect().height;
              return bSize - aSize;
            });
            return largerImages[0].src;
          }

          // Strategy 5: Look for any valid non-default avatar as last resort
          const validImages = allProfileImages.filter(img => isValidAvatar(img.src));
          if (validImages.length > 0) {
            // Return the first valid one we find
            return validImages[0].src;
          }
        }

        // If we only found default avatars, return null instead of generic ones
        return null;
      }, username);

      return avatarUrl;
    } catch (error) {
      logger.error(`Error fetching Twitch avatar for ${username}:`, error);
      return null;
    }
  }

  private async fetchYouTubeAvatar(username: string, page: Page): Promise<string | null> {
    try {
      // Try both @username and channel formats
      const urls = [
        `https://www.youtube.com/@${username}`,
        `https://www.youtube.com/c/${username}`,
        `https://www.youtube.com/channel/${username}`,
        `https://www.youtube.com/user/${username}`
      ];

      for (const url of urls) {
        try {
          await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: 30000
          });

          await page.waitForTimeout(2000);

          const avatarUrl = await page.evaluate(() => {
            const selectors = [
              '#avatar img',
              '.ytd-c4-tabbed-header-renderer img',
              '#channel-header img',
              '.channel-header-profile-image img',
              'img[id*="avatar"]',
              'img[src*="yt3.ggpht.com"]',
              'img[src*="googleusercontent.com"]'
            ];

            for (const selector of selectors) {
              const img = document.querySelector(selector) as HTMLImageElement;
              if (img?.src && (img.src.includes('yt3.ggpht.com') || img.src.includes('googleusercontent.com'))) {
                return img.src;
              }
            }

            return null;
          });

          if (avatarUrl) {
            return avatarUrl;
          }
        } catch (error) {
          continue; // Try next URL format
        }
      }

      return null;
    } catch (error) {
      logger.error(`Error fetching YouTube avatar for ${username}:`, error);
      return null;
    }
  }

  private async fetchKickAvatar(username: string, page: Page): Promise<string | null> {
    try {
      await page.goto(`https://kick.com/${username}`, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      await page.waitForTimeout(3000);

      const avatarUrl = await page.evaluate(() => {
        const selectors = [
          'img[alt*="avatar"]',
          'img[alt*="profile"]',
          '.channel-avatar img',
          '.user-avatar img',
          '.profile-picture img',
          'img[src*="files.kick.com"]',
          'img[src*="kick.com/images"]',
          'img[src*="kick.com"]',
          'img[src*="profile"]',
          'img[class*="avatar"]',
          'img[class*="profile"]'
        ];

        for (const selector of selectors) {
          const img = document.querySelector(selector) as HTMLImageElement;
          if (img?.src &&
              (img.src.includes('kick.com') || img.src.includes('files.kick.com')) &&
              !img.src.includes('default') &&
              !img.src.includes('placeholder')) {
            return img.src;
          }
        }

        // Fallback: look for any reasonable image that might be an avatar
        const allImages = Array.from(document.querySelectorAll('img')) as HTMLImageElement[];
        for (const img of allImages) {
          if (img.src &&
              (img.src.includes('kick.com') || img.src.includes('files.kick.com')) &&
              !img.src.includes('default') &&
              !img.src.includes('placeholder') &&
              (img.width >= 40 || img.height >= 40)) {
            return img.src;
          }
        }

        return null;
      });

      return avatarUrl;
    } catch (error) {
      logger.error(`Error fetching Kick avatar for ${username}:`, error);
      return null;
    }
  }

  private async fetchFacebookAvatar(username: string, page: Page): Promise<string | null> {
    try {
      await page.goto(`https://www.facebook.com/gaming/${username}`, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      await page.waitForTimeout(2000);

      const avatarUrl = await page.evaluate(() => {
        const selectors = [
          '.profilePicture img',
          '.profile-pic img',
          'img[data-imgperflogname="profileCoverPhoto"]',
          'img[src*="facebook.com"]',
          'img[src*="fbcdn.net"]'
        ];

        for (const selector of selectors) {
          const img = document.querySelector(selector) as HTMLImageElement;
          if (img?.src && (img.src.includes('facebook.com') || img.src.includes('fbcdn.net'))) {
            return img.src;
          }
        }

        return null;
      });

      return avatarUrl;
    } catch (error) {
      logger.error(`Error fetching Facebook avatar for ${username}:`, error);
      return null;
    }
  }

  private async fetchTikTokAvatar(username: string, page: Page): Promise<string | null> {
    try {
      await page.goto(`https://www.tiktok.com/@${username}`, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      await page.waitForTimeout(3000);

      const avatarUrl = await page.evaluate(() => {
        const selectors = [
          '.avatar img',
          '.user-avatar img',
          '[data-e2e="user-avatar"] img',
          'img[src*="tiktokcdn.com"]',
          'img[src*="tiktok.com"]'
        ];

        for (const selector of selectors) {
          const img = document.querySelector(selector) as HTMLImageElement;
          if (img?.src && img.src.includes('tiktok') && !img.src.includes('default')) {
            return img.src;
          }
        }

        return null;
      });

      return avatarUrl;
    } catch (error) {
      logger.error(`Error fetching TikTok avatar for ${username}:`, error);
      return null;
    }
  }

  async fetchAvatar(username: string, platform: Platform): Promise<AvatarResult> {
    await this.initialize();

    if (!this.browser) {
      return {
        username,
        platform,
        avatarUrl: null,
        success: false,
        error: 'Browser not initialized'
      };
    }

    const context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    });

    try {
      const page = await context.newPage();

      let avatarUrl: string | null = null;

      switch (platform) {
        case Platform.TWITCH:
          avatarUrl = await this.fetchTwitchAvatar(username, page);
          break;
        case Platform.YOUTUBE:
          avatarUrl = await this.fetchYouTubeAvatar(username, page);
          break;
        case Platform.KICK:
          avatarUrl = await this.fetchKickAvatar(username, page);
          break;
        case Platform.FACEBOOK:
          avatarUrl = await this.fetchFacebookAvatar(username, page);
          break;
        case Platform.TIKTOK:
          avatarUrl = await this.fetchTikTokAvatar(username, page);
          break;
        default:
          return {
            username,
            platform,
            avatarUrl: null,
            success: false,
            error: `Unsupported platform: ${platform}`
          };
      }

      await page.close();

      return {
        username,
        platform,
        avatarUrl,
        success: !!avatarUrl,
        error: avatarUrl ? undefined : 'Avatar not found'
      };

    } catch (error) {
      logger.error(`Error fetching avatar for ${username} on ${platform}:`, error);
      return {
        username,
        platform,
        avatarUrl: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      await context.close();
    }
  }

  async fetchAvatarsBatch(streamers: Array<{ username: string; platform: Platform }>): Promise<AvatarResult[]> {
    await this.initialize();

    const results: AvatarResult[] = [];
    const batchSize = 5; // Process 5 at a time to avoid overwhelming the browser

    for (let i = 0; i < streamers.length; i += batchSize) {
      const batch = streamers.slice(i, i + batchSize);
      logger.info(`Processing avatar batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(streamers.length / batchSize)}: ${batch.length} streamers`);

      const batchPromises = batch.map(streamer => this.fetchAvatar(streamer.username, streamer.platform));
      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          logger.error('Avatar fetch failed:', result.reason);
          results.push({
            username: 'unknown',
            platform: Platform.TWITCH,
            avatarUrl: null,
            success: false,
            error: result.reason?.message || 'Promise rejected'
          });
        }
      }

      // Add delay between batches to be respectful to servers
      if (i + batchSize < streamers.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    return results;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.initialize();
      return !!this.browser;
    } catch (error) {
      logger.error('AvatarService health check failed:', error);
      return false;
    }
  }
}

export const avatarService = new AvatarService();