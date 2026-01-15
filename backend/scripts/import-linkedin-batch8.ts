/**
 * LinkedIn Batch 8 Import - Individual Creators & Influencers
 * Focus on content creators, thought leaders, and influencers - NO companies
 */

import axios from 'axios';
import { db, logger } from '../src/utils/database';
import { Region } from '@prisma/client';
import { bunnyService } from '../src/services/bunnyService';

const SCRAPECREATORS_API_KEY = process.env.SCRAPECREATORS_API_KEY || 'qJY95WcDxCStfw9idIub8a04Cyr1';

const PROFILES = [
  // Tech Content Creators & Educators
  { name: 'Tina Huang', handle: 'tina-huang-ds', category: 'creator' },
  { name: 'Alex The Analyst', handle: 'alex-freberg', category: 'creator' },
  { name: 'Thu Vu', handle: 'thu-vu-data-analytics', category: 'creator' },
  { name: 'Ken Jee', handle: 'kenjee', category: 'creator' },
  { name: 'Shashank Kalanithi', handle: 'shashankkalanithi', category: 'creator' },
  { name: 'Danny Thompson', handle: 'dannythompson', category: 'creator' },
  { name: 'Ania Kubow', handle: 'ania-kubow', category: 'creator' },
  { name: 'Nana Janashia', handle: 'nanajanashia', category: 'creator' },
  { name: 'Kevin Stratvert', handle: 'kevin-stratvert', category: 'creator' },
  { name: 'Patrick Shyu', handle: 'pshyu', category: 'creator' },
  { name: 'Joma Tech', handle: 'jomatech', category: 'creator' },
  { name: 'Andy Sterkowitz', handle: 'andysterkowitz', category: 'creator' },
  { name: 'Forrest Knight', handle: 'forrestpknight', category: 'creator' },
  { name: 'Aaron Jack', handle: 'aaronjack', category: 'creator' },
  { name: 'Clément Mihailescu', handle: 'clementmihailescu', category: 'creator' },
  { name: 'Neetcode', handle: 'neetcode', category: 'creator' },
  { name: 'Brad Traversy', handle: 'bradtraversy', category: 'creator' },
  { name: 'Mosh Hamedani', handle: 'codewithmosh', category: 'creator' },
  { name: 'Maximilian Schwarzmüller', handle: 'maximilian-schwarzmuller', category: 'creator' },
  { name: 'Stephen Grider', handle: 'stephengrider', category: 'creator' },
  { name: 'Angela Yu', handle: 'angela-yu-dr', category: 'creator' },
  { name: 'Colt Steele', handle: 'colt-steele', category: 'creator' },
  { name: 'Jonas Schmedtmann', handle: 'jonasschmedtmann', category: 'creator' },
  { name: 'Andrei Neagoie', handle: 'andreineagoie', category: 'creator' },
  { name: 'Net Ninja', handle: 'thenetninjauk', category: 'creator' },

  // AI/ML Influencers & Researchers
  { name: 'Cassie Kozyrkov', handle: 'kozyrkov', category: 'influencer' },
  { name: 'Kirk Borne', handle: 'kirkdborne', category: 'influencer' },
  { name: 'Krish Naik', handle: 'krishnaik06', category: 'creator' },
  { name: 'Siraj Raval', handle: 'sirajraval', category: 'creator' },
  { name: 'Lex Fridman', handle: 'lexfridman', category: 'influencer' },
  { name: 'Two Minute Papers', handle: 'karoly-zsolnai-feher', category: 'creator' },
  { name: 'Yannic Kilcher', handle: 'yannic-kilcher', category: 'creator' },
  { name: 'Elvis Saravia', handle: 'elvissaravia', category: 'influencer' },
  { name: 'Jay Alammar', handle: 'jalammar', category: 'creator' },
  { name: 'Chris Albon', handle: 'chrisalbon', category: 'influencer' },
  { name: 'Chip Huyen', handle: 'chiphuyen', category: 'influencer' },
  { name: 'Timnit Gebru', handle: 'timnit-gebru', category: 'influencer' },
  { name: 'Margaret Mitchell', handle: 'mmitchell-ai', category: 'influencer' },
  { name: 'Soumith Chintala', handle: 'soumith', category: 'influencer' },
  { name: 'Andrej Karpathy', handle: 'andrej-karpathy', category: 'influencer' },

  // DevRel & Developer Advocates
  { name: 'Sarah Drasner', handle: 'sarah-drasner', category: 'devrel' },
  { name: 'Kelsey Hightower', handle: 'kelsey-hightower', category: 'devrel' },
  { name: 'Swyx', handle: 'shawnwang', category: 'devrel' },
  { name: 'Cassidy Williams', handle: 'cassidoo', category: 'devrel' },
  { name: 'James Q Quick', handle: 'jamesqquick', category: 'devrel' },
  { name: 'Eddie Jaoude', handle: 'eddiejaoude', category: 'devrel' },
  { name: 'Colby Fayock', handle: 'colbyfayock', category: 'devrel' },
  { name: 'Emma Bostian', handle: 'emmabostian', category: 'devrel' },
  { name: 'Ali Spittel', handle: 'aspittel', category: 'devrel' },
  { name: 'Jason Lengstorf', handle: 'jlengstorf', category: 'devrel' },
  { name: 'Kent C. Dodds', handle: 'kentcdodds', category: 'creator' },
  { name: 'Dan Abramov', handle: 'dan-abramov', category: 'devrel' },
  { name: 'Ryan Florence', handle: 'ryanflorence', category: 'creator' },
  { name: 'Michael Chan', handle: 'chantastic', category: 'devrel' },
  { name: 'Tejas Kumar', handle: 'tejaskumar', category: 'devrel' },

  // Tech Podcasters & Media
  { name: 'Lex Fridman', handle: 'lexfridman', category: 'podcaster' },
  { name: 'Scott Galloway', handle: 'scottgalloway', category: 'influencer' },
  { name: 'Gary Vaynerchuk', handle: 'garyvaynerchuk', category: 'influencer' },
  { name: 'Simon Sinek', handle: 'simonsinek', category: 'influencer' },
  { name: 'Naval Ravikant', handle: 'naval-ravikant', category: 'influencer' },
  { name: 'Tim Ferriss', handle: 'timferriss', category: 'influencer' },
  { name: 'Guy Kawasaki', handle: 'guykawasaki', category: 'influencer' },
  { name: 'Seth Godin', handle: 'sethgodin', category: 'influencer' },
  { name: 'Ryan Holiday', handle: 'ryanholiday', category: 'influencer' },
  { name: 'James Clear', handle: 'jamesclear', category: 'influencer' },

  // Startup Founders (Individual profiles)
  { name: 'Pieter Levels', handle: 'pieterhg', category: 'creator' },
  { name: 'Tony Dinh', handle: 'tdinh', category: 'creator' },
  { name: 'Damon Chen', handle: 'damonchen', category: 'creator' },
  { name: 'Jon Yongfook', handle: 'yongfook', category: 'creator' },
  { name: 'Marc Lou', handle: 'marclou', category: 'creator' },
  { name: 'KP', handle: 'thisiskp', category: 'creator' },
  { name: 'Sahil Lavingia', handle: 'sahillavingia', category: 'founder' },
  { name: 'Rand Fishkin', handle: 'randfishkin', category: 'founder' },
  { name: 'David Heinemeier Hansson', handle: 'dhh', category: 'founder' },
  { name: 'Jason Fried', handle: 'jasonfried', category: 'founder' },
  { name: 'Paul Graham', handle: 'paulgraham', category: 'founder' },

  // Data Science & Analytics Creators
  { name: 'Sundas Khalid', handle: 'sundaskhalid', category: 'creator' },
  { name: 'Avery Smith', handle: 'averysmith', category: 'creator' },
  { name: 'Luke Barousse', handle: 'lukebarousse', category: 'creator' },
  { name: 'Charlotte Chaze', handle: 'charlottechaze', category: 'creator' },
  { name: 'Mo Chen', handle: 'mochen4', category: 'creator' },
  { name: 'Daliana Liu', handle: 'dalianaliu', category: 'creator' },
  { name: 'Maddy Guthridge', handle: 'maddy-guthridge', category: 'creator' },
  { name: 'Rob Mulla', handle: 'robmulla', category: 'creator' },
  { name: 'Keith Galli', handle: 'keithgalli', category: 'creator' },
  { name: 'Sentdex', handle: 'sentdex', category: 'creator' },

  // Product & Design Leaders
  { name: 'Julie Zhuo', handle: 'juliezhuo', category: 'influencer' },
  { name: 'Lenny Rachitsky', handle: 'lennyrachitsky', category: 'influencer' },
  { name: 'Shreyas Doshi', handle: 'shreyasdoshi', category: 'influencer' },
  { name: 'Jackie Bavaro', handle: 'jackiebavaro', category: 'influencer' },
  { name: 'Teresa Torres', handle: 'teresatorres', category: 'influencer' },
  { name: 'Melissa Perri', handle: 'melissaperri', category: 'influencer' },
  { name: 'Gibson Biddle', handle: 'gibsonbiddle', category: 'influencer' },
  { name: 'Marty Cagan', handle: 'mcagan', category: 'influencer' },
  { name: 'Ken Norton', handle: 'kennorton', category: 'influencer' },

  // Career & Professional Growth Creators
  { name: 'Austin Belcak', handle: 'abelcak', category: 'creator' },
  { name: 'Wonsulting', handle: 'wonsulting', category: 'creator' },
  { name: 'Jerry Lee', handle: 'jerrythecareercoach', category: 'creator' },
  { name: 'Madeline Mann', handle: 'madelinemann', category: 'creator' },
  { name: 'Hannah Morgan', handle: 'hannahmorgansh', category: 'creator' },
  { name: 'Lavie Margolin', handle: 'laviemargolin', category: 'creator' },
  { name: 'Joshua Fluke', handle: 'joshuafluke', category: 'creator' },
  { name: 'Chris Sean', handle: 'chrissean', category: 'creator' },

  // Finance/Crypto Influencers
  { name: 'Cathie Wood', handle: 'cathie-wood', category: 'influencer' },
  { name: 'Raoul Pal', handle: 'raoul-pal', category: 'influencer' },
  { name: 'Anthony Pompliano', handle: 'anthonypompliano', category: 'influencer' },
  { name: 'Dan Held', handle: 'danheld', category: 'influencer' },
  { name: 'Caitlin Long', handle: 'caitlin-long', category: 'influencer' },

  // More Tech YouTubers / Content Creators
  { name: 'Marques Brownlee', handle: 'mkbhd', category: 'creator' },
  { name: 'Linus Sebastian', handle: 'linussebastian', category: 'creator' },
  { name: 'Austin Evans', handle: 'austinevans', category: 'creator' },
  { name: 'Jonathan Morrison', handle: 'tldtoday', category: 'creator' },
  { name: 'Sara Dietschy', handle: 'saradietschy', category: 'creator' },
  { name: 'Justine Ezarik', handle: 'ijustine', category: 'creator' },
  { name: 'Mrwhosetheboss', handle: 'aaboroshy-syed', category: 'creator' },
  { name: 'Dave Lee', handle: 'daveleefm', category: 'creator' },
  { name: 'Michael Fisher', handle: 'thepocketnow', category: 'creator' },

  // No-code / Low-code Creators
  { name: 'Connor Finlayson', handle: 'connorfinlayson', category: 'creator' },
  { name: 'Lacey Kesler', handle: 'laceykesler', category: 'creator' },
  { name: 'Marie Poulin', handle: 'mariepoulin', category: 'creator' },
  { name: 'Thomas Frank', handle: 'thomas-frank', category: 'creator' },
  { name: 'Francesco DAtessandro', handle: 'francescodalesandro', category: 'creator' },
  { name: 'August Bradley', handle: 'augustbradley', category: 'creator' },

  // Entrepreneurship / Startup Ecosystem
  { name: 'Andrew Wilkinson', handle: 'awilkinson', category: 'founder' },
  { name: 'Arvid Kahl', handle: 'arvidkahl', category: 'founder' },
  { name: 'Courtland Allen', handle: 'courtlandallen', category: 'founder' },
  { name: 'Rob Walling', handle: 'robwalling', category: 'founder' },
  { name: 'Natalie Nagele', handle: 'natalienagele', category: 'founder' },

  // Engineering Managers & Tech Leaders
  { name: 'Will Larson', handle: 'willlarson', category: 'influencer' },
  { name: 'Camille Fournier', handle: 'skamille', category: 'influencer' },
  { name: 'Charity Majors', handle: 'mipsytipsy', category: 'influencer' },
  { name: 'Gergely Orosz', handle: 'gergelyorosz', category: 'influencer' },
  { name: 'Patrick Kua', handle: 'patkua', category: 'influencer' },

  // Security & Privacy Experts
  { name: 'Troy Hunt', handle: 'troyhunt', category: 'influencer' },
  { name: 'Bruce Schneier', handle: 'bruceschneier', category: 'influencer' },
  { name: 'Brian Krebs', handle: 'briankrebs', category: 'influencer' },
  { name: 'Katie Moussouris', handle: 'k8em0', category: 'influencer' },
  { name: 'Alex Stamos', handle: 'alexstamos', category: 'influencer' },
  { name: 'Parisa Tabriz', handle: 'parisatabriz', category: 'influencer' },

  // Cloud & DevOps Experts
  { name: 'Corey Quinn', handle: 'quinnypig', category: 'influencer' },
  { name: 'Emily Freeman', handle: 'editingemily', category: 'devrel' },
  { name: 'Forrest Brazeal', handle: 'forrestbrazeal', category: 'devrel' },
  { name: 'Brian LeRoux', handle: 'brianleroux', category: 'founder' },
  { name: 'Darcy Clarke', handle: 'darcyclarke', category: 'devrel' },
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
}

async function fetchLinkedInProfile(handle: string): Promise<{ profile: LinkedInProfile | null; isPrivate: boolean }> {
  try {
    const response = await axios.get(
      `https://api.scrapecreators.com/v1/linkedin/profile?linkedin_url=https://linkedin.com/in/${handle}`,
      { headers: { 'x-api-key': SCRAPECREATORS_API_KEY } }
    );

    if (response.data?.success === true && response.data?.message?.includes('private')) {
      return { profile: null, isPrivate: true };
    }

    const profile = response.data?.person;
    if (!profile) {
      return { profile: null, isPrivate: response.data?.success === false };
    }

    return { profile, isPrivate: false };
  } catch (error: any) {
    if (error.response?.status === 404) {
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
    'NL': Region.NETHERLANDS, 'SE': Region.SWEDEN, 'ES': Region.SPAIN,
  };

  if (code && codeMap[code]) return codeMap[code];

  const nameMap: Array<[string[], Region]> = [
    [['united states', 'usa', 'california', 'new york', 'san francisco', 'seattle', 'austin', 'boston'], Region.USA],
    [['united kingdom', 'london', 'uk'], Region.UK],
    [['germany', 'berlin', 'munich'], Region.GERMANY],
    [['japan', 'tokyo'], Region.JAPAN],
    [['china', 'beijing', 'shanghai'], Region.CHINA],
    [['india', 'bangalore', 'mumbai', 'delhi'], Region.INDIA],
    [['singapore'], Region.SINGAPORE],
    [['australia', 'sydney', 'melbourne'], Region.AUSTRALIA],
    [['canada', 'toronto', 'vancouver'], Region.CANADA],
    [['netherlands', 'amsterdam'], Region.NETHERLANDS],
  ];

  for (const [keywords, region] of nameMap) {
    if (keywords.some(kw => countryStr.includes(kw))) return region;
  }

  return Region.WORLDWIDE;
}

async function importProfile(item: { name: string; handle: string; category: string }): Promise<boolean> {
  const handle = item.handle.toLowerCase();

  try {
    const existing = await db.streamer.findUnique({
      where: { platform_username: { platform: 'LINKEDIN', username: handle } }
    });
    if (existing) return false;

    const { profile, isPrivate } = await fetchLinkedInProfile(item.handle);

    let displayName: string;
    let avatarUrl: string | undefined;
    let followers: number;
    let description: string;
    let region: Region = Region.WORLDWIDE;

    if (profile) {
      displayName = profile.name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || item.name;
      avatarUrl = profile.image;
      followers = profile.followers || profile.follower_count || 0;
      description = profile.headline || '';
      region = mapLocationToRegion(profile.location || profile.geo_location, profile.country, profile.country_code);
    } else {
      displayName = item.name;
      followers = 0;
      description = isPrivate ? '' : 'Profile not found';
    }

    const uploadedAvatar = avatarUrl ? await uploadAvatar(avatarUrl, handle) : undefined;

    await db.streamer.create({
      data: {
        platform: 'LINKEDIN',
        username: handle,
        displayName,
        profileUrl: `https://linkedin.com/in/${handle}`,
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
  console.log('   LINKEDIN BATCH 8 - CREATORS & INFLUENCERS');
  console.log('===========================================\n');

  await db.$connect();

  const initialCount = await db.streamer.count({ where: { platform: 'LINKEDIN' } });
  console.log(`Initial LinkedIn count: ${initialCount}`);
  console.log(`Creators to import: ${PROFILES.length}\n`);

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
  console.log(`   BATCH 8 COMPLETE - CREATORS ONLY`);
  console.log(`   Imported: ${imported}`);
  console.log(`   Final LinkedIn count: ${finalCount}`);
  console.log('===========================================');

  await db.$disconnect();
}

main().catch(console.error);
