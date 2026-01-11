/**
 * Social Discovery Job - Discovers NEW creators across ALL platforms using ScrapeCreators
 *
 * Discovery methods by platform:
 * - TikTok: Keyword search, Hashtag search, Trending feed, Popular creators
 * - Instagram: Reels search (via Google) - finds reels and their creators
 * - Facebook: Ad Library search - finds iGaming advertisers
 * - LinkedIn: Ad Library search - finds B2B advertisers
 *
 * Note: YouTube does NOT have a search endpoint in ScrapeCreators.
 * Use the existing YouTube Data API discovery in youtubeDiscoveryJob.ts instead.
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
    'stake casino',
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

// Hashtags for discovery - expanded for 1K/day target
const DISCOVERY_HASHTAGS = {
  tiktok: [
    // English iGaming
    'slots', 'casino', 'gambling', 'poker', 'sportsbetting',
    'slotwin', 'casinolife', 'pokertiktok', 'bigwin', 'jackpot',
    'onlinecasino', 'slotmachine', 'casinonight', 'blackjack', 'roulette',
    'stake', 'stakeus', 'rollbit', 'bcgame', 'casinoonline',
    // Spanish
    'apuestas', 'tragamonedas', 'casinoenlinea', 'apuestasdeportivas',
    'slotsmexico', 'casinomexico', 'apostas', 'ganador',
    // Portuguese
    'cassino', 'apostasonline', 'slotsbrasil', 'cassinoaovivo',
    // Streamer names
    'roshtein', 'trainwreckstv', 'xposed', 'adinross',
  ],
  youtube: [
    'slots', 'casino', 'gambling', 'poker', 'sportsbetting',
    'slotmachine', 'casinostreamer', 'bigwin', 'onlinecasino',
    'livecasino', 'slotgames', 'casinolive', 'jackpot',
    'tragamonedas', 'cassino', 'apuestas',
  ],
  instagram: [
    'casino', 'slots', 'gambling', 'poker', 'casinonight',
    'slotmachine', 'casinoonline', 'sportsbetting', 'bigwin',
  ],
};

// Daily budget allocation for discovery - increased for 1K/day target
const DISCOVERY_DAILY_BUDGET = 2000;

interface DiscoveryResult {
  platform: string;
  method: string;
  query: string;
  searched: number;
  created: number;
  skipped: number;
  credits: number;
}

// ==================== TIKTOK DISCOVERY ====================

/**
 * Discover TikTok creators by keyword search
 */
async function discoverTikTokByKeyword(
  keyword: string,
  maxResults: number = 10
): Promise<DiscoveryResult> {
  const result: DiscoveryResult = {
    platform: 'TIKTOK',
    method: 'keyword',
    query: keyword,
    searched: 0,
    created: 0,
    skipped: 0,
    credits: 1,
  };

  try {
    const hasBudget = await syncOptimization.hasBudget('scrapecreators');
    if (!hasBudget) {
      logger.warn('ScrapeCreators budget exhausted');
      return result;
    }

    const searchResults = await scrapeCreatorsService.searchTikTokUsers(keyword);
    await syncOptimization.trackApiCall('scrapecreators', 'tiktok/search/users', 1, true);
    result.searched = searchResults.length;

    const toProcess = searchResults.slice(0, maxResults);

    for (const item of toProcess) {
      const userInfo = item.user_info;
      if (!userInfo?.unique_id) continue;

      const username = userInfo.unique_id.toLowerCase();
      const created = await upsertTikTokCreator(username, keyword);
      if (created === 'created') result.created++;
      else if (created === 'skipped') result.skipped++;
      else result.credits++; // profile fetch

      await new Promise(r => setTimeout(r, 100));
    }
  } catch (error) {
    logger.error(`TikTok keyword discovery failed for "${keyword}":`, error);
  }

  return result;
}

/**
 * Discover TikTok creators by hashtag
 */
async function discoverTikTokByHashtag(
  hashtag: string,
  maxResults: number = 20
): Promise<DiscoveryResult> {
  const result: DiscoveryResult = {
    platform: 'TIKTOK',
    method: 'hashtag',
    query: hashtag,
    searched: 0,
    created: 0,
    skipped: 0,
    credits: 1,
  };

  try {
    const videos = await scrapeCreatorsService.searchTikTokByHashtag(hashtag);
    await syncOptimization.trackApiCall('scrapecreators', 'tiktok/search/hashtag', 1, true);
    result.searched = videos.length;

    // Extract unique creators from videos
    const creatorUsernames = new Set<string>();
    for (const video of videos.slice(0, maxResults * 2)) {
      const author = video.author || video.user;
      if (author?.unique_id || author?.uniqueId) {
        creatorUsernames.add((author.unique_id || author.uniqueId).toLowerCase());
      }
    }

    for (const username of Array.from(creatorUsernames).slice(0, maxResults)) {
      const created = await upsertTikTokCreator(username, `hashtag:${hashtag}`);
      if (created === 'created') result.created++;
      else if (created === 'skipped') result.skipped++;
      else result.credits++;

      await new Promise(r => setTimeout(r, 100));
    }
  } catch (error) {
    logger.error(`TikTok hashtag discovery failed for "${hashtag}":`, error);
  }

  return result;
}

/**
 * Discover TikTok creators from trending feed
 */
async function discoverTikTokTrending(maxResults: number = 30): Promise<DiscoveryResult> {
  const result: DiscoveryResult = {
    platform: 'TIKTOK',
    method: 'trending',
    query: 'trending',
    searched: 0,
    created: 0,
    skipped: 0,
    credits: 1,
  };

  try {
    const videos = await scrapeCreatorsService.getTikTokTrending();
    await syncOptimization.trackApiCall('scrapecreators', 'tiktok/trending', 1, true);
    result.searched = videos.length;

    const creatorUsernames = new Set<string>();
    for (const video of videos) {
      const author = video.author || video.user;
      if (author?.unique_id || author?.uniqueId) {
        creatorUsernames.add((author.unique_id || author.uniqueId).toLowerCase());
      }
    }

    for (const username of Array.from(creatorUsernames).slice(0, maxResults)) {
      const created = await upsertTikTokCreator(username, 'trending');
      if (created === 'created') result.created++;
      else if (created === 'skipped') result.skipped++;
      else result.credits++;

      await new Promise(r => setTimeout(r, 100));
    }
  } catch (error) {
    logger.error('TikTok trending discovery failed:', error);
  }

  return result;
}

/**
 * Discover TikTok popular creators
 */
async function discoverTikTokPopularCreators(maxResults: number = 30): Promise<DiscoveryResult> {
  const result: DiscoveryResult = {
    platform: 'TIKTOK',
    method: 'popular',
    query: 'popular_creators',
    searched: 0,
    created: 0,
    skipped: 0,
    credits: 1,
  };

  try {
    const creators = await scrapeCreatorsService.getTikTokPopularCreators();
    await syncOptimization.trackApiCall('scrapecreators', 'tiktok/popular/creators', 1, true);
    result.searched = creators.length;

    for (const creator of creators.slice(0, maxResults)) {
      const username = (creator.unique_id || creator.uniqueId || creator.username || '').toLowerCase();
      if (!username) continue;

      const created = await upsertTikTokCreator(username, 'popular');
      if (created === 'created') result.created++;
      else if (created === 'skipped') result.skipped++;
      else result.credits++;

      await new Promise(r => setTimeout(r, 100));
    }
  } catch (error) {
    logger.error('TikTok popular creators discovery failed:', error);
  }

  return result;
}

async function upsertTikTokCreator(username: string, source: string): Promise<'created' | 'skipped' | 'fetched'> {
  const existing = await db.streamer.findUnique({
    where: { platform_username: { platform: Platform.TIKTOK, username } },
  });

  if (existing) return 'skipped';

  const profile = await scrapeCreatorsService.getTikTokProfile(username);
  if (!profile) return 'fetched';

  const followers = typeof profile.followerCount === 'string'
    ? parseInt(profile.followerCount)
    : (profile.followerCount || 0);

  if (followers < 1000) return 'fetched';

  try {
    await db.streamer.create({
      data: {
        platform: Platform.TIKTOK,
        username,
        displayName: profile.nickname || username,
        profileUrl: `https://tiktok.com/@${username}`,
        avatarUrl: profile.avatarLarger || profile.avatarMedium,
        followers,
        totalLikes: BigInt(typeof profile.heartCount === 'string' ? parseInt(profile.heartCount) : (profile.heartCount || 0)),
        profileDescription: profile.signature,
        isLive: false,
        language: 'en',
        region: Region.WORLDWIDE,
        tags: [source.split(':')[0]],
        socialLinks: [],
        discoveredVia: `scrapecreators:tiktok:${source}`,
      },
    });
    logger.info(`Discovered TikTok: @${username} (${followers.toLocaleString()} followers)`);
    return 'created';
  } catch (error) {
    return 'skipped';
  }
}

// ==================== YOUTUBE DISCOVERY ====================
// NOTE: ScrapeCreators does NOT have YouTube search endpoints.
// YouTube discovery should use the YouTube Data API in youtubeDiscoveryJob.ts instead.
// These stubs are kept for API compatibility but return empty results.

// ==================== INSTAGRAM DISCOVERY ====================

/**
 * Discover Instagram creators by reels search
 */
async function discoverInstagramByReels(
  query: string,
  maxResults: number = 10
): Promise<DiscoveryResult> {
  const result: DiscoveryResult = {
    platform: 'INSTAGRAM',
    method: 'reels_search',
    query,
    searched: 0,
    created: 0,
    skipped: 0,
    credits: 1,
  };

  try {
    const reels = await scrapeCreatorsService.searchInstagramReels(query);
    await syncOptimization.trackApiCall('scrapecreators', 'instagram/search/reels', 1, true);
    result.searched = reels.length;

    const usernames = new Set<string>();
    for (const reel of reels) {
      const username = reel.owner?.username || reel.user?.username || reel.username;
      if (username) usernames.add(username.toLowerCase());
    }

    logger.info(`Instagram reels search "${query}": found ${reels.length} reels, extracted ${usernames.size} unique usernames: ${Array.from(usernames).join(', ')}`);

    for (const username of Array.from(usernames).slice(0, maxResults)) {
      const created = await upsertInstagramCreator(username, `reels:${query}`);
      if (created === 'created') result.created++;
      else if (created === 'skipped') result.skipped++;
      else result.credits++;

      await new Promise(r => setTimeout(r, 100));
    }
  } catch (error) {
    logger.error(`Instagram reels discovery failed for "${query}":`, error);
  }

  return result;
}

async function upsertInstagramCreator(username: string, source: string): Promise<'created' | 'skipped' | 'fetched'> {
  const existing = await db.streamer.findUnique({
    where: { platform_username: { platform: Platform.INSTAGRAM, username } },
  });

  if (existing) {
    logger.debug(`Instagram @${username}: already exists, skipping`);
    return 'skipped';
  }

  const profile = await scrapeCreatorsService.getInstagramProfile(username);
  if (!profile) {
    logger.warn(`Instagram @${username}: profile fetch FAILED (null response)`);
    return 'fetched';
  }

  if (profile.follower_count < 1000) {
    logger.debug(`Instagram @${username}: only ${profile.follower_count} followers (< 1000 threshold)`);
    return 'fetched';
  }

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
        tags: [source.split(':')[0]],
        socialLinks: [],
        discoveredVia: `scrapecreators:instagram:${source}`,
      },
    });
    logger.info(`Discovered Instagram: @${username} (${profile.follower_count.toLocaleString()} followers)`);
    return 'created';
  } catch (error: any) {
    logger.error(`Instagram @${username}: DB create failed: ${error.message}`);
    return 'skipped';
  }
}


/**
 * Discover Instagram creators through related profiles
 * Takes existing creators from our DB and finds their related accounts
 */
async function discoverInstagramFromRelatedProfiles(
  maxSeedProfiles: number = 10,
  maxRelatedPerProfile: number = 5
): Promise<DiscoveryResult> {
  const result: DiscoveryResult = {
    platform: 'INSTAGRAM',
    method: 'related_profiles',
    query: 'existing_creators',
    searched: 0,
    created: 0,
    skipped: 0,
    credits: 0,
  };

  try {
    // Get existing Instagram creators with good follower counts to use as seeds
    const seedCreators = await db.streamer.findMany({
      where: {
        platform: Platform.INSTAGRAM,
        followers: { gte: 10000 }, // Only use established accounts as seeds
      },
      orderBy: { followers: 'desc' },
      take: maxSeedProfiles,
      select: { username: true, followers: true },
    });

    logger.info(`Instagram related discovery: using ${seedCreators.length} seed creators`);

    for (const seed of seedCreators) {
      const hasBudget = await syncOptimization.hasBudget('scrapecreators');
      if (!hasBudget) {
        logger.warn('ScrapeCreators budget exhausted');
        break;
      }

      // Fetch related profiles for this seed creator
      const related = await scrapeCreatorsService.getInstagramRelatedProfiles(seed.username);
      await syncOptimization.trackApiCall('scrapecreators', 'instagram/profile', 1, true);
      result.credits++;
      result.searched += related.length;

      logger.info(`Instagram @${seed.username}: found ${related.length} related profiles`);

      // Process each related profile
      for (const relatedProfile of related.slice(0, maxRelatedPerProfile)) {
        if (relatedProfile.is_private) continue;

        const created = await upsertInstagramCreator(
          relatedProfile.username,
          `related:${seed.username}`
        );

        if (created === 'created') {
          result.created++;
          result.credits++; // Profile fetch credit
        } else if (created === 'skipped') {
          result.skipped++;
        } else {
          result.credits++; // Profile fetch credit even if not created
        }

        await new Promise(r => setTimeout(r, 150));
      }

      await new Promise(r => setTimeout(r, 200));
    }
  } catch (error) {
    logger.error('Instagram related profiles discovery failed:', error);
  }

  logger.info(`Instagram related discovery complete: ${result.created} created, ${result.skipped} skipped`);
  return result;
}

// ==================== FACEBOOK DISCOVERY (Ad Library) ====================

/**
 * Discover Facebook advertisers from Ad Library
 */
async function discoverFacebookAdvertisers(
  query: string,
  maxResults: number = 10
): Promise<DiscoveryResult> {
  const result: DiscoveryResult = {
    platform: 'FACEBOOK',
    method: 'ad_library',
    query,
    searched: 0,
    created: 0,
    skipped: 0,
    credits: 1,
  };

  try {
    const ads = await scrapeCreatorsService.searchFacebookAds(query);
    await syncOptimization.trackApiCall('scrapecreators', 'facebook/ads/search', 1, true);
    result.searched = ads.length;

    const pageIds = new Set<string>();
    for (const ad of ads) {
      const pageId = ad.page_id || ad.pageId || ad.advertiser?.id;
      const pageName = ad.page_name || ad.pageName || ad.advertiser?.name;
      if (pageId && pageName) {
        pageIds.add(JSON.stringify({ id: pageId, name: pageName }));
      }
    }

    for (const pageJson of Array.from(pageIds).slice(0, maxResults)) {
      const page = JSON.parse(pageJson);
      const created = await upsertFacebookPage(page.id, page.name, `ads:${query}`);
      if (created === 'created') result.created++;
      else if (created === 'skipped') result.skipped++;
      else result.credits++;

      await new Promise(r => setTimeout(r, 100));
    }
  } catch (error) {
    logger.error(`Facebook ads discovery failed for "${query}":`, error);
  }

  return result;
}

async function upsertFacebookPage(pageId: string, pageName: string, source: string): Promise<'created' | 'skipped' | 'fetched'> {
  const existing = await db.streamer.findFirst({
    where: {
      platform: Platform.FACEBOOK,
      OR: [
        { username: pageId },
        { profileUrl: { contains: pageId } },
      ],
    },
  });

  if (existing) return 'skipped';

  const profile = await scrapeCreatorsService.getFacebookProfile(pageId);

  try {
    await db.streamer.create({
      data: {
        platform: Platform.FACEBOOK,
        username: profile?.username || pageId,
        displayName: profile?.name || pageName,
        profileUrl: `https://facebook.com/${profile?.username || pageId}`,
        avatarUrl: profile?.image,
        followers: profile?.follower_count || 0,
        totalLikes: BigInt(profile?.likes_count || 0),
        profileDescription: profile?.about,
        isLive: false,
        language: 'en',
        region: Region.WORLDWIDE,
        tags: ['advertiser'],
        socialLinks: [],
        discoveredVia: `scrapecreators:facebook:${source}`,
      },
    });
    logger.info(`Discovered Facebook: ${pageName} (${(profile?.follower_count || 0).toLocaleString()} followers)`);
    return 'created';
  } catch (error) {
    return 'skipped';
  }
}

// ==================== LINKEDIN DISCOVERY (Ad Library) ====================

/**
 * Discover LinkedIn advertisers from Ad Library
 */
async function discoverLinkedInAdvertisers(
  query: string,
  maxResults: number = 10
): Promise<DiscoveryResult> {
  const result: DiscoveryResult = {
    platform: 'LINKEDIN',
    method: 'ad_library',
    query,
    searched: 0,
    created: 0,
    skipped: 0,
    credits: 1,
  };

  try {
    const ads = await scrapeCreatorsService.searchLinkedInAds(query);
    await syncOptimization.trackApiCall('scrapecreators', 'linkedin/ads/search', 1, true);
    result.searched = ads.length;

    const companies = new Set<string>();
    for (const ad of ads) {
      const companyId = ad.advertiser?.id || ad.company_id || ad.companyId;
      const companyName = ad.advertiser?.name || ad.company_name || ad.companyName;
      if (companyId && companyName) {
        companies.add(JSON.stringify({ id: companyId, name: companyName }));
      }
    }

    for (const companyJson of Array.from(companies).slice(0, maxResults)) {
      const company = JSON.parse(companyJson);
      const created = await upsertLinkedInCompany(company.id, company.name, `ads:${query}`);
      if (created === 'created') result.created++;
      else if (created === 'skipped') result.skipped++;
      else result.credits++;

      await new Promise(r => setTimeout(r, 100));
    }
  } catch (error) {
    logger.error(`LinkedIn ads discovery failed for "${query}":`, error);
  }

  return result;
}

async function upsertLinkedInCompany(companyId: string, companyName: string, source: string): Promise<'created' | 'skipped' | 'fetched'> {
  const existing = await db.streamer.findFirst({
    where: {
      platform: Platform.LINKEDIN,
      OR: [
        { username: companyId },
        { profileUrl: { contains: companyId } },
      ],
    },
  });

  if (existing) return 'skipped';

  const profile = await scrapeCreatorsService.getLinkedInProfile(companyId);

  try {
    await db.streamer.create({
      data: {
        platform: Platform.LINKEDIN,
        username: profile?.public_identifier || companyId,
        displayName: profile ? `${profile.first_name} ${profile.last_name}`.trim() : companyName,
        profileUrl: `https://linkedin.com/company/${profile?.public_identifier || companyId}`,
        avatarUrl: profile?.image,
        followers: profile?.follower_count || 0,
        profileDescription: profile?.headline || profile?.summary,
        isLive: false,
        language: 'en',
        region: Region.WORLDWIDE,
        tags: ['advertiser'],
        socialLinks: [],
        discoveredVia: `scrapecreators:linkedin:${source}`,
      },
    });
    logger.info(`Discovered LinkedIn: ${companyName} (${(profile?.follower_count || 0).toLocaleString()} followers)`);
    return 'created';
  } catch (error) {
    return 'skipped';
  }
}

// ==================== MAIN DISCOVERY FUNCTIONS ====================

/**
 * Run comprehensive social discovery across all platforms
 */
export async function runSocialDiscovery(options: {
  platforms?: ('tiktok' | 'instagram' | 'facebook' | 'linkedin')[];
  methods?: ('keyword' | 'hashtag' | 'trending' | 'popular' | 'ads' | 'related')[];
  keywordSet?: 'primary' | 'secondary' | 'influencer' | 'all';
  maxResultsPerQuery?: number;
  maxCredits?: number;
} = {}): Promise<{
  totalDiscovered: number;
  totalCredits: number;
  byPlatform: Record<string, number>;
  results: DiscoveryResult[];
}> {
  const {
    // Note: YouTube removed - use YouTube Data API in youtubeDiscoveryJob.ts
    platforms = ['tiktok', 'instagram', 'facebook', 'linkedin'],
    methods = ['keyword', 'hashtag', 'trending', 'popular', 'ads'],
    keywordSet = 'primary',
    maxResultsPerQuery = 10,
    maxCredits = DISCOVERY_DAILY_BUDGET,
  } = options;

  logger.info('Starting comprehensive social discovery', { platforms, methods, keywordSet });

  // Get keywords
  let keywords: string[];
  if (keywordSet === 'all') {
    keywords = [...DISCOVERY_KEYWORDS.primary, ...DISCOVERY_KEYWORDS.secondary, ...DISCOVERY_KEYWORDS.influencer];
  } else {
    keywords = DISCOVERY_KEYWORDS[keywordSet];
  }

  const results: DiscoveryResult[] = [];
  let totalCredits = 0;
  const byPlatform: Record<string, number> = {
    tiktok: 0, instagram: 0, facebook: 0, linkedin: 0,
  };

  // TikTok Discovery
  if (platforms.includes('tiktok')) {
    // Keyword search
    if (methods.includes('keyword')) {
      for (const keyword of keywords) {
        if (totalCredits >= maxCredits) break;
        const r = await discoverTikTokByKeyword(keyword, maxResultsPerQuery);
        results.push(r);
        totalCredits += r.credits;
        byPlatform.tiktok += r.created;
        await new Promise(res => setTimeout(res, 300));
      }
    }

    // Hashtag search
    if (methods.includes('hashtag')) {
      for (const hashtag of DISCOVERY_HASHTAGS.tiktok.slice(0, 5)) {
        if (totalCredits >= maxCredits) break;
        const r = await discoverTikTokByHashtag(hashtag, maxResultsPerQuery);
        results.push(r);
        totalCredits += r.credits;
        byPlatform.tiktok += r.created;
        await new Promise(res => setTimeout(res, 300));
      }
    }

    // Trending
    if (methods.includes('trending')) {
      if (totalCredits < maxCredits) {
        const r = await discoverTikTokTrending(maxResultsPerQuery);
        results.push(r);
        totalCredits += r.credits;
        byPlatform.tiktok += r.created;
      }
    }

    // Popular creators
    if (methods.includes('popular')) {
      if (totalCredits < maxCredits) {
        const r = await discoverTikTokPopularCreators(maxResultsPerQuery);
        results.push(r);
        totalCredits += r.credits;
        byPlatform.tiktok += r.created;
      }
    }
  }

  // NOTE: YouTube discovery removed - ScrapeCreators doesn't have YouTube search.
  // Use youtubeDiscoveryJob.ts with YouTube Data API instead.

  // Instagram Discovery
  if (platforms.includes('instagram')) {
    // Keyword search via reels
    if (methods.includes('keyword')) {
      for (const keyword of keywords.slice(0, 3)) {
        if (totalCredits >= maxCredits) break;
        const r = await discoverInstagramByReels(keyword, maxResultsPerQuery);
        results.push(r);
        totalCredits += r.credits;
        byPlatform.instagram += r.created;
        await new Promise(res => setTimeout(res, 300));
      }
    }

    // Related profiles discovery (find similar accounts to existing creators)
    if (methods.includes('related') || methods.includes('popular')) {
      if (totalCredits < maxCredits) {
        const r = await discoverInstagramFromRelatedProfiles(5, maxResultsPerQuery);
        results.push(r);
        totalCredits += r.credits;
        byPlatform.instagram += r.created;
      }
    }
  }

  // Facebook Discovery (Ad Library)
  if (platforms.includes('facebook')) {
    if (methods.includes('ads')) {
      for (const keyword of keywords.slice(0, 2)) {
        if (totalCredits >= maxCredits) break;
        const r = await discoverFacebookAdvertisers(keyword, maxResultsPerQuery);
        results.push(r);
        totalCredits += r.credits;
        byPlatform.facebook += r.created;
        await new Promise(res => setTimeout(res, 300));
      }
    }
  }

  // LinkedIn Discovery (Ad Library)
  if (platforms.includes('linkedin')) {
    if (methods.includes('ads')) {
      for (const keyword of keywords.slice(0, 2)) {
        if (totalCredits >= maxCredits) break;
        const r = await discoverLinkedInAdvertisers(keyword, maxResultsPerQuery);
        results.push(r);
        totalCredits += r.credits;
        byPlatform.linkedin += r.created;
        await new Promise(res => setTimeout(res, 300));
      }
    }
  }

  const totalDiscovered = Object.values(byPlatform).reduce((a, b) => a + b, 0);

  logger.info('Social discovery complete', { totalDiscovered, totalCredits, byPlatform });

  return { totalDiscovered, totalCredits, byPlatform, results };
}

/**
 * Quick social discovery - TikTok + Instagram, primary keywords
 * (YouTube handled by youtubeDiscoveryJob.ts)
 */
export async function runQuickSocialDiscovery(): Promise<{ totalDiscovered: number; totalCredits: number }> {
  return runSocialDiscovery({
    platforms: ['tiktok', 'instagram'],
    methods: ['keyword', 'trending'],
    keywordSet: 'primary',
    maxResultsPerQuery: 5,
    maxCredits: 100,
  });
}

/**
 * Full social discovery - all platforms and methods
 * (YouTube handled by youtubeDiscoveryJob.ts)
 */
export async function runFullSocialDiscovery(): Promise<{ totalDiscovered: number; totalCredits: number }> {
  return runSocialDiscovery({
    platforms: ['tiktok', 'instagram', 'facebook', 'linkedin'],
    methods: ['keyword', 'hashtag', 'trending', 'popular', 'ads'],
    keywordSet: 'all',
    maxResultsPerQuery: 15,
    maxCredits: DISCOVERY_DAILY_BUDGET,
  });
}

/**
 * Influencer-focused discovery - search for known names
 * (YouTube handled by youtubeDiscoveryJob.ts)
 */
export async function runInfluencerDiscovery(): Promise<{ totalDiscovered: number; totalCredits: number }> {
  return runSocialDiscovery({
    platforms: ['tiktok', 'instagram'],
    methods: ['keyword'],
    keywordSet: 'influencer',
    maxResultsPerQuery: 15,
    maxCredits: 200,
  });
}

/**
 * Platform-specific discovery
 * (YouTube handled by youtubeDiscoveryJob.ts)
 */
export async function runPlatformDiscovery(
  platform: 'tiktok' | 'instagram' | 'facebook' | 'linkedin'
): Promise<{ totalDiscovered: number; totalCredits: number }> {
  return runSocialDiscovery({
    platforms: [platform],
    methods: ['keyword', 'hashtag', 'trending', 'popular', 'ads'],
    keywordSet: 'primary',
    maxResultsPerQuery: 20,
    maxCredits: 150,
  });
}
