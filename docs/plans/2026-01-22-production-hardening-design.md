# Production Hardening Design

## Overview

Add rate limiting, security headers, input validation, and Vercel deployment config to prepare the application for production.

## 1. Rate Limiting

**Approach:** In-memory store using a `Map` with IP-based keys and sliding window.

**Location:** `lib/rateLimit.ts`

**Limits:**

- Auth routes (`/api/auth/*`): 5 requests per minute
- Other API routes: 30 requests per minute

**How it works:**

1. Request comes in
2. Extract IP from headers (`x-forwarded-for` or `x-real-ip`)
3. Check Map for request count in current window
4. If over limit: return 429 Too Many Requests
5. If under: increment count, process request
6. Entries auto-expire after window passes

**Limitation:** Each serverless instance has its own Map, so limits aren't shared across instances. Acceptable for basic abuse prevention.

## 2. Security Headers

**Location:** `next.config.js` headers config

**Headers (applied to all routes):**

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-XSS-Protection: 1; mode=block
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## 3. Input Validation with Zod

**Location:** `lib/validations.ts`

**Schemas:**

- `completeInviteSchema` - token (string), password (min 8 chars)
- `passwordResetSchema` - email (valid email format)
- `createProfileSchema` - name, email, role, vacation days
- `updateProfileSchema` - partial version of create
- `createRequestSchema` - startDate, endDate, type, notes (optional)
- `updateRequestSchema` - partial + status for approvals

**Usage pattern:**

```typescript
const body = await request.json();
const result = schema.safeParse(body);
if (!result.success) {
  return NextResponse.json(
    { error: 'Invalid input', details: result.error.flatten() },
    { status: 400 }
  );
}
// Use result.data (typed and validated)
```

## 4. Vercel Deployment

**File:** `vercel.json`

```json
{
  "framework": "nextjs",
  "regions": ["fra1"]
}
```

Region `fra1` (Frankfurt) chosen for proximity to Croatian users.

## Files to Create/Modify

**New files:**

- `lib/rateLimit.ts`
- `lib/validations.ts`
- `vercel.json`

**Modified files:**

- `next.config.js` - add security headers
- `app/api/auth/complete-invite/route.ts` - add validation + rate limit
- `app/api/auth/password-reset/route.ts` - add validation + rate limit
- `app/api/auth/logout/route.ts` - add rate limit
- `app/api/profiles/route.ts` - add validation + rate limit
- `app/api/profiles/[id]/route.ts` - add validation + rate limit
- `app/api/profiles/[id]/reinvite/route.ts` - add rate limit
- `app/api/requests/route.ts` - add validation + rate limit
- `app/api/requests/[id]/route.ts` - add validation + rate limit

**New dependency:**

- `zod`
