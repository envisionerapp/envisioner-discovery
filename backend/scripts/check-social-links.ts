import { db } from '../src/utils/database';

async function check() {
  // Check what fields are actually populated (using snake_case column names)
  const fieldCounts = await db.$queryRaw`
    SELECT
      COUNT(*) FILTER (WHERE "socialLinks"::text != '[]' AND "socialLinks"::text != 'null') as social_links,
      COUNT(*) FILTER (WHERE profile_description IS NOT NULL AND profile_description != '') as profile_desc,
      COUNT(*) FILTER (WHERE panel_texts IS NOT NULL AND array_length(panel_texts, 1) > 0) as panel_texts,
      COUNT(*) FILTER (WHERE external_links IS NOT NULL) as external_links,
      COUNT(*) FILTER (WHERE about_section IS NOT NULL AND about_section != '') as about_section
    FROM discovery_creators
    WHERE platform IN ('TWITCH', 'KICK', 'YOUTUBE')
  ` as any[];

  console.log('=== Field Population Stats for Twitch/Kick/YouTube (12,799 total) ===');
  console.log(fieldCounts[0]);

  // Check for panel data that might have social links
  const withPanels = await db.$queryRaw`
    SELECT username, platform, panel_texts, external_links
    FROM discovery_creators
    WHERE platform IN ('TWITCH', 'KICK')
    AND panel_texts IS NOT NULL
    AND array_length(panel_texts, 1) > 0
    LIMIT 10
  ` as any[];

  console.log('\n\nStreamers WITH panel_texts:');
  withPanels.forEach((s: any) => {
    console.log(`\n[${s.platform}] ${s.username}:`);
    console.log('  panel_texts:', JSON.stringify(s.panel_texts)?.substring(0, 500));
    console.log('  external_links:', JSON.stringify(s.external_links)?.substring(0, 300));
  });

  // Check external links
  const withExtLinks = await db.$queryRaw`
    SELECT username, platform, external_links
    FROM discovery_creators
    WHERE platform IN ('TWITCH', 'KICK', 'YOUTUBE')
    AND external_links IS NOT NULL
    LIMIT 20
  ` as any[];

  console.log('\n\nStreamers WITH external_links:');
  withExtLinks.forEach((s: any) => {
    console.log(`[${s.platform}] ${s.username}: ${JSON.stringify(s.external_links)?.substring(0, 300)}`);
  });

  await db.$disconnect();
}

check().catch(console.error);
