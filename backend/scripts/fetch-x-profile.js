const axios = require('axios');

async function fetchXProfile() {
  const apiKey = process.env.SCRAPECREATORS_API_KEY;
  if (!apiKey) {
    console.log('SCRAPECREATORS_API_KEY not set');
    return;
  }

  console.log('Fetching X profile for sw33tz...');
  try {
    const response = await axios.get('https://api.scrapecreators.com/v1/twitter/profile', {
      params: { handle: 'sw33tz' },
      headers: { 'x-api-key': apiKey },
      timeout: 30000,
    });
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('Error:', error.response?.data || error.message);
  }
}

fetchXProfile();
