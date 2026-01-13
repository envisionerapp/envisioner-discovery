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

// Extract social links from YouTube channels using YouTube API (FREE)
router.post('/extract-youtube-links', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'YouTube API key not configured' });
    }

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

    // Process in background
    (async () => {
      let processed = 0;
      let linksFound = 0;
      const { scrapeCreatorsService } = await import('../services/scrapeCreatorsService');

      for (const streamer of streamers) {
        try {
          // Extract channel ID from URL or use username
          let channelId = '';
          if (streamer.profileUrl?.includes('/channel/')) {
            channelId = streamer.profileUrl.split('/channel/')[1]?.split('/')[0] || '';
          }

          // If we have a channel ID, fetch from YouTube API
          if (channelId) {
            const response = await fetch(
              `https://www.googleapis.com/youtube/v3/channels?part=snippet,brandingSettings&id=${channelId}&key=${apiKey}`
            );
            const data = await response.json();
            const channel = data.items?.[0];

            if (channel) {
              const description = channel.snippet?.description || '';
              const links = channel.brandingSettings?.channel?.links || [];

              // Extract handles from description
              const handles = (scrapeCreatorsService as any).extractHandlesFromContent(description);

              // Also parse the links array
              const socialLinks: string[] = [];
              for (const link of links) {
                const url = link.url || link;
                if (typeof url === 'string') socialLinks.push(url);
              }

              // Parse socialLinks for handles
              const linkContent = socialLinks.join(' ');
              const linkHandles = (scrapeCreatorsService as any).extractHandlesFromContent(linkContent);

              // Merge handles
              const allHandles = { ...handles, ...linkHandles };

              // Update streamer with social links
              await db.streamer.update({
                where: { id: streamer.id },
                data: { socialLinks }
              });

              // Add to sync queue
              if (allHandles.linkedin) {
                await db.socialSyncQueue.upsert({
                  where: { platform_username: { platform: 'LINKEDIN', username: allHandles.linkedin.toLowerCase() } },
                  create: { platform: 'LINKEDIN', username: allHandles.linkedin.toLowerCase(), priority: 50, status: 'PENDING' },
                  update: {}
                });
                linksFound++;
              }
              if (allHandles.instagram) {
                await db.socialSyncQueue.upsert({
                  where: { platform_username: { platform: 'INSTAGRAM', username: allHandles.instagram.toLowerCase() } },
                  create: { platform: 'INSTAGRAM', username: allHandles.instagram.toLowerCase(), priority: 50, status: 'PENDING' },
                  update: {}
                });
              }
              if (allHandles.tiktok) {
                await db.socialSyncQueue.upsert({
                  where: { platform_username: { platform: 'TIKTOK', username: allHandles.tiktok.toLowerCase() } },
                  create: { platform: 'TIKTOK', username: allHandles.tiktok.toLowerCase(), priority: 50, status: 'PENDING' },
                  update: {}
                });
              }
            }
          }

          processed++;
          await new Promise(r => setTimeout(r, 100)); // Rate limit
        } catch (error) {
          console.error(`Failed to process ${streamer.username}:`, error);
        }
      }

      console.log(`YouTube link extraction complete: ${processed} processed, ${linksFound} LinkedIn links found`);
    })();

    res.json({
      success: true,
      message: `Extracting social links from ${streamers.length} YouTube channels in background`,
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
