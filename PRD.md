Master PRD: Croatian Vacation SaaS (Production Build)
Role: Lead Full-Stack Architect. Goal: Build a production-ready, multi-tenant vacation tracker with Authentication, RBAC, and Email Notifications.

1. Tech Stack (Strict)
   Framework: Next.js 14+ (App Router).

Database: PostgreSQL (hosted on Supabase).

ORM: Prisma.

Auth: Supabase Auth (Passwordless / Magic Link).

Email: SendGrid (@sendgrid/mail).

Styling: Tailwind CSS + Shadcn/UI (if available) or standard CSS.

2. Database Schema (Prisma + Supabase)
   We will use Prisma to manage the Supabase Postgres instance.

Code snippet

generator client {
provider = "prisma-client-js"
}

datasource db {
provider = "postgresql"
url = env("DATABASE_URL")
directUrl= env("DIRECT_URL") // Required for Supabase migrations
}

enum Role {
USER
ADMIN
}

enum RequestStatus {
REQUESTED
APPROVED
DENIED
}

// Mirroring Supabase Auth User in public schema for app data
model Profile {
id String @id @default(uuid()) // Links to auth.users.id
email String @unique
fullName String?
role Role @default(USER)

// Vacation Balance
daysCarryOver Int @default(0) // Old days (expire June 30)
daysCurrentYear Int @default(20) // New days

isActive Boolean @default(true)

requests LeaveRequest[]
}

model LeaveRequest {
id String @id @default(cuid())
profileId String
profile Profile @relation(fields: [profileId], references: [id])
startDate DateTime
endDate DateTime
daysCount Int // Calculated business days
status RequestStatus @default(REQUESTED)
rejectionReason String? // Only if denied
createdAt DateTime @default(now())
} 3. Authentication Flow (Invite Only)
Login: Users enter email -> Supabase sends Magic Link -> User is logged in.

Sign Up Restriction: The app is Invite Only.

Logic: A user cannot just "Sign Up". The Admin must create a Profile first in the dashboard.

Middleware: On login, check if Profile exists for that email. If not, show "Access Denied."

4. Role-Based Access Control (RBAC)
   Implement Next.js Middleware to protect routes:

/admin/\*\* -> Only allow if profile.role === 'ADMIN'.

/dashboard/\*\* -> Allow any authenticated Profile.

5. Feature Requirements
   A. Admin Dashboard (/admin)
   User Management:

List all profiles.

Invite User: Form (Email, Name, Days Balance) -> Creates Profile record -> Triggers SendGrid email: "You are invited! Click here to login: [Link]".

Edit User: Update balance, Archive (Soft delete).

Request Management:

Inbox of REQUESTED items.

Approve: Deducts daysCarryOver first, then daysCurrentYear. Triggers Email.

Deny: Modal input for rejectionReason. Triggers Email.

Team Calendar:

Visual calendar showing all APPROVED leaves to spot overlaps.

B. User Dashboard (/dashboard)
My Stats: View remaining days (Old & New).

Request Form: Date pickers (Start/End).

Validation: Calculate days excluding weekends/holidays. If balance insufficient, disable submit.

My History: List of past requests and status.

Visibility: Users CANNOT see other users' data or calendar.

6. Business Logic (The Brain)
   Crucial: Create a utility calculateBusinessDays that excludes:

Weekends: Saturday, Sunday.

Croatian Holidays:

Nov 1 (All Saints), Nov 18 (Remembrance).

Jan 1, Jan 6, Easter Mon, Corpus Christi, May 1, May 30, Jun 22, Aug 5, Aug 15, Dec 25, Dec 26.

7. Email Automation (SendGrid)
   Create a helper lib/email.ts.

On Invite: Send to User (Magic Link).

On New Request: Send to Admin ("New request from [Name]").

On Decision: Send to User ("Approved" or "Denied: [Reason]").

8. Implementation Steps for Agent
   Install dependencies (@supabase/supabase-js, @sendgrid/mail, prisma).

Initialize Prisma and push schema to Supabase.

Set up Supabase Auth Helpers for Next.js.

Build the API routes for Email and Request logic.

Build the Frontend UI (Admin vs User views).

Seed Data: Create a script to insert the First Admin profile (using the email provided in .env ADMIN_EMAIL) so you can log in the first time.

Step 3: Deployment (When ready)
Once the agent finishes coding:

Run npx prisma db push to sync your database.

Run npm run dev.

First Time Login: The app will be locked. You need to manually insert your own email into the Profile table in Supabase (or use the seed script) and set your role to ADMIN. Then, log in via the UI.
