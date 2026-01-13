/**
 * Social Extraction Job
 *
 * Extracts social links from existing Kick/Twitch/YouTube profiles
 * and adds them to the sync queue for enrichment.
 *
 * This replaces keyword-based discovery which had poor results.
 * The real value is extracting social links from profiles we already have.
 */

import cron from 'node-cron';
import axios from 'axios';
import { db, logger } from '../utils/database';
import { Platform } from '@prisma/client';

// Twitch GraphQL API
const TWITCH_GQL_URL = 'https://gql.twitch.tv/gql';
const TWITCH_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

// Kick API
const KICK_API_V2 = 'https://kick.com/api/v2/channels';

// YouTube via ScrapeCreators
const SCRAPECREATORS_API = 'https://api.scrapecreators.com/v1/youtube/channel';

// Batch sizes
const TWITCH_BATCH = 100;
const KICK_BATCH = 100;
const YOUTUBE_BATCH = 100; // Uses ScrapeCreators credits

// ==================== TWITCH EXTRACTION ====================

interface TwitchSocialLink {
  platform: string;
  handle?: string;
  url?: string;
}

function extractHandle(url: string): string | undefined {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/+|\/+$/g, '').replace('@', '');
    return path.replace(/^(c|channel|user)\//, '') || undefined;
  } catch {
    return undefined;
  }
}

async function fetchTwitchSocialMedias(login: string): Promise<{ socialLinks: TwitchSocialLink[]; description: string } | null> {
  try {
    const query = {
      query: `
        query GetChannelSocial($login: String!) {
          user(login: $login) {
            description
            channel {
              socialMedias {
                name
                url
              }
            }
          }
        }
      `,
      variables: { login }
    };

    const response = await axios.post(TWITCH_GQL_URL, query, {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Content-Type': 'application/json',
      },
      timeout: 10000
    });

    const user = response.data?.data?.user;
    if (!user) return null;

    const socialLinks: TwitchSocialLink[] = [];
    const socialMedias = user.channel?.socialMedias || [];

    for (const sm of socialMedias) {
      const name = sm.name?.toLowerCase();
      const url = sm.url;
      if (!name || !url) continue;

      let platform = name;
      if (name === 'x') platform = 'twitter';

      socialLinks.push({
        platform,
        url,
        handle: extractHandle(url)
      });
    }

    return { socialLinks, description: user.description || '' };
  } catch {
    return null;
  }
}

async function extractTwitchSocialLinks(batchSize: number = TWITCH_BATCH): Promise<{
  processed: number;
  updated: number;
  handlesAdded: number;
}> {
  const result = { processed: 0, updated: 0, handlesAdded: 0 };

  // Get Twitch streamers without social links, ordered by followers
  const streamers = await db.streamer.findMany({
    where: {
      platform: 'TWITCH',
      OR: [
        { socialLinks: { equals: [] } },
        { socialLinks: { equals: null as any } },
      ]
    },
    orderBy: { followers: 'desc' },
    take: batchSize,
    select: { id: true, username: true, followers: true }
  });

  if (streamers.length === 0) {
    logger.info('[TWITCH] No streamers without social links found');
    return result;
  }

  logger.info(`[TWITCH] Processing ${streamers.length} streamers`);

  for (const streamer of streamers) {
    try {
      const data = await fetchTwitchSocialMedias(streamer.username);
      result.processed++;

      if (!data || data.socialLinks.length === 0) {
        // Mark as checked by setting empty array explicitly
        await db.streamer.update({
          where: { id: streamer.id },
          data: { socialLinks: [] }
        });
        continue;
      }

      // Build social links array
      const socialLinksArray: string[] = data.socialLinks
        .filter(sl => sl.url)
        .map(sl => sl.url!);

      // Update streamer
      await db.streamer.update({
        where: { id: streamer.id },
        data: {
          socialLinks: socialLinksArray,
          profileDescription: data.description || undefined,
        }
      });
      result.updated++;

      // Add handles to sync queue
      for (const sl of data.socialLinks) {
        if (!sl.handle) continue;

        let platform: Platform | null = null;
        if (sl.platform === 'instagram') platform = 'INSTAGRAM';
        else if (sl.platform === 'twitter' || sl.platform === 'x') platform = 'X';
        else if (sl.platform === 'tiktok') platform = 'TIKTOK';
        else if (sl.platform === 'facebook') platform = 'FACEBOOK';
        else if (sl.platform === 'linkedin') platform = 'LINKEDIN';

        if (platform) {
          try {
            await db.socialSyncQueue.upsert({
              where: {
                platform_username: {
                  platform,
                  username: sl.handle.toLowerCase(),
                }
              },
              create: {
                platform,
                username: sl.handle.toLowerCase(),
                priority: 50,
                status: 'PENDING',
              },
              update: {}
            });
            result.handlesAdded++;
          } catch {
            // Ignore duplicates
          }
        }
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 100));
    } catch (error) {
      logger.error(`[TWITCH] Error processing ${streamer.username}:`, error);
    }
  }

  return result;
}

// ==================== KICK EXTRACTION ====================

interface KickSocialLinks {
  instagram?: string;
  twitter?: string;
  youtube?: string;
  tiktok?: string;
  facebook?: string;
}

async function getKickChannelData(username: string): Promise<{ user: any; followers: number } | null> {
  try {
    const response = await axios.get(`${KICK_API_V2}/${username}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      timeout: 10000
    });

    return {
      user: response.data?.user,
      followers: response.data?.followers_count || 0
    };
  } catch {
    return null;
  }
}

async function extractKickSocialLinks(batchSize: number = KICK_BATCH): Promise<{
  processed: number;
  updated: number;
  handlesAdded: number;
}> {
  const result = { processed: 0, updated: 0, handlesAdded: 0 };

  // Get Kick streamers without social links
  const streamers = await db.streamer.findMany({
    where: {
      platform: 'KICK',
      OR: [
        { socialLinks: { equals: [] } },
        { socialLinks: { equals: null as any } },
      ]
    },
    orderBy: { followers: 'desc' },
    take: batchSize,
    select: { id: true, username: true, followers: true }
  });

  if (streamers.length === 0) {
    logger.info('[KICK] No streamers without social links found');
    return result;
  }

  logger.info(`[KICK] Processing ${streamers.length} streamers`);

  for (const streamer of streamers) {
    try {
      const data = await getKickChannelData(streamer.username);
      result.processed++;

      if (!data?.user) {
        await db.streamer.update({
          where: { id: streamer.id },
          data: { socialLinks: [] }
        });
        continue;
      }

      const social: KickSocialLinks = {
        instagram: data.user.instagram || undefined,
        twitter: data.user.twitter || undefined,
        youtube: data.user.youtube || undefined,
        tiktok: data.user.tiktok || undefined,
        facebook: data.user.facebook || undefined,
      };

      const hasSocial = social.instagram || social.twitter || social.tiktok || social.facebook;

      // Build social links array
      const socialLinksArray: string[] = [];
      if (social.instagram) socialLinksArray.push(`https://instagram.com/${social.instagram}`);
      if (social.twitter) socialLinksArray.push(`https://twitter.com/${social.twitter}`);
      if (social.youtube) socialLinksArray.push(`https://youtube.com/${social.youtube}`);
      if (social.tiktok) socialLinksArray.push(`https://tiktok.com/@${social.tiktok}`);
      if (social.facebook) socialLinksArray.push(`https://facebook.com/${social.facebook}`);

      // Update streamer
      await db.streamer.update({
        where: { id: streamer.id },
        data: {
          socialLinks: socialLinksArray,
          followers: data.followers || streamer.followers,
        }
      });

      if (hasSocial) {
        result.updated++;

        // Add to sync queue
        if (social.instagram) {
          try {
            await db.socialSyncQueue.upsert({
              where: { platform_username: { platform: 'INSTAGRAM', username: social.instagram.toLowerCase() } },
              create: { platform: 'INSTAGRAM', username: social.instagram.toLowerCase(), priority: 50, status: 'PENDING' },
              update: {}
            });
            result.handlesAdded++;
          } catch {}
        }
        if (social.twitter) {
          try {
            await db.socialSyncQueue.upsert({
              where: { platform_username: { platform: 'X', username: social.twitter.toLowerCase() } },
              create: { platform: 'X', username: social.twitter.toLowerCase(), priority: 50, status: 'PENDING' },
              update: {}
            });
            result.handlesAdded++;
          } catch {}
        }
        if (social.tiktok) {
          try {
            await db.socialSyncQueue.upsert({
              where: { platform_username: { platform: 'TIKTOK', username: social.tiktok.toLowerCase() } },
              create: { platform: 'TIKTOK', username: social.tiktok.toLowerCase(), priority: 50, status: 'PENDING' },
              update: {}
            });
            result.handlesAdded++;
          } catch {}
        }
        if (social.facebook) {
          try {
            await db.socialSyncQueue.upsert({
              where: { platform_username: { platform: 'FACEBOOK', username: social.facebook.toLowerCase() } },
              create: { platform: 'FACEBOOK', username: social.facebook.toLowerCase(), priority: 50, status: 'PENDING' },
              update: {}
            });
            result.handlesAdded++;
          } catch {}
        }
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 200));
    } catch (error) {
      logger.error(`[KICK] Error processing ${streamer.username}:`, error);
    }
  }

  return result;
}

// ==================== YOUTUBE EXTRACTION ====================

async function getYouTubeChannelData(profileUrl: string | null, username: string): Promise<{
  social: { instagram?: string; facebook?: string; tik_tok?: string; twitter?: string; linkedin?: string };
  subscribers: number;
  description: string | null;
  name: string | null;
  avatar: string | null;
} | null> {
  try {
    const apiKey = process.env.SCRAPECREATORS_API_KEY;
    if (!apiKey) return null;

    let url: string;
    if (profileUrl && (profileUrl.includes('/channel/') || profileUrl.includes('/@'))) {
      url = profileUrl;
    } else {
      url = username.startsWith('@')
        ? `https://www.youtube.com/${username}`
        : `https://www.youtube.com/@${username}`;
    }

    const response = await axios.get(SCRAPECREATORS_API, {
      headers: { 'x-api-key': apiKey },
      params: { url },
      timeout: 15000
    });

    const data = response.data;
    if (!data.success) return null;

    const avatarSources = data.avatar?.image?.sources || [];
    const avatar = avatarSources.length > 0 ? avatarSources[avatarSources.length - 1].url : null;

    // Parse links array for social links
    const links = data.links || [];
    let instagram = data.instagram;
    let facebook = data.facebook;
    let tik_tok = data.tik_tok;
    let twitter = data.twitter;
    let linkedin = data.linkedin;

    for (const link of links) {
      if (!instagram && link.includes('instagram.com')) instagram = link;
      if (!facebook && link.includes('facebook.com')) facebook = link;
      if (!tik_tok && link.includes('tiktok.com')) tik_tok = link;
      if (!twitter && (link.includes('twitter.com') || link.includes('x.com'))) twitter = link;
      if (!linkedin && link.includes('linkedin.com')) linkedin = link;
    }

    return {
      social: { instagram, facebook, tik_tok, twitter, linkedin },
      subscribers: data.subscriberCount || 0,
      description: data.description || null,
      name: data.name || null,
      avatar,
    };
  } catch {
    return null;
  }
}

function extractHandleFromUrl(url: string, platform: string): string | null {
  try {
    if (platform === 'instagram') {
      const match = url.match(/instagram\.com\/([^/?]+)/);
      return match ? match[1] : null;
    } else if (platform === 'facebook') {
      const match = url.match(/facebook\.com\/([^/?]+)/);
      return match ? match[1] : null;
    } else if (platform === 'tiktok') {
      const match = url.match(/tiktok\.com\/@?([^/?]+)/);
      return match ? match[1].replace('@', '') : null;
    } else if (platform === 'twitter' || platform === 'x') {
      const match = url.match(/(?:twitter|x)\.com\/([^/?]+)/);
      return match ? match[1] : null;
    } else if (platform === 'linkedin') {
      // LinkedIn URLs: linkedin.com/in/username or linkedin.com/company/name
      const match = url.match(/linkedin\.com\/(?:in|company)\/([^/?]+)/);
      return match ? match[1] : null;
    }
    return null;
  } catch {
    return null;
  }
}

async function extractYouTubeSocialLinks(batchSize: number = YOUTUBE_BATCH): Promise<{
  processed: number;
  updated: number;
  handlesAdded: number;
  credits: number;
}> {
  const result = { processed: 0, updated: 0, handlesAdded: 0, credits: 0 };

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
    take: batchSize,
    select: { id: true, username: true, profileUrl: true, followers: true }
  });

  if (streamers.length === 0) {
    logger.info('[YOUTUBE] No streamers without social links found');
    return result;
  }

  logger.info(`[YOUTUBE] Processing ${streamers.length} streamers`);

  for (const streamer of streamers) {
    try {
      const data = await getYouTubeChannelData(streamer.profileUrl, streamer.username);
      result.processed++;
      result.credits++;

      if (!data) {
        await db.streamer.update({
          where: { id: streamer.id },
          data: { socialLinks: [] }
        });
        continue;
      }

      const social = data.social;
      const hasSocial = social.instagram || social.facebook || social.tik_tok || social.twitter || social.linkedin;

      // Build social links array
      const socialLinksArray: string[] = [];
      if (social.instagram) socialLinksArray.push(social.instagram);
      if (social.facebook) socialLinksArray.push(social.facebook);
      if (social.tik_tok) socialLinksArray.push(social.tik_tok);
      if (social.twitter) socialLinksArray.push(social.twitter);
      if (social.linkedin) socialLinksArray.push(social.linkedin);

      // Update streamer
      await db.streamer.update({
        where: { id: streamer.id },
        data: {
          socialLinks: socialLinksArray,
          followers: data.subscribers || streamer.followers,
          profileDescription: data.description || undefined,
          displayName: data.name || undefined,
          avatarUrl: data.avatar || undefined,
        }
      });

      if (hasSocial) {
        result.updated++;

        // Add handles to sync queue
        if (social.instagram) {
          const handle = extractHandleFromUrl(social.instagram, 'instagram');
          if (handle) {
            try {
              await db.socialSyncQueue.upsert({
                where: { platform_username: { platform: 'INSTAGRAM', username: handle.toLowerCase() } },
                create: { platform: 'INSTAGRAM', username: handle.toLowerCase(), priority: 50, status: 'PENDING' },
                update: {}
              });
              result.handlesAdded++;
            } catch {}
          }
        }
        if (social.facebook) {
          const handle = extractHandleFromUrl(social.facebook, 'facebook');
          if (handle) {
            try {
              await db.socialSyncQueue.upsert({
                where: { platform_username: { platform: 'FACEBOOK', username: handle.toLowerCase() } },
                create: { platform: 'FACEBOOK', username: handle.toLowerCase(), priority: 50, status: 'PENDING' },
                update: {}
              });
              result.handlesAdded++;
            } catch {}
          }
        }
        if (social.tik_tok) {
          const handle = extractHandleFromUrl(social.tik_tok, 'tiktok');
          if (handle) {
            try {
              await db.socialSyncQueue.upsert({
                where: { platform_username: { platform: 'TIKTOK', username: handle.toLowerCase() } },
                create: { platform: 'TIKTOK', username: handle.toLowerCase(), priority: 50, status: 'PENDING' },
                update: {}
              });
              result.handlesAdded++;
            } catch {}
          }
        }
        if (social.twitter) {
          const handle = extractHandleFromUrl(social.twitter, 'twitter');
          if (handle) {
            try {
              await db.socialSyncQueue.upsert({
                where: { platform_username: { platform: 'X', username: handle.toLowerCase() } },
                create: { platform: 'X', username: handle.toLowerCase(), priority: 50, status: 'PENDING' },
                update: {}
              });
              result.handlesAdded++;
            } catch {}
          }
        }
        if (social.linkedin) {
          const handle = extractHandleFromUrl(social.linkedin, 'linkedin');
          if (handle) {
            try {
              await db.socialSyncQueue.upsert({
                where: { platform_username: { platform: 'LINKEDIN', username: handle.toLowerCase() } },
                create: { platform: 'LINKEDIN', username: handle.toLowerCase(), priority: 50, status: 'PENDING' },
                update: {}
              });
              result.handlesAdded++;
            } catch {}
          }
        }
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 200));
    } catch (error) {
      logger.error(`[YOUTUBE] Error processing ${streamer.username}:`, error);
    }
  }

  return result;
}

// ==================== SCHEDULED JOBS ====================

/**
 * Twitch Social Extraction - Every 2 hours
 * FREE (uses Twitch GQL API)
 */
export const twitchExtractionJob = cron.schedule('0 */2 * * *', async () => {
  logger.info('🟣 [CRON] Twitch social extraction started');
  try {
    const result = await extractTwitchSocialLinks(TWITCH_BATCH);
    logger.info('🟣 [CRON] Twitch extraction complete', result);
  } catch (error) {
    logger.error('❌ [CRON] Twitch extraction failed:', error);
  }
}, { scheduled: false });

/**
 * Kick Social Extraction - Every 2 hours
 * FREE (uses Kick API)
 */
export const kickExtractionJob = cron.schedule('30 */2 * * *', async () => {
  logger.info('🟢 [CRON] Kick social extraction started');
  try {
    const result = await extractKickSocialLinks(KICK_BATCH);
    logger.info('🟢 [CRON] Kick extraction complete', result);
  } catch (error) {
    logger.error('❌ [CRON] Kick extraction failed:', error);
  }
}, { scheduled: false });

/**
 * YouTube Social Extraction - Every 4 hours
 * Uses ScrapeCreators credits (~100 per run = 600/day)
 */
export const youtubeExtractionJob = cron.schedule('15 */4 * * *', async () => {
  logger.info('🔴 [CRON] YouTube social extraction started');
  try {
    const result = await extractYouTubeSocialLinks(YOUTUBE_BATCH);
    logger.info('🔴 [CRON] YouTube extraction complete', result);
  } catch (error) {
    logger.error('❌ [CRON] YouTube extraction failed:', error);
  }
}, { scheduled: false });

// Export functions for manual use
export {
  extractTwitchSocialLinks,
  extractKickSocialLinks,
  extractYouTubeSocialLinks,
};
