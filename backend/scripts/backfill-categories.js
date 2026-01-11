/**
 * Backfill categories for existing streamers
 * This script populates primaryCategory and inferredCategory based on currentGame
 */

const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();

// Same category mapping logic as categoryMapper.ts
const IGAMING_GAMES = new Set([
  'slots', 'slots & casino', 'slot', 'casino', 'blackjack', 'roulette', 'poker',
  'baccarat', 'craps', 'keno', 'bingo', 'lottery',
  'sweet bonanza', 'gates of olympus', 'big bass bonanza', 'book of dead',
  'starburst', 'crazy time', 'lightning roulette', 'monopoly live',
  'tragamonedas', 'tragaperras', 'caça-níqueis', 'cassino',
]);

const IGAMING_KEYWORDS = [
  'casino', 'slot', 'gambling', 'betting', 'apuesta', 'aposta',
  'bonus', 'jackpot', 'pragmatic', 'evolution gaming',
];

const IRL_GAMES = new Set([
  'just chatting', 'irl', 'talk shows & podcasts', 'asmr', 'food & drink',
  'travel & outdoors', 'special events', 'pools, hot tubs, and beaches',
  'chat roulette', 'watch party', 'co-working & studying', 'sleep',
]);

const MUSIC_GAMES = new Set([
  'music', 'music & performing arts', 'singing', 'dj', 'drums', 'guitar', 'piano',
]);

const CREATIVE_GAMES = new Set([
  'art', 'creative', 'makers & crafting', 'beauty & body art', 'drawing', 'painting',
]);

const SPORTS_GAMES = new Set([
  'sports', 'fitness & health', 'boxing', 'mma', 'wrestling', 'soccer', 'football',
]);

const EDUCATION_GAMES = new Set([
  'science & technology', 'software and game development', 'programming', 'coding',
]);

function inferCategory(currentGame, tags) {
  const gameLower = (currentGame || '').toLowerCase().trim();
  const tagsLower = (tags || []).map(t => t.toLowerCase());

  // Check iGaming first
  if (IGAMING_GAMES.has(gameLower)) return 'iGaming';
  for (const keyword of IGAMING_KEYWORDS) {
    if (gameLower.includes(keyword)) return 'iGaming';
  }
  if (tagsLower.some(t => ['casino', 'slots', 'betting', 'poker', 'gambling', 'igaming'].includes(t))) {
    return 'iGaming';
  }

  // Check IRL
  if (IRL_GAMES.has(gameLower)) return 'IRL';
  if (tagsLower.includes('irl')) return 'IRL';

  // Check Music
  if (MUSIC_GAMES.has(gameLower)) return 'Music';
  if (tagsLower.includes('music')) return 'Music';

  // Check Creative
  if (CREATIVE_GAMES.has(gameLower)) return 'Creative';
  if (tagsLower.includes('art') || tagsLower.includes('creative')) return 'Creative';

  // Check Sports
  if (SPORTS_GAMES.has(gameLower)) return 'Sports';
  if (tagsLower.includes('sports') || tagsLower.includes('fitness')) return 'Sports';

  // Check Education
  if (EDUCATION_GAMES.has(gameLower)) return 'Education';
  if (tagsLower.includes('education') || tagsLower.includes('technology')) return 'Education';

  // Check Gaming tags
  if (tagsLower.includes('gaming') || tagsLower.some(t =>
    ['fps', 'rpg', 'strategy', 'simulation', 'horror', 'adventure', 'variety'].includes(t)
  )) {
    return 'Gaming';
  }

  // If there's a non-empty game name, assume Gaming
  if (gameLower && !IRL_GAMES.has(gameLower)) {
    return 'Gaming';
  }

  return 'Variety';
}

async function main() {
  console.log('Starting category backfill...');

  // Get all streamers without inferredCategory
  const streamers = await db.streamer.findMany({
    where: {
      inferredCategory: null
    },
    select: {
      id: true,
      platform: true,
      currentGame: true,
      tags: true,
      displayName: true,
    }
  });

  console.log(`Found ${streamers.length} streamers without category`);

  let updated = 0;
  const batchSize = 100;

  for (let i = 0; i < streamers.length; i += batchSize) {
    const batch = streamers.slice(i, i + batchSize);

    await Promise.all(batch.map(async (streamer) => {
      const category = inferCategory(streamer.currentGame, streamer.tags);

      await db.streamer.update({
        where: { id: streamer.id },
        data: {
          primaryCategory: category,
          inferredCategory: category,
          inferredCategorySource: streamer.platform,
        }
      });
    }));

    updated += batch.length;
    console.log(`Updated ${updated}/${streamers.length} streamers...`);
  }

  // Show category distribution
  const stats = await db.streamer.groupBy({
    by: ['inferredCategory'],
    _count: { id: true },
  });

  console.log('\nCategory distribution:');
  for (const stat of stats) {
    console.log(`  ${stat.inferredCategory || 'NULL'}: ${stat._count.id}`);
  }

  console.log(`\nBackfill complete! Updated ${updated} streamers.`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
