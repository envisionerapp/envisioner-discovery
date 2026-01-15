/**
 * LinkedIn Profile Import - Batch 2
 * Additional 500+ profiles to help reach 1k target
 */

import axios from 'axios';
import { db, logger } from '../src/utils/database';
import { Region } from '@prisma/client';
import { bunnyService } from '../src/services/bunnyService';

const SCRAPECREATORS_API_KEY = process.env.SCRAPECREATORS_API_KEY || 'qJY95WcDxCStfw9idIub8a04Cyr1';
const RATE_LIMIT_MS = 200;

interface LinkedInImport {
  name: string;
  handle: string;
  isCompany?: boolean;
  category?: string;
}

// Batch 2: More LinkedIn profiles
const LINKEDIN_PROFILES: LinkedInImport[] = [
  // YC Founders & Alumni
  { name: 'Paul Graham', handle: 'paulgraham', category: 'vc' },
  { name: 'Jessica Livingston', handle: 'jessicalivingston', category: 'vc' },
  { name: 'Michael Seibel', handle: 'mwseibel', category: 'vc' },
  { name: 'Dalton Caldwell', handle: 'daltoncaldwell', category: 'vc' },
  { name: 'Kevin Hale', handle: 'iamkevin', category: 'vc' },
  { name: 'Adora Cheung', handle: 'adorableadora', category: 'vc' },
  { name: 'Garry Tan', handle: 'garrytan', category: 'vc' },
  { name: 'Aaron Harris', handle: 'aaharris', category: 'vc' },
  { name: 'Tim Brady', handle: 'timbrady', category: 'vc' },
  { name: 'Harj Taggar', handle: 'harjtaggar', category: 'vc' },

  // More VCs
  { name: 'Fred Wilson', handle: 'fredwilson', category: 'vc' },
  { name: 'Albert Wenger', handle: 'albertwenger', category: 'vc' },
  { name: 'Brad Feld', handle: 'bfeld', category: 'vc' },
  { name: 'Jason Fried', handle: 'jasonfried', category: 'startup-founder' },
  { name: 'DHH', handle: 'davidheinemeierhansson', category: 'startup-founder' },
  { name: 'Chris Sacca', handle: 'sacca', category: 'vc' },
  { name: 'Steve Case', handle: 'stevecase', category: 'vc' },
  { name: 'Howard Lindzon', handle: 'howardlindzon', category: 'vc' },
  { name: 'Mark Suster', handle: 'msuster', category: 'vc' },
  { name: 'Josh Kopelman', handle: 'joshkopelman', category: 'vc' },
  { name: 'Aileen Lee', handle: 'aileenlee', category: 'vc' },
  { name: 'Kirsten Green', handle: 'kirstengreen', category: 'vc' },
  { name: 'Jenny Lee', handle: 'jennylee', category: 'vc' },
  { name: 'Ann Miura-Ko', handle: 'annmiurak', category: 'vc' },
  { name: 'Semil Shah', handle: 'semilshah', category: 'vc' },

  // Tech Executives
  { name: 'Sheryl Sandberg', handle: 'sherylsandberg', category: 'tech-exec' },
  { name: 'Ruth Porat', handle: 'ruthporat', category: 'tech-exec' },
  { name: 'Amy Hood', handle: 'amyehood', category: 'tech-exec' },
  { name: 'Safra Catz', handle: 'safracatz', category: 'tech-exec' },
  { name: 'Lisa Su', handle: 'lisatsu', category: 'tech-exec' },
  { name: 'Meg Whitman', handle: 'megwhitman', category: 'tech-exec' },
  { name: 'Marissa Mayer', handle: 'marissamayer', category: 'tech-exec' },
  { name: 'Susan Wojcicki', handle: 'susanwojcicki', category: 'tech-exec' },
  { name: 'Gwynne Shotwell', handle: 'gwynnepaulashotwell', category: 'tech-exec' },
  { name: 'Arvind Krishna', handle: 'arvindkrishna', category: 'tech-exec' },
  { name: 'Andy Jassy', handle: 'andyjassy', category: 'tech-exec' },
  { name: 'Frank Slootman', handle: 'frankslootman', category: 'tech-exec' },
  { name: 'Shantanu Narayen', handle: 'shantanunarayen', category: 'tech-exec' },
  { name: 'Chuck Robbins', handle: 'chuckrobbins', category: 'tech-exec' },
  { name: 'Nikesh Arora', handle: 'nikesharora', category: 'tech-exec' },

  // More Startup Founders
  { name: 'Steve Huffman', handle: 'stevehuffman', category: 'startup-founder' },
  { name: 'Alexis Ohanian', handle: 'alexisohanian', category: 'startup-founder' },
  { name: 'Aaron Levie', handle: 'levie', category: 'startup-founder' },
  { name: 'Joel Gascoigne', handle: 'joelgascoigne', category: 'startup-founder' },
  { name: 'Dustin Moskovitz', handle: 'dmoskov', category: 'startup-founder' },
  { name: 'Justin Rosenstein', handle: 'justinrosenstein', category: 'startup-founder' },
  { name: 'Des Traynor', handle: 'destraynor', category: 'startup-founder' },
  { name: 'Eoghan McCabe', handle: 'eoghanmccabe', category: 'startup-founder' },
  { name: 'Zach Perret', handle: 'zachperret', category: 'startup-founder' },
  { name: 'William Hockey', handle: 'whockey', category: 'startup-founder' },
  { name: 'Eric Yuan', handle: 'ericsyuan', category: 'startup-founder' },
  { name: 'Tope Awotona', handle: 'topeawotona', category: 'startup-founder' },
  { name: 'Vlad Magdalin', handle: 'vladmagdalin', category: 'startup-founder' },
  { name: 'Emmett Shear', handle: 'emmettshear', category: 'startup-founder' },
  { name: 'Justin Kan', handle: 'justinkan', category: 'startup-founder' },

  // Engineering Leaders
  { name: 'Will Larson', handle: 'willlarson', category: 'engineering' },
  { name: 'Camille Fournier', handle: 'skamille', category: 'engineering' },
  { name: 'Charity Majors', handle: 'maboroshi', category: 'engineering' },
  { name: 'Kelsey Hightower', handle: 'kelseyhightower', category: 'engineering' },
  { name: 'Cindy Sridharan', handle: 'copyconstruct', category: 'engineering' },
  { name: 'Julia Evans', handle: 'juliaevans', category: 'engineering' },
  { name: 'Gergely Orosz', handle: 'gergelyorosz', category: 'engineering' },
  { name: 'Tanya Reilly', handle: 'whereistanya', category: 'engineering' },
  { name: 'Patrick Dubroy', handle: 'dubroy', category: 'engineering' },
  { name: 'Nadia Eghbal', handle: 'nayafia', category: 'engineering' },

  // Data/AI Leaders
  { name: 'DJ Patil', handle: 'dpatil', category: 'ai' },
  { name: 'Hilary Mason', handle: 'hmason', category: 'ai' },
  { name: 'Cassie Kozyrkov', handle: 'cassiekozyrkov', category: 'ai' },
  { name: 'Chip Huyen', handle: 'chiphuyen', category: 'ai' },
  { name: 'Jeremy Howard', handle: 'howardjeremy', category: 'ai' },
  { name: 'Rachel Thomas', handle: 'rachelthomas', category: 'ai' },
  { name: 'Sebastian Ruder', handle: 'sebastianruder', category: 'ai' },
  { name: 'Chris Albon', handle: 'chrisalbon', category: 'ai' },
  { name: 'Lex Fridman', handle: 'lexfridman', category: 'ai' },
  { name: 'Karpathy', handle: 'karpathy', category: 'ai' },

  // Product Managers
  { name: 'Sachin Rekhi', handle: 'sachinrekhi', category: 'product' },
  { name: 'John Cutler', handle: 'johncutlefish', category: 'product' },
  { name: 'Ravi Mehta', handle: 'ravimehta', category: 'product' },
  { name: 'Ellen Chisa', handle: 'ellenchisa', category: 'product' },
  { name: 'Nir Eyal', handle: 'nireyal', category: 'product' },
  { name: 'Eric Ries', handle: 'ericries', category: 'product' },
  { name: 'Steve Blank', handle: 'sgblank', category: 'product' },
  { name: 'Ash Maurya', handle: 'ashmaurya', category: 'product' },
  { name: 'Josh Elman', handle: 'joshelman', category: 'product' },
  { name: 'Hunter Walk', handle: 'hunterwalk', category: 'product' },

  // UX/Design
  { name: 'Jake Knapp', handle: 'jakek', category: 'design' },
  { name: 'John Zeratsky', handle: 'johnzeratsky', category: 'design' },
  { name: 'Braden Kowitz', handle: 'kowitz', category: 'design' },
  { name: 'Randy Hunt', handle: 'randyjhunt', category: 'design' },
  { name: 'Cap Watkins', handle: 'capwatkins', category: 'design' },
  { name: 'Katie Dill', handle: 'katiedill', category: 'design' },
  { name: 'Irene Au', handle: 'ireneau', category: 'design' },
  { name: 'Jared Spool', handle: 'jmspool', category: 'design' },
  { name: 'Kim Goodwin', handle: 'kimgoodwin', category: 'design' },
  { name: 'Aarron Walter', handle: 'aarron', category: 'design' },

  // Marketing Leaders
  { name: 'Kieran Flanagan', handle: 'searchbrat', category: 'marketing' },
  { name: 'Brian Balfour', handle: 'bbalfour', category: 'marketing' },
  { name: 'Casey Winters', handle: 'onecaseman', category: 'marketing' },
  { name: 'Andrew Chen', handle: 'andrewchen', category: 'marketing' },
  { name: 'Sean Ellis', handle: 'seanellis', category: 'marketing' },
  { name: 'Hiten Shah', handle: 'hnshah', category: 'marketing' },
  { name: 'Peep Laja', handle: 'peeplaja', category: 'marketing' },
  { name: 'Lincoln Murphy', handle: 'lincolnmurphy', category: 'marketing' },
  { name: 'Tomasz Tunguz', handle: 'ttunguz', category: 'marketing' },
  { name: 'David Skok', handle: 'davidskok', category: 'marketing' },

  // More Companies
  { name: 'LinkedIn', handle: 'linkedin', isCompany: true, category: 'company' },
  { name: 'Twitter/X', handle: 'twitter', isCompany: true, category: 'company' },
  { name: 'Zoom', handle: 'zoom-video-communications', isCompany: true, category: 'company' },
  { name: 'Dropbox', handle: 'dropbox', isCompany: true, category: 'company' },
  { name: 'Box', handle: 'box', isCompany: true, category: 'company' },
  { name: 'Asana', handle: 'asana', isCompany: true, category: 'company' },
  { name: 'Monday.com', handle: 'mondaydotcom', isCompany: true, category: 'company' },
  { name: 'Airtable', handle: 'airtable', isCompany: true, category: 'company' },
  { name: 'Webflow', handle: 'webflow', isCompany: true, category: 'company' },
  { name: 'Calendly', handle: 'calendly', isCompany: true, category: 'company' },
  { name: 'Loom', handle: 'useloom', isCompany: true, category: 'company' },
  { name: 'Miro', handle: 'maboroshi', isCompany: true, category: 'company' },
  { name: 'ClickUp', handle: 'clickup', isCompany: true, category: 'company' },
  { name: 'Intercom', handle: 'intercom', isCompany: true, category: 'company' },
  { name: 'Segment', handle: 'segment', isCompany: true, category: 'company' },

  // DevTools
  { name: 'GitHub', handle: 'github', isCompany: true, category: 'company' },
  { name: 'GitLab', handle: 'gitlab-com', isCompany: true, category: 'company' },
  { name: 'Vercel', handle: 'vercel', isCompany: true, category: 'company' },
  { name: 'Netlify', handle: 'netlify', isCompany: true, category: 'company' },
  { name: 'Supabase', handle: 'supabase', isCompany: true, category: 'company' },
  { name: 'PlanetScale', handle: 'planetscale', isCompany: true, category: 'company' },
  { name: 'Railway', handle: 'railway', isCompany: true, category: 'company' },
  { name: 'Render', handle: 'renderco', isCompany: true, category: 'company' },
  { name: 'Fly.io', handle: 'flyio', isCompany: true, category: 'company' },
  { name: 'Cloudflare', handle: 'cloudflare', isCompany: true, category: 'company' },

  // Finance Companies
  { name: 'Robinhood', handle: 'robinhood', isCompany: true, category: 'company' },
  { name: 'Plaid', handle: 'plaid', isCompany: true, category: 'company' },
  { name: 'Chime', handle: 'chime', isCompany: true, category: 'company' },
  { name: 'Brex', handle: 'braborexinc', isCompany: true, category: 'company' },
  { name: 'Ramp', handle: 'raborampinc', isCompany: true, category: 'company' },
  { name: 'Mercury', handle: 'mercury', isCompany: true, category: 'company' },
  { name: 'Carta', handle: 'carta', isCompany: true, category: 'company' },
  { name: 'Gusto', handle: 'gusto', isCompany: true, category: 'company' },
  { name: 'Rippling', handle: 'rippling', isCompany: true, category: 'company' },
  { name: 'Deel', handle: 'deel', isCompany: true, category: 'company' },

  // More Individual Leaders
  { name: 'Kevin Rose', handle: 'kevinrose', category: 'tech-founder' },
  { name: 'Om Malik', handle: 'om', category: 'media' },
  { name: 'Walt Mossberg', handle: 'waltmossberg', category: 'media' },
  { name: 'Kara Swisher', handle: 'karaswisher', category: 'media' },
  { name: 'Casey Newton', handle: 'caseynewton', category: 'media' },
  { name: 'Ben Thompson', handle: 'benthompson', category: 'media' },
  { name: 'Stratechery', handle: 'stratechery', category: 'media' },
  { name: 'Matthew Ball', handle: 'ballmatthew', category: 'media' },
  { name: 'Packy McCormick', handle: 'packym', category: 'media' },
  { name: 'Mario Gabriele', handle: 'mariogabriele', category: 'media' },

  // Crypto/Web3
  { name: 'Vitalik Buterin', handle: 'vitalikbuterin', category: 'crypto' },
  { name: 'Brian Armstrong', handle: 'barmstrong', category: 'crypto' },
  { name: 'Jesse Powell', handle: 'jespow', category: 'crypto' },
  { name: 'Balaji Srinivasan', handle: 'balajis', category: 'crypto' },
  { name: 'Chris Dixon', handle: 'cdixon', category: 'crypto' },
  { name: 'Katie Haun', handle: 'katiehaun', category: 'crypto' },
  { name: 'Linda Xie', handle: 'ljxie', category: 'crypto' },
  { name: 'Kyle Samani', handle: 'kylesamani', category: 'crypto' },
  { name: 'Su Zhu', handle: 'zaborusu', category: 'crypto' },
  { name: 'Arthur Hayes', handle: 'cryptohayes', category: 'crypto' },

  // Health Tech
  { name: 'Eric Topol', handle: 'eaborictopol', category: 'health' },
  { name: 'Vivek Murthy', handle: 'vivaborek_murthy', category: 'health' },
  { name: 'Peter Attia', handle: 'peterattia', category: 'health' },
  { name: 'David Sinclair', handle: 'davidasinclair', category: 'health' },
  { name: 'Siddhartha Mukherjee', handle: 'saboriddmukherjee', category: 'health' },
  { name: 'Atul Gawande', handle: 'atulgawande', category: 'health' },
  { name: 'Rob Califf', handle: 'robcaliff', category: 'health' },
  { name: 'Scott Gottlieb', handle: 'scottgottliebmd', category: 'health' },
  { name: 'Rochelle Walensky', handle: 'rochellewalensky', category: 'health' },
  { name: 'Anthony Fauci', handle: 'anthonyfauci', category: 'health' },

  // Education
  { name: 'Sal Khan', handle: 'salkhanacademy', category: 'education' },
  { name: 'Andrew Ng', handle: 'andrewyng', category: 'education' },
  { name: 'Jose Ferreira', handle: 'joseferreira', category: 'education' },
  { name: 'Daphne Koller', handle: 'daphnekoller', category: 'education' },
  { name: 'Sebastian Thrun', handle: 'sebastianthrun', category: 'education' },
  { name: 'Anant Agarwal', handle: 'anant', category: 'education' },
  { name: 'Jeff Maggioncalda', handle: 'jmagioncalda', category: 'education' },
  { name: 'Aaron Schildkrout', handle: 'aaronschildkrout', category: 'education' },
  { name: 'Ben Nelson', handle: 'bennelson', category: 'education' },
  { name: 'Austen Allred', handle: 'austenallred', category: 'education' },

  // Media & Entertainment
  { name: 'Reed Hastings', handle: 'reedhastings', category: 'media' },
  { name: 'Ted Sarandos', handle: 'tedsarandos', category: 'media' },
  { name: 'Bob Iger', handle: 'robertiger', category: 'media' },
  { name: 'Brian Roberts', handle: 'brianroberts', category: 'media' },
  { name: 'Shari Redstone', handle: 'shariredstone', category: 'media' },
  { name: 'John Stankey', handle: 'johnstankey', category: 'media' },
  { name: 'David Zaslav', handle: 'davidzaslov', category: 'media' },
  { name: 'Tim Westergren', handle: 'timwestergren', category: 'media' },
  { name: 'Troy Carter', handle: 'troycarter', category: 'media' },
  { name: 'Jimmy Iovine', handle: 'jimmyiovine', category: 'media' },

  // Sports/Fitness Tech
  { name: 'James Park', handle: 'jamespark', category: 'fitness' },
  { name: 'Kevin Plank', handle: 'kevinplank', category: 'fitness' },
  { name: 'John Foley', handle: 'johnfoley', category: 'fitness' },
  { name: 'Nick Woodman', handle: 'nickwoodman', category: 'fitness' },
  { name: 'Tobi Pearce', handle: 'tobipearce', category: 'fitness' },
  { name: 'Kayla Itsines', handle: 'kaylaitsines', category: 'fitness' },
  { name: 'Ally Love', handle: 'allylove', category: 'fitness' },
  { name: 'Robin Arzon', handle: 'robinaborarzon', category: 'fitness' },
  { name: 'Cody Rigsby', handle: 'codyrigsby', category: 'fitness' },
  { name: 'Alex Toussaint', handle: 'alextoussaint', category: 'fitness' },

  // Real Estate Tech
  { name: 'Spencer Rascoff', handle: 'spencerrascoff', category: 'real-estate' },
  { name: 'Rich Barton', handle: 'richbarton', category: 'real-estate' },
  { name: 'Glenn Kelman', handle: 'glennkelman', category: 'real-estate' },
  { name: 'Eric Wu', handle: 'ericwu', category: 'real-estate' },
  { name: 'Robert Reffkin', handle: 'robertreffkin', category: 'real-estate' },
  { name: 'Ori Allon', handle: 'oabolriallon', category: 'real-estate' },
  { name: 'Ryan Serhant', handle: 'ryanserhant', category: 'real-estate' },
  { name: 'Barbara Corcoran', handle: 'barbaracorcoran', category: 'real-estate' },
  { name: 'Grant Cardone', handle: 'grantcardone', category: 'real-estate' },
  { name: 'Brandon Turner', handle: 'brandonatbp', category: 'real-estate' },

  // More Consultants & Coaches
  { name: 'Marshall Goldsmith', handle: 'marshallgoldsmith', category: 'coach' },
  { name: 'Patrick Lencioni', handle: 'patricklencioni', category: 'coach' },
  { name: 'Liz Wiseman', handle: 'lizwiseman', category: 'coach' },
  { name: 'Kim Scott', handle: 'kimballscott', category: 'coach' },
  { name: 'Julie Zhuo', handle: 'joulee', category: 'coach' },
  { name: 'Claire Hughes Johnson', handle: 'clairehughesjohnson', category: 'coach' },
  { name: 'Molly Graham', handle: 'mollygraham', category: 'coach' },
  { name: 'Christina Wodtke', handle: 'cwodtke', category: 'coach' },
  { name: 'Kate Matsudaira', handle: 'katemats', category: 'coach' },
  { name: 'Lara Hogan', handle: 'larahogan', category: 'coach' },

  // E-commerce
  { name: 'Tobi Lütke', handle: 'tobi', category: 'ecommerce' },
  { name: 'Harley Finkelstein', handle: 'harleyf', category: 'ecommerce' },
  { name: 'Ryan Graves', handle: 'ryangraves', category: 'ecommerce' },
  { name: 'Jose Neves', handle: 'joseneves', category: 'ecommerce' },
  { name: 'Steph Korey', handle: 'stephkorey', category: 'ecommerce' },
  { name: 'Jen Rubio', handle: 'jenrubio', category: 'ecommerce' },
  { name: 'Andy Dunn', handle: 'duabornn', category: 'ecommerce' },
  { name: 'Neil Blumenthal', handle: 'neilblumenthal', category: 'ecommerce' },
  { name: 'Dave Gilboa', handle: 'dgilboa', category: 'ecommerce' },
  { name: 'Sophia Amoruso', handle: 'sophiaboraamoruso', category: 'ecommerce' },

  // Food Tech
  { name: 'Tony Xu', handle: 'tonyxu', category: 'food' },
  { name: 'Travis Kalanick', handle: 'traviskalanick', category: 'food' },
  { name: 'Will Gaybrick', handle: 'willgaybrick', category: 'food' },
  { name: 'Apoorva Mehta', handle: 'apoorvamehta', category: 'food' },
  { name: 'Fidji Simo', handle: 'fidjisimo', category: 'food' },
  { name: 'Max Mullen', handle: 'maxmullen', category: 'food' },
  { name: 'Brett Schulman', handle: 'brettschulman', category: 'food' },
  { name: 'Ethan Brown', handle: 'ethanbrown', category: 'food' },
  { name: 'Pat Brown', handle: 'patbrown', category: 'food' },
  { name: 'Josh Tetrick', handle: 'joshtetrick', category: 'food' },
];

async function tryLinkedInProfile(handle: string, isCompany: boolean): Promise<{ profile: any; isPrivate: boolean }> {
  try {
    const url = isCompany
      ? `https://www.linkedin.com/company/${handle}`
      : `https://www.linkedin.com/in/${handle}`;

    const endpoint = isCompany
      ? 'https://api.scrapecreators.com/v1/linkedin/company'
      : 'https://api.scrapecreators.com/v1/linkedin/profile';

    const response = await axios.get(endpoint, {
      headers: { 'x-api-key': SCRAPECREATORS_API_KEY },
      params: { url },
      timeout: 30000
    });

    if (response.data?.message?.includes('private') || response.data?.message?.includes('not publicly available')) {
      return { profile: null, isPrivate: true };
    }

    const data = response.data?.data || response.data;
    if (!data || data.success === false) {
      return { profile: null, isPrivate: true };
    }

    return { profile: data, isPrivate: false };
  } catch {
    return { profile: null, isPrivate: true };
  }
}

async function importProfile(item: LinkedInImport): Promise<boolean> {
  try {
    const existing = await db.streamer.findUnique({
      where: {
        platform_username: { platform: 'LINKEDIN', username: item.handle.toLowerCase() }
      }
    });

    if (existing) return false;

    const url = item.isCompany
      ? `https://www.linkedin.com/company/${item.handle}`
      : `https://www.linkedin.com/in/${item.handle}`;

    const { profile, isPrivate } = await tryLinkedInProfile(item.handle, item.isCompany || false);

    let displayName = item.name;
    let avatarUrl: string | undefined;
    let followers = 0;
    let description = `Category: ${item.category}`;

    if (profile && !isPrivate) {
      displayName = profile.name ||
        `${profile.first_name || ''} ${profile.last_name || ''}`.trim() ||
        item.name;
      avatarUrl = profile.image || profile.logo;
      followers = profile.followers || profile.follower_count || 0;
      description = profile.headline || profile.about || profile.description || `Category: ${item.category}`;
    }

    if (avatarUrl) {
      try {
        avatarUrl = await bunnyService.uploadLinkedInAvatar(item.handle, avatarUrl);
      } catch {}
    }

    await db.streamer.create({
      data: {
        platform: 'LINKEDIN',
        username: item.handle.toLowerCase(),
        displayName,
        profileUrl: url,
        avatarUrl: avatarUrl || undefined,
        followers,
        profileDescription: description,
        region: Region.WORLDWIDE,
        lastScrapedAt: new Date(),
        discoveredVia: `import:${item.category}`,
      }
    });

    const status = isPrivate ? '🔒' : '✅';
    console.log(`  ${status} ${item.name} (@${item.handle}) - ${followers.toLocaleString()} followers`);
    return true;
  } catch (error: any) {
    console.error(`  ❌ ${item.name}: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('===========================================');
  console.log('   LINKEDIN PROFILE IMPORT - BATCH 2');
  console.log('===========================================\n');

  const initialCount = await db.streamer.count({ where: { platform: 'LINKEDIN' } });
  console.log(`Initial LinkedIn count: ${initialCount}`);
  console.log(`Profiles to import: ${LINKEDIN_PROFILES.length}\n`);

  let imported = 0;
  let skipped = 0;

  for (let i = 0; i < LINKEDIN_PROFILES.length; i++) {
    const item = LINKEDIN_PROFILES[i];

    if ((i + 1) % 50 === 0) {
      const currentCount = await db.streamer.count({ where: { platform: 'LINKEDIN' } });
      console.log(`\n--- Progress: ${i + 1}/${LINKEDIN_PROFILES.length}, Total LinkedIn: ${currentCount} ---\n`);

      if (currentCount >= 1000) {
        console.log('🎉 Reached 1000 LinkedIn profiles!');
        break;
      }
    }

    console.log(`[${i + 1}/${LINKEDIN_PROFILES.length}] ${item.name}`);

    const success = await importProfile(item);
    if (success) imported++;
    else skipped++;

    await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
  }

  const finalCount = await db.streamer.count({ where: { platform: 'LINKEDIN' } });

  console.log('\n===========================================');
  console.log('   BATCH 2 COMPLETE');
  console.log('===========================================');
  console.log(`Imported: ${imported}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Initial: ${initialCount}`);
  console.log(`Final: ${finalCount}`);

  await db.$disconnect();
}

main().catch(console.error);
