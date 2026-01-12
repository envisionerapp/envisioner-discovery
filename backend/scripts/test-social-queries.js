const axios = require('axios');

async function test() {
  const login = 'lourlo';

  const queries = [
    {
      name: 'User.socialMedias',
      query: `query { user(login: "${login}") { socialMedias { id name title url } } }`
    },
    {
      name: 'Channel.socialMedias',
      query: `query { user(login: "${login}") { channel { socialMedias { name url } } } }`
    },
    {
      name: 'streamProfile',
      query: `query { user(login: "${login}") { stream { title } channel { id } profileURL } }`
    }
  ];

  for (const q of queries) {
    try {
      const res = await axios.post('https://gql.twitch.tv/gql', { query: q.query }, {
        headers: { 'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko' }
      });
      console.log(q.name + ':', JSON.stringify(res.data));
    } catch (e) {
      console.log(q.name + ' ERROR:', e.response?.data || e.message);
    }
  }
}

test();
