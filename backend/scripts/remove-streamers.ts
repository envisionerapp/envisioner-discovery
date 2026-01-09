import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { db, logger } from '../src/utils/database';

// Load env from backend/.env or root .env
const backendEnv = path.resolve(__dirname, '..', '.env');
const rootEnv = path.resolve(__dirname, '..', '..', '.env');
if (fs.existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv });
} else if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else {
  dotenv.config();
}

async function run() {
  const targets = [
    'reborn',
    'mexican fps pro',
    'test mexican gamer',
  ];

  let removed = 0;
  for (const t of targets) {
    const q = t.trim().toLowerCase();
    const deleted = await db.streamer.deleteMany({
      where: {
        OR: [
          { username: q },
          { displayName: { equals: t, mode: 'insensitive' } },
        ],
      },
    });
    removed += deleted.count;
    logger.info(`Removed ${deleted.count} rows for '${t}'.`);
  }

  logger.info(`Total removed: ${removed}`);
  await db.$disconnect();
}

run().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});

