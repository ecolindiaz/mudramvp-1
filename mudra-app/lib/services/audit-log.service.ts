/**
 * Audit Logging Service
 * 
 * Provides comprehensive audit logging for security-sensitive operations:
 * - User authentication events
 * - Brand profile changes
 * - API key management
 * - GitHub token storage
 * - Suspicious activity detection
 * - Admin operations
 * 
 * Logs are stored in the database for compliance and can be exported
 * for security analysis.
 */

import { prisma } from '@/lib/prisma';

export type AuditAction =
  // Authentication
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'USER_REGISTER'
  | 'PASSWORD_CHANGE'
  | 'PASSWORD_RESET_REQUEST'
  | 'PASSWORD_RESET_COMPLETE'
  | 'SESSION_REVOKED'
  | 'AUTH_FAILED'
  | 'AUTH_RATE_LIMITED'
  
  // Brand Profile
  | 'BRAND_PROFILE_CREATED'
  | 'BRAND_PROFILE_UPDATED'
  | 'BRAND_PROFILE_DELETED'
  
  // GitHub Integration
  | 'GITHUB_CONNECTED'
  | 'GITHUB_DISCONNECTED'
  | 'GITHUB_TOKEN_REFRESHED'
  | 'GITHUB_SYNC'
  
  // Analysis
  | 'ANALYSIS_STARTED'
  | 'ANALYSIS_COMPLETED'
  | 'ANALYSIS_FAILED'
  
  // Campaigns
  | 'CAMPAIGN_CREATED'
  | 'CAMPAIGN_UPDATED'
  | 'CAMPAIGN_DELETED'
  
  // Prompts
  | 'PROMPT_CREATED'
  | 'PROMPT_UPDATED'
  | 'PROMPT_DELETED'
  | 'PROMPTS_GENERATED'
  
  // Security Events
  | 'SUSPICIOUS_TRACKING'
  | 'RATE_LIMIT_EXCEEDED'
  | 'UNAUTHORIZED_ACCESS_ATTEMPT'
  | 'INVALID_SIGNATURE'
  | 'CRON_JOB_EXECUTED'
  
  // Admin
  | 'ADMIN_ACTION'
  | 'DATA_EXPORT'
  | 'BULK_OPERATION';

export type AuditResourceType =
  | 'user'
  | 'brand_profile'
  | 'campaign'
  | 'prompt'
  | 'analysis'
  | 'github_integration'
  | 'tracking'
  | 'system'
  | 'cron';

export interface AuditLogEntry {
  action: AuditAction;
  userId?: string;
  resourceType: AuditResourceType;
  resourceId?: string | number;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
  errorMessage?: string;
}

// In-memory buffer for batch inserts
type GlobalWithAuditBuffer = typeof globalThis & {
  __mudraAuditBuffer?: AuditLogEntry[];
  __mudraAuditFlushTimeout?: NodeJS.Timeout;
};

function getAuditBuffer(): AuditLogEntry[] {
  const g = globalThis as GlobalWithAuditBuffer;
  if (!g.__mudraAuditBuffer) {
    g.__mudraAuditBuffer = [];
  }
  return g.__mudraAuditBuffer;
}

const BUFFER_FLUSH_INTERVAL = 5000; // 5 seconds
const BUFFER_MAX_SIZE = 50;

/**
 * Log an audit event
 * Events are buffered and batch-inserted for performance
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    // Add timestamp
    const logEntry = {
      ...entry,
      timestamp: new Date(),
    };

    // Console log for immediate visibility (in development)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Audit] ${entry.action}`, {
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        userId: entry.userId,
        success: entry.success ?? true,
      });
    }

    // Add to buffer
    const buffer = getAuditBuffer();
    buffer.push(logEntry);

    // Flush if buffer is full
    if (buffer.length >= BUFFER_MAX_SIZE) {
      await flushAuditBuffer();
    } else {
      // Schedule flush
      scheduleFlush();
    }
  } catch (error) {
    // Never throw from audit logging - just log to console
    console.error('[Audit] Failed to log event:', error, entry);
  }
}

/**
 * Schedule buffer flush
 */
function scheduleFlush(): void {
  const g = globalThis as GlobalWithAuditBuffer;
  if (g.__mudraAuditFlushTimeout) return;

  g.__mudraAuditFlushTimeout = setTimeout(async () => {
    g.__mudraAuditFlushTimeout = undefined;
    await flushAuditBuffer();
  }, BUFFER_FLUSH_INTERVAL);
}

/**
 * Flush the audit buffer to database
 */
async function flushAuditBuffer(): Promise<void> {
  const g = globalThis as GlobalWithAuditBuffer;
  const buffer = g.__mudraAuditBuffer || [];
  
  if (buffer.length === 0) return;

  // Clear buffer immediately to prevent duplicate writes
  g.__mudraAuditBuffer = [];

  try {
    // Check if AuditLog table exists
    const hasTable = await checkAuditLogTable();
    
    if (hasTable) {
      // Use type assertion for new Prisma model (run `prisma generate` after adding schema)
      const prismaAny = prisma as any;
      await prismaAny.auditLog.createMany({
        data: buffer.map(entry => ({
          action: entry.action,
          userId: entry.userId || null,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId?.toString() || null,
          metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
          ipAddress: entry.ipAddress || null,
          userAgent: entry.userAgent || null,
          success: entry.success ?? true,
          errorMessage: entry.errorMessage || null,
          createdAt: new Date(),
        })),
        skipDuplicates: true,
      });
    } else {
      // Fallback: log to console if table doesn't exist
      console.log('[Audit] Batch events (table not found):', buffer.length);
    }
  } catch (error) {
    // Log to console as fallback
    console.error('[Audit] Failed to flush buffer:', error);
    console.log('[Audit] Lost events:', buffer.length);
  }
}

/**
 * Check if AuditLog table exists
 * Note: After adding AuditLog model to schema and running migration,
 * this check should always pass. Cache removed to allow dynamic detection.
 */
async function checkAuditLogTable(): Promise<boolean> {
  try {
    // Try a simple query - will succeed after migration
    await (prisma as any).auditLog?.findFirst?.({ take: 1 });
    return true;
  } catch (error) {
    // Table doesn't exist yet or Prisma client not regenerated
    console.warn('[Audit] AuditLog table check failed. Run: npx prisma generate && npx prisma migrate dev');
    return false;
  }
}

/**
 * Log authentication events
 */
export async function logAuthEvent(
  action: 'USER_LOGIN' | 'USER_LOGOUT' | 'AUTH_FAILED' | 'AUTH_RATE_LIMITED',
  userId: string | undefined,
  ipAddress: string,
  userAgent: string,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  await logAuditEvent({
    action,
    userId,
    resourceType: 'user',
    resourceId: userId,
    ipAddress,
    userAgent,
    success,
    errorMessage,
  });
}

/**
 * Log brand profile changes
 */
export async function logBrandProfileChange(
  action: 'BRAND_PROFILE_CREATED' | 'BRAND_PROFILE_UPDATED' | 'BRAND_PROFILE_DELETED',
  userId: string,
  brandProfileId: number,
  changes?: Record<string, unknown>
): Promise<void> {
  await logAuditEvent({
    action,
    userId,
    resourceType: 'brand_profile',
    resourceId: brandProfileId,
    metadata: changes,
    success: true,
  });
}

/**
 * Log GitHub integration events
 */
export async function logGitHubEvent(
  action: 'GITHUB_CONNECTED' | 'GITHUB_DISCONNECTED' | 'GITHUB_TOKEN_REFRESHED' | 'GITHUB_SYNC',
  userId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logAuditEvent({
    action,
    userId,
    resourceType: 'github_integration',
    metadata,
    success: true,
  });
}

/**
 * Log security events
 */
export async function logSecurityEvent(
  action: 'SUSPICIOUS_TRACKING' | 'RATE_LIMIT_EXCEEDED' | 'UNAUTHORIZED_ACCESS_ATTEMPT' | 'INVALID_SIGNATURE',
  ipAddress: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await logAuditEvent({
    action,
    resourceType: 'system',
    ipAddress,
    metadata,
    success: false,
  });
}

/**
 * Query audit logs (for admin dashboard)
 */
export async function queryAuditLogs(options: {
  userId?: string;
  action?: AuditAction;
  resourceType?: AuditResourceType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<{ logs: any[]; total: number }> {
  const hasTable = await checkAuditLogTable();
  if (!hasTable) {
    return { logs: [], total: 0 };
  }

  const where: any = {};

  if (options.userId) where.userId = options.userId;
  if (options.action) where.action = options.action;
  if (options.resourceType) where.resourceType = options.resourceType;
  if (options.startDate || options.endDate) {
    where.createdAt = {};
    if (options.startDate) where.createdAt.gte = options.startDate;
    if (options.endDate) where.createdAt.lte = options.endDate;
  }

  const [logs, total] = await Promise.all([
    (prisma as any).auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit || 100,
      skip: options.offset || 0,
    }),
    (prisma as any).auditLog.count({ where }),
  ]);

  return { logs, total };
}

/**
 * Export audit logs for compliance
 */
export async function exportAuditLogs(
  startDate: Date,
  endDate: Date,
  format: 'json' | 'csv' = 'json'
): Promise<string> {
  const { logs } = await queryAuditLogs({
    startDate,
    endDate,
    limit: 10000,
  });

  if (format === 'csv') {
    const headers = ['timestamp', 'action', 'userId', 'resourceType', 'resourceId', 'success', 'ipAddress'];
    const rows = logs.map((log: any) => 
      headers.map(h => JSON.stringify(log[h] ?? '')).join(',')
    );
    return [headers.join(','), ...rows].join('\n');
  }

  return JSON.stringify(logs, null, 2);
}
