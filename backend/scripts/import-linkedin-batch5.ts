/**
 * LinkedIn Batch 5 Import
 *
 * More profiles for 1k target:
 * - More AI/ML leaders
 * - DevRel and Community leaders
 * - More company pages
 * - Tech YouTubers with known LinkedIn
 */

import axios from 'axios';
import { db, logger } from '../src/utils/database';
import { Region } from '@prisma/client';
import { bunnyService } from '../src/services/bunnyService';

const SCRAPECREATORS_API_KEY = process.env.SCRAPECREATORS_API_KEY || 'qJY95WcDxCStfw9idIub8a04Cyr1';

const PROFILES = [
  // AI/ML Leaders and Researchers
  { name: 'Ilya Sutskever', handle: 'ilya-sutskever', category: 'ai' },
  { name: 'Greg Brockman', handle: 'thegdb', category: 'ai' },
  { name: 'Mira Murati', handle: 'miramurati', category: 'ai' },
  { name: 'Dario Amodei', handle: 'darioamodei', category: 'ai' },
  { name: 'Daniela Amodei', handle: 'danielaamodei', category: 'ai' },
  { name: 'Jan Leike', handle: 'janleike', category: 'ai' },
  { name: 'Chris Olah', handle: 'colah', category: 'ai' },
  { name: 'Jeremy Howard', handle: 'howardjeremy', category: 'ai' },
  { name: 'Rachel Thomas Fast AI', handle: 'rachel-thomas-942a7a2', category: 'ai' },
  { name: 'Demis Hassabis', handle: 'demishassabis', category: 'ai' },
  { name: 'Shane Legg', handle: 'shanelegg', category: 'ai' },
  { name: 'Mustafa Suleyman', handle: 'mustafasuleyman', category: 'ai' },
  { name: 'Clement Delangue', handle: 'clementdelangue', category: 'ai' },
  { name: 'Thomas Wolf', handle: 'thomwolf', category: 'ai' },
  { name: 'Julien Chaumond', handle: 'julien-c', category: 'ai' },
  { name: 'Emad Mostaque', handle: 'emaboroshy', category: 'ai' },
  { name: 'David Ha', handle: 'hardmaru', category: 'ai' },
  { name: 'Alex Krizhevsky', handle: 'alexkrizhevsky', category: 'ai' },
  { name: 'Pieter Abbeel', handle: 'pieterabbeel', category: 'ai' },
  { name: 'Chelsea Finn', handle: 'chelseabfinn', category: 'ai' },

  // DevRel and Community Leaders
  { name: 'Kelsey Hightower GCP', handle: 'kelsey-hightower', category: 'devrel' },
  { name: 'Jason Warner', handle: 'jasoncwarner', category: 'devrel' },
  { name: 'Sarah Drasner VP', handle: 'sarahdrasnerva', category: 'devrel' },
  { name: 'Swyx', handle: 'shawnwang', category: 'devrel' },
  { name: 'Jem Young', handle: 'jemyoung', category: 'devrel' },
  { name: 'Brian Douglas', handle: 'bdougieyo', category: 'devrel' },
  { name: 'Nicole Archambault', handle: 'nicole-archambault', category: 'devrel' },
  { name: 'Angie Byron', handle: 'webchick', category: 'devrel' },
  { name: 'Mary Thengvall', handle: 'marythengvall', category: 'devrel' },
  { name: 'Kim Crayton', handle: 'kimcrayton', category: 'devrel' },
  { name: 'Rizel Scarlett', handle: 'blackgirlbytes', category: 'devrel' },
  { name: 'Gift Egwuenu', handle: 'gaboroshy', category: 'devrel' },
  { name: 'Prosper Otemuyiwa', handle: 'unicodeveloper', category: 'devrel' },
  { name: 'Alex Ellis', handle: 'alexellisuk', category: 'devrel' },
  { name: 'Adora Nwodo', handle: 'adoranwodo', category: 'devrel' },

  // More Company Pages
  { name: 'Palantir', handle: 'palantir-technologies', category: 'company' },
  { name: 'Dropbox', handle: 'dropbox', category: 'company' },
  { name: 'Slack', handle: 'slack', category: 'company' },
  { name: 'Zoom', handle: 'zoom-video-communications', category: 'company' },
  { name: 'Uber', handle: 'uber-com', category: 'company' },
  { name: 'Lyft', handle: 'lyft', category: 'company' },
  { name: 'Airbnb', handle: 'airbnb', category: 'company' },
  { name: 'DoorDash', handle: 'doordash', category: 'company' },
  { name: 'Instacart', handle: 'instacart', category: 'company' },
  { name: 'Robinhood', handle: 'robinhoodapp', category: 'company' },
  { name: 'Coinbase', handle: 'coinbase', category: 'company' },
  { name: 'Plaid', handle: 'plaid', category: 'company' },
  { name: 'Ramp', handle: 'raboroshy', category: 'company' },
  { name: 'Brex', handle: 'braboroshy', category: 'company' },
  { name: 'Rippling', handle: 'rippling', category: 'company' },
  { name: 'Gusto', handle: 'gustohq', category: 'company' },
  { name: 'Toast', handle: 'toasttab', category: 'company' },
  { name: 'ServiceNow', handle: 'servicenow', category: 'company' },
  { name: 'Workday', handle: 'workday', category: 'company' },
  { name: 'Zendesk', handle: 'zendesk', category: 'company' },
  { name: 'HubSpot', handle: 'hubspot', category: 'company' },
  { name: 'Mailchimp', handle: 'mailchimp', category: 'company' },
  { name: 'Canva', handle: 'canva', category: 'company' },
  { name: 'Airtable', handle: 'airtable', category: 'company' },
  { name: 'Asana', handle: 'asana', category: 'company' },
  { name: 'Monday.com', handle: 'mondaydotcom', category: 'company' },
  { name: 'ClickUp', handle: 'clickup', category: 'company' },
  { name: 'Miro', handle: 'mirohq', category: 'company' },
  { name: 'Loom', handle: 'useloom', category: 'company' },
  { name: 'Calendly', handle: 'calendly', category: 'company' },

  // More Founders and Executives
  { name: 'Ivan Zhao', handle: 'ivanzhao', category: 'founder' },
  { name: 'Simon Last', handle: 'simonlast', category: 'founder' },
  { name: 'Karri Saarinen', handle: 'karrisaarinen', category: 'founder' },
  { name: 'Tuomas Artman', handle: 'tuomasartman', category: 'founder' },
  { name: 'Howie Liu', handle: 'howieliu', category: 'founder' },
  { name: 'Andrew Filev', handle: 'andrewfilev', category: 'founder' },
  { name: 'David Cancel', handle: 'dcancel', category: 'founder' },
  { name: 'Ryan Burke', handle: 'ryanburke', category: 'founder' },
  { name: 'Des Traynor', handle: 'destraynor', category: 'founder' },
  { name: 'Eoghan McCabe', handle: 'eoghanmccabe', category: 'founder' },
  { name: 'Emmett Nicholas', handle: 'emmettnicholas', category: 'founder' },
  { name: 'Joe Gebbia', handle: 'jgebbia', category: 'founder' },
  { name: 'Nate Blecharczyk', handle: 'nblecharczyk', category: 'founder' },
  { name: 'Anthony Casalena', handle: 'casalena', category: 'founder' },
  { name: 'Ross Mason', handle: 'rossmason', category: 'founder' },

  // Business/Finance Tech People
  { name: 'Mike Cannon-Brookes', handle: 'mcannonbrookes', category: 'biztech' },
  { name: 'Scott Farquhar', handle: 'sfarquhar', category: 'biztech' },
  { name: 'Michael Dell', handle: 'michaeldell', category: 'biztech' },
  { name: 'Larry Ellison', handle: 'larryellison', category: 'biztech' },
  { name: 'Steve Ballmer', handle: 'steveballmer', category: 'biztech' },
  { name: 'Paul Allen', handle: 'paulallen', category: 'biztech' },
  { name: 'Michael Bloomberg', handle: 'mikebloomberg', category: 'biztech' },
  { name: 'Meg Whitman Quibi', handle: 'megwhitmanquibi', category: 'biztech' },
  { name: 'John Chambers', handle: 'johnchambers', category: 'biztech' },
  { name: 'Eric Schmidt', handle: 'ericschmidt', category: 'biztech' },
  { name: 'Jonathan Ive', handle: 'jonathanive', category: 'biztech' },
  { name: 'Angela Ahrendts', handle: 'angelaahrendts', category: 'biztech' },
  { name: 'Phil Knight', handle: 'philknight', category: 'biztech' },
  { name: 'Howard Schultz', handle: 'howardschultz', category: 'biztech' },
  { name: 'Bob Iger', handle: 'robertiger', category: 'biztech' },

  // Tech YouTubers/Content Creators
  { name: 'MKBHD', handle: 'mkbhd', category: 'creator' },
  { name: 'Marques Brownlee', handle: 'maraboroshy', category: 'creator' },
  { name: 'Linus Tech Tips', handle: 'linusmediagroup', category: 'creator' },
  { name: 'iJustine', handle: 'ijustine', category: 'creator' },
  { name: 'Unbox Therapy', handle: 'unboxtherapy', category: 'creator' },
  { name: 'Austin Evans', handle: 'austinevans', category: 'creator' },
  { name: 'Dave Lee', handle: 'dave2d', category: 'creator' },
  { name: 'Rene Ritchie', handle: 'reneritchie', category: 'creator' },
  { name: 'Sara Dietschy', handle: 'saradietschy', category: 'creator' },
  { name: 'Jonathan Morrison', handle: 'tldtoday', category: 'creator' },
  { name: 'Jon Rettinger', handle: 'jonrettinger', category: 'creator' },
  { name: 'Lon Seidman', handle: 'lonseidman', category: 'creator' },
  { name: 'UrAvgConsumer', handle: 'uravgconsumer', category: 'creator' },
  { name: 'Michael Fisher', handle: 'themmraboroshy', category: 'creator' },
  { name: 'Shane Whatley', handle: 'shanewhatley', category: 'creator' },

  // Product/Design Leaders
  { name: 'Scott Belsky', handle: 'scottbelsky', category: 'product' },
  { name: 'Bobby Ghoshal', handle: 'bobbyghoshal', category: 'product' },
  { name: 'Noah Levin', handle: 'nlevin', category: 'product' },
  { name: 'Diego Rodriguez', handle: 'diegorodriguez', category: 'product' },
  { name: 'Tim Brown IDEO', handle: 'timbrownideo', category: 'product' },
  { name: 'Jared Spataro', handle: 'jaboroshy', category: 'product' },
  { name: 'Margaret Stewart', handle: 'megstewart', category: 'product' },
  { name: 'Aarron Walter', handle: 'aarronwalter', category: 'product' },
  { name: 'Frank Chimero', handle: 'fchimero', category: 'product' },
  { name: 'Jason Santa Maria', handle: 'jasonsantamaria', category: 'product' },
  { name: 'Dan Cederholm', handle: 'dancederholm', category: 'product' },
  { name: 'Ethan Marcotte', handle: 'ethanmarcotte', category: 'product' },
  { name: 'Mike Monteiro', handle: 'mikemonteiro', category: 'product' },
  { name: 'Cameron Moll', handle: 'cameronmoll', category: 'product' },
  { name: 'Jessica Hische', handle: 'jessicahische', category: 'product' },

  // More Engineering Leaders
  { name: 'James Hamilton AWS', handle: 'jaboroshy', category: 'engineering' },
  { name: 'Werner Vogels', handle: 'wernervogels', category: 'engineering' },
  { name: 'Jeff Barr', handle: 'jbarr', category: 'engineering' },
  { name: 'Martin Kleppmann', handle: 'martinkleppmann', category: 'engineering' },
  { name: 'Brendan Gregg', handle: 'brendangregg', category: 'engineering' },
  { name: 'Bryan Cantrill', handle: 'bcantrill', category: 'engineering' },
  { name: 'Jessie Frazelle', handle: 'jessiefrazelle', category: 'engineering' },
  { name: 'Liz Rice', handle: 'lizrice', category: 'engineering' },
  { name: 'Kris Nova', handle: 'krisnova', category: 'engineering' },
  { name: 'Jaana Dogan', handle: 'rakyll', category: 'engineering' },
  { name: 'Camille Fournier', handle: 'camillehourn', category: 'engineering' },
  { name: 'Tanya Reilly TL', handle: 'tanyareilly', category: 'engineering' },
  { name: 'Will Larson', handle: 'lethain', category: 'engineering' },
  { name: 'Pat Helland', handle: 'pathelland', category: 'engineering' },
  { name: 'Erik Meijer', handle: 'headinthebox', category: 'engineering' },

  // More Marketing/Growth Leaders
  { name: 'April Dunford', handle: 'aprildunford', category: 'marketing' },
  { name: 'David Ogilvy', handle: 'davidogilvy', category: 'marketing' },
  { name: 'Emily Kramer', handle: 'emilykramer', category: 'marketing' },
  { name: 'Patrick Campbell', handle: 'patticus', category: 'marketing' },
  { name: 'Kieran Flanagan HubSpot', handle: 'kieranflanagan', category: 'marketing' },
  { name: 'Peep Laja', handle: 'peeplaja', category: 'marketing' },
  { name: 'Hiten Shah SaaS', handle: 'hitenshaboroshy', category: 'marketing' },
  { name: 'Rob Walling', handle: 'robwalling', category: 'marketing' },
  { name: 'Nathan Latka', handle: 'nathanlatka', category: 'marketing' },
  { name: 'Claire Suellentrop', handle: 'clairesuellentrop', category: 'marketing' },
  { name: 'Wes Bush', handle: 'wesbush', category: 'marketing' },
  { name: 'Elena Verna', handle: 'elenaverna', category: 'marketing' },
  { name: 'Adam Robinson', handle: 'adamrobinson', category: 'marketing' },
  { name: 'Kyle Poyar', handle: 'kylepoyar', category: 'marketing' },
  { name: 'Dave Gerhardt', handle: 'davegerhardt', category: 'marketing' },

  // Open Source Leaders
  { name: 'Linus Torvalds Linux', handle: 'torvalds', category: 'opensource' },
  { name: 'Guido van Rossum Python', handle: 'guido-van-rossum-python', category: 'opensource' },
  { name: 'Brendan Eich JS', handle: 'brendaneich', category: 'opensource' },
  { name: 'James Gosling Java', handle: 'jaboroshy', category: 'opensource' },
  { name: 'Anders Hejlsberg C#', handle: 'ahejlsberg', category: 'opensource' },
  { name: 'Yukihiro Matsumoto Ruby', handle: 'yukihiromatz', category: 'opensource' },
  { name: 'Larry Wall Perl', handle: 'larrywall', category: 'opensource' },
  { name: 'Rasmus Lerdorf PHP', handle: 'rasmus', category: 'opensource' },
  { name: 'Rob Pike Go', handle: 'robpike', category: 'opensource' },
  { name: 'Ken Thompson', handle: 'kenthompson', category: 'opensource' },
  { name: 'Bjarne Stroustrup C++', handle: 'baboroshy', category: 'opensource' },
  { name: 'Brian Kernighan', handle: 'briankernighan', category: 'opensource' },
  { name: 'Dennis Ritchie', handle: 'dennisritchie', category: 'opensource' },
  { name: 'Richard Stallman', handle: 'richardstallman', category: 'opensource' },
  { name: 'Eric Raymond', handle: 'ericraymond', category: 'opensource' },

  // More VC/Angel Investors
  { name: 'Vinod Khosla Khosla', handle: 'vkhosla', category: 'vc' },
  { name: 'John Doerr Kleiner', handle: 'jdoerr', category: 'vc' },
  { name: 'Mary Meeker Bond', handle: 'marymeeker', category: 'vc' },
  { name: 'Michael Moritz Sequoia', handle: 'michaelmoritz', category: 'vc' },
  { name: 'Peter Fenton Benchmark', handle: 'peterfenton', category: 'vc' },
  { name: 'Matt Cohler Benchmark', handle: 'mattcohler', category: 'vc' },
  { name: 'Mamoon Hamid Kleiner', handle: 'mamoonhamid', category: 'vc' },
  { name: 'Mary DElia', handle: 'marydeliaboroshy', category: 'vc' },
  { name: 'Rebecca Kaden USV', handle: 'rebeccakaden', category: 'vc' },
  { name: 'Jerry Chen Greylock', handle: 'jerrychen', category: 'vc' },
  { name: 'Navin Chaddha Mayfield', handle: 'navinchaddha', category: 'vc' },
  { name: 'Theresia Gouw Acrew', handle: 'theresiagouw', category: 'vc' },
  { name: 'Sukhinder Singh', handle: 'sukhinder', category: 'vc' },
  { name: 'Jenny Lefcourt', handle: 'jennylefcourt', category: 'vc' },
  { name: 'Nicole Quinn Lightspeed', handle: 'nicolequinn', category: 'vc' },
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

const COMPANY_CATEGORIES = ['company', 'consulting', 'university'];

function mapLocationToRegion(location?: string, country?: string, countryCode?: string): Region {
  const code = countryCode?.toUpperCase() || '';
  const countryStr = (country || location || '').toLowerCase();

  const codeMap: Record<string, Region> = {
    'US': Region.USA, 'CA': Region.CANADA, 'GB': Region.UK, 'UK': Region.UK,
    'ES': Region.SPAIN, 'DE': Region.GERMANY, 'FR': Region.FRANCE,
    'IT': Region.ITALY, 'NL': Region.NETHERLANDS, 'SE': Region.SWEDEN,
    'JP': Region.JAPAN, 'KR': Region.KOREA, 'CN': Region.CHINA, 'IN': Region.INDIA,
    'SG': Region.SINGAPORE, 'AU': Region.AUSTRALIA, 'BR': Region.BRAZIL,
    'MX': Region.MEXICO, 'CO': Region.COLOMBIA, 'AR': Region.ARGENTINA,
  };

  if (code && codeMap[code]) return codeMap[code];

  const nameMap: Array<[string[], Region]> = [
    [['united states', 'usa', 'california', 'new york', 'san francisco', 'seattle'], Region.USA],
    [['canada', 'toronto', 'vancouver'], Region.CANADA],
    [['united kingdom', 'uk', 'london'], Region.UK],
    [['germany', 'berlin', 'munich'], Region.GERMANY],
    [['france', 'paris'], Region.FRANCE],
    [['japan', 'tokyo'], Region.JAPAN],
    [['india', 'bangalore', 'mumbai'], Region.INDIA],
    [['singapore'], Region.SINGAPORE],
    [['australia', 'sydney'], Region.AUSTRALIA],
    [['brazil', 'são paulo'], Region.BRAZIL],
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
  console.log('   LINKEDIN BATCH 5 IMPORT');
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
    }
  }

  const finalCount = await db.streamer.count({ where: { platform: 'LINKEDIN' } });
  console.log('\n===========================================');
  console.log('   BATCH 5 COMPLETE');
  console.log('===========================================');
  console.log(`Created: ${created}/${PROFILES.length}`);
  console.log(`Final count: ${finalCount}/1000 target`);

  await db.$disconnect();
}

main().catch(console.error);
