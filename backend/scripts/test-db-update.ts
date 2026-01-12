import { db } from '../src/utils/database';
import axios from 'axios';

async function test() {
  console.log('Testing database update...');

  // Get a streamer
  const streamer = await db.streamer.findFirst({
    where: { platform: 'KICK', username: 'coscu' }
  });

  if (!streamer) {
    console.log('Streamer not found');
    await db.$disconnect();
    return;
  }

  console.log('Before:', JSON.stringify(streamer.socialLinks));

  // Fetch from Kick API
  const response = await axios.get('https://kick.com/api/v2/channels/coscu', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
  });

  const user = response.data?.user;
  console.log('From API:', { instagram: user?.instagram, twitter: user?.twitter, youtube: user?.youtube });

  // Build social links
  const links: string[] = [];
  if (user?.instagram) links.push(`https://instagram.com/${user.instagram}`);
  if (user?.twitter) links.push(`https://twitter.com/${user.twitter}`);
  if (user?.youtube) links.push(`https://youtube.com/${user.youtube}`);
  if (user?.tiktok) links.push(`https://tiktok.com/@${user.tiktok}`);

  console.log('New links:', links);

  // Update
  const updated = await db.streamer.update({
    where: { id: streamer.id },
    data: { socialLinks: links }
  });

  console.log('After update:', JSON.stringify(updated.socialLinks));

  // Verify by re-reading
  const verify = await db.streamer.findUnique({ where: { id: streamer.id } });
  console.log('Verified:', JSON.stringify(verify?.socialLinks));

  await db.$disconnect();
  console.log('Done!');
}

test().catch(console.error);
