/**
 * LinkedIn Full Discovery
 *
 * Strategy:
 * 1. Fetch YouTube channel data
 * 2. If LinkedIn URL found, try to get LinkedIn profile data
 * 3. If LinkedIn is private, STILL create the entry with YouTube avatar and 0 stats
 * 4. This ensures we capture all LinkedIn URLs even if profiles are private
 */

import axios from 'axios';
import { db, logger } from '../src/utils/database';
import { Platform, Region } from '@prisma/client';
import { bunnyService } from '../src/services/bunnyService';

const SCRAPECREATORS_API_KEY = process.env.SCRAPECREATORS_API_KEY || 'qJY95WcDxCStfw9idIub8a04Cyr1';
const RATE_LIMIT_MS = 300;

// Comprehensive list of professional YouTube channels
const YOUTUBE_CHANNELS = [
  // Tech & Programming
  'Fireship', 'TraversyMedia', 'WebDevSimplified', 'TheCodingTrain', 'DerekBanas',
  'ProgrammingWithMosh', 'sentdex', 'CoreySchafer', 'TechWithTim', 'thenewboston',
  'academind', 'HiteshChoudhary', 'CodeWithChris', 'SonnySangha', 'JackHerrington',
  'NetworkChuck', 'DavidBombal', 'JohnHammond', 'LiveOverflow', 'HackerSploit',
  'Computerphile', 'Numberphile', 'SebastianLague', 'ArjanCodes', 'mCoding',
  'AnthonyGG', 'PolyMatter', 'WendoverProductions', 'RealEngineering',
  // Business & Entrepreneurship
  'GaryVaynerchuk', 'PatrickBetDavid', 'EvanCarmichael', 'GrantCardone',
  'AlexHormozi', 'CodieSanchez', 'MyFirstMillion', 'TheFutur', 'ChrisDo',
  'BigThink', 'TED', 'TEDxTalks', 'TEDEd', 'HarvardBusinessReview',
  'Entrepreneur', 'Forbes', 'Bloomberg', 'CNBC', 'Wired', 'TheVerge',
  // Finance & Investing
  'GrahamStephan', 'AndreJikh', 'TheFinancialDiet', 'DaveRamsey',
  'TheMoneyGuy', 'WhiteboardFinance', 'BenFelix', 'FinancialEducation',
  'MeetKevin', 'MinorityMindset', 'MarkTilbury', 'BrianJung', 'JakeTran', 'ColdFusion',
  // Marketing
  'NeilPatel', 'RussellBrunson', 'DigitalMarketer', 'Hubspot', 'Ahrefs', 'Semrush',
  'AmyPorterfield', 'PatFlynn', 'ThinkMedia', 'VidIQ',
  // Leadership
  'SimonSinek', 'JockoWillink', 'TimFerriss', 'MattDAvella', 'ThomasFrank', 'AliAbdaal',
  // Science
  'Veritasium', 'SmarterEveryDay', 'Vsauce', 'Kurzgesagt', 'MinutePhysics',
  'SciShow', 'CrashCourse', 'TomScott', 'CGPGrey',
  // Tech Companies
  'Google', 'Microsoft', 'Apple', 'Amazon', 'Meta', 'NVIDIA', 'Salesforce', 'Adobe',
  'MongoDB', 'Stripe', 'Coinbase',
  // VC & Startups
  'YCombinator', 'a16z', 'Sequoia', 'FirstRound', 'TechStars', 'ProductHunt',
  // Spanish Business
  'FrancoisPouzet', 'ThePowerMBA', 'Domestika', 'Platzi', 'InversorGlobal',
  // Portuguese Business
  'PrimoRico', 'MePoupe', 'NathaliaArcuri', 'ThiagoNigro',
  // Podcasts
  'LexFridman', 'HubermanLab', 'TimFerrisShow', 'AllInPodcast', 'IndieHackers',
  // More Tech
  'FreeCodeCamp', 'MITOpenCourseWare', 'StanfordOnline', 'HarvardOnline',
  // E-commerce
  'Shopify', 'WholesaleTed', 'KevinDavid',
  // AI/ML
  'TwoMinutePapers', 'YannicKilcher', 'DeepLearningAI', 'GoogleAI', 'OpenAI',
  // Consulting
  'McKinsey', 'BCG', 'Bain', 'Deloitte', 'Accenture',
  // Design
  'TheFutur', 'Flux', 'PeterMcKinnon', 'LinusTechTips', 'MKBHD',
  // Crypto
  'Coinbureau', 'Bankless', 'AltcoinDaily', 'BenjaminCowen',
  // Productivity
  'LinkedInLearning', 'Notion', 'Figma', 'Canva',
  // Additional business channels
  'BusinessInsider', 'Inc', 'FastCompany', 'YahooFinance',
  'BiggerPockets', 'RyanSerhant', 'SarahChrisman',
  // International
  'BBCBusiness', 'FinancialTimes', 'TheEconomist',
  // More creators
  'JordanBPeterson', 'SethGodin', 'GaryVee', 'TaiLopez', 'DanLok',
  'BrianTracy', 'RobinSharma', 'LesLesBrown', 'TomBilyeu',
];

function extractLinkedInHandle(url: string): string | null {
  const match = url.match(/linkedin\.com\/(?:in|company)\/([^/?#]+)/i);
  return match ? match[1] : null;
}

function getHighestResAvatar(avatar: any): string | null {
  const sources = avatar?.image?.sources;
  if (!sources || sources.length === 0) return null;
  const sorted = [...sources].sort((a, b) => (b.width || 0) - (a.width || 0));
  return sorted[0]?.url || null;
}

async function fetchYouTubeChannel(handle: string): Promise<any> {
  try {
    const url = handle.startsWith('http') ? handle : `https://www.youtube.com/@${handle}`;
    const response = await axios.get('https://api.scrapecreators.com/v1/youtube/channel', {
      headers: { 'x-api-key': SCRAPECREATORS_API_KEY },
      params: { url },
      timeout: 30000
    });
    if (!response.data?.success) return null;
    return response.data;
  } catch (error: any) {
    return null;
  }
}

async function fetchLinkedInProfile(linkedinUrl: string): Promise<{ profile: any; isPrivate: boolean }> {
  try {
    const endpoint = linkedinUrl.includes('/company/')
      ? 'https://api.scrapecreators.com/v1/linkedin/company'
      : 'https://api.scrapecreators.com/v1/linkedin/profile';

    const response = await axios.get(endpoint, {
      headers: { 'x-api-key': SCRAPECREATORS_API_KEY },
      params: { url: linkedinUrl },
      timeout: 30000
    });

    // Check if profile is private
    if (response.data?.message?.includes('private') || response.data?.message?.includes('not publicly available')) {
      return { profile: null, isPrivate: true };
    }

    const data = response.data?.data || response.data;
    if (!data || data.success === false) {
      return { profile: null, isPrivate: true };
    }

    return { profile: data, isPrivate: false };
  } catch (error: any) {
    // Most errors mean the profile is not accessible
    return { profile: null, isPrivate: true };
  }
}

async function createLinkedInEntry(
  linkedinUrl: string,
  ytData: { name: string; avatar: string | null; subscribers: number },
  ytHandle: string,
  linkedinProfile: any | null,
  isPrivate: boolean
): Promise<boolean> {
  const handle = extractLinkedInHandle(linkedinUrl);
  if (!handle) return false;

  try {
    const existing = await db.streamer.findUnique({
      where: {
        platform_username: { platform: 'LINKEDIN', username: handle.toLowerCase() }
      }
    });

    if (existing) {
      return false;
    }

    // Determine what data to use
    let displayName: string;
    let avatarUrl: string | undefined;
    let followers = 0;
    let description: string;

    if (linkedinProfile && !isPrivate) {
      // Use LinkedIn profile data
      displayName = linkedinProfile.name ||
        `${linkedinProfile.first_name || ''} ${linkedinProfile.last_name || ''}`.trim() ||
        ytData.name || handle;
      avatarUrl = linkedinProfile.image || linkedinProfile.profile_pic_url || ytData.avatar || undefined;
      followers = linkedinProfile.followers || linkedinProfile.follower_count || 0;
      description = linkedinProfile.headline || linkedinProfile.about || `From YouTube: @${ytHandle}`;
    } else {
      // Profile is private - use YouTube data
      displayName = ytData.name || handle;
      avatarUrl = ytData.avatar || undefined;
      followers = 0;
      description = `LinkedIn (private) - YouTube: @${ytHandle} (${ytData.subscribers?.toLocaleString() || 0} subscribers)`;
    }

    // Upload avatar to Bunny CDN
    if (avatarUrl) {
      try {
        avatarUrl = await bunnyService.uploadLinkedInAvatar(handle, avatarUrl);
      } catch (e) {}
    }

    await db.streamer.create({
      data: {
        platform: 'LINKEDIN',
        username: handle.toLowerCase(),
        displayName,
        profileUrl: linkedinUrl.startsWith('http') ? linkedinUrl : `https://${linkedinUrl}`,
        avatarUrl: avatarUrl || undefined,
        followers,
        profileDescription: description,
        region: Region.WORLDWIDE,
        lastScrapedAt: new Date(),
        discoveredVia: `youtube:@${ytHandle}`,
        socialLinks: [`https://youtube.com/@${ytHandle}`],
      }
    });

    const status = isPrivate ? '🔒 Private' : '✅ Public';
    console.log(`  ${status} Created: ${handle} (${followers} followers)`);
    return true;
  } catch (error: any) {
    console.error(`  ❌ Error creating ${handle}:`, error.message);
    return false;
  }
}

async function processExistingYouTubeChannels() {
  console.log('\n=== Phase 2: Processing Existing YouTube Channels ===\n');

  // Get YouTube channels that have already been processed for social links
  const ytChannels = await db.streamer.findMany({
    where: {
      platform: 'YOUTUBE',
      NOT: { socialLinks: { equals: [] } }
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      profileUrl: true,
      avatarUrl: true,
      followers: true,
      socialLinks: true
    },
    take: 2000 // Process up to 2000 existing channels
  });

  console.log(`Found ${ytChannels.length} YouTube channels with social links`);

  let processed = 0;
  let linkedinFound = 0;
  let created = 0;

  for (const channel of ytChannels) {
    const links = channel.socialLinks as string[];
    if (!Array.isArray(links)) continue;

    const linkedinUrl = links.find(l => typeof l === 'string' && l.toLowerCase().includes('linkedin.com'));
    if (!linkedinUrl) continue;

    linkedinFound++;
    processed++;

    if (processed % 50 === 0) {
      console.log(`Progress: ${processed} processed, ${created} created`);
    }

    console.log(`[${processed}] @${channel.username}`);

    // Try to get LinkedIn profile
    const { profile, isPrivate } = await fetchLinkedInProfile(linkedinUrl);

    const ytData = {
      name: channel.displayName || channel.username,
      avatar: channel.avatarUrl,
      subscribers: channel.followers || 0
    };

    const success = await createLinkedInEntry(
      linkedinUrl,
      ytData,
      channel.username,
      profile,
      isPrivate
    );

    if (success) created++;

    await new Promise(r => setTimeout(r, 200));
  }

  return { processed, linkedinFound, created };
}

async function main() {
  console.log('===========================================');
  console.log('   LINKEDIN FULL DISCOVERY');
  console.log('   (Including Private Profiles)');
  console.log('===========================================\n');

  const initialCount = await db.streamer.count({ where: { platform: 'LINKEDIN' } });
  console.log(`Initial LinkedIn count: ${initialCount}`);

  // Phase 1: Process known business channels
  console.log(`\n=== Phase 1: Processing ${YOUTUBE_CHANNELS.length} Known Channels ===\n`);

  let processed = 0;
  let linkedinFound = 0;
  let created = 0;
  let notFound = 0;

  for (const handle of YOUTUBE_CHANNELS) {
    processed++;

    if (processed % 25 === 0) {
      const currentCount = await db.streamer.count({ where: { platform: 'LINKEDIN' } });
      console.log(`\n--- Progress: ${processed}/${YOUTUBE_CHANNELS.length}, Total LinkedIn: ${currentCount} ---\n`);
    }

    console.log(`[${processed}/${YOUTUBE_CHANNELS.length}] @${handle}`);

    const ytData = await fetchYouTubeChannel(handle);
    if (!ytData) {
      notFound++;
      console.log(`  ⚠️ Channel not found`);
      await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
      continue;
    }

    // Look for LinkedIn URL
    let linkedinUrl = ytData.linkedin;
    if (!linkedinUrl && ytData.links) {
      linkedinUrl = ytData.links.find((l: string) => l?.toLowerCase().includes('linkedin.com'));
    }

    if (!linkedinUrl) {
      console.log(`  ❌ No LinkedIn URL`);
      await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
      continue;
    }

    linkedinFound++;

    // Try to get LinkedIn profile data
    const { profile, isPrivate } = await fetchLinkedInProfile(linkedinUrl);

    const channelData = {
      name: ytData.name,
      avatar: getHighestResAvatar(ytData.avatar),
      subscribers: ytData.subscriberCount || 0
    };

    const success = await createLinkedInEntry(
      linkedinUrl,
      channelData,
      handle,
      profile,
      isPrivate
    );

    if (success) created++;

    await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
  }

  console.log(`\nPhase 1 complete: ${created} created from ${linkedinFound} found`);

  // Phase 2: Process existing YouTube channels
  const phase2 = await processExistingYouTubeChannels();
  console.log(`\nPhase 2 complete: ${phase2.created} created`);

  const finalCount = await db.streamer.count({ where: { platform: 'LINKEDIN' } });

  console.log('\n===========================================');
  console.log('   FULL DISCOVERY COMPLETE');
  console.log('===========================================');
  console.log(`Channels not found: ${notFound}`);
  console.log(`LinkedIn URLs found: ${linkedinFound + phase2.linkedinFound}`);
  console.log(`New LinkedIn created: ${created + phase2.created}`);
  console.log(`Initial LinkedIn: ${initialCount}`);
  console.log(`Final LinkedIn: ${finalCount}`);
  console.log(`Net new: ${finalCount - initialCount}`);

  await db.$disconnect();
}

main().catch(console.error);
