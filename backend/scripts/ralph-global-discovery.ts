/**
 * RALPH - Global Creator Discovery Script
 *
 * Discovers and populates creators from every country in the world.
 * Target: At least 1,000 creators per country.
 *
 * Strategies:
 * 1. TikTok search by country names, demonyms, hashtags
 * 2. Instagram search by location-specific keywords
 * 3. YouTube search by country
 * 4. Cross-platform discovery from existing creators
 *
 * Usage:
 *   npx ts-node scripts/ralph-global-discovery.ts                    # Full discovery
 *   npx ts-node scripts/ralph-global-discovery.ts --country=Brazil   # Single country
 *   npx ts-node scripts/ralph-global-discovery.ts --dry-run          # Preview only
 *   npx ts-node scripts/ralph-global-discovery.ts --min-followers=1000  # Filter by followers
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
import { Platform, Region, FraudStatus } from '@prisma/client';

// ==================== COUNTRY DATA ====================

interface CountryConfig {
  name: string;
  iso2: string;
  iso3: string;
  region: Region;
  searchTerms: string[];        // Names, demonyms
  hashtags: string[];           // Popular local hashtags
  languages: string[];          // Primary languages
  population: number;           // For prioritization
  influencerDensity: 'high' | 'medium' | 'low';
}

// Complete list of countries with search configurations
const COUNTRIES: CountryConfig[] = [
  // TIER 1 - High priority (large markets, high influencer density)
  { name: 'United States', iso2: 'US', iso3: 'USA', region: Region.USA, searchTerms: ['american', 'usa', 'united states'], hashtags: ['fyp', 'usa', 'american', 'trending'], languages: ['en'], population: 331000000, influencerDensity: 'high' },
  { name: 'Brazil', iso2: 'BR', iso3: 'BRA', region: Region.BRAZIL, searchTerms: ['brasileiro', 'brazil', 'brasil'], hashtags: ['brasil', 'brasileiro', 'tiktokbrasil', 'fyp'], languages: ['pt'], population: 212000000, influencerDensity: 'high' },
  { name: 'Mexico', iso2: 'MX', iso3: 'MEX', region: Region.MEXICO, searchTerms: ['mexicano', 'mexico', 'méxico'], hashtags: ['mexico', 'mexicano', 'tiktokmexicano', 'fyp'], languages: ['es'], population: 128000000, influencerDensity: 'high' },
  { name: 'Indonesia', iso2: 'ID', iso3: 'IDN', region: Region.INDONESIA, searchTerms: ['indonesian', 'indonesia'], hashtags: ['indonesia', 'fyp', 'tiktokindonesia'], languages: ['id'], population: 273000000, influencerDensity: 'high' },
  { name: 'India', iso2: 'IN', iso3: 'IND', region: Region.INDIA, searchTerms: ['indian', 'india', 'भारत'], hashtags: ['india', 'indian', 'tiktokindia', 'fyp'], languages: ['hi', 'en'], population: 1380000000, influencerDensity: 'high' },
  { name: 'United Kingdom', iso2: 'GB', iso3: 'GBR', region: Region.UK, searchTerms: ['british', 'uk', 'england', 'london'], hashtags: ['uk', 'british', 'london', 'fyp'], languages: ['en'], population: 67000000, influencerDensity: 'high' },
  { name: 'Germany', iso2: 'DE', iso3: 'DEU', region: Region.GERMANY, searchTerms: ['german', 'deutschland', 'germany'], hashtags: ['deutschland', 'german', 'fyp'], languages: ['de'], population: 83000000, influencerDensity: 'high' },
  { name: 'France', iso2: 'FR', iso3: 'FRA', region: Region.FRANCE, searchTerms: ['french', 'france', 'français'], hashtags: ['france', 'french', 'fyp', 'tiktokfrance'], languages: ['fr'], population: 67000000, influencerDensity: 'high' },
  { name: 'Japan', iso2: 'JP', iso3: 'JPN', region: Region.JAPAN, searchTerms: ['japanese', 'japan', '日本'], hashtags: ['japan', 'japanese', 'fyp', '日本'], languages: ['ja'], population: 126000000, influencerDensity: 'high' },
  { name: 'South Korea', iso2: 'KR', iso3: 'KOR', region: Region.KOREA, searchTerms: ['korean', 'korea', '한국'], hashtags: ['korea', 'korean', 'kpop', 'fyp'], languages: ['ko'], population: 51000000, influencerDensity: 'high' },
  { name: 'Spain', iso2: 'ES', iso3: 'ESP', region: Region.SPAIN, searchTerms: ['spanish', 'spain', 'españa', 'español'], hashtags: ['spain', 'españa', 'spanish', 'fyp'], languages: ['es'], population: 47000000, influencerDensity: 'high' },
  { name: 'Italy', iso2: 'IT', iso3: 'ITA', region: Region.ITALY, searchTerms: ['italian', 'italy', 'italia'], hashtags: ['italia', 'italian', 'fyp'], languages: ['it'], population: 60000000, influencerDensity: 'high' },
  { name: 'Canada', iso2: 'CA', iso3: 'CAN', region: Region.CANADA, searchTerms: ['canadian', 'canada'], hashtags: ['canada', 'canadian', 'fyp', 'toronto'], languages: ['en', 'fr'], population: 38000000, influencerDensity: 'high' },
  { name: 'Australia', iso2: 'AU', iso3: 'AUS', region: Region.AUSTRALIA, searchTerms: ['australian', 'australia', 'aussie'], hashtags: ['australia', 'aussie', 'fyp'], languages: ['en'], population: 26000000, influencerDensity: 'high' },
  { name: 'Philippines', iso2: 'PH', iso3: 'PHL', region: Region.PHILIPPINES, searchTerms: ['filipino', 'philippines', 'pinoy'], hashtags: ['philippines', 'pinoy', 'filipino', 'fyp'], languages: ['tl', 'en'], population: 110000000, influencerDensity: 'high' },
  { name: 'Thailand', iso2: 'TH', iso3: 'THA', region: Region.THAILAND, searchTerms: ['thai', 'thailand', 'ไทย'], hashtags: ['thailand', 'thai', 'fyp'], languages: ['th'], population: 70000000, influencerDensity: 'high' },
  { name: 'Vietnam', iso2: 'VN', iso3: 'VNM', region: Region.VIETNAM, searchTerms: ['vietnamese', 'vietnam', 'việt nam'], hashtags: ['vietnam', 'vietnamese', 'fyp'], languages: ['vi'], population: 97000000, influencerDensity: 'high' },
  { name: 'Turkey', iso2: 'TR', iso3: 'TUR', region: Region.OTHER, searchTerms: ['turkish', 'turkey', 'türkiye'], hashtags: ['turkey', 'türkiye', 'turkish', 'fyp'], languages: ['tr'], population: 84000000, influencerDensity: 'high' },
  { name: 'Russia', iso2: 'RU', iso3: 'RUS', region: Region.RUSSIA, searchTerms: ['russian', 'russia', 'россия'], hashtags: ['russia', 'russian', 'fyp'], languages: ['ru'], population: 144000000, influencerDensity: 'medium' },
  { name: 'Poland', iso2: 'PL', iso3: 'POL', region: Region.POLAND, searchTerms: ['polish', 'poland', 'polska'], hashtags: ['poland', 'polska', 'polish', 'fyp'], languages: ['pl'], population: 38000000, influencerDensity: 'medium' },

  // TIER 2 - Latin America (core market)
  { name: 'Argentina', iso2: 'AR', iso3: 'ARG', region: Region.ARGENTINA, searchTerms: ['argentino', 'argentina'], hashtags: ['argentina', 'argentino', 'fyp', 'buenosaires'], languages: ['es'], population: 45000000, influencerDensity: 'high' },
  { name: 'Colombia', iso2: 'CO', iso3: 'COL', region: Region.COLOMBIA, searchTerms: ['colombiano', 'colombia'], hashtags: ['colombia', 'colombiano', 'fyp', 'bogota'], languages: ['es'], population: 51000000, influencerDensity: 'high' },
  { name: 'Chile', iso2: 'CL', iso3: 'CHL', region: Region.CHILE, searchTerms: ['chileno', 'chile'], hashtags: ['chile', 'chileno', 'fyp', 'santiago'], languages: ['es'], population: 19000000, influencerDensity: 'high' },
  { name: 'Peru', iso2: 'PE', iso3: 'PER', region: Region.PERU, searchTerms: ['peruano', 'peru', 'perú'], hashtags: ['peru', 'peruano', 'fyp', 'lima'], languages: ['es'], population: 33000000, influencerDensity: 'medium' },
  { name: 'Venezuela', iso2: 'VE', iso3: 'VEN', region: Region.VENEZUELA, searchTerms: ['venezolano', 'venezuela'], hashtags: ['venezuela', 'venezolano', 'fyp'], languages: ['es'], population: 28000000, influencerDensity: 'medium' },
  { name: 'Ecuador', iso2: 'EC', iso3: 'ECU', region: Region.ECUADOR, searchTerms: ['ecuatoriano', 'ecuador'], hashtags: ['ecuador', 'ecuatoriano', 'fyp', 'quito'], languages: ['es'], population: 18000000, influencerDensity: 'medium' },
  { name: 'Bolivia', iso2: 'BO', iso3: 'BOL', region: Region.BOLIVIA, searchTerms: ['boliviano', 'bolivia'], hashtags: ['bolivia', 'boliviano', 'fyp'], languages: ['es'], population: 12000000, influencerDensity: 'low' },
  { name: 'Paraguay', iso2: 'PY', iso3: 'PRY', region: Region.PARAGUAY, searchTerms: ['paraguayo', 'paraguay'], hashtags: ['paraguay', 'paraguayo', 'fyp'], languages: ['es', 'gn'], population: 7000000, influencerDensity: 'low' },
  { name: 'Uruguay', iso2: 'UY', iso3: 'URY', region: Region.URUGUAY, searchTerms: ['uruguayo', 'uruguay'], hashtags: ['uruguay', 'uruguayo', 'fyp', 'montevideo'], languages: ['es'], population: 3500000, influencerDensity: 'medium' },
  { name: 'Costa Rica', iso2: 'CR', iso3: 'CRI', region: Region.COSTA_RICA, searchTerms: ['costarricense', 'costa rica', 'tico'], hashtags: ['costarica', 'tico', 'fyp'], languages: ['es'], population: 5100000, influencerDensity: 'medium' },
  { name: 'Panama', iso2: 'PA', iso3: 'PAN', region: Region.PANAMA, searchTerms: ['panameño', 'panama', 'panamá'], hashtags: ['panama', 'panameño', 'fyp'], languages: ['es'], population: 4400000, influencerDensity: 'medium' },
  { name: 'Guatemala', iso2: 'GT', iso3: 'GTM', region: Region.GUATEMALA, searchTerms: ['guatemalteco', 'guatemala', 'chapin'], hashtags: ['guatemala', 'chapin', 'fyp'], languages: ['es'], population: 18000000, influencerDensity: 'low' },
  { name: 'Honduras', iso2: 'HN', iso3: 'HND', region: Region.HONDURAS, searchTerms: ['hondureño', 'honduras', 'catracho'], hashtags: ['honduras', 'catracho', 'fyp'], languages: ['es'], population: 10000000, influencerDensity: 'low' },
  { name: 'El Salvador', iso2: 'SV', iso3: 'SLV', region: Region.EL_SALVADOR, searchTerms: ['salvadoreño', 'el salvador', 'guanaco'], hashtags: ['elsalvador', 'salvadoreño', 'fyp'], languages: ['es'], population: 6500000, influencerDensity: 'low' },
  { name: 'Nicaragua', iso2: 'NI', iso3: 'NIC', region: Region.NICARAGUA, searchTerms: ['nicaragüense', 'nicaragua', 'nica'], hashtags: ['nicaragua', 'nica', 'fyp'], languages: ['es'], population: 6600000, influencerDensity: 'low' },
  { name: 'Dominican Republic', iso2: 'DO', iso3: 'DOM', region: Region.DOMINICAN_REPUBLIC, searchTerms: ['dominicano', 'dominican', 'republica dominicana'], hashtags: ['dominicana', 'dominicano', 'fyp', 'santodomingo'], languages: ['es'], population: 11000000, influencerDensity: 'medium' },
  { name: 'Puerto Rico', iso2: 'PR', iso3: 'PRI', region: Region.PUERTO_RICO, searchTerms: ['puertorriqueño', 'puerto rico', 'boricua'], hashtags: ['puertorico', 'boricua', 'fyp'], languages: ['es', 'en'], population: 3200000, influencerDensity: 'high' },
  { name: 'Cuba', iso2: 'CU', iso3: 'CUB', region: Region.OTHER, searchTerms: ['cubano', 'cuba'], hashtags: ['cuba', 'cubano', 'fyp', 'habana'], languages: ['es'], population: 11000000, influencerDensity: 'low' },

  // TIER 3 - Europe
  { name: 'Portugal', iso2: 'PT', iso3: 'PRT', region: Region.PORTUGAL, searchTerms: ['portuguese', 'portugal', 'português'], hashtags: ['portugal', 'portuguese', 'fyp', 'lisboa'], languages: ['pt'], population: 10000000, influencerDensity: 'medium' },
  { name: 'Netherlands', iso2: 'NL', iso3: 'NLD', region: Region.NETHERLANDS, searchTerms: ['dutch', 'netherlands', 'nederland'], hashtags: ['netherlands', 'dutch', 'fyp', 'amsterdam'], languages: ['nl'], population: 17000000, influencerDensity: 'high' },
  { name: 'Belgium', iso2: 'BE', iso3: 'BEL', region: Region.OTHER, searchTerms: ['belgian', 'belgium', 'belgique'], hashtags: ['belgium', 'belgian', 'fyp'], languages: ['nl', 'fr'], population: 11500000, influencerDensity: 'medium' },
  { name: 'Sweden', iso2: 'SE', iso3: 'SWE', region: Region.SWEDEN, searchTerms: ['swedish', 'sweden', 'sverige'], hashtags: ['sweden', 'swedish', 'fyp'], languages: ['sv'], population: 10400000, influencerDensity: 'high' },
  { name: 'Norway', iso2: 'NO', iso3: 'NOR', region: Region.NORWAY, searchTerms: ['norwegian', 'norway', 'norge'], hashtags: ['norway', 'norwegian', 'fyp'], languages: ['no'], population: 5400000, influencerDensity: 'high' },
  { name: 'Denmark', iso2: 'DK', iso3: 'DNK', region: Region.DENMARK, searchTerms: ['danish', 'denmark', 'danmark'], hashtags: ['denmark', 'danish', 'fyp'], languages: ['da'], population: 5800000, influencerDensity: 'high' },
  { name: 'Finland', iso2: 'FI', iso3: 'FIN', region: Region.FINLAND, searchTerms: ['finnish', 'finland', 'suomi'], hashtags: ['finland', 'finnish', 'fyp'], languages: ['fi'], population: 5500000, influencerDensity: 'medium' },
  { name: 'Austria', iso2: 'AT', iso3: 'AUT', region: Region.OTHER, searchTerms: ['austrian', 'austria', 'österreich'], hashtags: ['austria', 'austrian', 'fyp', 'wien'], languages: ['de'], population: 9000000, influencerDensity: 'medium' },
  { name: 'Switzerland', iso2: 'CH', iso3: 'CHE', region: Region.OTHER, searchTerms: ['swiss', 'switzerland', 'schweiz'], hashtags: ['switzerland', 'swiss', 'fyp'], languages: ['de', 'fr', 'it'], population: 8700000, influencerDensity: 'high' },
  { name: 'Ireland', iso2: 'IE', iso3: 'IRL', region: Region.OTHER, searchTerms: ['irish', 'ireland'], hashtags: ['ireland', 'irish', 'fyp', 'dublin'], languages: ['en', 'ga'], population: 5000000, influencerDensity: 'high' },
  { name: 'Greece', iso2: 'GR', iso3: 'GRC', region: Region.OTHER, searchTerms: ['greek', 'greece', 'ελλάδα'], hashtags: ['greece', 'greek', 'fyp'], languages: ['el'], population: 10400000, influencerDensity: 'medium' },
  { name: 'Czech Republic', iso2: 'CZ', iso3: 'CZE', region: Region.OTHER, searchTerms: ['czech', 'czechia', 'česko'], hashtags: ['czechia', 'czech', 'fyp', 'prague'], languages: ['cs'], population: 10700000, influencerDensity: 'medium' },
  { name: 'Romania', iso2: 'RO', iso3: 'ROU', region: Region.OTHER, searchTerms: ['romanian', 'romania', 'română'], hashtags: ['romania', 'romanian', 'fyp'], languages: ['ro'], population: 19000000, influencerDensity: 'medium' },
  { name: 'Hungary', iso2: 'HU', iso3: 'HUN', region: Region.OTHER, searchTerms: ['hungarian', 'hungary', 'magyarország'], hashtags: ['hungary', 'hungarian', 'fyp'], languages: ['hu'], population: 9700000, influencerDensity: 'medium' },
  { name: 'Ukraine', iso2: 'UA', iso3: 'UKR', region: Region.OTHER, searchTerms: ['ukrainian', 'ukraine', 'україна'], hashtags: ['ukraine', 'ukrainian', 'fyp'], languages: ['uk'], population: 41000000, influencerDensity: 'medium' },

  // TIER 4 - Asia Pacific
  { name: 'Malaysia', iso2: 'MY', iso3: 'MYS', region: Region.MALAYSIA, searchTerms: ['malaysian', 'malaysia'], hashtags: ['malaysia', 'malaysian', 'fyp'], languages: ['ms', 'en'], population: 32000000, influencerDensity: 'high' },
  { name: 'Singapore', iso2: 'SG', iso3: 'SGP', region: Region.SINGAPORE, searchTerms: ['singaporean', 'singapore'], hashtags: ['singapore', 'singaporean', 'fyp'], languages: ['en', 'zh', 'ms'], population: 5900000, influencerDensity: 'high' },
  { name: 'China', iso2: 'CN', iso3: 'CHN', region: Region.CHINA, searchTerms: ['chinese', 'china', '中国'], hashtags: ['china', 'chinese', 'fyp'], languages: ['zh'], population: 1400000000, influencerDensity: 'high' },
  { name: 'Taiwan', iso2: 'TW', iso3: 'TWN', region: Region.OTHER, searchTerms: ['taiwanese', 'taiwan', '台灣'], hashtags: ['taiwan', 'taiwanese', 'fyp'], languages: ['zh'], population: 24000000, influencerDensity: 'high' },
  { name: 'Hong Kong', iso2: 'HK', iso3: 'HKG', region: Region.OTHER, searchTerms: ['hong kong', 'hongkonger', '香港'], hashtags: ['hongkong', 'fyp'], languages: ['zh', 'en'], population: 7500000, influencerDensity: 'high' },
  { name: 'New Zealand', iso2: 'NZ', iso3: 'NZL', region: Region.NEW_ZEALAND, searchTerms: ['new zealand', 'kiwi', 'nz'], hashtags: ['newzealand', 'nz', 'kiwi', 'fyp'], languages: ['en'], population: 5100000, influencerDensity: 'high' },
  { name: 'Pakistan', iso2: 'PK', iso3: 'PAK', region: Region.OTHER, searchTerms: ['pakistani', 'pakistan'], hashtags: ['pakistan', 'pakistani', 'fyp'], languages: ['ur', 'en'], population: 220000000, influencerDensity: 'medium' },
  { name: 'Bangladesh', iso2: 'BD', iso3: 'BGD', region: Region.OTHER, searchTerms: ['bangladeshi', 'bangladesh'], hashtags: ['bangladesh', 'bangladeshi', 'fyp'], languages: ['bn'], population: 165000000, influencerDensity: 'medium' },
  { name: 'Sri Lanka', iso2: 'LK', iso3: 'LKA', region: Region.OTHER, searchTerms: ['sri lankan', 'sri lanka'], hashtags: ['srilanka', 'fyp'], languages: ['si', 'ta'], population: 21000000, influencerDensity: 'low' },
  { name: 'Nepal', iso2: 'NP', iso3: 'NPL', region: Region.OTHER, searchTerms: ['nepali', 'nepal'], hashtags: ['nepal', 'nepali', 'fyp'], languages: ['ne'], population: 30000000, influencerDensity: 'low' },

  // TIER 5 - Middle East & Africa
  { name: 'United Arab Emirates', iso2: 'AE', iso3: 'ARE', region: Region.OTHER, searchTerms: ['emirati', 'uae', 'dubai'], hashtags: ['uae', 'dubai', 'emirates', 'fyp'], languages: ['ar', 'en'], population: 10000000, influencerDensity: 'high' },
  { name: 'Saudi Arabia', iso2: 'SA', iso3: 'SAU', region: Region.OTHER, searchTerms: ['saudi', 'saudi arabia'], hashtags: ['saudiarabia', 'saudi', 'fyp'], languages: ['ar'], population: 35000000, influencerDensity: 'high' },
  { name: 'Egypt', iso2: 'EG', iso3: 'EGY', region: Region.OTHER, searchTerms: ['egyptian', 'egypt', 'مصر'], hashtags: ['egypt', 'egyptian', 'fyp'], languages: ['ar'], population: 102000000, influencerDensity: 'high' },
  { name: 'Israel', iso2: 'IL', iso3: 'ISR', region: Region.OTHER, searchTerms: ['israeli', 'israel'], hashtags: ['israel', 'israeli', 'fyp'], languages: ['he', 'ar'], population: 9300000, influencerDensity: 'high' },
  { name: 'Morocco', iso2: 'MA', iso3: 'MAR', region: Region.OTHER, searchTerms: ['moroccan', 'morocco', 'المغرب'], hashtags: ['morocco', 'moroccan', 'fyp'], languages: ['ar', 'fr'], population: 37000000, influencerDensity: 'medium' },
  { name: 'Algeria', iso2: 'DZ', iso3: 'DZA', region: Region.OTHER, searchTerms: ['algerian', 'algeria', 'الجزائر'], hashtags: ['algeria', 'algerian', 'fyp'], languages: ['ar', 'fr'], population: 44000000, influencerDensity: 'medium' },
  { name: 'Tunisia', iso2: 'TN', iso3: 'TUN', region: Region.OTHER, searchTerms: ['tunisian', 'tunisia', 'تونس'], hashtags: ['tunisia', 'tunisian', 'fyp'], languages: ['ar', 'fr'], population: 12000000, influencerDensity: 'medium' },
  { name: 'South Africa', iso2: 'ZA', iso3: 'ZAF', region: Region.OTHER, searchTerms: ['south african', 'south africa'], hashtags: ['southafrica', 'sa', 'fyp'], languages: ['en', 'af', 'zu'], population: 60000000, influencerDensity: 'medium' },
  { name: 'Nigeria', iso2: 'NG', iso3: 'NGA', region: Region.OTHER, searchTerms: ['nigerian', 'nigeria'], hashtags: ['nigeria', 'nigerian', 'fyp', 'naija'], languages: ['en'], population: 206000000, influencerDensity: 'high' },
  { name: 'Kenya', iso2: 'KE', iso3: 'KEN', region: Region.OTHER, searchTerms: ['kenyan', 'kenya'], hashtags: ['kenya', 'kenyan', 'fyp', 'nairobi'], languages: ['en', 'sw'], population: 54000000, influencerDensity: 'medium' },
  { name: 'Ghana', iso2: 'GH', iso3: 'GHA', region: Region.OTHER, searchTerms: ['ghanaian', 'ghana'], hashtags: ['ghana', 'ghanaian', 'fyp'], languages: ['en'], population: 31000000, influencerDensity: 'medium' },
  { name: 'Ethiopia', iso2: 'ET', iso3: 'ETH', region: Region.OTHER, searchTerms: ['ethiopian', 'ethiopia'], hashtags: ['ethiopia', 'ethiopian', 'fyp'], languages: ['am'], population: 115000000, influencerDensity: 'low' },
  { name: 'Tanzania', iso2: 'TZ', iso3: 'TZA', region: Region.OTHER, searchTerms: ['tanzanian', 'tanzania'], hashtags: ['tanzania', 'tanzanian', 'fyp'], languages: ['sw', 'en'], population: 60000000, influencerDensity: 'low' },
  { name: 'Uganda', iso2: 'UG', iso3: 'UGA', region: Region.OTHER, searchTerms: ['ugandan', 'uganda'], hashtags: ['uganda', 'ugandan', 'fyp'], languages: ['en', 'sw'], population: 46000000, influencerDensity: 'low' },
  { name: 'Cameroon', iso2: 'CM', iso3: 'CMR', region: Region.OTHER, searchTerms: ['cameroonian', 'cameroon'], hashtags: ['cameroon', 'cameroonian', 'fyp'], languages: ['fr', 'en'], population: 27000000, influencerDensity: 'low' },
  { name: 'Senegal', iso2: 'SN', iso3: 'SEN', region: Region.OTHER, searchTerms: ['senegalese', 'senegal'], hashtags: ['senegal', 'senegalese', 'fyp'], languages: ['fr'], population: 17000000, influencerDensity: 'low' },
  { name: 'Ivory Coast', iso2: 'CI', iso3: 'CIV', region: Region.OTHER, searchTerms: ['ivorian', 'ivory coast', 'cote divoire'], hashtags: ['cotedivoire', 'ivorian', 'fyp'], languages: ['fr'], population: 26000000, influencerDensity: 'low' },
  { name: 'Angola', iso2: 'AO', iso3: 'AGO', region: Region.OTHER, searchTerms: ['angolan', 'angola'], hashtags: ['angola', 'angolan', 'fyp'], languages: ['pt'], population: 33000000, influencerDensity: 'low' },
  { name: 'Mozambique', iso2: 'MZ', iso3: 'MOZ', region: Region.OTHER, searchTerms: ['mozambican', 'mozambique', 'moçambique'], hashtags: ['mozambique', 'fyp'], languages: ['pt'], population: 31000000, influencerDensity: 'low' },

  // Additional countries
  { name: 'Iraq', iso2: 'IQ', iso3: 'IRQ', region: Region.OTHER, searchTerms: ['iraqi', 'iraq', 'العراق'], hashtags: ['iraq', 'iraqi', 'fyp'], languages: ['ar'], population: 41000000, influencerDensity: 'medium' },
  { name: 'Jordan', iso2: 'JO', iso3: 'JOR', region: Region.OTHER, searchTerms: ['jordanian', 'jordan', 'الأردن'], hashtags: ['jordan', 'jordanian', 'fyp'], languages: ['ar'], population: 10000000, influencerDensity: 'medium' },
  { name: 'Lebanon', iso2: 'LB', iso3: 'LBN', region: Region.OTHER, searchTerms: ['lebanese', 'lebanon', 'لبنان'], hashtags: ['lebanon', 'lebanese', 'fyp'], languages: ['ar', 'fr'], population: 7000000, influencerDensity: 'high' },
  { name: 'Kuwait', iso2: 'KW', iso3: 'KWT', region: Region.OTHER, searchTerms: ['kuwaiti', 'kuwait', 'الكويت'], hashtags: ['kuwait', 'kuwaiti', 'fyp'], languages: ['ar'], population: 4300000, influencerDensity: 'high' },
  { name: 'Qatar', iso2: 'QA', iso3: 'QAT', region: Region.OTHER, searchTerms: ['qatari', 'qatar', 'قطر'], hashtags: ['qatar', 'qatari', 'fyp'], languages: ['ar'], population: 2900000, influencerDensity: 'high' },
  { name: 'Bahrain', iso2: 'BH', iso3: 'BHR', region: Region.OTHER, searchTerms: ['bahraini', 'bahrain', 'البحرين'], hashtags: ['bahrain', 'bahraini', 'fyp'], languages: ['ar'], population: 1700000, influencerDensity: 'high' },
  { name: 'Oman', iso2: 'OM', iso3: 'OMN', region: Region.OTHER, searchTerms: ['omani', 'oman', 'عمان'], hashtags: ['oman', 'omani', 'fyp'], languages: ['ar'], population: 5100000, influencerDensity: 'medium' },
  { name: 'Myanmar', iso2: 'MM', iso3: 'MMR', region: Region.OTHER, searchTerms: ['burmese', 'myanmar', 'မြန်မာ'], hashtags: ['myanmar', 'burmese', 'fyp'], languages: ['my'], population: 54000000, influencerDensity: 'low' },
  { name: 'Cambodia', iso2: 'KH', iso3: 'KHM', region: Region.OTHER, searchTerms: ['cambodian', 'cambodia', 'khmer'], hashtags: ['cambodia', 'khmer', 'fyp'], languages: ['km'], population: 17000000, influencerDensity: 'low' },
  { name: 'Laos', iso2: 'LA', iso3: 'LAO', region: Region.OTHER, searchTerms: ['laotian', 'laos'], hashtags: ['laos', 'laotian', 'fyp'], languages: ['lo'], population: 7300000, influencerDensity: 'low' },
  { name: 'Mongolia', iso2: 'MN', iso3: 'MNG', region: Region.OTHER, searchTerms: ['mongolian', 'mongolia'], hashtags: ['mongolia', 'mongolian', 'fyp'], languages: ['mn'], population: 3300000, influencerDensity: 'low' },
  { name: 'Kazakhstan', iso2: 'KZ', iso3: 'KAZ', region: Region.OTHER, searchTerms: ['kazakh', 'kazakhstan'], hashtags: ['kazakhstan', 'kazakh', 'fyp'], languages: ['kk', 'ru'], population: 19000000, influencerDensity: 'medium' },
  { name: 'Uzbekistan', iso2: 'UZ', iso3: 'UZB', region: Region.OTHER, searchTerms: ['uzbek', 'uzbekistan'], hashtags: ['uzbekistan', 'uzbek', 'fyp'], languages: ['uz'], population: 34000000, influencerDensity: 'low' },
  { name: 'Azerbaijan', iso2: 'AZ', iso3: 'AZE', region: Region.OTHER, searchTerms: ['azerbaijani', 'azerbaijan'], hashtags: ['azerbaijan', 'azerbaijani', 'fyp'], languages: ['az'], population: 10000000, influencerDensity: 'medium' },
  { name: 'Georgia', iso2: 'GE', iso3: 'GEO', region: Region.OTHER, searchTerms: ['georgian', 'georgia', 'საქართველო'], hashtags: ['georgia', 'georgian', 'fyp', 'tbilisi'], languages: ['ka'], population: 3700000, influencerDensity: 'medium' },
  { name: 'Armenia', iso2: 'AM', iso3: 'ARM', region: Region.OTHER, searchTerms: ['armenian', 'armenia', 'հայաստdelays'], hashtags: ['armenia', 'armenian', 'fyp'], languages: ['hy'], population: 3000000, influencerDensity: 'medium' },
  { name: 'Serbia', iso2: 'RS', iso3: 'SRB', region: Region.OTHER, searchTerms: ['serbian', 'serbia', 'србија'], hashtags: ['serbia', 'serbian', 'fyp'], languages: ['sr'], population: 6900000, influencerDensity: 'medium' },
  { name: 'Croatia', iso2: 'HR', iso3: 'HRV', region: Region.OTHER, searchTerms: ['croatian', 'croatia', 'hrvatska'], hashtags: ['croatia', 'croatian', 'fyp'], languages: ['hr'], population: 4000000, influencerDensity: 'medium' },
  { name: 'Slovenia', iso2: 'SI', iso3: 'SVN', region: Region.OTHER, searchTerms: ['slovenian', 'slovenia', 'slovenija'], hashtags: ['slovenia', 'slovenian', 'fyp'], languages: ['sl'], population: 2100000, influencerDensity: 'medium' },
  { name: 'Slovakia', iso2: 'SK', iso3: 'SVK', region: Region.OTHER, searchTerms: ['slovak', 'slovakia', 'slovensko'], hashtags: ['slovakia', 'slovak', 'fyp'], languages: ['sk'], population: 5500000, influencerDensity: 'medium' },
  { name: 'Bulgaria', iso2: 'BG', iso3: 'BGR', region: Region.OTHER, searchTerms: ['bulgarian', 'bulgaria', 'българия'], hashtags: ['bulgaria', 'bulgarian', 'fyp'], languages: ['bg'], population: 6900000, influencerDensity: 'medium' },
  { name: 'Lithuania', iso2: 'LT', iso3: 'LTU', region: Region.OTHER, searchTerms: ['lithuanian', 'lithuania', 'lietuva'], hashtags: ['lithuania', 'lithuanian', 'fyp'], languages: ['lt'], population: 2800000, influencerDensity: 'medium' },
  { name: 'Latvia', iso2: 'LV', iso3: 'LVA', region: Region.OTHER, searchTerms: ['latvian', 'latvia', 'latvija'], hashtags: ['latvia', 'latvian', 'fyp'], languages: ['lv'], population: 1900000, influencerDensity: 'medium' },
  { name: 'Estonia', iso2: 'EE', iso3: 'EST', region: Region.OTHER, searchTerms: ['estonian', 'estonia', 'eesti'], hashtags: ['estonia', 'estonian', 'fyp'], languages: ['et'], population: 1300000, influencerDensity: 'medium' },
  { name: 'Iceland', iso2: 'IS', iso3: 'ISL', region: Region.OTHER, searchTerms: ['icelandic', 'iceland', 'ísland'], hashtags: ['iceland', 'icelandic', 'fyp'], languages: ['is'], population: 370000, influencerDensity: 'high' },
  { name: 'Luxembourg', iso2: 'LU', iso3: 'LUX', region: Region.OTHER, searchTerms: ['luxembourgish', 'luxembourg'], hashtags: ['luxembourg', 'fyp'], languages: ['lb', 'fr', 'de'], population: 640000, influencerDensity: 'high' },
  { name: 'Malta', iso2: 'MT', iso3: 'MLT', region: Region.OTHER, searchTerms: ['maltese', 'malta'], hashtags: ['malta', 'maltese', 'fyp'], languages: ['mt', 'en'], population: 520000, influencerDensity: 'high' },
  { name: 'Cyprus', iso2: 'CY', iso3: 'CYP', region: Region.OTHER, searchTerms: ['cypriot', 'cyprus', 'κύπρος'], hashtags: ['cyprus', 'cypriot', 'fyp'], languages: ['el', 'tr'], population: 1200000, influencerDensity: 'high' },
  { name: 'Jamaica', iso2: 'JM', iso3: 'JAM', region: Region.OTHER, searchTerms: ['jamaican', 'jamaica'], hashtags: ['jamaica', 'jamaican', 'fyp'], languages: ['en'], population: 3000000, influencerDensity: 'high' },
  { name: 'Trinidad and Tobago', iso2: 'TT', iso3: 'TTO', region: Region.OTHER, searchTerms: ['trinidadian', 'trinidad'], hashtags: ['trinidad', 'trinidadian', 'fyp'], languages: ['en'], population: 1400000, influencerDensity: 'medium' },
  { name: 'Bahamas', iso2: 'BS', iso3: 'BHS', region: Region.OTHER, searchTerms: ['bahamian', 'bahamas'], hashtags: ['bahamas', 'bahamian', 'fyp'], languages: ['en'], population: 400000, influencerDensity: 'high' },
  { name: 'Barbados', iso2: 'BB', iso3: 'BRB', region: Region.OTHER, searchTerms: ['barbadian', 'barbados', 'bajan'], hashtags: ['barbados', 'bajan', 'fyp'], languages: ['en'], population: 290000, influencerDensity: 'high' },
  { name: 'Haiti', iso2: 'HT', iso3: 'HTI', region: Region.OTHER, searchTerms: ['haitian', 'haiti'], hashtags: ['haiti', 'haitian', 'fyp'], languages: ['fr', 'ht'], population: 11000000, influencerDensity: 'low' },
  { name: 'Belize', iso2: 'BZ', iso3: 'BLZ', region: Region.OTHER, searchTerms: ['belizean', 'belize'], hashtags: ['belize', 'belizean', 'fyp'], languages: ['en'], population: 420000, influencerDensity: 'low' },
  { name: 'Guyana', iso2: 'GY', iso3: 'GUY', region: Region.OTHER, searchTerms: ['guyanese', 'guyana'], hashtags: ['guyana', 'guyanese', 'fyp'], languages: ['en'], population: 790000, influencerDensity: 'low' },
  { name: 'Suriname', iso2: 'SR', iso3: 'SUR', region: Region.OTHER, searchTerms: ['surinamese', 'suriname'], hashtags: ['suriname', 'surinamese', 'fyp'], languages: ['nl'], population: 590000, influencerDensity: 'low' },
  { name: 'Fiji', iso2: 'FJ', iso3: 'FJI', region: Region.OTHER, searchTerms: ['fijian', 'fiji'], hashtags: ['fiji', 'fijian', 'fyp'], languages: ['en', 'fj'], population: 900000, influencerDensity: 'low' },
  { name: 'Papua New Guinea', iso2: 'PG', iso3: 'PNG', region: Region.OTHER, searchTerms: ['papua new guinea', 'png'], hashtags: ['papuanewguinea', 'fyp'], languages: ['en'], population: 9000000, influencerDensity: 'low' },
];

// Gaming and content-specific hashtags to combine with country
const CONTENT_HASHTAGS = [
  'gaming', 'gamer', 'streamer', 'twitch', 'kick',
  'slots', 'casino', 'betting', 'poker',
  'esports', 'valorant', 'fortnite', 'minecraft',
  'influencer', 'creator', 'content', 'vlog',
  'fitness', 'lifestyle', 'comedy', 'music'
];

// ==================== UTILITY FUNCTIONS ====================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function mapToRegion(countryCode: string): Region {
  const country = COUNTRIES.find(c => c.iso2 === countryCode || c.iso3 === countryCode);
  return country?.region || Region.OTHER;
}

// ==================== DISCOVERY FUNCTIONS ====================

interface DiscoveredCreator {
  platform: Platform;
  username: string;
  displayName?: string;
  profileUrl: string;
  avatarUrl?: string;
  followers: number;
  bio?: string;
  country: CountryConfig;
}

async function searchTikTokForCountry(country: CountryConfig, maxResults: number = 100): Promise<DiscoveredCreator[]> {
  const discovered: DiscoveredCreator[] = [];
  const seenUsernames = new Set<string>();

  // Search by country-specific terms
  for (const term of country.searchTerms.slice(0, 3)) {
    try {
      console.log(`    🔍 Searching TikTok: "${term}"...`);
      const results = await scrapeCreatorsService.searchTikTokUsers(term);

      for (const result of results) {
        const info = result.user_info;
        if (!info?.unique_id || seenUsernames.has(info.unique_id.toLowerCase())) continue;

        seenUsernames.add(info.unique_id.toLowerCase());
        discovered.push({
          platform: Platform.TIKTOK,
          username: info.unique_id,
          displayName: info.nickname,
          profileUrl: `https://tiktok.com/@${info.unique_id}`,
          avatarUrl: info.avatar_168x168?.url_list?.[0],
          followers: info.follower_count || 0,
          country,
        });
      }

      await delay(500); // Rate limiting
    } catch (error: any) {
      console.log(`    ⚠️  TikTok search error: ${error.message}`);
    }

    if (discovered.length >= maxResults) break;
  }

  // Search by country hashtags
  for (const hashtag of country.hashtags.slice(0, 2)) {
    if (discovered.length >= maxResults) break;

    try {
      console.log(`    #️⃣  Searching TikTok hashtag: #${hashtag}...`);
      const videos = await scrapeCreatorsService.searchTikTokByHashtag(hashtag);

      for (const video of videos) {
        const author = video.author || video.user;
        if (!author?.uniqueId || seenUsernames.has(author.uniqueId.toLowerCase())) continue;

        seenUsernames.add(author.uniqueId.toLowerCase());
        discovered.push({
          platform: Platform.TIKTOK,
          username: author.uniqueId,
          displayName: author.nickname,
          profileUrl: `https://tiktok.com/@${author.uniqueId}`,
          avatarUrl: author.avatarLarger || author.avatarMedium,
          followers: author.followerCount || 0,
          country,
        });
      }

      await delay(500);
    } catch (error: any) {
      console.log(`    ⚠️  TikTok hashtag error: ${error.message}`);
    }
  }

  return discovered.slice(0, maxResults);
}

async function searchInstagramForCountry(country: CountryConfig, maxResults: number = 100): Promise<DiscoveredCreator[]> {
  const discovered: DiscoveredCreator[] = [];
  const seenUsernames = new Set<string>();

  // Search by country-specific terms
  for (const term of country.searchTerms.slice(0, 3)) {
    try {
      console.log(`    🔍 Searching Instagram: "${term}"...`);
      const results = await scrapeCreatorsService.searchInstagramUsers(term);

      for (const user of results) {
        if (!user?.username || seenUsernames.has(user.username.toLowerCase())) continue;

        seenUsernames.add(user.username.toLowerCase());
        discovered.push({
          platform: Platform.INSTAGRAM,
          username: user.username,
          displayName: user.full_name,
          profileUrl: `https://instagram.com/${user.username}`,
          avatarUrl: user.profile_pic_url,
          followers: user.follower_count || 0,
          country,
        });
      }

      await delay(500);
    } catch (error: any) {
      console.log(`    ⚠️  Instagram search error: ${error.message}`);
    }

    if (discovered.length >= maxResults) break;
  }

  // Search by reels with country keywords
  for (const term of [`${country.name} creator`, `${country.searchTerms[0]} influencer`].slice(0, 2)) {
    if (discovered.length >= maxResults) break;

    try {
      console.log(`    🎬 Searching Instagram Reels: "${term}"...`);
      const reels = await scrapeCreatorsService.searchInstagramReels(term);

      for (const reel of reels) {
        const user = reel.user || reel.owner;
        if (!user?.username || seenUsernames.has(user.username.toLowerCase())) continue;

        seenUsernames.add(user.username.toLowerCase());
        discovered.push({
          platform: Platform.INSTAGRAM,
          username: user.username,
          displayName: user.full_name,
          profileUrl: `https://instagram.com/${user.username}`,
          avatarUrl: user.profile_pic_url,
          followers: user.follower_count || 0,
          country,
        });
      }

      await delay(500);
    } catch (error: any) {
      console.log(`    ⚠️  Instagram Reels error: ${error.message}`);
    }
  }

  return discovered.slice(0, maxResults);
}

async function discoverForCountry(country: CountryConfig, targetCount: number): Promise<DiscoveredCreator[]> {
  console.log(`\n🌍 Discovering creators for ${country.name} (${country.iso2})...`);

  const allDiscovered: DiscoveredCreator[] = [];

  // TikTok discovery
  const tiktokCreators = await searchTikTokForCountry(country, Math.ceil(targetCount * 0.4));
  console.log(`    ✅ Found ${tiktokCreators.length} TikTok creators`);
  allDiscovered.push(...tiktokCreators);

  // Instagram discovery
  const instagramCreators = await searchInstagramForCountry(country, Math.ceil(targetCount * 0.4));
  console.log(`    ✅ Found ${instagramCreators.length} Instagram creators`);
  allDiscovered.push(...instagramCreators);

  return allDiscovered;
}

// ==================== DATABASE FUNCTIONS ====================

async function saveDiscoveredCreators(creators: DiscoveredCreator[]): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  for (const creator of creators) {
    try {
      // Check if already exists
      const existing = await db.streamer.findFirst({
        where: {
          platform: creator.platform,
          username: creator.username.toLowerCase(),
        }
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Create new record
      await db.streamer.create({
        data: {
          platform: creator.platform,
          username: creator.username.toLowerCase(),
          displayName: creator.displayName || creator.username,
          profileUrl: creator.profileUrl,
          avatarUrl: creator.avatarUrl,
          followers: creator.followers,
          region: creator.country.region,
          inferredCountry: creator.country.iso2,
          inferredCountrySource: creator.platform,
          language: creator.country.languages[0] || 'en',
          tags: [],
          usesCamera: false,
          isVtuber: false,
          fraudCheck: FraudStatus.PENDING_REVIEW,
          discoveredVia: `ralph:${creator.country.iso2.toLowerCase()}`,
        }
      });
      created++;
    } catch (error: any) {
      // Likely duplicate, skip
      skipped++;
    }
  }

  return { created, skipped };
}

async function getCurrentCountByCountry(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  // By region
  const byRegion = await db.streamer.groupBy({
    by: ['region'],
    _count: true,
  });

  for (const r of byRegion) {
    counts[r.region] = r._count;
  }

  // By inferred country
  const byCountry = await db.streamer.groupBy({
    by: ['inferredCountry'],
    _count: true,
    where: { inferredCountry: { not: null } }
  });

  for (const c of byCountry) {
    if (c.inferredCountry) {
      counts[c.inferredCountry] = (counts[c.inferredCountry] || 0) + c._count;
    }
  }

  return counts;
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const countryArg = args.find(a => a.startsWith('--country='));
  const minFollowersArg = args.find(a => a.startsWith('--min-followers='));
  const targetArg = args.find(a => a.startsWith('--target='));

  const targetCountry = countryArg ? countryArg.split('=')[1] : null;
  const minFollowers = minFollowersArg ? parseInt(minFollowersArg.split('=')[1]) : 0;
  const targetPerCountry = targetArg ? parseInt(targetArg.split('=')[1]) : 1000;

  console.log('========================================');
  console.log('🦸 RALPH - Global Creator Discovery');
  console.log('========================================');
  console.log(`Target per country: ${targetPerCountry.toLocaleString()}`);
  console.log(`Min followers filter: ${minFollowers.toLocaleString()}`);
  if (dryRun) console.log('🧪 DRY RUN MODE - No database changes');
  console.log('');

  // Get current counts
  console.log('📊 Checking current database counts...');
  const currentCounts = await getCurrentCountByCountry();

  // Filter countries to process
  let countriesToProcess = COUNTRIES;
  if (targetCountry) {
    countriesToProcess = COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(targetCountry.toLowerCase()) ||
      c.iso2.toLowerCase() === targetCountry.toLowerCase() ||
      c.iso3.toLowerCase() === targetCountry.toLowerCase()
    );
    if (countriesToProcess.length === 0) {
      console.log(`❌ Country not found: ${targetCountry}`);
      await db.$disconnect();
      return;
    }
  }

  // Sort by priority (countries with fewer creators first)
  countriesToProcess.sort((a, b) => {
    const countA = currentCounts[a.region] || currentCounts[a.iso2] || 0;
    const countB = currentCounts[b.region] || currentCounts[b.iso2] || 0;
    return countA - countB;
  });

  // Process countries
  let totalCreated = 0;
  let totalSkipped = 0;
  const countriesProcessed: string[] = [];

  for (const country of countriesToProcess) {
    const currentCount = currentCounts[country.region] || currentCounts[country.iso2] || 0;
    const needed = Math.max(0, targetPerCountry - currentCount);

    if (needed === 0) {
      console.log(`✅ ${country.name}: Already has ${currentCount.toLocaleString()} creators (target met)`);
      continue;
    }

    console.log(`\n📍 ${country.name}: ${currentCount.toLocaleString()} creators, need ${needed.toLocaleString()} more`);

    // Discover creators
    const discovered = await discoverForCountry(country, Math.min(needed, 500)); // Cap at 500 per run

    // Filter by followers if specified
    const filtered = minFollowers > 0
      ? discovered.filter(c => c.followers >= minFollowers)
      : discovered;

    console.log(`    📋 Discovered ${discovered.length} creators (${filtered.length} after filter)`);

    if (!dryRun && filtered.length > 0) {
      const result = await saveDiscoveredCreators(filtered);
      totalCreated += result.created;
      totalSkipped += result.skipped;
      console.log(`    💾 Saved ${result.created} new, ${result.skipped} already existed`);
    }

    countriesProcessed.push(country.name);

    // Rate limiting between countries
    await delay(1000);
  }

  // Final summary
  console.log('\n========================================');
  console.log('📊 RALPH DISCOVERY COMPLETE');
  console.log('========================================');
  console.log(`Countries processed: ${countriesProcessed.length}`);
  console.log(`Total created: ${totalCreated.toLocaleString()}`);
  console.log(`Total skipped (duplicates): ${totalSkipped.toLocaleString()}`);

  // Show updated counts
  if (!dryRun) {
    console.log('\n📈 Updated counts by region:');
    const newCounts = await getCurrentCountByCountry();
    const sortedRegions = Object.entries(newCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    for (const [region, count] of sortedRegions) {
      const prev = currentCounts[region] || 0;
      const diff = count - prev;
      const diffStr = diff > 0 ? ` (+${diff})` : '';
      console.log(`  ${region}: ${count.toLocaleString()}${diffStr}`);
    }
  }

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error('❌ Error:', e);
  await db.$disconnect();
  process.exit(1);
});
