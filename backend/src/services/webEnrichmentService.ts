import axios from 'axios';
import * as cheerio from 'cheerio';
import { db, logger } from '../utils/database';
import { Platform } from '@prisma/client';

interface EnrichedData {
  profileDescription?: string;
  bannerText?: string;
  panelTexts: string[];
  aboutSection?: string;
  externalLinks?: any;
  streamTitles: string[];
  chatKeywords: string[];
  communityPosts?: any;
  contentAnalysis?: any;
  webPresence?: any;
  // Contact information
  email?: string;
  businessEmail?: string;
  emailSource?: string;
}

interface EmailExtraction {
  email: string;
  source: string;
  isBusiness: boolean;
}

export class WebEnrichmentService {
  private readonly twitchHeaders = {
    'Client-ID': process.env.TWITCH_CLIENT_ID || '',
    'Authorization': `Bearer ${process.env.TWITCH_ACCESS_TOKEN || ''}`
  };

  /**
   * Enrich a single streamer with comprehensive web data
   */
  async enrichStreamer(streamerId: string): Promise<void> {
    try {
      const streamer = await db.streamer.findUnique({
        where: { id: streamerId }
      });

      if (!streamer) {
        throw new Error(`Streamer not found: ${streamerId}`);
      }

      logger.info(`Enriching streamer: ${streamer.username} (${streamer.platform})`);

      const enrichedData: EnrichedData = {
        panelTexts: [],
        streamTitles: [],
        chatKeywords: [],
        externalLinks: {},
        communityPosts: {},
        webPresence: {}
      };

      // Scrape platform-specific data
      switch (streamer.platform) {
        case 'TWITCH':
          await this.enrichTwitchStreamer(streamer, enrichedData);
          break;
        case 'YOUTUBE':
          await this.enrichYouTubeStreamer(streamer, enrichedData);
          break;
        case 'KICK':
          await this.enrichKickStreamer(streamer, enrichedData);
          break;
      }

      // Scrape general web presence
      await this.enrichWebPresence(streamer, enrichedData);

      // Extract email from collected text content
      const textsToSearch = [
        { text: enrichedData.profileDescription || '', source: 'profile_description' },
        { text: enrichedData.aboutSection || '', source: 'about_section' },
        ...enrichedData.panelTexts.map(t => ({ text: t, source: 'panel_text' }))
      ];

      const emailResult = this.extractEmailFromTexts(textsToSearch);
      if (emailResult) {
        enrichedData.email = emailResult.email;
        enrichedData.emailSource = emailResult.source;
        if (emailResult.isBusiness) {
          enrichedData.businessEmail = emailResult.email;
        }
        logger.info(`Found email for ${streamer.username}: ${emailResult.email} (source: ${emailResult.source}, business: ${emailResult.isBusiness})`);
      }

      // Use AI to analyze all collected data
      await this.analyzeContentWithAI(enrichedData);

      // Save enriched data to database
      await db.streamer.update({
        where: { id: streamerId },
        data: {
          profileDescription: enrichedData.profileDescription,
          bannerText: enrichedData.bannerText,
          panelTexts: enrichedData.panelTexts,
          aboutSection: enrichedData.aboutSection,
          externalLinks: enrichedData.externalLinks,
          streamTitles: enrichedData.streamTitles,
          chatKeywords: enrichedData.chatKeywords,
          communityPosts: enrichedData.communityPosts,
          contentAnalysis: enrichedData.contentAnalysis,
          webPresence: enrichedData.webPresence,
          email: enrichedData.email,
          businessEmail: enrichedData.businessEmail,
          emailSource: enrichedData.emailSource,
          lastEnrichmentUpdate: new Date()
        }
      });

      logger.info(`Successfully enriched streamer: ${streamer.username}`);
    } catch (error) {
      logger.error(`Error enriching streamer ${streamerId}:`, error);
      throw error;
    }
  }

  /**
   * Enrich Twitch streamer with platform-specific data
   */
  private async enrichTwitchStreamer(streamer: any, enrichedData: EnrichedData): Promise<void> {
    try {
      // Get Twitch user data
      const userResponse = await axios.get(
        `https://api.twitch.tv/helix/users?login=${streamer.username}`,
        { headers: this.twitchHeaders }
      );

      if (userResponse.data.data?.length > 0) {
        const userData = userResponse.data.data[0];
        enrichedData.profileDescription = userData.description;
        enrichedData.aboutSection = userData.description;
      }

      // Scrape Twitch channel page for panels and additional info
      const channelUrl = `https://www.twitch.tv/${streamer.username}`;
      try {
        const pageResponse = await axios.get(channelUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 10000
        });

        const $ = cheerio.load(pageResponse.data);

        // Extract panel texts (these are usually in the about section)
        enrichedData.panelTexts = this.extractTextContent($, [
          '[data-test-selector="about-panel"]',
          '.about-section',
          '[class*="Panel"]'
        ]);

        // Extract external links
        enrichedData.externalLinks = this.extractLinks($, channelUrl);
      } catch (scrapeError) {
        logger.warn(`Could not scrape Twitch page for ${streamer.username}:`, scrapeError);
      }

      // Get recent stream titles from VODs
      try {
        const videosResponse = await axios.get(
          `https://api.twitch.tv/helix/videos?user_id=${streamer.username}&first=20`,
          { headers: this.twitchHeaders }
        );

        if (videosResponse.data.data) {
          enrichedData.streamTitles = videosResponse.data.data
            .map((video: any) => video.title)
            .filter(Boolean)
            .slice(0, 20);
        }
      } catch (error) {
        logger.warn(`Could not fetch Twitch VODs for ${streamer.username}`);
      }

    } catch (error) {
      logger.error(`Error enriching Twitch data for ${streamer.username}:`, error);
    }
  }

  /**
   * Enrich YouTube streamer with platform-specific data
   */
  private async enrichYouTubeStreamer(streamer: any, enrichedData: EnrichedData): Promise<void> {
    try {
      // Scrape YouTube channel page
      const channelUrl = streamer.profileUrl || `https://www.youtube.com/@${streamer.username}`;

      try {
        const pageResponse = await axios.get(channelUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 10000
        });

        const $ = cheerio.load(pageResponse.data);

        // Extract channel description
        const description = $('meta[name="description"]').attr('content');
        if (description) {
          enrichedData.profileDescription = description;
          enrichedData.aboutSection = description;
        }

        // Extract links from about section
        enrichedData.externalLinks = this.extractLinks($, channelUrl);

        // Extract recent video titles
        enrichedData.streamTitles = this.extractTextContent($, [
          '#video-title',
          '.ytd-video-renderer #video-title',
          'a#video-title'
        ]).slice(0, 20);

      } catch (scrapeError) {
        logger.warn(`Could not scrape YouTube page for ${streamer.username}:`, scrapeError);
      }

    } catch (error) {
      logger.error(`Error enriching YouTube data for ${streamer.username}:`, error);
    }
  }

  /**
   * Enrich Kick streamer with platform-specific data
   */
  private async enrichKickStreamer(streamer: any, enrichedData: EnrichedData): Promise<void> {
    try {
      const channelUrl = `https://kick.com/${streamer.username}`;

      try {
        const pageResponse = await axios.get(channelUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 10000
        });

        const $ = cheerio.load(pageResponse.data);

        // Extract description
        const description = $('meta[name="description"]').attr('content');
        if (description) {
          enrichedData.profileDescription = description;
        }

        // Extract external links
        enrichedData.externalLinks = this.extractLinks($, channelUrl);

      } catch (scrapeError) {
        logger.warn(`Could not scrape Kick page for ${streamer.username}:`, scrapeError);
      }

    } catch (error) {
      logger.error(`Error enriching Kick data for ${streamer.username}:`, error);
    }
  }

  /**
   * Enrich web presence from various sources
   */
  private async enrichWebPresence(streamer: any, enrichedData: EnrichedData): Promise<void> {
    const searchQueries = [
      `${streamer.displayName} streamer`,
      `${streamer.username} ${streamer.platform.toLowerCase()}`,
      `${streamer.displayName} gaming`
    ];

    const webData: any = {
      socialMedia: [],
      mentions: [],
      websites: []
    };

    // Search for social media profiles
    const socialPlatforms = ['twitter.com', 'instagram.com', 'tiktok.com', 'facebook.com'];

    for (const query of searchQueries.slice(0, 1)) { // Limit to avoid rate limits
      try {
        // Use a simple Google search scraping approach
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        const response = await axios.get(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 5000
        });

        const $ = cheerio.load(response.data);

        // Extract links from search results
        $('a[href]').each((_, element) => {
          const href = $(element).attr('href');
          if (href) {
            socialPlatforms.forEach(platform => {
              if (href.includes(platform) && !webData.socialMedia.includes(href)) {
                webData.socialMedia.push(href);
              }
            });
          }
        });

      } catch (error) {
        logger.warn(`Could not search web for ${streamer.username}:`, error);
      }

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    enrichedData.webPresence = webData;
  }

  /**
   * Analyze collected content using AI
   */
  private async analyzeContentWithAI(enrichedData: EnrichedData): Promise<void> {
    try {
      // Compile all text data
      const allText = [
        enrichedData.profileDescription,
        enrichedData.aboutSection,
        ...enrichedData.panelTexts,
        ...enrichedData.streamTitles
      ].filter(Boolean).join(' ');

      if (!allText || allText.length < 50) {
        return; // Not enough data to analyze
      }

      // Use Claude to analyze the content
      const { claudeService } = await import('./claudeService');

      const analysis = await claudeService.analyzeStreamerContent(allText);

      enrichedData.contentAnalysis = analysis;

    } catch (error) {
      logger.error('Error analyzing content with AI:', error);
    }
  }

  /**
   * Helper: Extract text content from multiple selectors
   */
  private extractTextContent($: cheerio.CheerioAPI, selectors: string[]): string[] {
    const texts: string[] = [];

    selectors.forEach(selector => {
      $(selector).each((_, element) => {
        const text = $(element).text().trim();
        if (text && text.length > 10 && !texts.includes(text)) {
          texts.push(text);
        }
      });
    });

    return texts;
  }

  /**
   * Helper: Extract links from page
   */
  private extractLinks($: cheerio.CheerioAPI, baseUrl: string): any {
    const links: any = {
      social: [],
      external: []
    };

    const socialDomains = [
      'twitter.com', 'x.com', 'instagram.com', 'tiktok.com',
      'facebook.com', 'discord.gg', 'youtube.com', 'twitch.tv'
    ];

    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (!href) return;

      try {
        const url = new URL(href, baseUrl);
        const isSocial = socialDomains.some(domain => url.hostname.includes(domain));

        if (isSocial && !links.social.includes(url.href)) {
          links.social.push(url.href);
        } else if (url.hostname !== new URL(baseUrl).hostname && !links.external.includes(url.href)) {
          links.external.push(url.href);
        }
      } catch (error) {
        // Invalid URL, skip
      }
    });

    return links;
  }

  /**
   * Helper: Extract email addresses from text content
   * Only extracts publicly posted emails for business contact
   */
  private extractEmailFromTexts(texts: Array<{ text: string; source: string }>): EmailExtraction | null {
    // RFC 5322 simplified email regex
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

    // Keywords that suggest business/contact context
    const businessKeywords = [
      'business', 'inquir', 'contact', 'collab', 'sponsor',
      'partner', 'booking', 'management', 'agent', 'manager',
      'promo', 'deal', 'work with', 'email me', 'reach out'
    ];

    // Domains to filter out (false positives)
    const invalidDomains = [
      'example.com', 'email.com', 'test.com', 'domain.com',
      'yourmail.com', 'mail.com', 'sample.com'
    ];

    // File extensions that look like emails but aren't
    const invalidExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];

    for (const { text, source } of texts) {
      if (!text) continue;

      const matches = text.match(emailRegex);
      if (!matches) continue;

      // Filter out invalid emails
      const validEmails = matches.filter(email => {
        const lowerEmail = email.toLowerCase();

        // Check for invalid domains
        if (invalidDomains.some(domain => lowerEmail.includes(domain))) {
          return false;
        }

        // Check for file extensions masquerading as emails
        if (invalidExtensions.some(ext => lowerEmail.endsWith(ext))) {
          return false;
        }

        // Must have at least 3 chars before @
        const localPart = lowerEmail.split('@')[0];
        if (localPart.length < 3) {
          return false;
        }

        return true;
      });

      if (validEmails.length > 0) {
        // Check if the surrounding text suggests business context
        const lowerText = text.toLowerCase();
        const isBusiness = businessKeywords.some(kw => lowerText.includes(kw));

        return {
          email: validEmails[0],
          source,
          isBusiness
        };
      }
    }

    return null;
  }

  /**
   * Batch enrich multiple streamers
   */
  async enrichStreamers(streamerIds: string[], concurrency: number = 5): Promise<void> {
    logger.info(`Starting batch enrichment for ${streamerIds.length} streamers`);

    const chunks = [];
    for (let i = 0; i < streamerIds.length; i += concurrency) {
      chunks.push(streamerIds.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      await Promise.allSettled(
        chunk.map(id => this.enrichStreamer(id))
      );

      // Add delay between batches to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    logger.info(`Completed batch enrichment`);
  }

  /**
   * Enrich all streamers in database
   */
  async enrichAllStreamers(batchSize: number = 100): Promise<void> {
    logger.info('Starting full database enrichment');

    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const streamers = await db.streamer.findMany({
        where: {
          lastEnrichmentUpdate: null // Only enrich streamers that haven't been enriched yet
        },
        select: { id: true },
        take: batchSize,
        skip
      });

      if (streamers.length === 0) {
        hasMore = false;
        break;
      }

      const ids = streamers.map(s => s.id);
      await this.enrichStreamers(ids, 5);

      skip += batchSize;
      logger.info(`Enriched ${skip} streamers so far...`);
    }

    logger.info('Completed full database enrichment');
  }

  /**
   * Backfill: Extract emails from existing enriched streamers
   * Runs on streamers that have text data but no email extracted yet
   */
  async extractEmailsFromExisting(batchSize: number = 100): Promise<{ processed: number; found: number }> {
    logger.info('Starting email extraction from existing data');

    let processed = 0;
    let found = 0;
    let skip = 0;
    let hasMore = true;

    while (hasMore) {
      const streamers = await db.streamer.findMany({
        where: {
          email: null,
          OR: [
            { profileDescription: { not: null } },
            { panelTexts: { isEmpty: false } },
            { aboutSection: { not: null } }
          ]
        },
        select: {
          id: true,
          username: true,
          profileDescription: true,
          panelTexts: true,
          aboutSection: true
        },
        take: batchSize,
        skip
      });

      if (streamers.length === 0) {
        hasMore = false;
        break;
      }

      for (const streamer of streamers) {
        const textsToSearch = [
          { text: streamer.profileDescription || '', source: 'profile_description' },
          { text: streamer.aboutSection || '', source: 'about_section' },
          ...streamer.panelTexts.map(t => ({ text: t, source: 'panel_text' }))
        ];

        const emailResult = this.extractEmailFromTexts(textsToSearch);

        if (emailResult) {
          await db.streamer.update({
            where: { id: streamer.id },
            data: {
              email: emailResult.email,
              businessEmail: emailResult.isBusiness ? emailResult.email : null,
              emailSource: emailResult.source
            }
          });

          found++;
          logger.info(`Extracted email for ${streamer.username}: ${emailResult.email}`);
        }

        processed++;
      }

      skip += batchSize;
      logger.info(`Processed ${processed} streamers, found ${found} emails so far...`);
    }

    logger.info(`Email extraction complete. Processed: ${processed}, Found: ${found}`);
    return { processed, found };
  }
}

export default new WebEnrichmentService();
