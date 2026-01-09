# Lexi Vacation Tracker (Godišnji)

Croatian vacation/leave management system built with Next.js 15, Prisma, and SQLite.

## Architecture

- **Framework:** Next.js 15.1.6 (App Router)
- **Database:** SQLite (local file `prisma/dev.db`)
- **ORM:** Prisma 6.1.0
- **API:** Next.js Route Handlers
- **Frontend:** React 19.0.0 with TypeScript 5.8.2
- **Styling:** Tailwind CSS 3.4.19

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Initialize Database

Generate Prisma client and create the database:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 3. Seed Database

Populate with initial 6 employees:

```bash
npm run prisma:seed
```

### 4. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Database Schema

### Employee

- `id`: Auto-increment primary key
- `name`: Employee full name
- `email`: Unique email address
- `daysCarryOver`: Days from previous year (expire June 30)
- `daysCurrentYear`: Current year allocation
- `isActive`: Soft delete flag

### LeaveRequest

- `id`: Auto-increment primary key
- `employeeId`: Foreign key to Employee
- `startDate`: Leave start date
- `endDate`: Leave end date
- `daysCount`: Business days (auto-calculated)
- `status`: "REQUESTED" | "APPROVED" | "DENIED"
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

## API Routes

### Employees

- `GET /api/employees` - List all employees
- `POST /api/employees` - Create employee
- `GET /api/employees/[id]` - Get employee with requests
- `PATCH /api/employees/[id]` - Update employee

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

## Database Location

SQLite database file: `prisma/dev.db`

To reset the database:

```bash
rm prisma/dev.db
npx prisma migrate dev --name init
npm run prisma:seed
```

## Project Structure

```
/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   ├── dashboard/         # Dashboard page
│   ├── calendar/          # Calendar view
│   ├── employee/[id]/     # Employee detail page
│   ├── settings/          # Settings page
│   └── layout.tsx         # Root layout
├── components/            # Reusable UI components
├── lib/                   # Utility functions
│   ├── prisma.ts          # Prisma client
│   └── holidayCalculator.ts # Business day calculations
├── prisma/                # Database schema and migrations
└── types.ts               # TypeScript type definitions
```
