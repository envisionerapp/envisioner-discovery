import { db } from '../src/utils/database';

// Extract handle from URL for different platforms
function extractHandle(username: string, platform: string): string | null {
  // If it's already just a handle (no URL), return it
  if (!username.includes('/') && !username.includes('.')) {
    return username.replace('@', '');
  }

  try {
    // Try to parse as URL
    let url = username;
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }

    const u = new URL(url);
    let path = u.pathname.replace(/^\/+|\/+$/g, '');

    // Remove @ symbol
    path = path.replace('@', '');

    // Platform-specific handling
    switch (platform.toUpperCase()) {
      case 'TIKTOK':
        // Remove lang parameter and other stuff
        return path.split('?')[0].replace('@', '') || null;

      case 'INSTAGRAM':
        return path.split('/')[0] || null;

      case 'X':
        return path.split('/')[0] || null;

      case 'FACEBOOK':
        // Handle facebook.com/username or facebook.com/profile.php?id=xxx
        if (path.startsWith('profile.php')) return null;
        return path.split('/')[0] || null;

      default:
        return path.split('/')[0] || null;
    }
  } catch {
    // If URL parsing fails, try to extract from the string
    const match = username.match(/@([a-zA-Z0-9_.]+)/);
    if (match) return match[1];

    // Last resort - just clean up the string
    return username.replace(/https?:\/\/[^/]+\//, '').replace('@', '').split('/')[0].split('?')[0] || null;
  }
}

async function fixSyncQueueHandles() {
  console.log('========================================');
  console.log('🔧 FIX SYNC QUEUE HANDLES');
  console.log('========================================\n');

  // Get all pending items with URL-like usernames
  const items = await db.socialSyncQueue.findMany({
    where: {
      status: 'PENDING',
      OR: [
        { username: { contains: '/' } },
        { username: { contains: 'http' } },
        { username: { contains: '.com' } },
      ]
    }
  });

  console.log(`Found ${items.length} items with URL-like usernames\n`);

  let fixed = 0;
  let deleted = 0;
  let skipped = 0;

  for (const item of items) {
    const handle = extractHandle(item.username, item.platform);

    if (!handle || handle === item.username) {
      // Can't extract - delete the entry
      await db.socialSyncQueue.delete({ where: { id: item.id } });
      deleted++;
      console.log(`[DELETE] ${item.platform}: ${item.username} -> (can't extract)`);
      continue;
    }

    // Check if the extracted handle already exists
    const existing = await db.socialSyncQueue.findFirst({
      where: {
        platform: item.platform,
        username: handle
      }
    });

    if (existing) {
      // Duplicate - delete the URL version
      await db.socialSyncQueue.delete({ where: { id: item.id } });
      deleted++;
      console.log(`[DELETE] ${item.platform}: ${item.username} -> ${handle} (duplicate)`);
      continue;
    }

    // Update with the cleaned handle
    await db.socialSyncQueue.update({
      where: { id: item.id },
      data: { username: handle }
    });
    fixed++;
    console.log(`[FIXED] ${item.platform}: ${item.username} -> ${handle}`);
  }

  console.log('\n========================================');
  console.log('📊 RESULTS');
  console.log('========================================');
  console.log(`Fixed: ${fixed}`);
  console.log(`Deleted: ${deleted}`);
  console.log(`Skipped: ${skipped}`);

  // Show updated stats
  const stats = await db.socialSyncQueue.groupBy({
    by: ['platform', 'status'],
    _count: true
  });

  console.log('\n📋 Updated Sync Queue Stats:');
  const pending = stats.filter(s => s.status === 'PENDING');
  pending.forEach(s => console.log(`  ${s.platform}: ${s._count} pending`));

  await db.$disconnect();
}

fixSyncQueueHandles().catch(console.error);
