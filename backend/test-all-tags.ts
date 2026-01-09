import { db } from './src/utils/database';
import axios from 'axios';

async function testAllTags() {
  console.log('Fetching all tags from database...\n');

  const streamers = await db.streamer.findMany({
    select: { tags: true, currentGame: true, topGames: true }
  });

  const tagCounts = new Map<string, number>();

  // Count occurrences of each tag
  streamers.forEach(s => {
    if (s.tags) {
      s.tags.forEach((t: string) => {
        tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
      });
    }
    if (s.currentGame) {
      tagCounts.set(s.currentGame, (tagCounts.get(s.currentGame) || 0) + 1);
    }
    if (s.topGames) {
      s.topGames.forEach((g: string) => {
        tagCounts.set(g, (tagCounts.get(g) || 0) + 1);
      });
    }
  });

  const sortedTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1]) // Sort by count descending
    .slice(0, 50); // Only test top 50 tags

  console.log(`Total unique tags: ${tagCounts.size}\n`);
  console.log('Testing AI search for top 50 tags...\n');
  console.log('Tag | DB Count | AI Search Count');
  console.log('--- | -------- | ---------------');

  for (const [tag, dbCount] of sortedTags) {
    try {
      const response = await axios.post('http://localhost:8080/api/chat/search', {
        query: `${tag} streamers`
      });

      const aiCount = response.data.data.totalCount;
      const match = aiCount === dbCount ? '✓' : '✗';
      console.log(`${tag} | ${dbCount} | ${aiCount} ${match}`);
    } catch (error) {
      console.log(`${tag} | ${dbCount} | ERROR`);
    }
  }

  await db.$disconnect();
}

testAllTags();
