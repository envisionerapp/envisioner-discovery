import { chromium } from 'playwright';

async function scrapeTwitchAbout(username: string) {
  console.log(`Scraping Twitch About for: ${username}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    // Go to the about page
    const url = `https://www.twitch.tv/${username}/about`;
    console.log(`Loading: ${url}`);

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for social links to load
    await page.waitForTimeout(2000);

    // Extract social links
    const socialLinks = await page.evaluate(() => {
      const links: { platform: string; url: string; name: string }[] = [];

      // Method 1: Look for social media link elements
      const socialElements = document.querySelectorAll('a[href*="instagram.com"], a[href*="twitter.com"], a[href*="x.com"], a[href*="youtube.com"], a[href*="tiktok.com"], a[href*="facebook.com"], a[href*="discord"]');

      socialElements.forEach(el => {
        const href = el.getAttribute('href');
        if (href) {
          let platform = 'unknown';
          if (href.includes('instagram.com')) platform = 'instagram';
          else if (href.includes('twitter.com') || href.includes('x.com')) platform = 'twitter';
          else if (href.includes('youtube.com')) platform = 'youtube';
          else if (href.includes('tiktok.com')) platform = 'tiktok';
          else if (href.includes('facebook.com')) platform = 'facebook';
          else if (href.includes('discord')) platform = 'discord';

          // Avoid duplicates
          if (!links.find(l => l.url === href)) {
            links.push({
              platform,
              url: href,
              name: el.textContent?.trim() || platform
            });
          }
        }
      });

      // Method 2: Look for social icons in the about section
      const aboutSection = document.querySelector('[data-a-target="about-panel"]');
      if (aboutSection) {
        const allLinks = aboutSection.querySelectorAll('a[href]');
        allLinks.forEach(el => {
          const href = el.getAttribute('href');
          if (href && (href.includes('instagram') || href.includes('twitter') || href.includes('youtube') || href.includes('tiktok') || href.includes('x.com'))) {
            let platform = 'unknown';
            if (href.includes('instagram.com')) platform = 'instagram';
            else if (href.includes('twitter.com') || href.includes('x.com')) platform = 'twitter';
            else if (href.includes('youtube.com')) platform = 'youtube';
            else if (href.includes('tiktok.com')) platform = 'tiktok';

            if (!links.find(l => l.url === href)) {
              links.push({ platform, url: href, name: platform });
            }
          }
        });
      }

      return links;
    });

    console.log('\nSocial Links Found:');
    if (socialLinks.length === 0) {
      console.log('  (none found)');
    } else {
      socialLinks.forEach(link => {
        console.log(`  ${link.platform}: ${link.url}`);
      });
    }

    // Also get the bio
    const bio = await page.evaluate(() => {
      const bioEl = document.querySelector('[data-a-target="profile-bio"]');
      return bioEl?.textContent?.trim() || null;
    });

    if (bio) {
      console.log('\nBio:', bio);
    }

    // Get a screenshot for debugging
    await page.screenshot({ path: 'twitch-about-debug.png' });
    console.log('\nScreenshot saved to twitch-about-debug.png');

    return { socialLinks, bio };

  } catch (error) {
    console.error('Error:', error);
    return null;
  } finally {
    await browser.close();
  }
}

const username = process.argv[2] || 'lourlo';
scrapeTwitchAbout(username).catch(console.error);
