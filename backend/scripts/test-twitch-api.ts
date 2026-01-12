import axios from 'axios';

const TWITCH_GQL_URL = 'https://gql.twitch.tv/gql';
const TWITCH_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

async function test() {
  const login = process.argv[2] || 'lourlo';

  console.log(`Testing Twitch API for: ${login}\n`);

  // Test 1: Get user info with about/bio
  console.log('1. User info with description...');
  try {
    const userQuery = {
      query: `
        query GetUser($login: String!) {
          user(login: $login) {
            id
            login
            displayName
            description
            primaryColorHex
            profileImageURL(width: 150)
            followers {
              totalCount
            }
            socialMedias {
              id
              name
              title
              url
            }
          }
        }
      `,
      variables: { login }
    };

    const response = await axios.post(TWITCH_GQL_URL, userQuery, {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Content-Type': 'application/json',
      }
    });

    const user = response.data?.data?.user;
    if (user) {
      console.log('   Display Name:', user.displayName);
      console.log('   Description:', user.description || '(empty)');
      console.log('   Followers:', user.followers?.totalCount);
      console.log('   Social Medias:', JSON.stringify(user.socialMedias || []));
    } else {
      console.log('   User not found');
    }
  } catch (error: any) {
    console.log('   Error:', error.message);
  }

  // Test 2: Get channel panels
  console.log('\n2. Channel panels...');
  try {
    const panelsQuery = {
      query: `
        query GetPanels($login: String!) {
          user(login: $login) {
            panels {
              id
              type
              title
              description
              linkURL
              imageURL
            }
          }
        }
      `,
      variables: { login }
    };

    const response = await axios.post(TWITCH_GQL_URL, panelsQuery, {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Content-Type': 'application/json',
      }
    });

    const panels = response.data?.data?.user?.panels || [];
    console.log(`   Found ${panels.length} panels`);

    for (const panel of panels.slice(0, 5)) {
      console.log(`   - ${panel.type}: ${panel.title || '(no title)'}`);
      if (panel.linkURL) console.log(`     Link: ${panel.linkURL}`);
      if (panel.description) console.log(`     Desc: ${panel.description.substring(0, 100)}...`);
    }
  } catch (error: any) {
    console.log('   Error:', error.message);
  }

  // Test 3: Get channel about page
  console.log('\n3. Channel about page...');
  try {
    const aboutQuery = {
      query: `
        query GetChannelAbout($login: String!) {
          user(login: $login) {
            channel {
              socialMedias {
                id
                name
                title
                url
              }
            }
            description
          }
        }
      `,
      variables: { login }
    };

    const response = await axios.post(TWITCH_GQL_URL, aboutQuery, {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Content-Type': 'application/json',
      }
    });

    console.log('   Result:', JSON.stringify(response.data?.data, null, 2));
  } catch (error: any) {
    console.log('   Error:', error.message);
  }

  // Test 4: ChannelRoot query (used by Twitch frontend)
  console.log('\n4. ChannelRoot query...');
  try {
    const channelRootQuery = {
      query: `
        query ChannelRoot_AboutPanel($login: String!) {
          user(login: $login) {
            id
            login
            displayName
            description
            createdAt
            roles {
              isPartner
              isAffiliate
            }
            stream {
              id
            }
            channel {
              id
              socialMedias {
                id
                name
                title
                url
              }
            }
          }
        }
      `,
      variables: { login }
    };

    const response = await axios.post(TWITCH_GQL_URL, channelRootQuery, {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Content-Type': 'application/json',
      }
    });

    const user = response.data?.data?.user;
    if (user) {
      console.log('   Login:', user.login);
      console.log('   Display Name:', user.displayName);
      console.log('   Description:', user.description);
      console.log('   Partner:', user.roles?.isPartner);
      console.log('   Channel Social Medias:', JSON.stringify(user.channel?.socialMedias));
    }
  } catch (error: any) {
    console.log('   Error:', error.message);
  }

  // Test 5: Try different queries to find social links
  console.log('\n5. All user fields exploration...');
  try {
    const exploreQuery = {
      query: `
        query ExploreUser($login: String!) {
          user(login: $login) {
            id
            login
            displayName
            description
            broadcastSettings {
              title
            }
          }
        }
      `,
      variables: { login }
    };

    const response = await axios.post(TWITCH_GQL_URL, exploreQuery, {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Content-Type': 'application/json',
      }
    });

    console.log('   Result:', JSON.stringify(response.data?.data, null, 2));
  } catch (error: any) {
    console.log('   Error:', error.message);
  }
}

test().catch(console.error);
