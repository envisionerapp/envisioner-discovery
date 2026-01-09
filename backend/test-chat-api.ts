import axios from 'axios';

async function testChatAPI() {
  try {
    console.log('Testing chat API for juansguarnizo...\n');

    // Login first
    const loginResponse = await axios.post('http://localhost:8080/api/auth/login', {
      email: 'abiola@mieladigital.com',
      password: 'password'
    });

    const token = loginResponse.data.token;
    console.log('✅ Logged in successfully\n');

    // Search via chat
    const chatResponse = await axios.post(
      'http://localhost:8080/api/chat/stream-search',
      {
        query: 'show me juansguarnizo'
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const streamer = chatResponse.data.streamers?.[0];

    if (!streamer) {
      console.log('❌ No streamer found');
      process.exit(1);
    }

    console.log(`✅ Found: ${streamer.username}`);
    console.log(`Display Name: ${streamer.displayName}`);
    console.log(`\nPanel Images:`, streamer.panelImages);
    console.log(`Panel Images type:`, typeof streamer.panelImages);

    if (streamer.panelImages) {
      const panels = typeof streamer.panelImages === 'string'
        ? JSON.parse(streamer.panelImages)
        : streamer.panelImages;

      console.log(`\n📸 Found ${Array.isArray(panels) ? panels.length : 0} panels:\n`);

      if (Array.isArray(panels)) {
        panels.slice(0, 3).forEach((p: any, i: number) => {
          console.log(`${i + 1}. ${p.url}`);
          if (p.alt) console.log(`   Alt: ${p.alt.substring(0, 80)}`);
          if (p.link) console.log(`   Link: ${p.link}`);
          console.log();
        });
      }
    } else {
      console.log('\n❌ No panel images in API response');
    }

    console.log('\n✅ Test complete!');

  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

testChatAPI();
