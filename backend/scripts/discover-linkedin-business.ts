/**
 * LinkedIn Discovery from Business/Tech YouTube Channels
 *
 * Strategy:
 * 1. Use YouTube search API with business/tech keywords
 * 2. Process channels that are more likely to have LinkedIn
 * 3. Also use LinkedIn Ads API for direct discovery
 * 4. Import known tech/business YouTube channels
 */

import axios from 'axios';
import { db, logger } from '../src/utils/database';
import { Platform, Region } from '@prisma/client';
import { bunnyService } from '../src/services/bunnyService';

const SCRAPECREATORS_API_KEY = process.env.SCRAPECREATORS_API_KEY || 'qJY95WcDxCStfw9idIub8a04Cyr1';
const RATE_LIMIT_MS = 300;

// Known business/tech YouTube channels that likely have LinkedIn
const KNOWN_BUSINESS_CHANNELS = [
  // Tech
  'hubaborjas', 'fireship', 'TechLead', 'ThePrimeagen', 'TraversyMedia', 'WebDevSimplified',
  'KevinPowell', 'benawad', 'CleverProgrammer', 'JomaTech', 'TheNetNinja', 'ProgramWithErik',
  'JavaBrains', 'TechWithTim', 'CodingWithMitch', 'codewithchris', 'JakeBartlett',
  // Business/Finance
  'GaryVee', 'TonyRobbins', 'GrahamStephan', 'MeetKevin', 'PatrickBetDavid', 'TheMoneyGuyShow',
  'RamitSethi', 'RobertKiyosaki', 'DaveRamsey', 'AndreJikh', 'WhiteboardFinance',
  'BrianJungOfficial', 'TheFuturr', 'AliAbdaal', 'MattDAvella', 'PolyMatter',
  // Entrepreneurship
  'MyFirstMillion', 'YCombinator', 'Startup', 'HowIBuiltThis', 'SaaStr', 'a16z',
  'ThePitchShow', 'IndieHackers', 'MicroConf', 'FirstRoundCapital', 'Sequoia',
  // Marketing
  'NeilPatel', 'RussellBrunson', 'SethGodin', 'SimonSinek', 'AmyPorterfield', 'PatFlynn',
  'GaryVaynerchuk', 'VanityFair', 'WIRED', 'Bloomberg', 'CNBC', 'BusinessInsider',
  // Spanish business
  'FrancoisPouzet', 'JuanCamiloPrada', 'JulioBarbierOfficial', 'ElGranWyoming', 'InfoMoneyBR',
  'PrimoRico', 'OPrimoRico', 'MePoupe', 'NathaliaArcuri', 'ThiagoNigro', 'GustavoGerbasi',
  // Portuguese business
  'JoelJota', 'FabricioNogueira', 'RodrigoBaltar', 'CristianGomes', 'RenatoSpinosa',
  // Science/Education (often have LinkedIn)
  'Veritasium', 'VSauce', 'KurzGesagt', 'TED', 'TEDx', 'BigThink', 'HubermanLab',
  'LexFridman', 'JordanPeterson', 'SamHarris', 'TimFerriss', 'JoeRogan', 'DrAndrewHuberman',
];

// Business keywords to search for channels
const BUSINESS_KEYWORDS = [
  'business tips', 'entrepreneurship', 'startup founder', 'tech startup',
  'marketing strategy', 'CEO interview', 'venture capital', 'finance tips',
  'investment', 'passive income', 'digital marketing', 'e-commerce business',
  'SaaS', 'software development', 'career advice', 'professional development',
  'leadership', 'management consulting', 'MBA', 'business school',
  // Spanish
  'emprendimiento', 'negocios', 'finanzas personales', 'inversiones',
  'marketing digital', 'startup español', 'empresario', 'liderazgo',
  // Portuguese
  'empreendedorismo', 'negócios', 'finanças', 'investimentos', 'carreira',
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

async function createLinkedInEntry(
  linkedinUrl: string,
  ytName: string,
  ytUsername: string,
  avatarUrl?: string
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
      console.log(`  ⏭️ LinkedIn already exists: ${handle}`);
      return false;
    }

    let cdnAvatarUrl = avatarUrl;
    if (avatarUrl) {
      try {
        cdnAvatarUrl = await bunnyService.uploadLinkedInAvatar(handle, avatarUrl);
      } catch (e) {}
    }

    await db.streamer.create({
      data: {
        platform: 'LINKEDIN',
        username: handle.toLowerCase(),
        displayName: ytName || handle,
        profileUrl: linkedinUrl.startsWith('http') ? linkedinUrl : `https://${linkedinUrl}`,
        avatarUrl: cdnAvatarUrl || undefined,
        followers: 0,
        profileDescription: `From YouTube: @${ytUsername}`,
        region: Region.WORLDWIDE,
        lastScrapedAt: new Date(),
        discoveredVia: `youtube:@${ytUsername}`,
        socialLinks: [`https://youtube.com/@${ytUsername}`],
      }
    });

    console.log(`  ✅ Created LinkedIn: ${handle}`);
    return true;
  } catch (error: any) {
    console.error(`  ❌ Error creating ${handle}:`, error.message);
    return false;
  }
}

async function processKnownChannels() {
  console.log('\n=== PHASE 1: Processing Known Business/Tech Channels ===\n');

  let processed = 0;
  let linkedinCreated = 0;

  for (const handle of KNOWN_BUSINESS_CHANNELS) {
    processed++;
    console.log(`[${processed}/${KNOWN_BUSINESS_CHANNELS.length}] Processing @${handle}`);

    const data = await fetchYouTubeChannel(handle);
    if (!data) {
      console.log(`  ⚠️ Channel not found`);
      await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
      continue;
    }

    // Look for LinkedIn
    let linkedinUrl = data.linkedin;
    if (!linkedinUrl && data.links) {
      linkedinUrl = data.links.find((l: string) => l?.toLowerCase().includes('linkedin.com'));
    }

    if (linkedinUrl) {
      const avatarUrl = getHighestResAvatar(data.avatar);
      const created = await createLinkedInEntry(linkedinUrl, data.name, handle, avatarUrl || undefined);
      if (created) linkedinCreated++;
    } else {
      console.log(`  ❌ No LinkedIn found`);
    }

    await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
  }

  return { processed, linkedinCreated };
}

async function searchLinkedInAds(keywords: string[]) {
  console.log('\n=== PHASE 2: LinkedIn Ads Discovery ===\n');

  let linkedinCreated = 0;
  const seenCompanies = new Set<string>();

  for (const keyword of keywords) {
    console.log(`Searching LinkedIn Ads for: "${keyword}"`);

    try {
      const response = await axios.get('https://api.scrapecreators.com/v1/linkedin/ads/search', {
        headers: { 'x-api-key': SCRAPECREATORS_API_KEY },
        params: { keyword },
        timeout: 30000
      });

      const ads = response.data?.ads || response.data?.results || [];
      console.log(`  Found ${ads.length} ads`);

      for (const ad of ads) {
        const companyId = ad.company_id || ad.companyId || ad.advertiser_id;
        const companyName = ad.company_name || ad.companyName || ad.advertiser_name;

        if (!companyId || seenCompanies.has(companyId)) continue;
        seenCompanies.add(companyId);

        // Create company LinkedIn entry
        const handle = `company:${companyId}`;
        const existing = await db.streamer.findUnique({
          where: {
            platform_username: { platform: 'LINKEDIN', username: handle.toLowerCase() }
          }
        });

        if (!existing) {
          try {
            await db.streamer.create({
              data: {
                platform: 'LINKEDIN',
                username: handle.toLowerCase(),
                displayName: companyName || companyId,
                profileUrl: `https://linkedin.com/company/${companyId}`,
                followers: 0,
                profileDescription: `LinkedIn Advertiser (${keyword})`,
                region: Region.WORLDWIDE,
                lastScrapedAt: new Date(),
                discoveredVia: `linkedin:ads:${keyword}`,
              }
            });
            linkedinCreated++;
            console.log(`  ✅ Created company: ${companyName || companyId}`);
          } catch (e) {}
        }
      }

      await new Promise(r => setTimeout(r, 500));
    } catch (error: any) {
      console.error(`  Error searching "${keyword}":`, error.response?.data?.message || error.message);
    }
  }

  return linkedinCreated;
}

async function discoverFromYouTubeSearch() {
  console.log('\n=== PHASE 3: YouTube Search for Business Channels ===\n');

  // YouTube search via ScrapeCreators API
  let linkedinCreated = 0;

  for (const keyword of BUSINESS_KEYWORDS.slice(0, 20)) { // Limit to save credits
    console.log(`Searching YouTube for: "${keyword}"`);

    try {
      const response = await axios.get('https://api.scrapecreators.com/v1/youtube/search', {
        headers: { 'x-api-key': SCRAPECREATORS_API_KEY },
        params: { query: keyword, type: 'channel' },
        timeout: 30000
      });

      const channels = response.data?.channels || response.data?.results || [];
      console.log(`  Found ${channels.length} channels`);

      for (const ch of channels.slice(0, 5)) { // Process top 5 per keyword
        const handle = ch.handle || ch.username || ch.channelHandle;
        if (!handle) continue;

        console.log(`  Fetching @${handle}`);
        const data = await fetchYouTubeChannel(handle);

        if (data) {
          let linkedinUrl = data.linkedin;
          if (!linkedinUrl && data.links) {
            linkedinUrl = data.links.find((l: string) => l?.toLowerCase().includes('linkedin.com'));
          }

          if (linkedinUrl) {
            const avatarUrl = getHighestResAvatar(data.avatar);
            const created = await createLinkedInEntry(linkedinUrl, data.name, handle, avatarUrl || undefined);
            if (created) linkedinCreated++;
          }
        }

        await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
      }
    } catch (error: any) {
      console.log(`  Search not available for this keyword`);
    }

    await new Promise(r => setTimeout(r, 300));
  }

  return linkedinCreated;
}

async function main() {
  console.log('===========================================');
  console.log('   LINKEDIN BUSINESS DISCOVERY');
  console.log('===========================================\n');

  const initialCount = await db.streamer.count({ where: { platform: 'LINKEDIN' } });
  console.log(`Initial LinkedIn count: ${initialCount}`);

  // Phase 1: Known channels
  const phase1 = await processKnownChannels();
  console.log(`\nPhase 1 complete: ${phase1.linkedinCreated} LinkedIn created`);

  // Phase 2: LinkedIn Ads
  const adsKeywords = ['startup', 'technology', 'saas', 'marketing', 'consulting', 'venture capital'];
  const phase2 = await searchLinkedInAds(adsKeywords);
  console.log(`\nPhase 2 complete: ${phase2} LinkedIn created`);

  // Phase 3: YouTube search (if available)
  const phase3 = await discoverFromYouTubeSearch();
  console.log(`\nPhase 3 complete: ${phase3} LinkedIn created`);

  const finalCount = await db.streamer.count({ where: { platform: 'LINKEDIN' } });

  console.log('\n===========================================');
  console.log('   DISCOVERY COMPLETE');
  console.log('===========================================');
  console.log(`Initial LinkedIn: ${initialCount}`);
  console.log(`Final LinkedIn: ${finalCount}`);
  console.log(`New LinkedIn entries: ${finalCount - initialCount}`);

  await db.$disconnect();
}

main().catch(console.error);
