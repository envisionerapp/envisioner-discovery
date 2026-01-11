import { db, logger } from '../utils/database';
import { Streamer, Platform, Region } from '@prisma/client';

// Enhanced interfaces for iGaming intelligence
export interface IGamingIntelligence {
  // Audience Psychology Profile
  audiencePsychology: {
    riskTolerance: 'conservative' | 'moderate' | 'aggressive' | 'high-roller';
    gamblingPropensity: number; // 0-100
    impulseDecisionMaking: number; // 0-100
    socialInfluence: number; // 0-100
    financialCapacity: 'budget' | 'standard' | 'premium' | 'whale';
  };

  // Advanced Engagement Patterns
  engagementIntelligence: {
    peakActivityHours: number[];
    sponsorshipReceptivity: number; // 0-100
    chatSentimentDuringAds: 'positive' | 'neutral' | 'negative';
    repeatViewerRate: number; // 0-100
    crossPlatformFollowing: boolean;
  };

  // Content Performance Analytics
  contentPerformance: {
    mostEngagingContentTypes: string[];
    viewerRetentionDuringSponsors: number; // 0-100
    clickThroughRatesByContentType: Record<string, number>;
    conversionRatesByTimeOfDay: Record<string, number>;
    audienceGrowthDuringCampaigns: number;
  };

  // Advanced Risk Assessment
  advancedRiskProfile: {
    regulatoryCompliance: 'excellent' | 'good' | 'moderate' | 'poor';
    brandSafetyScore: number; // 0-100
    controversyImpactScore: number; // 0-100
    communityModeration: 'strict' | 'moderate' | 'lenient';
    responsibleGamblingAdvocate: boolean;
  };

  // Competitive Intelligence
  competitorAnalysis: {
    currentSponsorships: string[];
    sponsorshipDurations: Record<string, number>;
    exclusivityDeals: boolean;
    pricingTier: 'budget' | 'mid-tier' | 'premium' | 'exclusive';
  };
}

export interface CampaignPrediction {
  predictedCTR: number;
  predictedConversions: number;
  predictedROI: number;
  receptivityScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: string[];
  recommendedApproach: string;
  confidenceScore: number;
}

export interface StreamerAnalysisResult {
  streamer: Streamer;
  intelligence: IGamingIntelligence;
  overallScore: number;
  confidenceLevel: number;
  tier: 'S-Tier' | 'A-Tier' | 'B-Tier' | 'C-Tier';
  campaignPredictions: CampaignPrediction;
  detailedInsights: {
    whySelected: string;
    audienceInsights: string;
    recentPerformance: string;
    brandAlignment: string;
    riskFactors: string[];
    suggestedApproach: string;
  };
}

export class IGamingIntelligenceService {

  /**
   * Advanced iGaming scoring algorithm
   */
  async calculateIGamingScore(
    streamer: Streamer,
    campaignType: 'betting' | 'gaming' | 'esports',
    intelligence?: IGamingIntelligence
  ): Promise<{ score: number; breakdown: any; confidence: number }> {

    // If no intelligence provided, generate basic intelligence
    if (!intelligence) {
      intelligence = await this.generateBasicIntelligence(streamer);
    }

    let score = 0;
    let confidence = 0;
    const breakdown: any = {};

    switch (campaignType) {
      case 'betting':
        return this.calculateBettingScore(streamer, intelligence);
      case 'gaming':
        return this.calculateGamingScore(streamer, intelligence);
      case 'esports':
        return this.calculateEsportsScore(streamer, intelligence);
      default:
        return { score: 0, breakdown: {}, confidence: 0 };
    }
  }

  /**
   * Advanced betting campaign scoring
   */
  private calculateBettingScore(streamer: Streamer, intel: IGamingIntelligence) {
    let score = 0;
    let confidence = 0;
    const breakdown: any = {};

    // Audience Psychology (35% weight)
    let psychScore = 0;

    // Risk tolerance scoring
    switch (intel.audiencePsychology.riskTolerance) {
      case 'high-roller': psychScore += 30; break;
      case 'aggressive': psychScore += 25; break;
      case 'moderate': psychScore += 15; break;
      case 'conservative': psychScore += 5; break;
    }

    // Gambling propensity
    psychScore += intel.audiencePsychology.gamblingPropensity * 0.05;

    // Financial capacity
    switch (intel.audiencePsychology.financialCapacity) {
      case 'whale': psychScore += 10; break;
      case 'premium': psychScore += 8; break;
      case 'standard': psychScore += 5; break;
      case 'budget': psychScore += 2; break;
    }

    breakdown.psychologyScore = psychScore;
    score += psychScore * 0.35;
    confidence += intel.audiencePsychology.gamblingPropensity > 70 ? 20 : 10;

    // Conversion Potential (25% weight)
    const conversionScore = (
      intel.engagementIntelligence.sponsorshipReceptivity * 0.15 +
      intel.contentPerformance.viewerRetentionDuringSponsors * 0.10
    );
    breakdown.conversionScore = conversionScore;
    score += conversionScore * 0.25;

    // Brand Safety (20% weight)
    const safetyScore = intel.advancedRiskProfile.brandSafetyScore * 0.20;
    breakdown.safetyScore = safetyScore;
    score += safetyScore;

    if (intel.advancedRiskProfile.brandSafetyScore < 70) {
      confidence -= 15;
    }

    // Platform and Region Bonus
    let platformBonus = 0;
    if (streamer.platform === 'TWITCH' && streamer.tags.includes('GAMING')) {
      platformBonus += 5;
    }

    // LATAM regional focus
    const latinRegions = ['MEXICO', 'COLOMBIA', 'ARGENTINA', 'CHILE', 'BRAZIL'];
    if (latinRegions.includes(streamer.region)) {
      platformBonus += 3;
    }

    breakdown.platformBonus = platformBonus;
    score += platformBonus;

    return {
      score: Math.min(Math.max(score, 0), 100),
      confidence: Math.min(Math.max(confidence, 0), 100),
      breakdown
    };
  }

  /**
   * Generate basic intelligence from existing streamer data
   */
  private async generateBasicIntelligence(streamer: Streamer): Promise<IGamingIntelligence> {
    // Simulate intelligence based on existing data
    const hasGamingContent = streamer.tags.includes('GAMING');
    const isPopular = streamer.followers > 100000;
    const isActive = streamer.isLive || (streamer.lastStreamed &&
      new Date(streamer.lastStreamed) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

    return {
      audiencePsychology: {
        riskTolerance: hasGamingContent ? 'aggressive' : 'moderate',
        gamblingPropensity: hasGamingContent ? 75 : 45,
        impulseDecisionMaking: isPopular ? 70 : 50,
        socialInfluence: isActive ? 80 : 60,
        financialCapacity: isPopular ? 'premium' : 'standard'
      },
      engagementIntelligence: {
        peakActivityHours: [19, 20, 21, 22], // 7-10 PM
        sponsorshipReceptivity: isActive ? 75 : 50,
        chatSentimentDuringAds: isPopular ? 'positive' : 'neutral',
        repeatViewerRate: isActive ? 80 : 60,
        crossPlatformFollowing: true
      },
      contentPerformance: {
        mostEngagingContentTypes: hasGamingContent ? ['gaming', 'tournaments'] : ['variety'],
        viewerRetentionDuringSponsors: isPopular ? 85 : 65,
        clickThroughRatesByContentType: { 'gaming': 5.5, 'variety': 3.2 },
        conversionRatesByTimeOfDay: { '20': 12.5, '21': 15.2 },
        audienceGrowthDuringCampaigns: isActive ? 15 : 8
      },
      advancedRiskProfile: {
        regulatoryCompliance: 'good',
        brandSafetyScore: streamer.fraudCheck === 'CLEAN' ? 90 : 60,
        controversyImpactScore: 10,
        communityModeration: 'moderate',
        responsibleGamblingAdvocate: false
      },
      competitorAnalysis: {
        currentSponsorships: [],
        sponsorshipDurations: {},
        exclusivityDeals: false,
        pricingTier: isPopular ? 'premium' : 'mid-tier'
      }
    };
  }

  /**
   * Calculate gaming campaign score
   */
  private calculateGamingScore(streamer: Streamer, intel: IGamingIntelligence) {
    let score = 0;
    const breakdown: any = {};

    // Gaming engagement (60%)
    let gamingScore = 0;
    if (streamer.tags.includes('GAMING')) gamingScore += 30;
    if (streamer.tags.includes('FPS') || streamer.tags.includes('STRATEGY')) gamingScore += 15;
    if (intel.audiencePsychology.financialCapacity === 'premium') gamingScore += 15;

    breakdown.gamingScore = gamingScore;
    score += gamingScore * 0.60;

    // Audience quality (40%)
    const audienceScore = intel.audiencePsychology.socialInfluence * 0.4;
    breakdown.audienceScore = audienceScore;
    score += audienceScore * 0.40;

    return {
      score: Math.min(Math.max(score, 0), 100),
      confidence: 85,
      breakdown
    };
  }

  /**
   * Calculate esports campaign score
   */
  private calculateEsportsScore(streamer: Streamer, intel: IGamingIntelligence) {
    let score = 0;
    const breakdown: any = {};

    // Competitive gaming focus (70%)
    let competitiveScore = 0;
    if (streamer.tags.includes('FPS') || streamer.tags.includes('STRATEGY')) competitiveScore += 40;
    if (streamer.currentGame && ['CS:GO', 'Valorant', 'League of Legends'].includes(streamer.currentGame)) {
      competitiveScore += 20;
    }
    if (intel.contentPerformance.mostEngagingContentTypes.includes('tournaments')) {
      competitiveScore += 10;
    }

    breakdown.competitiveScore = competitiveScore;
    score += competitiveScore * 0.70;

    // Audience engagement (30%)
    const engagementScore = intel.engagementIntelligence.repeatViewerRate * 0.3;
    breakdown.engagementScore = engagementScore;
    score += engagementScore * 0.30;

    return {
      score: Math.min(Math.max(score, 0), 100),
      confidence: 80,
      breakdown
    };
  }

  /**
   * Generate detailed insights for a streamer
   */
  async generateDetailedInsights(
    streamer: Streamer,
    intelligence: IGamingIntelligence,
    campaignType: string,
    scoreBreakdown: any
  ): Promise<StreamerAnalysisResult['detailedInsights']> {

    const insights = {
      whySelected: this.generateWhySelectedText(streamer, intelligence, campaignType, scoreBreakdown),
      audienceInsights: this.generateAudienceInsights(intelligence),
      recentPerformance: this.generatePerformanceInsights(streamer, intelligence),
      brandAlignment: this.generateBrandAlignment(intelligence, campaignType),
      riskFactors: this.identifyRiskFactors(intelligence),
      suggestedApproach: this.generateSuggestedApproach(streamer, intelligence, campaignType)
    };

    return insights;
  }

  private generateWhySelectedText(
    streamer: Streamer,
    intel: IGamingIntelligence,
    campaignType: string,
    breakdown: any
  ): string {
    const reasons = [];

    if (breakdown.psychologyScore > 20) {
      reasons.push(`high-risk tolerance audience (${intel.audiencePsychology.riskTolerance})`);
    }

    if (intel.audiencePsychology.gamblingPropensity > 70) {
      reasons.push(`${intel.audiencePsychology.gamblingPropensity}% gambling propensity`);
    }

    if (intel.advancedRiskProfile.brandSafetyScore > 85) {
      reasons.push('excellent brand safety record');
    }

    if (streamer.followers > 100000) {
      reasons.push(`strong reach with ${streamer.followers.toLocaleString()} followers`);
    }

    return `Selected for ${campaignType} campaign due to: ${reasons.join(', ')}. This creates optimal conditions for high conversion rates.`;
  }

  private generateAudienceInsights(intel: IGamingIntelligence): string {
    return `Audience profile shows ${intel.audiencePsychology.riskTolerance} risk tolerance with ${intel.audiencePsychology.gamblingPropensity}% gambling propensity. ${intel.audiencePsychology.financialCapacity} financial capacity tier with ${intel.engagementIntelligence.repeatViewerRate}% repeat viewer rate indicates strong community loyalty.`;
  }

  private generatePerformanceInsights(streamer: Streamer, intel: IGamingIntelligence): string {
    const retention = intel.contentPerformance.viewerRetentionDuringSponsors;
    const receptivity = intel.engagementIntelligence.sponsorshipReceptivity;

    return `Recent performance shows ${retention}% viewer retention during sponsored content with ${receptivity}% sponsorship receptivity score. Peak engagement occurs during ${intel.engagementIntelligence.peakActivityHours.join('-')} hours.`;
  }

  private generateBrandAlignment(intel: IGamingIntelligence, campaignType: string): string {
    const safety = intel.advancedRiskProfile.brandSafetyScore;
    const compliance = intel.advancedRiskProfile.regulatoryCompliance;

    return `Brand alignment: ${safety}/100 safety score with ${compliance} regulatory compliance. Community moderation is ${intel.advancedRiskProfile.communityModeration}, suitable for ${campaignType} campaigns.`;
  }

  private identifyRiskFactors(intel: IGamingIntelligence): string[] {
    const risks = [];

    if (intel.advancedRiskProfile.brandSafetyScore < 70) {
      risks.push('Brand safety score below threshold');
    }

    if (intel.advancedRiskProfile.controversyImpactScore > 20) {
      risks.push('Potential controversy impact detected');
    }

    if (intel.competitorAnalysis.exclusivityDeals) {
      risks.push('Existing exclusivity deals may conflict');
    }

    if (risks.length === 0) {
      risks.push('No significant risk factors identified');
    }

    return risks;
  }

  private generateSuggestedApproach(
    streamer: Streamer,
    intel: IGamingIntelligence,
    campaignType: string
  ): string {
    const approach = [];

    if (intel.audiencePsychology.riskTolerance === 'aggressive') {
      approach.push('Use competitive/high-stakes messaging');
    }

    if (intel.engagementIntelligence.chatSentimentDuringAds === 'positive') {
      approach.push('Interactive chat integration recommended');
    }

    if (streamer.tags.includes('GAMING')) {
      approach.push('Gaming-focused content integration');
    }

    return approach.join('. ') + '. Optimal timing: ' + intel.engagementIntelligence.peakActivityHours.join('-') + ' hours.';
  }

  /**
   * Analyze multiple streamers and return ranked results
   */
  async analyzeStreamersForCampaign(
    streamers: Streamer[],
    campaignType: 'betting' | 'gaming' | 'esports'
  ): Promise<StreamerAnalysisResult[]> {
    const results: StreamerAnalysisResult[] = [];

    for (const streamer of streamers.slice(0, 10)) { // Limit to top 10 for performance
      try {
        const intelligence = await this.generateBasicIntelligence(streamer);
        const scoreResult = await this.calculateIGamingScore(streamer, campaignType, intelligence);

        // Determine tier based on score
        let tier: StreamerAnalysisResult['tier'];
        if (scoreResult.score >= 90) tier = 'S-Tier';
        else if (scoreResult.score >= 75) tier = 'A-Tier';
        else if (scoreResult.score >= 60) tier = 'B-Tier';
        else tier = 'C-Tier';

        const detailedInsights = await this.generateDetailedInsights(
          streamer,
          intelligence,
          campaignType,
          scoreResult.breakdown
        );

        const campaignPredictions: CampaignPrediction = {
          predictedCTR: this.predictCTR(intelligence, scoreResult.score),
          predictedConversions: this.predictConversions(intelligence, scoreResult.score),
          predictedROI: this.predictROI(intelligence, scoreResult.score),
          receptivityScore: intelligence.engagementIntelligence.sponsorshipReceptivity,
          riskLevel: scoreResult.score > 80 ? 'low' : scoreResult.score > 60 ? 'medium' : 'high',
          riskFactors: detailedInsights.riskFactors,
          recommendedApproach: detailedInsights.suggestedApproach,
          confidenceScore: scoreResult.confidence
        };

        results.push({
          streamer,
          intelligence,
          overallScore: scoreResult.score,
          confidenceLevel: scoreResult.confidence,
          tier,
          campaignPredictions,
          detailedInsights
        });

        // Update streamer record with intelligence
        await this.updateStreamerIntelligence(streamer.id, intelligence, scoreResult.score);

      } catch (error) {
        logger.error(`Error analyzing streamer ${streamer.id}:`, error);
      }
    }

    // Sort by score descending
    return results.sort((a, b) => b.overallScore - a.overallScore);
  }

  private predictCTR(intelligence: IGamingIntelligence, score: number): number {
    const baseCTR = 3.2; // Industry average
    const multiplier = score / 100;
    const receptivityBonus = intelligence.engagementIntelligence.sponsorshipReceptivity / 100;
    return Math.round((baseCTR * multiplier * (1 + receptivityBonus)) * 10) / 10;
  }

  private predictConversions(intelligence: IGamingIntelligence, score: number): number {
    const baseConversion = 2.1; // Industry average
    const multiplier = score / 100;
    const psychologyBonus = intelligence.audiencePsychology.gamblingPropensity / 100;
    return Math.round((baseConversion * multiplier * (1 + psychologyBonus)) * 10) / 10;
  }

  private predictROI(intelligence: IGamingIntelligence, score: number): number {
    const baseROI = 120; // Industry average 120%
    const multiplier = score / 100;
    const qualityBonus = intelligence.engagementIntelligence.repeatViewerRate / 100;
    return Math.round(baseROI * multiplier * (1 + qualityBonus));
  }

  /**
   * Update streamer with intelligence data
   */
  private async updateStreamerIntelligence(
    streamerId: string,
    intelligence: IGamingIntelligence,
    score: number
  ): Promise<void> {
    try {
      await db.streamer.update({
        where: { id: streamerId },
        data: {
          igamingIntelligence: intelligence as any,
          igamingScore: Math.round(score),
          audiencePsychology: intelligence.audiencePsychology as any,
          brandSafetyScore: intelligence.advancedRiskProfile.brandSafetyScore,
          gamblingCompatibility: intelligence.audiencePsychology.gamblingPropensity > 60,
          conversionPotential: {
            ctr: this.predictCTR(intelligence, score),
            conversionRate: this.predictConversions(intelligence, score),
            roi: this.predictROI(intelligence, score)
          } as any
        }
      });
    } catch (error) {
      logger.error(`Error updating streamer intelligence for ${streamerId}:`, error);
    }
  }
}

export const igamingIntelligenceService = new IGamingIntelligenceService();