/**
 * Category Mapper - Maps games and content to standardized categories
 *
 * Categories:
 * - Gaming: All video games (Dota 2, Minecraft, GTA, etc.)
 * - iGaming: Casino/gambling content (Slots, Poker, Roulette, etc.)
 * - IRL: Real life content (Just Chatting, IRL streams)
 * - Music: Music performances and content
 * - Creative: Art, design, creative content
 * - Sports: Sports and fitness content
 * - Education: Educational and technology content
 */

export type Category =
  | 'Gaming'
  | 'iGaming'
  | 'IRL'
  | 'Music'
  | 'Creative'
  | 'Sports'
  | 'Education'
  | 'Variety';

// iGaming/Gambling games and keywords
const IGAMING_GAMES = new Set([
  // Casino games
  'slots', 'slots & casino', 'slot', 'casino', 'blackjack', 'roulette', 'poker',
  'baccarat', 'craps', 'keno', 'bingo', 'lottery',
  // Popular slot games
  'sweet bonanza', 'gates of olympus', 'big bass bonanza', 'book of dead',
  'starburst', 'gonzo\'s quest', 'mega moolah', 'dead or alive', 'reactoonz',
  'jammin jars', 'money train', 'fruit party', 'the dog house', 'wolf gold',
  'buffalo king', 'madame destiny', 'aztec gems', 'great rhino', 'john hunter',
  'razor shark', 'floating dragon', 'fire joker', 'book of ra', 'eye of horus',
  'crazy time', 'lightning roulette', 'monopoly live', 'dream catcher',
  // Betting
  'sports betting', 'betting', 'apuestas', 'apostas',
  // Spanish/Portuguese variants
  'tragamonedas', 'tragaperras', 'caça-níqueis', 'cassino',
]);

const IGAMING_KEYWORDS = [
  'casino', 'slot', 'gambling', 'betting', 'apuesta', 'aposta',
  'bonus', 'jackpot', 'spin', 'bet', 'wager', 'stake',
  'pragmatic', 'evolution gaming', 'netent', 'microgaming',
];

// IRL/Chatting content
const IRL_GAMES = new Set([
  'just chatting', 'irl', 'talk shows & podcasts', 'asmr', 'food & drink',
  'travel & outdoors', 'special events', 'pools, hot tubs, and beaches',
  'chat roulette', 'watch party', 'co-working & studying', 'sleep',
  'animals, aquariums, and zoos',
]);

// Music content
const MUSIC_GAMES = new Set([
  'music', 'music & performing arts', 'singing', 'dj', 'drums', 'guitar',
  'piano', 'karaoke', 'concerts',
]);

// Creative content
const CREATIVE_GAMES = new Set([
  'art', 'creative', 'makers & crafting', 'beauty & body art', 'drawing',
  'painting', 'digital art', 'sculpture', 'photography', 'design',
]);

// Sports content
const SPORTS_GAMES = new Set([
  'sports', 'fitness & health', 'boxing', 'mma', 'wrestling', 'soccer',
  'football', 'basketball', 'baseball', 'golf', 'tennis', 'racing',
  'martial arts', 'yoga', 'workout',
]);

// Education content
const EDUCATION_GAMES = new Set([
  'science & technology', 'software and game development', 'programming',
  'coding', 'tutorial', 'educational', 'technology',
]);

// Games that are definitely Gaming (not iGaming)
const GAMING_GAMES = new Set([
  // MOBAs
  'dota 2', 'league of legends', 'lol', 'heroes of the storm', 'smite',
  // FPS
  'counter-strike', 'cs:go', 'cs2', 'valorant', 'overwatch', 'overwatch 2',
  'call of duty', 'cod', 'apex legends', 'fortnite', 'pubg', 'pubg: battlegrounds',
  'blood strike', 'rainbow six siege', 'battlefield', 'halo', 'destiny 2',
  'team fortress 2', 'tf2', 'warzone', 'escape from tarkov',
  // Battle Royale
  'fortnite', 'apex legends', 'warzone', 'fall guys', 'pubg',
  // Sandbox/Survival
  'minecraft', 'roblox', 'terraria', 'rust', 'ark', 'ark: survival evolved',
  'dayz', 'valheim', '7 days to die', 'the forest', 'subnautica', 'raft',
  // RPG
  'world of warcraft', 'wow', 'final fantasy', 'ffxiv', 'ff14', 'diablo',
  'path of exile', 'poe', 'lost ark', 'elden ring', 'dark souls', 'skyrim',
  'the witcher', 'baldur\'s gate', 'genshin impact', 'honkai', 'zelda',
  // Sports games
  'fifa', 'ea fc', 'nba 2k', 'madden', 'rocket league', 'f1', 'gran turismo',
  // GTA
  'grand theft auto', 'gta', 'gta v', 'gta 5', 'grand theft auto v',
  'grand theft auto: san andreas', 'gta: san andreas', 'gta online',
  // Racing
  'forza', 'need for speed', 'nfs', 'mario kart', 'assetto corsa',
  // Strategy
  'starcraft', 'age of empires', 'aoe', 'civilization', 'civ', 'total war',
  'hearts of iron', 'crusader kings', 'europa universalis',
  // Horror
  'dead by daylight', 'dbd', 'phasmophobia', 'resident evil', 'outlast',
  'amnesia', 'silent hill', 'lethal company',
  // Fighting
  'street fighter', 'tekken', 'mortal kombat', 'super smash bros', 'smash',
  // Variety/Party
  'among us', 'fall guys', 'mario party', 'jackbox', 'gartic phone',
  // Other popular games
  'hearthstone', 'magic: the gathering', 'mtg arena', 'teamfight tactics', 'tft',
  'auto chess', 'chess', 'osu!', 'beat saber', 'vrchat', 'sea of thieves',
  'dead cells', 'hades', 'hollow knight', 'celeste', 'cuphead',
]);

/**
 * Infer category from game name, tags, and other content signals
 */
export function inferCategory(
  currentGame?: string | null,
  topGames?: string[] | null,
  tags?: string[] | null,
  description?: string | null
): Category {
  const gameLower = (currentGame || '').toLowerCase().trim();
  const allGames = [gameLower, ...(topGames || []).map(g => g.toLowerCase().trim())];
  const tagsLower = (tags || []).map(t => t.toLowerCase());
  const descLower = (description || '').toLowerCase();

  // 1. Check for iGaming first (highest priority for gambling content)
  for (const game of allGames) {
    if (IGAMING_GAMES.has(game)) {
      return 'iGaming';
    }
    // Check if game contains iGaming keywords
    for (const keyword of IGAMING_KEYWORDS) {
      if (game.includes(keyword)) {
        return 'iGaming';
      }
    }
  }

  // Check tags for iGaming
  const igamingTags = ['casino', 'slots', 'betting', 'poker', 'gambling', 'igaming'];
  if (tagsLower.some(t => igamingTags.includes(t))) {
    return 'iGaming';
  }

  // 2. Check for IRL
  for (const game of allGames) {
    if (IRL_GAMES.has(game)) {
      return 'IRL';
    }
  }
  if (tagsLower.includes('irl')) {
    return 'IRL';
  }

  // 3. Check for Music
  for (const game of allGames) {
    if (MUSIC_GAMES.has(game)) {
      return 'Music';
    }
  }
  if (tagsLower.includes('music')) {
    return 'Music';
  }

  // 4. Check for Creative
  for (const game of allGames) {
    if (CREATIVE_GAMES.has(game)) {
      return 'Creative';
    }
  }
  if (tagsLower.includes('art') || tagsLower.includes('creative')) {
    return 'Creative';
  }

  // 5. Check for Sports
  for (const game of allGames) {
    if (SPORTS_GAMES.has(game)) {
      return 'Sports';
    }
  }
  if (tagsLower.includes('sports') || tagsLower.includes('fitness')) {
    return 'Sports';
  }

  // 6. Check for Education
  for (const game of allGames) {
    if (EDUCATION_GAMES.has(game)) {
      return 'Education';
    }
  }
  if (tagsLower.includes('education') || tagsLower.includes('technology')) {
    return 'Education';
  }

  // 7. Check for explicit Gaming games
  for (const game of allGames) {
    if (GAMING_GAMES.has(game)) {
      return 'Gaming';
    }
  }

  // 8. If it has GAMING tag or looks like a game, classify as Gaming
  if (tagsLower.includes('gaming') || tagsLower.some(t =>
    ['fps', 'rpg', 'strategy', 'simulation', 'horror', 'adventure', 'variety'].includes(t)
  )) {
    return 'Gaming';
  }

  // 9. If there's a game name that's not empty and not in other categories, assume Gaming
  if (gameLower && gameLower !== '' && !IRL_GAMES.has(gameLower)) {
    return 'Gaming';
  }

  // Default to Variety
  return 'Variety';
}

/**
 * Check if a game is related to Gaming (covers all games)
 */
export function isGamingRelated(game?: string | null): boolean {
  if (!game) return false;
  const gameLower = game.toLowerCase().trim();

  // If it's in iGaming, IRL, Music, Creative, Sports, or Education - it's NOT gaming
  if (IGAMING_GAMES.has(gameLower)) return false;
  if (IRL_GAMES.has(gameLower)) return false;
  if (MUSIC_GAMES.has(gameLower)) return false;
  if (CREATIVE_GAMES.has(gameLower)) return false;
  if (SPORTS_GAMES.has(gameLower)) return false;
  if (EDUCATION_GAMES.has(gameLower)) return false;

  // Check for iGaming keywords
  for (const keyword of IGAMING_KEYWORDS) {
    if (gameLower.includes(keyword)) return false;
  }

  // If it's in the Gaming set OR it's a non-empty game name, it's gaming
  if (GAMING_GAMES.has(gameLower)) return true;

  // Any other non-empty game is likely gaming
  return gameLower.length > 0;
}

/**
 * Get all categories for frontend filter options
 */
export function getAllCategories(): Category[] {
  return ['Gaming', 'iGaming', 'IRL', 'Music', 'Creative', 'Sports', 'Education', 'Variety'];
}
