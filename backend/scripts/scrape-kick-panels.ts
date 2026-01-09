import puppeteer from 'puppeteer';
import { db, logger } from '../src/utils/database';

/**
 * Scrape panel images and about section from Kick profiles
 * Uses Puppeteer to load the page and extract panel data
 */

interface KickPanelData {
  panelImages: Array<{ url: string; alt?: string; link?: string }>;
  aboutText: string;
}

async function scrapeKickPanels(username: string): Promise<KickPanelData | null> {
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const url = `https://kick.com/${username}`;
    console.log(`📄 Loading ${url}...`);

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Extract panel images and about section
    const panelData = await page.evaluate(() => {
      const panels: Array<{ url: string; alt?: string; link?: string }> = [];

      // Look specifically for the About section panels
      // Kick shows panels in the "About" tab section
      const selectors = [
        '[class*="about"] img',
        '[class*="About"] img',
        '[id*="about"] img',
        '[id*="About"] img',
        // Also try to find images in description/bio sections
        '[class*="description"] img',
        '[class*="bio"] img',
      ];

      let foundImages = new Set<string>();

      for (const selector of selectors) {
        const images = document.querySelectorAll(selector);
        images.forEach((img: any) => {
          const src = img.src || img.getAttribute('data-src');

          // Filter out banners, avatars, logos, thumbnails, and subcategory images
          if (src && !foundImages.has(src) &&
              src.startsWith('http') &&
              !src.includes('/banner_image/') &&
              !src.includes('/banner/') &&
              !src.includes('/offline_banner/') &&
              !src.includes('/profile_image/') &&
              !src.includes('/avatar') &&
              !src.includes('/logo') &&
              !src.includes('/thumbnail') &&
              !src.includes('/subcategories/')) {
            foundImages.add(src);

            // Check if image is wrapped in a link
            let link;
            const parent = img.closest('a');
            if (parent) {
              link = parent.href;
            }

            panels.push({
              url: src,
              alt: img.alt || undefined,
              link: link || undefined
            });
          }
        });
      }

      // Extract about/bio text
      let aboutText = '';
      const aboutSelectors = [
        '[class*="about"]',
        '[class*="bio"]',
        '[class*="description"]',
      ];

      for (const selector of aboutSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent) {
          const text = element.textContent.trim();
          if (text.length > aboutText.length) {
            aboutText = text;
          }
        }
      }

      return { panels, aboutText };
    });

    console.log(`  Found ${panelData.panels.length} panel images`);
    console.log(`  About text length: ${panelData.aboutText.length} characters`);

    await browser.close();

    return {
      panelImages: panelData.panels,
      aboutText: panelData.aboutText
    };

  } catch (error: any) {
    if (browser) {
      await browser.close();
    }
    logger.error(`Failed to scrape Kick panels for ${username}:`, error.message);
    return null;
  }
}

async function updateStreamerWithPanels(streamerId: string, username: string, panelData: KickPanelData): Promise<void> {
  try {
    // Get existing data
    const existing = await db.streamer.findUnique({
      where: { id: streamerId },
      select: { panelImages: true, aboutSection: true }
    });

    // Merge panel images (keep existing if no new ones found)
    const existingPanels = (existing?.panelImages as any[]) || [];
    const newPanels = panelData.panelImages.length > 0 ? panelData.panelImages : existingPanels;

    // Use new about text if longer/better than existing
    const existingAbout = existing?.aboutSection as string || '';
    const newAbout = panelData.aboutText.length > existingAbout.length ? panelData.aboutText : existingAbout;

    // Update database
    await db.streamer.update({
      where: { id: streamerId },
      data: {
        panelImages: newPanels,
        aboutSection: newAbout || undefined,
        lastEnrichmentUpdate: new Date()
      }
    });

    logger.info(`✅ Updated Kick panels for ${username}`, {
      panelImages: newPanels.length,
      aboutSection: newAbout.length > 0 ? 'Yes' : 'No'
    });

  } catch (error) {
    logger.error(`Failed to update database for ${username}:`, error);
    throw error;
  }
}

async function scrapeAllKickPanels() {
  console.log('\n🖼️  Starting Kick panel scraping...\n');

  try {
    // Get Kick streamers that have been enriched
    const allStreamers = await db.streamer.findMany({
      where: {
        platform: 'KICK'
      },
      select: {
        id: true,
        username: true,
        panelImages: true,
        externalLinks: true
      },
      take: 100 // Start with 100 streamers
    });

    // Filter for enriched streamers (those with externalLinks)
    const streamers = allStreamers.filter(s => s.externalLinks && typeof s.externalLinks === 'object');

    console.log(`Found ${streamers.length} enriched Kick streamers to scrape\n`);

    let scraped = 0;
    let failed = 0;
    let skipped = 0;

    const DELAY_BETWEEN_SCRAPES = 2000; // 2 seconds to avoid rate limiting

    for (const streamer of streamers) {
      try {
        console.log(`\n[${scraped + failed + skipped + 1}/${streamers.length}] ${streamer.username}`);

        // Scrape panels
        const panelData = await scrapeKickPanels(streamer.username);

        if (panelData && (panelData.panelImages.length > 0 || panelData.aboutText.length > 0)) {
          await updateStreamerWithPanels(streamer.id, streamer.username, panelData);
          scraped++;
        } else {
          skipped++;
          console.log(`  ⚠️  No panels found`);
        }

        // Delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_SCRAPES));

      } catch (error: any) {
        failed++;
        logger.error(`Failed to process ${streamer.username}:`, error.message);
      }
    }

    console.log('\n✅ Kick panel scraping completed!');
    console.log(`\n📊 Final Stats:`);
    console.log(`  - Total streamers: ${streamers.length}`);
    console.log(`  - Successfully scraped: ${scraped}`);
    console.log(`  - Skipped: ${skipped}`);
    console.log(`  - Failed: ${failed}`);
    console.log(`  - Success rate: ${((scraped / streamers.length) * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('\n❌ Scraping failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  scrapeAllKickPanels()
    .then(() => {
      console.log('\n🎉 Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Fatal error:', error);
      process.exit(1);
    });
}

export { scrapeAllKickPanels, scrapeKickPanels };
