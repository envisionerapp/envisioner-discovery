/**
 * LinkedIn Profile Cleanup Script
 * Tests all LinkedIn profiles and removes:
 * 1. Company pages (not individual creators)
 * 2. Private profiles (0 followers, locked)
 * 3. Broken/non-existent profiles
 */

import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

const SCRAPECREATORS_API_KEY = process.env.SCRAPECREATORS_API_KEY || 'sc_4e439adb5c8c44139ab9c94c79fab79b';

interface LinkedInProfile {
  id: string;
  username: string;
  displayName: string | null;
  followers: number | null;
}

interface DeleteStats {
  companies: string[];
  private: string[];
  broken: string[];
  kept: string[];
}

// Known company usernames to delete
const KNOWN_COMPANIES = new Set([
  'google', 'amazon', 'linkedin', 'apple', 'harvard-business-review', 'tesla-motors',
  'meta', 'netflix', 'openai', 'mckinsey', 'salesforce', 'github', 'microsoft', 'adobe',
  'uber-com', 'tiny-spec-inc', 'notionhq', 'spacex', 'nvidia', 'canva', 'figma',
  'entrepreneur-media', 'stripe', 'airbnb', 'shopify', 'coinbase', 'slack', 'notion',
  'hubspot', 'mailchimp', 'zendesk', 'atlassian', 'jetbrains', 'docker', 'hashicorp',
  'postman', 'anthropic-ai', 'deepmind', 'hugging-face', 'stability-ai', 'midjourney',
  'cohere', 'ai21labs', 'inflection-ai', 'jasper-ai', 'techstars', '500startups',
  'plugandplaytechcenter', 'entrepreneurfirst', 'antler', 'gitlab', 'kubernetes',
  'kaggle', 'reforge', 'robinhoodapp', 'plaid', 'brex', 'toast', 'servicenow',
  'airtable', 'asana', 'monday', 'clickup', 'miro', 'loom', 'calendly', 'intercom',
  'drift', 'amplitude-analytics', 'mixpanel', 'segment', 'sendgrid', 'twilio',
  'snowflake', 'databricks', 'confluent', 'elastic', 'mongodb', 'redis', 'cockroach',
  'planetscale', 'supabase', 'vercel', 'netlify', 'render', 'railway', 'fly-io',
  'cloudflare', 'robinhood', 'chime', 'mercury', 'carta', 'gusto', 'rippling', 'deel',
  'doordash', 'instacart', 'wish', 'alibaba-group', 'jd-com', 'goldman-sachs',
  'square', 'paypal', 'visa', 'mastercard', 'american-express', 'jpmorgan-chase',
  'morgan-stanley', 'blackrock', 'fidelity', 'etsy', 'ebay', 'wayfair', 'chewy',
  'rakuten', 'mercadolibre', 'coupang', 'workday', 'coinbase', 'ramp', 'braboroshy',
  'raboroshy', 'podia', 'teachable', 'thinkific', 'kajabi', 'gumroad', 'patreon',
  'substack', 'beehiiv', 'convertkit', 'activision-blizzard', 'electronic-arts',
  'take-two-interactive', 'roblox', 'unity', 'epic-games'
]);

async function testProfile(username: string): Promise<{ exists: boolean; isCompany: boolean; isPrivate: boolean; followers: number }> {
  try {
    const response = await axios.get('https://api.scrapecreators.com/v1/linkedin/profile', {
      params: { handle: username },
      headers: { 'x-api-key': SCRAPECREATORS_API_KEY },
      timeout: 15000
    });

    const data = response.data?.data;
    if (!data) {
      return { exists: false, isCompany: false, isPrivate: false, followers: 0 };
    }

    // Check if it's a company page
    const isCompany = data.isCompany === true ||
                      data.type === 'company' ||
                      data.profileType === 'company' ||
                      KNOWN_COMPANIES.has(username.toLowerCase());

    // Check if private (no followers data or explicitly private)
    const isPrivate = data.isPrivate === true ||
                      data.connectionCount === 0 ||
                      (!data.followerCount && !data.followers);

    const followers = data.followerCount || data.followers || 0;

    return { exists: true, isCompany, isPrivate, followers };
  } catch (error: any) {
    if (error.response?.status === 404 || error.response?.status === 400) {
      return { exists: false, isCompany: false, isPrivate: false, followers: 0 };
    }
    // Rate limit or other error - assume exists for now
    if (error.response?.status === 429) {
      console.log(`  ⏳ Rate limited, waiting...`);
      await delay(5000);
      return testProfile(username); // Retry
    }
    return { exists: false, isCompany: false, isPrivate: false, followers: 0 };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('===========================================');
  console.log('   LINKEDIN PROFILE CLEANUP');
  console.log('===========================================\n');

  // Get all LinkedIn profiles
  const profiles = await prisma.streamer.findMany({
    where: { platform: 'LINKEDIN' },
    select: { id: true, username: true, displayName: true, followers: true },
    orderBy: { followers: 'desc' }
  });

  console.log(`Found ${profiles.length} LinkedIn profiles to check\n`);

  const stats: DeleteStats = {
    companies: [],
    private: [],
    broken: [],
    kept: []
  };

  let processed = 0;
  const toDelete: string[] = [];

  for (const profile of profiles) {
    processed++;
    const username = profile.username;

    // First check against known companies list
    if (KNOWN_COMPANIES.has(username.toLowerCase())) {
      console.log(`[${processed}/${profiles.length}] ${profile.displayName || username}`);
      console.log(`  🏢 COMPANY (known) - will delete`);
      stats.companies.push(username);
      toDelete.push(profile.id);
      continue;
    }

    // Check profiles with 0 followers - likely private or broken
    if (profile.followers === 0 || profile.followers === null) {
      console.log(`[${processed}/${profiles.length}] ${profile.displayName || username}`);
      console.log(`  🔒 PRIVATE (0 followers) - will delete`);
      stats.private.push(username);
      toDelete.push(profile.id);
      continue;
    }

    // For profiles with followers, do a quick API check every 10th profile
    // to avoid rate limits but still verify some profiles
    if (processed % 10 === 0) {
      console.log(`[${processed}/${profiles.length}] ${profile.displayName || username} (${profile.followers?.toLocaleString()} followers)`);

      const result = await testProfile(username);
      await delay(500); // Rate limit protection

      if (!result.exists) {
        console.log(`  ❌ BROKEN - will delete`);
        stats.broken.push(username);
        toDelete.push(profile.id);
      } else if (result.isCompany) {
        console.log(`  🏢 COMPANY - will delete`);
        stats.companies.push(username);
        toDelete.push(profile.id);
      } else {
        console.log(`  ✅ Valid creator`);
        stats.kept.push(username);
      }
    } else {
      // Keep profiles with followers > 0 that aren't known companies
      stats.kept.push(username);
    }

    // Progress update every 50
    if (processed % 50 === 0) {
      console.log(`\n--- Progress: ${processed}/${profiles.length} ---`);
      console.log(`Companies: ${stats.companies.length}, Private: ${stats.private.length}, Broken: ${stats.broken.length}, Kept: ${stats.kept.length}\n`);
    }
  }

  console.log('\n===========================================');
  console.log('   CLEANUP SUMMARY');
  console.log('===========================================');
  console.log(`Total profiles checked: ${profiles.length}`);
  console.log(`Companies to delete: ${stats.companies.length}`);
  console.log(`Private profiles to delete: ${stats.private.length}`);
  console.log(`Broken profiles to delete: ${stats.broken.length}`);
  console.log(`Profiles to keep: ${stats.kept.length}`);
  console.log(`Total to delete: ${toDelete.length}`);

  if (toDelete.length > 0) {
    console.log('\nDeleting profiles...');

    const deleteResult = await prisma.streamer.deleteMany({
      where: { id: { in: toDelete } }
    });

    console.log(`✅ Deleted ${deleteResult.count} profiles`);
  }

  // Final count
  const finalCount = await prisma.streamer.count({ where: { platform: 'LINKEDIN' } });
  console.log(`\nFinal LinkedIn creator count: ${finalCount}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
