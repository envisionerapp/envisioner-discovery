/**
 * Bulk LinkedIn Extraction from YouTube Channels
 *
 * This script:
 * 1. Fetches YouTube channel data via ScrapeCreators API
 * 2. Extracts LinkedIn URLs from the channel's social links
 * 3. Creates LinkedIn entries directly in the database
 * 4. Updates the YouTube channel's socialLinks with the LinkedIn URL
 *
 * Since LinkedIn Profile API often returns "private", we:
 * - Store the LinkedIn URL and username
 * - Use the YouTube channel's name/avatar as fallback
 * - Set lastScrapedAt to mark as processed
 */

import axios from 'axios';
import { db, logger } from '../src/utils/database';
import { Platform, Region } from '@prisma/client';
import { bunnyService } from '../src/services/bunnyService';

const SCRAPECREATORS_API_KEY = process.env.SCRAPECREATORS_API_KEY || 'qJY95WcDxCStfw9idIub8a04Cyr1';
const BATCH_SIZE = 100;
const RATE_LIMIT_MS = 200;

interface YouTubeChannelData {
  name: string;
  channelId: string;
  subscriberCount: number;
  description?: string;
  avatar?: {
    image?: {
      sources?: Array<{ url: string; width: number; height: number }>;
    };
  };
  linkedin?: string;
  instagram?: string;
  twitter?: string;
  facebook?: string;
  tiktok?: string;
  links?: string[];
}

function extractLinkedInHandle(url: string): string | null {
  // Handle both /in/ and /company/ URLs
  const match = url.match(/linkedin\.com\/(?:in|company)\/([^/?#]+)/i);
  return match ? match[1] : null;
}

function getHighestResAvatar(avatar: any): string | null {
  const sources = avatar?.image?.sources;
  if (!sources || sources.length === 0) return null;
  // Sort by width and get the highest resolution
  const sorted = [...sources].sort((a, b) => (b.width || 0) - (a.width || 0));
  return sorted[0]?.url || null;
}

async function fetchYouTubeChannel(url: string): Promise<YouTubeChannelData | null> {
  try {
    const response = await axios.get('https://api.scrapecreators.com/v1/youtube/channel', {
      headers: { 'x-api-key': SCRAPECREATORS_API_KEY },
      params: { url },
      timeout: 30000
    });

    if (!response.data?.success) return null;
    return response.data;
  } catch (error: any) {
    if (error.response?.status !== 404) {
      console.error(`Error fetching ${url}:`, error.message);
    }
    return null;
  }
}

async function processYouTubeChannel(streamer: { id: string; username: string; profileUrl: string | null; followers: number }) {
  const url = streamer.profileUrl || `https://www.youtube.com/@${streamer.username}`;
  const data = await fetchYouTubeChannel(url);

  if (!data) {
    // Mark as processed with empty socialLinks
    await db.streamer.update({
      where: { id: streamer.id },
      data: { socialLinks: [] }
    });
    return { linkedin: false, socialLinks: [] };
  }

  // Extract LinkedIn from direct field or links array
  let linkedinUrl = data.linkedin;
  if (!linkedinUrl && data.links) {
    linkedinUrl = data.links.find(l => l?.toLowerCase().includes('linkedin.com'));
  }

  // Build socialLinks array
  const socialLinks: string[] = [];
  if (data.instagram) socialLinks.push(data.instagram);
  if (data.facebook) socialLinks.push(data.facebook);
  if (data.twitter) socialLinks.push(data.twitter);
  if (data.tiktok) socialLinks.push(data.tiktok);
  if (linkedinUrl) socialLinks.push(linkedinUrl);

  // Also check links array for anything we missed
  if (data.links) {
    for (const link of data.links) {
      if (!link) continue;
      const lowerLink = link.toLowerCase();
      if (lowerLink.includes('instagram.com') && !socialLinks.some(s => s.includes('instagram'))) {
        socialLinks.push(link);
      }
      if (lowerLink.includes('facebook.com') && !socialLinks.some(s => s.includes('facebook'))) {
        socialLinks.push(link);
      }
      if ((lowerLink.includes('twitter.com') || lowerLink.includes('x.com')) && !socialLinks.some(s => s.includes('twitter') || s.includes('x.com'))) {
        socialLinks.push(link);
      }
      if (lowerLink.includes('tiktok.com') && !socialLinks.some(s => s.includes('tiktok'))) {
        socialLinks.push(link);
      }
    }
  }

  // Update YouTube streamer with social links and data
  const avatarUrl = getHighestResAvatar(data.avatar);
  await db.streamer.update({
    where: { id: streamer.id },
    data: {
      socialLinks,
      displayName: data.name || undefined,
      profileDescription: data.description || undefined,
      followers: data.subscriberCount || streamer.followers,
      avatarUrl: avatarUrl || undefined,
    }
  });

  let linkedinCreated = false;

  // If LinkedIn found, create a LinkedIn entry
  if (linkedinUrl) {
    const handle = extractLinkedInHandle(linkedinUrl);
    if (handle) {
      try {
        // Check if this LinkedIn entry already exists
        const existing = await db.streamer.findUnique({
          where: {
            platform_username: {
              platform: 'LINKEDIN',
              username: handle.toLowerCase()
            }
          }
        });

        if (!existing) {
          // Upload YouTube avatar for LinkedIn profile (as fallback)
          let cdnAvatarUrl = avatarUrl;
          if (avatarUrl) {
            try {
              cdnAvatarUrl = await bunnyService.uploadLinkedInAvatar(handle, avatarUrl);
            } catch (e) {
              // Keep original URL if upload fails
            }
          }

          await db.streamer.create({
            data: {
              platform: 'LINKEDIN',
              username: handle.toLowerCase(),
              displayName: data.name || handle,
              profileUrl: linkedinUrl.startsWith('http') ? linkedinUrl : `https://${linkedinUrl}`,
              avatarUrl: cdnAvatarUrl || undefined,
              followers: 0, // Can't get followers if profile is private
              profileDescription: `YouTube: ${data.subscriberCount?.toLocaleString() || 0} subscribers`,
              region: Region.WORLDWIDE,
              lastScrapedAt: new Date(),
              discoveredVia: `youtube:@${streamer.username}`,
              socialLinks: [`https://youtube.com/@${streamer.username}`], // Link back to YouTube
            }
          });
          linkedinCreated = true;
          console.log(`  ✅ Created LinkedIn: ${handle} (from @${streamer.username})`);
        } else {
          console.log(`  ⏭️ LinkedIn already exists: ${handle}`);
        }
      } catch (error: any) {
        console.error(`  ❌ Failed to create LinkedIn ${handle}:`, error.message);
      }
    }
  }

  return { linkedin: linkedinCreated, socialLinks };
}

async function main() {
  console.log('===========================================');
  console.log('   BULK LINKEDIN EXTRACTION FROM YOUTUBE');
  console.log('===========================================\n');

  // Get initial counts
  const initialLinkedin = await db.streamer.count({ where: { platform: 'LINKEDIN' } });
  console.log(`Initial LinkedIn count: ${initialLinkedin}`);

  // Get YouTube channels that haven't been processed yet (empty socialLinks)
  const youtubeChannels = await db.streamer.findMany({
    where: {
      platform: 'YOUTUBE',
      socialLinks: { equals: [] }
    },
    orderBy: { followers: 'desc' },
    take: BATCH_SIZE * 10, // Process more channels
    select: { id: true, username: true, profileUrl: true, followers: true }
  });

  console.log(`Found ${youtubeChannels.length} YouTube channels to process\n`);

  let processed = 0;
  let linkedinCreated = 0;
  let creditsUsed = 0;

  for (const channel of youtubeChannels) {
    processed++;
    creditsUsed++;

    console.log(`[${processed}/${youtubeChannels.length}] @${channel.username} (${channel.followers?.toLocaleString()} subs)`);

    try {
      const result = await processYouTubeChannel(channel);
      if (result.linkedin) linkedinCreated++;

      // Rate limit
      await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
    } catch (error: any) {
      console.error(`  Error: ${error.message}`);
    }

    // Log progress every 50 channels
    if (processed % 50 === 0) {
      console.log(`\n--- Progress: ${processed} processed, ${linkedinCreated} LinkedIn created, ${creditsUsed} credits used ---\n`);
    }
  }

  // Final stats
  const finalLinkedin = await db.streamer.count({ where: { platform: 'LINKEDIN' } });

  console.log('\n===========================================');
  console.log('   EXTRACTION COMPLETE');
  console.log('===========================================');
  console.log(`Processed: ${processed} YouTube channels`);
  console.log(`LinkedIn created: ${linkedinCreated}`);
  console.log(`Credits used: ${creditsUsed}`);
  console.log(`Total LinkedIn in DB: ${finalLinkedin} (was ${initialLinkedin})`);

  await db.$disconnect();
}

main().catch(console.error);
