# Test Coverage and Documentation Gaps Analysis

**Analysis Date:** 2026-01-18
**Branch:** feat/supabase-auth
**Status:** Comprehensive review of test coverage and documentation

---

## Executive Summary

The codebase has excellent foundational testing for utility functions (100% coverage) and good feature documentation. However, there are critical gaps in API endpoint testing and React component testing, plus missing developer guides for testing, deployment, and API reference documentation.

### Current Test Coverage

- **Tested (100%)**: Utility functions (holiday calculator, vacation balance, tokens, email service)
- **Minimal (<30%)**: API endpoints (only auth and profile creation)
- **Untested (0%)**: Leave request API, most profile management, all React components, middleware

### Current Documentation

- **Excellent**: Feature docs (README, AUTH-FLOW-FEATURE, SENDGRID_SETUP)
- **Missing**: API reference, testing guide, deployment guide, contributing guide, component docs

---

## PRIORITY 1: Critical Test Coverage Gaps (URGENT)

### 1.1 Leave Request API - ZERO TESTS ❌

**Location:** `app/api/requests/`

#### Files Needing Tests:

1. **`app/api/requests/route.ts`**
   - Missing: `app/api/requests/__tests__/route.test.ts`

   **What needs testing:**
   - GET endpoint:
     - Returns user's own requests when role=USER
     - Returns all requests when role=ADMIN
     - Filters by status if provided
     - Returns 401 for unauthenticated

   - POST endpoint:
     - Creates request with valid data
     - Validates start_date < end_date
     - Validates dates are in future
     - Calculates business days correctly (excluding holidays)
     - Checks sufficient balance (carry-over + current)
     - Rejects if insufficient balance
     - Sends email notification to admins
     - Handles email sending failures gracefully
     - Returns 401 for unauthenticated
     - Returns 400 for invalid data

2. **`app/api/requests/[id]/route.ts`**
   - Missing: `app/api/requests/[id]/__tests__/route.test.ts`

   **What needs testing:**
   - PATCH endpoint (APPROVE):
     - Approves request and sets status to APPROVED
     - Deducts vacation days from user's balance
     - Deducts from carry-over first, then current year
     - Updates both request and profile atomically
     - Sends approval email to requester
     - Returns 403 if not admin
     - Returns 404 if request not found
     - Returns 400 if already approved/denied

   - PATCH endpoint (DENY):
     - Denies request and sets status to DENIED
     - Requires rejection_reason
     - Does NOT deduct vacation days
     - Sends denial email with reason
     - Returns 400 if rejection_reason missing

   - PATCH endpoint (EDIT DATES):
     - Allows user to edit their own pending request dates
     - Recalculates business days
     - Validates new dates
     - Returns 403 if not own request
     - Returns 400 if request not pending

   - DELETE endpoint:
     - Deletes request
     - Refunds vacation days to current_year if approved
     - Allows user to delete own pending requests
     - Allows admin to delete any request
     - Returns 403 for unauthorized deletion

**Critical Business Logic at Risk:**

- Balance deduction on approval (transaction atomicity)
- Balance refund on deletion
- Email notifications for admins and users
- Authorization checks

**Recommended Test File Structure:**

```javascript
// app/api/requests/__tests__/route.test.ts
describe('GET /api/requests', () => {
  describe('as USER', () => {
    /* ... */
  });
  describe('as ADMIN', () => {
    /* ... */
  });
  describe('authentication', () => {
    /* ... */
  });
});

describe('POST /api/requests', () => {
  describe('valid requests', () => {
    /* ... */
  });
  describe('date validation', () => {
    /* ... */
  });
  describe('balance validation', () => {
    /* ... */
  });
  describe('business day calculation', () => {
    /* ... */
  });
  describe('admin notifications', () => {
    /* ... */
  });
});

// app/api/requests/[id]/__tests__/route.test.ts
describe('PATCH /api/requests/[id] - Approve', () => {
  it('deducts from carry-over first, then current year');
  it('updates request and profile atomically');
  it('sends approval email');
  it('prevents non-admins from approving');
});

describe('PATCH /api/requests/[id] - Deny', () => {
  it('requires rejection reason');
  it('does not deduct balance');
  it('sends denial email with reason');
});

describe('DELETE /api/requests/[id]', () => {
  it('refunds to current_year if approved');
  it('allows user to delete own pending requests');
  it('allows admin to delete any request');
});
```

---

### 1.2 Profile Management API - MINIMAL TESTS ⚠️

**Location:** `app/api/profiles/`

#### Files Needing Tests:

1. **`app/api/profiles/[id]/route.ts`**
   - Missing: `app/api/profiles/[id]/__tests__/route.test.ts`

   **What needs testing:**
   - PATCH endpoint:
     - Updates vacation balances (carry_over, current_year)
     - Updates user role (USER/ADMIN)
     - Updates profile status (ACTIVE/DEACTIVATED)
     - **CRITICAL**: Prevents user from changing own role
     - **CRITICAL**: Prevents demotion of last active admin
     - Returns 403 if not admin
     - Returns 400 for invalid role change
     - Returns 404 if profile not found

**Critical Business Logic at Risk:**

- Last admin protection (prevents system lockout)
- Self-role-change prevention
- Balance adjustment audit trail

**Recommended Test Cases:**

```javascript
describe('PATCH /api/profiles/[id]', () => {
  describe('role changes', () => {
    it('prevents user from changing own role');
    it('prevents demotion of last active admin');
    it('allows adding new admins');
    it('allows demoting admin when others exist');
  });

  describe('balance updates', () => {
    it('updates carry_over days');
    it('updates current_year days');
    it('accepts zero values');
  });

  describe('status changes', () => {
    it('deactivates active users');
    it('reactivates deactivated users');
  });
});
```

2. **`app/api/profile/me/route.ts`**
   - Missing: `app/api/profile/me/__tests__/route.test.ts`

   **What needs testing:**
   - GET endpoint:
     - Returns current user's profile
     - Returns 401 if not authenticated
     - Returns correct profile structure

---

### 1.3 Middleware & Auth - ZERO TESTS ❌

**Location:** `middleware.ts` and `lib/auth.ts`

#### Files Needing Tests:

1. **`middleware.ts`**
   - Missing: `__tests__/middleware.test.ts`

   **What needs testing:**
   - Redirects unauthenticated users to login
   - Allows public routes (/, /login, /auth/_, /api/auth/_)
   - Protects /dashboard/\* routes
   - Protects /admin/\* routes
   - Protects /api/\* routes (except auth)

2. **`lib/auth.ts`** (getServerSideUser function)
   - Missing: `lib/__tests__/auth.test.ts`

   **What needs testing:**
   - Returns null if no session
   - Fetches user profile from database
   - Returns null if profile not found
   - Returns null if profile status not ACTIVE
   - Caches profile in locals

**Critical Business Logic at Risk:**

- Unauthorized access to protected routes
- Status check enforcement

---

### 1.4 Integration Tests - FAILING ⚠️

**Location:** `__tests__/integration/invitation-flow.test.ts`

**Current Status:** Test file exists with 2 tests, but suite is FAILING

**Issue:** Database connection configuration for tests

- Tests cannot connect to test database
- Needs proper DATABASE_URL configuration for test environment

**What needs fixing:**

1. Configure test database connection
2. Ensure tests run in isolation
3. Add setup/teardown for test data

**Existing Test Coverage (once fixed):**

- Full invitation flow (create invite → accept → login)
- Token invalidation on re-invite

---

## PRIORITY 2: React Component Testing (HIGH)

### 2.1 Zero Component Test Coverage ❌

**Current Status:** React Testing Library is installed but NO component tests exist

#### Critical Components Needing Tests:

1. **`components/Navigation.tsx`**
   - Missing: `components/__tests__/Navigation.test.tsx`

   **What needs testing:**
   - Renders user menu items (Dashboard, Logout) for USER role
   - Renders admin menu items (Dashboard, Users, Requests, Calendar, Logout) for ADMIN role
   - Logout button triggers signOut()
   - Active route highlighting

2. **`components/StatusBadge.tsx`**
   - Missing: `components/__tests__/StatusBadge.test.tsx`

   **What needs testing:**
   - Renders PENDING status with yellow styling
   - Renders ACTIVE status with green styling
   - Renders DEACTIVATED status with gray styling
   - Renders request status (REQUESTED, APPROVED, DENIED)

3. **`app/dashboard/page.tsx`**
   - Missing: `app/dashboard/__tests__/page.test.tsx`

   **What needs testing:**
   - Displays vacation balance correctly
   - Shows carry-over expiry warning (if expires before June 30)
   - Displays "Expires June 30" label for carry-over
   - Calculates total available days
   - Date picker validates future dates
   - Calculates business days on date selection
   - Validates sufficient balance before submission
   - Shows error message if insufficient balance
   - Disables submit if validation fails
   - Displays request history with status badges
   - Shows rejection reason for denied requests

4. **`app/admin/users/page.tsx`**
   - Missing: `app/admin/users/__tests__/page.test.tsx`

   **What needs testing:**
   - Lists all user profiles
   - Shows status badges (PENDING, ACTIVE, DEACTIVATED)
   - "Invite User" modal opens
   - Invitation form validates email format
   - Invitation form allows role selection (USER/ADMIN)
   - Profile editing modal opens with current values
   - Balance editing works
   - Role change works (with safeguards)
   - Archive/activate toggle works
   - Shows "Resend Invitation" for PENDING users

5. **`app/admin/requests/page.tsx`**
   - Missing: `app/admin/requests/__tests__/page.test.tsx`

   **What needs testing:**
   - Lists pending requests
   - Approve button works
   - Deny modal requires rejection reason
   - Shows request details (dates, business days)

6. **`app/admin/calendar/page.tsx`**
   - Missing: `app/admin/calendar/__tests__/page.test.tsx`

   **What needs testing:**
   - Renders calendar for current month
   - Highlights approved leave days
   - Shows employee names on leave days
   - Indicates overlapping leaves
   - Highlights weekends
   - Month navigation works

7. **`app/login/page.tsx`**
   - Missing: `app/login/__tests__/page.test.tsx`

   **What needs testing:**
   - Login form renders
   - Email/password validation
   - Submission triggers Supabase auth
   - Error handling (invalid credentials)

8. **`app/invitation/page.tsx`**
   - Missing: `app/invitation/__tests__/page.test.tsx`

   **What needs testing:**
   - Loads token from query param
   - Shows email from query param
   - Password confirmation validation
   - Submission creates account
   - Redirects to dashboard on success
   - Shows error for invalid/expired token

**Testing Setup Needed:**

```bash
# Already installed:
# - @testing-library/react
# - @testing-library/jest-dom
# - jest-environment-jsdom

# Need to configure:
# - jest.config.js (already exists, verify setup)
# - Mock Supabase client
# - Mock Next.js router
```

---

## PRIORITY 3: Documentation Improvements (MEDIUM)

### 3.1 Missing API Reference Documentation ❌

**Problem:** No centralized API documentation

**Recommendation:** Create `docs/api/README.md` OR implement OpenAPI/Swagger

#### Option A: Manual API Documentation

**Create:** `docs/api/README.md`

**Structure:**

```markdown
# API Reference

## Authentication

- POST /api/auth/complete-invite
- GET /api/auth/callback

## Profiles

- GET /api/profiles (admin)
- POST /api/profiles (admin)
- PATCH /api/profiles/[id] (admin)
- POST /api/profiles/[id]/reinvite (admin)
- GET /api/profile/me

## Leave Requests

- GET /api/requests
- POST /api/requests
- PATCH /api/requests/[id]
- DELETE /api/requests/[id]

[For each endpoint, document:]

- Method & path
- Authentication required
- Authorization (role requirements)
- Request body schema
- Query parameters
- Response schema (success)
- Response schema (errors)
- Example request/response
- Business rules
```

#### Option B: OpenAPI/Swagger Specification

**Create:** `docs/api/openapi.yaml` or use next-swagger-doc

**Benefits:**

- Interactive documentation
- Client SDK generation
- Validation
- Standard format

**Tools to consider:**

- next-swagger-doc
- @nestjs/swagger (if migrating to NestJS)
- Manual YAML with Swagger UI

---

### 3.2 Missing Testing Guide ❌

**Create:** `docs/TESTING.md`

**Content should include:**

```markdown
# Testing Guide

## Overview

- Testing philosophy
- Coverage requirements
- Test types (unit, integration, E2E)

## Running Tests

- npm test (all tests)
- npm test -- --watch (watch mode)
- npm test -- path/to/test (specific test)
- npm run test:coverage (coverage report)

## Writing Tests

### Unit Tests

- Location: **tests** directory next to source
- Naming: _.test.ts or _.test.tsx
- Utilities: lib/**tests**/
- APIs: app/api/[route]/**tests**/

### Component Tests

- Location: components/**tests**/
- Use @testing-library/react
- Mock data and APIs

### Integration Tests

- Location: **tests**/integration/
- Test full flows
- Use test database

## Mocking Strategies

- Mocking Supabase client
- Mocking email service
- Mocking Next.js router
- Mocking date/time (for holiday tests)

## Common Patterns

- Testing API routes
- Testing React components
- Testing database transactions
- Testing email sending

## Continuous Integration

- Pre-commit hooks (Husky)
- GitHub Actions setup

## Troubleshooting

- Common test failures
- Database connection issues
- Mock setup problems
```

---

### 3.3 Missing Deployment Guide ❌

**Create:** `docs/DEPLOYMENT.md`

**Content should include:**

```markdown
# Deployment Guide

## Prerequisites

- Node.js version
- Database (Supabase/PostgreSQL)
- Email service (SendGrid)

## Environment Variables

[Document all required env vars]

- DATABASE_URL
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- SENDGRID_API_KEY
- EMAIL_FROM
- BASE_URL

## Database Setup

- Running migrations
- Seeding initial data (admin user)
- Backup strategy

## Deployment Platforms

### Vercel

- Configuration
- Environment variables
- Database connection

### Other platforms

- Docker setup
- Self-hosting

## Post-Deployment

- Health checks
- Monitoring setup
- Log aggregation
- Error tracking (Sentry?)

## Rollback Procedures

- How to rollback deployment
- How to rollback migrations

## Security Checklist

- Environment variables secured
- SendGrid API key permissions
- Database access restrictions
- CORS configuration
```

---

### 3.4 Missing Contributing Guide ❌

**Create:** `CONTRIBUTING.md`

**Content should include:**

```markdown
# Contributing Guide

## Getting Started

- Fork repository
- Clone locally
- Install dependencies
- Set up development environment

## Development Workflow

- Create feature branch from master
- Follow branch naming convention (feat/, fix/, docs/)
- Make changes
- Write tests
- Run linters
- Commit with conventional commits

## Code Standards

- TypeScript strict mode
- ESLint configuration
- Prettier formatting
- No unused variables/imports

## Testing Requirements

- All new features must have tests
- Maintain >80% coverage for new code
- Integration tests for user flows
- Component tests for UI changes

## Commit Message Format

[Use conventional commits]

- feat: new feature
- fix: bug fix
- docs: documentation
- test: test changes
- refactor: code refactoring
- chore: maintenance

## Pull Request Process

- Create PR against master
- Link related issues
- Fill out PR template
- Ensure CI passes
- Request review
- Address feedback

## Code Review Guidelines

- What reviewers look for
- Response expectations

## Release Process

- Version bumping
- Changelog updates
- Tag creation
```

---

### 3.5 Outdated Documentation ⚠️

#### Update Required: `PRD.md`

**Issues:**

- References magic link authentication (now uses password)
- Doesn't mention admin role in invite flow
- Missing recent features (re-invitation, status management, calendar)

**Recommendation:** Either:

1. Update to reflect current state
2. Rename to `PRD-HISTORICAL.md` and create new feature doc
3. Move to `docs/historical/` folder

---

### 3.6 Missing Component Documentation ❌

**Problem:** No documentation for React components

**Recommendations:**

#### Option A: JSDoc Comments in Components

Add detailed JSDoc comments to all components:

```typescript
/**
 * Navigation component with role-based menu
 *
 * @component
 * @example
 * <Navigation />
 *
 * Displays different menu items based on user role:
 * - USER: Dashboard, Logout
 * - ADMIN: Dashboard, Users, Requests, Calendar, Logout
 */
```

#### Option B: Storybook Setup

- Install Storybook
- Create stories for each component
- Visual regression testing
- Component documentation site

**Create:** `docs/COMPONENTS.md` at minimum

```markdown
# Component Reference

## Navigation

- Location: components/Navigation.tsx
- Purpose: Role-based navigation menu
- Props: None (reads from auth context)
- Variants: USER menu, ADMIN menu

## StatusBadge

- Location: components/StatusBadge.tsx
- Purpose: Visual status indicator
- Props: status (string)
- Variants: PENDING, ACTIVE, DEACTIVATED, REQUESTED, APPROVED, DENIED

[etc. for all components]
```

---

### 3.7 Missing Database Documentation ❌

**Create:** `docs/DATABASE.md`

**Content should include:**

```markdown
# Database Documentation

## Schema Overview

- Entity relationship diagram
- Table descriptions

## Profiles Table

- Fields and types
- Constraints
- Indexes
- Relationships

## Leave Requests Table

- Fields and types
- Constraints
- Indexes
- Relationships

## Invitation Tokens Table

- Fields and types
- Constraints
- Indexes
- Purpose and lifecycle

## Migration History

- How migrations are managed
- Migration naming convention
- Rollback procedures

## Design Decisions

- Why carry_over and current_year are separate
- Token expiry strategy (7 days)
- Status enum values
- Cascade delete behaviors

## Query Patterns

- Common queries
- Performance considerations
- Index usage

## Backup and Recovery

- Backup strategy
- Point-in-time recovery
- Data retention policy
```

---

## PRIORITY 4: Integration & E2E Testing (MEDIUM)

### 4.1 Fix Existing Integration Test

**File:** `__tests__/integration/invitation-flow.test.ts`

**Status:** FAILING due to database configuration

**Action Items:**

1. Fix DATABASE_URL for test environment
2. Configure test database isolation
3. Add setup/teardown scripts
4. Ensure tests pass
5. Document test database setup in TESTING.md

---

### 4.2 Add E2E Tests (Future)

**Recommendation:** Set up Playwright or Cypress

**Critical Flows to Test:**

1. **User Flow:**
   - Receive invitation email
   - Click invitation link
   - Set password
   - Login
   - Submit leave request
   - View request history

2. **Admin Flow:**
   - Login as admin
   - Invite new user
   - Approve leave request
   - View calendar
   - Edit user vacation balance

3. **Edge Cases:**
   - Expired invitation token
   - Insufficient vacation balance
   - Last admin protection
   - Concurrent request handling

**Create:** `__tests__/e2e/` directory with Playwright/Cypress setup

---

## PRIORITY 5: Code Documentation (LOW)

### 5.1 Add JSDoc Comments

**Areas Needing Documentation:**

1. **Utility Functions**
   - `lib/holidayCalculator.ts` - Document Croatian holiday logic
   - `lib/vacationBalance.ts` - Document deduction/refund rules
   - `lib/tokens.ts` - Document token generation and hashing

2. **API Route Handlers**
   - Add JSDoc to all route handlers explaining:
     - Purpose
     - Authentication requirements
     - Authorization rules
     - Request/response schemas
     - Business logic

3. **Complex Business Logic**
   - Balance deduction priority (carry-over first)
   - Balance refund policy (always to current_year)
   - Token expiry and validation
   - Last admin protection logic

---

## Summary & Recommended Action Plan

### Phase 1: Critical Testing (1-2 weeks)

1. ✅ Add tests for Leave Request API (highest priority)
2. ✅ Add tests for Profile Management API
3. ✅ Add middleware & auth tests
4. ✅ Fix integration test database configuration

### Phase 2: Component Testing (1 week)

1. ✅ Set up component test environment
2. ✅ Test critical components (Dashboard, Admin Users, Navigation)
3. ✅ Test remaining components

### Phase 3: Documentation Sprint (3-5 days)

1. ✅ Create API reference documentation
2. ✅ Create TESTING.md guide
3. ✅ Create DEPLOYMENT.md guide
4. ✅ Create CONTRIBUTING.md
5. ✅ Update outdated PRD.md

### Phase 4: Advanced Testing (1 week)

1. ✅ Set up E2E testing framework
2. ✅ Write critical user flow E2E tests
3. ✅ Add visual regression testing (optional)

### Phase 5: Polish (2-3 days)

1. ✅ Add JSDoc comments to all code
2. ✅ Create DATABASE.md
3. ✅ Create COMPONENTS.md
4. ✅ Set up Storybook (optional)

---

## Success Metrics

### Testing

- [ ] > 80% code coverage for all API routes
- [ ] > 70% code coverage for components
- [ ] All integration tests passing
- [ ] All E2E tests passing
- [ ] Zero critical business logic untested

### Documentation

- [ ] API reference complete for all endpoints
- [ ] Developer guides available (testing, deployment, contributing)
- [ ] All components documented
- [ ] Database schema documented
- [ ] No outdated documentation

---

## Notes for Future Agents/Developers

- Start with Priority 1 testing - these are critical security and business logic areas
- Don't add tests just for coverage metrics - focus on testing critical paths and edge cases
- Keep documentation up-to-date as features change
- Use existing test patterns (see lib/**tests**/ for examples)
- Follow testing conventions in jest.config.js
- All PRs should include tests for new features

---

**Last Updated:** 2026-01-18
**Maintained By:** Development Team
**Review Cadence:** After each major feature or quarterly
