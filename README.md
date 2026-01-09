# Lexi Vacation Tracker (Godišnji)

Croatian vacation/leave management system built with Next.js 14, Prisma, and SQLite.

## Architecture

- **Framework:** Next.js 14 (App Router)
- **Database:** SQLite (local file `prisma/dev.db`)
- **ORM:** Prisma
- **API:** Next.js API Routes (Server Actions / Route Handlers)
- **Frontend:** React 19 with TypeScript

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

- Days are refunded to `daysCurrentYear` (safety measure per PRD)

### Business Day Calculation

Excludes:

- Weekends (Saturday, Sunday)
- Croatian public holidays including:
  - **Nov 1:** All Saints' Day
  - **Nov 18:** Remembrance Day
  - All other Croatian national holidays (2026-2029)

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

## Prisma Commands

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

## Development

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

Create `.env.local`:

```
GEMINI_API_KEY=your_api_key_here
```

## Database Location

SQLite database file: `prisma/dev.db`

To reset the database:

```bash
rm prisma/dev.db
npx prisma migrate dev --name init
npm run prisma:seed
```
