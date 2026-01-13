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

// Extract social links from YouTube channels using ScrapeCreators API
router.post('/extract-youtube-links', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const { scrapeCreatorsService } = await import('../services/scrapeCreatorsService');

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
      select: { id: true, username: true, profileUrl: true }
    });

    if (streamers.length === 0) {
      return res.json({ success: true, message: 'No YouTube channels to process', data: { processed: 0 } });
    }

    // Process in background using ScrapeCreators API
    (async () => {
      let processed = 0;
      let linkedinFound = 0;
      let instagramFound = 0;
      let tiktokFound = 0;

      for (const streamer of streamers) {
        try {
          // Extract handle from URL or use username
          let handle = streamer.username;
          if (streamer.profileUrl?.includes('/@')) {
            handle = streamer.profileUrl.split('/@')[1]?.split('/')[0] || handle;
          }

          console.log(`Fetching YouTube channel via API: ${handle}`);
          const channel = await scrapeCreatorsService.getYouTubeChannel(handle);

          if (channel) {
            const socialLinks: string[] = [];

            // Collect all social links from API response
            if (channel.twitter) socialLinks.push(channel.twitter);
            if (channel.instagram) socialLinks.push(channel.instagram);
            if (channel.linkedin) socialLinks.push(channel.linkedin);
            if (channel.tiktok) socialLinks.push(channel.tiktok);
            if (channel.links) {
              for (const link of channel.links) {
                if (!socialLinks.includes(link)) socialLinks.push(link);
              }
            }

            if (socialLinks.length > 0) {
              console.log(`Found ${socialLinks.length} social links for ${handle}: ${socialLinks.join(', ')}`);

              // Update streamer with social links
              await db.streamer.update({
                where: { id: streamer.id },
                data: { socialLinks }
              });

              // Add LinkedIn to sync queue (both personal /in/ and company /company/)
              if (channel.linkedin) {
                let username = '';
                if (channel.linkedin.includes('linkedin.com/in/')) {
                  username = channel.linkedin.split('linkedin.com/in/')[1]?.split(/[/?#]/)[0] || '';
                } else if (channel.linkedin.includes('linkedin.com/company/')) {
                  // Store company pages with a "company:" prefix
                  username = 'company:' + (channel.linkedin.split('linkedin.com/company/')[1]?.split(/[/?#]/)[0] || '');
                }
                if (username) {
                  await db.socialSyncQueue.upsert({
                    where: { platform_username: { platform: 'LINKEDIN', username: username.toLowerCase() } },
                    create: { platform: 'LINKEDIN', username: username.toLowerCase(), priority: 50, status: 'PENDING' },
                    update: {}
                  });
                  linkedinFound++;
                  console.log(`Added LinkedIn to queue: ${username}`);
                }
              }

              // Add Instagram to sync queue
              if (channel.instagram) {
                const username = channel.instagram.split('instagram.com/')[1]?.split(/[/?#]/)[0];
                if (username && username !== 'p' && username !== 'reel') {
                  await db.socialSyncQueue.upsert({
                    where: { platform_username: { platform: 'INSTAGRAM', username: username.toLowerCase() } },
                    create: { platform: 'INSTAGRAM', username: username.toLowerCase(), priority: 50, status: 'PENDING' },
                    update: {}
                  });
                  instagramFound++;
                }
              }

              // Check links array for TikTok
              for (const link of channel.links || []) {
                if (link.includes('tiktok.com/@')) {
                  const username = link.split('tiktok.com/@')[1]?.split(/[/?#]/)[0];
                  if (username) {
                    await db.socialSyncQueue.upsert({
                      where: { platform_username: { platform: 'TIKTOK', username: username.toLowerCase() } },
                      create: { platform: 'TIKTOK', username: username.toLowerCase(), priority: 50, status: 'PENDING' },
                      update: {}
                    });
                    tiktokFound++;
                  }
                }
                // Also check for LinkedIn in links array (both /in/ and /company/)
                if ((link.includes('linkedin.com/in/') || link.includes('linkedin.com/company/')) && !channel.linkedin) {
                  let username = '';
                  if (link.includes('linkedin.com/in/')) {
                    username = link.split('linkedin.com/in/')[1]?.split(/[/?#]/)[0] || '';
                  } else if (link.includes('linkedin.com/company/')) {
                    username = 'company:' + (link.split('linkedin.com/company/')[1]?.split(/[/?#]/)[0] || '');
                  }
                  if (username) {
                    await db.socialSyncQueue.upsert({
                      where: { platform_username: { platform: 'LINKEDIN', username: username.toLowerCase() } },
                      create: { platform: 'LINKEDIN', username: username.toLowerCase(), priority: 50, status: 'PENDING' },
                      update: {}
                    });
                    linkedinFound++;
                    console.log(`Added LinkedIn from links: ${username}`);
                  }
                }
              }
            }
          }

          processed++;
          await new Promise(r => setTimeout(r, 200)); // Rate limit API calls
        } catch (error) {
          console.error(`Failed to process ${streamer.username}:`, error);
          processed++;
        }
      }

      console.log(`YouTube link extraction complete: ${processed} processed, ${linkedinFound} LinkedIn, ${instagramFound} Instagram, ${tiktokFound} TikTok found`);
    })();

    res.json({
      success: true,
      message: `Extracting social links from ${streamers.length} YouTube channels via API`,
      data: { queued: streamers.length }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Process a single YouTube channel and add LinkedIn to queue (synchronous)
router.post('/extract-single-youtube/:username', async (req, res) => {
  try {
    const username = req.params.username;
    const { scrapeCreatorsService } = await import('../services/scrapeCreatorsService');

    // Fetch channel data
    const channel = await scrapeCreatorsService.getYouTubeChannel(username);
    if (!channel) {
      return res.json({ success: false, error: 'Channel not found' });
    }

    const results: any = {
      channel: channel.name,
      linkedin: channel.linkedin,
      instagram: channel.instagram,
      links: channel.links,
      actions: []
    };

    // Add LinkedIn to queue if found
    if (channel.linkedin) {
      let linkedinUsername = '';
      if (channel.linkedin.includes('linkedin.com/in/')) {
        linkedinUsername = channel.linkedin.split('linkedin.com/in/')[1]?.split(/[/?#]/)[0] || '';
      } else if (channel.linkedin.includes('linkedin.com/company/')) {
        linkedinUsername = 'company:' + (channel.linkedin.split('linkedin.com/company/')[1]?.split(/[/?#]/)[0] || '');
      }

      if (linkedinUsername) {
        await db.socialSyncQueue.upsert({
          where: { platform_username: { platform: 'LINKEDIN', username: linkedinUsername.toLowerCase() } },
          create: { platform: 'LINKEDIN', username: linkedinUsername.toLowerCase(), priority: 50, status: 'PENDING' },
          update: {}
        });
        results.actions.push(`Added LinkedIn to queue: ${linkedinUsername}`);
      }
    }

    // Update streamer socialLinks if in database
    const streamer = await db.streamer.findFirst({
      where: { platform: 'YOUTUBE', username: { contains: username, mode: 'insensitive' } }
    });

    if (streamer) {
      const socialLinks: string[] = [];
      if (channel.twitter) socialLinks.push(channel.twitter);
      if (channel.instagram) socialLinks.push(channel.instagram);
      if (channel.linkedin) socialLinks.push(channel.linkedin);
      if (channel.links) {
        for (const link of channel.links) {
          if (!socialLinks.includes(link)) socialLinks.push(link);
        }
      }

      await db.streamer.update({
        where: { id: streamer.id },
        data: { socialLinks }
      });
      results.actions.push(`Updated streamer ${streamer.id} with ${socialLinks.length} social links`);
    } else {
      results.actions.push('Streamer not found in database');
    }

    res.json({ success: true, ...results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug: Test YouTube channel API for a single channel
router.get('/test-youtube-scrape/:username', async (req, res) => {
  try {
    const username = req.params.username;
    const { scrapeCreatorsService } = await import('../services/scrapeCreatorsService');

    console.log(`Testing YouTube API for: ${username}`);
    const channel = await scrapeCreatorsService.getYouTubeChannel(username);

    if (!channel) {
      return res.json({
        success: false,
        username,
        error: 'No channel data returned from API'
      });
    }

    res.json({
      success: true,
      username,
      channelId: channel.channelId,
      name: channel.name,
      subscriberCount: channel.subscriberCount,
      country: channel.country,
      twitter: channel.twitter,
      instagram: channel.instagram,
      linkedin: channel.linkedin,
      tiktok: channel.tiktok,
      links: channel.links,
      email: channel.email
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
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
