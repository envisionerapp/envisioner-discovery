import axios from 'axios';
import { db } from '../src/utils/database';

const TWITCH_GQL_URL = 'https://gql.twitch.tv/gql';
const TWITCH_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

interface SocialLink {
  platform: string;
  handle?: string;
  url?: string;
}

// Extract handle from URL
function extractHandle(url: string, platform: string): string | undefined {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/+|\/+$/g, '').replace('@', '');
    // Remove common prefixes
    const cleaned = path.replace(/^(c|channel|user)\//, '');
    return cleaned || undefined;
  } catch {
    return undefined;
  }
}

async function fetchTwitchSocialMedias(login: string): Promise<{ socialLinks: SocialLink[]; description: string } | null> {
  try {
    const query = {
      query: `
        query GetChannelSocial($login: String!) {
          user(login: $login) {
            description
            channel {
              socialMedias {
                name
                url
              }
            }
          }
        }
      `,
      variables: { login }
    };

    const response = await axios.post(TWITCH_GQL_URL, query, {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Content-Type': 'application/json',
      },
      timeout: 10000
    });

    const user = response.data?.data?.user;
    if (!user) return null;

    const socialLinks: SocialLink[] = [];
    const socialMedias = user.channel?.socialMedias || [];

    for (const sm of socialMedias) {
      const name = sm.name?.toLowerCase();
      const url = sm.url;

      if (!name || !url) continue;

      // Map Twitch names to our standard platform names
      let platform = name;
      if (name === 'x') platform = 'twitter';

      socialLinks.push({
        platform,
        url,
        handle: extractHandle(url, platform)
      });
    }

    return {
      socialLinks,
      description: user.description || ''
    };
  } catch (error) {
    return null;
  }
}

async function backfillTwitchSocial(limit: number = 100) {
  console.log('========================================');
  console.log('🔍 TWITCH SOCIAL LINK EXTRACTION');
  console.log('========================================\n');

  // Get Twitch streamers
  const streamers = await db.streamer.findMany({
    where: {
      platform: 'TWITCH',
    },
    orderBy: { followers: 'desc' },
    take: limit,
    select: {
      id: true,
      username: true,
      socialLinks: true,
      profileDescription: true
    }
  });

  console.log(`Found ${streamers.length} Twitch streamers to process\n`);

  let updated = 0;
  let withSocial = 0;
  const handlesToQueue: { platform: string; handle: string }[] = [];

  for (let i = 0; i < streamers.length; i++) {
    const streamer = streamers[i];
    const prefix = `[${i + 1}/${streamers.length}] ${streamer.username}`;

    const data = await fetchTwitchSocialMedias(streamer.username);
    if (!data) {
      console.log(`${prefix}... ❌ not found`);
      continue;
    }

    // Merge with existing social links
    const existingLinks = (streamer.socialLinks as unknown as SocialLink[]) || [];
    const existingPlatforms = new Set(existingLinks.map(l => l.platform?.toLowerCase()));

    const newLinks = data.socialLinks.filter(l => !existingPlatforms.has(l.platform.toLowerCase()));
    const allLinks = [...existingLinks, ...newLinks] as any;

    // Queue handles for ScrapeCreators sync
    for (const link of newLinks) {
      if (link.handle && ['instagram', 'tiktok', 'twitter', 'facebook'].includes(link.platform)) {
        // Map 'twitter' to 'X' for the Platform enum
        const queuePlatform = link.platform === 'twitter' ? 'X' : link.platform.toUpperCase();
        handlesToQueue.push({ platform: queuePlatform, handle: link.handle });
      }
    }

    if (newLinks.length > 0 || data.description !== streamer.profileDescription) {
      await db.streamer.update({
        where: { id: streamer.id },
        data: {
          socialLinks: allLinks,
          profileDescription: data.description || streamer.profileDescription,
        }
      });
      updated++;
      console.log(`${prefix}... ✅ ${newLinks.length} new links (${newLinks.map(l => l.platform).join(', ') || 'desc only'})`);
    } else if (allLinks.length > 0) {
      console.log(`${prefix}... ⏭️ already has ${allLinks.length} links`);
    } else {
      console.log(`${prefix}... ➖ no social links`);
    }

    if (data.socialLinks.length > 0) withSocial++;

    // Rate limit
    if ((i + 1) % 20 === 0) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  // Queue handles for ScrapeCreators
  if (handlesToQueue.length > 0) {
    console.log(`\n📥 Queuing ${handlesToQueue.length} handles for sync...`);

    for (const item of handlesToQueue) {
      try {
        await db.socialSyncQueue.upsert({
          where: {
            platform_username: {
              platform: item.platform as any,
              username: item.handle
            }
          },
          create: {
            platform: item.platform as any,
            username: item.handle,
            status: 'PENDING'
          },
          update: {}
        });
      } catch (e) {
        // Ignore duplicates
      }
    }
  }

  console.log('\n========================================');
  console.log('📊 RESULTS');
  console.log('========================================');
  console.log(`Processed: ${streamers.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`With social links: ${withSocial}`);
  console.log(`New handles queued: ${handlesToQueue.length}`);

  await db.$disconnect();
}

const limit = parseInt(process.argv[2]) || 100;
backfillTwitchSocial(limit).catch(console.error);
