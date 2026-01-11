/**
 * Config from Database
 *
 * Reads configuration values from the database when environment variables are not set.
 * This allows Render deployments to work without manually setting all env vars.
 */

import { db, logger } from './database';

// Cache for config values (refreshed every 5 minutes)
const configCache: Map<string, { value: string; expiry: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get a config value, checking env vars first, then database
 */
export async function getConfig(key: string): Promise<string | null> {
  // First check environment variable
  const envValue = process.env[key];
  if (envValue) {
    return envValue;
  }

  // Check cache
  const cached = configCache.get(key);
  if (cached && Date.now() < cached.expiry) {
    return cached.value;
  }

  // Fetch from database
  try {
    const config = await db.systemConfig.findUnique({
      where: { key },
    });

    if (config?.value) {
      // Cache the value
      configCache.set(key, {
        value: config.value,
        expiry: Date.now() + CACHE_TTL,
      });
      logger.info(`Loaded ${key} from database config`);
      return config.value;
    }
  } catch (error) {
    logger.error(`Failed to load ${key} from database:`, error);
  }

  return null;
}

/**
 * Get multiple config values at once
 */
export async function getConfigs(keys: string[]): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {};

  for (const key of keys) {
    result[key] = await getConfig(key);
  }

  return result;
}

/**
 * Preload all config values from database
 * Call this at startup to warm the cache
 */
export async function preloadConfigs(): Promise<void> {
  try {
    const configs = await db.systemConfig.findMany();

    for (const config of configs) {
      // Only cache if env var is not set
      if (!process.env[config.key]) {
        configCache.set(config.key, {
          value: config.value,
          expiry: Date.now() + CACHE_TTL,
        });
      }
    }

    logger.info(`Preloaded ${configs.length} config values from database`);
  } catch (error) {
    logger.error('Failed to preload configs:', error);
  }
}
