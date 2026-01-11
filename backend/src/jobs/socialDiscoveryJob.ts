/**
 * Social Discovery Job - Discovers NEW creators on TikTok, Instagram, X using ScrapeCreators
 *
 * Uses keyword-based search to find iGaming-relevant creators:
 * - Search for gambling/casino/slots keywords
 * - Add new creators to database
 * - Track credit usage per budget limits
 */

import { db, logger } from '../utils/database';
import { Platform, Region } from '@prisma/client';
import { scrapeCreatorsService } from '../services/scrapeCreatorsService';
import { syncOptimization } from '../services/syncOptimizationService';

// Discovery keywords for iGaming niche
const DISCOVERY_KEYWORDS = {
  primary: [
    'slots streamer',
    'casino streamer',
    'gambling streamer',
    'poker player',
    'sports betting',
  ],
  secondary: [
    'slot machine',
    'online casino',
    'blackjack',
    'roulette',
    'stake',
    'rollbit',
    'bc.game',
    'apuestas',      // Spanish: betting
    'tragamonedas',  // Spanish: slots
  ],
  influencer: [
    'roshtein',
    'xposed',
    'trainwreckstv',
    'adin ross',
    'yassuo',
  ],
};

// Daily budget allocation for discovery (subset of total scrapecreators budget)
const DISCOVERY_DAILY_BUDGET = 500; // Credits reserved for discovery

interface DiscoveryResult {
  platform: string;
  keyword: string;
  searched: number;
  created: number;
  skipped: number;
  credits: number;
}

/**
 * Search TikTok for creators matching a keyword
 */
async function discoverTikTokByKeyword(
  keyword: string,
  maxResults: number = 10
): Promise<DiscoveryResult> {
  const result: DiscoveryResult = {
    platform: 'TIKTOK',
    keyword,
    searched: 0,
    created: 0,
    skipped: 0,
    credits: 1, // 1 credit for search
  };

  try {
    // Check budget before making API call
    const hasBudget = await syncOptimization.hasBudget('scrapecreators');
    if (!hasBudget) {
      logger.warn('ScrapeCreators daily budget exhausted, skipping TikTok discovery');
      return result;
    }

    const searchResults = await scrapeCreatorsService.searchTikTokUsers(keyword);
    await syncOptimization.trackApiCall('scrapecreators', 'tiktok/search/users', 1, true);

    result.searched = searchResults.length;

    // Process top results (limit to avoid using too many credits)
    const toProcess = searchResults.slice(0, maxResults);

    for (const item of toProcess) {
      const userInfo = item.user_info;
      if (!userInfo?.unique_id) continue;

      const username = userInfo.unique_id.toLowerCase();

      // Check if already exists
      const existing = await db.streamer.findUnique({
        where: {
          platform_username: {
            platform: Platform.TIKTOK,
            username,
          },
        },
      });

      if (existing) {
        result.skipped++;
        continue;
      }

      // Get full profile (costs 1 credit)
      const profile = await scrapeCreatorsService.getTikTokProfile(username);
      await syncOptimization.trackApiCall('scrapecreators', 'tiktok/profile', 1, !!profile);
      result.credits++;

      if (profile) {
        // Parse follower count
        const followers = typeof profile.followerCount === 'string'
          ? parseInt(profile.followerCount)
          : (profile.followerCount || 0);

        // Only add if they have at least 1000 followers
        if (followers >= 1000) {
          try {
            await db.streamer.create({
              data: {
                platform: Platform.TIKTOK,
                username,
                displayName: profile.nickname || username,
                profileUrl: `https://tiktok.com/@${username}`,
                avatarUrl: profile.avatarLarger || profile.avatarMedium,
                followers,
                totalLikes: BigInt(
                  typeof profile.heartCount === 'string'
                    ? parseInt(profile.heartCount)
                    : (profile.heartCount || 0)
                ),
                profileDescription: profile.signature,
                isLive: false,
                language: 'en',
                region: Region.WORLDWIDE,
                tags: [keyword.split(' ')[0]], // Tag with search keyword
                socialLinks: [],
                lastSeenLive: null,
                discoveredVia: `search:${keyword}`,
              },
            });
            result.created++;
            logger.info(`Discovered TikTok creator: @${username} (${followers.toLocaleString()} followers)`);
          } catch (error) {
            // Duplicate or other error
          }
        }
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, 100));
    }

  } catch (error) {
    logger.error(`TikTok discovery failed for "${keyword}":`, error);
    await syncOptimization.trackApiCall('scrapecreators', 'tiktok/search/users', 1, false, 'error');
  }

  return result;
}

/**
 * Search Instagram for creators matching a keyword
 */
async function discoverInstagramByKeyword(
  keyword: string,
  maxResults: number = 10
): Promise<DiscoveryResult> {
  const result: DiscoveryResult = {
    platform: 'INSTAGRAM',
    keyword,
    searched: 0,
    created: 0,
    skipped: 0,
    credits: 1,
  };

  try {
    const hasBudget = await syncOptimization.hasBudget('scrapecreators');
    if (!hasBudget) {
      logger.warn('ScrapeCreators daily budget exhausted, skipping Instagram discovery');
      return result;
    }

    const searchResults = await scrapeCreatorsService.searchInstagramUsers(keyword);
    await syncOptimization.trackApiCall('scrapecreators', 'instagram/search', 1, true);

    result.searched = searchResults.length;

    const toProcess = searchResults.slice(0, maxResults);

    for (const item of toProcess) {
      const username = (item.username || '').toLowerCase();
      if (!username) continue;

      const existing = await db.streamer.findUnique({
        where: {
          platform_username: {
            platform: Platform.INSTAGRAM,
            username,
          },
        },
      });

      if (existing) {
        result.skipped++;
        continue;
      }

      // Get full profile
      const profile = await scrapeCreatorsService.getInstagramProfile(username);
      await syncOptimization.trackApiCall('scrapecreators', 'instagram/profile', 1, !!profile);
      result.credits++;

      if (profile && profile.follower_count >= 1000) {
        try {
          await db.streamer.create({
            data: {
              platform: Platform.INSTAGRAM,
              username,
              displayName: profile.full_name || username,
              profileUrl: `https://instagram.com/${username}`,
              avatarUrl: profile.profile_pic_url,
              followers: profile.follower_count,
              totalLikes: BigInt(profile.total_likes || 0),
              profileDescription: profile.biography,
              isLive: false,
              language: 'en',
              region: Region.WORLDWIDE,
              tags: [keyword.split(' ')[0]],
              socialLinks: [],
              lastSeenLive: null,
              discoveredVia: `search:${keyword}`,
            },
          });
          result.created++;
          logger.info(`Discovered Instagram creator: @${username} (${profile.follower_count.toLocaleString()} followers)`);
        } catch (error) {
          // Duplicate or other error
        }
      }

      await new Promise(r => setTimeout(r, 100));
    }

  } catch (error) {
    logger.error(`Instagram discovery failed for "${keyword}":`, error);
    await syncOptimization.trackApiCall('scrapecreators', 'instagram/search', 1, false, 'error');
  }

  return result;
}

/**
 * Run social discovery across TikTok and Instagram
 */
export async function runSocialDiscovery(options: {
  platforms?: ('tiktok' | 'instagram')[];
  keywordSet?: 'primary' | 'secondary' | 'influencer' | 'all';
  maxResultsPerKeyword?: number;
  maxCredits?: number;
} = {}): Promise<{
  totalDiscovered: number;
  totalCredits: number;
  byPlatform: Record<string, number>;
  results: DiscoveryResult[];
}> {
  const {
    platforms = ['tiktok', 'instagram'],
    keywordSet = 'primary',
    maxResultsPerKeyword = 10,
    maxCredits = DISCOVERY_DAILY_BUDGET,
  } = options;

  logger.info('Starting social discovery job', { platforms, keywordSet });

  // Get keywords based on set
  let keywords: string[];
  if (keywordSet === 'all') {
    keywords = [
      ...DISCOVERY_KEYWORDS.primary,
      ...DISCOVERY_KEYWORDS.secondary,
      ...DISCOVERY_KEYWORDS.influencer,
    ];
  } else {
    keywords = DISCOVERY_KEYWORDS[keywordSet];
  }

  const results: DiscoveryResult[] = [];
  let totalCredits = 0;
  const byPlatform: Record<string, number> = { tiktok: 0, instagram: 0 };

  for (const keyword of keywords) {
    // Check if we've exceeded credit budget
    if (totalCredits >= maxCredits) {
      logger.warn(`Discovery credit budget reached (${totalCredits}/${maxCredits}), stopping`);
      break;
    }

    // TikTok discovery
    if (platforms.includes('tiktok')) {
      const tiktokResult = await discoverTikTokByKeyword(keyword, maxResultsPerKeyword);
      results.push(tiktokResult);
      totalCredits += tiktokResult.credits;
      byPlatform.tiktok += tiktokResult.created;

      if (tiktokResult.created > 0) {
        logger.info(`TikTok "${keyword}": Found ${tiktokResult.searched}, Created ${tiktokResult.created}, Credits: ${tiktokResult.credits}`);
      }

      await new Promise(r => setTimeout(r, 500)); // Rate limit between keywords
    }

    // Instagram discovery
    if (platforms.includes('instagram')) {
      const instagramResult = await discoverInstagramByKeyword(keyword, maxResultsPerKeyword);
      results.push(instagramResult);
      totalCredits += instagramResult.credits;
      byPlatform.instagram += instagramResult.created;

      if (instagramResult.created > 0) {
        logger.info(`Instagram "${keyword}": Found ${instagramResult.searched}, Created ${instagramResult.created}, Credits: ${instagramResult.credits}`);
      }

      await new Promise(r => setTimeout(r, 500));
    }
  }

  const totalDiscovered = byPlatform.tiktok + byPlatform.instagram;

  logger.info('Social discovery complete', {
    totalDiscovered,
    totalCredits,
    byPlatform,
  });

  return {
    totalDiscovered,
    totalCredits,
    byPlatform,
    results,
  };
}

/**
 * Quick social discovery - primary keywords only, limited results
 */
export async function runQuickSocialDiscovery(): Promise<{ totalDiscovered: number; totalCredits: number }> {
  return runSocialDiscovery({
    keywordSet: 'primary',
    maxResultsPerKeyword: 5,
    maxCredits: 100,
  });
}

/**
 * Full social discovery - all keywords
 */
export async function runFullSocialDiscovery(): Promise<{ totalDiscovered: number; totalCredits: number }> {
  return runSocialDiscovery({
    keywordSet: 'all',
    maxResultsPerKeyword: 10,
    maxCredits: DISCOVERY_DAILY_BUDGET,
  });
}

/**
 * Influencer-focused discovery - search for known big names to find related accounts
 */
export async function runInfluencerDiscovery(): Promise<{ totalDiscovered: number; totalCredits: number }> {
  return runSocialDiscovery({
    keywordSet: 'influencer',
    maxResultsPerKeyword: 15,
    maxCredits: 200,
  });
}
