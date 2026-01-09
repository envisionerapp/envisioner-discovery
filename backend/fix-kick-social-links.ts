import { db, logger } from './src/utils/database';

/**
 * Fix social links for already enriched Kick streamers
 * Converts partial URLs to full URLs
 */

async function fixKickSocialLinks() {
  console.log('\n🔧 Fixing Kick social links...\n');

  try {
    // Get all Kick streamers
    const allStreamers = await db.streamer.findMany({
      where: {
        platform: 'KICK'
      },
      select: {
        id: true,
        username: true,
        externalLinks: true
      }
    });

    // Filter for those with externalLinks
    const streamers = allStreamers.filter(s => s.externalLinks && typeof s.externalLinks === 'object');

    console.log(`Found ${streamers.length} Kick streamers with social links\n`);

    let fixed = 0;
    let skipped = 0;

    for (const streamer of streamers) {
      const links = streamer.externalLinks as any;
      if (!links || typeof links !== 'object') {
        skipped++;
        continue;
      }

      let needsUpdate = false;
      const fixedLinks: any = { ...links };

      // Fix Instagram
      if (links.instagram && typeof links.instagram === 'string') {
        // Check for double-prefix bug: https://instagram.com/https://
        if (links.instagram.includes('instagram.com/http')) {
          const match = links.instagram.match(/https:\/\/[^\/]+\/(.+)/);
          if (match) {
            fixedLinks.instagram = match[1];
            needsUpdate = true;
          }
        } else if (!links.instagram.startsWith('http')) {
          fixedLinks.instagram = `https://instagram.com/${links.instagram}`;
          needsUpdate = true;
        }
      }

      // Fix Twitter
      if (links.twitter && typeof links.twitter === 'string') {
        // Check for double-prefix bug
        if (links.twitter.includes('twitter.com/http')) {
          const match = links.twitter.match(/https:\/\/[^\/]+\/(.+)/);
          if (match) {
            fixedLinks.twitter = match[1];
            needsUpdate = true;
          }
        } else if (!links.twitter.startsWith('http')) {
          fixedLinks.twitter = `https://twitter.com/${links.twitter}`;
          needsUpdate = true;
        }
      }

      // Fix TikTok
      if (links.tiktok && typeof links.tiktok === 'string') {
        // Check for double-prefix bug: https://tiktok.com/@https://
        if (links.tiktok.includes('tiktok.com/@http') || links.tiktok.includes('tiktok.com/http')) {
          const match = links.tiktok.match(/https:\/\/[^\/]+\/@?(https:.+)/);
          if (match) {
            fixedLinks.tiktok = match[1];
            needsUpdate = true;
          }
        } else if (!links.tiktok.startsWith('http')) {
          if (links.tiktok.startsWith('@')) {
            fixedLinks.tiktok = `https://tiktok.com/${links.tiktok}`;
          } else {
            fixedLinks.tiktok = `https://tiktok.com/@${links.tiktok}`;
          }
          needsUpdate = true;
        }
      }

      // Fix YouTube
      if (links.youtube && typeof links.youtube === 'string') {
        if (!links.youtube.startsWith('http')) {
          if (links.youtube.startsWith('c/') || links.youtube.startsWith('channel/')) {
            fixedLinks.youtube = `https://youtube.com/${links.youtube}`;
          } else {
            fixedLinks.youtube = `https://youtube.com/@${links.youtube}`;
          }
          needsUpdate = true;
        }
      }

      // Fix Discord
      if (links.discord && typeof links.discord === 'string') {
        if (!links.discord.startsWith('http')) {
          if (links.discord.startsWith('invite/')) {
            fixedLinks.discord = `https://discord.gg/${links.discord.replace('invite/', '')}`;
          } else {
            fixedLinks.discord = `https://discord.gg/${links.discord}`;
          }
          needsUpdate = true;
        }
      }

      // Fix Facebook
      if (links.facebook && typeof links.facebook === 'string') {
        if (!links.facebook.startsWith('http')) {
          fixedLinks.facebook = `https://facebook.com/${links.facebook}`;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await db.streamer.update({
          where: { id: streamer.id },
          data: {
            externalLinks: fixedLinks
          }
        });

        logger.info(`✅ Fixed social links for ${streamer.username}`);
        fixed++;
      } else {
        skipped++;
      }
    }

    console.log('\n✅ Fixing completed!');
    console.log(`\n📊 Stats:`);
    console.log(`  - Total streamers: ${streamers.length}`);
    console.log(`  - Fixed: ${fixed}`);
    console.log(`  - Skipped: ${skipped}`);

  } catch (error) {
    console.error('\n❌ Fixing failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  fixKickSocialLinks()
    .then(() => {
      console.log('\n🎉 Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Fatal error:', error);
      process.exit(1);
    });
}

export { fixKickSocialLinks };
