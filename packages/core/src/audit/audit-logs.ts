import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { and, eq, gte, lte, lt, desc, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Context, MiddlewareHandler } from 'hono';
import { db } from '../db'; // adjust to your actual db export
import type { auth } from '../auth';

export const activityLogs = pgTable(
  'activity_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id'), // null = platform-level event
    actorId: uuid('actor_id'), // null = system/unauthenticated
    actorType: text('actor_type').notNull().default('user'), // 'user' | 'api_key' | 'system'
    targetId: text('target_id'), // e.g. deployment id, app id
    targetType: text('target_type'), // e.g. 'deployment', 'dashboard', 'app'
    action: text('action').notNull(), // e.g. 'dashboard.viewed', 'deployment.created'
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  t => ({
    orgIdx: index('activity_org_idx').on(t.organizationId),
    actorIdx: index('activity_actor_idx').on(t.actorId),
    actionIdx: index('activity_action_idx').on(t.action),
    orgTimeIdx: index('activity_org_time_idx').on(t.organizationId, t.createdAt),
  })
);

export type DevionAction =
  | 'dashboard.viewed'
  | 'deployment.created'
  | 'deployment.failed'
  | 'deployment.rolled_back'
  | 'app.created'
  | 'app.deleted'
  | 'org.member_invited'
  | 'org.member_removed'
  | (string & {}); // keep it open — new actions shouldn't need a type change here

export interface ActivityEvent {
  organizationId?: string;
  actorId?: string;
  actorType?: 'user' | 'api_key' | 'system';
  targetId?: string;
  targetType?: string;
  action: DevionAction;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

// Fire-and-forget — never let a logging failure break the request.
export async function logActivity(event: ActivityEvent): Promise<void> {
  try {
    await db.insert(activityLogs).values({
      organizationId: event.organizationId ?? null,
      actorId: event.actorId ?? null,
      actorType: event.actorType ?? 'user',
      targetId: event.targetId ?? null,
      targetType: event.targetType ?? null,
      action: event.action,
      ipAddress: event.ipAddress ?? null,
      userAgent: event.userAgent ?? null,
      metadata: event.metadata ?? null,
    });
  } catch (err) {
    console.error('[activity] failed to write log:', err);
  }
}

// ── Hono middleware: reuses resolveOrgContext() (organizationId/apiKeyId
// already on context from the rate-limiter setup) and adds a logActivity
// helper bound to the current request. Mount resolveOrgContext(auth)
// once globally — this middleware just reads what it already set.

declare module 'hono' {
  interface ContextVariableMap {
    logActivity: (partial: Omit<ActivityEvent, 'actorId' | 'organizationId' | 'actorType' | 'ipAddress' | 'userAgent'>) => Promise<void>;
    actorId?: string;
  }
}

function requestIp(c: Context): string | undefined {
  return c.req.header('x-real-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
}

/**
 * Mount AFTER resolveOrgContext(auth). Doesn't re-parse the session —
 * just also grabs the user id (resolveOrgContext only kept organizationId)
 * and exposes a bound logActivity(). If the request came in via API key
 * rather than a session, actorType is 'api_key' and actorId is whatever
 * user the key is scoped to, if any.
 */
export function activityContextMiddleware(authInstance: typeof auth): MiddlewareHandler {
  return async (c, next) => {
    let actorId: string | undefined;
    let actorType: ActivityEvent['actorType'] = 'user';

    if (c.get('apiKeyId')) {
      actorType = 'api_key';
      actorId = c.get('apiKeyId');
    } else {
      const session = await authInstance.api.getSession({ headers: c.req.raw.headers });
      actorId = session?.user?.id;
    }

    c.set('actorId', actorId);
    c.set('logActivity', partial =>
      logActivity({
        ...partial,
        actorId,
        actorType,
        organizationId: c.get('organizationId'),
        ipAddress: requestIp(c),
        userAgent: c.req.header('user-agent'),
      })
    );

    return next();
  };
}

/**
 * Drop this on any route you want auto-tracked, e.g. app.get('/dashboard', dashboardViewMiddleware, ...).
 * For deployments, don't use a blanket middleware — call c.get('logActivity') explicitly
 * inside the deploy handler once you know the result (created / failed / rolled_back).
 */
export function trackAction(action: DevionAction): MiddlewareHandler {
  return async (c, next) => {
    await next();
    // Only log after the handler ran, and only on success (2xx/3xx).
    if (c.res.status < 400) {
      await c.get('logActivity')({ action });
    }
  };
}

// ── Query API for the dashboard ─────────────────────────────────────

export interface ActivityQueryOptions {
  organizationId: string;
  actorId?: string;
  action?: DevionAction;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

/** Raw, paginated feed — "activity log" tab. */
export async function getActivityFeed(opts: ActivityQueryOptions) {
  const conditions = [eq(activityLogs.organizationId, opts.organizationId)];
  if (opts.actorId) conditions.push(eq(activityLogs.actorId, opts.actorId));
  if (opts.action) conditions.push(eq(activityLogs.action, opts.action));
  if (opts.from) conditions.push(gte(activityLogs.createdAt, opts.from));
  if (opts.to) conditions.push(lte(activityLogs.createdAt, opts.to));

  return db.query.activityLogs.findMany({
    where: and(...conditions),
    orderBy: [desc(activityLogs.createdAt)],
    limit: opts.limit ?? 50,
    offset: opts.offset ?? 0,
  });
}

/**
 * "Who did what how often" — grouped counts per actor + action within a
 * window. This is the query for the summary table you're picturing
 * (e.g. Alice: 12 dashboard views, 3 deployments / last 7 days).
 */
export async function getActivityCounts(opts: { organizationId: string; from: Date; to?: Date }) {
  return db
    .select({
      actorId: activityLogs.actorId,
      action: activityLogs.action,
      count: sql<number>`count(*)`.as('count'),
      lastAt: sql<Date>`max(${activityLogs.createdAt})`.as('last_at'),
    })
    .from(activityLogs)
    .where(
      and(
        eq(activityLogs.organizationId, opts.organizationId),
        gte(activityLogs.createdAt, opts.from),
        opts.to ? lte(activityLogs.createdAt, opts.to) : undefined
      )
    )
    .groupBy(activityLogs.actorId, activityLogs.action)
    .orderBy(desc(sql`count`));
}

// ── Retention ─────────────────────────────────────────────────────────

/**
 * Delete logs older than `retentionDays`. Activity logs grow forever
 * otherwise — every dashboard view is a row. Run this on a schedule
 * (cron, pg_cron, or a setInterval in a background worker), not per
 * request. 90 days is a reasonable default for an activity feed that
 * isn't a compliance-grade audit trail; raise it if you need longer
 * history for billing/support disputes.
 */
export async function cleanupOldActivity(retentionDays = 90): Promise<void> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  await db.delete(activityLogs).where(lt(activityLogs.createdAt, cutoff));
}

// ── Dashboard routes ──────────────────────────────────────────────────

/**
 * Mount at e.g. app.route('/api/orgs/:orgId/activity', activityRoutes).
 * Assumes resolveOrgContext(auth) already ran and confirmed the caller
 * belongs to this org — add that membership check upstream if it isn't
 * already enforced by your org middleware.
 */
export const activityRoutes = new Hono()
  // GET /?actorId=&action=&from=&to=&limit=&offset= — raw feed for an "Activity" tab
  .get('/', async c => {
    const organizationId = c.get('organizationId');
    if (!organizationId) return c.json({ error: 'No active organization' }, 400);

    const q = c.req.query();
    const feed = await getActivityFeed({
      organizationId,
      actorId: q.actorId,
      action: q.action,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
      offset: q.offset ? Number(q.offset) : undefined,
    });
    return c.json({ items: feed });
  })
  // GET /summary?days=7 — per-user counts for the overview table
  .get('/summary', async c => {
    const organizationId = c.get('organizationId');
    if (!organizationId) return c.json({ error: 'No active organization' }, 400);

    const days = Number(c.req.query('days') ?? 7);
    const counts = await getActivityCounts({
      organizationId,
      from: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
    });
    return c.json({ items: counts, windowDays: days });
  });