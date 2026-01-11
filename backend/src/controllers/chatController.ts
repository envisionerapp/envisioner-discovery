import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/database';
import { chatService } from '../services/chatService';
import { aiSearchService } from '../services/aiSearchService';
import { claudeService } from '../services/claudeService';
import { filterCategoryTags } from '../utils/tagUtils';

export class ChatController {
  sendMessage = asyncHandler(async (req: Request, res: Response) => {
    const { message, conversationId } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // Process message with AI chat service
    const result = await chatService.processMessage(userId, message, conversationId);

    logger.info('AI chat message processed', {
      userId,
      conversationId: result.conversationId,
      resultCount: result.streamers?.length || 0,
      processingTime: result.processingTime
    });

    // Filter out category tags from streamers
    const filteredStreamers = (result.streamers || []).map(s => ({
      ...s,
      tags: filterCategoryTags(s.tags)
    }));

    res.json({
      success: true,
      data: {
        messageId: result.messageId,
        conversationId: result.conversationId,
        response: result.response,
        streamers: filteredStreamers,
        processingTime: result.processingTime,
        timestamp: new Date()
      }
    });
  });

  getConversation = asyncHandler(async (req: Request, res: Response) => {
    const { conversationId } = req.params;
    const userId = (req as any).user?.id;
    const limit = parseInt(req.query.limit as string) || 50;

    const conversation = await chatService.getConversation(userId, conversationId, limit);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    res.json({
      success: true,
      data: conversation
    });
  });

  getChatHistory = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const limit = parseInt(req.query.limit as string) || 20;

    const conversations = await chatService.getUserConversations(userId, limit);

    res.json({
      success: true,
      data: conversations
    });
  });

  deleteConversation = asyncHandler(async (req: Request, res: Response) => {
    const { conversationId } = req.params;
    const userId = (req as any).user?.id;

    const success = await chatService.deleteConversation(userId, conversationId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found or could not be deleted'
      });
    }

    res.json({
      success: true,
      message: 'Conversation deleted successfully'
    });
  });

  clearChatHistory = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;

    // Delete all conversations for user
    const conversations = await chatService.getUserConversations(userId);
    let deletedCount = 0;

    for (const conv of conversations) {
      const success = await chatService.deleteConversation(userId, conv.id);
      if (success) deletedCount++;
    }

    res.json({
      success: true,
      message: `Cleared ${deletedCount} conversations`,
      data: { deletedCount }
    });
  });

  getConversationSuggestions = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;

    const suggestions = await chatService.getConversationSuggestions(userId);

    res.json({
      success: true,
      data: suggestions
    });
  });

  searchStreamers = asyncHandler(async (req: Request, res: Response) => {
    const { query, conversationId, searchParams } = req.body;
    const userId = (req as any).user?.id;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    // Use AI search service directly for API endpoint
    const result = await aiSearchService.searchStreamersWithAI({
      userId,
      query,
      conversationId,
      searchParams // Pass through any pre-determined search params (e.g., platform filters)
    });

    let streamers = result.streamers;

    // Enhanced iGaming intelligence analysis for betting/gaming campaigns
    if (query.toLowerCase().includes('betting') ||
        query.toLowerCase().includes('casino') ||
        query.toLowerCase().includes('gambling')) {

      try {
        const { igamingIntelligenceService } = await import('../services/igamingIntelligenceService');
        const igamingAnalysis = await igamingIntelligenceService.analyzeStreamersForCampaign(
          streamers,
          'betting'
        );

        // Apply intelligence analysis to streamers
        streamers = (streamers as any[]).map((streamer: any) => {
          const analysis = igamingAnalysis.find(a => a.streamer.id === streamer.id);
          if (!analysis) return streamer;

          return {
            ...streamer,
            igamingScore: analysis.overallScore,
            brandSafetyScore: analysis.intelligence.advancedRiskProfile.brandSafetyScore,
            audiencePsychology: analysis.intelligence.audiencePsychology,
            conversionPotential: {
              ctr: analysis.campaignPredictions.predictedCTR,
              conversionRate: analysis.campaignPredictions.predictedConversions,
              roi: analysis.campaignPredictions.predictedROI
            },
            gamblingCompatibility: analysis.overallScore >= 60,
            riskAssessment: {
              score: analysis.overallScore,
              tier: analysis.tier,
              confidence: analysis.confidenceLevel,
              riskLevel: analysis.campaignPredictions.riskLevel
            },
            igamingIntelligence: analysis.intelligence
          };
        });

        // Sort by iGaming score for betting campaigns
        streamers.sort((a, b) => (b.igamingScore || 0) - (a.igamingScore || 0));

      } catch (error) {
        logger.error('Error in iGaming intelligence analysis:', error);
      }
    }

    // Filter out category tags from streamers
    const filteredStreamers = streamers.map((s: any) => ({
      ...s,
      tags: filterCategoryTags(s.tags || [])
    }));

    res.json({
      success: true,
      data: {
        query,
        streamers: filteredStreamers,
        totalCount: result.totalCount,
        summary: result.summary,
        searchParams: result.searchParams,
        processingTime: result.processingTime
      }
    });
  });

  compareStreamers = asyncHandler(async (req: Request, res: Response) => {
    const { streamerIds } = req.body;

    if (!streamerIds || !Array.isArray(streamerIds) || streamerIds.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'At least 2 streamer IDs are required for comparison'
      });
    }

    const result = await aiSearchService.compareStreamers(streamerIds);

    res.json({
      success: true,
      data: result
    });
  });

  findSimilarStreamers = asyncHandler(async (req: Request, res: Response) => {
    const { streamerId } = req.params;
    const limit = parseInt(req.query.limit as string) || 5;

    const similarStreamers = await aiSearchService.findSimilarStreamers(streamerId, limit);

    // Filter out category tags from streamers
    const filteredStreamers = similarStreamers.map(s => ({
      ...s,
      tags: filterCategoryTags(s.tags)
    }));

    res.json({
      success: true,
      data: filteredStreamers
    });
  });

  getTrendingInsights = asyncHandler(async (req: Request, res: Response) => {
    const region = req.query.region as any;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await aiSearchService.getTrendingStreamersWithInsights(region, limit);

    // Filter out category tags from streamers
    const filteredResult = {
      ...result,
      streamers: result.streamers.map(s => ({
        ...s,
        tags: filterCategoryTags(s.tags)
      }))
    };

    res.json({
      success: true,
      data: filteredResult
    });
  });

  getChatAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const days = parseInt(req.query.days as string) || 7;

    const analytics = await chatService.getChatAnalytics(userId, days);

    res.json({
      success: true,
      data: analytics
    });
  });

  getSearchAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const timeframe = parseInt(req.query.timeframe as string) || 7;

    const analytics = await aiSearchService.getSearchAnalytics(userId, timeframe);

    res.json({
      success: true,
      data: analytics
    });
  });

  healthCheck = asyncHandler(async (req: Request, res: Response) => {
    const openaiStatus = await claudeService.healthCheck();

    res.json({
      success: true,
      data: {
        openai: openaiStatus,
        chat: true,
        search: true,
        timestamp: new Date()
      }
    });
  });

  getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { db } = await import('../utils/database');

      const totalStreamers = await db.streamer.count();
      const liveStreamers = await db.streamer.count({
        where: { isLive: true }
      });
      const activeCampaigns = await db.campaign.count({
        where: { isActive: true }
      });

      res.json({
        success: true,
        data: {
          totalStreamers,
          liveStreamers,
          activeCampaigns,
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('Error fetching dashboard stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard statistics'
      });
    }
  });

  getTopStreamers = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { db } = await import('../utils/database');
      const limit = parseInt(req.query.limit as string) || 5;
      const platform = (req.query.platform as string | undefined)?.trim();

      // Build where clause
      const where: any = {
        highestViewers: { gt: 0 }
      };
      if (platform) {
        where.platform = platform.toUpperCase();
      }

      // Get streamers with highest peak viewers (not necessarily live)
      const topStreamers = await db.streamer.findMany({
        where,
        orderBy: { highestViewers: 'desc' },
        take: limit,
        select: {
          id: true,
          username: true,
          displayName: true,
          platform: true,
          region: true,
          avatarUrl: true,
          highestViewers: true,
          currentViewers: true,
          isLive: true,
          followers: true,
          tags: true,
          lastStreamed: true
        }
      });

      // Filter out category tags from streamers
      const filteredStreamers = topStreamers.map(s => ({
        ...s,
        tags: filterCategoryTags(s.tags)
      }));

      res.json({
        success: true,
        data: filteredStreamers
      });
    } catch (error) {
      logger.error('Error fetching top streamers:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch top streamers'
      });
    }
  });

  getTopCategories = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { db } = await import('../utils/database');
      const limit = parseInt(req.query.limit as string) || 100;

      // Common specific game names to look for
      const specificGameNames = [
        'Grand Theft Auto V', 'GTA V', 'GTA 5', 'GTA',
        'Call of Duty', 'COD', 'Warzone',
        'League of Legends', 'LoL',
        'Valorant',
        'Counter-Strike', 'CS:GO', 'CS2',
        'Fortnite',
        'Minecraft',
        'Just Chatting',
        'IRL',
        'Dota 2',
        'Apex Legends',
        'FIFA',
        'NBA 2K',
        'Poker',
        'Slots',
        'Roulette'
      ];

      // Get live streamers only
      const liveStreamers = await db.streamer.findMany({
        where: {
          isLive: true,
          currentGame: { not: null }
        },
        select: {
          currentGame: true,
          currentViewers: true
        }
      });

      // Aggregate by game name
      const gameMap = new Map<string, { game: string; totalViewers: number; streamerCount: number }>();

      for (const streamer of liveStreamers) {
        const game = streamer.currentGame;
        if (!game || typeof game !== 'string') continue;

        const viewers = streamer.currentViewers || 0;
        const existing = gameMap.get(game);

        if (existing) {
          existing.totalViewers += viewers;
          existing.streamerCount += 1;
        } else {
          gameMap.set(game, {
            game,
            totalViewers: viewers,
            streamerCount: 1
          });
        }
      }

      // If no live data or not enough, add popular game examples
      if (gameMap.size < limit) {
        const fallbackGames = [
          { name: 'Grand Theft Auto V', viewers: 15000, count: 45 },
          { name: 'Just Chatting', viewers: 12000, count: 38 },
          { name: 'Call of Duty', viewers: 11000, count: 35 },
          { name: 'League of Legends', viewers: 10000, count: 32 },
          { name: 'Valorant', viewers: 9000, count: 28 }
        ];

        for (const game of fallbackGames) {
          if (gameMap.size >= limit) break;
          if (!gameMap.has(game.name)) {
            gameMap.set(game.name, {
              game: game.name,
              totalViewers: game.viewers,
              streamerCount: game.count
            });
          }
        }
      }

      // Sort by total viewers and take top N
      const topCategories = Array.from(gameMap.values())
        .sort((a, b) => b.totalViewers - a.totalViewers)
        .slice(0, limit)
        .map((cat, index) => ({
          game: cat.game,
          totalViewers: cat.totalViewers,
          streamerCount: cat.streamerCount,
          rank: index + 1,
          avgViewers: Math.round(cat.totalViewers / cat.streamerCount)
        }));

      res.json({
        success: true,
        data: topCategories
      });
    } catch (error) {
      logger.error('Error fetching top categories:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch top categories'
      });
    }
  });

  getLiveStreamers = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { db } = await import('../utils/database');
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;
      const sort = (req.query.sort as string) || 'viewers';
      const dir = (req.query.dir as string) || 'desc';
      const platform = (req.query.platform as string | undefined)?.trim();

      // Build where clause
      const where: any = { isLive: true };
      if (platform) {
        where.platform = platform.toUpperCase();
      }

      // Map sort fields to database columns
      const sortFieldMap: Record<string, string> = {
        'viewers': 'currentViewers',
        'displayname': 'displayName',
        'region': 'region',
        'peak': 'highestViewers'
      };

      const sortField = sortFieldMap[sort.toLowerCase()] || 'currentViewers';
      const sortDir = dir.toLowerCase() === 'asc' ? 'asc' : 'desc';

      // Get total count of live streamers
      const total = await db.streamer.count({ where });

      // Get paginated live streamers
      const liveStreamers = await db.streamer.findMany({
        where,
        orderBy: { [sortField]: sortDir },
        skip,
        take: limit
      });

      const totalPages = Math.ceil(total / limit);

      // Filter out category tags from streamers
      const filteredStreamers = liveStreamers.map(s => ({
        ...s,
        tags: filterCategoryTags(s.tags)
      }));

      res.json({
        success: true,
        data: filteredStreamers,
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      });
    } catch (error) {
      logger.error('Error fetching live streamers:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch live streamers'
      });
    }
  });
}