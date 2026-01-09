import { db } from './src/utils/database';

async function insertMockPanels() {
  console.log('📸 Inserting mock panel images for testing...\n');

  // Get a popular Twitch streamer
  const streamer = await db.streamer.findFirst({
    where: {
      platform: 'TWITCH',
      followers: { gt: 1000000 }
    },
    select: { id: true, username: true, displayName: true, followers: true }
  });

  if (!streamer) {
    console.log('❌ No Twitch streamers found');
    await db.$disconnect();
    process.exit(1);
  }

  console.log(`Found streamer: ${streamer.displayName || streamer.username} (@${streamer.username})`);
  console.log(`Followers: ${streamer.followers.toLocaleString()}\n`);

  // Create realistic mock panel images (these are example URLs that would typically be found)
  const mockPanelImages = [
    {
      url: 'https://static-cdn.jtvnw.net/jtv_user_pictures/panel-12345678-image-abcd1234.png',
      alt: 'Follow me on Twitter',
      link: 'https://twitter.com/example'
    },
    {
      url: 'https://static-cdn.jtvnw.net/jtv_user_pictures/panel-87654321-image-efgh5678.png',
      alt: 'Join my Discord',
      link: 'https://discord.gg/example'
    },
    {
      url: 'https://static-cdn.jtvnw.net/jtv_user_pictures/panel-11223344-image-ijkl9012.png',
      alt: 'Subscribe on YouTube',
      link: 'https://youtube.com/example'
    },
    {
      url: 'https://static-cdn.jtvnw.net/jtv_user_pictures/panel-55667788-image-mnop3456.png',
      alt: 'Sponsor Information',
      link: 'https://example.com/sponsor'
    }
  ];

  // Update the streamer with panel images
  await db.streamer.update({
    where: { id: streamer.id },
    data: {
      panelImages: mockPanelImages,
      lastEnrichmentUpdate: new Date()
    }
  });

  console.log('✅ Mock panel images inserted successfully!\n');
  console.log('Panel Images:');
  mockPanelImages.forEach((img, i) => {
    console.log(`\n${i + 1}. URL: ${img.url}`);
    console.log(`   Alt: ${img.alt}`);
    console.log(`   Link: ${img.link}`);
  });

  console.log(`\n🎯 Panel data saved for: ${streamer.username}`);
  console.log(`\n💡 Now test by searching for "${streamer.username}" in the frontend chat!\n`);

  await db.$disconnect();
  process.exit(0);
}

insertMockPanels();
