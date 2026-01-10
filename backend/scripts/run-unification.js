require('dotenv').config();
const { influencerUnificationService } = require('../dist/services/influencerUnificationService');

async function run() {
  console.log('🔗 Starting full influencer unification...\n');
  console.log('This will merge 12k+ streamers into unified profiles.\n');

  const startTime = Date.now();

  const result = await influencerUnificationService.unifyAllStreamers();

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n========================================');
  console.log('📊 UNIFICATION COMPLETE');
  console.log('========================================');
  console.log('Created:', result.created);
  console.log('Updated:', result.updated);
  console.log('Errors:', result.errors);
  console.log('Duration:', duration, 'seconds');

  // Get final stats
  const stats = await influencerUnificationService.getStats();

  console.log('\n========================================');
  console.log('📈 INFLUENCER STATS');
  console.log('========================================');
  console.log('Total influencers:', stats.total);
  console.log('With TikTok:', stats.withTiktok);
  console.log('With Instagram:', stats.withInstagram);
  console.log('\nBy platform count:');
  Object.entries(stats.byPlatformCount).forEach(([count, num]) => {
    if (num > 0) console.log(`  ${count} platform(s): ${num}`);
  });

  console.log('\nTop 10 by total reach:');
  stats.topByReach.forEach((i, idx) => {
    const reach = Number(i.totalReach).toLocaleString();
    const platforms = [
      i.twitchUsername ? 'Twitch' : null,
      i.youtubeUsername ? 'YouTube' : null,
      i.tiktokUsername ? 'TikTok' : null,
      i.instagramUsername ? 'Instagram' : null,
    ].filter(Boolean).join(', ');
    console.log(`  ${idx + 1}. ${i.displayName} - ${reach} reach (${platforms})`);
  });

  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
