import { Router } from 'express';
import { db } from '../utils/database';
import { Platform, Region, FraudStatus } from '@prisma/client';

const router = Router();

// ==================== STREAMERS API ====================

// GET all streamers with filters, search, and pagination
router.get('/api/streamers', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;
    const search = req.query.search as string;
    const platform = req.query.platform as string;
    const region = req.query.region as string;
    const isLive = req.query.isLive as string;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as string) || 'desc';

    const where: any = {};

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (platform && platform !== 'ALL') {
      where.platform = platform;
    }

    if (region && region !== 'ALL') {
      where.region = region;
    }

    if (isLive === 'true') {
      where.isLive = true;
    } else if (isLive === 'false') {
      where.isLive = false;
    }

    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [streamers, total] = await Promise.all([
      db.streamer.findMany({
        where,
        take: limit,
        skip,
        orderBy,
      }),
      db.streamer.count({ where }),
    ]);

    res.json({ streamers, total, page, totalPages: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET single streamer
router.get('/api/streamers/:id', async (req, res) => {
  try {
    const streamer = await db.streamer.findUnique({
      where: { id: req.params.id },
    });
    if (!streamer) return res.status(404).json({ error: 'Streamer not found' });
    res.json(streamer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE new streamer
router.post('/api/streamers', async (req, res) => {
  try {
    const streamer = await db.streamer.create({
      data: {
        platform: req.body.platform,
        username: req.body.username.toLowerCase().trim(),
        displayName: req.body.displayName.trim(),
        profileUrl: req.body.profileUrl,
        avatarUrl: req.body.avatarUrl || null,
        followers: parseInt(req.body.followers) || 0,
        region: req.body.region,
        language: req.body.language || 'es',
        tags: req.body.tags ? (Array.isArray(req.body.tags) ? req.body.tags : req.body.tags.split(',').map((t: string) => t.trim())) : [],
        isLive: req.body.isLive === 'true' || req.body.isLive === true,
      },
    });
    res.json(streamer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE streamer
router.put('/api/streamers/:id', async (req, res) => {
  try {
    const streamer = await db.streamer.update({
      where: { id: req.params.id },
      data: {
        platform: req.body.platform,
        username: req.body.username.toLowerCase().trim(),
        displayName: req.body.displayName.trim(),
        profileUrl: req.body.profileUrl,
        avatarUrl: req.body.avatarUrl || null,
        followers: parseInt(req.body.followers) || 0,
        region: req.body.region,
        language: req.body.language || 'es',
        tags: req.body.tags ? (Array.isArray(req.body.tags) ? req.body.tags : req.body.tags.split(',').map((t: string) => t.trim())) : [],
        isLive: req.body.isLive === 'true' || req.body.isLive === true,
      },
    });
    res.json(streamer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE streamer
router.delete('/api/streamers/:id', async (req, res) => {
  try {
    await db.streamer.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// BULK DELETE streamers
router.post('/api/streamers/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    await db.streamer.deleteMany({
      where: { id: { in: ids } },
    });
    res.json({ success: true, deleted: ids.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== USERS API ====================

// GET all users
router.get('/api/users', async (req, res) => {
  try {
    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        mfaEnabled: true,
        lastLogin: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE user
router.post('/api/users', async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    const user = await db.user.create({
      data: {
        email: req.body.email,
        password: hashedPassword,
        firstName: req.body.firstName || null,
        lastName: req.body.lastName || null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        mfaEnabled: true,
        lastLogin: true,
        createdAt: true,
      },
    });
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE user
router.delete('/api/users/:id', async (req, res) => {
  try {
    await db.user.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== CAMPAIGNS API ====================

// GET all campaigns
router.get('/api/campaigns', async (req, res) => {
  try {
    const campaigns = await db.campaign.findMany({
      include: {
        _count: {
          select: { assignedStreamers: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(campaigns);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE campaign
router.post('/api/campaigns', async (req, res) => {
  try {
    const campaign = await db.campaign.create({
      data: {
        name: req.body.name,
        description: req.body.description,
        budget: req.body.budget ? parseFloat(req.body.budget) : null,
        isActive: req.body.isActive === 'true' || req.body.isActive === true,
        startDate: req.body.startDate ? new Date(req.body.startDate) : null,
        endDate: req.body.endDate ? new Date(req.body.endDate) : null,
      },
    });
    res.json(campaign);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE campaign
router.put('/api/campaigns/:id', async (req, res) => {
  try {
    const campaign = await db.campaign.update({
      where: { id: req.params.id },
      data: {
        name: req.body.name,
        description: req.body.description,
        budget: req.body.budget ? parseFloat(req.body.budget) : null,
        isActive: req.body.isActive === 'true' || req.body.isActive === true,
        startDate: req.body.startDate ? new Date(req.body.startDate) : null,
        endDate: req.body.endDate ? new Date(req.body.endDate) : null,
      },
    });
    res.json(campaign);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE campaign
router.delete('/api/campaigns/:id', async (req, res) => {
  try {
    await db.campaign.delete({
      where: { id: req.params.id },
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET stats with platform breakdown
router.get('/api/stats', async (req, res) => {
  try {
    const [users, streamers, campaigns, conversations, liveStreamers, platformStats] = await Promise.all([
      db.user.count(),
      db.streamer.count(),
      db.campaign.count(),
      db.conversation.count(),
      db.streamer.count({ where: { isLive: true } }),
      db.streamer.groupBy({
        by: ['platform'],
        _count: true,
      }),
    ]);

    const platforms = platformStats.reduce((acc: any, p: any) => {
      acc[p.platform] = p._count;
      return acc;
    }, {});

    res.json({ users, streamers, campaigns, conversations, liveStreamers, platforms });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== HTML ADMIN PANEL ====================

router.get('/', async (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Envisioner Discovery Admin Panel - Full Database Management</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      line-height: 1.5;
      color: #e5e7eb;
    }

    .header {
      background: #000000;
      color: white;
      padding: 24px 40px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      position: sticky;
      top: 0;
      z-index: 100;
      border-bottom: 3px solid #ffffff;
    }
    .header h1 { font-size: 26px; margin-bottom: 6px; }
    .header p { opacity: 0.95; font-size: 14px; }

    .container { max-width: 1800px; margin: 0 auto; padding: 32px 40px; }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
    }
    .stat-card {
      background: #1a1a1a;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      border: 1px solid #2a2a2a;
      border-left: 4px solid #ffffff;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(255,255,255,0.1);
      border-left-color: #e5e7eb;
    }
    .stat-card h3 {
      font-size: 12px;
      color: #9ca3af;
      margin-bottom: 8px;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .stat-card .number { font-size: 32px; font-weight: bold; color: #ffffff; }
    .stat-card .label { font-size: 13px; color: #6b7280; margin-top: 4px; }

    .tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 24px;
      border-bottom: 2px solid #e5e7eb;
      overflow-x: auto;
    }
    .tab {
      padding: 14px 28px;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 15px;
      color: #6b7280;
      font-weight: 600;
      transition: all 0.2s;
      border-bottom: 3px solid transparent;
      margin-bottom: -2px;
      white-space: nowrap;
    }
    .tab:hover { color: #ffffff; background: #1a1a1a; }
    .tab.active { color: #ffffff; border-bottom-color: #ffffff; font-weight: 700; }

    .tab-content { display: none; animation: fadeIn 0.3s; }
    .tab-content.active { display: block; }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .toolbar {
      background: #1a1a1a;
      padding: 20px 24px;
      border-radius: 12px;
      margin-bottom: 20px;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      border: 1px solid #2a2a2a;
    }

    .toolbar-left {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      flex: 1;
      align-items: center;
    }

    .toolbar-right {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .search-box {
      padding: 10px 16px;
      border: 2px solid #2a2a2a;
      border-radius: 8px;
      font-size: 14px;
      min-width: 250px;
      transition: all 0.2s;
      background: #0a0a0a;
      color: #e5e7eb;
    }
    .search-box:focus {
      outline: none;
      border-color: #ffffff;
      box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
    }

    select {
      padding: 10px 16px;
      border: 2px solid #2a2a2a;
      border-radius: 8px;
      font-size: 14px;
      background: #0a0a0a;
      color: #e5e7eb;
      cursor: pointer;
      transition: all 0.2s;
    }
    select:focus {
      outline: none;
      border-color: #ffffff;
      box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
    }

    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .btn:hover { transform: translateY(-1px); box-shadow: 0 4px 8px rgba(0,0,0,0.15); }
    .btn:active { transform: translateY(0); }

    .btn-primary { background: #ffffff; color: #000000; font-weight: 600; }
    .btn-primary:hover { background: #e5e7eb; }

    .btn-danger { background: #dc2626; color: white; }
    .btn-danger:hover { background: #b91c1c; }

    .btn-secondary { background: #3a3a3a; color: #e5e7eb; }
    .btn-secondary:hover { background: #2a2a2a; }

    .btn-success { background: #ffffff; color: #000000; font-weight: 600; }
    .btn-success:hover { background: #f3f4f6; }

    .btn-sm { padding: 7px 14px; font-size: 13px; }

    .table-container {
      background: #1a1a1a;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      overflow: hidden;
      border: 1px solid #2a2a2a;
    }

    .table-wrapper {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 1000px;
    }
    th {
      background: #0a0a0a;
      padding: 16px;
      text-align: left;
      font-weight: 600;
      font-size: 13px;
      color: #9ca3af;
      border-bottom: 2px solid #2a2a2a;
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
    }
    th:hover { background: #1a1a1a; color: #ffffff; }
    th.sortable::after {
      content: ' ⇅';
      opacity: 0.3;
      font-size: 11px;
    }
    th.sorted-asc::after {
      content: ' ↑';
      opacity: 1;
    }
    th.sorted-desc::after {
      content: ' ↓';
      opacity: 1;
    }

    td {
      padding: 16px;
      border-bottom: 1px solid #2a2a2a;
      font-size: 14px;
      color: #e5e7eb;
    }
    tr:hover { background: #0a0a0a; }
    tr:last-child td { border-bottom: none; }

    .badge {
      display: inline-block;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
    }
    .badge.live { background: #ffffff; color: #000000; font-weight: 700; }
    .badge.offline { background: #3a3a3a; color: #9ca3af; }
    .badge.active { background: #ffffff; color: #000000; font-weight: 700; }
    .badge.inactive { background: #3a3a3a; color: #9ca3af; }

    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .pagination {
      display: flex;
      gap: 8px;
      justify-content: center;
      align-items: center;
      margin-top: 24px;
      flex-wrap: wrap;
    }

    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.9);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      animation: modalFadeIn 0.2s;
    }
    .modal.active { display: flex; }

    @keyframes modalFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .modal-content {
      background: #1a1a1a;
      border-radius: 16px;
      padding: 32px;
      max-width: 650px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,0.9);
      animation: modalSlideIn 0.3s;
      border: 1px solid #2a2a2a;
    }

    @keyframes modalSlideIn {
      from { transform: translateY(-50px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #f3f4f6;
    }
    .modal-header h2 { font-size: 22px; color: #ffffff; }
    .close-btn {
      background: none;
      border: none;
      font-size: 28px;
      cursor: pointer;
      color: #9ca3af;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      transition: all 0.2s;
    }
    .close-btn:hover { background: #f3f4f6; color: #1f2937; }

    .form-group {
      margin-bottom: 20px;
    }
    .form-group label {
      display: block;
      margin-bottom: 8px;
      font-weight: 600;
      font-size: 14px;
      color: #e5e7eb;
    }
    .form-group input,
    .form-group select,
    .form-group textarea {
      width: 100%;
      padding: 11px 14px;
      border: 2px solid #2a2a2a;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      transition: all 0.2s;
      background: #0a0a0a;
      color: #e5e7eb;
    }
    .form-group input:focus,
    .form-group select:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: #ffffff;
      box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
    }
    .form-group textarea {
      resize: vertical;
      min-height: 80px;
    }

    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .checkbox-group input[type="checkbox"] {
      width: auto;
      cursor: pointer;
    }

    .loading {
      text-align: center;
      padding: 60px 20px;
      color: #9ca3af;
      font-size: 15px;
    }

    .empty-state {
      text-align: center;
      padding: 80px 20px;
      color: #9ca3af;
    }
    .empty-state h3 {
      font-size: 20px;
      margin-bottom: 8px;
      color: #6b7280;
    }

    .info-text {
      color: #6b7280;
      font-size: 14px;
    }

    .tag {
      display: inline-block;
      background: #2a2a2a;
      color: #9ca3af;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      margin-right: 4px;
      margin-bottom: 2px;
      border: 1px solid #3a3a3a;
    }

    .bulk-actions {
      display: none;
      gap: 12px;
      align-items: center;
      padding: 12px 20px;
      background: #2a2a2a;
      border-radius: 8px;
      margin-bottom: 16px;
      border: 1px solid #3a3a3a;
    }
    .bulk-actions.active { display: flex; }

    @media (max-width: 768px) {
      .container { padding: 20px 16px; }
      .header { padding: 20px 16px; }
      .toolbar { flex-direction: column; align-items: stretch; }
      .toolbar-left, .toolbar-right { width: 100%; }
      .search-box { min-width: auto; width: 100%; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔍 Envisioner Discovery Admin Panel</h1>
    <p>Complete Database Management System - Full CRUD Operations</p>
  </div>

  <div class="container">
    <!-- Stats Dashboard -->
    <div class="stats" id="stats">
      <div class="stat-card">
        <h3>Total Users</h3>
        <div class="number" id="stat-users">-</div>
      </div>
      <div class="stat-card">
        <h3>Total Streamers</h3>
        <div class="number" id="stat-streamers">-</div>
      </div>
      <div class="stat-card">
        <h3>Live Now</h3>
        <div class="number" id="stat-live">-</div>
      </div>
      <div class="stat-card">
        <h3>Campaigns</h3>
        <div class="number" id="stat-campaigns">-</div>
      </div>
      <div class="stat-card">
        <h3>Conversations</h3>
        <div class="number" id="stat-conversations">-</div>
      </div>
    </div>

    <!-- Platform Stats -->
    <div class="stats" id="platform-stats" style="display: none;">
      <div class="stat-card">
        <h3>Twitch</h3>
        <div class="number" id="stat-twitch">0</div>
      </div>
      <div class="stat-card">
        <h3>YouTube</h3>
        <div class="number" id="stat-youtube">0</div>
      </div>
      <div class="stat-card">
        <h3>Kick</h3>
        <div class="number" id="stat-kick">0</div>
      </div>
      <div class="stat-card">
        <h3>Facebook</h3>
        <div class="number" id="stat-facebook">0</div>
      </div>
      <div class="stat-card">
        <h3>TikTok</h3>
        <div class="number" id="stat-tiktok">0</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button class="tab active" onclick="switchTab('streamers')">🎮 Streamers</button>
      <button class="tab" onclick="switchTab('users')">👥 Users</button>
      <button class="tab" onclick="switchTab('campaigns')">📢 Campaigns</button>
    </div>

    <!-- Streamers Tab -->
    <div id="streamers-tab" class="tab-content active">
      <div class="toolbar">
        <div class="toolbar-left">
          <input type="text" class="search-box" id="search-box" placeholder="🔍 Search by username or display name..." onkeyup="handleSearch()">

          <select id="platform-filter" onchange="applyFilters()">
            <option value="ALL">All Platforms</option>
            <option value="TWITCH">Twitch</option>
            <option value="YOUTUBE">YouTube</option>
            <option value="KICK">Kick</option>
            <option value="FACEBOOK">Facebook</option>
            <option value="TIKTOK">TikTok</option>
          </select>

          <select id="region-filter" onchange="applyFilters()">
            <option value="ALL">All Regions</option>
            <option value="LATAM">LATAM</option>
            <option value="BRAZIL">Brazil</option>
            <option value="MEXICO">Mexico</option>
            <option value="ARGENTINA">Argentina</option>
            <option value="CHILE">Chile</option>
            <option value="COLOMBIA">Colombia</option>
            <option value="NA">North America</option>
            <option value="EU">Europe</option>
            <option value="ASIA">Asia</option>
            <option value="OTHER">Other</option>
          </select>

          <select id="live-filter" onchange="applyFilters()">
            <option value="ALL">All Status</option>
            <option value="true">Live Only</option>
            <option value="false">Offline Only</option>
          </select>
        </div>

        <div class="toolbar-right">
          <button class="btn btn-success" onclick="openCreateStreamer()">+ Add Streamer</button>
          <button class="btn btn-danger" onclick="bulkDelete()" id="bulk-delete-btn" style="display:none;">Delete Selected</button>
        </div>
      </div>

      <div class="bulk-actions" id="bulk-actions">
        <input type="checkbox" id="select-all" onchange="toggleSelectAll()">
        <span id="selected-count">0 selected</span>
        <button class="btn btn-danger btn-sm" onclick="bulkDelete()">Delete Selected</button>
        <button class="btn btn-secondary btn-sm" onclick="clearSelection()">Clear</button>
      </div>

      <div class="info-text" style="margin-bottom: 12px; padding-left: 4px;">
        <span id="streamer-count"></span>
      </div>

      <div class="table-container">
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th><input type="checkbox" id="select-all-2" onchange="toggleSelectAll()"></th>
                <th class="sortable" onclick="sortTable('platform')">Platform</th>
                <th class="sortable" onclick="sortTable('username')">Username</th>
                <th class="sortable" onclick="sortTable('displayName')">Display Name</th>
                <th class="sortable" onclick="sortTable('followers')">Followers</th>
                <th>Status</th>
                <th class="sortable" onclick="sortTable('region')">Region</th>
                <th>Tags</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="streamers-tbody">
              <tr><td colspan="9" class="loading">Loading streamers...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="pagination" id="streamers-pagination"></div>
    </div>

    <!-- Users Tab -->
    <div id="users-tab" class="tab-content">
      <div class="toolbar">
        <div class="toolbar-left">
          <div class="info-text">Manage user accounts</div>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-success" onclick="openCreateUser()">+ Add User</button>
        </div>
      </div>

      <div class="table-container">
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>MFA</th>
                <th>Last Login</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="users-tbody">
              <tr><td colspan="6" class="loading">Loading users...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Campaigns Tab -->
    <div id="campaigns-tab" class="tab-content">
      <div class="toolbar">
        <div class="toolbar-left">
          <div class="info-text">Manage marketing campaigns</div>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-success" onclick="openCreateCampaign()">+ Add Campaign</button>
        </div>
      </div>

      <div class="table-container">
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Budget</th>
                <th>Status</th>
                <th>Streamers</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="campaigns-tbody">
              <tr><td colspan="8" class="loading">Loading campaigns...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- Streamer Modal -->
  <div id="streamer-modal" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="streamer-modal-title">Add New Streamer</h2>
        <button class="close-btn" onclick="closeModal('streamer')">&times;</button>
      </div>
      <form id="streamer-form" onsubmit="saveStreamer(event)">
        <input type="hidden" id="streamer-id">

        <div class="form-group">
          <label>Platform *</label>
          <select id="platform" required>
            <option value="TWITCH">Twitch</option>
            <option value="YOUTUBE">YouTube</option>
            <option value="KICK">Kick</option>
            <option value="FACEBOOK">Facebook</option>
            <option value="TIKTOK">TikTok</option>
          </select>
        </div>

        <div class="form-group">
          <label>Username *</label>
          <input type="text" id="username" required placeholder="Enter username">
        </div>

        <div class="form-group">
          <label>Display Name *</label>
          <input type="text" id="displayName" required placeholder="Enter display name">
        </div>

        <div class="form-group">
          <label>Profile URL *</label>
          <input type="url" id="profileUrl" required placeholder="https://...">
        </div>

        <div class="form-group">
          <label>Avatar URL</label>
          <input type="url" id="avatarUrl" placeholder="https://...">
        </div>

        <div class="form-group">
          <label>Followers</label>
          <input type="number" id="followers" value="0" min="0">
        </div>

        <div class="form-group">
          <label>Region *</label>
          <select id="region" required>
            <option value="LATAM">LATAM</option>
            <option value="BRAZIL">Brazil</option>
            <option value="MEXICO">Mexico</option>
            <option value="ARGENTINA">Argentina</option>
            <option value="CHILE">Chile</option>
            <option value="COLOMBIA">Colombia</option>
            <option value="NA">North America</option>
            <option value="EU">Europe</option>
            <option value="ASIA">Asia</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div class="form-group">
          <label>Language</label>
          <input type="text" id="language" value="es" placeholder="es, en, pt, etc.">
        </div>

        <div class="form-group">
          <label>Tags (comma-separated)</label>
          <input type="text" id="tags" placeholder="gaming, fps, spanish">
        </div>

        <div class="form-group checkbox-group">
          <input type="checkbox" id="isLive">
          <label for="isLive" style="margin: 0;">Currently Live</label>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 28px;">
          <button type="button" class="btn btn-secondary" onclick="closeModal('streamer')">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Streamer</button>
        </div>
      </form>
    </div>
  </div>

  <!-- User Modal -->
  <div id="user-modal" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h2>Add New User</h2>
        <button class="close-btn" onclick="closeModal('user')">&times;</button>
      </div>
      <form id="user-form" onsubmit="saveUser(event)">
        <div class="form-group">
          <label>Email *</label>
          <input type="email" id="user-email" required placeholder="user@example.com">
        </div>

        <div class="form-group">
          <label>Password *</label>
          <input type="password" id="user-password" required placeholder="Enter password" minlength="6">
        </div>

        <div class="form-group">
          <label>First Name</label>
          <input type="text" id="user-firstName" placeholder="First name">
        </div>

        <div class="form-group">
          <label>Last Name</label>
          <input type="text" id="user-lastName" placeholder="Last name">
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 28px;">
          <button type="button" class="btn btn-secondary" onclick="closeModal('user')">Cancel</button>
          <button type="submit" class="btn btn-primary">Create User</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Campaign Modal -->
  <div id="campaign-modal" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="campaign-modal-title">Add New Campaign</h2>
        <button class="close-btn" onclick="closeModal('campaign')">&times;</button>
      </div>
      <form id="campaign-form" onsubmit="saveCampaign(event)">
        <input type="hidden" id="campaign-id">

        <div class="form-group">
          <label>Campaign Name *</label>
          <input type="text" id="campaign-name" required placeholder="Enter campaign name">
        </div>

        <div class="form-group">
          <label>Description *</label>
          <textarea id="campaign-description" required placeholder="Describe the campaign..."></textarea>
        </div>

        <div class="form-group">
          <label>Budget</label>
          <input type="number" id="campaign-budget" step="0.01" min="0" placeholder="0.00">
        </div>

        <div class="form-group">
          <label>Start Date</label>
          <input type="date" id="campaign-startDate">
        </div>

        <div class="form-group">
          <label>End Date</label>
          <input type="date" id="campaign-endDate">
        </div>

        <div class="form-group checkbox-group">
          <input type="checkbox" id="campaign-isActive" checked>
          <label for="campaign-isActive" style="margin: 0;">Active Campaign</label>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 28px;">
          <button type="button" class="btn btn-secondary" onclick="closeModal('campaign')">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Campaign</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    let currentPage = 1;
    let currentFilters = {
      search: '',
      platform: 'ALL',
      region: 'ALL',
      isLive: 'ALL'
    };
    let currentSort = { field: 'createdAt', order: 'desc' };
    let selectedStreamers = new Set();

    // ==================== LOAD DATA ====================

    async function loadStats() {
      try {
        const res = await fetch('/admin-panel/api/stats');
        const stats = await res.json();

        document.getElementById('stat-users').textContent = stats.users;
        document.getElementById('stat-streamers').textContent = stats.streamers;
        document.getElementById('stat-live').textContent = stats.liveStreamers;
        document.getElementById('stat-campaigns').textContent = stats.campaigns;
        document.getElementById('stat-conversations').textContent = stats.conversations;

        // Platform stats
        if (stats.platforms) {
          document.getElementById('platform-stats').style.display = 'grid';
          document.getElementById('stat-twitch').textContent = stats.platforms.TWITCH || 0;
          document.getElementById('stat-youtube').textContent = stats.platforms.YOUTUBE || 0;
          document.getElementById('stat-kick').textContent = stats.platforms.KICK || 0;
          document.getElementById('stat-facebook').textContent = stats.platforms.FACEBOOK || 0;
          document.getElementById('stat-tiktok').textContent = stats.platforms.TIKTOK || 0;
        }
      } catch (error) {
        console.error('Failed to load stats:', error);
      }
    }

    async function loadStreamers(page = 1) {
      try {
        currentPage = page;
        const params = new URLSearchParams({
          page: page,
          limit: 50,
          sortBy: currentSort.field,
          sortOrder: currentSort.order,
          ...currentFilters
        });

        const res = await fetch(\`/admin-panel/api/streamers?\${params}\`);
        const data = await res.json();

        const tbody = document.getElementById('streamers-tbody');

        if (data.streamers.length === 0) {
          tbody.innerHTML = '<tr><td colspan="9" class="empty-state"><h3>No streamers found</h3><p>Try adjusting your filters</p></td></tr>';
        } else {
          tbody.innerHTML = data.streamers.map(s => \`
            <tr>
              <td><input type="checkbox" class="streamer-checkbox" value="\${s.id}" onchange="updateSelection()"></td>
              <td><strong>\${s.platform}</strong></td>
              <td>\${s.username}</td>
              <td>\${s.displayName}</td>
              <td>\${s.followers.toLocaleString()}</td>
              <td><span class="badge \${s.isLive ? 'live' : 'offline'}">\${s.isLive ? '🔴 LIVE' : 'Offline'}</span></td>
              <td>\${s.region}</td>
              <td>\${s.tags.slice(0, 2).map(tag => \`<span class="tag">\${tag}</span>\`).join('')}</td>
              <td>
                <div class="actions">
                  <button class="btn btn-primary btn-sm" onclick='editStreamer(\${JSON.stringify(s).replace(/'/g, "&#39;")})'>Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteStreamer('\${s.id}', '\${s.username}')">Delete</button>
                </div>
              </td>
            </tr>
          \`).join('');
        }

        document.getElementById('streamer-count').textContent = \`Showing \${data.streamers.length} of \${data.total} streamers\`;

        // Pagination
        renderPagination(data.page, data.totalPages);
      } catch (error) {
        console.error('Failed to load streamers:', error);
        document.getElementById('streamers-tbody').innerHTML = '<tr><td colspan="9" class="loading">Error loading streamers</td></tr>';
      }
    }

    function renderPagination(currentPage, totalPages) {
      const pagination = document.getElementById('streamers-pagination');
      pagination.innerHTML = '';

      if (totalPages <= 1) return;

      // Previous button
      if (currentPage > 1) {
        const prev = document.createElement('button');
        prev.className = 'btn btn-secondary btn-sm';
        prev.textContent = '← Previous';
        prev.onclick = () => loadStreamers(currentPage - 1);
        pagination.appendChild(prev);
      }

      // Page numbers (show first, current-2, current-1, current, current+1, current+2, last)
      const pagesToShow = [];

      pagesToShow.push(1);

      for (let i = Math.max(2, currentPage - 2); i <= Math.min(totalPages - 1, currentPage + 2); i++) {
        if (!pagesToShow.includes(i)) pagesToShow.push(i);
      }

      if (totalPages > 1 && !pagesToShow.includes(totalPages)) {
        pagesToShow.push(totalPages);
      }

      let lastPage = 0;
      pagesToShow.forEach(page => {
        if (page - lastPage > 1) {
          const dots = document.createElement('span');
          dots.textContent = '...';
          dots.style.padding = '0 8px';
          pagination.appendChild(dots);
        }

        const btn = document.createElement('button');
        btn.className = 'btn btn-sm ' + (page === currentPage ? 'btn-primary' : 'btn-secondary');
        btn.textContent = page;
        btn.onclick = () => loadStreamers(page);
        pagination.appendChild(btn);

        lastPage = page;
      });

      // Next button
      if (currentPage < totalPages) {
        const next = document.createElement('button');
        next.className = 'btn btn-secondary btn-sm';
        next.textContent = 'Next →';
        next.onclick = () => loadStreamers(currentPage + 1);
        pagination.appendChild(next);
      }
    }

    async function loadUsers() {
      try {
        const res = await fetch('/admin-panel/api/users');
        const users = await res.json();

        const tbody = document.getElementById('users-tbody');

        if (users.length === 0) {
          tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><h3>No users found</h3></td></tr>';
        } else {
          tbody.innerHTML = users.map(u => \`
            <tr>
              <td>\${u.email}</td>
              <td>\${u.firstName || ''} \${u.lastName || ''}</td>
              <td>\${u.mfaEnabled ? '✅ Enabled' : '❌ Disabled'}</td>
              <td>\${u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never'}</td>
              <td>\${new Date(u.createdAt).toLocaleDateString()}</td>
              <td>
                <div class="actions">
                  <button class="btn btn-danger btn-sm" onclick="deleteUser('\${u.id}', '\${u.email}')">Delete</button>
                </div>
              </td>
            </tr>
          \`).join('');
        }
      } catch (error) {
        console.error('Failed to load users:', error);
        document.getElementById('users-tbody').innerHTML = '<tr><td colspan="6" class="loading">Error loading users</td></tr>';
      }
    }

    async function loadCampaigns() {
      try {
        const res = await fetch('/admin-panel/api/campaigns');
        const campaigns = await res.json();

        const tbody = document.getElementById('campaigns-tbody');

        if (campaigns.length === 0) {
          tbody.innerHTML = '<tr><td colspan="8" class="empty-state"><h3>No campaigns found</h3></td></tr>';
        } else {
          tbody.innerHTML = campaigns.map(c => \`
            <tr>
              <td><strong>\${c.name}</strong></td>
              <td>\${c.description}</td>
              <td>\${c.budget ? '$' + c.budget.toLocaleString() : 'N/A'}</td>
              <td><span class="badge \${c.isActive ? 'active' : 'inactive'}">\${c.isActive ? 'Active' : 'Inactive'}</span></td>
              <td>\${c._count.assignedStreamers} streamers</td>
              <td>\${c.startDate ? new Date(c.startDate).toLocaleDateString() : 'N/A'}</td>
              <td>\${c.endDate ? new Date(c.endDate).toLocaleDateString() : 'N/A'}</td>
              <td>
                <div class="actions">
                  <button class="btn btn-primary btn-sm" onclick='editCampaign(\${JSON.stringify(c).replace(/'/g, "&#39;")})'>Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteCampaign('\${c.id}', '\${c.name}')">Delete</button>
                </div>
              </td>
            </tr>
          \`).join('');
        }
      } catch (error) {
        console.error('Failed to load campaigns:', error);
        document.getElementById('campaigns-tbody').innerHTML = '<tr><td colspan="8" class="loading">Error loading campaigns</td></tr>';
      }
    }

    // ==================== FILTERS & SEARCH ====================

    let searchTimeout;
    function handleSearch() {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentFilters.search = document.getElementById('search-box').value;
        loadStreamers(1);
      }, 500);
    }

    function applyFilters() {
      currentFilters.platform = document.getElementById('platform-filter').value;
      currentFilters.region = document.getElementById('region-filter').value;
      currentFilters.isLive = document.getElementById('live-filter').value;
      loadStreamers(1);
    }

    function sortTable(field) {
      if (currentSort.field === field) {
        currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort.field = field;
        currentSort.order = 'asc';
      }

      // Update UI
      document.querySelectorAll('th').forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
      });
      event.target.classList.add(\`sorted-\${currentSort.order}\`);

      loadStreamers(currentPage);
    }

    // ==================== SELECTION & BULK OPERATIONS ====================

    function updateSelection() {
      const checkboxes = document.querySelectorAll('.streamer-checkbox');
      selectedStreamers.clear();

      checkboxes.forEach(cb => {
        if (cb.checked) selectedStreamers.add(cb.value);
      });

      const count = selectedStreamers.size;
      document.getElementById('selected-count').textContent = \`\${count} selected\`;
      document.getElementById('bulk-actions').classList.toggle('active', count > 0);

      document.getElementById('select-all').checked = count > 0 && count === checkboxes.length;
      document.getElementById('select-all-2').checked = count > 0 && count === checkboxes.length;
    }

    function toggleSelectAll() {
      const checked = event.target.checked;
      document.querySelectorAll('.streamer-checkbox').forEach(cb => cb.checked = checked);
      document.getElementById('select-all').checked = checked;
      document.getElementById('select-all-2').checked = checked;
      updateSelection();
    }

    function clearSelection() {
      document.querySelectorAll('.streamer-checkbox').forEach(cb => cb.checked = false);
      document.getElementById('select-all').checked = false;
      document.getElementById('select-all-2').checked = false;
      updateSelection();
    }

    async function bulkDelete() {
      if (selectedStreamers.size === 0) return;

      if (!confirm(\`Delete \${selectedStreamers.size} streamers? This cannot be undone.\`)) return;

      try {
        const res = await fetch('/admin-panel/api/streamers/bulk-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: Array.from(selectedStreamers) }),
        });

        if (res.ok) {
          clearSelection();
          loadStreamers(currentPage);
          loadStats();
          alert(\`Successfully deleted \${selectedStreamers.size} streamers!\`);
        } else {
          const error = await res.json();
          alert('Error: ' + error.error);
        }
      } catch (error) {
        alert('Error: ' + error.message);
      }
    }

    // ==================== TAB SWITCHING ====================

    function switchTab(tab) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      event.target.classList.add('active');
      document.getElementById(tab + '-tab').classList.add('active');

      if (tab === 'streamers') loadStreamers(currentPage);
      if (tab === 'users') loadUsers();
      if (tab === 'campaigns') loadCampaigns();
    }

    // ==================== MODALS ====================

    function closeModal(type) {
      document.getElementById(type + '-modal').classList.remove('active');
    }

    function openCreateStreamer() {
      document.getElementById('streamer-modal-title').textContent = 'Add New Streamer';
      document.getElementById('streamer-form').reset();
      document.getElementById('streamer-id').value = '';
      document.getElementById('streamer-modal').classList.add('active');
    }

    function editStreamer(streamer) {
      document.getElementById('streamer-modal-title').textContent = 'Edit Streamer';
      document.getElementById('streamer-id').value = streamer.id;
      document.getElementById('platform').value = streamer.platform;
      document.getElementById('username').value = streamer.username;
      document.getElementById('displayName').value = streamer.displayName;
      document.getElementById('profileUrl').value = streamer.profileUrl;
      document.getElementById('avatarUrl').value = streamer.avatarUrl || '';
      document.getElementById('followers').value = streamer.followers;
      document.getElementById('region').value = streamer.region;
      document.getElementById('language').value = streamer.language;
      document.getElementById('tags').value = streamer.tags.join(', ');
      document.getElementById('isLive').checked = streamer.isLive;
      document.getElementById('streamer-modal').classList.add('active');
    }

    async function saveStreamer(e) {
      e.preventDefault();

      const id = document.getElementById('streamer-id').value;
      const data = {
        platform: document.getElementById('platform').value,
        username: document.getElementById('username').value,
        displayName: document.getElementById('displayName').value,
        profileUrl: document.getElementById('profileUrl').value,
        avatarUrl: document.getElementById('avatarUrl').value,
        followers: document.getElementById('followers').value,
        region: document.getElementById('region').value,
        language: document.getElementById('language').value,
        tags: document.getElementById('tags').value,
        isLive: document.getElementById('isLive').checked,
      };

      try {
        const url = id ? \`/admin-panel/api/streamers/\${id}\` : '/admin-panel/api/streamers';
        const method = id ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (res.ok) {
          closeModal('streamer');
          loadStreamers(currentPage);
          loadStats();
          alert(id ? 'Streamer updated successfully!' : 'Streamer created successfully!');
        } else {
          const error = await res.json();
          alert('Error: ' + error.error);
        }
      } catch (error) {
        alert('Error: ' + error.message);
      }
    }

    async function deleteStreamer(id, username) {
      if (!confirm(\`Delete streamer "\${username}"? This cannot be undone.\`)) return;

      try {
        const res = await fetch(\`/admin-panel/api/streamers/\${id}\`, { method: 'DELETE' });
        if (res.ok) {
          loadStreamers(currentPage);
          loadStats();
          alert('Streamer deleted successfully!');
        }
      } catch (error) {
        alert('Error: ' + error.message);
      }
    }

    // ==================== USER CRUD ====================

    function openCreateUser() {
      document.getElementById('user-form').reset();
      document.getElementById('user-modal').classList.add('active');
    }

    async function saveUser(e) {
      e.preventDefault();

      const data = {
        email: document.getElementById('user-email').value,
        password: document.getElementById('user-password').value,
        firstName: document.getElementById('user-firstName').value,
        lastName: document.getElementById('user-lastName').value,
      };

      try {
        const res = await fetch('/admin-panel/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (res.ok) {
          closeModal('user');
          loadUsers();
          loadStats();
          alert('User created successfully!');
        } else {
          const error = await res.json();
          alert('Error: ' + error.error);
        }
      } catch (error) {
        alert('Error: ' + error.message);
      }
    }

    async function deleteUser(id, email) {
      if (!confirm(\`Delete user "\${email}"? This cannot be undone.\`)) return;

      try {
        const res = await fetch(\`/admin-panel/api/users/\${id}\`, { method: 'DELETE' });
        if (res.ok) {
          loadUsers();
          loadStats();
          alert('User deleted successfully!');
        }
      } catch (error) {
        alert('Error: ' + error.message);
      }
    }

    // ==================== CAMPAIGN CRUD ====================

    function openCreateCampaign() {
      document.getElementById('campaign-modal-title').textContent = 'Add New Campaign';
      document.getElementById('campaign-form').reset();
      document.getElementById('campaign-id').value = '';
      document.getElementById('campaign-isActive').checked = true;
      document.getElementById('campaign-modal').classList.add('active');
    }

    function editCampaign(campaign) {
      document.getElementById('campaign-modal-title').textContent = 'Edit Campaign';
      document.getElementById('campaign-id').value = campaign.id;
      document.getElementById('campaign-name').value = campaign.name;
      document.getElementById('campaign-description').value = campaign.description;
      document.getElementById('campaign-budget').value = campaign.budget || '';
      document.getElementById('campaign-startDate').value = campaign.startDate ? campaign.startDate.split('T')[0] : '';
      document.getElementById('campaign-endDate').value = campaign.endDate ? campaign.endDate.split('T')[0] : '';
      document.getElementById('campaign-isActive').checked = campaign.isActive;
      document.getElementById('campaign-modal').classList.add('active');
    }

    async function saveCampaign(e) {
      e.preventDefault();

      const id = document.getElementById('campaign-id').value;
      const data = {
        name: document.getElementById('campaign-name').value,
        description: document.getElementById('campaign-description').value,
        budget: document.getElementById('campaign-budget').value,
        startDate: document.getElementById('campaign-startDate').value,
        endDate: document.getElementById('campaign-endDate').value,
        isActive: document.getElementById('campaign-isActive').checked,
      };

      try {
        const url = id ? \`/admin-panel/api/campaigns/\${id}\` : '/admin-panel/api/campaigns';
        const method = id ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (res.ok) {
          closeModal('campaign');
          loadCampaigns();
          loadStats();
          alert(id ? 'Campaign updated successfully!' : 'Campaign created successfully!');
        } else {
          const error = await res.json();
          alert('Error: ' + error.error);
        }
      } catch (error) {
        alert('Error: ' + error.message);
      }
    }

    async function deleteCampaign(id, name) {
      if (!confirm(\`Delete campaign "\${name}"? This cannot be undone.\`)) return;

      try {
        const res = await fetch(\`/admin-panel/api/campaigns/\${id}\`, { method: 'DELETE' });
        if (res.ok) {
          loadCampaigns();
          loadStats();
          alert('Campaign deleted successfully!');
        }
      } catch (error) {
        alert('Error: ' + error.message);
      }
    }

    // ==================== INITIALIZE ====================

    loadStats();
    loadStreamers(1);

    // Close modals on outside click
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    });
  </script>
</body>
</html>
  `;

  res.send(html);
});

// ==================== AUDIT LOG API ====================

// GET audit logs with filtering
router.get('/api/audit', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;
    const tableName = req.query.table as string;
    const changedBy = req.query.actor as string;
    const action = req.query.action as string;
    const recordId = req.query.recordId as string;

    const where: any = {};
    if (tableName) where.tableName = tableName;
    if (changedBy) where.changedBy = { contains: changedBy, mode: 'insensitive' };
    if (action) where.action = action;
    if (recordId) where.recordId = recordId;

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { changedAt: 'desc' },
        take: limit,
        skip,
      }),
      db.auditLog.count({ where })
    ]);

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET audit stats summary
router.get('/api/audit/stats', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const logs = await db.auditLog.findMany({
      where: { changedAt: { gte: since } },
      select: { changedBy: true, action: true, tableName: true }
    });

    const byActor: Record<string, number> = {};
    const byAction: Record<string, number> = {};
    const byTable: Record<string, number> = {};

    for (const log of logs) {
      const actor = log.changedBy || 'UNKNOWN';
      byActor[actor] = (byActor[actor] || 0) + 1;
      byAction[log.action] = (byAction[log.action] || 0) + 1;
      byTable[log.tableName] = (byTable[log.tableName] || 0) + 1;
    }

    res.json({
      totalChanges: logs.length,
      days,
      byActor,
      byAction,
      byTable
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET audit history for a specific creator
router.get('/api/audit/creator/:id', async (req, res) => {
  try {
    const logs = await db.auditLog.findMany({
      where: {
        tableName: 'discovery_creators',
        recordId: req.params.id
      },
      orderBy: { changedAt: 'desc' },
      take: 100
    });

    res.json({ logs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export const adminPanelRoutes = router;
