# Lexi Vacation Tracker - Claude Guidelines

## Quick Start

```bash
npm run dev          # Development server on port 3000
npm test             # Run tests
npm run lint:fix     # Fix linting issues
npm run prisma:studio # Database GUI
```

## Project-Specific Skills

Two custom skills are available for this project:

1. **lexi-supabase-auth** - Authentication and authorization patterns (includes MCP usage)
2. **lexi-design-system** - UI component patterns and design tokens

## Supabase MCP

This project has Supabase MCP configured (`.mcp.json`). MCP tools provide direct access to:

- **Database**: Query tables, inspect schemas, run SQL
- **Auth**: List users, check user status
- **Storage**: Browse buckets and files
- **Project settings**: Configuration and metadata

Use MCP for debugging and exploration, not for building runtime features.

## Architecture Overview

```
app/
  api/           → Route Handlers (REST API)
  admin/         → Admin-only pages (users, requests, calendar)
  dashboard/     → User dashboard
  auth/          → Auth pages (login, accept invite)
components/      → Shared React components
lib/
  supabase.ts    → Supabase client factories
  auth.ts        → getAuthenticatedProfile() helper
  prisma.ts      → Prisma client singleton
  vacationBalance.ts → Balance calculation utilities
  holidayCalculator.ts → Business day calculations
prisma/
  schema.prisma  → Database schema
  seed.ts        → Admin user seeding
```

## Key Business Logic

### Vacation Balance Updates

When approving leave requests, use the utility functions:

```typescript
import { deductDays, refundDays } from '@/lib/vacationBalance';

// On APPROVE: deduct (carry-over first, then current year)
const newBalance = deductDays(profile, daysCount);

// On EDIT/DELETE of APPROVED request: refund (always to current year)
const newBalance = refundDays(profile, daysCount);
```

### Croatian Holidays

`calculateBusinessDays()` in `/lib/holidayCalculator.ts` excludes:

- Weekends
- All Croatian public holidays (2026-2029)
- Including variable dates (Easter Monday, Corpus Christi)

## Testing Conventions

- Tests live in `__tests__/` folders next to source files
- Naming: `*.test.ts` or `*.test.tsx`
- Focus on business logic tests, not UI

## Development Patterns

### Adding a New Protected API Route

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedProfile } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const profile = await getAuthenticatedProfile();

  if (!profile) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // For admin-only routes:
  if (profile.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Your logic here...
}
```

### Adding a New Page

1. Create file in `app/` directory
2. For client interactivity, add `'use client'` directive
3. Follow design system patterns (see lexi-design-system skill)
4. For admin pages, add client-side role check:

```typescript
useEffect(() => {
  async function checkRole() {
    const res = await fetch('/api/profile/me');
    const profile = await res.json();
    if (profile?.role !== 'ADMIN') {
      router.push('/access-denied');
    }
  }
  checkRole();
}, []);
```

## Common Commands

```bash
# Database
npx prisma db push              # Apply schema changes
npx prisma migrate dev          # Create migration
npm run prisma:seed             # Seed admin user

# Code Quality
npm run type-check              # TypeScript check
npm run lint:fix                # Auto-fix lint issues
npm run format                  # Format with Prettier

# Testing
npm test                        # Run all tests
npm run test:watch              # Watch mode
npm run test:coverage           # Coverage report
```

## Environment Variables

Required in `.env.local`:

- `DATABASE_URL` - Supabase PostgreSQL (Session Pooler)
- `DIRECT_URL` - Direct PostgreSQL for migrations
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Server-side only
- `SENDGRID_API_KEY` - Email sending
- `SENDGRID_FROM_EMAIL` - Verified sender
