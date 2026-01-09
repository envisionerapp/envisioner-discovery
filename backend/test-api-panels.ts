import axios from 'axios';

async function testAPIPanels() {
  try {
    console.log('Testing API for juansguarnizo panels...\n');

    const response = await axios.get('http://localhost:3001/api/streamers/search?query=juansguarnizo');

    const streamer = response.data.streamers?.[0];

    if (!streamer) {
      console.log('❌ No streamer found');
      process.exit(1);
    }

    console.log(`✅ Found: ${streamer.username}`);
    console.log(`Display Name: ${streamer.displayName}`);
    console.log(`Panel Images:`, streamer.panelImages);
    console.log(`\nPanel Images type:`, typeof streamer.panelImages);
    console.log(`Panel Images is array:`, Array.isArray(streamer.panelImages));

    if (streamer.panelImages) {
      const panels = typeof streamer.panelImages === 'string'
        ? JSON.parse(streamer.panelImages)
        : streamer.panelImages;

      console.log(`\n📸 Found ${panels.length} panels:\n`);
      panels.forEach((p: any, i: number) => {
        console.log(`${i + 1}. ${p.url}`);
        if (p.alt) console.log(`   Alt: ${p.alt.substring(0, 100)}`);
        if (p.link) console.log(`   Link: ${p.link}`);
        console.log();
      });
    } else {
      console.log('\n❌ No panel images in API response');
    }

  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

testAPIPanels();
