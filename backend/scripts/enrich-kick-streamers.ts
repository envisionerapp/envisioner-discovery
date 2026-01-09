import axios from 'axios';
import { db, logger } from '../src/utils/database';

/**
 * Enrich all Kick streamers with bio, tags, and social links
 * This scrapes real data from Kick API v2
 */

interface KickEnrichmentData {
  bio?: string;
  description?: string;
  tags: string[];
  categories: string[];
  socialLinks: {
    instagram?: string;
    twitter?: string;
    youtube?: string;
    discord?: string;
    tiktok?: string;
    facebook?: string;
  };
  panelTexts: string[]; // We'll use bio as panel text
}

async function enrichKickStreamer(username: string): Promise<KickEnrichmentData | null> {
  try {
    const response = await axios.get(`https://kick.com/api/v2/channels/${username}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      timeout: 10000
    });

    const data = response.data;
    const user = data.user || {};

    // Extract categories and tags
    const categories = (data.recent_categories || []).map((c: any) => c.name).filter((name: any): name is string => typeof name === 'string');
    const tags = (data.recent_categories || []).flatMap((c: any) => c.tags || []).filter((tag: any): tag is string => typeof tag === 'string');

    // Extract social links
    const socialLinks: any = {};

    // Instagram can be partial (username) or full URL
    if (user.instagram) {
      if (user.instagram.startsWith('http')) {
        socialLinks.instagram = user.instagram;
      } else {
        socialLinks.instagram = `https://instagram.com/${user.instagram}`;
      }
    }

    // Twitter can be partial (username) or full URL
    if (user.twitter) {
      if (user.twitter.startsWith('http')) {
        socialLinks.twitter = user.twitter;
      } else {
        socialLinks.twitter = `https://twitter.com/${user.twitter}`;
      }
    }

    // YouTube can be partial (c/username or @username) or full URL
    if (user.youtube) {
      if (user.youtube.startsWith('http')) {
        socialLinks.youtube = user.youtube;
      } else if (user.youtube.startsWith('c/') || user.youtube.startsWith('channel/')) {
        socialLinks.youtube = `https://youtube.com/${user.youtube}`;
      } else {
        socialLinks.youtube = `https://youtube.com/@${user.youtube}`;
      }
    }

    // Discord can be partial (invite/code) or full URL
    if (user.discord) {
      if (user.discord.startsWith('http')) {
        socialLinks.discord = user.discord;
      } else if (user.discord.startsWith('invite/')) {
        socialLinks.discord = `https://discord.gg/${user.discord.replace('invite/', '')}`;
      } else {
        socialLinks.discord = `https://discord.gg/${user.discord}`;
      }
    }

    // TikTok can be partial (@username) or full URL
    if (user.tiktok) {
      if (user.tiktok.startsWith('http')) {
        socialLinks.tiktok = user.tiktok;
      } else if (user.tiktok.startsWith('@')) {
        socialLinks.tiktok = `https://tiktok.com/${user.tiktok}`;
      } else {
        socialLinks.tiktok = `https://tiktok.com/@${user.tiktok}`;
      }
    }

    // Facebook can be partial or full URL
    if (user.facebook) {
      if (user.facebook.startsWith('http')) {
        socialLinks.facebook = user.facebook;
      } else {
        socialLinks.facebook = `https://facebook.com/${user.facebook}`;
      }
    }

    const enrichmentData: KickEnrichmentData = {
      bio: user.bio || undefined,
      description: user.bio || undefined,
      tags: [...new Set(tags)] as string[], // Remove duplicates
      categories: categories as string[],
      socialLinks,
      panelTexts: user.bio ? [user.bio] : [] // Use bio as panel text
    };

    return enrichmentData;

  } catch (error: any) {
    if (error.response?.status === 404) {
      logger.warn(`Kick user not found: ${username}`);
    } else {
      logger.error(`Failed to enrich Kick user ${username}:`, error.message);
    }
    return null;
  }
}

async function updateStreamerWithEnrichment(streamerId: string, username: string, enrichmentData: KickEnrichmentData): Promise<void> {
  try {
    // Get existing data
    const existing = await db.streamer.findUnique({
      where: { id: streamerId },
      select: { tags: true, externalLinks: true }
    });

    // Merge tags (existing + new categories and tags)
    const existingTags = existing?.tags || [];
    const newTags = [...enrichmentData.categories, ...enrichmentData.tags];
    const mergedTags = [...new Set([...existingTags, ...newTags])];

    // Merge external links
    const existingLinks = (existing?.externalLinks as any) || {};
    const mergedLinks = {
      ...existingLinks,
      ...enrichmentData.socialLinks
    };

    // Update database
    await db.streamer.update({
      where: { id: streamerId },
      data: {
        profileDescription: enrichmentData.description,
        aboutSection: enrichmentData.description,
        panelTexts: enrichmentData.panelTexts,
        tags: mergedTags,
        externalLinks: mergedLinks,
        lastEnrichmentUpdate: new Date()
      }
    });

    logger.info(`✅ Enriched Kick streamer: ${username}`, {
      bio: enrichmentData.bio ? 'Yes' : 'No',
      tags: mergedTags.length,
      categories: enrichmentData.categories.length,
      socialLinks: Object.keys(enrichmentData.socialLinks).length
    });

  } catch (error) {
    logger.error(`Failed to update database for ${username}:`, error);
    throw error;
  }
}

async function enrichAllKickStreamers() {
  console.log('\n🚀 Starting Kick streamers enrichment...\n');

  try {
    // Get all Kick streamers
    const streamers = await db.streamer.findMany({
      where: {
        platform: 'KICK'
      },
      select: {
        id: true,
        username: true
      }
    });

    console.log(`Found ${streamers.length} Kick streamers to enrich\n`);

    let enriched = 0;
    let failed = 0;
    let skipped = 0;

    const BATCH_SIZE = 10; // Process in batches
    const DELAY_BETWEEN_REQUESTS = 500; // ms

    for (let i = 0; i < streamers.length; i += BATCH_SIZE) {
      const batch = streamers.slice(i, i + BATCH_SIZE);

      console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(streamers.length / BATCH_SIZE)}...`);

      for (const streamer of batch) {
        try {
          // Enrich from Kick API
          const enrichmentData = await enrichKickStreamer(streamer.username);

          if (enrichmentData) {
            await updateStreamerWithEnrichment(streamer.id, streamer.username, enrichmentData);
            enriched++;
          } else {
            skipped++;
          }

          // Delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));

        } catch (error: any) {
          failed++;
          logger.error(`Failed to process ${streamer.username}:`, error.message);
        }
      }

      // Progress update
      const processed = Math.min(i + BATCH_SIZE, streamers.length);
      console.log(`Progress: ${processed}/${streamers.length} (${enriched} enriched, ${skipped} skipped, ${failed} failed)`);
    }

    console.log('\n✅ Kick enrichment completed!');
    console.log(`\n📊 Final Stats:`);
    console.log(`  - Total streamers: ${streamers.length}`);
    console.log(`  - Successfully enriched: ${enriched}`);
    console.log(`  - Skipped: ${skipped}`);
    console.log(`  - Failed: ${failed}`);
    console.log(`  - Success rate: ${((enriched / streamers.length) * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('\n❌ Enrichment failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  enrichAllKickStreamers()
    .then(() => {
      console.log('\n🎉 Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Fatal error:', error);
      process.exit(1);
    });
}

export { enrichAllKickStreamers, enrichKickStreamer };
