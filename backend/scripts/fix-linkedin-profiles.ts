/**
 * LinkedIn Profile Fix Script
 * Re-fetches profiles to fix:
 * 1. Placeholder/missing avatars
 * 2. Incorrect region mapping (WORLDWIDE → specific country)
 *
 * Run when ScrapeCreators API credits are available
 */

import { PrismaClient, Region } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

const SCRAPECREATORS_API_KEY = process.env.SCRAPECREATORS_API_KEY || 'sc_4e439adb5c8c44139ab9c94c79fab79b';
const BUNNY_STORAGE_KEY = process.env.BUNNY_STORAGE_KEY || '';
const BUNNY_STORAGE_ZONE = 'envisioner';
const BUNNY_STORAGE_HOST = 'storage.bunnycdn.com';

// Better location to region mapping (using only valid Region enum values)
function parseLocationToRegion(location?: string): Region {
  if (!location) return Region.WORLDWIDE;

  const loc = location.toLowerCase();

  // USA - check for country and major cities/states
  if (loc.includes('united states') || loc.includes('usa') || loc.includes(', us') ||
      loc.endsWith(' us') || loc.includes('california') || loc.includes('new york') ||
      loc.includes('texas') || loc.includes('washington') || loc.includes('massachusetts') ||
      loc.includes('florida') || loc.includes('illinois') || loc.includes('georgia') ||
      loc.includes('san francisco') || loc.includes('los angeles') || loc.includes('seattle') ||
      loc.includes('boston') || loc.includes('chicago') || loc.includes('miami') ||
      loc.includes('austin') || loc.includes('denver') || loc.includes('atlanta') ||
      loc.includes('silicon valley') || loc.includes('bay area') || loc.includes('nyc') ||
      loc.includes('palo alto') || loc.includes('menlo park') || loc.includes('mountain view') ||
      loc.includes('san jose') || loc.includes('san diego') || loc.includes('phoenix') ||
      loc.includes('portland') || loc.includes('minneapolis') || loc.includes('detroit') ||
      loc.includes('philadelphia') || loc.includes('las vegas') || loc.includes('colorado') ||
      loc.includes('arizona') || loc.includes('oregon') || loc.includes('nevada')) {
    return Region.USA;
  }

  // UK
  if (loc.includes('united kingdom') || loc.includes('england') || loc.includes('london') ||
      loc.includes('manchester') || loc.includes('birmingham') || loc.includes('scotland') ||
      loc.includes('wales') || loc.includes(', uk') || loc.includes('cambridge, ') ||
      loc.includes('oxford') || loc.includes('edinburgh') || loc.includes('bristol')) {
    return Region.UK;
  }

  // Canada
  if (loc.includes('canada') || loc.includes('toronto') || loc.includes('vancouver') ||
      loc.includes('montreal') || loc.includes('ottawa') || loc.includes('calgary')) {
    return Region.CANADA;
  }

  // Australia
  if (loc.includes('australia') || loc.includes('sydney') || loc.includes('melbourne') ||
      loc.includes('brisbane') || loc.includes('perth')) {
    return Region.AUSTRALIA;
  }

  // Germany
  if (loc.includes('germany') || loc.includes('berlin') || loc.includes('munich') ||
      loc.includes('frankfurt') || loc.includes('hamburg') || loc.includes('deutschland')) {
    return Region.GERMANY;
  }

  // France
  if (loc.includes('france') || loc.includes('paris') || loc.includes('lyon') ||
      loc.includes('marseille')) {
    return Region.FRANCE;
  }

  // India
  if (loc.includes('india') || loc.includes('bangalore') || loc.includes('mumbai') ||
      loc.includes('delhi') || loc.includes('hyderabad') || loc.includes('chennai') ||
      loc.includes('pune') || loc.includes('kolkata') || loc.includes('bengaluru')) {
    return Region.INDIA;
  }

  // China (includes Hong Kong, Taiwan)
  if (loc.includes('china') || loc.includes('beijing') || loc.includes('shanghai') ||
      loc.includes('shenzhen') || loc.includes('hangzhou') || loc.includes('guangzhou') ||
      loc.includes('hong kong') || loc.includes('taiwan') || loc.includes('taipei')) {
    return Region.CHINA;
  }

  // Japan
  if (loc.includes('japan') || loc.includes('tokyo') || loc.includes('osaka') ||
      loc.includes('kyoto') || loc.includes('yokohama')) {
    return Region.JAPAN;
  }

  // Korea
  if (loc.includes('korea') || loc.includes('seoul') || loc.includes('busan')) {
    return Region.KOREA;
  }

  // Singapore
  if (loc.includes('singapore')) {
    return Region.SINGAPORE;
  }

  // Brazil
  if (loc.includes('brazil') || loc.includes('são paulo') || loc.includes('sao paulo') ||
      loc.includes('rio de janeiro') || loc.includes('brasil')) {
    return Region.BRAZIL;
  }

  // Mexico
  if (loc.includes('mexico') || loc.includes('ciudad de méxico') || loc.includes('monterrey')) {
    return Region.MEXICO;
  }

  // Spain
  if (loc.includes('spain') || loc.includes('madrid') || loc.includes('barcelona') ||
      loc.includes('españa')) {
    return Region.SPAIN;
  }

  // Italy
  if (loc.includes('italy') || loc.includes('rome') || loc.includes('milan') ||
      loc.includes('roma') || loc.includes('milano') || loc.includes('italia')) {
    return Region.ITALY;
  }

  // Netherlands
  if (loc.includes('netherlands') || loc.includes('amsterdam') || loc.includes('rotterdam') ||
      loc.includes('holland')) {
    return Region.NETHERLANDS;
  }

  // Sweden
  if (loc.includes('sweden') || loc.includes('stockholm') || loc.includes('gothenburg')) {
    return Region.SWEDEN;
  }

  // Indonesia
  if (loc.includes('indonesia') || loc.includes('jakarta') || loc.includes('bali')) {
    return Region.INDONESIA;
  }

  // Philippines
  if (loc.includes('philippines') || loc.includes('manila') || loc.includes('cebu')) {
    return Region.PHILIPPINES;
  }

  // Vietnam
  if (loc.includes('vietnam') || loc.includes('ho chi minh') || loc.includes('hanoi') ||
      loc.includes('saigon')) {
    return Region.VIETNAM;
  }

  // Thailand
  if (loc.includes('thailand') || loc.includes('bangkok') || loc.includes('chiang mai')) {
    return Region.THAILAND;
  }

  // Poland
  if (loc.includes('poland') || loc.includes('warsaw') || loc.includes('krakow') ||
      loc.includes('kraków')) {
    return Region.POLAND;
  }

  // Portugal
  if (loc.includes('portugal') || loc.includes('lisbon') || loc.includes('porto')) {
    return Region.PORTUGAL;
  }

  // Denmark
  if (loc.includes('denmark') || loc.includes('copenhagen')) {
    return Region.DENMARK;
  }

  // Norway
  if (loc.includes('norway') || loc.includes('oslo')) {
    return Region.NORWAY;
  }

  // Finland
  if (loc.includes('finland') || loc.includes('helsinki')) {
    return Region.FINLAND;
  }

  // New Zealand
  if (loc.includes('new zealand') || loc.includes('auckland') || loc.includes('wellington')) {
    return Region.NEW_ZEALAND;
  }

  // Argentina
  if (loc.includes('argentina') || loc.includes('buenos aires')) {
    return Region.ARGENTINA;
  }

  // Colombia
  if (loc.includes('colombia') || loc.includes('bogota') || loc.includes('medellín') ||
      loc.includes('medellin')) {
    return Region.COLOMBIA;
  }

  // Chile
  if (loc.includes('chile') || loc.includes('santiago')) {
    return Region.CHILE;
  }

  // Russia
  if (loc.includes('russia') || loc.includes('moscow') || loc.includes('st petersburg') ||
      loc.includes('россия')) {
    return Region.RUSSIA;
  }

  // Malaysia
  if (loc.includes('malaysia') || loc.includes('kuala lumpur')) {
    return Region.MALAYSIA;
  }

  // Other countries map to OTHER
  if (loc.includes('switzerland') || loc.includes('israel') || loc.includes('uae') ||
      loc.includes('dubai') || loc.includes('ireland') || loc.includes('dublin') ||
      loc.includes('austria') || loc.includes('belgium') || loc.includes('turkey') ||
      loc.includes('nigeria') || loc.includes('south africa') || loc.includes('egypt') ||
      loc.includes('kenya') || loc.includes('czech') || loc.includes('romania') ||
      loc.includes('hungary') || loc.includes('greece') || loc.includes('saudi') ||
      loc.includes('pakistan') || loc.includes('bangladesh') || loc.includes('ukraine')) {
    return Region.OTHER;
  }

  return Region.WORLDWIDE;
}

async function uploadAvatarToBunny(imageUrl: string, filename: string): Promise<string | null> {
  try {
    if (!BUNNY_STORAGE_KEY) {
      console.log('  ⚠️ No Bunny storage key configured');
      return null;
    }

    // Download image
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const imageBuffer = Buffer.from(imageResponse.data);

    // Check if it's a valid image (not too small)
    if (imageBuffer.length < 1000) {
      console.log('  ⚠️ Image too small, likely placeholder');
      return null;
    }

    // Upload to Bunny
    const uploadPath = `avatars/linkedin/${filename}`;
    const uploadUrl = `https://${BUNNY_STORAGE_HOST}/${BUNNY_STORAGE_ZONE}/${uploadPath}`;

    await axios.put(uploadUrl, imageBuffer, {
      headers: {
        'AccessKey': BUNNY_STORAGE_KEY,
        'Content-Type': 'image/jpeg'
      }
    });

    return `https://media.envr.io/${uploadPath}`;
  } catch (error: any) {
    console.log('  ❌ Upload failed:', error.message);
    return null;
  }
}

async function fetchLinkedInProfile(handle: string): Promise<any> {
  try {
    const url = `https://www.linkedin.com/in/${handle}`;
    const response = await axios.get('https://api.scrapecreators.com/v1/linkedin/profile', {
      params: { url },
      headers: { 'x-api-key': SCRAPECREATORS_API_KEY },
      timeout: 15000
    });
    return response.data?.data || response.data;
  } catch (error: any) {
    if (error.response?.status === 402) {
      throw new Error('API_CREDITS_EXHAUSTED');
    }
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('===========================================');
  console.log('   LINKEDIN PROFILE FIX');
  console.log('===========================================\n');

  // Get all LinkedIn profiles that need fixing
  const profiles = await prisma.streamer.findMany({
    where: { platform: 'LINKEDIN' },
    orderBy: { followers: 'desc' }
  });

  console.log(`Found ${profiles.length} LinkedIn profiles\n`);

  // Check which need avatar fix
  const needsAvatarFix: string[] = [];
  for (const p of profiles) {
    if (!p.avatarUrl) {
      needsAvatarFix.push(p.username);
      continue;
    }
    try {
      const baseUrl = p.avatarUrl.split('?')[0];
      const headRes = await axios.head(baseUrl, { timeout: 5000 });
      const size = parseInt(headRes.headers['content-length'] || '0');
      if (size < 1000) {
        needsAvatarFix.push(p.username);
      }
    } catch {
      needsAvatarFix.push(p.username);
    }
  }

  // Check which need region fix
  const needsRegionFix = profiles.filter(p => p.region === 'WORLDWIDE').map(p => p.username);

  const needsFix = new Set([...needsAvatarFix, ...needsRegionFix]);

  console.log(`Profiles needing avatar fix: ${needsAvatarFix.length}`);
  console.log(`Profiles needing region fix: ${needsRegionFix.length}`);
  console.log(`Total unique profiles to fix: ${needsFix.size}\n`);

  let fixed = 0;
  let failed = 0;

  for (const username of needsFix) {
    console.log(`[${fixed + failed + 1}/${needsFix.size}] ${username}`);

    try {
      const data = await fetchLinkedInProfile(username);

      if (!data) {
        console.log('  ❌ Profile not found');
        failed++;
        continue;
      }

      const updates: any = {};

      // Fix avatar
      if (needsAvatarFix.includes(username) && data.profilePicture) {
        console.log('  📷 Uploading avatar...');
        const avatarUrl = await uploadAvatarToBunny(data.profilePicture, `${username}.jpg`);
        if (avatarUrl) {
          updates.avatarUrl = avatarUrl;
          console.log('  ✅ Avatar uploaded');
        }
      }

      // Fix region
      if (needsRegionFix.includes(username)) {
        const location = data.location || data.geoLocation || '';
        const region = parseLocationToRegion(location);
        if (region !== Region.WORLDWIDE) {
          updates.region = region;
          console.log(`  🌍 Region: ${region} (from: ${location})`);
        }
      }

      // Update database if there are changes
      if (Object.keys(updates).length > 0) {
        await prisma.streamer.update({
          where: { platform_username: { platform: 'LINKEDIN', username } },
          data: updates
        });
        fixed++;
      } else {
        console.log('  ℹ️ No updates needed');
      }

      // Rate limiting
      await delay(1000);

    } catch (error: any) {
      if (error.message === 'API_CREDITS_EXHAUSTED') {
        console.log('\n⚠️ API credits exhausted! Stopping...');
        console.log(`Fixed ${fixed} profiles before running out of credits.`);
        break;
      }
      console.log('  ❌ Error:', error.message);
      failed++;
    }
  }

  console.log('\n===========================================');
  console.log('   FIX COMPLETE');
  console.log('===========================================');
  console.log(`Fixed: ${fixed}`);
  console.log(`Failed: ${failed}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
