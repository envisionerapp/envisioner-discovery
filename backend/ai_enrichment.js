#!/usr/bin/env node
/**
 * AI Enrichment Script
 * Uses Claude Haiku to infer country/region and category from profile data
 * Cost-efficient: ~$1-2 for 15,000 profiles
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const Anthropic = require('@anthropic-ai/sdk').default;

const db = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Configuration
const BATCH_SIZE = 10; // Process 10 at a time for efficiency
const CONCURRENT_BATCHES = 3; // 3 concurrent API calls
const DELAY_BETWEEN_BATCHES = 500; // ms between batches to avoid rate limits

// Valid regions - MUST match Prisma schema enum exactly
const VALID_REGIONS = [
  // Latin America
  'MEXICO', 'COLOMBIA', 'ARGENTINA', 'CHILE', 'PERU', 'VENEZUELA', 'ECUADOR',
  'BOLIVIA', 'PARAGUAY', 'URUGUAY', 'COSTA_RICA', 'PANAMA', 'GUATEMALA',
  'EL_SALVADOR', 'HONDURAS', 'NICARAGUA', 'DOMINICAN_REPUBLIC', 'PUERTO_RICO', 'BRAZIL',
  'CUBA', 'JAMAICA', 'TRINIDAD_TOBAGO', 'HAITI',
  // North America
  'USA', 'CANADA',
  // Europe
  'UK', 'SPAIN', 'GERMANY', 'FRANCE', 'ITALY', 'PORTUGAL', 'NETHERLANDS',
  'SWEDEN', 'NORWAY', 'DENMARK', 'FINLAND', 'POLAND', 'RUSSIA',
  'AUSTRIA', 'BELGIUM', 'SWITZERLAND', 'IRELAND', 'GREECE', 'UKRAINE',
  'CZECH_REPUBLIC', 'ROMANIA', 'HUNGARY', 'TURKEY',
  // Middle East
  'UAE', 'SAUDI_ARABIA', 'ISRAEL', 'QATAR', 'KUWAIT', 'EGYPT',
  'JORDAN', 'LEBANON', 'IRAQ', 'IRAN',
  // Asia
  'JAPAN', 'KOREA', 'SOUTH_KOREA', 'CHINA', 'TAIWAN', 'HONG_KONG', 'INDIA',
  'PAKISTAN', 'BANGLADESH', 'SRI_LANKA', 'INDONESIA', 'PHILIPPINES', 'THAILAND',
  'VIETNAM', 'MALAYSIA', 'SINGAPORE', 'MYANMAR', 'CAMBODIA', 'NEPAL',
  // Africa
  'SOUTH_AFRICA', 'NIGERIA', 'MOROCCO', 'KENYA', 'GHANA', 'ALGERIA', 'TUNISIA',
  // Oceania
  'AUSTRALIA', 'NEW_ZEALAND',
  // Other
  'WORLDWIDE', 'OTHER'
];

// Valid categories
const VALID_CATEGORIES = [
  'Gaming', 'Variety', 'Just Chatting', 'IRL', 'Music', 'Sports', 'Esports',
  'Casino', 'Slots', 'Poker', 'Creative', 'Art', 'Cooking', 'Travel',
  'Education', 'Technology', 'News', 'Entertainment', 'Comedy', 'Fitness',
  'Beauty', 'Fashion', 'Lifestyle', 'Business', 'Finance', 'Crypto',
  'Science', 'Nature', 'Animals', 'Food', 'DIY', 'Automotive', 'ASMR',
  'Podcast', 'Talk Show', 'Reality', 'Dance', 'Vtuber', 'Anime',
  'Politics', 'Religion', 'Children', 'Paranormal'
];

// Stats tracking
const stats = {
  processed: 0,
  regionsInferred: 0,
  categoriesInferred: 0,
  errors: 0,
  skipped: 0,
  tokensUsed: { input: 0, output: 0 }
};

const startTime = Date.now();

function log(level, msg) {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const time = `${mins}:${secs.toString().padStart(2, '0')}`;
  const prefix = { 'INFO': '[INFO]', 'OK': '[ OK ]', 'WARN': '[WARN]', 'ERR': '[ERR ]' }[level] || '[???]';
  console.log(`${time} ${prefix} ${msg}`);
}

/**
 * Call Claude Haiku to infer region and category from profile data
 */
async function inferWithAI(profiles) {
  const profilesData = profiles.map(p => ({
    id: p.id,
    username: p.username,
    displayName: p.displayName,
    bio: (p.profileDescription || p.aboutSection || '').substring(0, 200),
    language: p.language,
    currentGame: p.inferredCategory || p.primaryCategory,
    tags: p.unifiedTags?.slice(0, 5) || [],
    platform: p.platform,
    currentRegion: p.region,
    currentCategory: p.primaryCategory
  }));

  const prompt = `Analyze these creator profiles and infer country/region and content category.

PROFILES:
${JSON.stringify(profilesData, null, 2)}

For each profile, determine:
1. REGION: Country based on bio, username, language. Use VALID_REGIONS only.
2. CATEGORY: Content type based on bio, tags. Use VALID_CATEGORIES only.

VALID_REGIONS: ${VALID_REGIONS.slice(0, 40).join(', ')}
VALID_CATEGORIES: ${VALID_CATEGORIES.join(', ')}

Only return profiles needing updates (confident inference). Skip if uncertain.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2000,
      system: 'You are a data enrichment assistant. Always respond using the provided tool.',
      messages: [{ role: 'user', content: prompt }],
      tools: [{
        name: 'update_profiles',
        description: 'Submit profile updates for region and category inference',
        input_schema: {
          type: 'object',
          properties: {
            updates: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Profile ID' },
                  region: { type: 'string', description: 'Inferred region (uppercase)' },
                  category: { type: 'string', description: 'Inferred category' },
                  confidence: { type: 'number', description: '0-1 confidence score' },
                  reasoning: { type: 'string', description: 'Brief explanation' }
                },
                required: ['id']
              },
              description: 'Array of profile updates'
            }
          },
          required: ['updates']
        }
      }],
      tool_choice: { type: 'tool', name: 'update_profiles' }
    });

    // Track token usage
    stats.tokensUsed.input += response.usage?.input_tokens || 0;
    stats.tokensUsed.output += response.usage?.output_tokens || 0;

    const toolUse = response.content.find(b => b.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') return [];

    const result = toolUse.input;
    return Array.isArray(result.updates) ? result.updates : [];

  } catch (error) {
    if (error.message?.includes('rate_limit')) {
      log('WARN', 'Rate limited, waiting 30s...');
      await sleep(30000);
      return inferWithAI(profiles); // Retry
    }
    log('ERR', `AI inference error: ${error.message}`);
    return [];
  }
}

/**
 * Update profile in database using raw SQL for regions (bypasses client enum validation)
 */
async function updateProfile(profileId, updates) {
  try {
    const hasRegion = updates.region && VALID_REGIONS.includes(updates.region) && updates.region !== 'OTHER';
    const hasCategory = updates.category && updates.category.toLowerCase() !== 'unknown';

    if (!hasRegion && !hasCategory) return false;

    // Use raw SQL for regions to bypass Prisma client enum validation
    // Table: discovery_creators, columns use snake_case (@map in schema)
    if (hasRegion && hasCategory) {
      await db.$executeRaw`
        UPDATE discovery_creators
        SET region = ${updates.region}::"Region",
            inferred_country = ${updates.region},
            inferred_country_source = 'AI_HAIKU',
            primary_category = ${updates.category},
            inferred_category = ${updates.category},
            inferred_category_source = 'AI_HAIKU'
        WHERE id = ${profileId}
      `;
    } else if (hasRegion) {
      await db.$executeRaw`
        UPDATE discovery_creators
        SET region = ${updates.region}::"Region",
            inferred_country = ${updates.region},
            inferred_country_source = 'AI_HAIKU'
        WHERE id = ${profileId}
      `;
    } else if (hasCategory) {
      await db.$executeRaw`
        UPDATE discovery_creators
        SET primary_category = ${updates.category},
            inferred_category = ${updates.category},
            inferred_category_source = 'AI_HAIKU'
        WHERE id = ${profileId}
      `;
    }

    return true;
  } catch (error) {
    log('ERR', `Failed to update ${profileId}: ${error.message}`);
    return false;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Process a batch of profiles
 */
async function processBatch(profiles) {
  if (profiles.length === 0) return;

  const inferences = await inferWithAI(profiles);

  for (const inference of inferences) {
    if (!inference.id) continue;

    const updated = await updateProfile(inference.id, inference);
    if (updated) {
      if (inference.region) stats.regionsInferred++;
      if (inference.category) stats.categoriesInferred++;

      const profile = profiles.find(p => p.id === inference.id);
      log('OK', `  @${profile?.username}: ${inference.region || '-'} / ${inference.category || '-'} (${Math.round(inference.confidence * 100)}%)`);
    }
  }

  stats.processed += profiles.length;
}

/**
 * Main enrichment process
 */
async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║          AI ENRICHMENT - Country & Category               ║
║          Using Claude Haiku for cost efficiency           ║
╚═══════════════════════════════════════════════════════════╝
`);

  // Count profiles needing enrichment
  const [otherRegionCount, unknownCategoryCount] = await Promise.all([
    db.streamer.count({ where: { region: 'OTHER' } }),
    db.streamer.count({
      where: {
        OR: [
          { primaryCategory: null },
          { primaryCategory: '' },
          { primaryCategory: { contains: 'unknown', mode: 'insensitive' } }
        ]
      }
    })
  ]);

  log('INFO', `Profiles with OTHER region: ${otherRegionCount.toLocaleString()}`);
  log('INFO', `Profiles with UNKNOWN category: ${unknownCategoryCount.toLocaleString()}`);

  // Fetch profiles needing enrichment (prioritize those with both issues)
  const profiles = await db.streamer.findMany({
    where: {
      OR: [
        { region: 'OTHER' },
        { primaryCategory: null },
        { primaryCategory: '' },
        { primaryCategory: { contains: 'unknown', mode: 'insensitive' } }
      ]
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      profileDescription: true,
      aboutSection: true,
      language: true,
      inferredCategory: true,
      unifiedTags: true,
      platform: true,
      region: true,
      primaryCategory: true,
      countryCode: true
    },
    orderBy: [
      { followers: 'desc' } // Prioritize high-follower profiles
    ]
  });

  log('INFO', `Found ${profiles.length.toLocaleString()} profiles to enrich`);
  log('INFO', `Batch size: ${BATCH_SIZE} | Concurrent: ${CONCURRENT_BATCHES}`);
  log('INFO', `Estimated cost: ~$${(profiles.length * 0.0001).toFixed(2)} (Haiku)`);
  console.log('');

  // Process in batches
  for (let i = 0; i < profiles.length; i += BATCH_SIZE * CONCURRENT_BATCHES) {
    const batchPromises = [];

    for (let j = 0; j < CONCURRENT_BATCHES; j++) {
      const startIdx = i + (j * BATCH_SIZE);
      const batch = profiles.slice(startIdx, startIdx + BATCH_SIZE);
      if (batch.length > 0) {
        batchPromises.push(processBatch(batch));
      }
    }

    await Promise.all(batchPromises);

    // Progress update
    const progress = Math.min(i + BATCH_SIZE * CONCURRENT_BATCHES, profiles.length);
    const pct = ((progress / profiles.length) * 100).toFixed(1);
    const rate = stats.processed / ((Date.now() - startTime) / 1000);

    if (progress % 100 === 0 || progress === profiles.length) {
      const costEstimate = ((stats.tokensUsed.input * 0.25 + stats.tokensUsed.output * 1.25) / 1000000).toFixed(4);
      log('INFO', `Progress: ${progress.toLocaleString()}/${profiles.length.toLocaleString()} (${pct}%) | ${rate.toFixed(1)}/sec | ~$${costEstimate}`);
    }

    await sleep(DELAY_BETWEEN_BATCHES);
  }

  // Final stats
  const elapsed = (Date.now() - startTime) / 1000;
  const totalCost = ((stats.tokensUsed.input * 0.25 + stats.tokensUsed.output * 1.25) / 1000000);

  console.log(`
═══════════════════════════════════════════════════════════
                    ENRICHMENT COMPLETE
═══════════════════════════════════════════════════════════
  Processed: ${stats.processed.toLocaleString()} profiles
  Regions inferred: ${stats.regionsInferred.toLocaleString()}
  Categories inferred: ${stats.categoriesInferred.toLocaleString()}
  Errors: ${stats.errors}

  Tokens used: ${stats.tokensUsed.input.toLocaleString()} input / ${stats.tokensUsed.output.toLocaleString()} output
  Estimated cost: $${totalCost.toFixed(4)}

  Time: ${Math.floor(elapsed / 60)}m ${Math.floor(elapsed % 60)}s
  Rate: ${(stats.processed / elapsed).toFixed(1)} profiles/sec
═══════════════════════════════════════════════════════════
`);

  await db.$disconnect();
}

// Run
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
