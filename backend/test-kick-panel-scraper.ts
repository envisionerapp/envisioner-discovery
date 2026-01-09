import { scrapeKickPanels } from './scripts/scrape-kick-panels';

async function test() {
  console.log('🧪 Testing Kick panel scraper...\n');

  const testUsernames = ['luay998', 'daarick', 'tommypervan'];

  for (const username of testUsernames) {
    console.log(`\n--- Testing: ${username} ---`);
    const result = await scrapeKickPanels(username);

    if (result) {
      console.log('✅ Success!');
      console.log(`  Panel images: ${result.panelImages.length}`);
      if (result.panelImages.length > 0) {
        result.panelImages.forEach((panel, idx) => {
          console.log(`    ${idx + 1}. ${panel.url}`);
          if (panel.link) console.log(`       Link: ${panel.link}`);
        });
      }
      console.log(`  About text: ${result.aboutText.length} chars`);
      if (result.aboutText.length > 0) {
        console.log(`    "${result.aboutText.substring(0, 100)}..."`);
      }
    } else {
      console.log('❌ Failed to scrape');
    }

    // Delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n✅ Test completed!');
}

test()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
