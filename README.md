# Lexi Vacation Tracker

Vacation/leave management system built with Next.js 15, Prisma, and Supabase PostgreSQL.

## Architecture

- **Framework:** Next.js 15.1.6 (App Router)
- **Database:** PostgreSQL (Supabase hosted)
- **ORM:** Prisma 6.1.0
- **Auth:** Supabase Auth (magic link / passwordless)
- **API:** Next.js Route Handlers
- **Frontend:** React 19.0.0 with TypeScript 5.8.2
- **Styling:** Tailwind CSS 3.4.19
- **Email:** SendGrid for transactional emails

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env.local
```

Required environment variables:

- `DATABASE_URL` - Supabase PostgreSQL connection (Session Pooler recommended for IPv4)
- `DIRECT_URL` - Direct PostgreSQL connection for migrations
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only)
- `SENDGRID_API_KEY` - SendGrid API key for emails
- `SENDGRID_FROM_EMAIL` - Verified sender email address
- `ADMIN_EMAIL` - Email for initial admin account
- `ADMIN_NAME` - Name for initial admin account

### 3. Initialize Database

Generate Prisma client and push schema to database:

```bash
npx prisma generate
npx prisma db push
```

### 4. Seed Database

Create the initial admin user:

```bash
npm run prisma:seed
```

### 5. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Database Schema

### Profile

- `id`: UUID primary key
- `email`: Unique email address
- `fullName`: User's full name
- `role`: USER | ADMIN
- `daysCarryOver`: Days from previous year (expire June 30)
- `daysCurrentYear`: Current year allocation (default: 20)
- `isActive`: Soft delete flag

### LeaveRequest

- `id`: CUID primary key
- `profileId`: Foreign key to Profile
- `startDate`: Leave start date
- `endDate`: Leave end date
- `daysCount`: Business days (auto-calculated)
- `status`: REQUESTED | APPROVED | DENIED
- `rejectionReason`: Optional reason for denial
- `createdAt`: Timestamp

## Business Logic

### Day Deduction

When a leave request is approved:

1. Days are deducted from `daysCarryOver` first
2. Remaining days are deducted from `daysCurrentYear`

### Day Refund

When an approved request is edited or deleted:

- Days are refunded to `daysCurrentYear` (safety measure)

### Business Day Calculation

Excludes:

- Weekends (Saturday, Sunday)
- Croatian public holidays (2026-2029) including:
  - **Jan 1:** New Year's Day
  - **Jan 6:** Epiphany
  - **Easter Sunday & Monday** (variable dates)
  - **May 1:** Labour Day
  - **May 30:** Statehood Day
  - **Corpus Christi** (variable date)
  - **Jun 22:** Anti-Fascist Struggle Day
  - **Aug 5:** Victory and Homeland Thanksgiving Day
  - **Aug 15:** Assumption of Mary
  - **Nov 1:** All Saints' Day
  - **Nov 18:** Remembrance Day
  - **Dec 25:** Christmas Day
  - **Dec 26:** St. Stephen's Day

## Invitation Flow

### Admin Workflow

1. Admin creates employee profile with vacation days allocation
2. System generates secure invitation token (32 chars, 7-day expiry)
3. Invitation email sent via SendGrid with acceptance link
4. Profile status: PENDING (cannot access system yet)

### Employee Activation

1. Employee receives email with invitation link
2. Clicks link → lands on `/auth/accept?token=xxx`
3. Sets password (min 8 characters)
4. System creates Supabase Auth user
5. Profile linked to Auth user (authUserId)
6. Profile status: ACTIVE → access granted

### Re-invitation

- Admin can resend invitation for PENDING users
- Generates new token, invalidates previous
- Cannot re-invite ACTIVE users

### Security

- Tokens: SHA-256 hashed, crypto-secure random
- Expiry: 7 days (configurable)
- Timing-safe token comparison
- Auth guard enforces ACTIVE status on all protected routes

## Authentication Features

### Logout

Users can sign out using the "Sign Out" button in the navigation bar. This:

- Calls `/api/auth/logout` to terminate the Supabase session
- Redirects to the login page
- Clears all auth state

### Password Reset

Users who forget their password can reset it:

1. Click "Forgot your password?" on the login page
2. Enter email address at `/auth/forgot-password`
3. Receive email with reset link from Supabase
4. Click link to set new password at `/auth/reset-password`
5. Automatically signed in and redirected to dashboard

### Auth Context

The app provides a global auth context via `AuthProvider`:

```typescript
import { useAuth } from '@/lib/auth-context';

function MyComponent() {
  const { user, profile, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Not authenticated</div>;

  return <div>Welcome {profile.fullName}</div>;
}
```

### Role-Based Access Control

Middleware protects routes by both authentication and authorization:

- `/dashboard/*` - Requires valid session (USER or ADMIN)
- `/admin/*` - Requires valid session AND ADMIN role
- Non-admins redirected to `/access-denied` page

## API Routes

### Authentication

- `POST /api/auth/complete-invite` - Complete invitation and set password

### Employees

- `GET /api/employees` - List all employees
- `POST /api/employees` - Create employee and send invitation
- `GET /api/employees/[id]` - Get employee with requests
- `PATCH /api/employees/[id]` - Update employee
- `POST /api/employees/[id]/reinvite` - Resend invitation email

### Leave Requests

- `GET /api/requests` - List all requests
- `POST /api/requests` - Create request
- `PATCH /api/requests/[id]` - Update request (status or dates)
- `DELETE /api/requests/[id]` - Delete request

### Backup

- `GET /api/backup` - Export full database to JSON

## Development Commands

### Running the App

```bash
# Development server (port 3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Database Management

```bash
# Generate Prisma Client
npm run prisma:generate

# Push schema changes to database
npx prisma db push

# Create migration
npm run prisma:migrate

# Seed database
npm run prisma:seed

# Open Prisma Studio (GUI)
npm run prisma:studio
```

### Code Quality

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate test coverage
npm run test:coverage

# Lint code
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format

# Check formatting
npm run format:check

# Type check
npm run type-check
```

## Development Practices

### Pre-commit Hooks

The project uses Husky and lint-staged to automatically:

- Run ESLint with auto-fix on staged files
- Format code with Prettier
- Ensure code quality before commits

### Testing

- **Framework:** Vitest with React Testing Library
- **Location:** Tests in `__tests__` folders next to source files
- **Naming:** `*.test.ts` or `*.test.tsx`

### Code Style

- **Linting:** ESLint 8.57 with Next.js and TypeScript rules
- **Formatting:** Prettier with consistent configuration
- **Type Safety:** TypeScript strict mode

## Database Connection

This project uses Supabase PostgreSQL with the Session Pooler for IPv4 compatibility.

Connection string format:

```
postgresql://postgres.[project-ref]:[password]@aws-1-eu-west-1.pooler.supabase.com:5432/postgres
```

To reset the database:

```bash
npx prisma db push --force-reset
npm run prisma:seed
```

## Project Structure

```
/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Dashboard page
│   ├── calendar/          # Calendar view
│   ├── employee/[id]/     # Employee detail page
│   ├── settings/          # Settings page
│   └── layout.tsx         # Root layout
├── components/            # Reusable UI components
├── lib/                   # Utility functions
│   ├── prisma.ts          # Prisma client
│   ├── supabase/          # Supabase client utilities
│   └── holidayCalculator.ts # Business day calculations
├── prisma/                # Database schema and migrations
│   ├── schema.prisma      # PostgreSQL schema
│   └── seed.ts            # Admin user seed script
└── types.ts               # TypeScript type definitions
```
