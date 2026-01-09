import { Router } from 'express';
import { db } from '../utils/database';

const router = Router();

// Simple HTML admin viewer - accessible at /dbviewer
router.get('/', async (req, res) => {
  try {
    const [users, streamers, campaigns, conversations] = await Promise.all([
      db.user.count(),
      db.streamer.count(),
      db.campaign.count(),
      db.conversation.count(),
    ]);

    const recentStreamers = await db.streamer.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        platform: true,
        username: true,
        displayName: true,
        followers: true,
        isLive: true,
        region: true,
        tags: true,
        createdAt: true,
      }
    });

    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Envisioner Discovery Database Viewer</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1400px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #333; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
    .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; }
    .stat-card h3 { margin: 0 0 10px 0; font-size: 14px; opacity: 0.9; }
    .stat-card .number { font-size: 32px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #667eea; color: white; font-weight: 600; }
    tr:hover { background: #f9f9f9; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
    .badge.live { background: #10b981; color: white; }
    .badge.offline { background: #6b7280; color: white; }
    .tags { display: flex; gap: 4px; flex-wrap: wrap; }
    .tag { background: #e5e7eb; padding: 2px 6px; border-radius: 3px; font-size: 11px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔍 Envisioner Discovery Database Viewer</h1>
    <p>Real-time view of your production database</p>

    <div class="stats">
      <div class="stat-card">
        <h3>Total Users</h3>
        <div class="number">${users}</div>
      </div>
      <div class="stat-card">
        <h3>Total Streamers</h3>
        <div class="number">${streamers}</div>
      </div>
      <div class="stat-card">
        <h3>Total Campaigns</h3>
        <div class="number">${campaigns}</div>
      </div>
      <div class="stat-card">
        <h3>Conversations</h3>
        <div class="number">${conversations}</div>
      </div>
    </div>

    <h2>Recent Streamers (Last 50)</h2>
    <table>
      <thead>
        <tr>
          <th>Platform</th>
          <th>Username</th>
          <th>Display Name</th>
          <th>Followers</th>
          <th>Status</th>
          <th>Region</th>
          <th>Tags</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        ${recentStreamers.map(s => `
          <tr>
            <td>${s.platform}</td>
            <td><strong>${s.username}</strong></td>
            <td>${s.displayName}</td>
            <td>${s.followers.toLocaleString()}</td>
            <td><span class="badge ${s.isLive ? 'live' : 'offline'}">${s.isLive ? '🔴 LIVE' : 'Offline'}</span></td>
            <td>${s.region}</td>
            <td><div class="tags">${s.tags.slice(0, 3).map(tag => `<span class="tag">${tag}</span>`).join('')}</div></td>
            <td>${new Date(s.createdAt).toLocaleDateString()}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <p style="margin-top: 30px; color: #666; font-size: 14px;">
      Last updated: ${new Date().toLocaleString()} |
      <a href="/health" style="color: #667eea;">API Health</a> |
      <a href="/" style="color: #667eea;">API Root</a>
    </p>
  </div>
</body>
</html>
    `;

    res.send(html);
  } catch (error) {
    res.status(500).send(`<h1>Error</h1><pre>${error}</pre>`);
  }
});

export const dbViewerRoutes = router;
