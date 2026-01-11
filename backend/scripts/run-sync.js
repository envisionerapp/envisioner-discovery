const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

// Simplified sync that directly updates from influencers table
async function runSync() {
  console.log('Starting sync from influencers table...');

  // Get all influencers with channel URLs
  const influencers = await db.$queryRawUnsafe(`
    SELECT id, influencer, clean_name, channel_url, thumbnail, subscribers,
           views::text as views, videos, stats_updated_at::text as stats_updated_at
    FROM influencers
    WHERE channel_url IS NOT NULL AND channel_url != ''
  `);

  console.log(`Found ${influencers.length} influencers`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const inf of influencers) {
    try {
      // Parse URL to get platform and username
      const parsed = parseChannelUrl(inf.channel_url);
      if (!parsed) {
        skipped++;
        continue;
      }

      const { platform, username } = parsed;

      // Find existing streamer
      const existing = await db.streamer.findFirst({
        where: {
          platform,
          username: { equals: username, mode: 'insensitive' },
        },
      });

      if (existing) {
        // Build updates
        const updates = {};

        if (inf.thumbnail && inf.thumbnail !== existing.avatarUrl) {
          updates.avatarUrl = inf.thumbnail;
        }
        if (inf.subscribers && inf.subscribers !== existing.followers) {
          updates.followers = inf.subscribers;
        }
        if (inf.views) {
          const viewsBigInt = BigInt(inf.views);
          if (viewsBigInt !== existing.totalViews) {
            updates.totalViews = viewsBigInt;
          }
        }
        if (inf.stats_updated_at) {
          const statsDate = new Date(inf.stats_updated_at);
          if (!existing.lastSeenLive || statsDate > existing.lastSeenLive) {
            updates.lastSeenLive = statsDate;
            updates.lastScrapedAt = statsDate;
          }
        }

        if (Object.keys(updates).length > 0) {
          await db.streamer.update({
            where: { id: existing.id },
            data: updates,
          });
          console.log(`Updated ${username} on ${platform}`);
          updated++;
        } else {
          skipped++;
        }
      } else {
        skipped++;
      }
    } catch (e) {
      console.error(`Error: ${e.message}`);
      errors++;
    }
  }

  console.log(`\nSync complete: ${updated} updated, ${skipped} skipped, ${errors} errors`);
}

function parseChannelUrl(url) {
  if (!url) return null;

  const patterns = [
    { pattern: /twitch\.tv\/([a-zA-Z0-9_]+)/i, platform: 'TWITCH' },
    { pattern: /youtube\.com\/@?([a-zA-Z0-9_-]+)/i, platform: 'YOUTUBE' },
    { pattern: /youtu\.be\/([a-zA-Z0-9_-]+)/i, platform: 'YOUTUBE' },
    { pattern: /kick\.com\/([a-zA-Z0-9_]+)/i, platform: 'KICK' },
    { pattern: /tiktok\.com\/@?([a-zA-Z0-9_.]+)/i, platform: 'TIKTOK' },
    { pattern: /instagram\.com\/([a-zA-Z0-9_.]+)/i, platform: 'INSTAGRAM' },
    { pattern: /(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/i, platform: 'X' },
    { pattern: /facebook\.com\/([a-zA-Z0-9_.]+)/i, platform: 'FACEBOOK' },
    { pattern: /fb\.com\/([a-zA-Z0-9_.]+)/i, platform: 'FACEBOOK' },
    { pattern: /linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i, platform: 'LINKEDIN' },
    { pattern: /vm\.tiktok\.com\/([a-zA-Z0-9_]+)/i, platform: 'TIKTOK' },
  ];

  for (const { pattern, platform } of patterns) {
    const match = url.match(pattern);
    if (match) {
      return { platform, username: match[1] };
    }
  }
  return null;
}

runSync()
  .catch(console.error)
  .finally(() => db.$disconnect());
