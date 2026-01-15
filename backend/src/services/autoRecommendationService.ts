import { db } from '../utils/database';
import { logger } from '../utils/logger';

/**
 * AutoRecommendationService
 *
 * Automatically recommends creators for campaigns using weighted scoring:
 * - Vertical Fit (30%): iGaming score, tags, gambling compatibility
 * - Historical Performance (25%): CPA, ROI, conversions
 * - Brand Safety (20%): Safety score, TOS compliance
 * - Budget Alignment (15%): Estimated rate vs campaign budget
 * - User History Bonus (10%): Similarity to user's top performers
 */

// Tier follower ranges
const TIER_RANGES = {
  nano: { min: 1000, max: 10000 },
  micro: { min: 10000, max: 50000 },
  mid: { min: 50000, max: 500000 },
  macro: { min: 500000, max: Infinity },
};

// Target diversity ratios
const DIVERSITY_TARGETS = {
  nano: 0.30,
  micro: 0.35,
  mid: 0.30,
  macro: 0.05,
};

interface CampaignCriteria {
  vertical?: string;
  region?: string;
  budget?: number;
  minIgamingScore?: number;
  requireGamblingCompatible?: boolean;
  platforms?: string[];
  totalCount?: number;
}

interface RecommendedCreator {
  id: string;
  displayName: string;
  platform: string;
  username: string;
  avatarUrl: string | null;
  followers: number;
  region: string | null;
  igamingScore: number;
  gamblingCompatibility: boolean;
  brandSafetyScore: number;
  score: number;
  tier: string;
  scoreBreakdown: {
    verticalFit: number;
    historicalPerformance: number;
    brandSafety: number;
    budgetAlignment: number;
    userHistoryBonus: number;
  };
}

// Weight constants
const WEIGHTS = {
  verticalFit: 0.30,
  historicalPerformance: 0.25,
  brandSafety: 0.20,
  budgetAlignment: 0.15,
  userHistoryBonus: 0.10,
};

class AutoRecommendationService {
  /**
   * Get tier based on follower count
   */
  private getTier(followers: number): string {
    if (followers < TIER_RANGES.nano.max) return 'nano';
    if (followers < TIER_RANGES.micro.max) return 'micro';
    if (followers < TIER_RANGES.mid.max) return 'mid';
    return 'macro';
  }

  /**
   * Calculate vertical fit score (0-100)
   */
  private calculateVerticalFitScore(creator: any, criteria: CampaignCriteria): number {
    let score = 0;

    // iGaming score contributes 60% of vertical fit
    if (criteria.vertical === 'igaming' || criteria.requireGamblingCompatible) {
      score += (creator.igamingScore / 100) * 60;

      // Gambling compatibility bonus
      if (creator.gamblingCompatibility) {
        score += 20;
      }
    } else {
      // Non-iGaming campaigns get base score from engagement
      score += Math.min(50, creator.engagementRate * 10);
    }

    // Category match bonus
    if (criteria.vertical && creator.inferredCategory?.toLowerCase() === criteria.vertical.toLowerCase()) {
      score += 20;
    }

    return Math.min(100, score);
  }

  /**
   * Calculate historical performance score (0-100)
   */
  private calculateHistoricalPerformanceScore(creator: any): number {
    let score = 0;

    // Historical conversions (40%)
    if (creator.historicalConversions > 0) {
      score += Math.min(40, (creator.historicalConversions / 100) * 40);
    }

    // Average ROI (30%)
    if (creator.avgRoi > 0) {
      score += Math.min(30, (creator.avgRoi / 500) * 30);
    }

    // Historical CPA - lower is better (30%)
    if (creator.historicalCpa > 0 && creator.historicalCpa < 200) {
      score += Math.max(0, 30 - (creator.historicalCpa / 200) * 30);
    } else if (creator.historicalCpa === 0) {
      // No history, give neutral score
      score += 15;
    }

    return Math.min(100, score);
  }

  /**
   * Calculate brand safety score (0-100)
   */
  private calculateBrandSafetyScore(creator: any): number {
    // Direct use of brand safety score
    let score = creator.brandSafetyScore || 50;

    // Fraud check bonus
    if (creator.fraudCheck === false) {
      score += 10;
    }

    return Math.min(100, score);
  }

  /**
   * Calculate budget alignment score (0-100)
   */
  private calculateBudgetAlignmentScore(creator: any, budget?: number): number {
    if (!budget) return 50; // Neutral if no budget specified

    // Estimate creator rate based on followers (rough heuristic)
    const estimatedRate = this.estimateCreatorRate(creator.followers);

    // Perfect alignment = rate is 20-50% of budget
    const ratio = estimatedRate / budget;

    if (ratio >= 0.2 && ratio <= 0.5) {
      return 100;
    } else if (ratio < 0.2) {
      // Under budget - good but may be too small
      return 70 + (ratio / 0.2) * 30;
    } else if (ratio <= 1.0) {
      // Within budget but expensive
      return 100 - ((ratio - 0.5) / 0.5) * 50;
    } else {
      // Over budget
      return Math.max(0, 50 - (ratio - 1) * 50);
    }
  }

  /**
   * Estimate creator rate based on followers
   */
  private estimateCreatorRate(followers: number): number {
    if (followers < 10000) return 100;
    if (followers < 50000) return 250;
    if (followers < 100000) return 500;
    if (followers < 500000) return 1500;
    return 5000;
  }

  /**
   * Calculate user history bonus (0-100)
   */
  private async calculateUserHistoryBonus(creator: any, userId?: string): Promise<number> {
    if (!userId) return 0;

    try {
      // Check if user has favorited similar creators
      const userFavorites = await db.discoveryFavorite.findMany({
        where: { userId },
        include: {
          streamer: {
            select: {
              platform: true,
              region: true,
              inferredCategory: true,
            },
          },
        },
      });

      if (userFavorites.length === 0) return 0;

      let matchScore = 0;

      // Platform match
      const platformMatch = userFavorites.filter(f => f.streamer.platform === creator.platform).length;
      matchScore += (platformMatch / userFavorites.length) * 40;

      // Region match
      const regionMatch = userFavorites.filter(f => f.streamer.region === creator.region).length;
      matchScore += (regionMatch / userFavorites.length) * 30;

      // Category match
      const categoryMatch = userFavorites.filter(f => f.streamer.inferredCategory === creator.inferredCategory).length;
      matchScore += (categoryMatch / userFavorites.length) * 30;

      return Math.min(100, matchScore);
    } catch (error) {
      logger.error('Error calculating user history bonus:', error);
      return 0;
    }
  }

  /**
   * Get auto-recommendations for a campaign or criteria
   */
  async getRecommendations(
    criteria: CampaignCriteria,
    userId?: string
  ): Promise<RecommendedCreator[]> {
    const totalCount = criteria.totalCount || 20;

    // Build base query
    const where: any = {};

    if (criteria.region) {
      where.region = criteria.region.toUpperCase();
    }

    if (criteria.platforms && criteria.platforms.length > 0) {
      where.platform = { in: criteria.platforms.map(p => p.toUpperCase()) };
    }

    if (criteria.requireGamblingCompatible) {
      where.gamblingCompatibility = true;
    }

    if (criteria.minIgamingScore) {
      where.igamingScore = { gte: criteria.minIgamingScore };
    }

    // Fetch candidates (more than needed for diversity selection)
    const candidates = await db.streamer.findMany({
      where,
      select: {
        id: true,
        displayName: true,
        platform: true,
        username: true,
        avatarUrl: true,
        followers: true,
        region: true,
        inferredCategory: true,
        igamingScore: true,
        gamblingCompatibility: true,
        brandSafetyScore: true,
        historicalConversions: true,
        historicalCpa: true,
        avgRoi: true,
        engagementRate: true,
        fraudCheck: true,
      },
      orderBy: [
        { igamingScore: 'desc' },
        { followers: 'desc' },
      ],
      take: totalCount * 5, // Fetch more for diversity selection
    });

    // Score all candidates
    const scoredCandidates = await Promise.all(
      candidates.map(async (creator) => {
        const verticalFit = this.calculateVerticalFitScore(creator, criteria);
        const historicalPerformance = this.calculateHistoricalPerformanceScore(creator);
        const brandSafety = this.calculateBrandSafetyScore(creator);
        const budgetAlignment = this.calculateBudgetAlignmentScore(creator, criteria.budget);
        const userHistoryBonus = await this.calculateUserHistoryBonus(creator, userId);

        const totalScore =
          verticalFit * WEIGHTS.verticalFit +
          historicalPerformance * WEIGHTS.historicalPerformance +
          brandSafety * WEIGHTS.brandSafety +
          budgetAlignment * WEIGHTS.budgetAlignment +
          userHistoryBonus * WEIGHTS.userHistoryBonus;

        return {
          id: creator.id,
          displayName: creator.displayName,
          platform: creator.platform,
          username: creator.username,
          avatarUrl: creator.avatarUrl,
          followers: creator.followers,
          region: creator.region,
          igamingScore: creator.igamingScore,
          gamblingCompatibility: creator.gamblingCompatibility,
          brandSafetyScore: creator.brandSafetyScore,
          score: Math.round(totalScore * 100) / 100,
          tier: this.getTier(creator.followers),
          scoreBreakdown: {
            verticalFit: Math.round(verticalFit),
            historicalPerformance: Math.round(historicalPerformance),
            brandSafety: Math.round(brandSafety),
            budgetAlignment: Math.round(budgetAlignment),
            userHistoryBonus: Math.round(userHistoryBonus),
          },
        };
      })
    );

    // Apply diversity selection
    return this.applyDiversitySelection(scoredCandidates, totalCount);
  }

  /**
   * Apply diversity selection to ensure tier mix
   */
  private applyDiversitySelection(
    candidates: RecommendedCreator[],
    totalCount: number
  ): RecommendedCreator[] {
    // Group by tier
    const byTier: Record<string, RecommendedCreator[]> = {
      nano: [],
      micro: [],
      mid: [],
      macro: [],
    };

    candidates.forEach((c) => {
      byTier[c.tier].push(c);
    });

    // Sort each tier by score
    Object.keys(byTier).forEach((tier) => {
      byTier[tier].sort((a, b) => b.score - a.score);
    });

    // Select according to diversity targets
    const result: RecommendedCreator[] = [];
    const targetCounts = {
      nano: Math.round(totalCount * DIVERSITY_TARGETS.nano),
      micro: Math.round(totalCount * DIVERSITY_TARGETS.micro),
      mid: Math.round(totalCount * DIVERSITY_TARGETS.mid),
      macro: Math.round(totalCount * DIVERSITY_TARGETS.macro),
    };

    // First pass: fill targets
    Object.entries(targetCounts).forEach(([tier, target]) => {
      const available = byTier[tier].slice(0, target);
      result.push(...available);
    });

    // Second pass: fill remaining slots with highest scoring from any tier
    const remaining = totalCount - result.length;
    if (remaining > 0) {
      const usedIds = new Set(result.map((r) => r.id));
      const unused = candidates
        .filter((c) => !usedIds.has(c.id))
        .sort((a, b) => b.score - a.score);
      result.push(...unused.slice(0, remaining));
    }

    // Sort final result by score
    return result.sort((a, b) => b.score - a.score);
  }

  /**
   * Get quick recommendations based on vertical (for AI assistant)
   */
  async getQuickRecommendations(
    vertical: string,
    region?: string,
    count: number = 10
  ): Promise<RecommendedCreator[]> {
    const criteria: CampaignCriteria = {
      vertical,
      region,
      totalCount: count,
      requireGamblingCompatible: vertical.toLowerCase() === 'igaming',
      minIgamingScore: vertical.toLowerCase() === 'igaming' ? 60 : undefined,
    };

    return this.getRecommendations(criteria);
  }

  /**
   * Get recommendations for a specific campaign by ID
   */
  async getRecommendationsForCampaign(
    campaignId: string,
    userId: string
  ): Promise<RecommendedCreator[]> {
    const campaign = await db.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const criteria: CampaignCriteria = {
      budget: campaign.budget || undefined,
      totalCount: 20,
      requireGamblingCompatible: true, // Default for iGaming campaigns
      minIgamingScore: 60,
    };

    return this.getRecommendations(criteria, userId);
  }
}

export const autoRecommendationService = new AutoRecommendationService();
