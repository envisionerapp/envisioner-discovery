import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Load environment variables
// Prefer backend/.env, but fall back to repo root .env if not present
const backendEnv = path.resolve(__dirname, '..', '.env');
const rootEnv = path.resolve(__dirname, '..', '..', '.env');
if (fs.existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv });
} else if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else {
  dotenv.config();
}

import { logger } from './utils/database';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authRoutes } from './routes/auth';
import { streamerRoutes } from './routes/streamers';
import { campaignRoutes } from './routes/campaigns';
import { seedFromCsvIfEmpty } from './utils/seedFromCsv';
import { db } from './utils/database';
import { dedupeStreamersByDisplayName } from './utils/dedupeStreamers';
import { normalizeUsernamesAndDedupe } from './utils/normalizeUsernamesAndDedupe';
import { csvSyncStrict } from './utils/csvSyncStrict';
import { chatRoutes } from './routes/chat';
import { adminRoutes } from './routes/admin';
import enrichmentRoutes from './routes/enrichmentRoutes';
import { dbViewerRoutes } from './routes/dbviewer';
import { adminPanelRoutes } from './routes/adminPanel';
import { bootstrapAdminUser } from './utils/bootstrapAdmin';
import { backfillAvatars } from './utils/avatarBackfill';
import { syncAvatarsFromLocal } from './utils/syncAvatarsFromLocal';
import { SocketService } from './services/socketService';
import { liveStatusService } from './services/liveStatusService';
import { twitchSyncJob } from './jobs/twitchSync';
import { kickSyncJob } from './jobs/kickSync';
import { performanceSyncRoutes } from './routes/performanceSync';
import { discoveryRoutes } from './routes/discovery';
import { favoritesRoutes } from './routes/favorites';
import { discardsRoutes } from './routes/discards';
import { notesRoutes } from './routes/notes';
import { accessRoutes } from './routes/access';

// Define allowed origins before creating server/socket
const allowedOrigins = new Set([
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5173',
  'https://envisioner-discovery.vercel.app',
  'https://envisioner-discovery-frontend.vercel.app',
  'https://discovery.envisioner.io',
  'https://envisioner-app.onrender.com',
  'https://envisioner-discovery.onrender.com',
  process.env.SOFTR_DOMAIN || '',
]);

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Same CORS logic as Express
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);

      // Allow Softr subdomains
      if (origin && (origin.endsWith('.softr.app') || origin.endsWith('.softr.io'))) {
        return callback(null, true);
      }

      if (/^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
      return callback(new Error(`CORS not allowed for origin: ${origin}`), false);
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const PORT = process.env.PORT || 5000;

// Force reseed on deploy - timestamp: 2026-01-09T06:25

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'"],
    },
  },
}));

// Enable gzip compression for faster API responses
app.use(compression());

// CORS: allowedOrigins already defined above for Socket.IO
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests or same-origin
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin)) return callback(null, true);

    // Allow Softr subdomains
    if (origin && (origin.endsWith('.softr.app') || origin.endsWith('.softr.io'))) {
      return callback(null, true);
    }

    if (/^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
    return callback(new Error(`CORS not allowed for origin: ${origin}`), false);
  },
  credentials: true,
}));

app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', async (req, res) => {
  const fs = await import('fs');
  const path = await import('path');

  // Check CSV location
  const csvPath = path.resolve(__dirname, '..', 'csv', 'combined.csv');
  const csvExists = fs.existsSync(csvPath);
  let csvLines = 0;
  if (csvExists) {
    try {
      const content = fs.readFileSync(csvPath, 'utf8');
      csvLines = content.split('\n').length;
    } catch (e) {}
  }

  // Check DB count
  let dbCount = 0;
  try {
    dbCount = await db.streamer.count();
  } catch (e) {}

  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    debug: {
      csvPath,
      csvExists,
      csvLines,
      dbStreamerCount: dbCount,
      dirname: __dirname,
    }
  });
});

// Friendly root response for API domain
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'Envisioner Discovery API',
    docs: '/api',
    health: '/health'
  });
});

// Manual seed trigger (temporary)
app.post('/seed-now', async (req, res) => {
  try {
    const { seedFromCsvIfEmpty } = await import('./utils/seedFromCsv');
    logger.info('🌱 Manual seed triggered via /seed-now endpoint');
    const result = await seedFromCsvIfEmpty();
    logger.info(`🌱 Manual seed result: ${JSON.stringify(result)}`);
    res.json({ success: true, result });
  } catch (error: any) {
    logger.error('🌱 Manual seed error:', { message: error?.message, stack: error?.stack });
    res.status(500).json({ success: false, error: error?.message });
  }
});

// Manual live status sync trigger (temporary)
app.post('/sync-live', async (req, res) => {
  try {
    logger.info('🔴 Manual live status sync triggered');
    const result = await liveStatusService.updateStreamersLiveStatus(500, 100);
    logger.info(`🔴 Live status sync result: ${JSON.stringify(result)}`);
    res.json({ success: true, result });
  } catch (error: any) {
    logger.error('🔴 Live status sync error:', { message: error?.message, stack: error?.stack });
    res.status(500).json({ success: false, error: error?.message });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/streamers', streamerRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/enrichment', enrichmentRoutes);
app.use('/api/performance-sync', performanceSyncRoutes);
app.use('/api/discovery', discoveryRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/discards', discardsRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/access', accessRoutes);
app.use('/dbviewer', dbViewerRoutes);
app.use('/admin-panel', adminPanelRoutes);

// Socket.IO setup with SocketService
export const socketService = new SocketService(io);
socketService.initialize();

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Live status update scheduler
let liveStatusInterval: NodeJS.Timeout | null = null;

async function startLiveStatusUpdates() {
  // Update immediately on startup
  logger.info('🔴 Starting initial live status update...');
  try {
    const result = await liveStatusService.updateStreamersLiveStatus(1000, 200); // 200 concurrent checks
    logger.info(`✅ Initial live status update complete: ${result.totalChecked} checked, ${result.liveCount} live`);

    // Broadcast to all connected clients
    socketService.broadcastToAll('live:status_updated', {
      timestamp: new Date().toISOString(),
      stats: result
    });
  } catch (error: any) {
    logger.error('❌ Initial live status update failed:', { message: error?.message, stack: error?.stack });
  }

  // Schedule updates every 2 minutes
  liveStatusInterval = setInterval(async () => {
    logger.info('🔴 Running scheduled live status update...');
    try {
      const result = await liveStatusService.updateStreamersLiveStatus(1000, 200); // 200 concurrent checks
      logger.info(`✅ Scheduled live status update complete: ${result.totalChecked} checked, ${result.liveCount} live`);

      // Broadcast to all connected clients
      socketService.broadcastToAll('live:status_updated', {
        timestamp: new Date().toISOString(),
        stats: result
      });
    } catch (error: any) {
      logger.error('❌ Scheduled live status update failed:', { message: error?.message, stack: error?.stack });
    }
  }, 2 * 60 * 1000); // 2 minutes

  logger.info('⏰ Live status scheduler started (updates every 2 minutes)');
}

// Start server
server.listen(PORT, () => {
  logger.info(`🚀 Envisioner Discovery server running on port ${PORT}`);
  logger.info(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);

  if (process.env.NODE_ENV === 'development') {
    logger.info(`🧪 Health check: http://localhost:${PORT}/health`);
  }

  // Start live status updates (cron job also runs for redundancy)
  //startLiveStatusUpdates();
  // Optional startup data tasks (can be disabled in Render via env)
  const enableStartupTasks = (process.env.ENABLE_STARTUP_DATA_TASKS || 'true').toLowerCase() === 'true';
  logger.info(`🔧 STARTUP: ENABLE_STARTUP_DATA_TASKS=${enableStartupTasks}`);

  if (enableStartupTasks) {
    // Fire-and-forget auto-seed from CSV if DB is empty
    seedFromCsvIfEmpty().catch((e) => logger.error('Auto-seed failed at startup', { e }));

    // Clean placeholders, normalize/dedupe, sync CSV, and backfill avatars
    (async () => {
      try {
        logger.info('🔧 STARTUP: Starting data cleanup and avatar backfill tasks');

        const targets = ['reborn','mexican fps pro','test mexican gamer'];
        const res = await db.streamer.deleteMany({
          where: {
            OR: targets.flatMap((t) => ([
              { username: t.trim().toLowerCase() },
              { displayName: { equals: t, mode: 'insensitive' } },
            ])),
          },
        });
        if (res.count > 0) {
          logger.info(`🧹 STARTUP: Pruned ${res.count} placeholder streamers`);
        }

        await normalizeUsernamesAndDedupe();
        await csvSyncStrict();
        await dedupeStreamersByDisplayName();

        logger.info('🔧 STARTUP: Starting avatar sync from local database');
        const syncResult = await syncAvatarsFromLocal();
        logger.info(`🔧 STARTUP: Avatar sync result: ${JSON.stringify(syncResult)}`);

        logger.info('🔧 STARTUP: Starting avatar backfill process');
        const avatarResult = await backfillAvatars(500); // Backfill up to 500 missing avatars
        logger.info(`🔧 STARTUP: Avatar backfill result: ${JSON.stringify(avatarResult)}`);

      } catch (e) {
        logger.error('🔧 STARTUP: Data tasks encountered an error', { e });
      }
    })();
  } else {
    logger.info('🔧 STARTUP: Data tasks disabled via ENABLE_STARTUP_DATA_TASKS=false');
  }

  logger.info('📅 Starting cron jobs...');
    // Start cron jobs
  twitchSyncJob.start();
  kickSyncJob.start();
  
  logger.info('✅ Twitch sync: every 3 minutes');
  logger.info('✅ Kick sync: every 3 minutes');
  
});

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Starting graceful shutdown...');
  if (liveStatusInterval) {
    clearInterval(liveStatusInterval);
    logger.info('Live status scheduler stopped.');
  }
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received. Starting graceful shutdown...');
  if (liveStatusInterval) {
    clearInterval(liveStatusInterval);
    logger.info('Live status scheduler stopped.');
  }
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
});
  // Ensure admin user exists if configured
  bootstrapAdminUser();

 
