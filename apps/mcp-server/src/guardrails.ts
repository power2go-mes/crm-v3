import { randomUUID } from 'node:crypto';
import { AuthenticatedUserContext } from './auth.js';

export interface AuditLogEntry {
  toolName: string;
  userId: string;
  userRole: string;
  arguments: Record<string, unknown>;
  status: 'SUCCESS' | 'DENIED' | 'FAILED';
  errorMessage?: string;
  timestamp: string;
}

// In-memory pending confirmation store for high-impact actions
interface PendingConfirmation {
  confirmationToken: string;
  userId: string;
  actionName: string;
  details: Record<string, unknown>;
  createdAt: number;
  expiresAt: number;
}

const pendingConfirmations = new Map<string, PendingConfirmation>();

/**
 * Rate limiter state
 */
const rateLimitCounts = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS_PER_MINUTE = 120;

export function checkRateLimit(userId: string): void {
  const now = Date.now();
  const current = rateLimitCounts.get(userId);

  if (!current || now > current.resetAt) {
    rateLimitCounts.set(userId, { count: 1, resetAt: now + 60000 });
    return;
  }

  if (current.count >= MAX_REQUESTS_PER_MINUTE) {
    throw new Error(`Rate limit exceeded (${MAX_REQUESTS_PER_MINUTE} requests/min). Please slow down.`);
  }

  current.count++;
}

/**
 * Log tool access to CRM audit ledger
 */
export async function recordAudit(ctx: AuthenticatedUserContext, entry: Omit<AuditLogEntry, 'timestamp' | 'userId' | 'userRole'>): Promise<void> {
  const toolName =
    entry.toolName.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 120) || 'unknown';
  const auditData = {
    user_id: ctx.userId,
    action: `MCP_TOOL:${toolName}`,
    entity_name: 'MCP_SERVER',
    status: entry.status,
    details: { user_role: ctx.primaryRole },
  };

  const { error } = await ctx.supabase.from('audit_logs').insert([auditData]);
  if (error) {
    console.error('[MCP] Audit persistence failed', { code: error.code });
    throw new Error('MCP audit persistence failed');
  }
}

/**
 * Checks if the caller has a required permission
 */
export function requirePermission(ctx: AuthenticatedUserContext, permission: string): void {
  if (!ctx.permissions.includes(permission)) {
    throw new Error(`Access Denied: Missing "${permission}" permission. Current permissions do not permit this operation.`);
  }
}

/**
 * Generates a two-step confirmation token for destructive operations
 */
export function createPendingConfirmation(userId: string, actionName: string, details: Record<string, unknown>): string {
  const token = randomUUID();
  pendingConfirmations.set(token, {
    confirmationToken: token,
    userId,
    actionName,
    details,
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
  });
  return token;
}

/**
 * Validates and consumes a confirmation token
 */
export function consumeConfirmationToken(userId: string, token: string, actionName: string, target: { entityType: string; recordId: string }): boolean {
  const pending = pendingConfirmations.get(token);
  if (!pending) {
    throw new Error('Invalid or expired confirmation token. Please re-initiate the action.');
  }

  if (pending.userId !== userId) {
    throw new Error('Confirmation token belongs to another user session. Action aborted.');
  }

  if (pending.actionName !== actionName) {
    throw new Error(`Confirmation token is for "${pending.actionName}", not "${actionName}".`);
  }

  if (Date.now() > pending.expiresAt) {
    pendingConfirmations.delete(token);
    throw new Error('Confirmation token has expired. High-impact operations must be confirmed within 5 minutes.');
  }

  if (pending.details.entityType !== target.entityType || pending.details.recordId !== target.recordId) {
    throw new Error('Confirmation token does not match this record.');
  }

  // Single-use token
  pendingConfirmations.delete(token);
  return true;
}

/**
 * Field masking utility conforming to crm_masked_reader specifications
 */
export function maskSensitiveFields<T extends object>(record: T, role: string): T {
  if (role === 'SUPER_ADMIN' || role === 'HEAD_OF_SALES') {
    return record;
  }

  const masked = { ...record };
  const bankAccountNumber: unknown = Reflect.get(masked, 'bank_account_number');
  if (typeof bankAccountNumber === 'string') {
    Object.assign(masked, {
      bank_account_number: bankAccountNumber.slice(-4).padStart(bankAccountNumber.length, '*'),
    });
  }
  const taxId: unknown = Reflect.get(masked, 'tax_id');
  if (typeof taxId === 'string') {
    Object.assign(masked, { tax_id: `***-**-${taxId.slice(-4)}` });
  }
  return masked;
}
