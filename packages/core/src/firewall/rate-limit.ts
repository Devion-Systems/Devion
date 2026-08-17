import type { Context, MiddlewareHandler } from 'hono';
import type { auth } from '@repo/auth'; // your better-auth 
export interface RateLimitStore {

  increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
  reset(key: string): Promise<void>;
}


export class MemoryStore implements RateLimitStore {
  private hits = new Map<string, { count: number; resetAt: number }>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(cleanupIntervalMs = 60_000) {
    this.cleanupTimer = setInterval(() => this.cleanup(), cleanupIntervalMs);

    (this.cleanupTimer as unknown as { unref?: () => void }).unref?.();
  }

  async increment(key: string, windowMs: number) {
    const now = Date.now();
    const existing = this.hits.get(key);
    if (!existing || existing.resetAt <= now) {
      const entry = { count: 1, resetAt: now + windowMs };
      this.hits.set(key, entry);
      return entry;
    }
    existing.count += 1;
    return existing;
  }

  async reset(key: string) {
    this.hits.delete(key);
  }

  destroy() {
    clearInterval(this.cleanupTimer);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.hits) {
      if (entry.resetAt <= now) this.hits.delete(key);
    }
  }
}


export interface RedisLike {
  incr(key: string): Promise<number>;
  pexpire(key: string, ms: number): Promise<number | unknown>;
  pttl(key: string): Promise<number>;
  del(key: string): Promise<number>;
}

export class RedisStore implements RateLimitStore {
  constructor(
    private redis: RedisLike,
    private prefix = 'devion:rl:'
  ) {}

  async increment(key: string, windowMs: number) {
    const fullKey = `${this.prefix}${key}`;
    const count = await this.redis.incr(fullKey);
    if (count === 1) {
      await this.redis.pexpire(fullKey, windowMs);
      return { count, resetAt: Date.now() + windowMs };
    }
    const ttl = await this.redis.pttl(fullKey);
    return { count, resetAt: Date.now() + Math.max(ttl, 0) };
  }

  async reset(key: string) {
    await this.redis.del(`${this.prefix}${key}`);
  }
}


export interface PgLike {
  query<T = Record<string, unknown>>(sql: string, params: unknown[]): Promise<{ rows: T[] }>;
}

export class PostgresStore implements RateLimitStore {
  constructor(private db: PgLike) {}

  async increment(key: string, windowMs: number) {
    const { rows } = await this.db.query<{ count: number; reset_at: string }>(
      `
      INSERT INTO rate_limit_counters (key, count, reset_at)
      VALUES ($1, 1, now() + ($2 || ' milliseconds')::interval)
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN rate_limit_counters.reset_at <= now() THEN 1
          ELSE rate_limit_counters.count + 1
        END,
        reset_at = CASE
          WHEN rate_limit_counters.reset_at <= now() THEN now() + ($2 || ' milliseconds')::interval
          ELSE rate_limit_counters.reset_at
        END
      RETURNING count, reset_at;
      `,
      [key, windowMs]
    );
    const row = rows[0];
    return { count: row.count, resetAt: new Date(row.reset_at).getTime() };
  }

  async reset(key: string) {
    await this.db.query('DELETE FROM rate_limit_counters WHERE key = $1;', [key]);
  }

  async cleanupExpired() {
    await this.db.query('DELETE FROM rate_limit_counters WHERE reset_at <= now();', []);
  }
}


export function createStoreFromEnv(redisClient?: RedisLike): RateLimitStore {
  if (redisClient) {
    return new RedisStore(redisClient);
  }
  console.warn(
    '[rate-limit] No Redis client provided — using in-memory store. ' +
      'This only limits correctly within a single Devion instance; ' +
      'pass a Redis client once you run more than one instance.'
  );
  return new MemoryStore();
}



declare module 'hono' {
  interface ContextVariableMap {
    organizationId?: string;
    apiKeyId?: string;
  }
}


export function resolveOrgContext(authInstance: typeof auth): MiddlewareHandler {
  return async (c, next) => {
    const apiKeyHeader = c.req.header('x-api-key') ?? c.req.header('authorization')?.replace(/^Bearer\s+/i, '');

    if (apiKeyHeader) {
      const result = await authInstance.api.verifyApiKey({ body: { key: apiKeyHeader } });
      if (result?.valid) {
        c.set('apiKeyId', result.key?.id);
        c.set('organizationId', result.key?.metadata?.organizationId);
        return next();
      }
    }

    const session = await authInstance.api.getSession({ headers: c.req.raw.headers });
    c.set('organizationId', session?.session?.activeOrganizationId);
    return next();
  };
}

function clientIp(c: Context): string {
  return (
    c.req.header('x-real-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

function defaultKeyGenerator(c: Context): string {
  
  return `${c.get('organizationId') ?? 'no-org'}:${clientIp(c)}`;
}


function apiKeyGenerator(c: Context): string {
  return `apikey:${c.get('apiKeyId') ?? clientIp(c)}`;
}

export interface RateLimitOptions {
  store: RateLimitStore;
  windowMs: number;
  max: number;
  keyGenerator?: (c: Context) => string;
  message?: string;
}

export function createRateLimiter(options: RateLimitOptions): MiddlewareHandler {
  const {
    store,
    windowMs,
    max,
    message = 'Too many requests',
    keyGenerator = defaultKeyGenerator,
  } = options;

  return async (c, next) => {
    const key = keyGenerator(c);
    const { count, resetAt } = await store.increment(key, windowMs);

    c.header('X-RateLimit-Limit', String(max));
    c.header('X-RateLimit-Remaining', String(Math.max(max - count, 0)));
    c.header('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));

    if (count > max) {
      const retryAfterSec = Math.max(Math.ceil((resetAt - Date.now()) / 1000), 1);
      c.header('Retry-After', String(retryAfterSec));
      return c.json({ error: message }, 429);
    }

    return next();
  };
}


declare module 'hono' {
  interface ContextVariableMap {
    loginEmail?: string;
  }
}

export function createDevionRateLimiters(store: RateLimitStore) {
  return {

    global: createRateLimiter({
      store,
      windowMs: 60_000,
      max: 300,
    }),


    auth: createRateLimiter({
      store,
      windowMs: 60_000,
      max: 20,
      keyGenerator: c => `auth:${clientIp(c)}`,
    }),

    login: createRateLimiter({
      store,
      windowMs: 15 * 60_000,
      max: 5,
      keyGenerator: c => `login:${clientIp(c)}:${c.get('loginEmail') ?? 'unknown'}`,
      message: 'Too many failed login attempts. Try again in 15 minutes.',
    }),


    perOrgApi: createRateLimiter({
      store,
      windowMs: 60_000,
      max: 600,
      keyGenerator: c => `org-api:${c.get('organizationId') ?? 'no-org'}`,
    }),
    perApiKey: createRateLimiter({
      store,
      windowMs: 60_000,
      max: 1_200,
      keyGenerator: apiKeyGenerator,
      message: 'API key rate limit exceeded.',
    }),
  };
}