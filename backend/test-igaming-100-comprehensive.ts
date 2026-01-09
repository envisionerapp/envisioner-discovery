import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const API_BASE_URL = 'http://localhost:8080';
const AUTH_TOKEN = ''; // Will be set after login

interface TestCase {
  id: number;
  query: string;
  expectedFilters: {
    regions?: string[];
    platforms?: string[];
    tags?: string[];
    minCount?: number;
    maxCount?: number;
  };
  category: string;
}

interface TestResult {
  testId: number;
  query: string;
  category: string;
  success: boolean;
  passed: boolean;
  returnedCount: number;
  expectedCount: { min?: number; max?: number };
  filters: any;
  streamers: any[];
  errors: string[];
  warnings: string[];
  processingTime?: number;
}

// 100 comprehensive test cases for iGaming campaigns
const TEST_CASES: TestCase[] = [
  // Chile betting campaigns (1-10)
  { id: 1, query: "I need 40 Chile streamers for a betting campaign", expectedFilters: { regions: ['CHILE'], tags: ['betting', 'casino', 'gambling'], minCount: 40, maxCount: 40 }, category: 'Chile Betting' },
  { id: 2, query: "Find 50 Chilean casino streamers", expectedFilters: { regions: ['CHILE'], tags: ['casino'], minCount: 50, maxCount: 50 }, category: 'Chile Betting' },
  { id: 3, query: "Give me 30 Chile streamers who play slots", expectedFilters: { regions: ['CHILE'], tags: ['slots'], minCount: 30, maxCount: 30 }, category: 'Chile Betting' },
  { id: 4, query: "I want 60 Chile gambling influencers", expectedFilters: { regions: ['CHILE'], tags: ['gambling'], minCount: 60, maxCount: 60 }, category: 'Chile Betting' },
  { id: 5, query: "Show me 45 Chilean poker streamers", expectedFilters: { regions: ['CHILE'], tags: ['poker'], minCount: 45, maxCount: 45 }, category: 'Chile Betting' },
  { id: 6, query: "Find 35 Chile streamers for online betting promotion", expectedFilters: { regions: ['CHILE'], tags: ['betting'], minCount: 35, maxCount: 35 }, category: 'Chile Betting' },
  { id: 7, query: "I need 25 Chilean roulette streamers", expectedFilters: { regions: ['CHILE'], tags: ['roulette'], minCount: 25, maxCount: 25 }, category: 'Chile Betting' },
  { id: 8, query: "Get me 55 Chile casino gaming influencers", expectedFilters: { regions: ['CHILE'], tags: ['casino'], minCount: 55, maxCount: 55 }, category: 'Chile Betting' },
  { id: 9, query: "Find 40 Chilean streamers for sports betting campaign", expectedFilters: { regions: ['CHILE'], tags: ['betting', 'sports'], minCount: 40, maxCount: 40 }, category: 'Chile Betting' },
  { id: 10, query: "I want 50 Chile streamers for Betano campaign", expectedFilters: { regions: ['CHILE'], tags: ['betting', 'casino'], minCount: 50, maxCount: 50 }, category: 'Chile Betting' },

  // Mexico betting campaigns (11-20)
  { id: 11, query: "I need 100 Mexico casino streamers", expectedFilters: { regions: ['MEXICO'], tags: ['casino'], minCount: 100, maxCount: 100 }, category: 'Mexico Betting' },
  { id: 12, query: "Find 80 Mexican betting influencers", expectedFilters: { regions: ['MEXICO'], tags: ['betting'], minCount: 80, maxCount: 80 }, category: 'Mexico Betting' },
  { id: 13, query: "Give me 60 Mexico slots streamers", expectedFilters: { regions: ['MEXICO'], tags: ['slots'], minCount: 60, maxCount: 60 }, category: 'Mexico Betting' },
  { id: 14, query: "I want 90 Mexican gambling creators", expectedFilters: { regions: ['MEXICO'], tags: ['gambling'], minCount: 90, maxCount: 90 }, category: 'Mexico Betting' },
  { id: 15, query: "Show me 70 Mexico poker streamers", expectedFilters: { regions: ['MEXICO'], tags: ['poker'], minCount: 70, maxCount: 70 }, category: 'Mexico Betting' },
  { id: 16, query: "Find 85 Mexican casino content creators", expectedFilters: { regions: ['MEXICO'], tags: ['casino'], minCount: 85, maxCount: 85 }, category: 'Mexico Betting' },
  { id: 17, query: "I need 75 Mexico streamers for betting promotion", expectedFilters: { regions: ['MEXICO'], tags: ['betting'], minCount: 75, maxCount: 75 }, category: 'Mexico Betting' },
  { id: 18, query: "Get me 95 Mexican roulette streamers", expectedFilters: { regions: ['MEXICO'], tags: ['roulette'], minCount: 95, maxCount: 95 }, category: 'Mexico Betting' },
  { id: 19, query: "Find 100 Mexico streamers for online casino campaign", expectedFilters: { regions: ['MEXICO'], tags: ['casino'], minCount: 100, maxCount: 100 }, category: 'Mexico Betting' },
  { id: 20, query: "I want 65 Mexican sports betting streamers", expectedFilters: { regions: ['MEXICO'], tags: ['betting', 'sports'], minCount: 65, maxCount: 65 }, category: 'Mexico Betting' },

  // Peru betting campaigns (21-30)
  { id: 21, query: "I need 50 Peru streamers for Betano campaign", expectedFilters: { regions: ['PERU'], tags: ['betting', 'casino'], minCount: 50, maxCount: 50 }, category: 'Peru Betting' },
  { id: 22, query: "Find 40 Peruvian casino streamers", expectedFilters: { regions: ['PERU'], tags: ['casino'], minCount: 40, maxCount: 40 }, category: 'Peru Betting' },
  { id: 23, query: "Give me 35 Peru betting influencers", expectedFilters: { regions: ['PERU'], tags: ['betting'], minCount: 35, maxCount: 35 }, category: 'Peru Betting' },
  { id: 24, query: "I want 45 Peruvian slots streamers", expectedFilters: { regions: ['PERU'], tags: ['slots'], minCount: 45, maxCount: 45 }, category: 'Peru Betting' },
  { id: 25, query: "Show me 55 Peru gambling creators", expectedFilters: { regions: ['PERU'], tags: ['gambling'], minCount: 55, maxCount: 55 }, category: 'Peru Betting' },
  { id: 26, query: "Find 48 Peruvian poker streamers", expectedFilters: { regions: ['PERU'], tags: ['poker'], minCount: 48, maxCount: 48 }, category: 'Peru Betting' },
  { id: 27, query: "I need 42 Peru casino content creators", expectedFilters: { regions: ['PERU'], tags: ['casino'], minCount: 42, maxCount: 42 }, category: 'Peru Betting' },
  { id: 28, query: "Get me 38 Peruvian betting streamers", expectedFilters: { regions: ['PERU'], tags: ['betting'], minCount: 38, maxCount: 38 }, category: 'Peru Betting' },
  { id: 29, query: "Find 52 Peru streamers for gambling campaign", expectedFilters: { regions: ['PERU'], tags: ['gambling'], minCount: 52, maxCount: 52 }, category: 'Peru Betting' },
  { id: 30, query: "I want 46 Peruvian roulette streamers", expectedFilters: { regions: ['PERU'], tags: ['roulette'], minCount: 46, maxCount: 46 }, category: 'Peru Betting' },

  // Brazil betting campaigns (31-40)
  { id: 31, query: "I need 120 Brazil casino streamers", expectedFilters: { regions: ['BRAZIL'], tags: ['casino'], minCount: 120, maxCount: 120 }, category: 'Brazil Betting' },
  { id: 32, query: "Find 100 Brazilian betting influencers", expectedFilters: { regions: ['BRAZIL'], tags: ['betting'], minCount: 100, maxCount: 100 }, category: 'Brazil Betting' },
  { id: 33, query: "Give me 90 Brazil slots streamers", expectedFilters: { regions: ['BRAZIL'], tags: ['slots'], minCount: 90, maxCount: 90 }, category: 'Brazil Betting' },
  { id: 34, query: "I want 110 Brazilian gambling creators", expectedFilters: { regions: ['BRAZIL'], tags: ['gambling'], minCount: 110, maxCount: 110 }, category: 'Brazil Betting' },
  { id: 35, query: "Show me 85 Brazil poker streamers", expectedFilters: { regions: ['BRAZIL'], tags: ['poker'], minCount: 85, maxCount: 85 }, category: 'Brazil Betting' },
  { id: 36, query: "Find 95 Brazilian casino content creators", expectedFilters: { regions: ['BRAZIL'], tags: ['casino'], minCount: 95, maxCount: 95 }, category: 'Brazil Betting' },
  { id: 37, query: "I need 105 Brazil streamers for betting campaign", expectedFilters: { regions: ['BRAZIL'], tags: ['betting'], minCount: 105, maxCount: 105 }, category: 'Brazil Betting' },
  { id: 38, query: "Get me 88 Brazilian roulette streamers", expectedFilters: { regions: ['BRAZIL'], tags: ['roulette'], minCount: 88, maxCount: 88 }, category: 'Brazil Betting' },
  { id: 39, query: "Find 115 Brazil streamers for online gambling", expectedFilters: { regions: ['BRAZIL'], tags: ['gambling'], minCount: 115, maxCount: 115 }, category: 'Brazil Betting' },
  { id: 40, query: "I want 92 Brazilian sports betting streamers", expectedFilters: { regions: ['BRAZIL'], tags: ['betting', 'sports'], minCount: 92, maxCount: 92 }, category: 'Brazil Betting' },

  // Colombia betting campaigns (41-50)
  { id: 41, query: "I need 70 Colombia casino streamers", expectedFilters: { regions: ['COLOMBIA'], tags: ['casino'], minCount: 70, maxCount: 70 }, category: 'Colombia Betting' },
  { id: 42, query: "Find 60 Colombian betting influencers", expectedFilters: { regions: ['COLOMBIA'], tags: ['betting'], minCount: 60, maxCount: 60 }, category: 'Colombia Betting' },
  { id: 43, query: "Give me 55 Colombia slots streamers", expectedFilters: { regions: ['COLOMBIA'], tags: ['slots'], minCount: 55, maxCount: 55 }, category: 'Colombia Betting' },
  { id: 44, query: "I want 65 Colombian gambling creators", expectedFilters: { regions: ['COLOMBIA'], tags: ['gambling'], minCount: 65, maxCount: 65 }, category: 'Colombia Betting' },
  { id: 45, query: "Show me 58 Colombia poker streamers", expectedFilters: { regions: ['COLOMBIA'], tags: ['poker'], minCount: 58, maxCount: 58 }, category: 'Colombia Betting' },
  { id: 46, query: "Find 62 Colombian casino content creators", expectedFilters: { regions: ['COLOMBIA'], tags: ['casino'], minCount: 62, maxCount: 62 }, category: 'Colombia Betting' },
  { id: 47, query: "I need 68 Colombia streamers for betting promotion", expectedFilters: { regions: ['COLOMBIA'], tags: ['betting'], minCount: 68, maxCount: 68 }, category: 'Colombia Betting' },
  { id: 48, query: "Get me 72 Colombian roulette streamers", expectedFilters: { regions: ['COLOMBIA'], tags: ['roulette'], minCount: 72, maxCount: 72 }, category: 'Colombia Betting' },
  { id: 49, query: "Find 66 Colombia streamers for gambling campaign", expectedFilters: { regions: ['COLOMBIA'], tags: ['gambling'], minCount: 66, maxCount: 66 }, category: 'Colombia Betting' },
  { id: 50, query: "I want 74 Colombian sports betting streamers", expectedFilters: { regions: ['COLOMBIA'], tags: ['betting', 'sports'], minCount: 74, maxCount: 74 }, category: 'Colombia Betting' },

  // Argentina betting campaigns (51-55)
  { id: 51, query: "I need 80 Argentina casino streamers", expectedFilters: { regions: ['ARGENTINA'], tags: ['casino'], minCount: 80, maxCount: 80 }, category: 'Argentina Betting' },
  { id: 52, query: "Find 75 Argentinian betting influencers", expectedFilters: { regions: ['ARGENTINA'], tags: ['betting'], minCount: 75, maxCount: 75 }, category: 'Argentina Betting' },
  { id: 53, query: "Give me 70 Argentina slots streamers", expectedFilters: { regions: ['ARGENTINA'], tags: ['slots'], minCount: 70, maxCount: 70 }, category: 'Argentina Betting' },
  { id: 54, query: "I want 85 Argentinian gambling creators", expectedFilters: { regions: ['ARGENTINA'], tags: ['gambling'], minCount: 85, maxCount: 85 }, category: 'Argentina Betting' },
  { id: 55, query: "Show me 78 Argentina poker streamers", expectedFilters: { regions: ['ARGENTINA'], tags: ['poker'], minCount: 78, maxCount: 78 }, category: 'Argentina Betting' },

  // Gaming-specific campaigns (56-70)
  { id: 56, query: "I need 60 streamers for World of Warships campaign", expectedFilters: { tags: ['world of warships'], minCount: 60, maxCount: 60 }, category: 'Gaming' },
  { id: 57, query: "Find 50 GTA 5 streamers in Mexico", expectedFilters: { regions: ['MEXICO'], tags: ['gta', 'gta 5', 'grand theft auto'], minCount: 50, maxCount: 50 }, category: 'Gaming' },
  { id: 58, query: "Give me 40 Call of Duty streamers in Brazil", expectedFilters: { regions: ['BRAZIL'], tags: ['call of duty', 'cod'], minCount: 40, maxCount: 40 }, category: 'Gaming' },
  { id: 59, query: "I want 70 Fortnite streamers in Colombia", expectedFilters: { regions: ['COLOMBIA'], tags: ['fortnite'], minCount: 70, maxCount: 70 }, category: 'Gaming' },
  { id: 60, query: "Show me 55 League of Legends streamers in Chile", expectedFilters: { regions: ['CHILE'], tags: ['league of legends', 'lol'], minCount: 55, maxCount: 55 }, category: 'Gaming' },
  { id: 61, query: "Find 45 Valorant streamers in Peru", expectedFilters: { regions: ['PERU'], tags: ['valorant'], minCount: 45, maxCount: 45 }, category: 'Gaming' },
  { id: 62, query: "I need 65 Minecraft streamers in Argentina", expectedFilters: { regions: ['ARGENTINA'], tags: ['minecraft'], minCount: 65, maxCount: 65 }, category: 'Gaming' },
  { id: 63, query: "Get me 30 streamers for World of Warships in Brazil", expectedFilters: { regions: ['BRAZIL'], tags: ['world of warships'], minCount: 30, maxCount: 30 }, category: 'Gaming' },
  { id: 64, query: "Find 50 Counter-Strike streamers in Mexico", expectedFilters: { regions: ['MEXICO'], tags: ['counter-strike', 'cs:go', 'cs2'], minCount: 50, maxCount: 50 }, category: 'Gaming' },
  { id: 65, query: "I want 60 Dota 2 streamers in Colombia", expectedFilters: { regions: ['COLOMBIA'], tags: ['dota 2'], minCount: 60, maxCount: 60 }, category: 'Gaming' },
  { id: 66, query: "Show me 35 Apex Legends streamers in Chile", expectedFilters: { regions: ['CHILE'], tags: ['apex legends'], minCount: 35, maxCount: 35 }, category: 'Gaming' },
  { id: 67, query: "Find 48 FIFA streamers in Argentina", expectedFilters: { regions: ['ARGENTINA'], tags: ['fifa'], minCount: 48, maxCount: 48 }, category: 'Gaming' },
  { id: 68, query: "I need 42 NBA 2K streamers in Brazil", expectedFilters: { regions: ['BRAZIL'], tags: ['nba 2k'], minCount: 42, maxCount: 42 }, category: 'Gaming' },
  { id: 69, query: "Get me 38 Rocket League streamers in Peru", expectedFilters: { regions: ['PERU'], tags: ['rocket league'], minCount: 38, maxCount: 38 }, category: 'Gaming' },
  { id: 70, query: "Find 52 Overwatch streamers in Mexico", expectedFilters: { regions: ['MEXICO'], tags: ['overwatch'], minCount: 52, maxCount: 52 }, category: 'Gaming' },

  // Multi-region campaigns (71-80)
  { id: 71, query: "I need 100 casino streamers from Mexico, Brazil, and Argentina", expectedFilters: { regions: ['MEXICO', 'BRAZIL', 'ARGENTINA'], tags: ['casino'], minCount: 100, maxCount: 100 }, category: 'Multi-Region' },
  { id: 72, query: "Find 80 betting streamers in Chile, Peru, and Colombia", expectedFilters: { regions: ['CHILE', 'PERU', 'COLOMBIA'], tags: ['betting'], minCount: 80, maxCount: 80 }, category: 'Multi-Region' },
  { id: 73, query: "Give me 90 slots streamers from Brazil and Mexico", expectedFilters: { regions: ['BRAZIL', 'MEXICO'], tags: ['slots'], minCount: 90, maxCount: 90 }, category: 'Multi-Region' },
  { id: 74, query: "I want 110 gambling streamers in LATAM", expectedFilters: { regions: ['MEXICO', 'COLOMBIA', 'ARGENTINA', 'CHILE', 'PERU'], tags: ['gambling'], minCount: 110, maxCount: 110 }, category: 'Multi-Region' },
  { id: 75, query: "Show me 75 poker streamers from Argentina and Chile", expectedFilters: { regions: ['ARGENTINA', 'CHILE'], tags: ['poker'], minCount: 75, maxCount: 75 }, category: 'Multi-Region' },
  { id: 76, query: "Find 95 casino streamers in Brazil, Mexico, and Colombia", expectedFilters: { regions: ['BRAZIL', 'MEXICO', 'COLOMBIA'], tags: ['casino'], minCount: 95, maxCount: 95 }, category: 'Multi-Region' },
  { id: 77, query: "I need 85 betting streamers from Peru and Brazil", expectedFilters: { regions: ['PERU', 'BRAZIL'], tags: ['betting'], minCount: 85, maxCount: 85 }, category: 'Multi-Region' },
  { id: 78, query: "Get me 70 gambling streamers in Mexico and Argentina", expectedFilters: { regions: ['MEXICO', 'ARGENTINA'], tags: ['gambling'], minCount: 70, maxCount: 70 }, category: 'Multi-Region' },
  { id: 79, query: "Find 100 slots streamers across all LATAM countries", expectedFilters: { regions: ['MEXICO', 'COLOMBIA', 'ARGENTINA', 'CHILE', 'PERU', 'BRAZIL'], tags: ['slots'], minCount: 100, maxCount: 100 }, category: 'Multi-Region' },
  { id: 80, query: "I want 88 roulette streamers from Chile, Colombia, and Peru", expectedFilters: { regions: ['CHILE', 'COLOMBIA', 'PERU'], tags: ['roulette'], minCount: 88, maxCount: 88 }, category: 'Multi-Region' },

  // Platform-specific campaigns (81-90)
  { id: 81, query: "I need 50 Twitch casino streamers in Mexico", expectedFilters: { platforms: ['TWITCH'], regions: ['MEXICO'], tags: ['casino'], minCount: 50, maxCount: 50 }, category: 'Platform-Specific' },
  { id: 82, query: "Find 40 Kick betting streamers in Brazil", expectedFilters: { platforms: ['KICK'], regions: ['BRAZIL'], tags: ['betting'], minCount: 40, maxCount: 40 }, category: 'Platform-Specific' },
  { id: 83, query: "Give me 35 YouTube slots streamers in Chile", expectedFilters: { platforms: ['YOUTUBE'], regions: ['CHILE'], tags: ['slots'], minCount: 35, maxCount: 35 }, category: 'Platform-Specific' },
  { id: 84, query: "I want 45 Twitch gambling streamers in Argentina", expectedFilters: { platforms: ['TWITCH'], regions: ['ARGENTINA'], tags: ['gambling'], minCount: 45, maxCount: 45 }, category: 'Platform-Specific' },
  { id: 85, query: "Show me 55 Kick poker streamers in Colombia", expectedFilters: { platforms: ['KICK'], regions: ['COLOMBIA'], tags: ['poker'], minCount: 55, maxCount: 55 }, category: 'Platform-Specific' },
  { id: 86, query: "Find 48 YouTube casino streamers in Peru", expectedFilters: { platforms: ['YOUTUBE'], regions: ['PERU'], tags: ['casino'], minCount: 48, maxCount: 48 }, category: 'Platform-Specific' },
  { id: 87, query: "I need 42 Twitch betting streamers in Brazil", expectedFilters: { platforms: ['TWITCH'], regions: ['BRAZIL'], tags: ['betting'], minCount: 42, maxCount: 42 }, category: 'Platform-Specific' },
  { id: 88, query: "Get me 38 Kick slots streamers in Mexico", expectedFilters: { platforms: ['KICK'], regions: ['MEXICO'], tags: ['slots'], minCount: 38, maxCount: 38 }, category: 'Platform-Specific' },
  { id: 89, query: "Find 52 YouTube gambling streamers in Chile", expectedFilters: { platforms: ['YOUTUBE'], regions: ['CHILE'], tags: ['gambling'], minCount: 52, maxCount: 52 }, category: 'Platform-Specific' },
  { id: 90, query: "I want 46 Twitch roulette streamers in Argentina", expectedFilters: { platforms: ['TWITCH'], regions: ['ARGENTINA'], tags: ['roulette'], minCount: 46, maxCount: 46 }, category: 'Platform-Specific' },

  // Edge cases and complex queries (91-100)
  { id: 91, query: "I need 200 casino streamers for a major betting campaign", expectedFilters: { tags: ['casino', 'betting'], minCount: 200, maxCount: 200 }, category: 'Edge Cases' },
  { id: 92, query: "Find 15 VIP casino streamers in Brazil with 100k+ followers", expectedFilters: { regions: ['BRAZIL'], tags: ['casino'], minCount: 15, maxCount: 15 }, category: 'Edge Cases' },
  { id: 93, query: "Give me 25 live casino streamers right now in Mexico", expectedFilters: { regions: ['MEXICO'], tags: ['casino'], minCount: 25, maxCount: 25 }, category: 'Edge Cases' },
  { id: 94, query: "I want 100 Spanish-speaking casino streamers", expectedFilters: { tags: ['casino'], minCount: 100, maxCount: 100 }, category: 'Edge Cases' },
  { id: 95, query: "Show me 50 female casino streamers in LATAM", expectedFilters: { tags: ['casino'], minCount: 50, maxCount: 50 }, category: 'Edge Cases' },
  { id: 96, query: "Find 30 casino streamers who use camera in Chile", expectedFilters: { regions: ['CHILE'], tags: ['casino'], minCount: 30, maxCount: 30 }, category: 'Edge Cases' },
  { id: 97, query: "I need 80 casino streamers with high engagement in Brazil", expectedFilters: { regions: ['BRAZIL'], tags: ['casino'], minCount: 80, maxCount: 80 }, category: 'Edge Cases' },
  { id: 98, query: "Get me 60 verified casino streamers in Mexico", expectedFilters: { regions: ['MEXICO'], tags: ['casino'], minCount: 60, maxCount: 60 }, category: 'Edge Cases' },
  { id: 99, query: "Find 40 trending casino streamers in Argentina", expectedFilters: { regions: ['ARGENTINA'], tags: ['casino'], minCount: 40, maxCount: 40 }, category: 'Edge Cases' },
  { id: 100, query: "I want 120 top casino streamers across all platforms in LATAM", expectedFilters: { tags: ['casino'], minCount: 120, maxCount: 120 }, category: 'Edge Cases' }
];

// Login and get auth token
async function login(): Promise<string> {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
      email: 'abiola@mieladigital.com',
      password: 'Abo!la-Mielo2025'
    });

    return response.data.data.token;
  } catch (error: any) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    throw error;
  }
}

// Execute a single test case
async function executeTest(testCase: TestCase, token: string): Promise<TestResult> {
  const result: TestResult = {
    testId: testCase.id,
    query: testCase.query,
    category: testCase.category,
    success: false,
    passed: false,
    returnedCount: 0,
    expectedCount: {
      min: testCase.expectedFilters.minCount,
      max: testCase.expectedFilters.maxCount
    },
    filters: {},
    streamers: [],
    errors: [],
    warnings: []
  };

  try {
    console.log(`\n🧪 Test ${testCase.id}/100: ${testCase.query}`);

    const startTime = Date.now();
    const response = await axios.post(
      `${API_BASE_URL}/api/chat/search`,
      {
        query: testCase.query
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60 second timeout
      }
    );

    const endTime = Date.now();
    result.processingTime = endTime - startTime;

    if (response.data.success) {
      result.success = true;
      result.streamers = response.data.data.streamers || [];
      result.returnedCount = result.streamers.length;
      result.filters = response.data.data.searchParams || {};

      // Validation checks
      const errors: string[] = [];
      const warnings: string[] = [];

      // Check 1: Count validation
      if (testCase.expectedFilters.minCount && result.returnedCount < testCase.expectedFilters.minCount) {
        errors.push(`Expected at least ${testCase.expectedFilters.minCount} streamers, got ${result.returnedCount}`);
      }

      // Check 2: Region validation
      if (testCase.expectedFilters.regions) {
        const expectedRegions = testCase.expectedFilters.regions.map(r => r.toUpperCase());
        const actualRegions = new Set(result.streamers.map(s => s.region?.toUpperCase()).filter(Boolean));

        // Check if returned streamers are from expected regions
        const invalidRegions = result.streamers.filter(s =>
          s.region && !expectedRegions.includes(s.region.toUpperCase())
        );

        if (invalidRegions.length > 0) {
          const invalidRegionNames = [...new Set(invalidRegions.map(s => s.region))];
          errors.push(`Found ${invalidRegions.length} streamers from unexpected regions: ${invalidRegionNames.join(', ')}`);
        }

        // Check if filters include expected regions
        const filterRegions = result.filters.regions || [];
        const missingRegions = expectedRegions.filter(r => !filterRegions.includes(r));
        if (missingRegions.length > 0) {
          warnings.push(`Filters missing expected regions: ${missingRegions.join(', ')}`);
        }
      }

      // Check 3: Platform validation
      if (testCase.expectedFilters.platforms) {
        const expectedPlatforms = testCase.expectedFilters.platforms.map(p => p.toUpperCase());
        const actualPlatforms = new Set(result.streamers.map(s => s.platform?.toUpperCase()).filter(Boolean));

        const invalidPlatforms = result.streamers.filter(s =>
          s.platform && !expectedPlatforms.includes(s.platform.toUpperCase())
        );

        if (invalidPlatforms.length > 0) {
          const invalidPlatformNames = [...new Set(invalidPlatforms.map(s => s.platform))];
          errors.push(`Found ${invalidPlatforms.length} streamers from unexpected platforms: ${invalidPlatformNames.join(', ')}`);
        }
      }

      // Check 4: Tags/content validation
      if (testCase.expectedFilters.tags && testCase.expectedFilters.tags.length > 0) {
        const expectedTags = testCase.expectedFilters.tags.map(t => t.toLowerCase());

        // Check if streamers have relevant content (tags, currentGame, topGames)
        const streamersWithoutRelevantContent = result.streamers.filter(s => {
          const tags = (s.tags || []).map((t: string) => t.toLowerCase());
          const currentGame = s.currentGame?.toLowerCase() || '';
          const topGames = (s.topGames || []).map((g: string) => g.toLowerCase());

          // Check if any expected tag appears in tags, currentGame, or topGames
          const hasMatch = expectedTags.some(expectedTag => {
            return tags.some((t: string) => t.includes(expectedTag) || expectedTag.includes(t)) ||
                   currentGame.includes(expectedTag) ||
                   topGames.some((g: string) => g.includes(expectedTag) || expectedTag.includes(g));
          });

          return !hasMatch;
        });

        if (streamersWithoutRelevantContent.length > 0) {
          warnings.push(`${streamersWithoutRelevantContent.length} streamers don't have expected tags/games: ${expectedTags.join(', ')}`);
        }

        // Check filter tags
        const filterTags = (result.filters.tags || []).map((t: string) => t.toLowerCase());
        const hasExpectedTagsInFilter = expectedTags.some(expectedTag =>
          filterTags.some((filterTag: string) => filterTag.includes(expectedTag) || expectedTag.includes(filterTag))
        );

        if (!hasExpectedTagsInFilter && filterTags.length > 0) {
          warnings.push(`Filters don't include expected tags. Expected: ${expectedTags.join(', ')}, Got: ${filterTags.join(', ')}`);
        }
      }

      // Determine if test passed
      result.passed = errors.length === 0;
      result.errors = errors;
      result.warnings = warnings;

      // Log result
      if (result.passed && warnings.length === 0) {
        console.log(`✅ PASSED - ${result.returnedCount} streamers returned`);
      } else if (result.passed && warnings.length > 0) {
        console.log(`⚠️  PASSED WITH WARNINGS - ${result.returnedCount} streamers returned`);
        warnings.forEach(w => console.log(`   ⚠️  ${w}`));
      } else {
        console.log(`❌ FAILED - ${result.returnedCount} streamers returned`);
        errors.forEach(e => console.log(`   ❌ ${e}`));
        warnings.forEach(w => console.log(`   ⚠️  ${w}`));
      }

      console.log(`   ⏱️  Processing time: ${result.processingTime}ms`);
      console.log(`   🔍 Filters: ${JSON.stringify(result.filters)}`);

    } else {
      result.success = false;
      result.errors.push('API returned success: false');
    }

  } catch (error: any) {
    result.success = false;
    result.errors.push(error.response?.data?.error || error.message);
    console.log(`❌ ERROR: ${error.message}`);
  }

  return result;
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting comprehensive iGaming AI Chat testing (100 tests)...\n');
  console.log('=' .repeat(80));

  // Login first
  console.log('🔐 Logging in...');
  let token: string;
  try {
    token = await login();
    console.log('✅ Login successful\n');
  } catch (error) {
    console.error('❌ Cannot proceed without authentication');
    process.exit(1);
  }

  const results: TestResult[] = [];
  const categoryStats: Record<string, { total: number; passed: number; failed: number; warnings: number }> = {};

  // Run all tests
  for (const testCase of TEST_CASES) {
    const result = await executeTest(testCase, token);
    results.push(result);

    // Update category stats
    if (!categoryStats[testCase.category]) {
      categoryStats[testCase.category] = { total: 0, passed: 0, failed: 0, warnings: 0 };
    }
    categoryStats[testCase.category].total++;
    if (result.passed) {
      categoryStats[testCase.category].passed++;
      if (result.warnings.length > 0) {
        categoryStats[testCase.category].warnings++;
      }
    } else {
      categoryStats[testCase.category].failed++;
    }

    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Generate summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));

  const totalTests = results.length;
  const passedTests = results.filter(r => r.passed).length;
  const failedTests = results.filter(r => !r.passed).length;
  const testsWithWarnings = results.filter(r => r.passed && r.warnings.length > 0).length;
  const avgProcessingTime = results.reduce((sum, r) => sum + (r.processingTime || 0), 0) / totalTests;

  console.log(`\nOverall Results:`);
  console.log(`  Total Tests: ${totalTests}`);
  console.log(`  ✅ Passed: ${passedTests} (${((passedTests/totalTests)*100).toFixed(1)}%)`);
  console.log(`  ❌ Failed: ${failedTests} (${((failedTests/totalTests)*100).toFixed(1)}%)`);
  console.log(`  ⚠️  Warnings: ${testsWithWarnings} (${((testsWithWarnings/totalTests)*100).toFixed(1)}%)`);
  console.log(`  ⏱️  Avg Processing Time: ${avgProcessingTime.toFixed(0)}ms`);

  console.log(`\nResults by Category:`);
  for (const [category, stats] of Object.entries(categoryStats)) {
    const passRate = ((stats.passed / stats.total) * 100).toFixed(1);
    console.log(`  ${category}:`);
    console.log(`    Total: ${stats.total} | Passed: ${stats.passed} | Failed: ${stats.failed} | Warnings: ${stats.warnings} | Pass Rate: ${passRate}%`);
  }

  // Show all failures
  const failures = results.filter(r => !r.passed);
  if (failures.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('❌ FAILED TESTS DETAILS');
    console.log('='.repeat(80));

    failures.forEach(failure => {
      console.log(`\nTest ${failure.testId}: ${failure.query}`);
      console.log(`  Category: ${failure.category}`);
      console.log(`  Expected: ${failure.expectedCount.min} streamers`);
      console.log(`  Got: ${failure.returnedCount} streamers`);
      console.log(`  Errors:`);
      failure.errors.forEach(e => console.log(`    - ${e}`));
      if (failure.warnings.length > 0) {
        console.log(`  Warnings:`);
        failure.warnings.forEach(w => console.log(`    - ${w}`));
      }
      console.log(`  Filters Used: ${JSON.stringify(failure.filters)}`);
    });
  }

  // Save detailed results to JSON file
  const outputPath = path.join(__dirname, 'test-igaming-100-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Detailed results saved to: ${outputPath}`);

  // Save summary to text file
  const summaryPath = path.join(__dirname, 'test-igaming-100-summary.txt');
  let summaryText = `iGaming AI Chat - Comprehensive Test Report\n`;
  summaryText += `Generated: ${new Date().toISOString()}\n`;
  summaryText += `${'='.repeat(80)}\n\n`;
  summaryText += `OVERALL RESULTS\n`;
  summaryText += `Total Tests: ${totalTests}\n`;
  summaryText += `Passed: ${passedTests} (${((passedTests/totalTests)*100).toFixed(1)}%)\n`;
  summaryText += `Failed: ${failedTests} (${((failedTests/totalTests)*100).toFixed(1)}%)\n`;
  summaryText += `With Warnings: ${testsWithWarnings} (${((testsWithWarnings/totalTests)*100).toFixed(1)}%)\n`;
  summaryText += `Avg Processing Time: ${avgProcessingTime.toFixed(0)}ms\n\n`;

  summaryText += `CATEGORY BREAKDOWN\n`;
  for (const [category, stats] of Object.entries(categoryStats)) {
    const passRate = ((stats.passed / stats.total) * 100).toFixed(1);
    summaryText += `${category}: ${stats.passed}/${stats.total} passed (${passRate}%) - ${stats.warnings} warnings\n`;
  }

  if (failures.length > 0) {
    summaryText += `\n${'='.repeat(80)}\n`;
    summaryText += `FAILED TESTS (${failures.length})\n`;
    summaryText += `${'='.repeat(80)}\n`;

    failures.forEach(failure => {
      summaryText += `\nTest ${failure.testId}: ${failure.query}\n`;
      summaryText += `Category: ${failure.category}\n`;
      summaryText += `Expected: ${failure.expectedCount.min} | Got: ${failure.returnedCount}\n`;
      summaryText += `Errors:\n`;
      failure.errors.forEach(e => summaryText += `  - ${e}\n`);
      if (failure.warnings.length > 0) {
        summaryText += `Warnings:\n`;
        failure.warnings.forEach(w => summaryText += `  - ${w}\n`);
      }
    });
  }

  fs.writeFileSync(summaryPath, summaryText);
  console.log(`💾 Summary saved to: ${summaryPath}`);

  console.log('\n✨ Testing complete!\n');

  // Exit with appropriate code
  process.exit(failedTests > 0 ? 1 : 0);
}

// Run the tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
