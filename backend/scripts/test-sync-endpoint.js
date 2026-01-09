const fetch = require('node-fetch');

async function testReplaceAllStreamers() {
  try {
    console.log('🧪 Testing the replace all streamers endpoint...');

    // First login to get a valid token
    console.log('🔐 Logging in...');
    const loginResponse = await fetch('http://localhost:8080/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'abiola@miela.cc',
        password: 'Abo!la-Mielo2025'
      }),
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
    }

    const loginData = await loginResponse.json();
    const token = loginData.data.token;
    console.log('✅ Login successful');

    // Get current streamer count
    console.log('📊 Getting current streamer count...');
    const statsResponse = await fetch('http://localhost:8080/api/streamers/stats', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (statsResponse.ok) {
      const statsData = await statsResponse.json();
      console.log(`📊 Current streamers in database: ${statsData.data.total}`);
    }

    // Test the replace all streamers endpoint
    console.log('🔄 Testing replace all streamers endpoint...');
    const syncResponse = await fetch('http://localhost:8080/api/admin/sync/replace-all-streamers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const syncData = await syncResponse.json();

    if (syncResponse.ok) {
      console.log('✅ Sync endpoint test successful!');
      console.log(`📊 Replaced streamers: ${syncData.data.replacedStreamers}`);
      console.log(`📊 Total streamers after sync: ${syncData.data.totalStreamers}`);
      console.log('🎉 The complete database replacement functionality is working correctly!');
    } else {
      console.error('❌ Sync endpoint test failed:', syncData);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testReplaceAllStreamers();