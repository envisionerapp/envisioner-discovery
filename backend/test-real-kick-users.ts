import axios from 'axios';

/**
 * Test with real Kick users from our database
 */

async function testKickUser(username: string) {
  console.log(`\n=== Testing: ${username} ===`);

  try {
    const response = await axios.get(`https://kick.com/api/v2/channels/${username}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      timeout: 10000
    });

    const data = response.data;

    console.log('✅ Success!');
    console.log('Username:', data.user?.username);
    console.log('Bio:', data.user?.bio || 'No bio');
    console.log('Followers:', data.followers_count);
    console.log('Verified:', data.verified);
    console.log('Recent Categories:', data.recent_categories?.map((c: any) => c.name).join(', ') || 'None');

    // Check if there are any panel-like data fields
    console.log('\nAvailable user fields:', Object.keys(data.user || {}));
    console.log('Available channel fields:', Object.keys(data));

    return {
      success: true,
      bio: data.user?.bio,
      categories: data.recent_categories?.map((c: any) => c.name) || [],
      tags: data.recent_categories?.flatMap((c: any) => c.tags || []) || []
    };

  } catch (error: any) {
    console.log('❌ Error:', error.response?.status || error.message);
    return { success: false };
  }
}

async function main() {
  const testUsers = ['7coto', 'abdiel', 'abrahamkng', 'absoluttlol', 'acaviciando'];

  const results = [];
  for (const username of testUsers) {
    const result = await testKickUser(username);
    results.push({ username, ...result });
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n\n=== Summary ===');
  const successful = results.filter(r => r.success);
  console.log(`Success rate: ${successful.length}/${results.length}`);
  console.log('\nStreamers with bio:');
  successful.filter(r => r.bio).forEach(r => {
    console.log(`  - ${r.username}: ${r.bio}`);
  });
  console.log('\nCategories found:', [...new Set(successful.flatMap(r => r.categories))]);
  console.log('Tags found:', [...new Set(successful.flatMap(r => r.tags))]);
}

main().catch(console.error);
