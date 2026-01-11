import { db, logger } from '../utils/database';
import { Streamer } from '@prisma/client';

/**
 * Intelligent Tag Inference Service
 *
 * Automatically assigns relevant tags to streamers based on their game content.
 * Solves the critical issue of having only 320/10,973 streamers with casino tags.
 */

interface TagInferenceResult {
  streamerId: string;
  username: string;
  inferredTags: string[];
  confidence: 'high' | 'medium' | 'low';
  source: 'currentGame' | 'topGames' | 'both';
}

export class TagInferenceService {

  // iGaming game patterns - comprehensive list
  private readonly IGAMING_PATTERNS = {
    casino: [
      'casino', 'cassino', 'казино',
      'virtual casino', 'online casino', 'live casino',
      'casino games'
    ],
    slots: [
      'slots', 'slot', 'tragamonedas', 'caça-níqueis',
      'slot machine', 'slot games', 'online slots',
      'fruit machine', 'video slots'
    ],
    poker: [
      'poker', 'póker', 'póquer',
      'texas holdem', 'texas hold\'em',
      'omaha poker', 'video poker',
      'poker tournament', 'poker online'
    ],
    roulette: [
      'roulette', 'ruleta', 'roleta',
      'european roulette', 'american roulette',
      'live roulette', 'online roulette'
    ],
    blackjack: [
      'blackjack', 'black jack', '21',
      'twenty one', 'veintiuno',
      'live blackjack', 'blackjack online'
    ],
    baccarat: [
      'baccarat', 'bacará', 'baccarà',
      'punto banco', 'live baccarat'
    ],
    betting: [
      'betting', 'apuestas', 'apostas',
      'sports betting', 'sportbook', 'sportsbook',
      'bet', 'wager', 'gambling bet'
    ],
    gambling: [
      'gambling', 'gamble', 'juego',
      'azar', 'jogos de azar',
      'online gambling', 'gambling games'
    ],
    lottery: [
      'lottery', 'lotería', 'loteria',
      'lotto', 'raffle', 'sorteo'
    ],
    bingo: [
      'bingo', 'online bingo', 'live bingo'
    ]
  };

  // Popular casino game names
  private readonly CASINO_GAME_NAMES = [
    'crazy time', 'sweet bonanza', 'gates of olympus',
    'big bass bonanza', 'book of dead', 'starburst',
    'mega moolah', 'gonzo\'s quest', 'reactoonz',
    'money train', 'sugar rush', 'wanted dead or alive',
    'jammin\' jars', 'fire joker', 'dead or alive',
    'legacy of dead', 'razor shark', 'the dog house',
    'wild west gold', 'fruit party', 'pyramid bonanza'
  ];

  /**
   * Infer tags for a single streamer based on their game content
   */
  inferTags(streamer: Streamer): TagInferenceResult {
    const inferredTags = new Set<string>();
    let confidence: 'high' | 'medium' | 'low' = 'low';
    let source: 'currentGame' | 'topGames' | 'both' = 'currentGame';

    const currentGame = (streamer.currentGame || '').toLowerCase();
    const topGames = (streamer.topGames || []).map((g: string) => g.toLowerCase());
    const existingTags = (streamer.tags || []).map((t: string) => t.toLowerCase());

    // Check current game
    const currentGameTags = this.analyzeGameContent(currentGame);
    currentGameTags.forEach(tag => inferredTags.add(tag));

    // Check top games
    const topGameTags = new Set<string>();
    topGames.forEach(game => {
      const tags = this.analyzeGameContent(game);
      tags.forEach(tag => topGameTags.add(tag));
    });
    topGameTags.forEach(tag => inferredTags.add(tag));

    // Determine confidence and source
    if (currentGameTags.length > 0 && topGameTags.size > 0) {
      confidence = 'high';
      source = 'both';
    } else if (currentGameTags.length > 0) {
      confidence = 'medium';
      source = 'currentGame';
    } else if (topGameTags.size > 0) {
      confidence = 'medium';
      source = 'topGames';
    }

    // If multiple iGaming tags found, increase confidence
    if (inferredTags.size >= 2) {
      confidence = 'high';
    }

    // Remove tags that already exist
    const newTags = Array.from(inferredTags).filter(tag => !existingTags.includes(tag));

    return {
      streamerId: streamer.id,
      username: streamer.username,
      inferredTags: newTags,
      confidence,
      source
    };
  }

  /**
   * Analyze game content and return relevant tags
   * Returns just 'IGAMING' for all gambling/casino content (consolidated)
   */
  private analyzeGameContent(gameContent: string): string[] {
    if (!gameContent) return [];

    // Check against all iGaming patterns
    for (const [_category, patterns] of Object.entries(this.IGAMING_PATTERNS)) {
      for (const pattern of patterns) {
        if (gameContent.includes(pattern)) {
          return ['IGAMING']; // Single consolidated tag
        }
      }
    }

    // Check against popular casino game names
    for (const gameName of this.CASINO_GAME_NAMES) {
      if (gameContent.includes(gameName)) {
        return ['IGAMING']; // Single consolidated tag
      }
    }

    return [];
  }

  /**
   * Run tag inference on all streamers and update database
   */
  async inferAndUpdateAllStreamers(options: {
    dryRun?: boolean;
    batchSize?: number;
    onProgress?: (processed: number, total: number, updated: number) => void;
  } = {}): Promise<{
    processed: number;
    updated: number;
    skipped: number;
    results: TagInferenceResult[];
  }> {
    const { dryRun = false, batchSize = 100, onProgress } = options;

    logger.info('🏷️  Starting tag inference for all streamers', { dryRun, batchSize });

    // Get all streamers
    const totalStreamers = await db.streamer.count();
    const results: TagInferenceResult[] = [];
    let processed = 0;
    let updated = 0;
    let skipped = 0;

    // Process in batches
    for (let offset = 0; offset < totalStreamers; offset += batchSize) {
      const streamers = await db.streamer.findMany({
        skip: offset,
        take: batchSize,
        select: {
          id: true,
          username: true,
          currentGame: true,
          topGames: true,
          tags: true
        }
      });

      for (const streamer of streamers) {
        const result = this.inferTags(streamer as any);
        processed++;

        if (result.inferredTags.length > 0) {
          results.push(result);

          if (!dryRun) {
            // Update streamer with new tags
            const currentTags = streamer.tags || [];
            const newTags = [...currentTags, ...result.inferredTags];

            await db.streamer.update({
              where: { id: streamer.id },
              data: { tags: newTags }
            });

            updated++;
          }
        } else {
          skipped++;
        }

        // Progress callback
        if (onProgress && processed % 100 === 0) {
          onProgress(processed, totalStreamers, updated);
        }
      }
    }

    logger.info('✅ Tag inference complete', {
      processed,
      updated,
      skipped,
      totalTags: results.reduce((sum, r) => sum + r.inferredTags.length, 0)
    });

    return { processed, updated, skipped, results };
  }

  /**
   * Analyze current database and show statistics
   */
  async analyzeDatabase(): Promise<{
    totalStreamers: number;
    streamersWithIGamingGames: number;
    streamersWithIGamingTags: number;
    potentialNewTags: number;
    sampleResults: TagInferenceResult[];
  }> {
    logger.info('📊 Analyzing database for tag inference opportunities...');

    const totalStreamers = await db.streamer.count();

    // Run inference in dry-run mode
    const { results } = await this.inferAndUpdateAllStreamers({
      dryRun: true,
      onProgress: (processed, total) => {
        if (processed % 500 === 0) {
          logger.info(`Analysis progress: ${processed}/${total}`);
        }
      }
    });

    const streamersWithIGamingGames = results.length;
    const potentialNewTags = results.reduce((sum, r) => sum + r.inferredTags.length, 0);

    // Get current count of streamers with iGaming tag
    const streamersWithIGamingTags = await db.streamer.count({
      where: {
        tags: { has: 'IGAMING' }
      }
    });

    // Sample results
    const sampleResults = results
      .filter(r => r.confidence === 'high')
      .slice(0, 10);

    logger.info('📊 Analysis complete', {
      totalStreamers,
      streamersWithIGamingGames,
      streamersWithIGamingTags,
      potentialNewTags
    });

    return {
      totalStreamers,
      streamersWithIGamingGames,
      streamersWithIGamingTags,
      potentialNewTags,
      sampleResults
    };
  }

  /**
   * Get tag inference suggestions for streamers without running updates
   */
  async getSuggestions(limit: number = 20): Promise<TagInferenceResult[]> {
    const streamers = await db.streamer.findMany({
      where: {
        OR: [
          { currentGame: { not: null } },
          { topGames: { isEmpty: false } }
        ]
      },
      take: limit * 2, // Get more to filter
      select: {
        id: true,
        username: true,
        currentGame: true,
        topGames: true,
        tags: true
      }
    });

    const results: TagInferenceResult[] = [];

    for (const streamer of streamers) {
      const result = this.inferTags(streamer as any);
      if (result.inferredTags.length > 0) {
        results.push(result);
      }
      if (results.length >= limit) break;
    }

    return results;
  }
}

export const tagInferenceService = new TagInferenceService();
