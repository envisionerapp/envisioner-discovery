// Run the influencer sync with promotional views
const { PrismaClient, Platform } = require('@prisma/client');
const db = new PrismaClient();

async function runSync() {
  console.log('🔄 Starting sync from influencers table to discovery_creators...');

  let synced = 0;
  let skipped = 0;
  let errors = 0;

  // Fetch all influencers
  const influencers = await db.$queryRawUnsafe(`
    SELECT id, influencer, clean_name, channel_url, thumbnail, subscribers,
           views::text as views, videos, stats_updated_at::text as stats_updated_at
    FROM influencers
    WHERE channel_url IS NOT NULL AND channel_url != ''
  `);

  console.log(`📊 Found ${influencers.length} influencers with channel URLs`);

  // Fetch promotional stats (only where promotion = 'Yes')
  const promoStats = await db.$queryRawUnsafe(`
    SELECT
      influencer_id,
      COALESCE(SUM(views), 0)::text as promo_views,
      COALESCE(SUM(likes), 0)::text as promo_likes,
      COALESCE(SUM(comments), 0)::text as promo_comments
    FROM deliverables
    WHERE promotion = 'Yes' AND influencer_id IS NOT NULL
    GROUP BY influencer_id
  `);

  const promoStatsMap = new Map();
  for (const stat of promoStats) {
    promoStatsMap.set(stat.influencer_id, stat);
  }

  console.log(`📊 Found promotional stats for ${promoStats.length} influencers`);

  for (const inf of influencers) {
    try {
      const parsed = parseChannelUrl(inf.channel_url || '');
      if (!parsed) {
        skipped++;
        continue;
      }

      const { platform, username } = parsed;

      // Get promotional stats
      const promoData = promoStatsMap.get(inf.id);
      const promoViews = promoData ? BigInt(promoData.promo_views) : BigInt(0);
      const promoLikes = promoData ? BigInt(promoData.promo_likes) : BigInt(0);
      const promoComments = promoData ? BigInt(promoData.promo_comments) : BigInt(0);

      // Find existing
      const existing = await db.streamer.findFirst({
        where: {
          platform,
          username: { equals: username, mode: 'insensitive' },
        },
      });

      if (existing) {
        const updates = {};
        if (inf.thumbnail && inf.thumbnail !== existing.avatarUrl) {
          updates.avatarUrl = inf.thumbnail;
        }
        if (inf.subscribers && inf.subscribers !== existing.followers) {
          updates.followers = inf.subscribers;
        }
        // Use promotional views, not total channel views
        if (promoViews !== existing.totalViews) {
          updates.totalViews = promoViews;
        }
        if (promoLikes !== existing.totalLikes) {
          updates.totalLikes = promoLikes;
        }
        if (promoComments !== existing.totalComments) {
          updates.totalComments = promoComments;
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
          console.log(`📝 Updated ${username} on ${platform}: promoViews=${promoViews}, promoLikes=${promoLikes}`);
          synced++;
        } else {
          skipped++;
        }
      }
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      errors++;
    }
  }

  console.log(`\n🔄 Sync complete! Synced: ${synced}, Skipped: ${skipped}, Errors: ${errors}`);
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
