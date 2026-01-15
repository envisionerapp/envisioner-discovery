import { db, logger } from '../utils/database';

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';
export type AuditActor = 'AI_HAIKU' | 'AI_TAG_INFERENCE' | 'SYSTEM' | 'SCRAPER' | 'SYNC' | string; // string for user emails

interface AuditEntry {
  tableName: string;
  recordId: string;
  action: AuditAction;
  changedBy: AuditActor;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
}

class AuditService {
  /**
   * Log a single change
   */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await db.auditLog.create({
        data: {
          tableName: entry.tableName,
          recordId: entry.recordId,
          action: entry.action,
          changedBy: entry.changedBy,
          oldValues: entry.oldValues || undefined,
          newValues: entry.newValues || undefined,
        }
      });
    } catch (error) {
      // Don't fail the main operation if audit fails
      logger.error('Failed to write audit log', { error, entry });
    }
  }

  /**
   * Log multiple changes in a batch
   */
  async logBatch(entries: AuditEntry[]): Promise<void> {
    if (entries.length === 0) return;

    try {
      await db.auditLog.createMany({
        data: entries.map(entry => ({
          tableName: entry.tableName,
          recordId: entry.recordId,
          action: entry.action,
          changedBy: entry.changedBy,
          oldValues: entry.oldValues || undefined,
          newValues: entry.newValues || undefined,
        }))
      });
    } catch (error) {
      logger.error('Failed to write batch audit log', { error, count: entries.length });
    }
  }

  /**
   * Helper to log a streamer update with diff
   */
  async logStreamerUpdate(
    streamerId: string,
    changedBy: AuditActor,
    oldValues: Record<string, any>,
    newValues: Record<string, any>
  ): Promise<void> {
    // Only log fields that actually changed
    const changedFields: Record<string, any> = {};
    const previousValues: Record<string, any> = {};

    for (const key of Object.keys(newValues)) {
      if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])) {
        changedFields[key] = newValues[key];
        previousValues[key] = oldValues[key];
      }
    }

    // Skip if nothing changed
    if (Object.keys(changedFields).length === 0) return;

    await this.log({
      tableName: 'discovery_creators',
      recordId: streamerId,
      action: 'UPDATE',
      changedBy,
      oldValues: previousValues,
      newValues: changedFields,
    });
  }

  /**
   * Get recent audit logs with filtering
   */
  async getLogs(options: {
    tableName?: string;
    recordId?: string;
    changedBy?: string;
    action?: AuditAction;
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}): Promise<{ logs: any[]; total: number }> {
    const {
      tableName,
      recordId,
      changedBy,
      action,
      limit = 50,
      offset = 0,
      startDate,
      endDate
    } = options;

    const where: any = {};

    if (tableName) where.tableName = tableName;
    if (recordId) where.recordId = recordId;
    if (changedBy) where.changedBy = { contains: changedBy, mode: 'insensitive' };
    if (action) where.action = action;
    if (startDate || endDate) {
      where.changedAt = {};
      if (startDate) where.changedAt.gte = startDate;
      if (endDate) where.changedAt.lte = endDate;
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { changedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.auditLog.count({ where })
    ]);

    return { logs, total };
  }

  /**
   * Get audit history for a specific record
   */
  async getRecordHistory(tableName: string, recordId: string): Promise<any[]> {
    return db.auditLog.findMany({
      where: { tableName, recordId },
      orderBy: { changedAt: 'desc' },
    });
  }

  /**
   * Get summary stats for audit logs
   */
  async getStats(days: number = 7): Promise<{
    totalChanges: number;
    byActor: Record<string, number>;
    byAction: Record<string, number>;
    byTable: Record<string, number>;
  }> {
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

    return {
      totalChanges: logs.length,
      byActor,
      byAction,
      byTable
    };
  }
}

export const auditService = new AuditService();
