/**
 * Scrape Twitch/Kick panels to extract social links
 *
 * This script:
 * 1. Fetches Twitch channel panels via GQL API (no OAuth needed)
 * 2. Extracts social media links from panel content
 * 3. Updates streamers with the extracted links
 * 4. Adds handles to the social sync queue
 *
 * Usage:
 *   npx ts-node scripts/scrape-panels-for-social.ts          # Scrape 100 streamers
 *   npx ts-node scripts/scrape-panels-for-social.ts 500      # Scrape 500 streamers
 */

import axios from 'axios';
import { db } from '../src/utils/database';
import { Platform } from '@prisma/client';

const TWITCH_GQL_URL = 'https://gql.twitch.tv/gql';
const TWITCH_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

interface SocialHandle {
  platform: Platform;
  username: string;
}

async function getTwitchPanels(login: string): Promise<any[]> {
  try {
    const response = await axios.post(
      TWITCH_GQL_URL,
      {
        operationName: 'ChannelPanels',
        variables: { id: login },
        extensions: {
          persistedQuery: {
            version: 1,
            sha256Hash: 'c388999b5f45f27b4e0e6e5f4b72e2ed6bd1d4c9c2c3c0a5d7e8f9d0a1b2c3d4'
          }
        }
      },
      {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Content-Type': 'application/json',
        }
      }
    );

    // Try alternate query if persisted query fails
    if (!response.data?.data?.user?.panels) {
      const altResponse = await axios.post(
        TWITCH_GQL_URL,
        [{
          operationName: 'ChannelPanels',
          variables: { login },
          extensions: {
            persistedQuery: {
              version: 1,
              sha256Hash: '236b0ec07f0a6ba3f8b529bd2e4e96bd0dcf0e7e78c6be4f3ead80e8e7c3b5a1'
            }
          }
        }],
        {
          headers: {
            'Client-ID': TWITCH_CLIENT_ID,
            'Content-Type': 'application/json',
          }
        }
      );
      return altResponse.data?.[0]?.data?.user?.panels || [];
    }

    return response.data?.data?.user?.panels || [];
  } catch (error: any) {
    // Try direct GQL query
    try {
      const gqlQuery = {
        query: `
          query ChannelPanels($login: String!) {
            user(login: $login) {
              panels {
                id
                type
                title
                description
                linkURL
                imageURL
              }
            }
          }
        `,
        variables: { login }
      };

      const response = await axios.post(TWITCH_GQL_URL, gqlQuery, {
        headers: {
          'Client-ID': TWITCH_CLIENT_ID,
          'Content-Type': 'application/json',
        }
      });

      return response.data?.data?.user?.panels || [];
    } catch {
      return [];
    }
  }
}

function extractSocialHandles(content: string): SocialHandle[] {
  const handles: SocialHandle[] = [];
  const lowerContent = content.toLowerCase();

  // TikTok
  const tiktokPatterns = [
    /tiktok\.com\/@?([a-zA-Z0-9_.]+)/gi,
    /tiktok[:\s]+@?([a-zA-Z0-9_.]+)/gi,
  ];
  for (const pattern of tiktokPatterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const username = match[1].replace('@', '').toLowerCase();
      if (username.length > 1 && !handles.find(h => h.platform === 'TIKTOK' && h.username === username)) {
        handles.push({ platform: 'TIKTOK', username });
      }
    }
  }

  // Instagram
  const instaPatterns = [
    /instagram\.com\/([a-zA-Z0-9_.]+)/gi,
    /(?:ig|insta|instagram)[:\s]+@?([a-zA-Z0-9_.]+)/gi,
  ];
  for (const pattern of instaPatterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const username = match[1].replace('@', '').toLowerCase();
      if (username.length > 1 && !handles.find(h => h.platform === 'INSTAGRAM' && h.username === username)) {
        handles.push({ platform: 'INSTAGRAM', username });
      }
    }
  }

  // X/Twitter
  const xPatterns = [
    /(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/gi,
    /(?:twitter|x)[:\s]+@?([a-zA-Z0-9_]+)/gi,
  ];
  for (const pattern of xPatterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const username = match[1].replace('@', '').toLowerCase();
      if (username.length > 1 && !handles.find(h => h.platform === 'X' && h.username === username)) {
        handles.push({ platform: 'X', username });
      }
    }
  }

  // Facebook
  const fbPatterns = [
    /facebook\.com\/([a-zA-Z0-9_.]+)/gi,
    /fb\.com\/([a-zA-Z0-9_.]+)/gi,
  ];
  for (const pattern of fbPatterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const username = match[1].toLowerCase();
      if (username.length > 1 && !['sharer', 'share', 'dialog'].includes(username) &&
          !handles.find(h => h.platform === 'FACEBOOK' && h.username === username)) {
        handles.push({ platform: 'FACEBOOK', username });
      }
    }
  }

  // LinkedIn
  const linkedinPattern = /linkedin\.com\/in\/([a-zA-Z0-9_-]+)/gi;
  const linkedinMatches = content.matchAll(linkedinPattern);
  for (const match of linkedinMatches) {
    const username = match[1].toLowerCase();
    if (!handles.find(h => h.platform === 'LINKEDIN' && h.username === username)) {
      handles.push({ platform: 'LINKEDIN', username });
    }
  }

  return handles;
}

async function main() {
  const limit = parseInt(process.argv[2] || '100');

  console.log('========================================');
  console.log('🔍 PANEL SCRAPING FOR SOCIAL LINKS');
  console.log('========================================\n');

  // Get Twitch streamers that haven't been scraped for panels (use raw query)
  const streamers = await db.$queryRaw`
    SELECT id, username, followers
    FROM discovery_creators
    WHERE platform = 'TWITCH'
    AND (panel_texts IS NULL OR array_length(panel_texts, 1) IS NULL OR array_length(panel_texts, 1) = 0)
    ORDER BY followers DESC
    LIMIT ${limit}
  ` as any[];

  console.log(`Found ${streamers.length} Twitch streamers to scrape\n`);

  let scraped = 0;
  let withPanels = 0;
  let withSocial = 0;
  const allHandles: SocialHandle[] = [];

  for (const streamer of streamers) {
    try {
      process.stdout.write(`[${scraped + 1}/${streamers.length}] ${streamer.username}... `);

      const panels = await getTwitchPanels(streamer.username);

      if (panels.length > 0) {
        withPanels++;

        // Extract text content from panels
        const panelTexts: string[] = [];
        const externalLinks: { url: string; title?: string }[] = [];

        for (const panel of panels) {
          if (panel.title) panelTexts.push(panel.title);
          if (panel.description) panelTexts.push(panel.description);
          if (panel.linkURL) {
            externalLinks.push({ url: panel.linkURL, title: panel.title });
          }
        }

        // Combine all text for social handle extraction
        const allText = [
          ...panelTexts,
          ...externalLinks.map(l => l.url)
        ].join(' ');

        const handles = extractSocialHandles(allText);

        if (handles.length > 0) {
          withSocial++;
          allHandles.push(...handles);
          console.log(`✅ ${panels.length} panels, ${handles.length} social: ${handles.map(h => `${h.platform}:${h.username}`).join(', ')}`);
        } else {
          console.log(`📋 ${panels.length} panels, no social links`);
        }

        // Update streamer with panel data
        await db.streamer.update({
          where: { id: streamer.id },
          data: {
            panelTexts,
            externalLinks,
          }
        });
      } else {
        console.log('❌ no panels');
      }

      scraped++;

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error: any) {
      console.log(`❌ error: ${error.message}`);
      scraped++;
    }
  }

  console.log('\n========================================');
  console.log('📊 RESULTS');
  console.log('========================================');
  console.log(`Scraped: ${scraped}`);
  console.log(`With panels: ${withPanels}`);
  console.log(`With social links: ${withSocial}`);
  console.log(`Total handles found: ${allHandles.length}`);

  // Group handles by platform
  const byPlatform: Record<string, string[]> = {};
  for (const handle of allHandles) {
    if (!byPlatform[handle.platform]) byPlatform[handle.platform] = [];
    if (!byPlatform[handle.platform].includes(handle.username)) {
      byPlatform[handle.platform].push(handle.username);
    }
  }

  console.log('\nHandles by platform:');
  for (const [platform, usernames] of Object.entries(byPlatform)) {
    console.log(`  ${platform}: ${usernames.length}`);
  }

  // Add to sync queue
  if (allHandles.length > 0) {
    console.log('\n📋 Adding to sync queue...');

    for (const handle of allHandles) {
      try {
        await db.socialSyncQueue.upsert({
          where: {
            platform_username: {
              platform: handle.platform,
              username: handle.username,
            }
          },
          create: {
            platform: handle.platform,
            username: handle.username,
            priority: 50,
            status: 'PENDING',
          },
          update: {}
        });
      } catch (e) {
        // Ignore duplicates
      }
    }

    console.log('✅ Added to sync queue');
  }

  await db.$disconnect();
  console.log('\n✅ Done!');
}

main().catch(async (error) => {
  console.error('❌ Script failed:', error);
  await db.$disconnect();
  process.exit(1);
});
