/**
 * LinkedIn Batch 7 Import - Company Profile Retry
 * Retries company profiles that failed in batch 6 with fixed location mapping
 */

import axios from 'axios';
import { db, logger } from '../src/utils/database';
import { Region } from '@prisma/client';
import { bunnyService } from '../src/services/bunnyService';

const SCRAPECREATORS_API_KEY = process.env.SCRAPECREATORS_API_KEY || 'qJY95WcDxCStfw9idIub8a04Cyr1';

const PROFILES = [
  // Tech Companies that failed in batch6
  { name: 'Nvidia', handle: 'nvidia', category: 'company' },
  { name: 'Intel', handle: 'intel-corporation', category: 'company' },
  { name: 'AMD', handle: 'amd', category: 'company' },
  { name: 'Qualcomm', handle: 'qualcomm', category: 'company' },
  { name: 'Cisco', handle: 'cisco', category: 'company' },
  { name: 'VMware', handle: 'vmware', category: 'company' },
  { name: 'SAP', handle: 'sap', category: 'company' },
  { name: 'Oracle', handle: 'oracle', category: 'company' },
  { name: 'Dell Technologies', handle: 'delltechnologies', category: 'company' },
  { name: 'HP', handle: 'hp', category: 'company' },
  { name: 'Lenovo', handle: 'lenovo', category: 'company' },
  { name: 'LG', handle: 'lg-electronics', category: 'company' },
  { name: 'Discord', handle: 'discord', category: 'company' },
  { name: 'Square', handle: 'square', category: 'company' },
  { name: 'PayPal', handle: 'paypal', category: 'company' },
  { name: 'Visa', handle: 'visa', category: 'company' },
  { name: 'Mastercard', handle: 'mastercard', category: 'company' },
  { name: 'American Express', handle: 'american-express', category: 'company' },
  { name: 'JPMorgan Chase', handle: 'jpmorganchase', category: 'company' },
  { name: 'Goldman Sachs', handle: 'goldman-sachs', category: 'company' },
  { name: 'Morgan Stanley', handle: 'morgan-stanley', category: 'company' },
  { name: 'Blackrock', handle: 'blackrock', category: 'company' },
  { name: 'Fidelity', handle: 'fidelity-investments', category: 'company' },
  { name: 'Etsy', handle: 'etsy', category: 'company' },
  { name: 'eBay', handle: 'ebay', category: 'company' },
  { name: 'Wayfair', handle: 'wayfair', category: 'company' },
  { name: 'Chewy', handle: 'chewy', category: 'company' },
  { name: 'Alibaba', handle: 'alibaba-group', category: 'company' },
  { name: 'Rakuten', handle: 'rakuten', category: 'company' },
  { name: 'MercadoLibre', handle: 'mercadolibre', category: 'company' },
  { name: 'CrowdStrike', handle: 'crowdstrike', category: 'company' },
  { name: 'Palo Alto Networks', handle: 'paboroshy-alto-networks', category: 'company' },
  { name: 'Fortinet', handle: 'fortinet', category: 'company' },
  { name: 'SentinelOne', handle: 'sentinelone', category: 'company' },
  { name: 'Okta', handle: 'okta-inc', category: 'company' },
  { name: 'Zscaler', handle: 'zscaler', category: 'company' },
  { name: 'Cloudflare', handle: 'cloudflare', category: 'company' },
  { name: 'Splunk', handle: 'splunk', category: 'company' },
  { name: 'Datadog', handle: 'datadog', category: 'company' },
  { name: 'Elastic', handle: 'elastic-co', category: 'company' },
  { name: 'ServiceNow', handle: 'servicenow', category: 'company' },
  { name: 'Workday', handle: 'workday', category: 'company' },
  { name: 'Snowflake', handle: 'snowflake-computing', category: 'company' },
  { name: 'Databricks', handle: 'databricks', category: 'company' },
  { name: 'MongoDB', handle: 'mongodb', category: 'company' },
  { name: 'Confluent', handle: 'confluent', category: 'company' },
  { name: 'HashiCorp', handle: 'hashicorp', category: 'company' },
  { name: 'GitLab', handle: 'gitlab-com', category: 'company' },
  { name: 'Atlassian', handle: 'atlassian', category: 'company' },
  { name: 'Twilio', handle: 'twilio', category: 'company' },
  { name: 'Unity Technologies', handle: 'unity-technologies', category: 'company' },
  { name: 'Epic Games', handle: 'epicgames', category: 'company' },
  { name: 'Roblox', handle: 'roblox', category: 'company' },
  { name: 'EA', handle: 'electronic-arts', category: 'company' },
  { name: 'Activision', handle: 'activision', category: 'company' },
  { name: 'Take-Two', handle: 'take-two-interactive', category: 'company' },
  { name: 'Nintendo', handle: 'nintendo', category: 'company' },
  { name: 'Ubisoft', handle: 'ubisoft', category: 'company' },

  // Additional Startup Companies
  { name: 'Figma', handle: 'figma', category: 'company' },
  { name: 'Notion', handle: 'notionhq', category: 'company' },
  { name: 'Canva', handle: 'canva', category: 'company' },
  { name: 'Miro', handle: 'maboroshy-realtime-board', category: 'company' },
  { name: 'Asana', handle: 'asana', category: 'company' },
  { name: 'Monday.com', handle: 'mondaydotcom', category: 'company' },
  { name: 'ClickUp', handle: 'clickup', category: 'company' },
  { name: 'Linear', handle: 'linear', category: 'company' },
  { name: 'Loom', handle: 'laboroshy', category: 'company' },
  { name: 'Zoom', handle: 'zoom-video-communications', category: 'company' },

  // AI Companies
  { name: 'OpenAI', handle: 'openai', category: 'company' },
  { name: 'Anthropic', handle: 'anthropic-ai', category: 'company' },
  { name: 'DeepMind', handle: 'deepmind', category: 'company' },
  { name: 'Hugging Face', handle: 'huggingface', category: 'company' },
  { name: 'Stability AI', handle: 'stability-ai', category: 'company' },
  { name: 'Midjourney', handle: 'midjourney', category: 'company' },
  { name: 'Cohere', handle: 'cohere-ai', category: 'company' },
  { name: 'Scale AI', handle: 'scale-ai', category: 'company' },
  { name: 'Runway', handle: 'runwayml', category: 'company' },
  { name: 'Character AI', handle: 'character-ai', category: 'company' },
];

interface LinkedInProfile {
  id?: string;
  public_identifier: string;
  first_name?: string;
  last_name?: string;
  headline?: string;
  image?: string;
  followers?: number;
  follower_count?: number;
  location?: unknown;
  city?: unknown;
  country?: unknown;
  country_code?: unknown;
  geo_location?: unknown;
  name?: string;
  logo?: string;
  description?: string;
  tagline?: string;
  // Company fields
  employee_count?: number;
  specialties?: string[];
  industry?: string;
}

async function fetchLinkedInProfile(handle: string, isCompany: boolean = false): Promise<{ profile: LinkedInProfile | null; isPrivate: boolean }> {
  const endpoint = isCompany
    ? `https://api.scrapecreators.com/v2/linkedin/company?company_url=https://linkedin.com/company/${handle}`
    : `https://api.scrapecreators.com/v1/linkedin/profile?linkedin_url=https://linkedin.com/in/${handle}`;

  try {
    const response = await axios.get(endpoint, {
      headers: { 'x-api-key': SCRAPECREATORS_API_KEY }
    });

    if (response.data?.success === true && response.data?.message?.includes('private')) {
      return { profile: null, isPrivate: true };
    }

    const profile = isCompany ? response.data?.company : response.data?.person;
    if (!profile) {
      return { profile: null, isPrivate: response.data?.success === false };
    }

    return { profile, isPrivate: false };
  } catch (error: any) {
    if (error.response?.status === 404 || error.response?.data?.message?.includes('not found')) {
      return { profile: null, isPrivate: false };
    }
    throw error;
  }
}

async function uploadAvatar(avatarUrl: string, handle: string): Promise<string | undefined> {
  if (!avatarUrl || !avatarUrl.startsWith('http')) return undefined;

  try {
    const bunnyUrl = await bunnyService.uploadFromUrl(avatarUrl, `avatars/linkedin/${handle}.jpg`);
    return bunnyUrl || undefined;
  } catch (error) {
    return undefined;
  }
}

// Fixed toString helper to handle objects
function toString(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function mapLocationToRegion(location?: unknown, country?: unknown, countryCode?: unknown): Region {
  const code = toString(countryCode).toUpperCase();
  const countryStr = toString(country || location).toLowerCase();

  const codeMap: Record<string, Region> = {
    'US': Region.USA, 'CA': Region.CANADA, 'GB': Region.UK,
    'DE': Region.GERMANY, 'FR': Region.FRANCE, 'JP': Region.JAPAN,
    'KR': Region.KOREA, 'CN': Region.CHINA, 'IN': Region.INDIA,
    'SG': Region.SINGAPORE, 'AU': Region.AUSTRALIA, 'BR': Region.BRAZIL,
  };

  if (code && codeMap[code]) return codeMap[code];

  const nameMap: Array<[string[], Region]> = [
    [['united states', 'usa', 'california', 'new york', 'san francisco'], Region.USA],
    [['united kingdom', 'london'], Region.UK],
    [['germany', 'berlin'], Region.GERMANY],
    [['japan', 'tokyo'], Region.JAPAN],
    [['china', 'beijing', 'shanghai'], Region.CHINA],
    [['india', 'bangalore'], Region.INDIA],
    [['singapore'], Region.SINGAPORE],
    [['australia', 'sydney'], Region.AUSTRALIA],
  ];

  for (const [keywords, region] of nameMap) {
    if (keywords.some(kw => countryStr.includes(kw))) return region;
  }

  return Region.WORLDWIDE;
}

async function importProfile(item: { name: string; handle: string; category: string }): Promise<boolean> {
  const isCompany = item.category === 'company';
  const handle = item.handle.toLowerCase();

  try {
    const existing = await db.streamer.findUnique({
      where: { platform_username: { platform: 'LINKEDIN', username: handle } }
    });
    if (existing) return false;

    const { profile, isPrivate } = await fetchLinkedInProfile(item.handle, isCompany);

    let displayName: string;
    let avatarUrl: string | undefined;
    let followers: number;
    let description: string;
    let region: Region = Region.WORLDWIDE;

    if (profile) {
      if (isCompany) {
        displayName = profile.name || item.name;
        avatarUrl = profile.logo || profile.image;
        followers = profile.follower_count || profile.followers || 0;
        description = profile.tagline || profile.description || '';
        region = mapLocationToRegion(profile.location, profile.country, profile.country_code);
      } else {
        displayName = profile.name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || item.name;
        avatarUrl = profile.image;
        followers = profile.followers || profile.follower_count || 0;
        description = profile.headline || '';
        region = mapLocationToRegion(profile.location || profile.geo_location, profile.country, profile.country_code);
      }
    } else {
      displayName = item.name;
      followers = 0;
      description = isPrivate ? '' : 'Profile not found';
    }

    const uploadedAvatar = avatarUrl ? await uploadAvatar(avatarUrl, handle) : undefined;

    const profileUrl = isCompany
      ? `https://linkedin.com/company/${handle}`
      : `https://linkedin.com/in/${handle}`;

    await db.streamer.create({
      data: {
        platform: 'LINKEDIN',
        username: handle,
        displayName,
        profileUrl,
        avatarUrl: uploadedAvatar || avatarUrl,
        followers,
        profileDescription: description,
        region,
        lastScrapedAt: new Date(),
        discoveredVia: `import:${item.category}`,
      }
    });

    const regionStr = region !== Region.WORLDWIDE ? ` [${region}]` : '';
    if (isPrivate || !profile) {
      console.log(`  \u{1F512} ${displayName} (@${handle}) - 0 followers`);
    } else {
      console.log(`  \u{2705} ${displayName} (@${handle}) - ${followers.toLocaleString()} followers${regionStr}`);
    }

    return true;
  } catch (error: any) {
    if (error.code === 'P2002') {
      return false;
    }
    console.log(`  \u{274C} Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('===========================================');
  console.log('   LINKEDIN BATCH 7 IMPORT - COMPANY RETRY');
  console.log('===========================================\n');

  await db.$connect();

  const initialCount = await db.streamer.count({ where: { platform: 'LINKEDIN' } });
  console.log(`Initial LinkedIn count: ${initialCount}`);
  console.log(`Profiles to import: ${PROFILES.length}\n`);

  let imported = 0;
  let i = 0;

  for (const profile of PROFILES) {
    i++;
    console.log(`[${i}/${PROFILES.length}] ${profile.name}`);

    const success = await importProfile(profile);
    if (success) imported++;

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1200));

    if (i % 30 === 0) {
      const count = await db.streamer.count({ where: { platform: 'LINKEDIN' } });
      console.log(`\n--- Progress: ${i}/${PROFILES.length}, LinkedIn total: ${count} ---\n`);
    }
  }

  const finalCount = await db.streamer.count({ where: { platform: 'LINKEDIN' } });
  console.log('\n===========================================');
  console.log(`   BATCH 7 COMPLETE`);
  console.log(`   Imported: ${imported}`);
  console.log(`   Final LinkedIn count: ${finalCount}`);
  console.log('===========================================');

  await db.$disconnect();
}

main().catch(console.error);
