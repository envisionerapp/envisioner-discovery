/**
 * Massive LinkedIn Discovery from YouTube Channels
 *
 * This script contains a comprehensive list of 500+ YouTube channels
 * from tech, business, finance, marketing, and professional domains
 * that are likely to have LinkedIn profiles.
 */

import axios from 'axios';
import { db, logger } from '../src/utils/database';
import { Platform, Region } from '@prisma/client';
import { bunnyService } from '../src/services/bunnyService';

const SCRAPECREATORS_API_KEY = process.env.SCRAPECREATORS_API_KEY || 'qJY95WcDxCStfw9idIub8a04Cyr1';
const RATE_LIMIT_MS = 250;

// Massive list of professional/business YouTube channels
const YOUTUBE_CHANNELS = [
  // Tech & Programming
  'Fireship', 'TraversyMedia', 'WebDevSimplified', 'TheCodingTrain', 'DerekBanas',
  'ProgrammingWithMosh', 'sentdex', 'CoreySchafer', 'TechWithTim', 'thenewboston',
  'LearnCode.academy', 'DevTips', 'LevelUpTuts', 'academind', 'HiteshChoudhary',
  'CodeWithChris', 'SonnySangha', 'JackHerrington', 'TheoLivesHere', 'HealthyGamerGG',
  'NetworkChuck', 'DavidBombal', 'JohnHammond', 'LiveOverflow', 'HackerSploit',
  'NullByte', 'PwnFunction', 'Computerphile', 'Numberphile', 'SebastianLague',
  // Software Engineering
  'ContinuousDelivery', 'hussaborjas', 'CodeAesthetic', 'ArjanCodes', 'mCoding',
  'AnthonyGG', 'HealthyDevLife', 'PolyMatter', 'WendoverProductions', 'RealEngineering',
  'PracticalEngineeringChannel', 'SmartEveryDay', 'MarkRober', 'StuffMadeHere', 'ColinfurzeClips',
  // Business & Entrepreneurship
  'GaryVaynerchuk', 'PatrickBetDavid', 'EvanCarmichael', 'BrianTracey', 'GrantCardone',
  'TaiLopez', 'DanLok', 'ClayTravis', 'TomFerry', 'GrantCardone',
  'AlexHormozi', 'CodieSanchez', 'MyFirstMillion', 'TheFutur', 'ChrisDo',
  'VanityFairVF', 'BigThink', 'TED', 'TEDxTalks', 'TEDEd',
  'HarvardBusinessReview', 'Entrepreneur', 'Forbes', 'Inc', 'FastCompany',
  'Wired', 'TheVerge', 'TechCrunch', 'Bloomberg', 'CNBC',
  'YahooFinance', 'TheMotleyFool', 'InvestorPlace', 'SeekingAlpha', 'Benzinga',
  // Finance & Investing
  'GrahamStephan', 'AndreJikh', 'TheFinancialDiet', 'BeatTheBush', 'DaveRamsey',
  'TheMoneyGuy', 'TwoSidesTVFinance', 'WhiteboardFinance', 'BenFelix', 'FinancialEducation',
  'AkersInvestments', 'JosephCarlson', 'MeetKevin', 'MinorityMindset', 'MarkTilbury',
  'NateCavalieri', 'BrianJung', 'CharlieChang', 'JakeTran', 'ColdFusion',
  // Marketing & Sales
  'NeilPatel', 'GaryVee', 'RussellBrunson', 'DigitalMarketer', 'SocialMediaExaminer',
  'Hubspot', 'Moz', 'Ahrefs', 'Semrush', 'Backlinko',
  'AmyPorterfield', 'PatFlynn', 'MarieFloreo', 'JasmineStar', 'SunnLenarduzzi',
  'VidIQ', 'TubeBuddy', 'ThinkMedia', 'VideoCreators', 'ChannelMakers',
  // Leadership & Self Development
  'SimonSinek', 'TonyRobbins', 'JimRohn', 'LesLes Brown', 'BrianTracy',
  'RobinSharma', 'JordanBPeterson', 'JockoWillink', 'TimFerriss', 'JocelynKGlei',
  'MattDAvella', 'ThomasFrank', 'AliAbdaal', 'CaptainSinbad', 'MikeBoyds',
  'YesTheory', 'DrKBerg', 'JeffreySchwartz', 'DerrenBrown', 'JordanHarbinger',
  // Science & Education
  'Veritasium', 'SmarterEveryDay', 'Vsauce', 'Kurzgesagt', 'MinutePhysics',
  'SciShow', 'CrashCourse', 'TomScott', 'CGPGrey', 'Vsauce2',
  'Vsauce3', 'Vox', 'ScienceDaily', 'NationalGeographic', 'Discovery',
  'DrAndre', 'MedCram', 'DrEricBerg', 'Dr. Mike', 'NutritionFacts',
  // Tech Companies & Products
  'Google', 'Microsoft', 'Apple', 'Amazon', 'Meta',
  'Tesla', 'SpaceX', 'NVIDIA', 'Intel', 'AMD',
  'Salesforce', 'Oracle', 'SAP', 'Adobe', 'Autodesk',
  'Atlassian', 'MongoDB', 'Datadog', 'Snowflake', 'Palantir',
  'Stripe', 'Square', 'PayPal', 'Coinbase', 'Robinhood',
  // Startups & VC
  'YCombinator', 'a16z', 'Sequoia', 'Accel', 'Benchmark',
  'FirstRound', 'GraylockPartners', 'NfX', 'LightspeedVP', 'Index',
  'TechStars', '500Global', 'Founder', 'StartupGrind', 'ProductHunt',
  // Spanish Business
  'FrancoisPouzet', 'ThePowerMBA', 'Domestika', 'Platzi', 'MiFinancer',
  'InversorGlobal', 'AndyGarciaOficial', 'JulioPotier', 'HectorDeleon', 'VictorMartin',
  'RobertoMartinezCoach', 'CarlosGalvez', 'HugoParra', 'SerEmprende', 'Emprendetv',
  // Portuguese Business
  'PrimoRico', 'MePoupe', 'NathaliaArcuri', 'ThiagoNigro', 'FlaviaVassallo',
  'GuilhermeAffonsoFilho', 'PedroSobral', 'EricoRocha', 'JonathanGil', 'LucianoBruno',
  // Podcasts with LinkedIn presence
  'LexFridman', 'HubermanLab', 'JoeRoganPodcast', 'TimFerrisShow', 'AllIn',
  'MyFirstMillionPodcast', 'IndieHackers', 'AcquiredPodcast', 'Invest', 'TheKnowledgeProject',
  'PodcastNotes', 'MastersOfScale', 'HowIBuiltThis', 'StartupPodcast', 'TwentyMinuteVC',
  // Career & HR
  'LinkedInLearning', 'Glassdoor', 'Indeed', 'ZipRecruiter', 'Monster',
  'CareerFoundry', 'Springboard', 'Udacity', 'Coursera', 'edX',
  'Udemy', 'Skillshare', 'MasterClass', 'LinkedIn', 'Handshake',
  // News & Media
  'WSJ', 'NYTimes', 'WashingtonPost', 'TheGuardian', 'BBCNews',
  'CNN', 'FoxBusiness', 'CBSNews', 'NBCNews', 'ABCNews',
  'Reuters', 'AP', 'AFPNews', 'Axios', 'Politico',
  // Additional Tech Educators
  'BroCode', 'FreeCodeCamp', 'TheOrganicChemistryTutor', 'MITOpenCourseWare', 'StanfordOnline',
  'HarvardOnline', 'YaleCourses', 'PrincetonUniversity', 'CaltechChannel', 'BerkeleyHaasSchool',
  // More Business Channels
  'BusinessInsider', 'Entrepreneur.com', 'IncMagazine', 'FastCoJetty', 'SuccessArchive',
  'EconomicsExplained', 'TwoSidesEconomics', 'PatrickBetDavidPodcast', 'BEPodcast', 'EntrepreneurPodcast',
  // Real Estate & Finance
  'BiggerPockets', 'GrantCardoneTV', 'KenMcElroy', 'MaxMaxwell', 'KrisMKrohn',
  'RyanSerhant', 'SoldbyRoman', 'RealEstateSkills', 'FlipAnything', 'WholesalingInc',
  // E-commerce & Digital Business
  'Shopify', 'BigCommerce', 'WooCommerce', 'Oberlo', 'PrintfulOfficial',
  'WholesaleTed', 'SebastianGhiorghiu', 'GabrielStGermain', 'BrennanValenzuela', 'KevinDavid',
  'ODiRecta', 'SarahChrisman', 'VeronicaJeans', 'BradSugars', 'ActionCoach',
  // AI & Machine Learning
  'TwoMinutePapers', 'YannicKilcher', 'SentDex', 'DeepLearningAI', 'StanfordMLSystems',
  'MITDeepLearning', 'GoogleAI', 'OpenAI', 'DeepMind', 'AIExplained',
  'AssemblyAI', 'HuggingFace', 'Anthropic', 'Nvidia', 'IntelAI',
  // Consulting & Strategy
  'McKinsey', 'BCG', 'Bain', 'Deloitte', 'EY',
  'PwC', 'KPMG', 'Accenture', 'CapGemini', 'Cognizant',
  'Infosys', 'TCS', 'Wipro', 'HCL', 'TechMahindra',
  // Design & Creative
  'TheFliteTest', 'PeterMcKinnon', 'MKBHDCollab', 'iJustine', 'UnboxTherapy',
  'LinusTechTips', 'JerryRigEverything', 'DaveLeeBB', 'MrWhoseTheBoss', 'SuperSaf',
  'TechLinked', 'ShortCircuit', 'TLDToday', 'Techquickie', 'Hardware',
  // More International
  'BBCBusiness', 'FinancialTimes', 'TheEconomist', 'Monocle24', 'DWBusiness',
  'FranceFinance', 'RTBusiness', 'ChinaDaily', 'SCMP', 'NikkeiAsia',
  // Crypto & Web3
  'Coinbureau', 'Bankless', 'BitBoy', 'AltcoinDaily', 'BenjaminCowen',
  'DataDash', 'CryptosRUs', 'TheMoonCarl', 'IvanOnTech', 'ChicoCrypto',
  'PaulBarron', 'LayahHeilpern', 'CryptoCapitalVenture', 'TokenMetrics', 'Raoul',
  // Additional Professional
  'LinkedInNews', 'MicrosoftWorkplace', 'GoogleWorkspace', 'SlackHQ', 'NotionHQ',
  'FigmaDesign', 'Canva', 'Miro', 'Monday', 'Asana',
  'Trello', 'Airtable', 'Coda', 'ClickUp', 'Todoist',
];

function extractLinkedInHandle(url: string): string | null {
  const match = url.match(/linkedin\.com\/(?:in|company)\/([^/?#]+)/i);
  return match ? match[1] : null;
}

function getHighestResAvatar(avatar: any): string | null {
  const sources = avatar?.image?.sources;
  if (!sources || sources.length === 0) return null;
  const sorted = [...sources].sort((a, b) => (b.width || 0) - (a.width || 0));
  return sorted[0]?.url || null;
}

async function fetchYouTubeChannel(handle: string): Promise<any> {
  try {
    const url = handle.startsWith('http') ? handle : `https://www.youtube.com/@${handle}`;
    const response = await axios.get('https://api.scrapecreators.com/v1/youtube/channel', {
      headers: { 'x-api-key': SCRAPECREATORS_API_KEY },
      params: { url },
      timeout: 30000
    });
    if (!response.data?.success) return null;
    return response.data;
  } catch (error: any) {
    return null;
  }
}

async function createLinkedInEntry(
  linkedinUrl: string,
  ytName: string,
  ytUsername: string,
  avatarUrl?: string
): Promise<boolean> {
  const handle = extractLinkedInHandle(linkedinUrl);
  if (!handle) return false;

  try {
    const existing = await db.streamer.findUnique({
      where: {
        platform_username: { platform: 'LINKEDIN', username: handle.toLowerCase() }
      }
    });

    if (existing) {
      return false;
    }

    let cdnAvatarUrl = avatarUrl;
    if (avatarUrl) {
      try {
        cdnAvatarUrl = await bunnyService.uploadLinkedInAvatar(handle, avatarUrl);
      } catch (e) {}
    }

    await db.streamer.create({
      data: {
        platform: 'LINKEDIN',
        username: handle.toLowerCase(),
        displayName: ytName || handle,
        profileUrl: linkedinUrl.startsWith('http') ? linkedinUrl : `https://${linkedinUrl}`,
        avatarUrl: cdnAvatarUrl || undefined,
        followers: 0,
        profileDescription: `From YouTube: @${ytUsername}`,
        region: Region.WORLDWIDE,
        lastScrapedAt: new Date(),
        discoveredVia: `youtube:@${ytUsername}`,
        socialLinks: [`https://youtube.com/@${ytUsername}`],
      }
    });

    console.log(`  ✅ Created LinkedIn: ${handle}`);
    return true;
  } catch (error: any) {
    console.error(`  ❌ Error creating ${handle}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('===========================================');
  console.log('   MASSIVE LINKEDIN DISCOVERY');
  console.log('===========================================\n');

  const initialCount = await db.streamer.count({ where: { platform: 'LINKEDIN' } });
  console.log(`Initial LinkedIn count: ${initialCount}`);
  console.log(`Processing ${YOUTUBE_CHANNELS.length} channels\n`);

  let processed = 0;
  let linkedinCreated = 0;
  let notFound = 0;
  let noLinkedin = 0;
  let alreadyExists = 0;

  for (const handle of YOUTUBE_CHANNELS) {
    processed++;

    if (processed % 50 === 0) {
      const currentCount = await db.streamer.count({ where: { platform: 'LINKEDIN' } });
      console.log(`\n--- Progress: ${processed}/${YOUTUBE_CHANNELS.length}, LinkedIn: ${currentCount} (+${currentCount - initialCount}) ---\n`);
    }

    console.log(`[${processed}/${YOUTUBE_CHANNELS.length}] @${handle}`);

    const data = await fetchYouTubeChannel(handle);
    if (!data) {
      notFound++;
      console.log(`  ⚠️ Not found`);
      await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
      continue;
    }

    // Look for LinkedIn
    let linkedinUrl = data.linkedin;
    if (!linkedinUrl && data.links) {
      linkedinUrl = data.links.find((l: string) => l?.toLowerCase().includes('linkedin.com'));
    }

    if (linkedinUrl) {
      const avatarUrl = getHighestResAvatar(data.avatar);
      const created = await createLinkedInEntry(linkedinUrl, data.name, handle, avatarUrl || undefined);
      if (created) {
        linkedinCreated++;
      } else {
        alreadyExists++;
        console.log(`  ⏭️ Already exists`);
      }
    } else {
      noLinkedin++;
      console.log(`  ❌ No LinkedIn`);
    }

    await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
  }

  const finalCount = await db.streamer.count({ where: { platform: 'LINKEDIN' } });

  console.log('\n===========================================');
  console.log('   MASSIVE DISCOVERY COMPLETE');
  console.log('===========================================');
  console.log(`Channels processed: ${processed}`);
  console.log(`Not found: ${notFound}`);
  console.log(`No LinkedIn: ${noLinkedin}`);
  console.log(`Already exists: ${alreadyExists}`);
  console.log(`New LinkedIn created: ${linkedinCreated}`);
  console.log(`Initial LinkedIn: ${initialCount}`);
  console.log(`Final LinkedIn: ${finalCount}`);

  await db.$disconnect();
}

main().catch(console.error);
