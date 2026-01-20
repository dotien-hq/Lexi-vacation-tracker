# Production Deployment Action Plan

**Date:** 2026-01-19
**Target:** Vercel + Supabase Pro
**Estimated Total Time:** 2-3 hours

---

## Phase 1: Critical Fixes (Before Deployment)

### 1.1 Remove Unused GEMINI_API_KEY

**File:** `next.config.js`

**Current:**

```js
const nextConfig = {
  reactStrictMode: true,
  env: {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  },
};
```

**Change to:**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = nextConfig;
```

**Time:** 5 minutes

---

### 1.2 Add Error Boundary

**Create:** `app/error.tsx`

```tsx
'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console (replace with Sentry in future)
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Došlo je do greške</h2>
        <p className="text-slate-600 mb-6">Nešto je pošlo po zlu. Molimo pokušajte ponovno.</p>
        <button
          onClick={reset}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Pokušaj ponovno
        </button>
      </div>
    </div>
  );
}
```

**Time:** 15 minutes

---

### 1.3 Add Health Check Endpoint

**Create:** `app/api/health/route.ts`

```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
```

**Time:** 15 minutes

---

### 1.4 Add Favicon and Meta Tags

**Step 1:** Add favicon files to `app/` directory:

- `favicon.ico` (32x32)
- `apple-touch-icon.png` (180x180)

**Step 2:** Update `app/layout.tsx` metadata:

```tsx
export const metadata: Metadata = {
  title: 'Lexi Vacation Tracker',
  description: 'Croatian vacation/leave management system',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Lexi Vacation Tracker',
    description: 'Croatian vacation/leave management system',
    type: 'website',
  },
};
```

**Time:** 30 minutes (including favicon creation)

---

## Phase 2: Supabase Configuration

### 2.1 Keep Free Tier (Internal App)

**Note:** Staying on free tier for now since this is an internal app. Be aware:

- Projects pause after 7 days of inactivity (can be resumed manually)
- Limited to 500 MB database space
- 2 GB bandwidth per month
- Consider upgrading to Pro ($25/month) if:
  - App needs to be always-on without manual intervention
  - Usage exceeds free tier limits
  - Moving to external/customer-facing use

---

### 2.2 Configure Auth for Production

1. **Site URL:** Go to **Authentication → URL Configuration**
   - Set Site URL to your production domain (e.g., `https://vacation.yourcompany.com`)

2. **Redirect URLs:** Add allowed redirect URLs:
   - `https://vacation.yourcompany.com/**`
   - Keep `http://localhost:3000/**` for local development

3. **Email Templates (Optional):** Customize in **Authentication → Email Templates**

---

### 2.3 Get Production Connection Strings

1. Go to **Project Settings → Database**
2. Copy **Transaction Pooler** connection string for `DATABASE_URL`
3. Copy **Session Mode** connection string for `DIRECT_URL`

---

## Phase 3: Vercel Deployment

### 3.1 Connect Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New → Project**
3. Import your Git repository
4. Framework preset: **Next.js** (auto-detected)

---

### 3.2 Configure Environment Variables

Add these in **Settings → Environment Variables**:

| Variable                        | Value                 | Environment |
| ------------------------------- | --------------------- | ----------- |
| `DATABASE_URL`                  | (from Supabase)       | Production  |
| `DIRECT_URL`                    | (from Supabase)       | Production  |
| `NEXT_PUBLIC_SUPABASE_URL`      | Your Supabase URL     | Production  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key              | Production  |
| `SUPABASE_SERVICE_ROLE_KEY`     | Service role key      | Production  |
| `SENDGRID_API_KEY`              | Your SendGrid key     | Production  |
| `SENDGRID_FROM_EMAIL`           | Verified sender email | Production  |
| `NEXT_PUBLIC_APP_URL`           | Production URL        | Production  |
| `ADMIN_EMAIL`                   | Initial admin email   | Production  |
| `ADMIN_NAME`                    | Initial admin name    | Production  |
| `ADMIN_PASSWORD`                | Secure password       | Production  |

---

### 3.3 Deploy

1. Click **Deploy**
2. Wait for build to complete (~2-3 minutes)
3. Note the generated URL (e.g., `lexi-vacation-tracker.vercel.app`)

---

### 3.4 Seed Database (One-Time)

After first deployment, run the seed script:

**Option A:** Via Vercel CLI

```bash
vercel env pull .env.production.local
npx prisma db push
npm run prisma:seed
```

**Option B:** Seed locally pointing to production DB

```bash
# Set DATABASE_URL to production value
export DATABASE_URL="your-production-connection-string"
npm run prisma:seed
```

---

### 3.5 Configure Custom Domain (Optional)

1. Go to **Settings → Domains**
2. Add your domain (e.g., `vacation.yourcompany.com`)
3. Follow DNS configuration instructions
4. Update `NEXT_PUBLIC_APP_URL` to the custom domain
5. Update Supabase redirect URLs

---

## Phase 4: Post-Deployment Verification

### 4.1 Health Check

```bash
curl https://your-app.vercel.app/api/health
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2026-01-19T...",
  "database": "connected"
}
```

---

### 4.2 Login Test

1. Navigate to production URL
2. Login with admin credentials
3. Verify dashboard loads correctly

---

### 4.3 Invite Test

1. Create a test employee invitation
2. Check email delivery
3. Accept invitation with the link
4. Verify new user can login

---

### 4.4 Leave Request Test

1. Submit a leave request as user
2. Approve as admin
3. Verify day balance updates correctly

---

## Phase 5: Optional Improvements (Post-Launch)

### 5.1 Add Rate Limiting

Use Vercel's built-in rate limiting or add middleware:

```ts
// middleware.ts - add rate limit check
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
```

**When:** After launch if abuse detected

---

### 5.2 Add Error Tracking (Sentry)

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

**When:** When you want proactive error monitoring

---

### 5.3 Add CSP Headers

Create `middleware.ts` security headers or use `next.config.js`:

```js
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; ...",
  },
];
```

**When:** Before public exposure (not critical for internal app)

---

## Checklist

### Before Deployment

- [ ] Remove GEMINI_API_KEY from next.config.js
- [ ] Add app/error.tsx
- [ ] Add app/api/health/route.ts
- [ ] Add favicon and update metadata

### Deployment

- [ ] Connect repo to Vercel
- [ ] Add all environment variables
- [ ] Deploy to production
- [ ] Seed database with admin user

### After Deployment

- [ ] Verify health endpoint
- [ ] Test admin login
- [ ] Test invitation flow
- [ ] Test leave request flow
- [ ] Configure custom domain (optional)

---

## Rollback Plan

If issues occur after deployment:

1. **Vercel:** Click "Redeploy" on previous working deployment
2. **Database:** Supabase Pro includes daily backups; restore from dashboard
3. **Urgent:** Vercel allows instant rollback to any previous deployment

---

## Support Contacts

- **Vercel Status:** https://vercel-status.com
- **Supabase Status:** https://status.supabase.com
- **SendGrid Status:** https://status.sendgrid.com

---

## Monthly Cost Summary

| Service   | Plan  | Cost         |
| --------- | ----- | ------------ |
| Vercel    | Hobby | $0           |
| Supabase  | Free  | $0           |
| SendGrid  | Free  | $0           |
| **Total** |       | **$0/month** |

**Note:** Supabase free tier pauses after 7 days inactivity. Resume manually from dashboard if needed.
