/**
 * RALPH - Enrich WORLDWIDE Creators
 *
 * Takes creators with region=WORLDWIDE and tries to determine their actual country
 * by fetching/analyzing their profile data.
 *
 * Strategies:
 * 1. Check if inferredCountry is already set
 * 2. Fetch profile from platform API and extract country
 * 3. Analyze bio/location text for country indicators
 *
 * Usage:
 *   npx ts-node scripts/ralph-enrich-worldwide.ts                   # Process all
 *   npx ts-node scripts/ralph-enrich-worldwide.ts --platform=TIKTOK # Single platform
 *   npx ts-node scripts/ralph-enrich-worldwide.ts --batch=100       # Batch size
 *   npx ts-node scripts/ralph-enrich-worldwide.ts --dry-run         # Preview only
 */

import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load env
const backendEnv = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv });
} else {
  dotenv.config();
}

import { db } from '../src/utils/database';
import { scrapeCreatorsService } from '../src/services/scrapeCreatorsService';
import { Platform, Region } from '@prisma/client';

// Country indicators in bios/locations
const COUNTRY_PATTERNS: { pattern: RegExp; iso2: string; region: Region }[] = [
  // Latin America
  { pattern: /\b(mexico|méxico|mexicano|cdmx|guadalajara|monterrey)\b/i, iso2: 'MX', region: Region.MEXICO },
  { pattern: /\b(brazil|brasil|brasileiro|são paulo|rio de janeiro|sp|rj)\b/i, iso2: 'BR', region: Region.BRAZIL },
  { pattern: /\b(argentina|argentino|buenos aires|bsas|caba)\b/i, iso2: 'AR', region: Region.ARGENTINA },
  { pattern: /\b(colombia|colombiano|bogotá|bogota|medellín|medellin)\b/i, iso2: 'CO', region: Region.COLOMBIA },
  { pattern: /\b(chile|chileno|santiago)\b/i, iso2: 'CL', region: Region.CHILE },
  { pattern: /\b(peru|perú|peruano|lima)\b/i, iso2: 'PE', region: Region.PERU },
  { pattern: /\b(venezuela|venezolano|caracas)\b/i, iso2: 'VE', region: Region.VENEZUELA },
  { pattern: /\b(ecuador|ecuatoriano|quito|guayaquil)\b/i, iso2: 'EC', region: Region.ECUADOR },
  { pattern: /\b(bolivia|boliviano|la paz)\b/i, iso2: 'BO', region: Region.BOLIVIA },
  { pattern: /\b(paraguay|paraguayo|asunción)\b/i, iso2: 'PY', region: Region.PARAGUAY },
  { pattern: /\b(uruguay|uruguayo|montevideo)\b/i, iso2: 'UY', region: Region.URUGUAY },
  { pattern: /\b(costa rica|costarricense|tico|san josé)\b/i, iso2: 'CR', region: Region.COSTA_RICA },
  { pattern: /\b(panamá|panama|panameño)\b/i, iso2: 'PA', region: Region.PANAMA },
  { pattern: /\b(guatemala|guatemalteco|chapin)\b/i, iso2: 'GT', region: Region.GUATEMALA },
  { pattern: /\b(honduras|hondureño|catracho|tegucigalpa)\b/i, iso2: 'HN', region: Region.HONDURAS },
  { pattern: /\b(el salvador|salvadoreño|guanaco)\b/i, iso2: 'SV', region: Region.EL_SALVADOR },
  { pattern: /\b(nicaragua|nicaragüense|nica|managua)\b/i, iso2: 'NI', region: Region.NICARAGUA },
  { pattern: /\b(dominicana|dominicano|santo domingo|rd)\b/i, iso2: 'DO', region: Region.DOMINICAN_REPUBLIC },
  { pattern: /\b(puerto rico|puertorriqueño|boricua|pr)\b/i, iso2: 'PR', region: Region.PUERTO_RICO },
  { pattern: /\b(cuba|cubano|habana)\b/i, iso2: 'CU', region: Region.OTHER },

  // North America
  { pattern: /\b(united states|usa|america|american|new york|los angeles|chicago|texas|california|florida|nyc|la|sf)\b/i, iso2: 'US', region: Region.USA },
  { pattern: /\b(canada|canadian|toronto|vancouver|montreal|ontario)\b/i, iso2: 'CA', region: Region.CANADA },

  // Europe
  { pattern: /\b(united kingdom|uk|british|england|london|manchester|birmingham)\b/i, iso2: 'GB', region: Region.UK },
  { pattern: /\b(españa|spain|spanish|madrid|barcelona|español)\b/i, iso2: 'ES', region: Region.SPAIN },
  { pattern: /\b(germany|german|deutschland|berlin|münchen|munich)\b/i, iso2: 'DE', region: Region.GERMANY },
  { pattern: /\b(france|french|français|paris|lyon|marseille)\b/i, iso2: 'FR', region: Region.FRANCE },
  { pattern: /\b(italy|italian|italia|rome|roma|milan|milano)\b/i, iso2: 'IT', region: Region.ITALY },
  { pattern: /\b(portugal|portuguese|português|lisboa|lisbon|porto)\b/i, iso2: 'PT', region: Region.PORTUGAL },
  { pattern: /\b(netherlands|dutch|nederland|amsterdam|rotterdam)\b/i, iso2: 'NL', region: Region.NETHERLANDS },
  { pattern: /\b(poland|polish|polska|warsaw|kraków)\b/i, iso2: 'PL', region: Region.POLAND },
  { pattern: /\b(russia|russian|россия|moscow|москва)\b/i, iso2: 'RU', region: Region.RUSSIA },
  { pattern: /\b(sweden|swedish|sverige|stockholm)\b/i, iso2: 'SE', region: Region.SWEDEN },
  { pattern: /\b(norway|norwegian|norge|oslo)\b/i, iso2: 'NO', region: Region.NORWAY },
  { pattern: /\b(denmark|danish|danmark|copenhagen)\b/i, iso2: 'DK', region: Region.DENMARK },
  { pattern: /\b(finland|finnish|suomi|helsinki)\b/i, iso2: 'FI', region: Region.FINLAND },

  // Asia Pacific
  { pattern: /\b(japan|japanese|日本|tokyo|osaka)\b/i, iso2: 'JP', region: Region.JAPAN },
  { pattern: /\b(korea|korean|한국|seoul)\b/i, iso2: 'KR', region: Region.KOREA },
  { pattern: /\b(china|chinese|中国|beijing|shanghai)\b/i, iso2: 'CN', region: Region.CHINA },
  { pattern: /\b(india|indian|mumbai|delhi|bangalore)\b/i, iso2: 'IN', region: Region.INDIA },
  { pattern: /\b(indonesia|indonesian|jakarta|bali)\b/i, iso2: 'ID', region: Region.INDONESIA },
  { pattern: /\b(philippines|filipino|pinoy|manila|cebu)\b/i, iso2: 'PH', region: Region.PHILIPPINES },
  { pattern: /\b(thailand|thai|bangkok)\b/i, iso2: 'TH', region: Region.THAILAND },
  { pattern: /\b(vietnam|vietnamese|hanoi|ho chi minh)\b/i, iso2: 'VN', region: Region.VIETNAM },
  { pattern: /\b(malaysia|malaysian|kuala lumpur|kl)\b/i, iso2: 'MY', region: Region.MALAYSIA },
  { pattern: /\b(singapore|singaporean)\b/i, iso2: 'SG', region: Region.SINGAPORE },
  { pattern: /\b(australia|australian|aussie|sydney|melbourne|brisbane)\b/i, iso2: 'AU', region: Region.AUSTRALIA },
  { pattern: /\b(new zealand|kiwi|auckland|wellington)\b/i, iso2: 'NZ', region: Region.NEW_ZEALAND },

  // Middle East & Africa
  { pattern: /\b(turkey|turkish|türkiye|istanbul|ankara)\b/i, iso2: 'TR', region: Region.OTHER },
  { pattern: /\b(uae|dubai|abu dhabi|emirates)\b/i, iso2: 'AE', region: Region.OTHER },
  { pattern: /\b(saudi|arabia|riyadh|jeddah)\b/i, iso2: 'SA', region: Region.OTHER },
  { pattern: /\b(egypt|egyptian|cairo|مصر)\b/i, iso2: 'EG', region: Region.OTHER },
  { pattern: /\b(south africa|johannesburg|cape town)\b/i, iso2: 'ZA', region: Region.OTHER },
  { pattern: /\b(nigeria|nigerian|lagos|naija)\b/i, iso2: 'NG', region: Region.OTHER },
];

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function detectCountryFromText(text: string): { iso2: string; region: Region } | null {
  if (!text) return null;

  for (const { pattern, iso2, region } of COUNTRY_PATTERNS) {
    if (pattern.test(text)) {
      return { iso2, region };
    }
  }

  return null;
}

async function enrichTikTokCreator(username: string): Promise<{ iso2: string; region: Region } | null> {
  try {
    const profile = await scrapeCreatorsService.getTikTokProfile(username);
    if (!profile) return null;

    // Check signature/bio for country indicators
    const signature = profile.signature || '';
    const detected = detectCountryFromText(signature);
    if (detected) return detected;

    return null;
  } catch {
    return null;
  }
}

async function enrichInstagramCreator(username: string): Promise<{ iso2: string; region: Region } | null> {
  try {
    const profile = await scrapeCreatorsService.getInstagramProfile(username);
    if (!profile) return null;

    // Check biography for country indicators
    const bio = profile.biography || '';
    const detected = detectCountryFromText(bio);
    if (detected) return detected;

    return null;
  } catch {
    return null;
  }
}

async function enrichYouTubeCreator(username: string): Promise<{ iso2: string; region: Region } | null> {
  try {
    const profile = await scrapeCreatorsService.getYouTubeChannel(username);
    if (!profile) return null;

    // YouTube often returns country directly
    if (profile.country) {
      const detected = detectCountryFromText(profile.country);
      if (detected) return detected;
    }

    // Check description
    const desc = profile.description || '';
    const detected = detectCountryFromText(desc);
    if (detected) return detected;

    return null;
  } catch {
    return null;
  }
}

async function enrichLinkedInCreator(username: string): Promise<{ iso2: string; region: Region } | null> {
  try {
    const profile = await scrapeCreatorsService.getLinkedInProfile(`https://linkedin.com/in/${username}`);
    if (!profile) return null;

    // LinkedIn often has location/country
    const location = profile.location || profile.geo_location || profile.country || '';
    const detected = detectCountryFromText(location);
    if (detected) return detected;

    return null;
  } catch {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const platformArg = args.find(a => a.startsWith('--platform='));
  const batchArg = args.find(a => a.startsWith('--batch='));

  const platformFilter = platformArg ? platformArg.split('=')[1].toUpperCase() : null;
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1]) : 200;

  console.log('========================================');
  console.log('🦸 RALPH - Enrich WORLDWIDE Creators');
  console.log('========================================');
  console.log(`Batch size: ${batchSize}`);
  if (platformFilter) console.log(`Platform filter: ${platformFilter}`);
  if (dryRun) console.log('🧪 DRY RUN MODE');
  console.log('');

  // First, try to enrich from existing profile data (bio, description)
  console.log('📊 Phase 1: Enriching from existing profile data...');

  const whereClause: any = { region: Region.WORLDWIDE };
  if (platformFilter) {
    whereClause.platform = platformFilter as Platform;
  }

  // Get WORLDWIDE creators with profile descriptions
  const creatorsWithBio = await db.streamer.findMany({
    where: {
      ...whereClause,
      OR: [
        { profileDescription: { not: null } },
        { profileDescription: { not: '' } },
      ]
    },
    select: {
      id: true,
      username: true,
      platform: true,
      profileDescription: true,
    },
    take: batchSize * 2
  });

  console.log(`  Found ${creatorsWithBio.length} creators with profile descriptions`);

  let enrichedFromBio = 0;
  for (const creator of creatorsWithBio) {
    const detected = detectCountryFromText(creator.profileDescription || '');
    if (detected) {
      if (!dryRun) {
        await db.streamer.update({
          where: { id: creator.id },
          data: {
            region: detected.region,
            inferredCountry: detected.iso2,
            inferredCountrySource: 'bio_analysis',
          }
        });
      }
      enrichedFromBio++;
      console.log(`    ✅ ${creator.platform}/${creator.username} → ${detected.iso2}`);
    }
  }

  console.log(`  Enriched ${enrichedFromBio} from existing bio data`);

  // Phase 2: Fetch fresh profile data via API
  console.log('\n📊 Phase 2: Fetching fresh profile data via API...');

  // Get WORLDWIDE creators without country info
  const creatorsToEnrich = await db.streamer.findMany({
    where: {
      ...whereClause,
      inferredCountry: null,
    },
    select: {
      id: true,
      username: true,
      platform: true,
    },
    take: batchSize
  });

  console.log(`  Found ${creatorsToEnrich.length} creators to enrich via API`);

  let enrichedFromAPI = 0;
  let apiCalls = 0;

  for (const creator of creatorsToEnrich) {
    let detected: { iso2: string; region: Region } | null = null;

    try {
      switch (creator.platform) {
        case Platform.TIKTOK:
          detected = await enrichTikTokCreator(creator.username);
          break;
        case Platform.INSTAGRAM:
          detected = await enrichInstagramCreator(creator.username);
          break;
        case Platform.YOUTUBE:
          detected = await enrichYouTubeCreator(creator.username);
          break;
        case Platform.LINKEDIN:
          detected = await enrichLinkedInCreator(creator.username);
          break;
        // Skip platforms without location data
        default:
          continue;
      }

      apiCalls++;

      if (detected) {
        if (!dryRun) {
          await db.streamer.update({
            where: { id: creator.id },
            data: {
              region: detected.region,
              inferredCountry: detected.iso2,
              inferredCountrySource: creator.platform,
            }
          });
        }
        enrichedFromAPI++;
        console.log(`    ✅ ${creator.platform}/${creator.username} → ${detected.iso2}`);
      }

      // Rate limiting
      if (apiCalls % 10 === 0) {
        await delay(1000);
      }

    } catch (error: any) {
      console.log(`    ⚠️  Error enriching ${creator.username}: ${error.message}`);
    }
  }

  console.log(`  Enriched ${enrichedFromAPI} from API calls (${apiCalls} API calls made)`);

  // Summary
  console.log('\n========================================');
  console.log('📊 ENRICHMENT COMPLETE');
  console.log('========================================');
  console.log(`From existing bio data: ${enrichedFromBio}`);
  console.log(`From API calls: ${enrichedFromAPI}`);
  console.log(`Total enriched: ${enrichedFromBio + enrichedFromAPI}`);

  // Show remaining WORLDWIDE count
  const remainingWorldwide = await db.streamer.count({
    where: { region: Region.WORLDWIDE }
  });
  console.log(`\nRemaining WORLDWIDE: ${remainingWorldwide.toLocaleString()}`);

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error('❌ Error:', e);
  await db.$disconnect();
  process.exit(1);
});
