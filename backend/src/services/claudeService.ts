import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/database';
import { Platform, Region, FraudStatus } from '@prisma/client';

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
}

interface ConversationalResponse {
  type: 'question' | 'search' | 'explanation';
  message: string;
  suggestedQuestions?: string[];
  searchParams?: StreamerSearchParams;
  reasoning?: string;
  brandContext?: BrandContext;
}

interface BrandContext {
  brandName?: string;
  industry?: string;
  targetAudience?: string;
  brandPersonality?: string;
  campaignType?: string;
  recommendations?: string[];
}

interface ChatContext {
  userId: string;
  conversationId: string;
  previousMessages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  searchHistory: StreamerSearchParams[];
}

export class ClaudeService {
  private client: Anthropic;
  private readonly model = 'claude-sonnet-4-20250514';
  private readonly fastModel = 'claude-3-5-haiku-20241022';

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error('Anthropic API key is required. Set ANTHROPIC_API_KEY environment variable.');
    }

    this.client = new Anthropic({
      apiKey,
    });

    logger.info('Claude service initialized (Envisioner Discovery)');
  }

  /**
   * Process natural language query with conversational intelligence
   * Uses Claude's tool_use for structured output
   */
  async processConversationalQuery(
    userQuery: string,
    context?: ChatContext
  ): Promise<ConversationalResponse> {
    try {
      const conversationHistory = this.buildConversationHistory(context);

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 2000,
        system: this.buildConversationalSystemPrompt(),
        messages: [
          ...conversationHistory,
          { role: 'user', content: userQuery }
        ],
        tools: [
          {
            name: 'respond_conversationally',
            description: 'Decide how to respond: ask clarifying questions, explain reasoning, or proceed with search',
            input_schema: {
              type: 'object' as const,
              properties: {
                responseType: {
                  type: 'string',
                  enum: ['question', 'search', 'explanation'],
                  description: 'Type of response to provide'
                },
                message: {
                  type: 'string',
                  description: 'The conversational message to send to user'
                },
                suggestedQuestions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Follow-up questions to help clarify user needs'
                },
                brandContext: {
                  type: 'object',
                  properties: {
                    brandName: { type: 'string' },
                    industry: { type: 'string' },
                    targetAudience: { type: 'string' },
                    brandPersonality: { type: 'string' },
                    campaignType: { type: 'string' },
                    recommendations: {
                      type: 'array',
                      items: { type: 'string' }
                    }
                  },
                  description: 'Brand context and recommendations'
                },
                searchParams: {
                  type: 'object',
                  description: 'Search parameters if proceeding with search'
                },
                reasoning: {
                  type: 'string',
                  description: 'Explanation of why this response was chosen'
                }
              },
              required: ['responseType', 'message']
            }
          }
        ],
        tool_choice: { type: 'tool', name: 'respond_conversationally' }
      });

      // Extract tool use response
      const toolUse = response.content.find(block => block.type === 'tool_use');
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new Error('Invalid tool use response from Claude');
      }

      const responseData = toolUse.input as any;

      return {
        type: responseData.responseType,
        message: responseData.message,
        suggestedQuestions: responseData.suggestedQuestions,
        searchParams: responseData.searchParams,
        reasoning: responseData.reasoning,
        brandContext: responseData.brandContext
      };

    } catch (error) {
      logger.error('Error processing conversational query:', error);
      // Fallback response
      return {
        type: 'question',
        message: `I'd love to help you find the perfect influencers! To give you the best recommendations, let me know more about your campaign:

**Campaign Goals**

- What's your industry or brand focus?
- Are you looking for brand awareness, conversions, or engagement?

**Target Audience**

- Which region? (Worldwide - Americas, Europe, Asia, etc.)
- What follower range? (micro, macro, or mega influencers)

**Content Preferences**

- Any specific niche? (gaming, lifestyle, casino/betting, tech, etc.)
- Preferred platform? (Twitch, YouTube, Kick, Instagram, TikTok, X, LinkedIn)

The more details you share, the better I can match you with the right creators!`,
        suggestedQuestions: [
          'What industry or niche are you targeting?',
          'Which region interests you?',
          'What follower range are you looking for?',
          'Do you have platform preferences?'
        ]
      };
    }
  }

  /**
   * Process natural language query and convert to streamer search parameters
   * Uses faster Haiku model for simple extractions
   */
  async processStreamQuery(
    userQuery: string,
    context?: ChatContext
  ): Promise<{
    searchParams: StreamerSearchParams;
    response: string;
    reasoning: string;
  }> {
    try {
      const systemPrompt = this.buildSystemPrompt();
      const conversationHistory = this.buildConversationHistory(context);

      const response = await this.client.messages.create({
        model: this.fastModel, // Use Haiku for faster extraction
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          ...conversationHistory,
          { role: 'user', content: userQuery }
        ],
        tools: [
          {
            name: 'search_streamers',
            description: 'Search for streamers based on criteria extracted from user query',
            input_schema: {
              type: 'object' as const,
              properties: {
                platforms: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['TWITCH', 'YOUTUBE', 'KICK', 'FACEBOOK', 'TIKTOK', 'INSTAGRAM', 'X', 'LINKEDIN']
                  },
                  description: 'Streaming/content platforms to search'
                },
                regions: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: [
                      'MEXICO', 'COLOMBIA', 'ARGENTINA', 'CHILE', 'PERU',
                      'VENEZUELA', 'ECUADOR', 'BOLIVIA', 'PARAGUAY', 'URUGUAY',
                      'COSTA_RICA', 'PANAMA', 'GUATEMALA', 'EL_SALVADOR',
                      'HONDURAS', 'NICARAGUA', 'DOMINICAN_REPUBLIC', 'PUERTO_RICO', 'BRAZIL',
                      'USA', 'CANADA', 'UK', 'SPAIN', 'GERMANY', 'FRANCE', 'ITALY',
                      'JAPAN', 'KOREA', 'AUSTRALIA', 'INDIA', 'WORLDWIDE'
                    ]
                  },
                  description: 'Global regions to target'
                },
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Extract EXACT search terms from the query. Examples: "GTA streamers" -> ["GTA"], "casino streamers" -> ["casino"]'
                },
                minFollowers: {
                  type: 'number',
                  description: 'Minimum follower count'
                },
                maxFollowers: {
                  type: 'number',
                  description: 'Maximum follower count'
                },
                minViewers: {
                  type: 'number',
                  description: 'Minimum current viewers'
                },
                maxViewers: {
                  type: 'number',
                  description: 'Maximum current viewers'
                },
                isLive: {
                  type: 'boolean',
                  description: 'Filter for currently live streamers'
                },
                usesCamera: {
                  type: 'boolean',
                  description: 'Filter streamers who use camera'
                },
                isVtuber: {
                  type: 'boolean',
                  description: 'Filter VTuber streamers'
                },
                language: {
                  type: 'string',
                  description: 'Content language (es, en, pt, etc.)'
                },
                limit: {
                  type: 'number',
                  description: 'Extract EXACT number requested. "30 streamers" = 30. If no number, default to 10000.'
                },
                reasoning: {
                  type: 'string',
                  description: 'Explain why these parameters were chosen'
                }
              }
            }
          }
        ],
        tool_choice: { type: 'tool', name: 'search_streamers' }
      });

      const toolUse = response.content.find(block => block.type === 'tool_use');
      if (!toolUse || toolUse.type !== 'tool_use') {
        throw new Error('Invalid tool use response from Claude');
      }

      const searchData = toolUse.input as any;
      const reasoning = searchData.reasoning || 'Search parameters extracted from query';

      const searchParams: StreamerSearchParams = {
        platforms: searchData.platforms?.map((p: string) => p as Platform),
        regions: searchData.regions?.map((r: string) => r as Region),
        tags: searchData.tags,
        minFollowers: searchData.minFollowers,
        maxFollowers: searchData.maxFollowers,
        minViewers: searchData.minViewers,
        maxViewers: searchData.maxViewers,
        isLive: searchData.isLive,
        usesCamera: searchData.usesCamera,
        isVtuber: searchData.isVtuber,
        language: searchData.language,
        limit: searchData.limit || 10000
      };

      logger.info('Processed stream query successfully', {
        query: userQuery,
        searchParams,
        reasoning: reasoning.substring(0, 100)
      });

      return {
        searchParams,
        response: `I'll search for creators based on your request: "${userQuery}"`,
        reasoning
      };

    } catch (error) {
      logger.error('Error processing stream query:', error);
      throw new Error('Failed to process your query. Please try rephrasing it.');
    }
  }

  /**
   * Generate brand-aware summary with explanations
   * Uses Haiku for fast summaries
   */
  async generateBrandAwareSummary(
    searchParams: StreamerSearchParams,
    results: any[],
    originalQuery: string,
    brandContext?: BrandContext
  ): Promise<string> {
    try {
      const resultsData = results.slice(0, 3).map(streamer => ({
        username: streamer.username,
        displayName: streamer.displayName,
        platform: streamer.platform,
        followers: streamer.followers,
        isLive: streamer.isLive,
        currentViewers: streamer.currentViewers,
        region: streamer.region,
        tags: streamer.tags,
        igamingScore: streamer.igamingScore,
        brandSafetyScore: streamer.brandSafetyScore
      }));

      const hasIGamingData = resultsData.some(s => s.igamingScore && s.igamingScore > 0);

      const prompt = `Original query: "${originalQuery}"
Found ${results.length} creators.
${hasIGamingData ? 'Enhanced with iGaming scores.' : ''}

Top 3: ${JSON.stringify(resultsData, null, 2)}

Generate a SHORT (1-2 sentences MAX) summary. Under 25 words.
Examples:
- "Found 20 streamers for slots campaigns. Top picks based on gambling content."
- "Found 15 gaming creators. Check the table for detailed metrics."`;

      const response = await this.client.messages.create({
        model: this.fastModel,
        max_tokens: 100,
        system: 'You are Envisioner Discovery. Respond in 1-2 SHORT sentences MAX. Users want data in tables, not long text.',
        messages: [{ role: 'user', content: prompt }]
      });

      const textBlock = response.content.find(block => block.type === 'text');
      return textBlock && textBlock.type === 'text' ? textBlock.text :
        `Found ${results.length} creators matching your search.`;

    } catch (error) {
      logger.error('Error generating brand-aware summary:', error);
      return `Found ${results.length} creators matching your search.`;
    }
  }

  /**
   * Generate natural language summary of search results
   */
  async generateResultsSummary(
    searchParams: StreamerSearchParams,
    results: any[],
    originalQuery: string
  ): Promise<string> {
    try {
      const resultsData = results.slice(0, 5).map(streamer => ({
        username: streamer.username,
        displayName: streamer.displayName,
        platform: streamer.platform,
        followers: streamer.followers,
        isLive: streamer.isLive,
        currentViewers: streamer.currentViewers,
        region: streamer.region,
        tags: streamer.tags,
        igamingScore: streamer.igamingScore,
        brandSafetyScore: streamer.brandSafetyScore,
        conversionPotential: streamer.conversionPotential
      }));

      const prompt = `Original query: "${originalQuery}"
Found ${results.length} creators.

Top 5: ${JSON.stringify(resultsData, null, 2)}

Generate a natural, engaging summary (3-5 sentences):
1. How many results found
2. Highlight interesting findings (tags, metrics, scores)
3. Note any live creators
4. Regional distribution if relevant
5. Suggest follow-up actions`;

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 300,
        system: `You are Envisioner Discovery, an intelligent worldwide influencer discovery platform.

You have comprehensive data about creators including:
- Basic metrics: followers, viewers, platform, region
- Content tags: FPS, CASINO, GAMBLING, IRL, MUSIC, etc.
- iGaming intelligence: gambling compatibility, conversion potential
- Brand safety scores

Provide insightful, actionable summaries.`,
        messages: [{ role: 'user', content: prompt }]
      });

      const textBlock = response.content.find(block => block.type === 'text');
      return textBlock && textBlock.type === 'text' ? textBlock.text :
        `Found ${results.length} creators matching your criteria.`;

    } catch (error) {
      logger.error('Error generating results summary:', error);
      return `Found ${results.length} creators matching your search.`;
    }
  }

  /**
   * Generate pure conversational response without search
   */
  async generateConversationResponse(
    userQuery: string,
    context?: ChatContext
  ): Promise<string> {
    try {
      const systemPrompt = `You are Envisioner Discovery, a knowledgeable worldwide influencer discovery expert. You're friendly, enthusiastic, and speak naturally.

Your personality:
- Warm, conversational, genuinely excited about creators
- Deep knowledge of influencer marketing globally
- Use contractions and casual language
- Have opinions and personality

When chatting:
- Respond to greetings warmly
- Share insights about the creator economy
- Ask follow-up questions
- Be conversational - use "I think", "In my experience"

Examples:
- "Hello" -> "Hey there! I'm Envisioner Discovery - here to help you find the perfect creators worldwide. What brings you here today?"
- "How are you?" -> "Doing great, thanks! Just reviewed some amazing creator campaigns. How's your day?"`;

      const conversationHistory = this.buildConversationHistory(context);

      const response = await this.client.messages.create({
        model: this.fastModel,
        max_tokens: 300,
        system: systemPrompt,
        messages: [
          ...conversationHistory,
          { role: 'user', content: userQuery }
        ]
      });

      const textBlock = response.content.find(block => block.type === 'text');
      return textBlock && textBlock.type === 'text' ? textBlock.text :
        "Hey there! I'm Envisioner Discovery - here to help you find creators worldwide. What can I help you with?";

    } catch (error) {
      logger.error('Error generating conversational response:', error);
      return "Hey there! I'm Envisioner Discovery - here to help you find creators worldwide. What can I help you with?";
    }
  }

  /**
   * Analyze streamer content to extract insights
   */
  async analyzeStreamerContent(contentText: string): Promise<any> {
    try {
      const prompt = `Analyze this streamer content and extract insights:

Content:
${contentText.substring(0, 3000)}

Respond with JSON:
{
  "contentThemes": ["theme1", "theme2"],
  "personality": "description",
  "targetAudience": "description",
  "contentCategories": ["category1", "category2"],
  "brandSafety": {
    "score": 0-100,
    "concerns": [],
    "strengths": []
  },
  "gamblingRelevance": {
    "isRelevant": boolean,
    "confidence": 0-100,
    "reasoning": "explanation"
  },
  "keyInterests": ["interest1", "interest2"],
  "language": "primary language",
  "professionalismScore": 0-100
}`;

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1000,
        system: 'You are an expert at analyzing streamer content. Always respond with valid JSON only.',
        messages: [{ role: 'user', content: prompt }]
      });

      const textBlock = response.content.find(block => block.type === 'text');
      if (textBlock && textBlock.type === 'text') {
        return JSON.parse(textBlock.text);
      }
      return null;

    } catch (error) {
      logger.error('Error analyzing streamer content:', error);
      return null;
    }
  }

  /**
   * Check if user query requires streamer search
   */
  isSearchQuery(query: string): boolean {
    const lowerQuery = query.toLowerCase();

    const strongSearchTriggers = [
      'find streamers', 'search streamers', 'find influencers', 'search influencers',
      'find creators', 'search creators', 'show me streamers', 'show me influencers',
      'get me streamers', 'list streamers', 'discover streamers', 'discover creators',
      'i need streamers', 'i need influencers', 'i need creators',
      'looking for streamers', 'looking for influencers', 'looking for creators',
      'top streamers', 'best streamers', 'streamers in', 'influencers in',
      'live streamers', 'streaming now', 'currently live'
    ];

    if (strongSearchTriggers.some(trigger => lowerQuery.includes(trigger))) {
      return true;
    }

    const searchTriggers = ['find', 'search', 'show me', 'get me', 'list', 'discover', 'i need', 'looking for'];
    const streamingTerms = ['streamers', 'influencers', 'creators', 'vtubers', 'gamers', 'twitch', 'youtube', 'kick', 'tiktok', 'instagram'];

    const hasSearchTrigger = searchTriggers.some(trigger => lowerQuery.includes(trigger));
    const hasStreamingTerm = streamingTerms.some(term => lowerQuery.includes(term));

    if (hasSearchTrigger && hasStreamingTerm) {
      return true;
    }

    const contentSearchPatterns = [
      /\d+k?\s*(followers|subs|subscribers)/i,
      /\d+m?\s*(followers|subs|subscribers)/i,
      /(gaming|music|art|cooking|irl|variety)\s+(streamers|creators|influencers)/i,
      /\w+\s+(streamers|creators|influencers|players)/i
    ];

    return contentSearchPatterns.some(pattern => pattern.test(lowerQuery));
  }

  /**
   * Health check for Claude service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.messages.create({
        model: this.fastModel,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hello' }]
      });

      return response.content.length > 0;
    } catch (error) {
      logger.error('Claude health check failed:', error);
      return false;
    }
  }

  /**
   * Build the conversational system prompt
   */
  private buildConversationalSystemPrompt(): string {
    return `You are Envisioner Discovery, an intelligent WORLDWIDE influencer discovery platform.

YOUR PERSONALITY:
- Professional yet friendly and conversational
- Strategic thinker who asks smart questions
- Deep knowledge of influencer marketing globally
- Helpful and proactive in providing insights

GLOBAL COVERAGE:
- Support creators from ALL regions: Americas, Europe, Asia, Africa, Oceania
- Platforms: Twitch, YouTube, Kick, TikTok, Instagram, X (Twitter), LinkedIn
- Languages: All major languages supported

WHEN TO ASK QUESTIONS (responseType: "question"):
- Vague queries like "I need influencers" or "find me creators"
- Missing key info: niche, region, platform, follower range
- Greetings or general questions

WHEN TO SEARCH (responseType: "search"):
- User provides specific criteria (region AND/OR category/niche)
- User mentions tags like "casino", "slots", "GTA", "FIFA"
- User specifies a number ("30 streamers", "show me 50")

Search parameter rules:
- Extract EXACT search terms from query
- "GTA streamers" -> tags: ["GTA"]
- "casino streamers" -> tags: ["casino"]
- No region specified -> searches worldwide
- No number specified -> limit: 10000 (return ALL matches)

CRITICAL: If you return "explanation", you will return ZERO results. ALWAYS use "search" when user wants creators.`;
  }

  /**
   * Build the system prompt for search extraction
   */
  private buildSystemPrompt(): string {
    return `You are an AI assistant for Envisioner Discovery, a worldwide influencer discovery platform.

Your role:
- Extract PRECISE search parameters from user queries
- Support ALL regions globally (not just LATAM)
- Be accurate in interpreting user intent

Key contexts:
- Platforms: Twitch, YouTube, Kick, TikTok, Instagram, X, LinkedIn, Facebook
- Regions: Worldwide - Americas, Europe, Asia, Africa, Oceania
- Content types: Gaming, IRL, Music, Art, Tech, Fashion, Sports, Comedy, etc.
- Metrics: Followers, viewers, engagement, live status

Processing guidelines:
1. Be CONSERVATIVE - only extract what is clearly stated
2. If user says "gaming streamers in Brazil", extract: regions=[BRAZIL], tags=[GAMING]
3. If user says "100k followers", extract: minFollowers=100000
4. NEVER add parameters not mentioned in the query
5. Default to worldwide search if no region specified`;
  }

  /**
   * Build conversation history for context
   */
  private buildConversationHistory(context?: ChatContext): Array<{ role: 'user' | 'assistant'; content: string }> {
    if (!context?.previousMessages) {
      return [];
    }

    return context.previousMessages.slice(-10).map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(): Promise<{
    totalTokensUsed: number;
    totalRequests: number;
    averageResponseTime: number;
  }> {
    return {
      totalTokensUsed: 0,
      totalRequests: 0,
      averageResponseTime: 0
    };
  }
}

// Export singleton instance
export const claudeService = new ClaudeService();

// Also export as aiService for backward compatibility
export const aiService = claudeService;
