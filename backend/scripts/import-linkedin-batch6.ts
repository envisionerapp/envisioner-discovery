/**
 * LinkedIn Batch 6 Import - Final Push to 1k
 *
 * More profiles including:
 * - More company pages
 * - International entrepreneurs
 * - Tech journalists/analysts
 * - Startup founders
 */

import axios from 'axios';
import { db, logger } from '../src/utils/database';
import { Region } from '@prisma/client';
import { bunnyService } from '../src/services/bunnyService';

const SCRAPECREATORS_API_KEY = process.env.SCRAPECREATORS_API_KEY || 'qJY95WcDxCStfw9idIub8a04Cyr1';

const PROFILES = [
  // More Tech Companies
  { name: 'Nvidia', handle: 'nvidia', category: 'company' },
  { name: 'Intel', handle: 'intel-corporation', category: 'company' },
  { name: 'AMD', handle: 'amd', category: 'company' },
  { name: 'Qualcomm', handle: 'qualcomm', category: 'company' },
  { name: 'Cisco', handle: 'cisco', category: 'company' },
  { name: 'VMware', handle: 'vmware', category: 'company' },
  { name: 'SAP', handle: 'sap', category: 'company' },
  { name: 'Oracle', handle: 'oracle', category: 'company' },
  { name: 'IBM', handle: 'ibm', category: 'company' },
  { name: 'Dell Technologies', handle: 'delltechnologies', category: 'company' },
  { name: 'HP', handle: 'hp', category: 'company' },
  { name: 'Lenovo', handle: 'lenovo', category: 'company' },
  { name: 'Sony', handle: 'sony', category: 'company' },
  { name: 'Samsung', handle: 'samsung', category: 'company' },
  { name: 'LG', handle: 'lg-electronics', category: 'company' },
  { name: 'Twitter', handle: 'twitter', category: 'company' },
  { name: 'Reddit', handle: 'reddit-inc', category: 'company' },
  { name: 'Discord', handle: 'discord', category: 'company' },
  { name: 'Spotify', handle: 'spotify', category: 'company' },
  { name: 'Pinterest', handle: 'pinterest', category: 'company' },

  // Fintech Companies
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

  // E-commerce
  { name: 'Etsy', handle: 'etsy', category: 'company' },
  { name: 'eBay', handle: 'ebay', category: 'company' },
  { name: 'Wayfair', handle: 'wayfair', category: 'company' },
  { name: 'Chewy', handle: 'chewy', category: 'company' },
  { name: 'Wish', handle: 'wish', category: 'company' },
  { name: 'Alibaba', handle: 'alibaba-group', category: 'company' },
  { name: 'JD.com', handle: 'jd-com', category: 'company' },
  { name: 'Rakuten', handle: 'rakuten', category: 'company' },
  { name: 'MercadoLibre', handle: 'mercadolibre', category: 'company' },
  { name: 'Coupang', handle: 'coupang', category: 'company' },

  // More Founders
  { name: 'Naval', handle: 'naval-ravikant', category: 'founder' },
  { name: 'Tony Hsieh', handle: 'tonyhsieh', category: 'founder' },
  { name: 'Alfred Chuang', handle: 'alfredchuang', category: 'founder' },
  { name: 'Peter Levine', handle: 'peterlevine', category: 'founder' },
  { name: 'Ben Silbermann', handle: 'silbermann', category: 'founder' },
  { name: 'Kevin Weil', handle: 'kevinweil', category: 'founder' },
  { name: 'Alex Karp', handle: 'alexkarp', category: 'founder' },
  { name: 'Dara Khosrowshahi', handle: 'dara-khosrowshahi', category: 'founder' },
  { name: 'Logan Green Lyft', handle: 'logan-green', category: 'founder' },
  { name: 'John Zimmer Lyft', handle: 'john-zimmer', category: 'founder' },
  { name: 'Anthony Tan Grab', handle: 'anthonytan', category: 'founder' },
  { name: 'Ren Zhengfei', handle: 'renzhengfei', category: 'founder' },
  { name: 'Ma Huateng', handle: 'mahuateng', category: 'founder' },
  { name: 'Jack Dorsey Block', handle: 'jack', category: 'founder' },
  { name: 'Brian Chesky Airbnb', handle: 'brianchesky2', category: 'founder' },

  // Tech Analysts/Journalists
  { name: 'Benedict Evans', handle: 'benedictevans', category: 'analyst' },
  { name: 'Mary Meeker Bond', handle: 'marymeekerbond', category: 'analyst' },
  { name: 'Gene Munster', handle: 'genemunster', category: 'analyst' },
  { name: 'Dan Ives', handle: 'danives', category: 'analyst' },
  { name: 'Beth Kindig', handle: 'bethkindig', category: 'analyst' },
  { name: 'Horace Dediu', handle: 'horacedediu', category: 'analyst' },
  { name: 'Ben Bajarin', handle: 'benbajarin', category: 'analyst' },
  { name: 'Carolina Milanesi', handle: 'carolinamilanesi', category: 'analyst' },
  { name: 'Jan Dawson', handle: 'jandawson', category: 'analyst' },
  { name: 'Avi Greengart', handle: 'avigreengart', category: 'analyst' },
  { name: 'Patrick Moorhead', handle: 'patrickmoorhead', category: 'analyst' },
  { name: 'Ryan Reith', handle: 'ryanreith', category: 'analyst' },
  { name: 'Bob ODonnell', handle: 'bobodonnell', category: 'analyst' },
  { name: 'Mark Gurman', handle: 'markgurman', category: 'analyst' },
  { name: 'Ming-Chi Kuo', handle: 'mingchikuo', category: 'analyst' },

  // Cybersecurity Companies
  { name: 'CrowdStrike', handle: 'crowdstrike', category: 'company' },
  { name: 'Palo Alto Networks', handle: 'paboroshy', category: 'company' },
  { name: 'Fortinet', handle: 'fortinet', category: 'company' },
  { name: 'Okta', handle: 'okta', category: 'company' },
  { name: 'Zscaler', handle: 'zscaler', category: 'company' },
  { name: 'SentinelOne', handle: 'sentinelone', category: 'company' },
  { name: 'Splunk', handle: 'splunk', category: 'company' },
  { name: 'Rapid7', handle: 'rapid7', category: 'company' },
  { name: 'Tenable', handle: 'tenableinc', category: 'company' },
  { name: 'Proofpoint', handle: 'proofpoint', category: 'company' },

  // HR Tech Companies
  { name: 'Workday HR', handle: 'workdayinc', category: 'company' },
  { name: 'ADP', handle: 'adp', category: 'company' },
  { name: 'Paycom', handle: 'paycom', category: 'company' },
  { name: 'Paylocity', handle: 'paylocity', category: 'company' },
  { name: 'Ceridian', handle: 'ceridian', category: 'company' },
  { name: 'UKG', handle: 'ukg', category: 'company' },
  { name: 'BambooHR', handle: 'bamboohr', category: 'company' },
  { name: 'Lattice', handle: 'latticehq', category: 'company' },
  { name: '15Five', handle: '15five', category: 'company' },
  { name: 'Culture Amp', handle: 'cultureamp', category: 'company' },

  // More Tech YouTubers/Creators
  { name: 'Dave2D', handle: 'davidlee', category: 'creator' },
  { name: 'TLD Today', handle: 'tldtoday', category: 'creator' },
  { name: 'JerryRigEverything', handle: 'zaboroshy', category: 'creator' },
  { name: 'Flossy Carter', handle: 'flossycarter', category: 'creator' },
  { name: 'SuperSaf', handle: 'supersaf', category: 'creator' },
  { name: 'Mr. Mobile', handle: 'mrmobile', category: 'creator' },
  { name: 'EverythingApplePro', handle: 'everythingapplepro', category: 'creator' },
  { name: 'Brandon Butch', handle: 'brandonbutch', category: 'creator' },
  { name: 'SnazzyLabs', handle: 'snazzylabs', category: 'creator' },
  { name: 'Max Tech', handle: 'maxtech', category: 'creator' },
  { name: 'Created Tech', handle: 'createdtech', category: 'creator' },
  { name: 'Karl Conrad', handle: 'karlconrad', category: 'creator' },
  { name: 'Andrew Edwards', handle: 'andrewedwardsmedia', category: 'creator' },
  { name: 'Joshua Fluke', handle: 'joshuafluke', category: 'creator' },
  { name: 'TechLead', handle: 'techlead', category: 'creator' },

  // More SaaS Companies
  { name: 'Atlassian Jira', handle: 'atlassianjira', category: 'company' },
  { name: 'Zendesk Support', handle: 'zendesksupport', category: 'company' },
  { name: 'Freshworks', handle: 'freshworks', category: 'company' },
  { name: 'Zoho', handle: 'zoho', category: 'company' },
  { name: 'DocuSign', handle: 'docusign', category: 'company' },
  { name: 'Box', handle: 'box', category: 'company' },
  { name: 'Dropbox Business', handle: 'dropboxbusiness', category: 'company' },
  { name: 'Smartsheet', handle: 'smartsheet', category: 'company' },
  { name: 'ServiceNow IT', handle: 'servicenowit', category: 'company' },
  { name: 'Splunk Enterprise', handle: 'splunkenterprise', category: 'company' },

  // More European Tech Founders
  { name: 'Pieter Levels', handle: 'levelsio', category: 'founder-eu' },
  { name: 'Joel Spolsky', handle: 'joelspolsky', category: 'founder' },
  { name: 'Jeff Atwood', handle: 'codinghorror', category: 'founder' },
  { name: 'Matt Mullenweg', handle: 'photomatt', category: 'founder' },
  { name: 'Brian Chesky AB', handle: 'briancheskyairbnb', category: 'founder' },
  { name: 'Joe Gebbia AB', handle: 'joegebbia', category: 'founder' },
  { name: 'Nathan Blecharczyk', handle: 'nathanblecharczyk', category: 'founder' },
  { name: 'Frédéric Mazzella', handle: 'fredericmazzella', category: 'founder-eu' },
  { name: 'Taavet Hinrikus Wise', handle: 'taavethinrikus', category: 'founder-eu' },
  { name: 'Kristo Käärmann Wise', handle: 'kristokaarmann', category: 'founder-eu' },
  { name: 'Oliver Samwer', handle: 'oliversamwer', category: 'founder-eu' },
  { name: 'Marc Samwer', handle: 'marcsamwer', category: 'founder-eu' },
  { name: 'Alexander Samwer', handle: 'alexandersamwer', category: 'founder-eu' },
  { name: 'Fabrice Grinda', handle: 'fabricegrinda', category: 'founder' },
  { name: 'Jose Neves', handle: 'joseneves', category: 'founder-eu' },

  // Cloud Infrastructure
  { name: 'Red Hat', handle: 'redhatinc', category: 'company' },
  { name: 'Canonical', handle: 'canonical', category: 'company' },
  { name: 'Elastic Search', handle: 'elasticsearchinc', category: 'company' },
  { name: 'Confluent Kafka', handle: 'confluentkafka', category: 'company' },
  { name: 'Cockroach Labs', handle: 'cockroachlabs', category: 'company' },
  { name: 'TigerGraph', handle: 'tigergraph', category: 'company' },
  { name: 'Neo4j', handle: 'neo4j', category: 'company' },
  { name: 'SingleStore', handle: 'singlestore', category: 'company' },
  { name: 'Timescale', handle: 'timescale', category: 'company' },
  { name: 'InfluxData', handle: 'influxdata', category: 'company' },

  // Mobile App Companies
  { name: 'Snap Inc', handle: 'snapinc', category: 'company' },
  { name: 'TikTok', handle: 'tiktok', category: 'company' },
  { name: 'Instagram', handle: 'instagram', category: 'company' },
  { name: 'WhatsApp', handle: 'whatsapp', category: 'company' },
  { name: 'Telegram', handle: 'telegram', category: 'company' },
  { name: 'Signal', handle: 'signal-messenger', category: 'company' },
  { name: 'WeChat', handle: 'wechat', category: 'company' },
  { name: 'LINE', handle: 'line-corporation', category: 'company' },
  { name: 'Viber', handle: 'viber', category: 'company' },
  { name: 'Kakao', handle: 'kakaocorp', category: 'company' },

  // Gaming Companies
  { name: 'Epic Games', handle: 'epicgames', category: 'company' },
  { name: 'Unity Technologies', handle: 'unitytechnologies', category: 'company' },
  { name: 'Roblox', handle: 'roblox', category: 'company' },
  { name: 'EA Sports', handle: 'easports', category: 'company' },
  { name: 'Activision', handle: 'activision', category: 'company' },
  { name: 'Blizzard', handle: 'blizzard-entertainment', category: 'company' },
  { name: 'Riot Games', handle: 'riotgames', category: 'company' },
  { name: 'Ubisoft', handle: 'ubisoft', category: 'company' },
  { name: 'Take-Two', handle: 'take-two-interactive', category: 'company' },
  { name: 'Supercell', handle: 'supercell', category: 'company' },
];

async function fetchLinkedInProfile(handle: string, isCompany: boolean = false): Promise<{ profile: any; isPrivate: boolean }> {
  try {
    const endpoint = isCompany
      ? 'https://api.scrapecreators.com/v1/linkedin/company'
      : 'https://api.scrapecreators.com/v1/linkedin/profile';
    const url = isCompany
      ? `https://linkedin.com/company/${handle}`
      : `https://linkedin.com/in/${handle}`;

    const response = await axios.get(endpoint, {
      headers: { 'x-api-key': SCRAPECREATORS_API_KEY },
      params: { url },
      timeout: 30000
    });

    if (response.data?.message?.includes('private') ||
        response.data?.message?.includes('not publicly available') ||
        response.data?.success === false) {
      return { profile: null, isPrivate: true };
    }

    const data = response.data?.data || response.data;
    if (!data || Object.keys(data).length === 0) {
      return { profile: null, isPrivate: true };
    }

    return { profile: data, isPrivate: false };
  } catch {
    return { profile: null, isPrivate: true };
  }
}

const COMPANY_CATEGORIES = ['company'];

function mapLocationToRegion(location?: unknown, country?: unknown, countryCode?: unknown): Region {
  const toString = (val: unknown): string => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };
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
  const isCompany = COMPANY_CATEGORIES.includes(item.category);
  const handle = item.handle.toLowerCase();

  try {
    const existing = await db.streamer.findUnique({
      where: { platform_username: { platform: 'LINKEDIN', username: handle } }
    });
    if (existing) return false;

    const { profile, isPrivate } = await fetchLinkedInProfile(item.handle, isCompany);

    let displayName: string;
    let avatarUrl: string | undefined;
    let followers = 0;
    let description: string;
    let region: Region = Region.WORLDWIDE;

    if (profile && !isPrivate) {
      displayName = profile.name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || item.name;
      avatarUrl = profile.image || undefined;
      followers = profile.followers || profile.follower_count || 0;
      const locationStr = profile.city && profile.country ? `${profile.city}, ${profile.country}` :
                         profile.location || profile.geo_location || '';
      const headline = profile.headline || profile.about || `${item.category}`;
      description = locationStr ? `${headline} | ${locationStr}` : headline;
      region = mapLocationToRegion(profile.location, profile.country, profile.country_code);
    } else {
      displayName = item.name;
      description = `LinkedIn (${isPrivate ? 'private' : 'import'}) - ${item.category}`;
    }

    if (avatarUrl) {
      try { avatarUrl = await bunnyService.uploadLinkedInAvatar(handle, avatarUrl); } catch {}
    }

    const profileUrl = isCompany ? `https://linkedin.com/company/${handle}` : `https://linkedin.com/in/${handle}`;

    await db.streamer.create({
      data: {
        platform: 'LINKEDIN',
        username: handle,
        displayName,
        profileUrl,
        avatarUrl,
        followers,
        profileDescription: description,
        region,
        lastScrapedAt: new Date(),
        discoveredVia: `import:${item.category}`,
      }
    });

    const status = isPrivate ? '🔒' : '✅';
    const regionStr = region !== Region.WORLDWIDE ? ` [${region}]` : '';
    console.log(`  ${status} ${displayName} (@${handle}) - ${followers} followers${regionStr}`);
    return true;
  } catch (error: any) {
    console.log(`  ❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('===========================================');
  console.log('   LINKEDIN BATCH 6 IMPORT - FINAL PUSH');
  console.log('===========================================\n');

  const initialCount = await db.streamer.count({ where: { platform: 'LINKEDIN' } });
  console.log(`Initial LinkedIn count: ${initialCount}`);
  console.log(`Profiles to import: ${PROFILES.length}\n`);

  let created = 0;

  for (let i = 0; i < PROFILES.length; i++) {
    console.log(`[${i + 1}/${PROFILES.length}] ${PROFILES[i].name}`);
    if (await importProfile(PROFILES[i])) created++;
    await new Promise(r => setTimeout(r, 200));

    if ((i + 1) % 50 === 0) {
      const count = await db.streamer.count({ where: { platform: 'LINKEDIN' } });
      console.log(`\n--- Progress: ${i + 1}/${PROFILES.length}, Total: ${count} ---\n`);
      if (count >= 1000) {
        console.log('\n🎉 REACHED 1000 LINKEDIN PROFILES TARGET!');
        break;
      }
    }
  }

  const finalCount = await db.streamer.count({ where: { platform: 'LINKEDIN' } });
  console.log('\n===========================================');
  console.log('   BATCH 6 COMPLETE');
  console.log('===========================================');
  console.log(`Created: ${created}/${PROFILES.length}`);
  console.log(`Final count: ${finalCount}/1000 target`);
  console.log(finalCount >= 1000 ? '🎉 TARGET REACHED!' : `${1000 - finalCount} more needed`);

  await db.$disconnect();
}

main().catch(console.error);
