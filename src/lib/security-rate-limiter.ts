import { getRequest } from "@tanstack/react-start/server";

export interface RateLimitOptions {
  /** Identifier for the action (e.g. 'auth:login', 'invite:claim', 'ai:verify') */
  action: string;
  /** Maximum allowed attempts within the window */
  maxAttempts: number;
  /** Window size in seconds */
  windowSeconds: number;
  /** Optional user identifier */
  userId?: string | null;
  /** Optional custom client identifier / IP */
  ip?: string | null;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAfterSeconds: number;
}

// In-memory sliding window cache for fast edge/server-level checks
interface MemoryWindow {
  count: number;
  resetAt: number;
}
const memoryCache = new Map<string, MemoryWindow>();

/**
 * Extracts client IP from request headers safely.
 */
export function getClientIp(): string {
  try {
    const req = getRequest();
    if (!req?.headers) return "127.0.0.1";
    const xForwardedFor = req.headers.get("x-forwarded-for");
    if (xForwardedFor) {
      // First IP in comma-separated list is client
      const ip = xForwardedFor.split(",")[0]?.trim();
      if (ip) return ip;
    }
    const realIp = req.headers.get("x-real-ip") || req.headers.get("cf-connecting-ip");
    if (realIp) return realIp.trim();
  } catch {
    // Non-request context fallback
  }
  return "127.0.0.1";
}

/**
 * Hash an IP address for privacy-conscious storage and tracking.
 */
export function hashIdentifier(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return "h_" + Math.abs(hash).toString(16);
}

/**
 * Check distributed rate limit with hybrid in-memory + database consistency.
 */
export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const { action, maxAttempts, windowSeconds } = options;
  const ip = options.ip || getClientIp();
  const userId = options.userId;

  // Composite key: account-based for authenticated callers, IP-hashed for network callers
  const keyIdentifier = userId ? `u_${userId}` : `ip_${hashIdentifier(ip)}`;
  const key = `rl:${action}:${keyIdentifier}`;

  const now = Date.now();
  const cached = memoryCache.get(key);

  // Fast-fail in-memory if already exceeded within window
  if (cached && cached.resetAt > now && cached.count >= maxAttempts) {
    const resetAfterSeconds = Math.max(1, Math.ceil((cached.resetAt - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      resetAfterSeconds,
    };
  }

  // Update in-memory counter
  if (!cached || cached.resetAt <= now) {
    memoryCache.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
  } else {
    cached.count += 1;
  }

  // Prune expired entries periodically
  if (memoryCache.size > 2000) {
    for (const [k, v] of memoryCache.entries()) {
      if (v.resetAt <= now) memoryCache.delete(k);
    }
  }

  // Sync with Postgres distributed rate limiter for cross-serverless coordination
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: dbRes, error } = await supabaseAdmin.rpc("check_rate_limit", {
      p_key: key,
      p_max_attempts: maxAttempts,
      p_window_seconds: windowSeconds,
    });

    if (!error && dbRes && typeof dbRes === "object") {
      const res = dbRes as { allowed: boolean; remaining: number; reset_in_seconds: number };
      return {
        allowed: Boolean(res.allowed),
        remaining: Number(res.remaining ?? 0),
        resetAfterSeconds: Number(res.reset_in_seconds ?? windowSeconds),
      };
    }
  } catch (err) {
    console.warn("[RateLimiter] Database rate limit fallback to in-memory:", err);
  }

  // Fallback to local memory window
  const mem = memoryCache.get(key)!;
  const allowed = mem.count <= maxAttempts;
  const remaining = Math.max(0, maxAttempts - mem.count);
  const resetAfterSeconds = Math.max(1, Math.ceil((mem.resetAt - now) / 1000));

  return {
    allowed,
    remaining,
    resetAfterSeconds,
  };
}

/**
 * Asserts rate limit, throwing HTTP 429-compatible error if exceeded.
 */
export async function assertRateLimit(options: RateLimitOptions): Promise<void> {
  const result = await checkRateLimit(options);
  if (!result.allowed) {
    // Record security rate limit event asynchronously
    recordSecurityEvent({
      eventType: "rate_limit_exceeded",
      severity: "warn",
      actorId: options.userId ?? null,
      ip: options.ip || getClientIp(),
      metadata: {
        action: options.action,
        maxAttempts: options.maxAttempts,
        resetAfterSeconds: result.resetAfterSeconds,
      },
    }).catch(() => {});

    const err = new Error(
      `Too many requests for ${options.action}. Please try again in ${result.resetAfterSeconds} seconds.`
    );
    (err as any).statusCode = 429;
    (err as any).retryAfter = result.resetAfterSeconds;
    throw err;
  }
}

/**
 * Records a structured security audit event for monitoring & alerting.
 */
export async function recordSecurityEvent(params: {
  eventType: string;
  severity?: "info" | "warn" | "critical";
  actorId?: string | null;
  ip?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ipHash = hashIdentifier(params.ip || getClientIp());

    await supabaseAdmin.from("security_events").insert({
      event_type: params.eventType,
      severity: params.severity ?? "info",
      actor_id: params.actorId ?? null,
      ip_hash: ipHash,
      metadata: params.metadata ?? {},
    });
  } catch (err) {
    console.warn("[Security] Failed to write security event:", err);
  }
}
