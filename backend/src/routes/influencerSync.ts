import express from 'express';
import { influencerSyncService } from '../services/influencerSyncService';
import { enrichLinkedInProfiles } from '../jobs/linkedinEnrichJob';
import { db } from '../utils/database';
import { Platform } from '@prisma/client';

const router = express.Router();

// Sync influencers from external table to discovery_creators
router.post('/sync', async (req, res) => {
  try {
    const result = await influencerSyncService.syncInfluencersToDiscovery();
    res.json({
      success: true,
      message: 'Sync completed',
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get pending sync count
router.get('/pending', async (req, res) => {
  try {
    const count = await influencerSyncService.getPendingSyncCount();
    res.json({
      success: true,
      data: { pendingCount: count },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Enrich LinkedIn profiles with followers data from ScrapeCreators
router.post('/enrich-linkedin', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const result = await enrichLinkedInProfiles(limit);
    res.json({
      success: true,
      message: 'LinkedIn enrichment completed',
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Test ScrapeCreators LinkedIn API directly
router.get('/test-linkedin-api/:username', async (req, res) => {
  try {
    const { scrapeCreatorsService } = await import('../services/scrapeCreatorsService');
    const username = req.params.username;
    const profile = await scrapeCreatorsService.getLinkedInProfile(username);
    res.json({
      success: true,
      username,
      profile,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Debug endpoint to check sync queue
router.get('/debug-queue', async (req, res) => {
  try {
    const platform = ((req.query.platform as string)?.toUpperCase() || 'LINKEDIN') as Platform;

    const pending = await db.socialSyncQueue.count({
      where: { platform: platform as any, status: 'PENDING' }
    });
    const completed = await db.socialSyncQueue.count({
      where: { platform: platform as any, status: 'COMPLETED' }
    });
    const failed = await db.socialSyncQueue.count({
      where: { platform: platform as any, status: 'FAILED' }
    });
    const samples = await db.socialSyncQueue.findMany({
      where: { platform: platform as any, status: 'PENDING' },
      select: { username: true, priority: true, createdAt: true },
      take: 10,
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: {
        platform,
        pending,
        completed,
        failed,
        total: pending + completed + failed,
        samples
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug endpoint to check LinkedIn profiles
router.get('/debug-linkedin', async (req, res) => {
  try {
    const allLinkedIn = await db.streamer.count({
      where: { platform: Platform.LINKEDIN }
    });
    const needsEnrich = await db.streamer.findMany({
      where: {
        platform: Platform.LINKEDIN,
        lastScrapedAt: null,
      },
      select: { id: true, username: true, followers: true, lastScrapedAt: true },
      take: 5,
    });
    res.json({
      success: true,
      data: {
        totalLinkedIn: allLinkedIn,
        needsEnrichCount: needsEnrich.length,
        samples: needsEnrich,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Process pending LinkedIn profiles from queue
router.post('/process-linkedin-queue', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const { scrapeCreatorsService } = await import('../services/scrapeCreatorsService');

    // Check queue status first
    const pendingCount = await db.socialSyncQueue.count({
      where: { platform: 'LINKEDIN' as any, status: 'PENDING' }
    });

    if (pendingCount === 0) {
      return res.json({
        success: true,
        message: 'No pending LinkedIn profiles in queue',
        data: { processed: 0, pending: 0 }
      });
    }

    // Use existing syncPlatform method which processes the queue
    scrapeCreatorsService.syncPlatform('LINKEDIN', limit)
      .then(result => {
        console.log(`LinkedIn sync complete:`, result);
      })
      .catch(error => {
        console.error(`LinkedIn sync failed:`, error);
      });

    res.json({
      success: true,
      message: `Processing up to ${limit} LinkedIn profiles in background`,
      data: { pending: pendingCount, batchSize: limit }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Extract social links from YouTube channels using web scraping (API doesn't return links)
router.post('/extract-youtube-links', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    // Get YouTube streamers without social links
    const streamers = await db.streamer.findMany({
      where: {
        platform: 'YOUTUBE',
        OR: [
          { socialLinks: { equals: [] } },
          { socialLinks: { equals: null as any } },
        ]
      },
      orderBy: { followers: 'desc' },
      take: limit,
      select: { id: true, username: true, profileUrl: true, profileDescription: true }
    });

    if (streamers.length === 0) {
      return res.json({ success: true, message: 'No YouTube channels to process', data: { processed: 0 } });
    }

    // Process in background using Playwright web scraping
    (async () => {
      let processed = 0;
      let linksFound = 0;
      const { chromium } = await import('playwright');

      const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });

      try {
        const context = await browser.newContext({
          viewport: { width: 1920, height: 1080 },
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        });

        for (const streamer of streamers) {
          try {
            // Build About page URL
            let aboutUrl = '';
            if (streamer.profileUrl?.includes('/@')) {
              aboutUrl = streamer.profileUrl.replace(/\/$/, '') + '/about';
            } else if (streamer.profileUrl?.includes('/channel/')) {
              aboutUrl = streamer.profileUrl.replace(/\/$/, '') + '/about';
            } else if (streamer.username) {
              aboutUrl = `https://www.youtube.com/@${streamer.username}/about`;
            }

            if (!aboutUrl) {
              processed++;
              continue;
            }

            console.log(`Scraping YouTube About page: ${aboutUrl}`);
            const page = await context.newPage();

            await page.goto(aboutUrl, { waitUntil: 'networkidle', timeout: 30000 });
            await page.waitForTimeout(2000);

            // Extract social links from the About page
            const socialLinks = await page.evaluate(() => {
              const links: string[] = [];

              // Method 1: Direct social links on About page
              const socialSelectors = [
                'a[href*="linkedin.com"]',
                'a[href*="instagram.com"]',
                'a[href*="twitter.com"]',
                'a[href*="x.com"]',
                'a[href*="tiktok.com"]',
                'a[href*="facebook.com"]'
              ];

              for (const selector of socialSelectors) {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                  const href = (el as HTMLAnchorElement).href;
                  if (href && !links.includes(href)) links.push(href);
                });
              }

              // Method 2: YouTube redirect links (youtube.com/redirect?q=...)
              const redirectLinks = document.querySelectorAll('a[href*="youtube.com/redirect"]');
              redirectLinks.forEach(el => {
                const href = (el as HTMLAnchorElement).href;
                try {
                  const url = new URL(href);
                  const q = url.searchParams.get('q');
                  if (q && (
                    q.includes('linkedin') ||
                    q.includes('instagram') ||
                    q.includes('twitter') ||
                    q.includes('x.com') ||
                    q.includes('tiktok') ||
                    q.includes('facebook')
                  )) {
                    if (!links.includes(q)) links.push(q);
                  }
                } catch {}
              });

              // Method 3: Look for link text containing social platform names
              const allLinks = document.querySelectorAll('a');
              allLinks.forEach(el => {
                const href = (el as HTMLAnchorElement).href;
                const text = el.textContent?.toLowerCase() || '';
                if (href && (
                  text.includes('linkedin') ||
                  text.includes('instagram') ||
                  text.includes('twitter') ||
                  text.includes('tiktok')
                )) {
                  // Check if it's a redirect link
                  if (href.includes('youtube.com/redirect')) {
                    try {
                      const url = new URL(href);
                      const q = url.searchParams.get('q');
                      if (q && !links.includes(q)) links.push(q);
                    } catch {}
                  } else if (!links.includes(href)) {
                    links.push(href);
                  }
                }
              });

              return links;
            });

            await page.close();

            if (socialLinks.length > 0) {
              console.log(`Found ${socialLinks.length} social links for ${streamer.username}: ${socialLinks.join(', ')}`);

              // Update streamer with social links
              await db.streamer.update({
                where: { id: streamer.id },
                data: { socialLinks }
              });

              // Extract usernames and add to sync queue
              for (const link of socialLinks) {
                if (link.includes('linkedin.com/in/')) {
                  const username = link.split('linkedin.com/in/')[1]?.split(/[/?#]/)[0];
                  if (username) {
                    await db.socialSyncQueue.upsert({
                      where: { platform_username: { platform: 'LINKEDIN', username: username.toLowerCase() } },
                      create: { platform: 'LINKEDIN', username: username.toLowerCase(), priority: 50, status: 'PENDING' },
                      update: {}
                    });
                    linksFound++;
                    console.log(`Added LinkedIn to queue: ${username}`);
                  }
                }
                if (link.includes('instagram.com/')) {
                  const username = link.split('instagram.com/')[1]?.split(/[/?#]/)[0];
                  if (username && username !== 'p' && username !== 'reel') {
                    await db.socialSyncQueue.upsert({
                      where: { platform_username: { platform: 'INSTAGRAM', username: username.toLowerCase() } },
                      create: { platform: 'INSTAGRAM', username: username.toLowerCase(), priority: 50, status: 'PENDING' },
                      update: {}
                    });
                  }
                }
                if (link.includes('tiktok.com/@')) {
                  const username = link.split('tiktok.com/@')[1]?.split(/[/?#]/)[0];
                  if (username) {
                    await db.socialSyncQueue.upsert({
                      where: { platform_username: { platform: 'TIKTOK', username: username.toLowerCase() } },
                      create: { platform: 'TIKTOK', username: username.toLowerCase(), priority: 50, status: 'PENDING' },
                      update: {}
                    });
                  }
                }
              }
            }

            processed++;
            await new Promise(r => setTimeout(r, 2000 + Math.random() * 1000)); // Rate limit
          } catch (error) {
            console.error(`Failed to process ${streamer.username}:`, error);
            processed++;
          }
        }

        await context.close();
      } finally {
        await browser.close();
      }

      console.log(`YouTube link extraction complete: ${processed} processed, ${linksFound} LinkedIn links found`);
    })();

    res.json({
      success: true,
      message: `Scraping social links from ${streamers.length} YouTube channels in background`,
      data: { queued: streamers.length }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reset LinkedIn profiles to re-enrich them
router.post('/reset-linkedin', async (req, res) => {
  try {
    const result = await db.streamer.updateMany({
      where: {
        platform: Platform.LINKEDIN,
        followers: 0, // Only reset those that didn't get enriched properly
      },
      data: { lastScrapedAt: null }
    });
    res.json({
      success: true,
      message: `Reset ${result.count} LinkedIn profiles for re-enrichment`,
      data: { resetCount: result.count },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export { router as influencerSyncRoutes };
