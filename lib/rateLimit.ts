import { NextRequest, NextResponse } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store - each serverless instance has its own
const rateLimitStore = new Map<string, RateLimitEntry>();

// For testing: clear the rate limit store
export function clearRateLimitStore() {
  rateLimitStore.clear();
}

// Clean up expired entries periodically
const CLEANUP_INTERVAL = 60000; // 1 minute
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}

function getClientIp(request: NextRequest): string {
  // Try x-forwarded-for first (set by proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  // Try x-real-ip (set by some proxies)
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Fallback
  return 'unknown';
}

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

// Preset configurations
export const RATE_LIMITS = {
  auth: { windowMs: 60000, maxRequests: 5 }, // 5 per minute for auth
  api: { windowMs: 60000, maxRequests: 30 }, // 30 per minute for general API
} as const;

export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig,
  prefix: string = 'default'
): { allowed: boolean; remaining: number; resetIn: number } {
  cleanup();

  const ip = getClientIp(request);
  const key = `${prefix}:${ip}`;
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  // No existing entry or expired - create new
  if (!entry || entry.resetTime < now) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs,
    };
  }

  // Check if over limit
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: entry.resetTime - now,
    };
  }

  // Increment and allow
  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetIn: entry.resetTime - now,
  };
}

export function rateLimitResponse(resetIn: number): NextResponse {
  const retryAfter = Math.ceil(resetIn / 1000);
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Reset': String(retryAfter),
      },
    }
  );
}

// Convenience function to apply rate limiting
export function withRateLimit(
  request: NextRequest,
  config: RateLimitConfig = RATE_LIMITS.api,
  prefix?: string
): NextResponse | null {
  const result = checkRateLimit(request, config, prefix);
  if (!result.allowed) {
    return rateLimitResponse(result.resetIn);
  }
  return null;
}
