/**
 * X (Twitter) Profile Fix Script
 * Re-fetches profiles to fix region mapping (WORLDWIDE -> specific country)
 *
 * Run: npx tsx scripts/fix-x-profiles.ts
 */

import { PrismaClient, Region } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

const SCRAPECREATORS_API_KEY = process.env.SCRAPECREATORS_API_KEY || 'qJY95WcDxCStfw9idIub8a04Cyr1';

// Helper to convert any value to string
function toString(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    // Try to extract location from object structure
    const obj = val as any;
    return obj.name || obj.full_name || obj.location || JSON.stringify(val);
  }
  return String(val);
}

// Location to region mapping
function parseLocationToRegion(location?: unknown): Region {
  const locationStr = toString(location);
  if (!locationStr) return Region.WORLDWIDE;

  const loc = locationStr.toLowerCase();

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
      loc.includes('arizona') || loc.includes('oregon') || loc.includes('nevada') ||
      loc.includes('nashville') || loc.includes('dallas') || loc.includes('houston') ||
      loc.includes('estados unidos') || loc.includes('nova york') || loc.includes('nova iorque') ||
      loc.includes('u.s.a') || loc.includes('u.s.') || loc === 'us' || loc === 'usa' ||
      loc.includes(', ny') || loc.includes(', ca') || loc.includes(', tx') || loc.includes(', fl') ||
      loc.includes(', nc') || loc.includes(', ma') || loc.includes(', wa') || loc.includes('brooklyn') ||
      loc.includes('utah') || loc.includes('tennessee') || loc.includes('virginia') || loc.includes('ohio')) {
    return Region.USA;
  }

  // UK - including Portuguese/Spanish translations
  if (loc.includes('united kingdom') || loc.includes('england') || loc.includes('london') ||
      loc.includes('manchester') || loc.includes('birmingham') || loc.includes('scotland') ||
      loc.includes('wales') || loc.includes(', uk') || loc.includes('cambridge') ||
      loc.includes('oxford') || loc.includes('edinburgh') || loc.includes('bristol') ||
      loc.includes('reino unido') || loc.includes('inglaterra') || loc.includes('liverpool') ||
      loc.includes('leeds') || loc.includes('glasgow') || loc.includes('londres')) {
    return Region.UK;
  }

  // Canada - including Quebec and provinces
  if (loc.includes('canada') || loc.includes('toronto') || loc.includes('vancouver') ||
      loc.includes('montreal') || loc.includes('ottawa') || loc.includes('calgary') ||
      loc.includes('quebec') || loc.includes('québec') || loc.includes('ontario') ||
      loc.includes('laval') || loc.includes('edmonton') || loc.includes('winnipeg') ||
      loc.includes('alberta') || loc.includes('british columbia')) {
    return Region.CANADA;
  }

  // Australia
  if (loc.includes('australia') || loc.includes('sydney') || loc.includes('melbourne') ||
      loc.includes('brisbane') || loc.includes('perth')) {
    return Region.AUSTRALIA;
  }

  // Germany - including Portuguese/Spanish translations
  if (loc.includes('germany') || loc.includes('berlin') || loc.includes('berlim') ||
      loc.includes('munich') || loc.includes('frankfurt') || loc.includes('hamburg') ||
      loc.includes('deutschland') || loc.includes('alemanha') || loc.includes('alemania')) {
    return Region.GERMANY;
  }

  // France - including translations
  if (loc.includes('france') || loc.includes('francia') || loc.includes('frança') ||
      loc.includes('paris') || loc.includes('lyon') || loc.includes('marseille') ||
      loc.includes('toulouse') || loc.includes('nice') || loc.includes('bordeaux')) {
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

  // Brazil - including major cities, states and state codes
  if (loc.includes('brazil') || loc.includes('são paulo') || loc.includes('sao paulo') ||
      loc.includes('rio de janeiro') || loc.includes('brasil') || loc.includes('fortaleza') ||
      loc.includes('curitiba') || loc.includes('belo horizonte') || loc.includes('recife') ||
      loc.includes('salvador') || loc.includes('brasilia') || loc.includes('brasília') ||
      loc.includes('porto alegre') || loc.includes('manaus') || loc.includes('belém') ||
      loc.includes('goiânia') || loc.includes('campinas') || loc.includes('vitória') ||
      loc.includes('mato grosso') || loc.includes('cuiabá') || loc.includes('cuiaba') ||
      loc.includes('santa catarina') || loc.includes('florianópolis') || loc.includes('florianopolis') ||
      loc.includes('paraná') || loc.includes('parana') || loc.includes('ceará') || loc.includes('ceara') ||
      loc.includes('bahia') || loc.includes('pernambuco') || loc.includes('rio grande') ||
      loc.includes('minas gerais') || loc.includes('sorocaba') || loc.includes('niteroi') ||
      loc.includes('niterói') || loc.includes('santos') ||
      // Brazilian state codes (end of string or followed by comma/space)
      loc.endsWith(' sp') || loc.endsWith(' rj') || loc.endsWith(' mg') || loc.endsWith(' ce') ||
      loc.endsWith(' ba') || loc.endsWith(' pr') || loc.endsWith(' rs') || loc.endsWith(' pe') ||
      loc.endsWith('- sp') || loc.endsWith('- rj') || loc.endsWith('- mg') || loc.endsWith('- ce') ||
      loc.endsWith('- ba') || loc.endsWith('- pr') || loc.endsWith('- rs') || loc.endsWith('- pe') ||
      loc.endsWith('/sp') || loc.endsWith('/rj') || loc.endsWith('/mg') || loc.endsWith(', sp') ||
      loc.includes(' sp,') || loc.includes(' rj,') || loc.includes(', sp,') || loc.includes(', rj,')) {
    return Region.BRAZIL;
  }

  // Mexico - states, cities, and regions
  if (loc.includes('mexico') || loc.includes('méxico') || loc.includes('ciudad de méxico') ||
      loc.includes('monterrey') || loc.includes('guadalajara') || loc.includes('cdmx') ||
      loc.includes('jalisco') || loc.includes('nuevo leon') || loc.includes('nuevo león') ||
      loc.includes('tijuana') || loc.includes('cancun') || loc.includes('cancún') ||
      loc.includes('puebla') || loc.includes('queretaro') || loc.includes('querétaro') ||
      loc.includes('veracruz') || loc.includes('merida') || loc.includes('mérida') ||
      loc.includes('yucatan') || loc.includes('yucatán') || loc.includes('oaxaca') ||
      loc.includes('chiapas') || loc.includes('sonora') || loc.includes('sinaloa') ||
      loc.includes('nayarit') || loc.includes('michoacan') || loc.includes('michoacán') ||
      loc.includes('guanajuato') || loc.includes('aguascalientes') || loc.includes('zacatecas') ||
      loc.includes('quintana roo') || loc.includes('tamaulipas') || loc.includes('chihuahua') ||
      loc.includes('durango') || loc.includes('coahuila') || loc.includes('tabasco') ||
      loc.includes('leon') && !loc.includes('nuevo leon') || loc.includes('león') && !loc.includes('nuevo león')) {
    return Region.MEXICO;
  }

  // Spain - including regions and cities
  if (loc.includes('spain') || loc.includes('madrid') || loc.includes('barcelona') ||
      loc.includes('españa') || loc.includes('espanha') || loc.includes('valencia') ||
      loc.includes('sevilla') || loc.includes('seville') || loc.includes('malaga') ||
      loc.includes('málaga') || loc.includes('bilbao') || loc.includes('santander') ||
      loc.includes('catalonia') || loc.includes('catalunya') || loc.includes('andalucia') ||
      loc.includes('comunidad de madrid') || loc.includes('galicia') || loc.includes('basque')) {
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

  // Argentina - cities, provinces
  if (loc.includes('argentina') || loc.includes('buenos aires') || loc.includes('cordoba') ||
      loc.includes('córdoba') || loc.includes('rosario') || loc.includes('mendoza') ||
      loc.includes('la plata') || loc.includes('santa fe') || loc.includes('tucuman') ||
      loc.includes('tucumán') || loc.includes('mar del plata') || loc.includes('salta') ||
      loc.includes('capital federal') || loc.includes('ciudad autonoma') || loc.includes('ciudad autónoma') ||
      loc.includes('vicente lopez') || loc.includes('vicente lópez')) {
    return Region.ARGENTINA;
  }

  // Colombia - cities
  if (loc.includes('colombia') || loc.includes('bogota') || loc.includes('bogotá') ||
      loc.includes('medellín') || loc.includes('medellin') || loc.includes('cali') ||
      loc.includes('barranquilla') || loc.includes('cartagena') || loc.includes('cucuta') ||
      loc.includes('cúcuta') || loc.includes('bucaramanga') || loc.includes('pereira')) {
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

  // Peru
  if (loc.includes('peru') || loc.includes('lima')) {
    return Region.PERU;
  }

  // Venezuela
  if (loc.includes('venezuela') || loc.includes('caracas')) {
    return Region.VENEZUELA;
  }

  // Ecuador
  if (loc.includes('ecuador') || loc.includes('quito') || loc.includes('guayaquil')) {
    return Region.ECUADOR;
  }

  // Dominican Republic
  if (loc.includes('dominican') || loc.includes('santo domingo') || loc.includes('república dominicana') ||
      loc.includes('republica dominicana') || loc.includes('punta cana') ||
      loc === 'rd' || loc.startsWith('rd ') || loc.endsWith(' rd') || loc.includes(' rd ')) {
    return Region.DOMINICAN_REPUBLIC;
  }

  // Puerto Rico
  if (loc.includes('puerto rico') || loc.includes('san juan') || loc.includes('pr')) {
    return Region.PUERTO_RICO;
  }

  // Uruguay
  if (loc.includes('uruguay') || loc.includes('montevideo')) {
    return Region.URUGUAY;
  }

  // Panama
  if (loc.includes('panama') || loc.includes('panamá')) {
    return Region.PANAMA;
  }

  // Costa Rica
  if (loc.includes('costa rica') || loc.includes('san jose') || loc.includes('san josé')) {
    return Region.COSTA_RICA;
  }

  // Guatemala
  if (loc.includes('guatemala')) {
    return Region.GUATEMALA;
  }

  // El Salvador
  if (loc.includes('el salvador') || loc.includes('san salvador')) {
    return Region.EL_SALVADOR;
  }

  // Honduras
  if (loc.includes('honduras') || loc.includes('tegucigalpa') || loc.includes('san pedro sula')) {
    return Region.HONDURAS;
  }

  // Nicaragua
  if (loc.includes('nicaragua') || loc.includes('managua')) {
    return Region.NICARAGUA;
  }

  // Bolivia
  if (loc.includes('bolivia') || loc.includes('la paz') || loc.includes('santa cruz')) {
    return Region.BOLIVIA;
  }

  // Paraguay
  if (loc.includes('paraguay') || loc.includes('asuncion') || loc.includes('asunción')) {
    return Region.PARAGUAY;
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

async function fetchXProfile(handle: string): Promise<any> {
  try {
    const response = await axios.get('https://api.scrapecreators.com/v1/twitter/profile', {
      params: { handle },
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
  console.log('   X (TWITTER) PROFILE FIX');
  console.log('===========================================\n');

  // Get all X profiles that need fixing (WORLDWIDE region)
  const profiles = await prisma.streamer.findMany({
    where: { platform: 'X', region: 'WORLDWIDE' },
    orderBy: { followers: 'desc' }
    // Process ALL profiles
  });

  console.log(`Found ${profiles.length} X profiles with WORLDWIDE region\n`);

  if (profiles.length === 0) {
    console.log('No profiles need fixing!');
    await prisma.$disconnect();
    return;
  }

  let fixed = 0;
  let skipped = 0;
  let failed = 0;

  for (const profile of profiles) {
    console.log(`[${fixed + skipped + failed + 1}/${profiles.length}] @${profile.username}`);

    try {
      const data = await fetchXProfile(profile.username);

      if (!data) {
        console.log('  - Profile not found');
        failed++;
        continue;
      }

      // Get location from API response
      // API returns location as: data.legacy.location (string) or data.location.location (nested object)
      let location = '';
      if (typeof data.legacy?.location === 'string' && data.legacy.location) {
        location = data.legacy.location;
      } else if (typeof data.location?.location === 'string' && data.location.location) {
        location = data.location.location;
      }

      if (!location || location === '{}' || location === '[]') {
        console.log('  - No location in profile');
        skipped++;
        continue;
      }

      const region = parseLocationToRegion(location);

      if (region === Region.WORLDWIDE) {
        console.log(`  - Location "${location}" -> WORLDWIDE (no match)`);
        skipped++;
        continue;
      }

      // Update database
      await prisma.streamer.update({
        where: { platform_username: { platform: 'X', username: profile.username } },
        data: { region }
      });

      console.log(`  + ${location} -> ${region}`);
      fixed++;

      // Rate limiting
      await delay(100);

    } catch (error: any) {
      if (error.message === 'API_CREDITS_EXHAUSTED') {
        console.log('\n API credits exhausted! Stopping...');
        console.log(`Fixed ${fixed} profiles before running out of credits.`);
        break;
      }
      console.log('  - Error:', error.message);
      failed++;
    }
  }

  console.log('\n===========================================');
  console.log('   FIX COMPLETE');
  console.log('===========================================');
  console.log(`Fixed: ${fixed}`);
  console.log(`Skipped (no location or no match): ${skipped}`);
  console.log(`Failed: ${failed}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
