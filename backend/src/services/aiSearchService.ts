import { db, logger } from '../utils/database';
import { Platform, Region, FraudStatus, Streamer } from '@prisma/client';
import { claudeService } from './claudeService';

interface StreamerSearchParams {
  platforms?: Platform[];
  regions?: Region[];
  tags?: string[];
  minFollowers?: number;
  maxFollowers?: number;
  minViewers?: number;
  maxViewers?: number;
  isLive?: boolean;
  usesCamera?: boolean;
  isVtuber?: boolean;
  fraudStatus?: FraudStatus[];
  language?: string;
  limit?: number;
  page?: number;
}

interface SearchResult {
  streamers: Streamer[];
  totalCount: number;
  searchParams: StreamerSearchParams;
  summary: string;
  processingTime: number;
  page?: number;
  totalPages?: number;
  hasMore?: boolean;
}

interface ChatSearchRequest {
  userId: string;
  query: string;
  conversationId?: string;
  searchParams?: StreamerSearchParams; // Pre-determined search params from conversational AI
  context?: {
    previousMessages: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp: Date;
    }>;
    lastSearchParams?: StreamerSearchParams;
    lastResults?: Streamer[];
  };
}

export class AISearchService {
  /**
   * Process natural language query and return streamer results
   */
  async searchStreamersWithAI(request: ChatSearchRequest): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      logger.info('🔍 searchStreamersWithAI called - VERSION 2.0', {
        userId: request.userId,
        query: request.query,
        conversationId: request.conversationId,
        hasSearchParams: !!request.searchParams,
        searchParamsValue: request.searchParams
      });

      // If searchParams are pre-provided, skip isSearchQuery check and go straight to search
      if (request.searchParams) {
        logger.info('Pre-provided searchParams detected, skipping isSearchQuery check');

        // Extract tags from query using heuristics, then merge with provided searchParams
        const queryParams = this.parseQueryWithHeuristics(request.query);
        const mergedParams = {
          ...queryParams,
          ...request.searchParams, // searchParams override queryParams
        };

        const extractedParams = this.validateAndRefineSearchParams(mergedParams, request.query);
        logger.info('Final search params after validation', { query: request.query, queryParams, providedParams: request.searchParams, finalParams: extractedParams });

        // Execute the database search
        const searchResult = await this.executeStreamerSearch(extractedParams || {});

        // Generate fast template-based summary (skip OpenAI for speed)
        const summary = this.generateFastSummary(searchResult.streamers.length, extractedParams, request.query, searchResult.streamers);

        const processingTime = Date.now() - startTime;

        // Note: Message storage is now handled by chatService to avoid duplicates
        // await this.storeChatInteraction({
        //   userId: request.userId,
        //   message: request.query,
        //   response: summary,
        //   streamersReturned: searchResult.streamers.map(s => s.id),
        //   processingTime,
        //   searchParams: extractedParams || {},
        //   conversationId: request.conversationId
        // });

        logger.info('AI search completed successfully', {
          userId: request.userId,
          query: request.query,
          resultCount: searchResult.streamers.length,
          totalCount: searchResult.totalCount,
          page: searchResult.page,
          totalPages: searchResult.totalPages,
          processingTime
        });

        return {
          streamers: searchResult.streamers,
          totalCount: searchResult.totalCount,
          searchParams: extractedParams || {},
          summary,
          processingTime,
          page: searchResult.page,
          totalPages: searchResult.totalPages,
          hasMore: searchResult.hasMore
        };
      }

      // First check if this is a conversational query or search query
      if (!claudeService.isSearchQuery(request.query)) {
        // This is a conversational query, not a search
        const conversationalResponse = await claudeService.generateConversationResponse(
          request.query,
          {
            userId: request.userId,
            conversationId: request.conversationId || '',
            previousMessages: request.context?.previousMessages || [],
            searchHistory: []
          }
        );

        // Note: Message storage is now handled by chatService to avoid duplicates
        // await this.storeChatInteraction({
        //   userId: request.userId,
        //   message: request.query,
        //   response: conversationalResponse,
        //   streamersReturned: [],
        //   processingTime: Date.now() - startTime,
        //   searchParams: {},
        //   conversationId: request.conversationId
        // });

        return {
          streamers: [],
          totalCount: 0,
          searchParams: {},
          summary: conversationalResponse,
          processingTime: Date.now() - startTime
        };
      }

      // Use pre-determined search params if available, otherwise extract from query
      let extractedParams: StreamerSearchParams | null = null;

      if (request.searchParams) {
        // Use search params provided by conversational AI
        extractedParams = request.searchParams;
        logger.info('Using pre-determined search params', { query: request.query, extractedParams });
      } else {
        // Extract search params using OpenAI
        try {
          const ai = await claudeService.processStreamQuery(
            request.query,
            {
              userId: request.userId,
              conversationId: request.conversationId || '',
              previousMessages: request.context?.previousMessages || [],
              searchHistory: []
            }
          );
          extractedParams = ai.searchParams;
          logger.info('OpenAI extracted params', { query: request.query, extractedParams });
        } catch (e) {
          logger.warn('OpenAI processing failed, using enhanced fallback', { error: e });

          // Enhanced fallback: more comprehensive heuristic parsing
          extractedParams = this.parseQueryWithHeuristics(request.query);
          logger.info('Fallback extracted params', { query: request.query, extractedParams });
        }
      }

      // Validate and refine search parameters to ensure relevance
      extractedParams = this.validateAndRefineSearchParams(extractedParams, request.query);
      logger.info('Final search params after validation', { query: request.query, finalParams: extractedParams });

      // Execute the database search
      const searchResult = await this.executeStreamerSearch(extractedParams || {});

      // Generate AI summary of results
      let summary: string;
      try {
        summary = await claudeService.generateResultsSummary(
          extractedParams || {},
          searchResult.streamers,
          request.query
        );
      } catch {
        summary = `Found ${searchResult.totalCount} streamers from the database matching your request.`;
      }

      const processingTime = Date.now() - startTime;

      // Note: Message storage is now handled by chatService to avoid duplicates
      // await this.storeChatInteraction({
      //   userId: request.userId,
      //   message: request.query,
      //   response: summary,
      //   streamersReturned: searchResult.streamers.map(s => s.id),
      //   processingTime,
      //   searchParams: extractedParams || {},
      //   conversationId: request.conversationId
      // });

      logger.info('AI search completed successfully', {
        userId: request.userId,
        query: request.query,
        resultCount: searchResult.streamers.length,
        totalCount: searchResult.totalCount,
        page: searchResult.page,
        totalPages: searchResult.totalPages,
        processingTime
      });

      return {
        streamers: searchResult.streamers,
        totalCount: searchResult.totalCount,
        searchParams: extractedParams || {},
        summary,
        processingTime,
        page: searchResult.page,
        totalPages: searchResult.totalPages,
        hasMore: searchResult.hasMore
      };

    } catch (error) {
      logger.error('Error in AI search:', error);
      throw new Error('Failed to process your search request. Please try again.');
    }
  }

  /**
   * Execute database search based on extracted parameters
   */
  async executeStreamerSearch(params: StreamerSearchParams): Promise<{
    streamers: Streamer[];
    totalCount: number;
    page: number;
    totalPages: number;
    hasMore: boolean;
  }> {
    try {
      const whereClause: any = {
        // Default to clean fraud status
        fraudCheck: params.fraudStatus?.length ? { in: params.fraudStatus } : { not: 'FLAGGED' }
      };

      // Platform filtering
      if (params.platforms?.length) {
        whereClause.platform = { in: params.platforms };
      }

      // Region filtering - Convert to uppercase to match enum values
      if (params.regions?.length) {
        whereClause.region = { in: params.regions.map(r => r.toUpperCase()) };
      }

      // Tag filtering - Search in currentGame, tags, and topGames
      if (params.tags?.length) {
        const tagSearchTerms = params.tags.map(t => t.toUpperCase());

        logger.info('🔍 Tag/Game search initiated', {
          searchTerms: tagSearchTerms,
          originalParams: params.tags
        });

        // Get all streamers and search in currentGame, tags, and topGames
        const streamersWithMatchingContent = await db.streamer.findMany({
          where: whereClause,
          select: { id: true, tags: true, currentGame: true, topGames: true, username: true }
        });

        logger.info('📊 Found streamers to check', {
          totalStreamers: streamersWithMatchingContent.length,
          sampleData: streamersWithMatchingContent.slice(0, 3).map(s => ({
            username: s.username,
            currentGame: s.currentGame,
            topGames: s.topGames,
            tags: s.tags
          }))
        });

        // Filter streamers that match in currentGame, topGames, or tags
        const matchingStreamerIds = streamersWithMatchingContent
          .filter(s => {
            const currentGame = s.currentGame ? String(s.currentGame).toUpperCase() : '';
            const topGames = (s.topGames || []).map((g: string) => String(g).toUpperCase());
            const tags = (s.tags || []).map((t: string) => String(t).toUpperCase());

            const hasMatch = tagSearchTerms.some(searchTerm => {
              // Exact match in currentGame
              if (currentGame === searchTerm) return true;
              // Exact match in any topGame
              if (topGames.some(game => game === searchTerm)) return true;
              // Exact match in any tag
              if (tags.some(tag => tag === searchTerm)) return true;

              // IMPROVED: Handle multi-word search terms (e.g., "sports betting", "online casino")
              // Split into words and check if all words are present
              const searchWords = searchTerm.split(/\s+/).filter(w => w.length > 2); // Only words longer than 2 chars

              if (searchWords.length > 1) {
                // Check if all words from the search term appear in the content
                const allWordsMatch = searchWords.every(word => {
                  return currentGame.includes(word) ||
                         topGames.some(game => game.includes(word)) ||
                         tags.some(tag => tag.includes(word));
                });
                if (allWordsMatch) return true;

                // Also try matching any individual word (more lenient)
                const anyWordMatches = searchWords.some(word => {
                  return currentGame.includes(word) ||
                         topGames.some(game => game.includes(word)) ||
                         tags.some(tag => tag.includes(word));
                });
                if (anyWordMatches) return true;
              }

              // IMPROVED: Partial matching for single words
              const hasPartialMatch =
                currentGame.includes(searchTerm) ||
                topGames.some(game => game.includes(searchTerm)) ||
                tags.some(tag => tag.includes(searchTerm));

              return hasPartialMatch;
            });

            if (hasMatch) {
              logger.info('✅ Match found', {
                username: s.username,
                currentGame: s.currentGame,
                topGames: s.topGames,
                tags: s.tags,
                matchedAgainst: tagSearchTerms
              });
            }
            return hasMatch;
          })
          .map(s => s.id);

        logger.info('🎯 Search matching complete', {
          matchedStreamers: matchingStreamerIds.length,
          searchTerms: tagSearchTerms
        });

        if (matchingStreamerIds.length > 0) {
          whereClause.id = { in: matchingStreamerIds };
        } else {
          // No matches found - return empty result
          logger.warn('⚠️  No matches found for search terms', { searchTerms: tagSearchTerms });
          whereClause.id = { in: [] };
        }
      }

      // Follower range
      if (params.minFollowers !== undefined) {
        whereClause.followers = { ...whereClause.followers, gte: params.minFollowers };
      }
      if (params.maxFollowers !== undefined) {
        whereClause.followers = { ...whereClause.followers, lte: params.maxFollowers };
      }

      // Current viewer range (only for live streamers)
      if (params.minViewers !== undefined || params.maxViewers !== undefined) {
        whereClause.isLive = true;
        if (params.minViewers !== undefined) {
          whereClause.currentViewers = { ...whereClause.currentViewers, gte: params.minViewers };
        }
        if (params.maxViewers !== undefined) {
          whereClause.currentViewers = { ...whereClause.currentViewers, lte: params.maxViewers };
        }
      }

      // Live status
      if (params.isLive !== undefined) {
        whereClause.isLive = params.isLive;
      }

      // Camera usage
      if (params.usesCamera !== undefined) {
        whereClause.usesCamera = params.usesCamera;
      }

      // VTuber status
      if (params.isVtuber !== undefined) {
        whereClause.isVtuber = params.isVtuber;
      }

      // Language
      if (params.language) {
        whereClause.language = params.language;
      }

      // Smart ordering based on query intent
      const orderBy = this.determineSearchOrdering(params);

      // Calculate pagination
      const page = params.page || 1;
      const limit = params.limit || 20;
      const skip = (page - 1) * limit;

      // Get total count for pagination
      const totalCount = await db.streamer.count({
        where: whereClause
      });

      // Execute the search with intelligent platform mixing
      let streamers;

      // If no specific platform filter, get mixed results from all platforms
      if (!params.platforms || params.platforms.length === 0) {
        streamers = await this.getMixedPlatformResults(whereClause, orderBy, limit, skip);
      } else {
        // User filtered by specific platform(s), use normal search
        streamers = await db.streamer.findMany({
          where: whereClause,
          orderBy,
          skip,
          take: limit
        });
      }

      const totalPages = Math.ceil(totalCount / limit);
      const hasMore = page < totalPages;

      logger.info('Search executed', {
        count: streamers.length,
        totalCount,
        page,
        totalPages,
        hasMore,
        paramsTags: params.tags,
        whereClause: whereClause
      });

      // Log enrichment status
      const enrichedCount = streamers.filter((s: any) => s.lastEnrichmentUpdate).length;
      if (enrichedCount > 0) {
        logger.info(`Found ${enrichedCount}/${streamers.length} enriched streamers in results`);
      }

      return {
        streamers,
        totalCount,
        page,
        totalPages,
        hasMore
      };

    } catch (error) {
      logger.error('Database search error:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        params
      });
      throw new Error('Failed to search streamers in database');
    }
  }

  /**
   * Get mixed results from all platforms intelligently
   * Prioritizes: Twitch > Kick > YouTube, mixing top performers from each
   */
  private async getMixedPlatformResults(
    whereClause: any,
    orderBy: any[],
    limit: number,
    skip: number
  ): Promise<any[]> {
    try {
      // Calculate how many to fetch from each platform
      // Distribute proportionally: Twitch 40%, Kick 30%, YouTube 30%
      const twitchCount = Math.ceil(limit * 0.4);
      const kickCount = Math.ceil(limit * 0.3);
      const youtubeCount = limit - twitchCount - kickCount; // Remaining

      const platformResults = await Promise.all([
        // Twitch streamers
        db.streamer.findMany({
          where: { ...whereClause, platform: 'TWITCH' },
          orderBy,
          take: twitchCount
        }),
        // Kick streamers
        db.streamer.findMany({
          where: { ...whereClause, platform: 'KICK' },
          orderBy,
          take: kickCount
        }),
        // YouTube streamers
        db.streamer.findMany({
          where: { ...whereClause, platform: 'YOUTUBE' },
          orderBy,
          take: youtubeCount
        })
      ]);

      // Combine results and interleave them for better mixing
      const [twitchStreamers, kickStreamers, youtubeStreamers] = platformResults;
      const mixed: any[] = [];

      // Interleave: Twitch, Kick, YouTube, Twitch, Kick, YouTube, ...
      const maxLength = Math.max(
        twitchStreamers.length,
        kickStreamers.length,
        youtubeStreamers.length
      );

      for (let i = 0; i < maxLength; i++) {
        if (twitchStreamers[i]) mixed.push(twitchStreamers[i]);
        if (kickStreamers[i]) mixed.push(kickStreamers[i]);
        if (youtubeStreamers[i]) mixed.push(youtubeStreamers[i]);
      }

      // Apply pagination after mixing
      const result = mixed.slice(skip, skip + limit);

      logger.info('Mixed platform results', {
        twitch: twitchStreamers.length,
        kick: kickStreamers.length,
        youtube: youtubeStreamers.length,
        mixed: mixed.length,
        returned: result.length
      });

      return result;

    } catch (error) {
      logger.error('Error getting mixed platform results:', error);
      // Fallback to standard search
      return db.streamer.findMany({
        where: whereClause,
        orderBy,
        skip,
        take: limit
      });
    }
  }

  /**
   * Get trending streamers with AI insights
   */
  async getTrendingStreamersWithInsights(region?: Region, limit: number = 10): Promise<{
    streamers: Streamer[];
    insights: string;
  }> {
    try {
      const whereClause: any = {
        isLive: true,
        fraudCheck: { not: 'FLAGGED' }
      };

      if (region) {
        whereClause.region = region;
      }

      const streamers = await db.streamer.findMany({
        where: whereClause,
        orderBy: [
          { currentViewers: 'desc' },
          { followers: 'desc' }
        ],
        take: limit
      });

      // Generate AI insights about trending patterns
      const insights = await this.generateTrendingInsights(streamers, region);

      return { streamers, insights };

    } catch (error) {
      logger.error('Error getting trending streamers:', error);
      throw error;
    }
  }

  /**
   * Compare streamers with AI analysis
   */
  async compareStreamers(streamerIds: string[]): Promise<{
    comparison: any;
    recommendation: string;
  }> {
    try {
      const streamers = await db.streamer.findMany({
        where: { id: { in: streamerIds } },
        include: {
          campaignAssignments: {
            include: {
              campaign: true
            }
          }
        }
      });

      // Generate AI comparison
      const comparisonData = this.calculateComparisonMetrics(streamers);
      const recommendation = await this.generateComparisonRecommendation(streamers);

      return {
        comparison: comparisonData,
        recommendation
      };

    } catch (error) {
      logger.error('Error comparing streamers:', error);
      throw error;
    }
  }

  /**
   * Get similar streamers using AI
   */
  async findSimilarStreamers(streamerId: string, limit: number = 5): Promise<Streamer[]> {
    try {
      const targetStreamer = await db.streamer.findUnique({
        where: { id: streamerId }
      });

      if (!targetStreamer) {
        throw new Error('Streamer not found');
      }

      // Find similar streamers based on multiple factors
      const similarStreamers = await db.streamer.findMany({
        where: {
          id: { not: streamerId },
          platform: targetStreamer.platform,
          region: targetStreamer.region,
          tags: { hasSome: targetStreamer.tags },
          followers: {
            gte: targetStreamer.followers * 0.5,  // 50% to 200% of follower count
            lte: targetStreamer.followers * 2
          },
          fraudCheck: { not: 'FLAGGED' }
        },
        orderBy: [
          { followers: 'desc' }
        ],
        take: limit
      });

      return similarStreamers;

    } catch (error) {
      logger.error('Error finding similar streamers:', error);
      throw error;
    }
  }

  /**
   * Store chat interaction in database
   */
  private async storeChatInteraction(data: {
    userId: string;
    message: string;
    response: string;
    streamersReturned: string[];
    processingTime: number;
    searchParams: StreamerSearchParams;
    conversationId?: string;
  }): Promise<void> {
    try {
      // Skip storing for now to avoid foreign key issues with non-authenticated users
      if (!data.userId || data.userId === 'undefined') {
        return;
      }

      await db.chatMessage.create({
        data: {
          userId: data.userId,
          conversationId: data.conversationId || `search-${data.userId}-${Date.now()}`, // Fallback for search-only requests
          message: data.message,
          response: data.response,
          streamersReturned: data.streamersReturned,
          processingTime: data.processingTime,
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('Error storing chat interaction:', error);
      // Don't throw - this is non-critical
    }
  }

  /**
   * Generate trending insights using AI
   */
  private async generateTrendingInsights(streamers: Streamer[], region?: Region): Promise<string> {
    try {
      // Build detailed prompt for AI analysis
      const streamerDetails = streamers.map(s => `
- ${s.displayName} (${s.platform}): ${s.followers.toLocaleString()} followers, ${s.currentViewers || 0} current viewers
  Playing: ${s.currentGame || 'N/A'} | Tags: ${s.tags.join(', ')} | Region: ${s.region}
`).join('');

      // For now, use a simple response - could be enhanced with actual OpenAI call
      const insights = await claudeService.generateConversationResponse(
        `What insights can you share about these trending ${region || 'LATAM'} streamers: ${streamerDetails}`
      );

      return insights;

    } catch (error) {
      logger.error('Error generating trending insights:', error);
      return 'Multiple streamers are currently live with strong engagement across gaming and variety content.';
    }
  }

  /**
   * Calculate comparison metrics between streamers
   */
  private calculateComparisonMetrics(streamers: Streamer[]): any {
    return streamers.map(streamer => ({
      id: streamer.id,
      name: streamer.displayName,
      platform: streamer.platform,
      followers: streamer.followers,
      avgViewers: streamer.currentViewers || 0,
      engagementRate: streamer.currentViewers && streamer.followers
        ? ((streamer.currentViewers / streamer.followers) * 100).toFixed(2)
        : '0.00',
      tags: streamer.tags,
      region: streamer.region,
      isLive: streamer.isLive,
      lastStreamed: streamer.lastStreamed
    }));
  }

  /**
   * Generate AI recommendation for streamer comparison
   */
  private async generateComparisonRecommendation(streamers: Streamer[]): Promise<string> {
    try {
      const metrics = this.calculateComparisonMetrics(streamers);

      // Build analysis prompt with metrics data
      const metricsText = `Based on these streamer metrics for LATAM marketing campaign: ${JSON.stringify(metrics, null, 2)}`;

      return await claudeService.generateConversationResponse(
        `Which streamer should I choose for my campaign? ${metricsText}`
      );

    } catch (error) {
      logger.error('Error generating comparison recommendation:', error);
      return 'All streamers show strong potential. Consider your campaign goals and target audience.';
    }
  }

  /**
   * Get search analytics
   */
  async getSearchAnalytics(userId?: string, timeframe: number = 7): Promise<{
    totalSearches: number;
    avgProcessingTime: number;
    popularRegions: Array<{ region: Region; count: number }>;
    popularTags: Array<{ tag: string; count: number }>;
    avgResultsReturned: number;
  }> {
    try {
      const since = new Date(Date.now() - timeframe * 24 * 60 * 60 * 1000);

      const searches = await db.chatMessage.findMany({
        where: {
          ...(userId && { userId }),
          timestamp: { gte: since }
        }
      });

      return {
        totalSearches: searches.length,
        avgProcessingTime: searches.length > 0
          ? searches.reduce((sum, s) => sum + (s.processingTime || 0), 0) / searches.length
          : 0,
        popularRegions: [], // Would calculate from search history
        popularTags: [], // Would calculate from search history
        avgResultsReturned: searches.length > 0
          ? searches.reduce((sum, s) => sum + s.streamersReturned.length, 0) / searches.length
          : 0
      };

    } catch (error) {
      logger.error('Error getting search analytics:', error);
      throw error;
    }
  }

  /**
   * Enhanced heuristic parsing for when OpenAI fails
   */
  private parseQueryWithHeuristics(query: string): StreamerSearchParams {
    const q = query.toLowerCase();

    // Platform detection
    const platforms: Platform[] = [];
    if (q.includes('twitch')) platforms.push('TWITCH' as Platform);
    if (q.includes('youtube') || q.includes('yt')) platforms.push('YOUTUBE' as Platform);
    if (q.includes('kick')) platforms.push('KICK' as Platform);
    if (q.includes('facebook') || q.includes('fb gaming')) platforms.push('FACEBOOK' as Platform);
    if (q.includes('tiktok')) platforms.push('TIKTOK' as Platform);

    // Region detection (comprehensive)
    const regionMap: Record<string, Region> = {
      'mexico': 'MEXICO', 'mexican': 'MEXICO', 'mx': 'MEXICO',
      'colombia': 'COLOMBIA', 'colombian': 'COLOMBIA', 'co': 'COLOMBIA',
      'argentina': 'ARGENTINA', 'argentinian': 'ARGENTINA', 'ar': 'ARGENTINA', 'argentine': 'ARGENTINA',
      'chile': 'CHILE', 'chilean': 'CHILE', 'cl': 'CHILE',
      'peru': 'PERU', 'peruvian': 'PERU', 'pe': 'PERU',
      'venezuela': 'VENEZUELA', 'venezuelan': 'VENEZUELA', 've': 'VENEZUELA',
      'ecuador': 'ECUADOR', 'ecuadorian': 'ECUADOR', 'ec': 'ECUADOR',
      'bolivia': 'BOLIVIA', 'bolivian': 'BOLIVIA', 'bo': 'BOLIVIA',
      'paraguay': 'PARAGUAY', 'paraguayan': 'PARAGUAY', 'py': 'PARAGUAY',
      'uruguay': 'URUGUAY', 'uruguayan': 'URUGUAY', 'uy': 'URUGUAY',
      'costa rica': 'COSTA_RICA', 'costarrican': 'COSTA_RICA', 'cr': 'COSTA_RICA',
      'panama': 'PANAMA', 'panamanian': 'PANAMA', 'pa': 'PANAMA',
      'guatemala': 'GUATEMALA', 'guatemalan': 'GUATEMALA', 'gt': 'GUATEMALA',
      'el salvador': 'EL_SALVADOR', 'salvadoran': 'EL_SALVADOR', 'sv': 'EL_SALVADOR',
      'honduras': 'HONDURAS', 'honduran': 'HONDURAS', 'hn': 'HONDURAS',
      'nicaragua': 'NICARAGUA', 'nicaraguan': 'NICARAGUA', 'ni': 'NICARAGUA',
      'dominican republic': 'DOMINICAN_REPUBLIC', 'dominican': 'DOMINICAN_REPUBLIC', 'do': 'DOMINICAN_REPUBLIC',
      'puerto rico': 'PUERTO_RICO', 'puertorican': 'PUERTO_RICO', 'pr': 'PUERTO_RICO',
      'brazil': 'BRAZIL', 'brazilian': 'BRAZIL', 'br': 'BRAZIL'
    };

    const regions: Region[] = [];
    for (const [key, region] of Object.entries(regionMap)) {
      // Use word boundary regex to avoid false matches (e.g., "GTA" shouldn't match "GT" for Guatemala)
      const regex = new RegExp(`\\b${key}\\b`, 'i');
      if (regex.test(q)) regions.push(region);
    }

    // Content tags detection - extract exact tags from query (NO category tags)
    // Preserve multi-word phrases as single tags instead of splitting them
    const tags: string[] = [];

    // Remove common stopwords and platform/region keywords from the query
    const commonWords = ['the', 'and', 'for', 'with', 'who', 'play', 'stream', 'streamer', 'streamers', 'playing', 'that', 'have', 'has', 'want', 'need', 'looking', 'search', 'find', 'show', 'give', 'me', 'i', 'a', 'an', 'in', 'on', 'at', 'to', 'from', 'of', 'is', 'are', 'was', 'were', 'be', 'been', 'being'];
    const filterWords = ['twitch', 'youtube', 'kick', 'facebook', 'tiktok', 'live', 'followers', 'viewers', 'latam', 'million', 'thousand', 'over', 'more', 'than', 'less', 'campaign', 'promotion', 'brand', 'ads', 'advertising', 'sponsorship', 'influencers', 'creators', 'content', 'now', 'currently', 'streaming', 'gaming'];

    // Remove stopwords, filter words, numbers, and single letters, but keep the phrase together
    const words = q.split(/\s+/)
      .filter(w => w.length > 0)
      .filter(w => !commonWords.includes(w) && !filterWords.includes(w))
      .filter(w => !/^\d+$/.test(w)) // Filter out pure numbers like "40", "50", "100"
      .filter(w => !/^\d+k$|^\d+m$/i.test(w)) // Filter out "100k", "50m" etc
      .filter(w => w.length > 1 || /^[ivx]+$/i.test(w)); // Keep single letters only if they're Roman numerals

    // Remove region keywords from words array
    const regionKeywords = Object.keys(regionMap);
    const cleanWords = words.filter(w => !regionKeywords.includes(w));

    // Join remaining words back into a phrase and use it as a single tag
    if (cleanWords.length > 0) {
      const tagPhrase = cleanWords.join(' ');
      // Keep it lowercase to match database tags (database stores tags in lowercase)
      tags.push(tagPhrase);
    }

    // IMPROVED: Specific game/content detection
    // Add known games/content keywords to ensure they're searched
    const gameKeywords: Record<string, string[]> = {
      // Gaming
      'gta': ['gta', 'grand theft auto'],
      'valorant': ['valorant'],
      'fortnite': ['fortnite'],
      'minecraft': ['minecraft'],
      'cod': ['call of duty', 'cod', 'warzone'],
      'fifa': ['fifa'],
      'league of legends': ['league of legends', 'lol'],
      'dota': ['dota'],
      'csgo': ['counter-strike', 'csgo', 'cs2', 'cs:go'],
      'apex': ['apex legends', 'apex'],

      // Gambling & Casino
      'casino': ['casino', 'slots', 'roulette', 'blackjack', 'gambling', 'baccarat', 'craps'],
      'poker': ['poker', 'casino', 'texas holdem', 'gambling'],
      'slots': ['slots', 'casino', 'gambling', 'slot machines'],
      'betting': ['betting', 'sports betting', 'casino', 'gambling', 'sportsbook'],
      'gambling': ['gambling', 'casino', 'betting', 'wagering'],
      'roulette': ['roulette', 'casino', 'gambling'],
      'blackjack': ['blackjack', 'casino', 'gambling', '21'],
      'baccarat': ['baccarat', 'casino', 'gambling'],
      'craps': ['craps', 'casino', 'gambling'],
      'bingo': ['bingo', 'casino', 'gambling'],
      'keno': ['keno', 'casino', 'gambling'],
      'lottery': ['lottery', 'gambling'],
      'scratch': ['scratch cards', 'gambling', 'lottery'],
      'sportsbook': ['sportsbook', 'sports betting', 'betting'],
      'bookmaker': ['bookmaker', 'betting', 'sports betting'],
      'odds': ['betting', 'sports betting', 'gambling'],
      'wager': ['wagering', 'betting', 'gambling'],
      'jackpot': ['jackpot', 'casino', 'gambling', 'slots'],
      'dice': ['dice', 'casino', 'gambling', 'craps']
    };

    // Check for game keywords and add them explicitly
    for (const [keyword, variations] of Object.entries(gameKeywords)) {
      if (q.includes(keyword)) {
        tags.push(...variations);
        logger.info('🎮 Game keyword detected', { keyword, variations, query: q });
      }
    }

    // IMPROVED: Brand name to category mapping
    // Map known iGaming brand names to their relevant content categories
    // Global betting, casino, and gambling brands - COMPREHENSIVE DATABASE
    const brandMappings: Record<string, string[]> = {
      // === LATAM OPERATORS ===
      // Major LATAM operators
      'betano': ['betting', 'casino', 'sports betting', 'gambling', 'slots'],
      'bet365': ['betting', 'sports betting', 'casino', 'gambling'],
      'codere': ['betting', 'casino', 'gambling', 'sports betting'],
      'caliente': ['betting', 'casino', 'sports betting', 'gambling', 'slots'],
      'betsson': ['betting', 'casino', 'gambling', 'sports betting', 'slots'],
      'betway': ['betting', 'sports betting', 'casino', 'gambling'],
      'pinup': ['betting', 'casino', 'sports betting', 'gambling', 'slots'],
      'pin-up': ['betting', 'casino', 'sports betting', 'gambling', 'slots'],
      'pin up': ['betting', 'casino', 'sports betting', 'gambling', 'slots'],

      // Mexico
      'caliente.mx': ['betting', 'casino', 'sports betting', 'gambling'],
      'betcris': ['betting', 'sports betting', 'casino', 'gambling'],
      'te apuesto': ['betting', 'sports betting', 'casino', 'gambling'],
      'telmo': ['betting', 'sports betting', 'casino'],
      'strendus': ['betting', 'casino', 'sports betting', 'gambling'],

      // Colombia
      'wplay': ['betting', 'sports betting', 'casino', 'gambling'],
      'rushbet': ['betting', 'sports betting', 'casino', 'gambling'],
      'zamba': ['betting', 'casino', 'sports betting', 'gambling'],
      'betjuego': ['betting', 'sports betting', 'casino'],

      // Argentina
      'apuestatotal': ['betting', 'sports betting', 'casino', 'gambling'],
      'betwarrior': ['betting', 'sports betting', 'casino', 'gambling'],

      // Chile
      'enjoy': ['casino', 'gambling'],

      // Brazil
      'betfair': ['betting', 'sports betting', 'casino', 'gambling'],
      'sportingbet': ['betting', 'sports betting', 'casino'],
      'rivalo': ['betting', 'sports betting', 'casino', 'gambling'],

      // Peru
      'doradobet': ['betting', 'sports betting', 'casino', 'gambling'],
      'inkabet': ['betting', 'sports betting', 'casino', 'gambling'],
      'solbet': ['betting', 'sports betting', 'casino'],

      // === EUROPEAN OPERATORS ===
      // UK
      'william hill': ['betting', 'sports betting', 'casino', 'gambling'],
      'ladbrokes': ['betting', 'sports betting', 'casino', 'gambling'],
      'coral': ['betting', 'sports betting', 'casino'],
      'paddy power': ['betting', 'sports betting', 'casino', 'gambling'],
      'sky bet': ['betting', 'sports betting'],
      'betfred': ['betting', 'sports betting', 'casino'],
      'betvictor': ['betting', 'sports betting', 'casino'],
      '888sport': ['betting', 'sports betting', 'casino'],
      '888casino': ['casino', 'slots', 'gambling'],
      '888poker': ['poker', 'casino', 'gambling'],

      // Malta/International
      'bwin': ['betting', 'sports betting', 'casino', 'gambling'],
      'unibet': ['betting', 'sports betting', 'casino', 'gambling'],
      'mr green': ['casino', 'gambling', 'sports betting'],
      'casumo': ['casino', 'gambling', 'slots'],
      'leovegas': ['casino', 'gambling', 'sports betting'],
      'bethard': ['betting', 'sports betting', 'casino'],

      // Nordic
      'nordicbet': ['betting', 'sports betting', 'casino'],
      'coolbet': ['betting', 'sports betting', 'casino'],
      'paf': ['casino', 'gambling', 'betting'],

      // German
      'tipico': ['betting', 'sports betting', 'casino'],
      'bwin.de': ['betting', 'sports betting', 'casino'],
      'bet-at-home': ['betting', 'sports betting', 'casino'],

      // Netherlands
      'toto': ['betting', 'sports betting'],
      'betcity.nl': ['betting', 'sports betting', 'casino'],
      'holland casino': ['casino', 'gambling'],

      // French
      'pmu': ['betting', 'sports betting', 'horse racing'],
      'parionssport': ['betting', 'sports betting'],
      'winamax': ['poker', 'sports betting'],

      // Italian
      'snai': ['betting', 'sports betting', 'casino'],
      'sisal': ['betting', 'sports betting', 'casino'],
      'lottomatica': ['betting', 'casino', 'lottery'],
      'eurobet': ['betting', 'sports betting', 'casino'],

      // Spanish
      'sportium': ['betting', 'sports betting', 'casino'],
      'marca apuestas': ['betting', 'sports betting'],
      'paf.es': ['casino', 'gambling', 'betting'],

      // === ASIAN OPERATORS ===
      'sbobet': ['betting', 'sports betting', 'casino', 'gambling'],
      'fun88': ['betting', 'sports betting', 'casino', 'gambling'],
      'dafabet': ['betting', 'sports betting', 'casino', 'gambling'],
      'w88': ['betting', 'sports betting', 'casino', 'gambling'],
      '12bet': ['betting', 'sports betting', 'casino'],
      'm88': ['betting', 'sports betting', 'casino'],
      '188bet': ['betting', 'sports betting', 'casino'],
      'maxbet': ['betting', 'sports betting'],

      // === GLOBAL OPERATORS ===
      '1xbet': ['betting', 'casino', 'sports betting', 'gambling', 'slots'],
      '1xbit': ['betting', 'casino', 'sports betting', 'gambling', 'crypto'],
      '1xslots': ['casino', 'slots', 'gambling'],
      '22bet': ['betting', 'sports betting', 'casino', 'gambling'],
      'melbet': ['betting', 'sports betting', 'casino', 'gambling', 'slots'],
      'betwinner': ['betting', 'sports betting', 'casino', 'gambling'],
      'parimatch': ['betting', 'sports betting', 'casino', 'gambling'],
      'marathonbet': ['betting', 'sports betting'],
      'marathon': ['betting', 'sports betting'],
      'pinnacle': ['betting', 'sports betting'],
      '10bet': ['betting', 'sports betting', 'casino'],
      '20bet': ['betting', 'sports betting', 'casino'],
      'megapari': ['betting', 'sports betting', 'casino', 'gambling'],
      'mostbet': ['betting', 'sports betting', 'casino', 'gambling'],
      'linebet': ['betting', 'sports betting', 'casino'],
      'betboom': ['betting', 'sports betting', 'casino'],
      'leonbet': ['betting', 'sports betting', 'casino'],
      'betcity': ['betting', 'sports betting', 'casino'],
      'olimpbet': ['betting', 'sports betting'],
      'fonbet': ['betting', 'sports betting', 'casino'],
      'ligastavok': ['betting', 'sports betting'],
      'winline': ['betting', 'sports betting', 'casino'],

      // === POKER BRANDS ===
      'pokerstars': ['poker', 'casino', 'gambling', 'sports betting'],
      'partypoker': ['poker', 'casino', 'gambling'],
      'ggpoker': ['poker', 'casino', 'gambling'],
      'pokerking': ['poker', 'casino'],
      'natural8': ['poker', 'casino'],
      'wsop': ['poker', 'casino'],

      // === CASINO BRANDS ===
      'casino.com': ['casino', 'gambling', 'slots'],
      'borgata': ['casino', 'gambling'],
      'golden nugget': ['casino', 'gambling'],
      'harrahs': ['casino', 'gambling'],
      'virgin casino': ['casino', 'gambling'],
      'bet rivers': ['casino', 'gambling', 'sports betting'],

      // === CRYPTO GAMBLING ===
      'stake': ['casino', 'gambling', 'crypto', 'slots', 'sports betting'],
      'stake.com': ['casino', 'gambling', 'crypto', 'slots', 'sports betting'],
      'rollbit': ['casino', 'gambling', 'crypto', 'slots'],
      'bc.game': ['casino', 'gambling', 'crypto', 'sports betting'],
      'bc game': ['casino', 'gambling', 'crypto', 'sports betting'],
      'duelbits': ['casino', 'gambling', 'crypto'],
      'roobet': ['casino', 'gambling', 'slots', 'crypto'],
      'shuffle': ['casino', 'gambling', 'crypto'],
      'shuffle.com': ['casino', 'gambling', 'crypto'],
      'cloudbet': ['betting', 'sports betting', 'casino', 'crypto'],
      'bitcasino': ['casino', 'gambling', 'crypto'],
      'bitcasino.io': ['casino', 'gambling', 'crypto'],
      'sportsbet.io': ['sports betting', 'casino', 'crypto'],
      'wolf.bet': ['casino', 'gambling', 'crypto'],
      'wolfbet': ['casino', 'gambling', 'crypto'],
      'bets.io': ['sports betting', 'casino', 'crypto'],
      'empire.io': ['casino', 'gambling', 'crypto'],
      'fortunejack': ['casino', 'gambling', 'crypto'],
      'bitslot': ['casino', 'slots', 'crypto'],
      'trustdice': ['casino', 'gambling', 'crypto'],
      'bitspinwin': ['casino', 'gambling', 'crypto'],
      'wildcoins': ['casino', 'gambling', 'crypto'],
      'jackbit': ['casino', 'gambling', 'crypto', 'sports betting'],
      'metaspins': ['casino', 'gambling', 'crypto'],
      'vave': ['casino', 'gambling', 'crypto', 'sports betting'],
      'bitubet': ['casino', 'gambling', 'crypto'],
      'coins.game': ['casino', 'gambling', 'crypto'],
      'fairspin': ['casino', 'gambling', 'crypto'],
      'betfury': ['casino', 'gambling', 'crypto'],
      'cryptoleo': ['casino', 'gambling', 'crypto'],
      'mystake': ['casino', 'gambling', 'crypto', 'sports betting'],
      'gamdom': ['casino', 'gambling', 'crypto', 'csgo'],
      'csgoroll': ['casino', 'gambling', 'crypto', 'csgo'],
      'csgo500': ['casino', 'gambling', 'crypto', 'csgo'],
      'csgoluck': ['casino', 'gambling', 'crypto', 'csgo'],
      'csgoempire': ['casino', 'gambling', 'crypto', 'csgo'],

      // === ESPORTS BETTING ===
      'gg.bet': ['esports betting', 'betting', 'casino', 'gambling'],
      'ggbet': ['esports betting', 'betting', 'casino', 'gambling'],
      'buff.bet': ['esports betting', 'betting'],
      'buffbet': ['esports betting', 'betting'],
      'loot.bet': ['esports betting', 'betting', 'casino'],
      'lootbet': ['esports betting', 'betting', 'casino'],
      'rivalry': ['esports betting', 'betting', 'casino'],
      'thunderpick': ['esports betting', 'betting', 'casino', 'crypto'],
      'arcanebet': ['esports betting', 'betting', 'casino'],
      'eggbet': ['esports betting', 'betting', 'casino'],
      'betbeast': ['esports betting', 'betting'],
      'picklebet': ['esports betting', 'betting'],

      // === US OPERATORS ===
      'fanduel': ['sports betting', 'casino', 'gambling', 'fantasy sports'],
      'draftkings': ['sports betting', 'casino', 'gambling', 'fantasy sports'],
      'betmgm': ['sports betting', 'casino', 'gambling'],
      'caesars sportsbook': ['sports betting', 'casino', 'gambling'],
      'barstool': ['sports betting', 'casino'],
      'pointsbet': ['sports betting', 'casino'],
      'foxbet': ['sports betting', 'casino'],
      'sugarhouse': ['sports betting', 'casino'],

      // === AUSTRALIAN OPERATORS ===
      'sportsbet': ['sports betting', 'betting'],
      'bet365.au': ['sports betting', 'betting', 'gambling'],
      'ladbrokes.au': ['sports betting', 'betting'],
      'tab': ['sports betting', 'betting', 'horse racing'],
      'neds': ['sports betting', 'betting'],
      'unibet.au': ['sports betting', 'betting'],
      'pointsbet.au': ['sports betting', 'betting'],

      // === AFRICAN OPERATORS ===
      'betway.africa': ['sports betting', 'betting', 'casino'],
      'hollywoodbets': ['sports betting', 'betting', 'casino'],
      'supabets': ['sports betting', 'betting'],
      'betway.za': ['sports betting', 'betting', 'casino'],
      '10bet.africa': ['sports betting', 'betting', 'casino'],

      // === MISC GLOBAL ===
      'bodog': ['betting', 'casino', 'sports betting', 'gambling', 'poker'],
      'bovada': ['betting', 'casino', 'sports betting', 'gambling', 'poker'],
      'intertops': ['sports betting', 'casino', 'poker'],
      'betonline': ['sports betting', 'casino', 'poker', 'gambling'],
      'mybookie': ['sports betting', 'casino'],
      'xbet': ['sports betting', 'casino'],
      'heritage': ['sports betting'],
      '5dimes': ['sports betting', 'casino'],

      // === ADDITIONAL OPERATORS ===
      // More European
      'interwetten': ['sports betting', 'casino'],
      'sportingindex': ['sports betting'],
      'spreadex': ['sports betting'],
      'matchbook': ['sports betting'],
      'smarkets': ['sports betting'],
      'betdaq': ['sports betting'],
      'mansion88': ['casino', 'gambling', 'sports betting'],

      // More LATAM
      'betmotion': ['betting', 'casino', 'sports betting', 'gambling'],
      'brazino777': ['casino', 'gambling', 'slots'],
      'pixbet': ['betting', 'sports betting', 'casino'],
      'blaze': ['casino', 'gambling', 'crypto'],
      'esporte da sorte': ['sports betting', 'casino', 'gambling'],
      'reals': ['betting', 'casino', 'sports betting'],
      'betnacional': ['sports betting', 'casino'],
      'f12bet': ['sports betting', 'casino'],
      'superbet': ['sports betting', 'casino', 'gambling'],
      'novibet': ['sports betting', 'casino', 'gambling'],

      // More Asian
      'cmd368': ['sports betting'],
      'ibcbet': ['sports betting'],
      'uwin': ['casino', 'sports betting'],
      'letou': ['sports betting', 'casino'],
      'happyluke': ['sports betting', 'casino'],
      'vwin': ['sports betting', 'casino'],

      // More Crypto
      'nitrogen': ['sports betting', 'casino', 'crypto'],
      'nitrogen sports': ['sports betting', 'crypto'],
      'bitstarz': ['casino', 'gambling', 'crypto'],
      'kingbilly': ['casino', 'gambling', 'crypto'],
      '7bitcasino': ['casino', 'gambling', 'crypto'],
      'bitcoincasino.us': ['casino', 'gambling', 'crypto'],
      'bitdreams': ['casino', 'gambling', 'crypto'],
      'vegas': ['casino', 'gambling', 'crypto'],

      // More niche operators
      'nextbet': ['sports betting', 'casino'],
      'tipsport': ['sports betting', 'casino'],
      'chance': ['sports betting', 'casino'],
      'fortuna': ['sports betting', 'casino'],
      'niké': ['sports betting'],
      'synottip': ['sports betting', 'casino'],
      'tonybet': ['sports betting', 'casino', 'poker'],
      'redbet': ['sports betting', 'casino'],
      'betrebels': ['sports betting', 'casino'],
      'campeonbet': ['sports betting', 'casino'],
      'vbet': ['sports betting', 'casino'],
      'winmasters': ['sports betting', 'casino'],
      'netbet': ['sports betting', 'casino', 'poker'],

      // Fantasy & DFS
      'yahoo fantasy': ['fantasy sports'],
      'espn fantasy': ['fantasy sports'],
      'sleeper': ['fantasy sports'],
      'underdog': ['fantasy sports'],
      'prizepicks': ['fantasy sports'],
      'parlayplay': ['fantasy sports']
    };

    // Check if query contains brand names and expand tags
    for (const [brand, categories] of Object.entries(brandMappings)) {
      const brandRegex = new RegExp(`\\b${brand.replace(/\s+/g, '\\s+')}\\b`, 'i');
      if (brandRegex.test(q)) {
        // Replace brand-specific tag with category tags
        const brandIndex = tags.findIndex(t => t.toLowerCase().includes(brand.toLowerCase()));
        if (brandIndex >= 0) {
          tags.splice(brandIndex, 1, ...categories);
        } else {
          tags.push(...categories);
        }
        logger.info('🏷️  Mapped brand to categories', { brand, categories });
      }
    }

    // Follower count detection (improved patterns)
    let minFollowers: number | undefined;
    let maxFollowers: number | undefined;

    // Pattern matching for follower counts
    const followerPatterns = [
      { pattern: /(\d+(?:\.\d+)?)\s*million|(\d+(?:\.\d+)?)m\b/i, multiplier: 1_000_000 },
      { pattern: /(\d+(?:\.\d+)?)\s*thousand|(\d+(?:\.\d+)?)k\b/i, multiplier: 1_000 },
      { pattern: /(\d+)\+/i, multiplier: 1 }, // e.g., "50000+"
      { pattern: /over\s+(\d+(?:\.\d+)?)\s*(k|m|thousand|million)/i, multiplier: 1 },
      { pattern: /more\s+than\s+(\d+(?:\.\d+)?)\s*(k|m|thousand|million)/i, multiplier: 1 }
    ];

    for (const { pattern, multiplier } of followerPatterns) {
      const match = q.match(pattern);
      if (match) {
        const num = parseFloat(match[1] || match[2]);
        const suffix = match[3] || (pattern.source.includes('m') ? 'm' : pattern.source.includes('k') ? 'k' : '');
        let finalMultiplier = multiplier;

        if (suffix === 'm' || suffix === 'million') finalMultiplier = 1_000_000;
        else if (suffix === 'k' || suffix === 'thousand') finalMultiplier = 1_000;

        minFollowers = Math.round(num * finalMultiplier);
        break;
      }
    }

    // Live status detection
    const isLive = /\blive\b|\blive now\b|\bstreaming now\b|\bcurrently streaming\b|\bon air\b/.test(q) ? true : undefined;

    // Language detection
    let language: string | undefined;
    if (/\bes\b|\bspanish\b|\bespañol\b/.test(q)) language = 'es';
    else if (/\bpt\b|\bportuguese\b|\bportuguês\b/.test(q)) language = 'pt';
    else if (/\ben\b|\benglish\b|\binglés\b/.test(q)) language = 'en';

    // VTuber detection
    const isVtuber = /\bvtuber\b|\bvirtual\b|\banime\b|\bavatar\b/.test(q) ? true : undefined;

    // Camera usage detection
    const usesCamera = /\bcamera\b|\bfacecam\b|\bwebcam\b|\bface cam\b/.test(q) ? true : undefined;

    // Detect specific number requests in query
    let limit = this.extractRequestedCount(query) || 10000; // Return ALL matches by default (max 10000)

    const result = {
      platforms: platforms.length > 0 ? platforms : undefined,
      regions: regions.length > 0 ? regions : undefined,
      tags: tags.length > 0 ? tags : undefined,
      minFollowers,
      maxFollowers,
      isLive,
      usesCamera,
      isVtuber,
      language,
      limit
    };

    logger.info('🔍 parseQueryWithHeuristics result', {
      query,
      result,
      extractedTags: tags
    });

    return result;
  }

  /**
   * Validate and refine search parameters to ensure relevance
   */
  private validateAndRefineSearchParams(params: StreamerSearchParams, originalQuery: string): StreamerSearchParams {
    const q = originalQuery.toLowerCase();

    // Normalize tags to lowercase for consistent matching (database stores tags in various cases)
    if (params.tags && params.tags.length > 0) {
      params.tags = params.tags.map(tag => tag.toLowerCase());
    }

    // If no specific criteria found, make some intelligent defaults
    if (!params.platforms?.length && !params.regions?.length && !params.tags?.length &&
        !params.minFollowers && !params.isLive && !params.language) {

      // Default to Spanish for LATAM focus if no language specified
      if (!params.language && !/\benglish\b|\bportuguese\b/.test(q)) {
        params.language = 'es';
      }

      // If query mentions "LATAM" or "Latin America", add multiple regions
      if (/\blatam\b|\blatin america\b|\blatinoamerica\b/.test(q)) {
        params.regions = ['MEXICO', 'COLOMBIA', 'ARGENTINA', 'CHILE', 'PERU'] as Region[];
      }
    }

    // CRITICAL: Don't override the limit if the user specifically requested a number
    const requestedCount = this.extractRequestedCount(originalQuery);
    if (requestedCount) {
      // User specifically requested a number - honor it exactly
      params.limit = requestedCount;
      logger.info('Honoring user-requested count', { originalQuery, requestedCount });
    } else {
      // Only apply default limits if no specific number was requested
      if (!params.limit) {
        params.limit = 10000; // Return ALL matches by default
      }
    }

    return params;
  }

  /**
   * Extract specific number request from user query
   */
  private extractRequestedCount(query: string): number | null {
    const q = query.toLowerCase();

    logger.info('Extracting count from query', { originalQuery: query, lowerQuery: q });

    // Patterns for specific count requests
    const countPatterns = [
      /\bi\s+need\s+(\d+)\s+(?:streamers|influencers|creators|twitch\s+streamers|youtube\s+streamers)/i,
      /\b(?:show|find|get|give)\s+me\s+(\d+)\s+(?:streamers|influencers|creators|twitch\s+streamers|youtube\s+streamers)/i,
      /\b(?:top|best)\s+(\d+)\s+(?:streamers|influencers|creators|twitch\s+streamers|youtube\s+streamers)/i,
      /\b(\d+)\s+(?:streamers|influencers|creators|twitch\s+streamers|youtube\s+streamers)/i,
      /\b(?:find|search|list)\s+(\d+)\s+(?:streamers|influencers|creators)/i,
      /\b(\d+)\s+(?:of|from)\s+(?:the\s+)?(?:top|best)/i,
      /\bfirst\s+(\d+)/i,
      /\b(\d+)\s+results/i,
      /\bwant\s+(\d+)\s+(?:streamers|influencers|creators)/i,
      /\blooking\s+for\s+(\d+)\s+(?:streamers|influencers|creators)/i
    ];

    for (let i = 0; i < countPatterns.length; i++) {
      const pattern = countPatterns[i];
      const match = q.match(pattern);
      logger.info(`Testing pattern ${i}`, { pattern: pattern.source, match: match });
      if (match) {
        const count = parseInt(match[1]);
        logger.info('Found count match', { pattern: pattern.source, rawMatch: match[1], parsedCount: count });
        // Allow large requests up to 10000 streamers
        if (count >= 1 && count <= 10000) {
          logger.info('Returning valid count', { count });
          return count;
        } else {
          logger.warn('Count outside valid range', { count, range: '1-10000' });
        }
      }
    }

    logger.info('No count pattern matched');
    return null;
  }

  /**
   * Determine smart ordering based on search parameters and intent
   */
  private determineSearchOrdering(params: StreamerSearchParams): any[] {
    // If specifically looking for live streamers, prioritize by current viewers
    if (params.isLive) {
      return [
        { currentViewers: 'desc' },
        { followers: 'desc' }
      ];
    }

    // If looking for specific follower counts, sort by followers primarily
    if (params.minFollowers) {
      return [
        { followers: 'desc' },
        { isLive: 'desc' },
        { currentViewers: 'desc' }
      ];
    }

    // If looking for specific content types or regions, balance relevance
    if (params.tags?.length || params.regions?.length) {
      return [
        { followers: 'desc' },
        { isLive: 'desc' },
        { currentViewers: 'desc' }
      ];
    }

    // Default: balanced ordering focusing on follower count first
    return [
      { followers: 'desc' },
      { isLive: 'desc' },
      { currentViewers: 'desc' }
    ];
  }

  /**
   * Generate fast template-based summary without OpenAI call
   */
  private generateFastSummary(count: number, params: StreamerSearchParams | null, query: string, streamers: any[] = []): string {
    if (count === 0) {
      return `No streamers found matching your criteria. Try broadening your search.`;
    }

    const requestedLimit = params?.limit || 20;
    const tags = params?.tags || [];
    const regions = params?.regions || [];
    const platforms = params?.platforms || [];
    const hasGamblingTags = tags.some(t => ['CASINO', 'SLOTS', 'GAMBLING', 'BETTING', 'POKER', '_CAT_GAMBLING'].includes(t as string));
    const hasRegions = regions.length > 0;

    // Analyze streamer stats
    const liveCount = streamers.filter((s: any) => s.isLive).length;
    const totalFollowers = streamers.reduce((sum: number, s: any) => sum + (s.followers || 0), 0);
    const avgFollowers = streamers.length > 0 ? Math.floor(totalFollowers / streamers.length) : 0;
    const topStreamer = streamers[0]; // First result is highest ranked
    const platformBreakdown = streamers.reduce((acc: any, s: any) => {
      const p = s.platform || 'UNKNOWN';
      acc[p] = (acc[p] || 0) + 1;
      return acc;
    }, {});

    // Analyze enrichment data
    const enrichedCount = streamers.filter((s: any) => s.profileDescription || s.externalLinks || (s.tags && s.tags.length > 0)).length;
    const withSocialLinks = streamers.filter((s: any) => s.externalLinks && Object.keys(s.externalLinks).length > 0).length;
    const withPanels = streamers.filter((s: any) => s.panelImages && s.panelImages.length > 0).length;

    // Analyze common tags (top 3 most frequent)
    const tagFrequency: Record<string, number> = {};
    streamers.forEach((s: any) => {
      if (s.tags && Array.isArray(s.tags)) {
        s.tags.forEach((tag: string) => {
          tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
        });
      }
    });
    const topTags = Object.entries(tagFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([tag]) => tag);

    // Detect campaign type from query and tags
    let campaignType = '';
    if (hasGamblingTags || /betting|casino|slots|gambling|poker/i.test(query)) {
      campaignType = 'casino/betting';
    } else if (/gaming|game|esports/i.test(query)) {
      campaignType = 'gaming';
    } else if (/music/i.test(query)) {
      campaignType = 'music';
    } else if (/irl|lifestyle/i.test(query)) {
      campaignType = 'lifestyle';
    }

    // Build informative summary
    let summary = '';

    // Main finding
    summary = `Found ${count} ${campaignType} streamer${count !== 1 ? 's' : ''}`;

    // Add region context
    if (hasRegions) {
      const regionLabels = regions.map(r => {
        const label = (r as string).toUpperCase();
        return label === 'BRAZIL' ? 'Brazilian' :
               label === 'MEXICO' ? 'Mexican' :
               label === 'ARGENTINA' ? 'Argentinian' :
               label === 'COLOMBIA' ? 'Colombian' :
               label === 'CHILE' ? 'Chilean' :
               label === 'PERU' ? 'Peruvian' :
               label === 'VENEZUELA' ? 'Venezuelan' :
               label === 'ECUADOR' ? 'Ecuadorian' :
               label === 'PARAGUAY' ? 'Paraguayan' :
               label === 'URUGUAY' ? 'Uruguayan' : label;
      });
      summary += ` from ${regionLabels.join(', ')}`;
    }

    summary += '.';

    // Add key insights
    const insights: string[] = [];

    // Top streamer highlight
    if (topStreamer) {
      const formattedFollowers = topStreamer.followers >= 1000000
        ? `${(topStreamer.followers / 1000000).toFixed(1)}M`
        : topStreamer.followers >= 1000
        ? `${Math.floor(topStreamer.followers / 1000)}K`
        : topStreamer.followers;
      insights.push(`Top: ${topStreamer.displayName || topStreamer.username} (${formattedFollowers} followers)`);
    }

    // Live status
    if (liveCount > 0) {
      insights.push(`${liveCount} currently live`);
    }

    // Average reach
    if (avgFollowers >= 10000) {
      const formattedAvg = avgFollowers >= 1000000
        ? `${(avgFollowers / 1000000).toFixed(1)}M`
        : `${Math.floor(avgFollowers / 1000)}K`;
      insights.push(`avg ${formattedAvg} followers`);
    }

    // Platform distribution (only if multiple platforms)
    const platformKeys = Object.keys(platformBreakdown);
    if (platformKeys.length > 1) {
      const platformSummary = platformKeys
        .map(p => `${platformBreakdown[p]} ${p.toLowerCase()}`)
        .join(', ');
      insights.push(platformSummary);
    }

    // Add enrichment insights
    if (enrichedCount > count * 0.5) {
      // If more than 50% have enrichment data
      const enrichmentDetails: string[] = [];
      if (withSocialLinks > count * 0.3) {
        enrichmentDetails.push(`${withSocialLinks} with verified socials`);
      }
      if (withPanels > count * 0.2) {
        enrichmentDetails.push(`${withPanels} with panel data`);
      }
      if (enrichmentDetails.length > 0) {
        insights.push(enrichmentDetails.join(', '));
      }
    }

    // Add top tags insight
    if (topTags.length > 0 && !hasGamblingTags) {
      // Only show if not already filtering by gambling tags
      insights.push(`top tags: ${topTags.join(', ')}`);
    }

    if (insights.length > 0) {
      summary += ` ${insights.join(' • ')}.`;
    }

    return summary;
  }
}

export const aiSearchService = new AISearchService();
