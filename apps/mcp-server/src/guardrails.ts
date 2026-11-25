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
  const auditData = {
    user_id: ctx.userId,
    action: `MCP_TOOL:${entry.toolName}`,
    entity_name: 'MCP_SERVER',
    status: entry.status,
    details: {
      ...entry.arguments,
      error: entry.errorMessage,
      user_role: ctx.primaryRole,
    },
  };

  // We write via user's delegated client so user actions are attributable
  try {
    await ctx.supabase.from('audit_logs').insert([auditData]);
  } catch (err) {
    // Audit write should not crash caller if audit table doesn't have exact schema, log locally
    console.error('[MCP AUDIT LOG]', JSON.stringify(auditData));
  }
}

/**
 * Checks if the caller has a required permission
 */
export function requirePermission(ctx: AuthenticatedUserContext, permission: string): void {
  if (ctx.roles.includes('SUPER_ADMIN')) {
    return; // Super admin possesses baseline authorizations but still subject to safety rules
  }
  if (!ctx.permissions.includes(permission)) {
    throw new Error(`Access Denied: Missing "${permission}" permission. Current permissions do not permit this operation.`);
  }
}

/**
 * Generates a two-step confirmation token for destructive operations
 */
export function createPendingConfirmation(userId: string, actionName: string, details: Record<string, unknown>): string {
  const token = `CONFIRM_${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
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
export function consumeConfirmationToken(userId: string, token: string, actionName: string): boolean {
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

  // Single-use token
  pendingConfirmations.delete(token);
  return true;
}

/**
 * Field masking utility conforming to crm_masked_reader specifications
 */
export function maskSensitiveFields<T extends Record<string, any>>(record: T, role: string): T {
  if (role === 'SUPER_ADMIN' || role === 'HEAD_OF_SALES') {
    return record;
  }

  const masked = { ...record };
  // Mask sensitive financial or banking details if present
  if ('bank_account_number' in masked && typeof masked.bank_account_number === 'string') {
    masked.bank_account_number = masked.bank_account_number.slice(-4).padStart(masked.bank_account_number.length, '*');
  }
  if ('tax_id' in masked && typeof masked.tax_id === 'string') {
    masked.tax_id = '***-**-' + masked.tax_id.slice(-4);
  }
  return masked;
}
