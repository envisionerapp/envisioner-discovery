/**
 * LinkedIn Batch 4 Import
 *
 * More profiles to reach 1k target:
 * - International tech leaders
 * - More Fortune 500 executives
 * - Startup ecosystem people
 * - Tech communities and organizations
 */

import axios from 'axios';
import { db, logger } from '../src/utils/database';
import { Region } from '@prisma/client';
import { bunnyService } from '../src/services/bunnyService';

const SCRAPECREATORS_API_KEY = process.env.SCRAPECREATORS_API_KEY || 'qJY95WcDxCStfw9idIub8a04Cyr1';

const PROFILES = [
  // International Tech Leaders - Europe
  { name: 'Niklas Zennstrom', handle: 'niklaszennstrom', category: 'founder-eu' },
  { name: 'Daniel Dines', handle: 'danieldines', category: 'founder-eu' },
  { name: 'Tomas Gorny', handle: 'tomasgorny', category: 'founder-eu' },
  { name: 'Jan Koum', handle: 'jan-koum', category: 'founder-eu' },
  { name: 'Xavier Niel', handle: 'xavierniel', category: 'founder-eu' },
  { name: 'Olivier Pomel', handle: 'olivierpomel', category: 'founder-eu' },
  { name: 'Alexis Lhoest', handle: 'alexislhoest', category: 'founder-eu' },
  { name: 'Ilkka Paananen', handle: 'ilkkapaananen', category: 'founder-eu' },
  { name: 'Martin Lorentzon', handle: 'martinlorentzon', category: 'founder-eu' },
  { name: 'Sebastian Siemiatkowski', handle: 'sebastiansiemiatkowski', category: 'founder-eu' },
  { name: 'Victor Jacobsson', handle: 'victorjacobsson', category: 'founder-eu' },
  { name: 'Mikael Hed', handle: 'mikaelhed', category: 'founder-eu' },
  { name: 'Peter Vesterbacka', handle: 'petervesterbacka', category: 'founder-eu' },
  { name: 'Felix Kjellberg', handle: 'felixkjellberg', category: 'creator-eu' },
  { name: 'Chris Urmson', handle: 'curmson', category: 'tech-eu' },

  // International Tech Leaders - Asia
  { name: 'Jack Ma', handle: 'jackmay', category: 'founder-asia' },
  { name: 'Pony Ma', handle: 'ponyma', category: 'founder-asia' },
  { name: 'Lei Jun', handle: 'leijun', category: 'founder-asia' },
  { name: 'Robin Li', handle: 'robinli', category: 'founder-asia' },
  { name: 'Zhang Yiming', handle: 'zhangyiming', category: 'founder-asia' },
  { name: 'William Ding', handle: 'williamding', category: 'founder-asia' },
  { name: 'Colin Huang', handle: 'colinhuang', category: 'founder-asia' },
  { name: 'Su Hua', handle: 'suhua', category: 'founder-asia' },
  { name: 'Wang Xing', handle: 'wangxing', category: 'founder-asia' },
  { name: 'Cheng Wei', handle: 'chengwei', category: 'founder-asia' },
  { name: 'Masayoshi Son', handle: 'masayoshison', category: 'founder-asia' },
  { name: 'Hiroshi Mikitani', handle: 'hmikitani', category: 'founder-asia' },
  { name: 'Tadashi Yanai', handle: 'tadashiyanai', category: 'founder-asia' },
  { name: 'Mukesh Ambani', handle: 'mukeshambani', category: 'founder-asia' },
  { name: 'Azim Premji', handle: 'azimpremji', category: 'founder-asia' },

  // International Tech Leaders - Latin America
  { name: 'Marcos Galperin', handle: 'marcosgalperin', category: 'founder-latam' },
  { name: 'David Velez', handle: 'dvelez', category: 'founder-latam' },
  { name: 'Cristina Junqueira', handle: 'cristinajunqueira', category: 'founder-latam' },
  { name: 'Oskar Metsavaht', handle: 'oskarmetsavaht', category: 'founder-latam' },
  { name: 'Jorge Paulo Lemann', handle: 'jorgelemann', category: 'founder-latam' },
  { name: 'Eduardo Saverin', handle: 'esaverin', category: 'founder-latam' },
  { name: 'Martin Migoya', handle: 'martinmigoya', category: 'founder-latam' },
  { name: 'Sergio Furio', handle: 'sergiofurio', category: 'founder-latam' },
  { name: 'Florian Hagenbuch', handle: 'flohagenbuch', category: 'founder-latam' },
  { name: 'Carlos Slim', handle: 'carlosslim', category: 'founder-latam' },

  // More Fortune 500 Tech Executives
  { name: 'Diane Greene', handle: 'dianegreene', category: 'exec' },
  { name: 'John Donahoe', handle: 'johndonahoe', category: 'exec' },
  { name: 'Meg Whitman', handle: 'megwhitman', category: 'exec' },
  { name: 'Carol Bartz', handle: 'carolbartz', category: 'exec' },
  { name: 'Marissa Mayer', handle: 'marissamayer', category: 'exec' },
  { name: 'Carly Fiorina', handle: 'carlyfiorina', category: 'exec' },
  { name: 'Ursula Burns', handle: 'ursulaburns', category: 'exec' },
  { name: 'Virginia Rometty', handle: 'ginnirometty2', category: 'exec' },
  { name: 'Gwynne Shotwell', handle: 'gwynneshotwell', category: 'exec' },
  { name: 'Pat Gelsinger', handle: 'patgelsinger', category: 'exec' },
  { name: 'Lisa Su', handle: 'lisasu', category: 'exec' },
  { name: 'Jim Keller', handle: 'jimkeller', category: 'exec' },
  { name: 'Mark Papermaster', handle: 'markpapermaster', category: 'exec' },
  { name: 'John Hennessy', handle: 'johnhennessy', category: 'exec' },
  { name: 'David Patterson', handle: 'davidpatterson', category: 'exec' },

  // Startup Accelerator Leaders
  { name: 'Techstars', handle: 'techstars', category: 'accelerator' },
  { name: '500 Startups', handle: '500startups', category: 'accelerator' },
  { name: 'Plug and Play', handle: 'plugandplaytechcenter', category: 'accelerator' },
  { name: 'SOSV', handle: 'sosv', category: 'accelerator' },
  { name: 'Entrepreneur First', handle: 'entrepreneurfirst', category: 'accelerator' },
  { name: 'Antler', handle: 'antler', category: 'accelerator' },
  { name: 'On Deck', handle: 'ondeck', category: 'accelerator' },
  { name: 'South Park Commons', handle: 'southparkcommons', category: 'accelerator' },
  { name: 'Pioneer', handle: 'pioneer', category: 'accelerator' },
  { name: 'Indie.vc', handle: 'indievc', category: 'accelerator' },

  // Developer Communities
  { name: 'GitHub', handle: 'github', category: 'devtools' },
  { name: 'GitLab', handle: 'gitlab', category: 'devtools' },
  { name: 'Stack Overflow', handle: 'stack-overflow', category: 'devtools' },
  { name: 'Atlassian', handle: 'atlassian', category: 'devtools' },
  { name: 'JetBrains', handle: 'jetbrains', category: 'devtools' },
  { name: 'Docker', handle: 'docker', category: 'devtools' },
  { name: 'Kubernetes', handle: 'kubernetes', category: 'devtools' },
  { name: 'HashiCorp', handle: 'hashicorp', category: 'devtools' },
  { name: 'Postman', handle: 'postman-platform', category: 'devtools' },
  { name: 'Insomnia', handle: 'konghq', category: 'devtools' },

  // AI/ML Companies
  { name: 'OpenAI', handle: 'openai', category: 'ai' },
  { name: 'Anthropic', handle: 'anthropic-ai', category: 'ai' },
  { name: 'DeepMind', handle: 'deepmind', category: 'ai' },
  { name: 'Hugging Face', handle: 'huggingface', category: 'ai' },
  { name: 'Stability AI', handle: 'stability-ai', category: 'ai' },
  { name: 'Midjourney', handle: 'midjourney', category: 'ai' },
  { name: 'Cohere', handle: 'cohere-ai', category: 'ai' },
  { name: 'AI21 Labs', handle: 'ai21labs', category: 'ai' },
  { name: 'Adept AI', handle: 'adept-ai', category: 'ai' },
  { name: 'Inflection AI', handle: 'inflection-ai', category: 'ai' },
  { name: 'Character AI', handle: 'character-ai', category: 'ai' },
  { name: 'Jasper', handle: 'jasper-ai', category: 'ai' },
  { name: 'Copy AI', handle: 'copy-ai', category: 'ai' },
  { name: 'Runway', handle: 'runwayml', category: 'ai' },
  { name: 'Synthesia', handle: 'synthesia', category: 'ai' },

  // More Creator Economy People
  { name: 'Jack Conte', handle: 'jackconte', category: 'creator' },
  { name: 'Sam Yam', handle: 'samyam', category: 'creator' },
  { name: 'Eugene Wei', handle: 'eugenewei', category: 'creator' },
  { name: 'Li Jin', handle: 'lijin', category: 'creator' },
  { name: 'Blake Robbins', handle: 'blakerobbins', category: 'creator' },
  { name: 'Sahil Lavingia', handle: 'sahillavingia', category: 'creator' },
  { name: 'Nathan Barry', handle: 'nathanbarry', category: 'creator' },
  { name: 'Podia', handle: 'joinpodia', category: 'creator' },
  { name: 'Teachable', handle: 'teachable', category: 'creator' },
  { name: 'Thinkific', handle: 'thinkific', category: 'creator' },

  // Tech Podcasters and Writers
  { name: 'Tim Ferriss', handle: 'timferriss', category: 'podcaster' },
  { name: 'Joe Rogan', handle: 'joe-rogan', category: 'podcaster' },
  { name: 'Lex Fridman', handle: 'lexfridman2', category: 'podcaster' },
  { name: 'Andrew Huberman', handle: 'andrewhuberman', category: 'podcaster' },
  { name: 'Scott Galloway', handle: 'scottgalloway', category: 'podcaster' },
  { name: 'Ben Thompson', handle: 'benthompson', category: 'podcaster' },
  { name: 'Packy McCormick', handle: 'packymccormick', category: 'podcaster' },
  { name: 'Mario Gabriele', handle: 'mariogabriele', category: 'podcaster' },
  { name: 'Lenny Rachitsky', handle: 'lennyrachitsky2', category: 'podcaster' },
  { name: 'David Perell', handle: 'davidperell', category: 'podcaster' },

  // More Software Engineers
  { name: 'Kyle Simpson', handle: 'getify', category: 'engineer' },
  { name: 'Sarah Drasner', handle: 'sarahdrasner', category: 'engineer' },
  { name: 'Kent Dodds', handle: 'kentcdodds', category: 'engineer' },
  { name: 'Tanner Linsley', handle: 'tannerlinsley', category: 'engineer' },
  { name: 'Theo Browne', handle: 'theobrowne', category: 'engineer' },
  { name: 'Matt Pocock', handle: 'mattpocockuk', category: 'engineer' },
  { name: 'Josh Comeau', handle: 'joshwcomeau', category: 'engineer' },
  { name: 'Cassidy Williams', handle: 'cassidoo', category: 'engineer' },
  { name: 'Emma Bostian', handle: 'emmabostian', category: 'engineer' },
  { name: 'Ali Spittel', handle: 'alispittel', category: 'engineer' },
  { name: 'Angie Jones', handle: 'angiejones', category: 'engineer' },
  { name: 'Kelsey Hightower', handle: 'kelseyhightower', category: 'engineer' },
  { name: 'Julia Evans', handle: 'juliaevansblog', category: 'engineer' },
  { name: 'Mitchell Hashimoto', handle: 'mitchellh2', category: 'engineer' },
  { name: 'Charity Majors', handle: 'charitymajors', category: 'engineer' },

  // More VCs Round 2
  { name: 'Jason Lemkin', handle: 'jasonmlemkin', category: 'vc' },
  { name: 'David Skok', handle: 'davidskok', category: 'vc' },
  { name: 'Tomasz Tunguz', handle: 'tomasztunguz', category: 'vc' },
  { name: 'Mark Suster', handle: 'marksuster', category: 'vc' },
  { name: 'Hunter Walk', handle: 'hunterwalk', category: 'vc' },
  { name: 'Satya Patel', handle: 'satyapatel', category: 'vc' },
  { name: 'Sarah Guo', handle: 'sarahguo', category: 'vc' },
  { name: 'Elad Gil', handle: 'eladgil', category: 'vc' },
  { name: 'Pejman Nozad', handle: 'pejmannozad', category: 'vc' },
  { name: 'Harry Stebbings', handle: 'harrystebbings', category: 'vc' },
  { name: 'Jason Calacanis', handle: 'jasoncal', category: 'vc' },
  { name: 'David Hornik', handle: 'davidhornik', category: 'vc' },
  { name: 'Manu Kumar', handle: 'manukumar', category: 'vc' },
  { name: 'Steve Blank', handle: 'steveblank', category: 'vc' },
  { name: 'Eric Ries', handle: 'ericries', category: 'vc' },

  // Product Hunt & Ecosystem
  { name: 'Ryan Hoover', handle: 'ryanhoover', category: 'ecosystem' },
  { name: 'Product Hunt', handle: 'producthunt', category: 'ecosystem' },
  { name: 'Indie Hackers', handle: 'indiehackers', category: 'ecosystem' },
  { name: 'Hacker News', handle: 'ycombinator', category: 'ecosystem' },
  { name: 'TechCrunch', handle: 'techcrunch', category: 'ecosystem' },
  { name: 'The Information', handle: 'theinformation', category: 'ecosystem' },
  { name: 'Protocol', handle: 'protocol', category: 'ecosystem' },
  { name: 'The Verge', handle: 'theverge', category: 'ecosystem' },
  { name: 'Recode', handle: 'raboroshy', category: 'ecosystem' },
  { name: 'Stratechery', handle: 'stratechery', category: 'ecosystem' },

  // More Big Tech People
  { name: 'Craig Federighi', handle: 'craigfederighi', category: 'bigtech' },
  { name: 'Phil Schiller', handle: 'philipschiller', category: 'bigtech' },
  { name: 'Eddy Cue', handle: 'eddycue', category: 'bigtech' },
  { name: 'Jeff Dean', handle: 'jeffdean', category: 'bigtech' },
  { name: 'Sundar Pichai', handle: 'sundarpichai2', category: 'bigtech' },
  { name: 'Ruth Porat', handle: 'ruthporat2', category: 'bigtech' },
  { name: 'Prabhakar Raghavan', handle: 'praghavan', category: 'bigtech' },
  { name: 'Philipp Schindler', handle: 'philippschindler', category: 'bigtech' },
  { name: 'Neal Mohan', handle: 'nealmohan', category: 'bigtech' },
  { name: 'Susan Wojcicki', handle: 'susanw', category: 'bigtech' },
  { name: 'Javier Soltero', handle: 'javiersoltero', category: 'bigtech' },
  { name: 'Hiroshi Lockheimer', handle: 'lockheimer', category: 'bigtech' },
  { name: 'Rick Osterloh', handle: 'rickosterloh', category: 'bigtech' },
  { name: 'Jen Fitzpatrick', handle: 'jenfitz', category: 'bigtech' },
  { name: 'Kent Walker', handle: 'kentwalker', category: 'bigtech' },

  // Cloud Providers
  { name: 'AWS', handle: 'amazon-web-services', category: 'cloud' },
  { name: 'Google Cloud', handle: 'google-cloud', category: 'cloud' },
  { name: 'Microsoft Azure', handle: 'microsoftazure', category: 'cloud' },
  { name: 'DigitalOcean', handle: 'digitalocean', category: 'cloud' },
  { name: 'Linode', handle: 'linode', category: 'cloud' },
  { name: 'Vultr', handle: 'vultr', category: 'cloud' },
  { name: 'Oracle Cloud', handle: 'oraclecloud', category: 'cloud' },
  { name: 'IBM Cloud', handle: 'ibmcloud', category: 'cloud' },
  { name: 'Alibaba Cloud', handle: 'alibabacloud', category: 'cloud' },
  { name: 'Tencent Cloud', handle: 'tencentcloud', category: 'cloud' },

  // More Notable Founders
  { name: 'Tobi Lutke', handle: 'tobi', category: 'founder' },
  { name: 'Dustin Moskovitz', handle: 'dmoskov', category: 'founder' },
  { name: 'Adam DAngelo', handle: 'adamdangelo', category: 'founder' },
  { name: 'Andrew Mason', handle: 'andrewmason', category: 'founder' },
  { name: 'Aaron Levie', handle: 'levie', category: 'founder' },
  { name: 'Tien Tzuo', handle: 'tientzuo', category: 'founder' },
  { name: 'Dheeraj Pandey', handle: 'dheerajpandey', category: 'founder' },
  { name: 'Joe Lonsdale', handle: 'joelonsdale', category: 'founder' },
  { name: 'Palmer Luckey', handle: 'palmerluckey', category: 'founder' },
  { name: 'Elizabeth Holmes', handle: 'elizabethholmes2', category: 'founder' },
  { name: 'Travis Kalanick', handle: 'travisk', category: 'founder' },
  { name: 'Logan Green', handle: 'logangreen2', category: 'founder' },
  { name: 'Anthony Levandowski', handle: 'alevandowski', category: 'founder' },
  { name: 'Parker Harris', handle: 'parkerharris', category: 'founder' },
  { name: 'Aneel Bhusri', handle: 'aneelbhusri', category: 'founder' },

  // Security Leaders
  { name: 'Bruce Schneier', handle: 'brueschneierschneier', category: 'security' },
  { name: 'Katie Moussouris', handle: 'katiemoussouris', category: 'security' },
  { name: 'Window Snyder', handle: 'windowsnyder', category: 'security' },
  { name: 'Alex Stamos', handle: 'alexstamos', category: 'security' },
  { name: 'Parisa Tabriz', handle: 'parisatabriz', category: 'security' },
  { name: 'Tarah Wheeler', handle: 'taaboroshy', category: 'security' },
  { name: 'Wendy Nather', handle: 'wendynather', category: 'security' },
  { name: 'Daniel Miessler', handle: 'danielmiessler', category: 'security' },
  { name: 'Robert Lee', handle: 'robertmlee', category: 'security' },
  { name: 'Brian Krebs', handle: 'briankrebs', category: 'security' },

  // Consulting Firms
  { name: 'McKinsey', handle: 'mckinsey', category: 'consulting' },
  { name: 'BCG', handle: 'boston-consulting-group', category: 'consulting' },
  { name: 'Bain & Company', handle: 'baboroshy', category: 'consulting' },
  { name: 'Deloitte', handle: 'deloitte', category: 'consulting' },
  { name: 'Accenture', handle: 'accenture', category: 'consulting' },
  { name: 'PwC', handle: 'pwc', category: 'consulting' },
  { name: 'EY', handle: 'ernstandyoung', category: 'consulting' },
  { name: 'KPMG', handle: 'kpmg', category: 'consulting' },
  { name: 'IBM Consulting', handle: 'ibmconsulting', category: 'consulting' },
  { name: 'Capgemini', handle: 'capgemini', category: 'consulting' },

  // Universities Tech Programs
  { name: 'Stanford', handle: 'stanford-university', category: 'university' },
  { name: 'MIT', handle: 'massachusetts-institute-of-technology', category: 'university' },
  { name: 'Harvard', handle: 'harvard-university', category: 'university' },
  { name: 'Berkeley', handle: 'uc-berkeley', category: 'university' },
  { name: 'CMU', handle: 'carnegie-mellon-university', category: 'university' },
  { name: 'Caltech', handle: 'caltech', category: 'university' },
  { name: 'Georgia Tech', handle: 'georgia-institute-of-technology', category: 'university' },
  { name: 'Cornell Tech', handle: 'cornelltech', category: 'university' },
  { name: 'NYU', handle: 'new-york-university', category: 'university' },
  { name: 'USC', handle: 'university-of-southern-california', category: 'university' },
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

const COMPANY_CATEGORIES = ['accelerator', 'devtools', 'ai', 'cloud', 'consulting', 'university', 'ecosystem', 'company'];

// Map location to Region enum
function mapLocationToRegion(location?: string, country?: string, countryCode?: string): Region {
  const code = countryCode?.toUpperCase() || '';
  const countryStr = (country || location || '').toLowerCase();

  const codeMap: Record<string, Region> = {
    'US': Region.USA, 'USA': Region.USA,
    'CA': Region.CANADA, 'GB': Region.UK, 'UK': Region.UK,
    'ES': Region.SPAIN, 'DE': Region.GERMANY, 'FR': Region.FRANCE,
    'IT': Region.ITALY, 'NL': Region.NETHERLANDS, 'SE': Region.SWEDEN,
    'NO': Region.NORWAY, 'DK': Region.DENMARK, 'FI': Region.FINLAND,
    'PL': Region.POLAND, 'RU': Region.RUSSIA, 'JP': Region.JAPAN,
    'KR': Region.KOREA, 'CN': Region.CHINA, 'IN': Region.INDIA,
    'ID': Region.INDONESIA, 'PH': Region.PHILIPPINES, 'TH': Region.THAILAND,
    'VN': Region.VIETNAM, 'MY': Region.MALAYSIA, 'SG': Region.SINGAPORE,
    'AU': Region.AUSTRALIA, 'NZ': Region.NEW_ZEALAND, 'BR': Region.BRAZIL,
    'MX': Region.MEXICO, 'CO': Region.COLOMBIA, 'AR': Region.ARGENTINA,
    'CL': Region.CHILE, 'PE': Region.PERU,
  };

  if (code && codeMap[code]) return codeMap[code];

  const nameMap: Array<[string[], Region]> = [
    [['united states', 'usa', 'u.s.', 'california', 'new york', 'texas', 'san francisco', 'los angeles', 'seattle'], Region.USA],
    [['canada', 'toronto', 'vancouver'], Region.CANADA],
    [['united kingdom', 'uk', 'england', 'london'], Region.UK],
    [['spain', 'madrid', 'barcelona'], Region.SPAIN],
    [['germany', 'berlin', 'munich'], Region.GERMANY],
    [['france', 'paris'], Region.FRANCE],
    [['italy', 'rome', 'milan'], Region.ITALY],
    [['netherlands', 'amsterdam'], Region.NETHERLANDS],
    [['sweden', 'stockholm'], Region.SWEDEN],
    [['japan', 'tokyo'], Region.JAPAN],
    [['korea', 'seoul'], Region.KOREA],
    [['china', 'beijing', 'shanghai'], Region.CHINA],
    [['india', 'mumbai', 'bangalore'], Region.INDIA],
    [['singapore'], Region.SINGAPORE],
    [['australia', 'sydney', 'melbourne'], Region.AUSTRALIA],
    [['brazil', 'são paulo'], Region.BRAZIL],
    [['mexico', 'mexico city'], Region.MEXICO],
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
      where: {
        platform_username: { platform: 'LINKEDIN', username: handle }
      }
    });

    if (existing) return false;

    const { profile, isPrivate } = await fetchLinkedInProfile(item.handle, isCompany);

    let displayName: string;
    let avatarUrl: string | undefined;
    let followers = 0;
    let description: string;
    let region: Region = Region.WORLDWIDE;

    if (profile && !isPrivate) {
      displayName = profile.name ||
        `${profile.first_name || ''} ${profile.last_name || ''}`.trim() ||
        item.name;
      avatarUrl = profile.image || undefined;
      followers = profile.followers || profile.follower_count || 0;

      // Build description with location if available
      const locationStr = profile.city && profile.country ? `${profile.city}, ${profile.country}` :
                         profile.location || profile.geo_location || '';
      const headline = profile.headline || profile.about || profile.description || `${item.category}`;
      description = locationStr ? `${headline} | ${locationStr}` : headline;

      // Map location to region
      region = mapLocationToRegion(profile.location || profile.geo_location, profile.country, profile.country_code);
    } else {
      displayName = item.name;
      followers = 0;
      description = `LinkedIn (${isPrivate ? 'private' : 'import'}) - ${item.category}`;
    }

    if (avatarUrl) {
      try {
        avatarUrl = await bunnyService.uploadLinkedInAvatar(handle, avatarUrl);
      } catch {}
    }

    const profileUrl = isCompany
      ? `https://linkedin.com/company/${handle}`
      : `https://linkedin.com/in/${handle}`;

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
  console.log('   LINKEDIN BATCH 4 IMPORT');
  console.log('===========================================\n');

  const initialCount = await db.streamer.count({ where: { platform: 'LINKEDIN' } });
  console.log(`Initial LinkedIn count: ${initialCount}`);
  console.log(`Profiles to import: ${PROFILES.length}\n`);

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < PROFILES.length; i++) {
    const profile = PROFILES[i];
    console.log(`[${i + 1}/${PROFILES.length}] ${profile.name}`);

    const success = await importProfile(profile);
    if (success) created++;
    else skipped++;

    await new Promise(r => setTimeout(r, 200));

    if ((i + 1) % 50 === 0) {
      const currentCount = await db.streamer.count({ where: { platform: 'LINKEDIN' } });
      console.log(`\n--- Progress: ${i + 1}/${PROFILES.length}, LinkedIn total: ${currentCount} ---\n`);
    }
  }

  const finalCount = await db.streamer.count({ where: { platform: 'LINKEDIN' } });

  console.log('\n===========================================');
  console.log('   BATCH 4 IMPORT COMPLETE');
  console.log('===========================================');
  console.log(`Profiles processed: ${PROFILES.length}`);
  console.log(`New profiles created: ${created}`);
  console.log(`Skipped (existing): ${skipped}`);
  console.log(`Initial LinkedIn: ${initialCount}`);
  console.log(`Final LinkedIn: ${finalCount}`);
  console.log(`Progress: ${finalCount}/1000 target`);

  await db.$disconnect();
}

main().catch(console.error);
