# Migration Guide: Vite + localStorage → Next.js + Prisma

## What Changed

### Architecture

- ❌ **Removed**: Vite build system
- ❌ **Removed**: React Router DOM (HashRouter)
- ❌ **Removed**: localStorage persistence
- ❌ **Removed**: Client-side state management hook
- ✅ **Added**: Next.js 14 App Router
- ✅ **Added**: Prisma ORM with SQLite
- ✅ **Added**: Server-side API routes
- ✅ **Added**: Database migrations and seeding

### File Structure Changes

**Deleted/Replaced:**

- `vite.config.ts` → `next.config.js`
- `index.html` → Not needed (Next.js handles)
- `index.tsx` → `app/page.tsx`
- `App.tsx` → `app/layout.tsx`
- `store/useVacationStore.ts` → API routes in `app/api/`

**New Files:**

- `prisma/schema.prisma` - Database schema
- `prisma/seed.ts` - Initial data seeding
- `lib/prisma.ts` - Prisma client singleton
- `app/api/**/*.ts` - All API endpoints
- `app/layout.tsx` - Root layout
- `next.config.js` - Next.js configuration

**Preserved:**

- `lib/holidayCalculator.ts` - Updated with Nov 1 & 18
- `types.ts` - Same interfaces
- `components/` - Will need client-side updates
- `pages/` - Will need conversion to Next.js pages

## Setup Instructions

### 1. Clean Old Build Artifacts

```bash
# Remove old dependencies and build files
rm -rf node_modules package-lock.json dist .vite
```

### 2. Install New Dependencies

```bash
npm install
```

### 3. Initialize Database

```bash
# Generate Prisma Client
npx prisma generate

# Create database and run migrations
npx prisma migrate dev --name init
```

### 4. Seed Database

```bash
npm run prisma:seed
```

You should see:

```
Seeding database...
Created 6 employees
```

### 5. Verify Database

```bash
npm run prisma:studio
```

This opens Prisma Studio at `http://localhost:5555` where you can view your data.

### 6. Start Development Server

```bash
npm run dev
```

App runs at `http://localhost:3000`

## API Endpoints Reference

All data operations now go through API routes:

### Employees

```typescript
// Get all employees
GET /api/employees

// Create employee
POST /api/employees
Body: { name, email, daysCarryOver, daysCurrentYear }

// Get single employee with requests
GET /api/employees/[id]

// Update employee
PATCH /api/employees/[id]
Body: { name?, email?, daysCarryOver?, daysCurrentYear?, isActive? }
```

### Leave Requests

```typescript
// Get all requests
GET / api / requests;

// Create request
POST / api / requests;
Body: {
  employeeId, startDate, endDate;
}

// Update request status
PATCH / api / requests / [id];
Body: {
  status: 'REQUESTED' | 'APPROVED' | 'DENIED';
}

// Update request dates (refunds if approved, resets to REQUESTED)
PATCH / api / requests / [id];
Body: {
  startDate, endDate;
}

// Delete request (refunds days if approved)
DELETE / api / requests / [id];
```

### Backup

```typescript
// Export database to JSON
GET / api / backup;
```

## Business Logic Implementation

### Day Deduction (Approval)

When `PATCH /api/requests/[id]` with `status: "APPROVED"`:

1. Fetch current employee days
2. Deduct from `daysCarryOver` first
3. Deduct remaining from `daysCurrentYear`
4. Update employee record
5. Update request status

### Day Refund (Edit/Delete)

When editing dates or deleting an approved request:

1. Check if request was `APPROVED`
2. Refund `daysCount` to employee's `daysCurrentYear`
3. For edits: recalculate days, reset status to `REQUESTED`
4. For deletes: remove request record

## Next Steps

### Convert Existing Pages

The old `pages/` directory components need to be converted to Next.js:

1. **Dashboard.tsx** → `app/dashboard/page.tsx`

   - Add `'use client'` directive
   - Replace `useVacationStore()` with `fetch('/api/employees')`
   - Use `useState` + `useEffect` for data fetching

2. **EmployeeDetail.tsx** → `app/employees/[id]/page.tsx`

   - Fetch from `/api/employees/[id]`
   - Handle request creation via `POST /api/requests`

3. **CalendarPage.tsx** → `app/calendar/page.tsx`

   - Fetch from `/api/requests`
   - Display calendar view

4. **SettingsPage.tsx** → `app/settings/page.tsx`
   - Fetch from `/api/employees`
   - Handle employee CRUD operations

### Update Components

**Layout.tsx** needs minimal changes:

- Replace `react-router-dom` `Link` with `next/link`
- Replace `useNavigate` with `useRouter` from `next/navigation`

## Troubleshooting

### Database Issues

**Reset database:**

```bash
rm prisma/dev.db
npx prisma migrate dev --name init
npm run prisma:seed
```

**View database:**

```bash
npm run prisma:studio
```

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Prisma Client Not Generated

```bash
npx prisma generate
```

## Verification Checklist

- [ ] Database created at `prisma/dev.db`
- [ ] 6 employees seeded
- [ ] Dev server runs on port 3000
- [ ] API routes respond correctly
- [ ] Business day calculation includes Nov 1 & 18
- [ ] Day deduction logic works (carry-over first)
- [ ] Day refund logic works (to currentYear)
