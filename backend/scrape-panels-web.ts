import { db } from './src/utils/database';
import { Prisma } from '@prisma/client';
import axios from 'axios';
import * as cheerio from 'cheerio';

async function scrapePanelsFromWeb() {
  console.log('🔍 Scraping Twitch panels from web pages...\n');

  // Get Twitch streamers from database
  const streamers = await db.streamer.findMany({
    where: {
      platform: 'TWITCH',
      followers: { gt: 500000 }
    },
    select: { id: true, username: true, followers: true },
    orderBy: { followers: 'desc' },
    take: 10
  });

  console.log(`Found ${streamers.length} Twitch streamers to scrape\n`);

  for (const streamer of streamers) {
    try {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Scraping: ${streamer.username} (${streamer.followers.toLocaleString()} followers)`);

      const url = `https://www.twitch.tv/${streamer.username}/about`;
      console.log(`URL: ${url}`);

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);

      // Try to find panel images in the HTML
      const panelImages: Array<{ url: string; alt?: string; link?: string }> = [];

      // Look for images in the about section
      $('img').each((_, el) => {
        const src = $(el).attr('src');
        const alt = $(el).attr('alt');

        // Filter for panel-like images (usually have static-cdn.jtvnw.net or panels in URL)
        if (src && (src.includes('static-cdn.jtvnw.net') || src.includes('panel'))) {
          // Get parent link if exists
          const link = $(el).closest('a').attr('href');

          panelImages.push({
            url: src,
            alt: alt || undefined,
            link: link || undefined
          });
        }
      });

      // Also look for data in script tags (Twitch embeds data in JS)
      $('script').each((_, el) => {
        const content = $(el).html();
        if (content && content.includes('panels')) {
          // Try to extract panel data from JSON embedded in scripts
          const panelMatch = content.match(/"panels":\s*(\[[\s\S]*?\])/);
          if (panelMatch) {
            try {
              const panels = JSON.parse(panelMatch[1]);
              panels.forEach((panel: any) => {
                if (panel.image) {
                  panelImages.push({
                    url: panel.image,
                    alt: panel.title || panel.description,
                    link: panel.link
                  });
                }
              });
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      });

      console.log(`✅ Found ${panelImages.length} potential panel images`);

      if (panelImages.length > 0) {
        console.log('\n📸 Panel Images:');
        panelImages.slice(0, 5).forEach((img, i) => {
          console.log(`\n${i + 1}. ${img.url}`);
          if (img.alt) console.log(`   Alt: ${img.alt}`);
          if (img.link) console.log(`   Link: ${img.link}`);
        });

        // Save to database
        await db.streamer.update({
          where: { id: streamer.id },
          data: {
            panelImages: panelImages,
            lastEnrichmentUpdate: new Date()
          }
        });

        console.log(`\n✅ SAVED ${panelImages.length} panel images to database for ${streamer.username}!`);
        console.log(`\n🎯 SUCCESS! Found working panels. Stopping here.\n`);
        break;
      } else {
        console.log('⚠️  No panel images found in HTML');
      }

      // Delay between requests
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error: any) {
      console.log(`❌ Error with ${streamer.username}: ${error.message}`);
    }
  }

  // Show results
  const withPanels = await db.streamer.findMany({
    where: {
      platform: 'TWITCH',
      panelImages: { not: Prisma.DbNull }
    },
    select: { username: true, panelImages: true }
  });

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 Total streamers with panel images: ${withPanels.length}`);
  withPanels.forEach(s => {
    const panels = typeof s.panelImages === 'string' ? JSON.parse(s.panelImages) : s.panelImages;
    console.log(`   • ${s.username}: ${Array.isArray(panels) ? panels.length : 0} panels`);
  });

  await db.$disconnect();
  process.exit(0);
}

scrapePanelsFromWeb();
