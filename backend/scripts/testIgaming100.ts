import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load env from backend/.env (same convention as server)
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import { aiSearchService } from '../src/services/aiSearchService';
import { Platform } from '@prisma/client';

type CheckResult = {
  query: string;
  mixed: {
    total: number;
    tags: string[];
  };
  byPlatform: Array<{
    platform: Platform;
    total: number;
    platformsSeen: string[];
    tags: string[];
    platformOk: boolean;
    tagConsistent: boolean;
  }>;
};

async function run() {
  // 100 queries based on real iGaming use cases
  const queries: string[] = [
    // Region-based campaigns (20)
    '40 Chile streamers for betting campaign',
    '50 Mexico streamers for casino campaign',
    '100 casino streamers in Mexico',
    '50 Peru streamers for Betano campaign',
    '60 Argentina streamers for sports betting',
    '30 Brazil streamers for casino promotion',
    '25 Colombia streamers for poker campaign',
    '45 streamers in Chile for gambling ads',
    '80 Mexico influencers for betting brand',
    '35 Peru content creators for casino',
    'Spanish speaking streamers for betting in LATAM',
    'Top casino streamers in South America',
    'Female streamers in Brazil for gambling promotion',
    'Esports streamers in Mexico for casino sponsorship',
    'Just Chatting streamers in Colombia for casino',
    'Variety streamers in Peru for Betano',
    'Gaming influencers across LATAM for betting',
    'Live streamers in Mexico for casino campaign',
    'Chile streamers currently streaming',
    'Brazil live gaming streamers',
    // Game-specific campaigns (20)
    '60 streamers for World of Warships campaign',
    '30 Brazil WoW streamers for campaign',
    '50 slot streamers for casino promotion',
    '40 poker streamers in Mexico',
    '70 casino game streamers in Argentina',
    '45 Grand Theft Auto V streamers for betting',
    '55 League of Legends streamers in Brazil',
    '35 Counter-Strike streamers for gambling campaign',
    '50 FIFA streamers in Chile for sports betting',
    '40 Call of Duty streamers in Colombia',
    '20 Mexico World of Warships streamers',
    'GTA 5 streamers in Brazil for betting',
    'Valorant streamers in Chile for casino',
    'Just Chatting streamers in Argentina',
    'Poker pros in Argentina for betting campaign',
    'Slots streamers in Peru',
    'Roulette streamers in Mexico',
    'Minecraft streamers in Colombia for casino',
    'Fortnite streamers in Chile for betting',
    // Follower-based + multi-criteria mixes (60)
    '50 Chile streamers with 100k+ followers for betting',
    '30 Mexico streamers with 50k+ followers',
    '40 Brazil influencers with 200k+ followers for casino',
    '25 Argentina streamers with 150k followers',
    '35 Peru streamers with 75k+ followers for Betano',
    '20 Colombia streamers with 500k+ followers',
    '15 Chile gaming influencers with 1 million followers',
    '50 Mexico streamers over 100000 followers',
    '30 Brazil casino streamers with 80k followers',
    '40 Peru poker streamers with 60k+ followers',
    '50 Mexico casino streamers with 100k followers',
    '30 Chile live streamers for betting campaign',
    '40 Brazil GTA streamers with 50k+ followers',
    '25 Peru poker streamers with 75k followers',
    '35 Argentina FIFA streamers for sports betting',
    '20 Mexico live casino streamers with 100k followers',
    '45 Chile slot streamers for gambling promotion',
    '30 Brazil live League of Legends streamers',
    '40 Colombia casino streamers with 60k+ followers',
    '25 Peru live streamers for Betano campaign',
    '50 Mexico poker streamers with 80k followers',
    '35 Argentina casino streamers for betting brand',
    '30 Chile GTA streamers with 100k+ followers',
    '40 Brazil casino live streamers',
    '25 Peru FIFA streamers with 50k followers',
    '45 Argentina live casino streamers with 75k followers',
    '30 Chile poker streamers for gambling campaign',
    '35 Brazil slot streamers with 100k+ followers',
    '40 Colombia live streamers for betting promotion',
    // Platform-specific campaigns (20)
    '50 Twitch streamers in Mexico for casino',
    '30 YouTube streamers in Brazil for betting',
    '40 Kick streamers in Argentina',
    '25 Twitch Peru streamers for Betano',
    '35 YouTube Chile streamers for gambling',
    '20 Twitch Mexico casino streamers with 100k followers',
    '45 YouTube Brazil poker streamers',
    '30 Kick Colombia streamers for betting',
    '40 Twitch Argentina live streamers',
    '25 YouTube Peru casino streamers',
  ];

  const platforms: Platform[] = ['TWITCH', 'YOUTUBE', 'KICK'] as Platform[];

  const results: CheckResult[] = [];
  let totalChecks = 0;
  let passChecks = 0;
  let failChecks = 0;

  for (const query of queries) {
    const entry: CheckResult = {
      query,
      mixed: { total: 0, tags: [] },
      byPlatform: []
    };

    // Mixed (no platform filter)
    const mixed = await aiSearchService.searchStreamersWithAI({
      userId: 'test-user',
      query,
      conversationId: 'test-run'
    });

    entry.mixed.total = mixed.totalCount;
    entry.mixed.tags = (mixed.searchParams.tags || []) as string[];

    // Per-platform checks
    for (const p of platforms) {
      const resp = await aiSearchService.searchStreamersWithAI({
        userId: 'test-user',
        query,
        conversationId: 'test-run',
        searchParams: { platforms: [p] }
      });

      const platformsSeen = Array.from(new Set((resp.streamers || []).slice(0, 20).map((s: any) => s.platform)));
      const platformOk = platformsSeen.length === 0 || (platformsSeen.length === 1 && platformsSeen[0] === p);
      const tags = (resp.searchParams.tags || []) as string[];
      const tagConsistent = JSON.stringify(tags) === JSON.stringify(entry.mixed.tags);

      entry.byPlatform.push({
        platform: p,
        total: resp.totalCount,
        platformsSeen,
        tags,
        platformOk,
        tagConsistent
      } as any);

      // Count checks
      totalChecks += 2; // platformOk + tagConsistent
      passChecks += platformOk ? 1 : 0;
      passChecks += tagConsistent ? 1 : 0;
      failChecks += platformOk ? 0 : 1;
      failChecks += tagConsistent ? 0 : 1;
    }

    results.push(entry);
  }

  // Persist results
  const outDir = path.resolve(__dirname, '..');
  const jsonPath = path.join(outDir, 'test-igaming-results.json');
  const txtPath = path.join(outDir, 'test-igaming-summary.txt');

  fs.writeFileSync(jsonPath, JSON.stringify({ totalChecks, passChecks, failChecks, results }, null, 2));

  const lines: string[] = [];
  lines.push(`Total checks: ${totalChecks}`);
  lines.push(`Passed: ${passChecks}`);
  lines.push(`Failed: ${failChecks}`);
  lines.push('');

  for (const r of results) {
    lines.push(`Query: ${r.query}`);
    lines.push(`  Mixed -> total=${r.mixed.total}, tags=${JSON.stringify(r.mixed.tags)}`);
    for (const bp of r.byPlatform) {
      lines.push(`  [${bp.platform}] total=${bp.total}, platformsSeen=${JSON.stringify(bp.platformsSeen)}, tags=${JSON.stringify(bp.tags)}, platformOk=${bp.platformOk}, tagConsistent=${bp.tagConsistent}`);
    }
    lines.push('');
  }

  fs.writeFileSync(txtPath, lines.join('\n'));

  console.log('Done.');
  console.log(`Summary written to: ${txtPath}`);
  console.log(`Details written to: ${jsonPath}`);
}

run().catch((e) => {
  console.error('Fatal error in test run:', e);
  process.exit(1);
});

