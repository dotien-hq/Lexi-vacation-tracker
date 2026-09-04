# Calendar Event Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Admin calendar shows every leave request (pending, approved, denied, cancelled) with distinct styling; clicking one opens a modal to approve, cancel, reschedule (→ back to pending), or delete it, with the calendar refreshing immediately.

**Architecture:** Add a `CANCELLED` request status and a pure state-machine module (`lib/requestTransitions.ts`) shared by the API and the UI so both agree on which actions are legal from which status and what happens to the vacation balance. The existing `PATCH /api/requests/[id]` route is restructured around that module, gains admin reschedule, and all balance-changing writes go through one transactional helper with an optimistic lock (status must still equal what the caller saw) plus a row lock on the profile. The calendar page fetches all requests, keys chips by status, adds legend toggles, and mounts a new `EventDetailModal` that performs mutations and asks the page to refetch.

**Tech Stack:** Next.js 15 App Router, React 19, Prisma 6 on Supabase Postgres, Zod 4, Tailwind 3, lucide-react, Vitest + Testing Library, SendGrid.

---

## Review Findings Applied (2026-09-04)

Four parallel reviewers (backend/DB, security/edge cases, frontend/a11y, spec compliance) reviewed the first draft. Fixes below are folded into the tasks.

| Sev            | Finding                                                                                                                                                                                                                              | Flagged by              | Fix applied                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| CRITICAL       | `tailwind.config.js` `content` does not scan `lib/`, so chip classes in `lib/requestStatus.ts` would be purged                                                                                                                       | frontend                | Task 6 adds `./lib/**/*.{js,ts,jsx,tsx}` to `content`                                                                                   |
| HIGH           | Optimistic lock on `status` alone: owner date edit keeps status but changes `daysCount`; concurrent admin approve deducts stale count                                                                                                | backend, security       | Lock on `status` + `updatedAt` in `commitRequestChange` and DELETE (Tasks 4, 5)                                                         |
| HIGH           | Contrast failures: "Cancel leave" `bg-amber-500` 2.15:1, DENIED chip `text-red-400` 2.53:1, CANCELLED chip `text-slate-500` 4.34:1                                                                                                   | frontend                | `bg-amber-700`, `text-red-700`, `text-slate-600` (Tasks 6, 7)                                                                           |
| MEDIUM         | "Migrations dir is stale" premise was false; `db push` would desync history                                                                                                                                                          | backend, spec           | Task 1 uses `prisma migrate dev` (with shadow-DB fallback), commits migration; Task 9 rollout uses `migrate deploy` / `migrate resolve` |
| MEDIUM         | Unbounded date span: `Date.parse('+275760-09-13')` is valid → ~100M-iteration loop in `calculateBusinessDays`                                                                                                                        | security, backend       | Task 1 hardens both date schemas (strict `YYYY-MM-DD`, years 2020–2100, ≤366-day span) + handler span check + input `min`/`max`         |
| MEDIUM         | 409/404 in modal leaves stale data and no recovery path; JSON `null` body crashes error handling                                                                                                                                     | security, frontend      | Modal refetches on 409/404 and guards non-object JSON (Task 7)                                                                          |
| MEDIUM         | Overlap counting REQUESTED was an unstated behaviour change; also counted requests not people                                                                                                                                        | spec, frontend          | Overlap stays APPROVED-only, counts distinct `profileId` (Tasks 6, 8)                                                                   |
| MEDIUM         | Approve now fails on insufficient balance (previously could go negative) — unstated                                                                                                                                                  | backend                 | Stated in decisions table + CLAUDE.md (Task 9)                                                                                          |
| MEDIUM         | Success toast rendered under the modal overlay                                                                                                                                                                                       | frontend                | Modal closes on every success, matching existing approve/deny modals (Task 7)                                                           |
| MEDIUM         | No focus return / no focus trap; `space-y-8` pushes fixed backdrop down 32px                                                                                                                                                         | frontend                | Portal to `document.body`, focus return on close, Tab cycle inside dialog (Task 7)                                                      |
| MEDIUM         | Two date-parsing strategies (`new Date(iso)+setHours` vs string slice)                                                                                                                                                               | frontend                | Export `parseLocalDate`; shared `formatLeaveDate` (Tasks 6–8)                                                                           |
| MEDIUM         | Denied/cancelled ghost chips can push actionable chips below the 140px fold; hue-only distinction between them                                                                                                                       | frontend, spec          | Sort chips by status priority; DENIED gets border, CANCELLED italic (Tasks 6, 8)                                                        |
| MEDIUM         | Legend "off" state `opacity-40` unreadable                                                                                                                                                                                           | frontend                | Dashed border + muted swatch instead (Task 8)                                                                                           |
| MEDIUM         | Manual checklist did not prove AC3 "awaits approval" or the balance round-trip                                                                                                                                                       | spec                    | Task 8 checklist extended                                                                                                               |
| LOW            | Wrong line refs (dashboard badge 356–366, schema :66); wrong expected test counts; vitest path with `\[id\]` in double quotes finds nothing; `node_modules` absent                                                                   | spec, backend, frontend | Corrected throughout; `npm install` added as Task 1 Step 0                                                                              |
| LOW            | Admin editing own request emails themselves; non-object JSON body → 500; `notify()` ignores `{success:false}`; `sendDenialEmail` still unescaped                                                                                     | security                | Fixed in Tasks 3, 5                                                                                                                     |
| LOW            | Cancelling/rescheduling leave already taken refunds days silently                                                                                                                                                                    | security                | Modal shows a note when `endDate` is in the past (Task 7)                                                                               |
| LOW            | Admin requests page keeps a third hard-coded PENDING pill; reason row always red; mixed input styles; `<dl>` markup; overlap icon has no accessible name; `focus:ring` clipped; default-locale date format; drag-select closes modal | frontend, spec          | Fixed in Tasks 6–8                                                                                                                      |
| LOW            | Approve-from-DENIED and dashboard relabel are policy/UI changes not in ticket; Deny absent from modal                                                                                                                                | spec                    | Stated in decisions table; Deny listed out of scope                                                                                     |
| LOW (deferred) | Existence oracle before authz (cuid ids); duplicated toast code; pre-existing green-600 contrast                                                                                                                                     | security, frontend      | Follow-ups, not in this plan                                                                                                            |

---

**Decisions already made with the user (2026-09-04):**

| Question               | Decision                                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| How to model "otkazan" | New `CANCELLED` enum value. `DENIED` stays for "admin rejects a pending request with a reason".      |
| Emails                 | New templates for both admin reschedule and cancellation.                                            |
| Delete UX              | Via modal only, two-step confirm. Satisfies both "delete in modal" and "delete slots from calendar". |
| Visibility             | Calendar shows all 4 statuses; legend chips toggle each on/off (default all on).                     |

**Assumptions and deliberate behaviour changes (not asked, stated here so they are visible):**

- UI copy stays English, matching the rest of the app.
- "Immediately reflected without manual refresh" = the page refetches after each mutation. No cross-client realtime.
- Overlap warning is unchanged in meaning: only `APPROVED` requests, now counted by distinct person, independent of legend toggles. (Counting pending too is a possible follow-up, not done here.)
- Cancellation reason is optional; stored in the existing `rejectionReason` column.
- **Approve is allowed from DENIED and CANCELLED** (admin reverses a mistake; the stored reason is cleared). Today only REQUESTED → APPROVED exists.
- **Approve now refuses (400) when the balance is insufficient at commit time.** Today approval never checks and can drive the balance negative. Two pending requests that together exceed the balance will approve the first and reject the second.
- Dashboard history badges change from raw enum text (`REQUESTED`) to labels (Pending / Approved / Denied / Cancelled).
- Deny stays on `/admin/requests` (it needs a required reason); the calendar modal does not offer it.
- Date inputs are hardened app-wide to strict `YYYY-MM-DD`, years 2020–2100, spans ≤ 366 days. Affects the existing create flow too (the dashboard already sends this format).
- Schema change ships as a real Prisma migration. Prod DB must be migrated **before** the code deploys.

---

## Status transition rules (single source of truth: `lib/requestTransitions.ts`)

| Action                          | Allowed from                 | Result    | Balance                                 |
| ------------------------------- | ---------------------------- | --------- | --------------------------------------- |
| APPROVE                         | REQUESTED, DENIED, CANCELLED | APPROVED  | deduct `daysCount` (carry-over first)   |
| DENY (existing)                 | REQUESTED                    | DENIED    | none                                    |
| CANCEL                          | REQUESTED, APPROVED          | CANCELLED | refund `daysCount` iff was APPROVED     |
| RESCHEDULE (admin dates change) | any                          | REQUESTED | refund old `daysCount` iff was APPROVED |
| DELETE (existing)               | any (admin)                  | row gone  | refund iff was APPROVED                 |

Owner (non-admin) date edit is unchanged: only own `REQUESTED` requests, status stays `REQUESTED`.

Every write that changes status, dates, or deletes a row is guarded by an optimistic lock on `status` **and** `updatedAt` (the row must be exactly what the caller last read) plus a `FOR UPDATE` row lock on the profile while the balance is adjusted.

---

## Task 1: Add `CANCELLED` status, harden date validation, create migration

**Files:**

- Modify: `prisma/schema.prisma:22-26` (enum) and `:66` (rejectionReason comment)
- Modify: `types.ts:7-11`
- Modify: `lib/validations.ts:34-56` (createRequestSchema, updateRequestStatusSchema, updateRequestDatesSchema)
- Test: `lib/__tests__/validations.test.ts` (new)
- Create (generated): `prisma/migrations/<timestamp>_add_cancelled_request_status/migration.sql`

**Step 0: Install dependencies (node_modules is absent in this checkout)**

Run: `npm install`
Expected: completes; `postinstall`/`prepare` runs husky; `prisma generate` runs via `@prisma/client` postinstall.

**Step 1: Update Prisma enum and column comment**

In `prisma/schema.prisma` replace the enum:

```prisma
enum RequestStatus {
  REQUESTED
  APPROVED
  DENIED
  CANCELLED
}
```

and the `rejectionReason` line inside `model LeaveRequest`:

```prisma
  // Required when DENIED, optional when CANCELLED, cleared on reschedule
  rejectionReason String?
```

**Step 2: Update shared TS types**

In `types.ts` replace the `RequestStatus` enum and add two exports right after it:

```ts
export enum RequestStatus {
  REQUESTED = 'REQUESTED',
  APPROVED = 'APPROVED',
  DENIED = 'DENIED',
  CANCELLED = 'CANCELLED',
}

/**
 * String-literal union of RequestStatus.
 * Assignable from BOTH this TS enum and Prisma's generated enum, so shared
 * logic (lib/requestTransitions.ts) can be used by API routes and client code.
 */
export type RequestStatusValue = `${RequestStatus}`;

/** Shape returned by GET/PATCH /api/requests* (dates are ISO strings over JSON). */
export interface LeaveRequestWithProfile {
  id: string;
  profileId: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  status: RequestStatusValue;
  rejectionReason: string | null;
  createdAt: string;
  profile: {
    id: string;
    email: string;
    fullName: string | null;
  };
}
```

**Step 3: Write the failing validation tests**

`lib/__tests__/validations.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  createRequestSchema,
  updateRequestDatesSchema,
  updateRequestStatusSchema,
} from '../validations';

describe('updateRequestStatusSchema', () => {
  it('accepts CANCELLED with an optional trimmed reason', () => {
    const r = updateRequestStatusSchema.safeParse({
      status: 'CANCELLED',
      rejectionReason: '  x  ',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.rejectionReason).toBe('x');
  });

  it('rejects REQUESTED as a target status', () => {
    expect(updateRequestStatusSchema.safeParse({ status: 'REQUESTED' }).success).toBe(false);
  });

  it('rejects reasons over 500 characters', () => {
    const r = updateRequestStatusSchema.safeParse({
      status: 'CANCELLED',
      rejectionReason: 'a'.repeat(501),
    });
    expect(r.success).toBe(false);
  });
});

describe('date schemas', () => {
  it('accept plain YYYY-MM-DD', () => {
    expect(
      createRequestSchema.safeParse({ startDate: '2026-07-06', endDate: '2026-07-10' }).success
    ).toBe(true);
    expect(updateRequestDatesSchema.safeParse({ startDate: '2026-07-06' }).success).toBe(true);
  });

  it('reject non-ISO formats and timestamps', () => {
    expect(
      createRequestSchema.safeParse({ startDate: 'July 6, 2026', endDate: '2026-07-10' }).success
    ).toBe(false);
    expect(updateRequestDatesSchema.safeParse({ startDate: '2026-07-06T10:00:00Z' }).success).toBe(
      false
    );
    expect(updateRequestDatesSchema.safeParse({ startDate: '+275760-09-13' }).success).toBe(false);
  });

  it('reject years outside 2020-2100', () => {
    expect(updateRequestDatesSchema.safeParse({ startDate: '0001-01-01' }).success).toBe(false);
    expect(updateRequestDatesSchema.safeParse({ endDate: '2101-01-01' }).success).toBe(false);
  });

  it('reject spans longer than 366 days', () => {
    expect(
      createRequestSchema.safeParse({ startDate: '2026-01-01', endDate: '2027-01-03' }).success
    ).toBe(false);
    expect(
      updateRequestDatesSchema.safeParse({ startDate: '2026-01-01', endDate: '2027-01-03' }).success
    ).toBe(false);
  });

  it('reject end before start', () => {
    expect(
      createRequestSchema.safeParse({ startDate: '2026-07-10', endDate: '2026-07-06' }).success
    ).toBe(false);
  });
});
```

**Step 4: Run tests to verify they fail**

Run: `npx vitest run lib/__tests__/validations.test.ts`
Expected: FAIL — `updateRequestStatusSchema` still accepts `REQUESTED` and rejects `CANCELLED`; date tests for timestamps/years/spans fail.

**Step 5: Update the schemas**

In `lib/validations.ts` replace the whole "Request schemas" block (`createRequestSchema`, `updateRequestStatusSchema`, `updateRequestDatesSchema`) with:

```ts
// Request schemas

export const MAX_LEAVE_SPAN_DAYS = 366;
const MS_PER_DAY = 86_400_000;

/**
 * Calendar date as plain YYYY-MM-DD. Timestamps and offsets are rejected so every
 * stored date is UTC midnight (chip placement, "unchanged" detection and the modal's
 * date inputs all depend on that). Year range bounds the day-by-day loop in
 * calculateBusinessDays.
 */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' })
  .refine((d) => !isNaN(Date.parse(d)), { message: 'Invalid date' })
  .refine(
    (d) => {
      const year = Number(d.slice(0, 4));
      return year >= 2020 && year <= 2100;
    },
    { message: 'Date out of range' }
  );

const withinSpan = (start: string, end: string) =>
  (Date.parse(end) - Date.parse(start)) / MS_PER_DAY <= MAX_LEAVE_SPAN_DAYS;

export const createRequestSchema = z
  .object({
    startDate: isoDate,
    endDate: isoDate,
    notes: z.string().optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date must be after or equal to start date',
    path: ['endDate'],
  })
  .refine((data) => withinSpan(data.startDate, data.endDate), {
    message: `Leave cannot span more than ${MAX_LEAVE_SPAN_DAYS} days`,
    path: ['endDate'],
  });

export const updateRequestStatusSchema = z.object({
  // REQUESTED is deliberately excluded: it is only reachable via a date change (reschedule)
  status: z.enum(['APPROVED', 'DENIED', 'CANCELLED']),
  rejectionReason: z
    .string()
    .trim()
    .max(500, { message: 'Reason must be 500 characters or fewer' })
    .optional(),
});

export const updateRequestDatesSchema = z
  .object({
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
  })
  .refine((data) => !data.startDate || !data.endDate || data.endDate >= data.startDate, {
    message: 'End date must be after or equal to start date',
    path: ['endDate'],
  })
  .refine((data) => !data.startDate || !data.endDate || withinSpan(data.startDate, data.endDate), {
    message: `Leave cannot span more than ${MAX_LEAVE_SPAN_DAYS} days`,
    path: ['endDate'],
  });
```

(YYYY-MM-DD strings compare correctly as strings, so `>=` on them is safe.)

**Step 6: Run tests to verify they pass**

Run: `npx vitest run lib/__tests__/validations.test.ts`
Expected: PASS, 8 tests.

**Step 7: Create and apply the migration**

Run: `npx prisma migrate dev --name add_cancelled_request_status`
Expected: a new folder `prisma/migrations/<timestamp>_add_cancelled_request_status/migration.sql` containing
`ALTER TYPE "RequestStatus" ADD VALUE 'CANCELLED';`, applied to the dev DB, then `✔ Generated Prisma Client`.

If it fails with a shadow-database error (P3014, common on hosted Supabase without CREATEDB), do it without a shadow DB:

```bash
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_add_cancelled_request_status
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/*_add_cancelled_request_status/migration.sql
cat prisma/migrations/*_add_cancelled_request_status/migration.sql   # must be exactly the ALTER TYPE line
npx prisma migrate deploy
npx prisma generate
```

Rollback note: Postgres cannot drop an enum value cheaply. Rollback = revert code only; the unused enum value is harmless.

**Step 8: Type-check**

Run: `npm run type-check`
Expected: PASS (nothing references the new value yet).

**Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations types.ts lib/validations.ts lib/__tests__/validations.test.ts
git commit -m "feat: add CANCELLED leave request status and harden date validation

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 2: Request transition state machine (pure, shared)

**Files:**

- Create: `lib/requestTransitions.ts`
- Test: `lib/__tests__/requestTransitions.test.ts`

**Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { canPerform, targetStatus, actionForStatus, balanceEffect } from '../requestTransitions';

describe('canPerform', () => {
  it.each([
    ['APPROVE', 'REQUESTED', true],
    ['APPROVE', 'DENIED', true],
    ['APPROVE', 'CANCELLED', true],
    ['APPROVE', 'APPROVED', false],
    ['DENY', 'REQUESTED', true],
    ['DENY', 'APPROVED', false],
    ['DENY', 'DENIED', false],
    ['DENY', 'CANCELLED', false],
    ['CANCEL', 'REQUESTED', true],
    ['CANCEL', 'APPROVED', true],
    ['CANCEL', 'DENIED', false],
    ['CANCEL', 'CANCELLED', false],
    ['RESCHEDULE', 'REQUESTED', true],
    ['RESCHEDULE', 'APPROVED', true],
    ['RESCHEDULE', 'DENIED', true],
    ['RESCHEDULE', 'CANCELLED', true],
  ] as const)('%s from %s → %s', (action, from, expected) => {
    expect(canPerform(action, from)).toBe(expected);
  });
});

describe('targetStatus', () => {
  it('maps every action to its resulting status', () => {
    expect(targetStatus('APPROVE')).toBe('APPROVED');
    expect(targetStatus('DENY')).toBe('DENIED');
    expect(targetStatus('CANCEL')).toBe('CANCELLED');
    expect(targetStatus('RESCHEDULE')).toBe('REQUESTED');
  });
});

describe('actionForStatus', () => {
  it('maps a target status back to the action', () => {
    expect(actionForStatus('APPROVED')).toBe('APPROVE');
    expect(actionForStatus('DENIED')).toBe('DENY');
    expect(actionForStatus('CANCELLED')).toBe('CANCEL');
  });

  it('returns null for REQUESTED (only reachable via reschedule)', () => {
    expect(actionForStatus('REQUESTED')).toBeNull();
  });
});

describe('balanceEffect', () => {
  it.each([
    ['REQUESTED', 'APPROVED', 'DEDUCT'],
    ['DENIED', 'APPROVED', 'DEDUCT'],
    ['CANCELLED', 'APPROVED', 'DEDUCT'],
    ['APPROVED', 'CANCELLED', 'REFUND'],
    ['APPROVED', 'REQUESTED', 'REFUND'],
    ['APPROVED', 'DENIED', 'REFUND'],
    ['REQUESTED', 'CANCELLED', 'NONE'],
    ['REQUESTED', 'DENIED', 'NONE'],
    ['DENIED', 'REQUESTED', 'NONE'],
    ['CANCELLED', 'REQUESTED', 'NONE'],
    ['REQUESTED', 'REQUESTED', 'NONE'],
    ['APPROVED', 'APPROVED', 'NONE'],
  ] as const)('%s → %s = %s', (from, to, expected) => {
    expect(balanceEffect(from, to)).toBe(expected);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/__tests__/requestTransitions.test.ts`
Expected: FAIL — `Cannot find module '../requestTransitions'`.

**Step 3: Implement**

`lib/requestTransitions.ts`:

```ts
import type { RequestStatusValue } from '@/types';

/**
 * Leave request state machine.
 *
 * Pure module, no Prisma/React imports, so it is shared by:
 *  - app/api/requests/[id]/route.ts  (enforces transitions server-side)
 *  - components/calendar/EventDetailModal.tsx (decides which buttons to render)
 *
 * Invariant: vacation days are deducted while, and only while, a request is APPROVED.
 */

export type RequestAction = 'APPROVE' | 'DENY' | 'CANCEL' | 'RESCHEDULE';
export type BalanceEffect = 'DEDUCT' | 'REFUND' | 'NONE';

const ALLOWED_FROM: Record<RequestAction, readonly RequestStatusValue[]> = {
  APPROVE: ['REQUESTED', 'DENIED', 'CANCELLED'],
  DENY: ['REQUESTED'],
  CANCEL: ['REQUESTED', 'APPROVED'],
  RESCHEDULE: ['REQUESTED', 'APPROVED', 'DENIED', 'CANCELLED'],
};

const TARGET: Record<RequestAction, RequestStatusValue> = {
  APPROVE: 'APPROVED',
  DENY: 'DENIED',
  CANCEL: 'CANCELLED',
  RESCHEDULE: 'REQUESTED',
};

export function canPerform(action: RequestAction, from: RequestStatusValue): boolean {
  return ALLOWED_FROM[action].includes(from);
}

export function targetStatus(action: RequestAction): RequestStatusValue {
  return TARGET[action];
}

/** Map a target status (as sent in a PATCH body) to the action it implies. */
export function actionForStatus(to: RequestStatusValue): RequestAction | null {
  switch (to) {
    case 'APPROVED':
      return 'APPROVE';
    case 'DENIED':
      return 'DENY';
    case 'CANCELLED':
      return 'CANCEL';
    default:
      return null;
  }
}

/** Balance side-effect of moving a request from one status to another. */
export function balanceEffect(from: RequestStatusValue, to: RequestStatusValue): BalanceEffect {
  if (from === to) return 'NONE';
  if (to === 'APPROVED') return 'DEDUCT';
  if (from === 'APPROVED') return 'REFUND';
  return 'NONE';
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/__tests__/requestTransitions.test.ts`
Expected: PASS, 4 suites / 31 tests (16 + 1 + 2 + 12).

**Step 5: Commit**

```bash
git add lib/requestTransitions.ts lib/__tests__/requestTransitions.test.ts
git commit -m "feat: add leave request transition state machine

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 3: Cancellation and reschedule email templates

**Files:**

- Modify: `lib/email.ts` — export `EmailResult` (line 12), escape values in `sendDenialEmail` (lines 540, 547), append two templates after `sendDenialEmail` (~line 572)
- Test: `lib/__tests__/email-calendar.test.ts` (new file; existing `email.test.ts` skips when unconfigured, this one stubs env so it always runs)

**Step 1: Write the failing tests**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@sendgrid/mail', () => ({
  default: { setApiKey: vi.fn(), send: vi.fn() },
}));
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

/** email.ts reads SENDGRID_* at module load, so stub env then re-import fresh. */
async function loadEmailModule(apiKey = 'SG.test-key') {
  vi.resetModules();
  vi.stubEnv('SENDGRID_API_KEY', apiKey);
  vi.stubEnv('SENDGRID_FROM_EMAIL', 'noreply@lexi.hr');
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://vacation.lexi.hr');
  const sgMail = (await import('@sendgrid/mail')).default;
  const email = await import('../email');
  const mockSend = vi.mocked(sgMail.send);
  mockSend.mockResolvedValue([{ statusCode: 202, body: {}, headers: {} }, {}] as never);
  return { email, mockSend };
}

const start = new Date('2026-07-06');
const end = new Date('2026-07-10');

describe('sendCancellationEmail', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllEnvs());

  it('sends with refund note and reason when request was approved', async () => {
    const { email, mockSend } = await loadEmailModule();

    const result = await email.sendCancellationEmail(
      'ana@lexi.hr',
      'Ana Anić',
      start,
      end,
      5,
      true,
      'Project deadline'
    );

    expect(result).toEqual({ success: true });
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ana@lexi.hr',
        subject: 'Leave Request Cancelled',
        html: expect.stringContaining('Project deadline'),
        text: expect.stringContaining('returned to your vacation balance'),
      })
    );
  });

  it('omits refund note when request was not approved', async () => {
    const { email, mockSend } = await loadEmailModule();

    await email.sendCancellationEmail('ana@lexi.hr', 'Ana', start, end, 5, false);

    const msg = mockSend.mock.calls[0][0] as { text: string; html: string };
    expect(msg.text).not.toContain('returned to your vacation balance');
    expect(msg.html).not.toContain('Reason');
  });

  it('escapes HTML in the reason', async () => {
    const { email, mockSend } = await loadEmailModule();

    await email.sendCancellationEmail('ana@lexi.hr', 'Ana', start, end, 5, false, '<b>x</b>');

    const msg = mockSend.mock.calls[0][0] as { html: string };
    expect(msg.html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(msg.html).not.toContain('<b>x</b>');
  });

  it('returns an error when not configured', async () => {
    const { email, mockSend } = await loadEmailModule('');

    const result = await email.sendCancellationEmail('ana@lexi.hr', 'Ana', start, end, 5, false);

    expect(result).toEqual({ success: false, error: 'Email service not configured' });
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe('sendRescheduleEmail', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllEnvs());

  it('sends previous and new dates with a dashboard link', async () => {
    const { email, mockSend } = await loadEmailModule();
    const newStart = new Date('2026-07-13');
    const newEnd = new Date('2026-07-15');

    const result = await email.sendRescheduleEmail(
      'ana@lexi.hr',
      'Ana',
      start,
      end,
      newStart,
      newEnd,
      3
    );

    expect(result).toEqual({ success: true });
    const msg = mockSend.mock.calls[0][0] as { subject: string; text: string; html: string };
    expect(msg.subject).toBe('Leave Dates Updated - Pending Approval');
    expect(msg.text).toContain('July 6, 2026');
    expect(msg.text).toContain('July 13, 2026');
    expect(msg.text).toContain('pending');
    expect(msg.html).toContain('https://vacation.lexi.hr/dashboard');
  });

  it('returns an error when not configured', async () => {
    const { email } = await loadEmailModule('');
    const result = await email.sendRescheduleEmail('a@b.c', 'A', start, end, start, end, 1);
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/__tests__/email-calendar.test.ts`
Expected: FAIL — `email.sendCancellationEmail is not a function`.

**Step 3: Implement the two templates**

First, two small edits to existing code in `lib/email.ts`:

- Line 12: `interface EmailResult {` → `export interface EmailResult {` (the route's `notify()` helper types against it in Task 5).
- In `sendDenialEmail`, escape the two interpolated values (the helper is added below in the same file):
  - line 540: `{ label: 'Reason', value: rejectionReason },` → `{ label: 'Reason', value: escapeHtml(rejectionReason) },`
  - line 547: `...${userName}</strong>` → `...${escapeHtml(userName)}</strong>`
  - The plain-text `text:` field stays unescaped (it is not HTML).

Then append after `sendDenialEmail` (before the `sendInvitationEmailWithToken` doc comment):

```ts
/** Minimal HTML escaping for user-supplied strings interpolated into templates. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatEmailDate(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Send cancellation email when an admin cancels a leave request
 * @param wasApproved Whether days were refunded (request was APPROVED before cancelling)
 * @param reason Optional reason entered by the admin
 */
export async function sendCancellationEmail(
  email: string,
  userName: string,
  startDate: Date,
  endDate: Date,
  daysCount: number,
  wasApproved: boolean,
  reason?: string
): Promise<EmailResult> {
  if (!isEmailConfigured()) {
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const formattedStartDate = formatEmailDate(startDate);
    const formattedEndDate = formatEmailDate(endDate);
    const dayWord = daysCount === 1 ? 'day' : 'days';
    const safeName = escapeHtml(userName);

    const theme: EmailTheme = {
      accentColor: '#94A3B8',
      cardBackground: '#F8FAFC',
      cardBorderColor: '#CBD5E1',
    };

    const items = [
      { label: 'Start Date', value: formattedStartDate },
      { label: 'End Date', value: formattedEndDate },
      { label: 'Business Days', value: `${daysCount} ${dayWord}` },
    ];
    if (reason) {
      items.push({ label: 'Reason', value: escapeHtml(reason) });
    }
    const dataCard = generateDataCard(items, theme);

    const refundSentence = wasApproved
      ? `The ${daysCount} ${dayWord} ${daysCount === 1 ? 'has' : 'have'} been returned to your vacation balance.`
      : '';

    const content = `
      <h2 style="color: #0F172A; font-size: 24px; font-weight: 600; margin: 0 0 16px;">Leave Request Cancelled</h2>
      <p style="margin: 16px 0;">Hello <strong style="color: #1E293B;">${safeName}</strong>,</p>
      <p style="margin: 16px 0;">Your leave request has been cancelled by an administrator.</p>
      ${dataCard}
      ${refundSentence ? `<p style="margin: 16px 0;">${refundSentence}</p>` : ''}
      <p style="margin: 16px 0; color: #64748B;">If you have questions, please contact your administrator.</p>
    `;

    const html = generateEmailTemplate(content, theme);

    const msg = {
      to: email,
      from: fromEmail,
      subject: 'Leave Request Cancelled',
      text: `Hello ${userName},\n\nYour leave request has been cancelled by an administrator.\n\nStart Date: ${formattedStartDate}\nEnd Date: ${formattedEndDate}\nBusiness Days: ${daysCount}${reason ? `\nReason: ${reason}` : ''}\n\n${refundSentence ? `${refundSentence}\n\n` : ''}If you have questions, please contact your administrator.\n\nBest regards,\nLexi Vacation Tracker Team`,
      html,
    };

    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    console.error('Failed to send cancellation email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send reschedule email when an admin changes the dates of a leave request.
 * The request returns to REQUESTED and must be approved again.
 */
export async function sendRescheduleEmail(
  email: string,
  userName: string,
  previousStartDate: Date,
  previousEndDate: Date,
  newStartDate: Date,
  newEndDate: Date,
  daysCount: number
): Promise<EmailResult> {
  if (!isEmailConfigured()) {
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const prevStart = formatEmailDate(previousStartDate);
    const prevEnd = formatEmailDate(previousEndDate);
    const newStart = formatEmailDate(newStartDate);
    const newEnd = formatEmailDate(newEndDate);
    const safeName = escapeHtml(userName);

    const theme: EmailTheme = {
      accentColor: '#F59E0B',
      cardBackground: '#FFFBEB',
      cardBorderColor: '#FCD34D',
    };

    const dataCard = generateDataCard(
      [
        { label: 'Previous Dates', value: `${prevStart} – ${prevEnd}` },
        { label: 'New Start Date', value: newStart },
        { label: 'New End Date', value: newEnd },
        { label: 'Business Days', value: `${daysCount} ${daysCount === 1 ? 'day' : 'days'}` },
      ],
      theme
    );

    const content = `
      <h2 style="color: #0F172A; font-size: 24px; font-weight: 600; margin: 0 0 16px;">Leave Dates Updated</h2>
      <p style="margin: 16px 0;">Hello <strong style="color: #1E293B;">${safeName}</strong>,</p>
      <p style="margin: 16px 0;">An administrator has changed the dates of your leave request. The request is now pending and will need to be approved again.</p>
      ${dataCard}
      <p style="margin: 16px 0; color: #64748B;">If you did not expect this change, please contact your administrator.</p>
    `;

    const html = generateEmailTemplate(content, theme, {
      text: 'View My Requests',
      url: `${appUrl}/dashboard`,
    });

    const msg = {
      to: email,
      from: fromEmail,
      subject: 'Leave Dates Updated - Pending Approval',
      text: `Hello ${userName},\n\nAn administrator has changed the dates of your leave request. The request is now pending and will need to be approved again.\n\nPrevious Dates: ${prevStart} – ${prevEnd}\nNew Start Date: ${newStart}\nNew End Date: ${newEnd}\nBusiness Days: ${daysCount}\n\nView your requests: ${appUrl}/dashboard\n\nBest regards,\nLexi Vacation Tracker Team`,
      html,
    };

    await sgMail.send(msg);
    return { success: true };
  } catch (error) {
    console.error('Failed to send reschedule email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/__tests__/email-calendar.test.ts lib/__tests__/email.test.ts`
Expected: PASS (new file 6 tests; existing file unchanged — its denial-email assertions use `stringContaining` on plain names, unaffected by escaping).

**Step 5: Commit**

```bash
git add lib/email.ts lib/__tests__/email-calendar.test.ts
git commit -m "feat: add cancellation and reschedule email templates

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 4: Transactional request mutation helper

**Files:**

- Create: `lib/requestMutations.ts`
- Test: `lib/__tests__/requestMutations.test.ts`

Why: every status change, reschedule, and delete must (a) only apply if the row is still exactly what the caller read — same `status` **and** same `updatedAt` (optimistic lock → prevents double-click double-deduct, and prevents an owner's concurrent date edit from being approved with a stale `daysCount`), and (b) read-modify-write the profile balance under a row lock. One helper, used by all three route handlers.

**Step 1: Write the failing tests**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adjustBalance, commitRequestChange, InsufficientBalanceError } from '../requestMutations';

vi.mock('@/lib/prisma', () => ({
  prisma: { $transaction: vi.fn() },
}));
import { prisma } from '@/lib/prisma';

function makeTx(profile = { daysCarryOver: 2, daysCurrentYear: 20 }) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    leaveRequest: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'req-1', status: 'APPROVED' }),
    },
    profile: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(profile),
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

describe('adjustBalance', () => {
  it('does nothing for NONE', async () => {
    const tx = makeTx();
    await adjustBalance(tx as never, 'p1', 'NONE', 5);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.profile.update).not.toHaveBeenCalled();
  });

  it('locks the profile row then deducts carry-over first', async () => {
    const tx = makeTx({ daysCarryOver: 2, daysCurrentYear: 20 });
    await adjustBalance(tx as never, 'p1', 'DEDUCT', 5);
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.profile.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { daysCarryOver: 0, daysCurrentYear: 17 },
    });
  });

  it('refunds to current year', async () => {
    const tx = makeTx({ daysCarryOver: 0, daysCurrentYear: 15 });
    await adjustBalance(tx as never, 'p1', 'REFUND', 5);
    expect(tx.profile.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { daysCarryOver: 0, daysCurrentYear: 20 },
    });
  });

  it('throws InsufficientBalanceError when deducting more than available', async () => {
    const tx = makeTx({ daysCarryOver: 0, daysCurrentYear: 3 });
    await expect(adjustBalance(tx as never, 'p1', 'DEDUCT', 5)).rejects.toBeInstanceOf(
      InsufficientBalanceError
    );
    expect(tx.profile.update).not.toHaveBeenCalled();
  });
});

describe('commitRequestChange', () => {
  const updatedAt = new Date('2026-06-01T10:00:00.000Z');

  beforeEach(() => vi.clearAllMocks());

  it('updates only when status and updatedAt match, adjusts balance, returns fresh request', async () => {
    const tx = makeTx();
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) =>
      (fn as (t: unknown) => Promise<unknown>)(tx)
    );

    const result = await commitRequestChange({
      id: 'req-1',
      expectedStatus: 'REQUESTED',
      expectedUpdatedAt: updatedAt,
      profileId: 'p1',
      effect: 'DEDUCT',
      days: 5,
      data: { status: 'APPROVED' },
    });

    expect(tx.leaveRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'req-1', status: 'REQUESTED', updatedAt },
      data: { status: 'APPROVED' },
    });
    expect(tx.profile.update).toHaveBeenCalled();
    expect(result).toEqual({ id: 'req-1', status: 'APPROVED' });
  });

  it('returns null and skips balance when the optimistic lock fails', async () => {
    const tx = makeTx();
    tx.leaveRequest.updateMany.mockResolvedValue({ count: 0 });
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) =>
      (fn as (t: unknown) => Promise<unknown>)(tx)
    );

    const result = await commitRequestChange({
      id: 'req-1',
      expectedStatus: 'REQUESTED',
      expectedUpdatedAt: updatedAt,
      profileId: 'p1',
      effect: 'DEDUCT',
      days: 5,
      data: { status: 'APPROVED' },
    });

    expect(result).toBeNull();
    expect(tx.profile.update).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/__tests__/requestMutations.test.ts`
Expected: FAIL — `Cannot find module '../requestMutations'`.

**Step 3: Implement**

`lib/requestMutations.ts`:

```ts
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  calculateAvailableDays,
  deductDays,
  hasSufficientBalance,
  refundDays,
} from '@/lib/vacationBalance';
import type { BalanceEffect } from '@/lib/requestTransitions';
import type { RequestStatusValue } from '@/types';

export class InsufficientBalanceError extends Error {
  constructor(
    public readonly available: number,
    public readonly requested: number
  ) {
    super(`Insufficient vacation days. Available: ${available}, Requested: ${requested}`);
    this.name = 'InsufficientBalanceError';
  }
}

/** Fields returned to clients for a leave request. */
export const requestWithProfile = {
  profile: { select: { id: true, email: true, fullName: true } },
} satisfies Prisma.LeaveRequestInclude;

/**
 * Apply a balance change inside an open transaction.
 * Locks the profile row (SELECT ... FOR UPDATE) so concurrent changes for the
 * same person serialise instead of both reading the same stale balance.
 * Throws InsufficientBalanceError (rolling back the transaction) if a DEDUCT
 * would go negative.
 *
 * Relies on Prisma's default READ COMMITTED isolation: the findUniqueOrThrow
 * after the lock takes a fresh snapshot and sees the latest committed balance.
 * Do not switch this transaction to RepeatableRead.
 */
export async function adjustBalance(
  tx: Prisma.TransactionClient,
  profileId: string,
  effect: BalanceEffect,
  days: number
): Promise<void> {
  if (effect === 'NONE') return;

  await tx.$queryRaw`SELECT "id" FROM "Profile" WHERE "id" = ${profileId} FOR UPDATE`;

  const profile = await tx.profile.findUniqueOrThrow({
    where: { id: profileId },
    select: { daysCarryOver: true, daysCurrentYear: true },
  });

  if (effect === 'DEDUCT' && !hasSufficientBalance(profile, days)) {
    throw new InsufficientBalanceError(calculateAvailableDays(profile), days);
  }

  const next = effect === 'DEDUCT' ? deductDays(profile, days) : refundDays(profile, days);
  await tx.profile.update({ where: { id: profileId }, data: next });
}

interface CommitParams {
  id: string;
  /**
   * Optimistic lock: the update only applies if the row still has this status AND
   * this updatedAt (i.e. nobody — including the owner editing dates — changed it
   * since the caller read it). updatedAt is timestamp(3), so the JS Date round-trips exactly.
   */
  expectedStatus: RequestStatusValue;
  expectedUpdatedAt: Date;
  profileId: string;
  effect: BalanceEffect;
  /** Days to deduct or refund (the request's daysCount at the time of the change). */
  days: number;
  data: Prisma.LeaveRequestUpdateManyMutationInput;
}

/**
 * Atomically update a leave request and adjust its owner's balance.
 * Returns the updated request, or null if the optimistic lock failed
 * (someone else changed the status first) — caller should respond 409.
 */
export async function commitRequestChange(params: CommitParams) {
  const { id, expectedStatus, expectedUpdatedAt, profileId, effect, days, data } = params;

  return prisma.$transaction(async (tx) => {
    const { count } = await tx.leaveRequest.updateMany({
      where: { id, status: expectedStatus, updatedAt: expectedUpdatedAt },
      data,
    });
    if (count === 0) return null;

    await adjustBalance(tx, profileId, effect, days);

    return tx.leaveRequest.findUniqueOrThrow({ where: { id }, include: requestWithProfile });
  });
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/__tests__/requestMutations.test.ts`
Expected: PASS, 6 tests.

**Step 5: Commit**

```bash
git add lib/requestMutations.ts lib/__tests__/requestMutations.test.ts
git commit -m "feat: add transactional leave request mutation helper

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 5: Rework `PATCH`/`DELETE /api/requests/[id]` — cancel, admin reschedule, optimistic locking

**Files:**

- Rewrite: `app/api/requests/[id]/route.ts`
- Test: `app/api/requests/[id]/__tests__/route.test.ts` (new)

**Step 1: Write the failing tests**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH, DELETE } from '../route';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedProfile } from '@/lib/auth';
import {
  sendApprovalEmail,
  sendDenialEmail,
  sendCancellationEmail,
  sendRescheduleEmail,
} from '@/lib/email';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    leaveRequest: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('@/lib/email', () => ({
  sendApprovalEmail: vi.fn().mockResolvedValue({ success: true }),
  sendDenialEmail: vi.fn().mockResolvedValue({ success: true }),
  sendCancellationEmail: vi.fn().mockResolvedValue({ success: true }),
  sendRescheduleEmail: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock('@/lib/auth', () => ({ getAuthenticatedProfile: vi.fn() }));
// Real rate limiter is in-memory per IP; >30 calls in one file would trip it.
vi.mock('@/lib/rateLimit', () => ({
  withRateLimit: vi.fn(() => null),
  RATE_LIMITS: { api: { windowMs: 60000, maxRequests: 30 } },
}));
vi.spyOn(console, 'error').mockImplementation(() => {});

const admin = { id: 'admin-1', role: 'ADMIN', email: 'admin@lexi.hr' };
const owner = { id: 'user-1', role: 'USER', email: 'ana@lexi.hr' };
const stranger = { id: 'user-2', role: 'USER', email: 'x@lexi.hr' };

const profile = {
  id: 'user-1',
  email: 'ana@lexi.hr',
  fullName: 'Ana',
  daysCarryOver: 2,
  daysCurrentYear: 20,
};

const UPDATED_AT = new Date('2026-06-01T10:00:00.000Z');

function existing(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'req-1',
    profileId: 'user-1',
    startDate: new Date('2026-07-06'),
    endDate: new Date('2026-07-10'),
    daysCount: 5,
    status: 'REQUESTED',
    rejectionReason: null,
    updatedAt: UPDATED_AT,
    profile,
    ...overrides,
  };
}

let tx: ReturnType<typeof makeTx>;
function makeTx(balance = { daysCarryOver: 2, daysCurrentYear: 20 }) {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    leaveRequest: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'req-1', profile }),
    },
    profile: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(balance),
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

const params = { params: Promise.resolve({ id: 'req-1' }) };
const patch = (body: unknown) =>
  PATCH(
    new Request('http://localhost/api/requests/req-1', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }) as never,
    params
  );
const del = () =>
  DELETE(new Request('http://localhost/api/requests/req-1', { method: 'DELETE' }) as never, params);

beforeEach(() => {
  vi.clearAllMocks();
  tx = makeTx();
  vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) =>
    (fn as (t: unknown) => Promise<unknown>)(tx)
  );
  vi.mocked(getAuthenticatedProfile).mockResolvedValue(admin as never);
  vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(existing() as never);
});

describe('PATCH body', () => {
  it('rejects a non-object JSON body with 400, not 500', async () => {
    const res = await patch(null);
    expect(res.status).toBe(400);
  });

  it('rejects status and dates in the same call', async () => {
    const res = await patch({ status: 'APPROVED', startDate: '2026-07-06' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH status', () => {
  it('rejects non-admins', async () => {
    vi.mocked(getAuthenticatedProfile).mockResolvedValue(owner as never);
    const res = await patch({ status: 'APPROVED' });
    expect(res.status).toBe(403);
  });

  it('approves a REQUESTED request, deducts carry-over first, emails', async () => {
    const res = await patch({ status: 'APPROVED' });

    expect(res.status).toBe(200);
    expect(tx.leaveRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'req-1', status: 'REQUESTED', updatedAt: UPDATED_AT },
      data: { status: 'APPROVED', rejectionReason: null },
    });
    expect(tx.profile.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { daysCarryOver: 0, daysCurrentYear: 17 },
    });
    expect(sendApprovalEmail).toHaveBeenCalledWith(
      'ana@lexi.hr',
      'Ana',
      existing().startDate,
      existing().endDate,
      5
    );
  });

  it('approves a CANCELLED request (re-deducts)', async () => {
    vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(
      existing({ status: 'CANCELLED' }) as never
    );
    const res = await patch({ status: 'APPROVED' });
    expect(res.status).toBe(200);
    expect(tx.profile.update).toHaveBeenCalled();
  });

  it('refuses to approve an already APPROVED request', async () => {
    vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(
      existing({ status: 'APPROVED' }) as never
    );
    const res = await patch({ status: 'APPROVED' });
    expect(res.status).toBe(400);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns 400 and sends no email when balance is insufficient at commit time', async () => {
    tx = makeTx({ daysCarryOver: 0, daysCurrentYear: 3 });
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) =>
      (fn as (t: unknown) => Promise<unknown>)(tx)
    );
    const res = await patch({ status: 'APPROVED' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Insufficient vacation days/);
    expect(sendApprovalEmail).not.toHaveBeenCalled();
  });

  it('cancels an APPROVED request, refunds, emails with wasApproved=true', async () => {
    vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(
      existing({ status: 'APPROVED' }) as never
    );
    tx = makeTx({ daysCarryOver: 0, daysCurrentYear: 15 });
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) =>
      (fn as (t: unknown) => Promise<unknown>)(tx)
    );

    const res = await patch({ status: 'CANCELLED', rejectionReason: 'Busy week' });

    expect(res.status).toBe(200);
    expect(tx.leaveRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'req-1', status: 'APPROVED', updatedAt: UPDATED_AT },
      data: { status: 'CANCELLED', rejectionReason: 'Busy week' },
    });
    expect(tx.profile.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { daysCarryOver: 0, daysCurrentYear: 20 },
    });
    expect(sendCancellationEmail).toHaveBeenCalledWith(
      'ana@lexi.hr',
      'Ana',
      expect.any(Date),
      expect.any(Date),
      5,
      true,
      'Busy week'
    );
  });

  it('cancels a REQUESTED request without touching balance', async () => {
    const res = await patch({ status: 'CANCELLED' });
    expect(res.status).toBe(200);
    expect(tx.profile.update).not.toHaveBeenCalled();
    expect(sendCancellationEmail).toHaveBeenCalledWith(
      'ana@lexi.hr',
      'Ana',
      expect.any(Date),
      expect.any(Date),
      5,
      false,
      undefined
    );
  });

  it('refuses to cancel a DENIED request', async () => {
    vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(
      existing({ status: 'DENIED' }) as never
    );
    const res = await patch({ status: 'CANCELLED' });
    expect(res.status).toBe(400);
  });

  it('still requires a reason to deny', async () => {
    const res = await patch({ status: 'DENIED' });
    expect(res.status).toBe(400);
    expect(sendDenialEmail).not.toHaveBeenCalled();
  });

  it('returns 409 when the optimistic lock fails', async () => {
    tx.leaveRequest.updateMany.mockResolvedValue({ count: 0 });
    const res = await patch({ status: 'APPROVED' });
    expect(res.status).toBe(409);
    expect(sendApprovalEmail).not.toHaveBeenCalled();
  });
});

describe('PATCH dates', () => {
  it('admin reschedule of APPROVED: refunds, resets to REQUESTED, clears reason, emails', async () => {
    vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(
      existing({ status: 'APPROVED' }) as never
    );

    const res = await patch({ startDate: '2026-07-13', endDate: '2026-07-15' });

    expect(res.status).toBe(200);
    expect(tx.leaveRequest.updateMany).toHaveBeenCalledWith({
      where: { id: 'req-1', status: 'APPROVED', updatedAt: UPDATED_AT },
      data: {
        startDate: new Date('2026-07-13'),
        endDate: new Date('2026-07-15'),
        daysCount: 3,
        status: 'REQUESTED',
        rejectionReason: null,
      },
    });
    expect(tx.profile.update).toHaveBeenCalled();
    expect(sendRescheduleEmail).toHaveBeenCalledWith(
      'ana@lexi.hr',
      'Ana',
      new Date('2026-07-06'),
      new Date('2026-07-10'),
      new Date('2026-07-13'),
      new Date('2026-07-15'),
      3
    );
  });

  it('admin reschedule of DENIED works and needs no refund', async () => {
    vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(
      existing({ status: 'DENIED', rejectionReason: 'no' }) as never
    );
    const res = await patch({ startDate: '2026-07-13', endDate: '2026-07-15' });
    expect(res.status).toBe(200);
    expect(tx.profile.update).not.toHaveBeenCalled();
  });

  it('rejects unchanged dates', async () => {
    const res = await patch({ startDate: '2026-07-06', endDate: '2026-07-10' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/unchanged/i);
  });

  it('rejects a range with zero business days', async () => {
    const res = await patch({ startDate: '2026-07-11', endDate: '2026-07-12' }); // Sat-Sun
    expect(res.status).toBe(400);
  });

  it('rejects an over-long span when only one date is supplied', async () => {
    // existing start 2026-07-06; schema cannot see the span, the handler must
    const res = await patch({ endDate: '2027-08-01' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/366 days/);
  });

  it('admin rescheduling their own request resets status but sends no email to themselves', async () => {
    vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(
      existing({
        status: 'APPROVED',
        profileId: 'admin-1',
        profile: { ...profile, id: 'admin-1' },
      }) as never
    );
    const res = await patch({ startDate: '2026-07-13', endDate: '2026-07-15' });
    expect(res.status).toBe(200);
    expect(tx.leaveRequest.updateMany.mock.calls[0][0].data).toMatchObject({ status: 'REQUESTED' });
    expect(sendRescheduleEmail).not.toHaveBeenCalled();
  });

  it('rejects when new days exceed balance plus refund', async () => {
    vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(
      existing({
        status: 'APPROVED',
        profile: { ...profile, daysCarryOver: 0, daysCurrentYear: 1 },
      }) as never
    );
    // 1 available + 5 refunded = 6 < 10 requested
    const res = await patch({ startDate: '2026-07-13', endDate: '2026-07-24' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Available: 6/);
  });

  it('owner can edit own REQUESTED request; status unchanged; no email', async () => {
    vi.mocked(getAuthenticatedProfile).mockResolvedValue(owner as never);
    const res = await patch({ startDate: '2026-07-13', endDate: '2026-07-15' });
    expect(res.status).toBe(200);
    const data = tx.leaveRequest.updateMany.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('status');
    expect(sendRescheduleEmail).not.toHaveBeenCalled();
  });

  it('owner cannot edit an APPROVED request', async () => {
    vi.mocked(getAuthenticatedProfile).mockResolvedValue(owner as never);
    vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(
      existing({ status: 'APPROVED' }) as never
    );
    const res = await patch({ startDate: '2026-07-13' });
    expect(res.status).toBe(400);
  });

  it('non-owner non-admin gets 403', async () => {
    vi.mocked(getAuthenticatedProfile).mockResolvedValue(stranger as never);
    const res = await patch({ startDate: '2026-07-13' });
    expect(res.status).toBe(403);
  });
});

describe('DELETE', () => {
  it('admin deletes APPROVED with refund, using status as lock', async () => {
    vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(
      existing({ status: 'APPROVED' }) as never
    );
    const res = await del();
    expect(res.status).toBe(200);
    expect(tx.leaveRequest.deleteMany).toHaveBeenCalledWith({
      where: { id: 'req-1', status: 'APPROVED', updatedAt: UPDATED_AT },
    });
    expect(tx.profile.update).toHaveBeenCalled();
  });

  it('admin deletes REQUESTED without refund', async () => {
    const res = await del();
    expect(res.status).toBe(200);
    expect(tx.profile.update).not.toHaveBeenCalled();
  });

  it('returns 409 when the row changed underneath', async () => {
    tx.leaveRequest.deleteMany.mockResolvedValue({ count: 0 });
    const res = await del();
    expect(res.status).toBe(409);
  });

  it('owner may delete own REQUESTED but not APPROVED', async () => {
    vi.mocked(getAuthenticatedProfile).mockResolvedValue(owner as never);
    expect((await del()).status).toBe(200);

    vi.mocked(prisma.leaveRequest.findUnique).mockResolvedValue(
      existing({ status: 'APPROVED' }) as never
    );
    expect((await del()).status).toBe(400);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run 'requests/[id]'`
(vitest filters are substrings; do not escape the brackets, zsh keeps the backslashes inside double quotes and nothing matches.)
Expected: FAIL — many; e.g. `Cannot read properties of undefined (reading 'updateMany')` / 400s where 200 expected.

**Step 3: Rewrite the route**

Replace the entire contents of `app/api/requests/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { Role, RequestStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { calculateBusinessDays } from '@/lib/holidayCalculator';
import { calculateAvailableDays } from '@/lib/vacationBalance';
import {
  sendApprovalEmail,
  sendDenialEmail,
  sendCancellationEmail,
  sendRescheduleEmail,
  type EmailResult,
} from '@/lib/email';
import { getAuthenticatedProfile } from '@/lib/auth';
import { withRateLimit, RATE_LIMITS } from '@/lib/rateLimit';
import {
  validationError,
  updateRequestStatusSchema,
  updateRequestDatesSchema,
  MAX_LEAVE_SPAN_DAYS,
} from '@/lib/validations';
import { actionForStatus, balanceEffect, canPerform } from '@/lib/requestTransitions';
import {
  adjustBalance,
  commitRequestChange,
  InsufficientBalanceError,
} from '@/lib/requestMutations';

type ExistingRequest = Prisma.LeaveRequestGetPayload<{ include: { profile: true } }>;
type Actor = { id: string; role: Role };

const MS_PER_DAY = 86_400_000;

const conflict = () =>
  NextResponse.json(
    { error: 'This request was changed by someone else. Refresh and try again.' },
    { status: 409 }
  );

/**
 * Send a notification without letting email failures fail the API call.
 * The send* helpers return { success: false } for SendGrid/config problems and only
 * throw on programming errors; both are logged so a silent "email never went out" is visible.
 */
async function notify(send: () => Promise<EmailResult>): Promise<void> {
  try {
    const result = await send();
    if (!result.success) {
      console.error('Notification email not sent:', result.error);
    }
  } catch (error) {
    console.error('Failed to send notification email:', error);
  }
}

// ---------------------------------------------------------------------------
// Status change (admin only): APPROVE / DENY / CANCEL
// ---------------------------------------------------------------------------
async function handleStatusUpdate(existing: ExistingRequest, body: unknown) {
  const parsed = updateRequestStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  const { status: toStatus } = parsed.data;
  const reason = parsed.data.rejectionReason || undefined;

  const action = actionForStatus(toStatus);
  if (!action || !canPerform(action, existing.status)) {
    return NextResponse.json(
      { error: `Cannot change status from ${existing.status} to ${toStatus}` },
      { status: 400 }
    );
  }

  if (toStatus === RequestStatus.DENIED && !reason) {
    return NextResponse.json(
      { error: 'Rejection reason is required when denying a request' },
      { status: 400 }
    );
  }

  const updated = await commitRequestChange({
    id: existing.id,
    expectedStatus: existing.status,
    expectedUpdatedAt: existing.updatedAt,
    profileId: existing.profileId,
    effect: balanceEffect(existing.status, toStatus),
    days: existing.daysCount,
    data: {
      status: toStatus,
      rejectionReason: toStatus === RequestStatus.APPROVED ? null : (reason ?? null),
    },
  });
  if (!updated) return conflict();

  const { email, fullName } = existing.profile;
  const name = fullName || email;
  const { startDate, endDate, daysCount } = existing;

  await notify(() => {
    if (toStatus === RequestStatus.APPROVED) {
      return sendApprovalEmail(email, name, startDate, endDate, daysCount);
    }
    if (toStatus === RequestStatus.DENIED) {
      return sendDenialEmail(email, name, startDate, endDate, daysCount, reason!);
    }
    const wasApproved = existing.status === RequestStatus.APPROVED;
    return sendCancellationEmail(email, name, startDate, endDate, daysCount, wasApproved, reason);
  });

  return NextResponse.json(updated);
}

// ---------------------------------------------------------------------------
// Date change: owner edits own REQUESTED request, or admin reschedules any
// request (which resets it to REQUESTED and refunds if it was APPROVED)
// ---------------------------------------------------------------------------
async function handleDateUpdate(existing: ExistingRequest, body: unknown, actor: Actor) {
  const parsed = updateRequestDatesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(validationError(parsed.error), { status: 400 });
  }

  const isAdmin = actor.role === Role.ADMIN;
  const isOwner = existing.profileId === actor.id;

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }
  if (!isAdmin && existing.status !== RequestStatus.REQUESTED) {
    return NextResponse.json({ error: 'Can only edit REQUESTED requests' }, { status: 400 });
  }
  if (isAdmin && !canPerform('RESCHEDULE', existing.status)) {
    return NextResponse.json(
      { error: `Cannot reschedule a ${existing.status} request` },
      { status: 400 }
    );
  }

  const newStart = parsed.data.startDate ? new Date(parsed.data.startDate) : existing.startDate;
  const newEnd = parsed.data.endDate ? new Date(parsed.data.endDate) : existing.endDate;

  if (newEnd < newStart) {
    return NextResponse.json(
      { error: 'End date must be after or equal to start date' },
      { status: 400 }
    );
  }

  const unchanged =
    newStart.getTime() === existing.startDate.getTime() &&
    newEnd.getTime() === existing.endDate.getTime();
  if (unchanged) {
    return NextResponse.json({ error: 'Dates are unchanged' }, { status: 400 });
  }

  // The schema can only check the span when both dates are supplied; cover the mixed case here.
  if ((newEnd.getTime() - newStart.getTime()) / MS_PER_DAY > MAX_LEAVE_SPAN_DAYS) {
    return NextResponse.json(
      { error: `Leave cannot span more than ${MAX_LEAVE_SPAN_DAYS} days` },
      { status: 400 }
    );
  }

  const newDaysCount = calculateBusinessDays(newStart, newEnd);
  if (newDaysCount === 0) {
    return NextResponse.json(
      { error: 'Leave request must include at least one business day' },
      { status: 400 }
    );
  }

  // Admin reschedule returns the request to REQUESTED; refund if it was APPROVED.
  const effect = isAdmin ? balanceEffect(existing.status, RequestStatus.REQUESTED) : 'NONE';
  const refunded = effect === 'REFUND' ? existing.daysCount : 0;
  const available = calculateAvailableDays(existing.profile) + refunded;
  if (newDaysCount > available) {
    return NextResponse.json(
      { error: `Insufficient vacation days. Available: ${available}, Requested: ${newDaysCount}` },
      { status: 400 }
    );
  }

  const updated = await commitRequestChange({
    id: existing.id,
    expectedStatus: existing.status,
    expectedUpdatedAt: existing.updatedAt,
    profileId: existing.profileId,
    effect,
    days: existing.daysCount,
    data: {
      startDate: newStart,
      endDate: newEnd,
      daysCount: newDaysCount,
      ...(isAdmin ? { status: RequestStatus.REQUESTED, rejectionReason: null } : {}),
    },
  });
  if (!updated) return conflict();

  // Notify the employee, unless the admin is rescheduling their own request.
  if (isAdmin && existing.profileId !== actor.id) {
    const { email, fullName } = existing.profile;
    await notify(() =>
      sendRescheduleEmail(
        email,
        fullName || email,
        existing.startDate,
        existing.endDate,
        newStart,
        newEnd,
        newDaysCount
      )
    );
  }

  return NextResponse.json(updated);
}

// PATCH /api/requests/[id] - Update leave request (status or dates)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rateLimitResponse = withRateLimit(request, RATE_LIMITS.api, 'requests-update');
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const userProfile = await getAuthenticatedProfile();
    if (!userProfile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { profile: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    // request.json() happily returns null / numbers / arrays; those must not reach `body.status`.
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const isStatusUpdate = body.status !== undefined;
    const isDateUpdate = body.startDate !== undefined || body.endDate !== undefined;

    if (isStatusUpdate && isDateUpdate) {
      return NextResponse.json(
        { error: 'Cannot update status and dates in the same request' },
        { status: 400 }
      );
    }

    if (isStatusUpdate) {
      if (userProfile.role !== Role.ADMIN) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
      return await handleStatusUpdate(existing, body);
    }

    if (isDateUpdate) {
      return await handleDateUpdate(existing, body, userProfile);
    }

    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error updating leave request:', error);
    return NextResponse.json({ error: 'Failed to update leave request' }, { status: 500 });
  }
}

// DELETE /api/requests/[id] - Delete leave request
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = withRateLimit(request, RATE_LIMITS.api, 'requests-delete');
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const userProfile = await getAuthenticatedProfile();
    if (!userProfile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { profile: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    const isOwner = existing.profileId === userProfile.id;
    const isAdmin = userProfile.role === Role.ADMIN;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    if (!isAdmin && existing.status !== RequestStatus.REQUESTED) {
      return NextResponse.json({ error: 'Can only delete REQUESTED requests' }, { status: 400 });
    }

    const effect = existing.status === RequestStatus.APPROVED ? 'REFUND' : 'NONE';

    const deleted = await prisma.$transaction(async (tx) => {
      // status + updatedAt in the where clause = optimistic lock (see lib/requestMutations.ts)
      const { count } = await tx.leaveRequest.deleteMany({
        where: { id, status: existing.status, updatedAt: existing.updatedAt },
      });
      if (count === 0) return false;
      await adjustBalance(tx, existing.profileId, effect, existing.daysCount);
      return true;
    });

    if (!deleted) return conflict();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting leave request:', error);
    return NextResponse.json({ error: 'Failed to delete leave request' }, { status: 500 });
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run 'requests/[id]'`
Expected: PASS, 26 tests (2 body + 10 status + 10 dates + 4 delete).

**Step 5: Type-check and lint**

Run: `npm run type-check && npm run lint`
Expected: both clean. If TypeScript complains that `toStatus` is not assignable to `RequestStatus` in `data.status`, the Zod enum literals match Prisma's literal union; check that `npx prisma generate` ran after Task 1.

**Step 6: Manual smoke (dev server, existing admin requests page)**

Run: `npm run dev`, open `/admin/requests`, approve one pending request and deny another. Both must still work (this page is untouched but depends on the rewritten route).

**Step 7: Commit**

```bash
git add "app/api/requests/[id]/route.ts" "app/api/requests/[id]/__tests__/route.test.ts"
git commit -m "feat: cancel, admin reschedule and optimistic locking for leave requests

Status transitions now flow through lib/requestTransitions; all
balance-changing writes use commitRequestChange (status+updatedAt lock
plus profile row lock) so concurrent edits return 409 instead of
double-deducting. Approval now refuses when the balance is insufficient
instead of going negative.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 6: Status presentation metadata, `RequestStatusBadge`, shared date helpers, widen client types

**Files:**

- Modify: `tailwind.config.js:3-7` (add `lib/` to `content` — **without this every chip class below is purged**)
- Modify: `lib/holidayCalculator.ts:63` (export `parseLocalDate`)
- Create: `lib/requestStatus.ts`
- Create: `components/RequestStatusBadge.tsx`
- Modify: `app/dashboard/page.tsx:25` (status union), `:356-366` (badge span), `:404-410` (icon column)
- Modify: `app/admin/requests/page.tsx:19` (status union) and `:395-397` (hard-coded PENDING pill)

**Step 1: Let Tailwind see class strings in `lib/`**

`tailwind.config.js`:

```js
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
```

**Step 2: Export the local-date parser**

`lib/holidayCalculator.ts:63`: `function parseLocalDate(` → `export function parseLocalDate(`. It already handles both `Date` and ISO strings (splits on `T`) and returns local midnight of the calendar date, which is what the calendar grid and every date display need regardless of the viewer's timezone.

**Step 3: Create the metadata module (client-safe: imports only `@/types` and the pure date helper)**

`lib/requestStatus.ts`:

```ts
import type { RequestStatusValue } from '@/types';
import { parseLocalDate } from '@/lib/holidayCalculator';

interface RequestStatusMeta {
  label: string;
  /** Pill badge (modal header, dashboard history, admin requests list). */
  badge: string;
  /**
   * Calendar chip. Each status must be distinguishable without colour:
   * pending = dashed border, approved = solid fill, denied = strikethrough + solid border,
   * cancelled = strikethrough + italic. All text/background pairs are ≥ 4.5:1.
   */
  chip: string;
  /** Legend swatch. */
  swatch: string;
}

export const REQUEST_STATUS_META: Record<RequestStatusValue, RequestStatusMeta> = {
  REQUESTED: {
    label: 'Pending',
    badge: 'bg-orange-100 text-orange-700',
    chip: 'bg-orange-50 text-orange-800 border border-dashed border-orange-400 hover:bg-orange-100',
    swatch: 'bg-orange-50 border border-dashed border-orange-400',
  },
  APPROVED: {
    label: 'Approved',
    badge: 'bg-green-100 text-green-700',
    chip: 'bg-[#0041F0] text-white hover:bg-blue-700',
    swatch: 'bg-[#0041F0]',
  },
  DENIED: {
    label: 'Denied',
    badge: 'bg-red-100 text-red-700',
    chip: 'bg-red-50 text-red-700 line-through border border-red-300 hover:bg-red-100',
    swatch: 'bg-red-50 border border-red-300',
  },
  CANCELLED: {
    label: 'Cancelled',
    badge: 'bg-slate-100 text-slate-600',
    chip: 'bg-slate-100 text-slate-600 line-through italic hover:bg-slate-200',
    swatch: 'bg-slate-100 border border-slate-300',
  },
};

export const ALL_REQUEST_STATUSES = Object.keys(REQUEST_STATUS_META) as RequestStatusValue[];

/** Render order inside a calendar cell: actionable/real absences first, ghosts last. */
export const REQUEST_STATUS_PRIORITY: Record<RequestStatusValue, number> = {
  APPROVED: 0,
  REQUESTED: 1,
  DENIED: 2,
  CANCELLED: 3,
};

/**
 * Statuses that count towards the "multiple people away" warning.
 * Unchanged from before this feature: approved leave only.
 */
export const OVERLAP_STATUSES: readonly RequestStatusValue[] = ['APPROVED'];

/** "Jul 6, 2026" from an ISO date string, by calendar date (not the viewer's timezone). */
export function formatLeaveDate(iso: string): string {
  return parseLocalDate(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
```

**Step 4: Create the badge**

`components/RequestStatusBadge.tsx`:

```tsx
import type { RequestStatusValue } from '@/types';
import { REQUEST_STATUS_META } from '@/lib/requestStatus';

interface RequestStatusBadgeProps {
  status: RequestStatusValue;
  className?: string;
}

export default function RequestStatusBadge({ status, className = '' }: RequestStatusBadgeProps) {
  const meta = REQUEST_STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black ${meta.badge} ${className}`}
    >
      {meta.label}
    </span>
  );
}
```

**Step 5: Use it on the dashboard**

In `app/dashboard/page.tsx`:

- Add imports:
  ```ts
  import type { RequestStatusValue } from '@/types';
  import RequestStatusBadge from '@/components/RequestStatusBadge';
  ```
- Line 25: `status: 'REQUESTED' | 'APPROVED' | 'DENIED';` → `status: RequestStatusValue;`
- Replace the status `<span className={\`px-3 py-1 rounded-full text-xs font-black ${ request.status === 'REQUESTED' ? ... }\`}>{request.status}</span>`block (lines 356–366, inside the`flex items-center gap-3 mb-2` div; NOT the admin employee-name block further down) with:
  ```tsx
  <RequestStatusBadge status={request.status} />
  ```
- In the right-hand icon column (lines 404–410), add after the DENIED icon:
  ```tsx
  {
    request.status === 'CANCELLED' && (
      <XCircle className="text-slate-400" size={20} strokeWidth={2} />
    );
  }
  ```

**Step 6: Admin requests page: widen the type and reuse the badge**

`app/admin/requests/page.tsx`:

- Add `import type { RequestStatusValue } from '@/types';` and `import RequestStatusBadge from '@/components/RequestStatusBadge';`
- Line 19: `status: 'REQUESTED' | 'APPROVED' | 'DENIED';` → `status: RequestStatusValue;`
- Lines 362–364: replace the hard-coded `<span className="px-2 py-0.5 rounded text-xs font-black bg-orange-100 text-orange-700">PENDING</span>` with `<RequestStatusBadge status={request.status} />` so the app has one pending pill, not three.

**Step 7: Verify**

Run: `npm run type-check && npm run lint && npx vitest run`
Expected: clean; all suites pass.

Open `/dashboard` and `/admin/requests` in the dev server: badges read "Pending / Approved / Denied" instead of raw enum text.

**Step 8: Commit**

```bash
git add tailwind.config.js lib/holidayCalculator.ts lib/requestStatus.ts components/RequestStatusBadge.tsx app/dashboard/page.tsx app/admin/requests/page.tsx
git commit -m "feat: shared request status metadata, badge component and date helpers

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 7: `EventDetailModal`

**Files:**

- Create: `components/calendar/EventDetailModal.tsx`
- Test: `components/calendar/__tests__/EventDetailModal.test.tsx`

Behaviour:

- Rendered through `createPortal` into `document.body` so the page's `space-y-8` margins cannot offset the fixed backdrop.
- Header: employee name, status badge, close button.
- Details: email, date range, business days, requested-on, reason (if any; red only for DENIED).
- If the leave already ended and is APPROVED, an info note says cancel/reschedule/delete will still refund the days.
- `view` mode buttons, gated by `canPerform`: **Approve** (green), **Cancel leave** (amber-700), **Reschedule** (outline), **Delete** (red outline).
- `reschedule` mode: two date inputs (`min`/`max` 2020–2100), live business-day preview, warning that status becomes Pending (and days refunded if currently approved). Save disabled until dates change and preview > 0.
- `cancel` mode: optional reason textarea (max 500), refund note if approved, confirm button.
- `delete` mode: irreversible warning + confirm button. This is the "uz potvrdu" step.
- After any success: `onNotify('success', …)`, `await onChanged()` (parent refetches), then `onClose()` — same as the existing approve/deny modals, so the page toast is visible and focus returns to the calendar.
- Errors from the API are shown inline (`role="alert"`). On **409 or 404** the modal also refetches so the admin sees the current state instead of retrying against stale data.
- Accessibility: `role="dialog" aria-modal="true" aria-labelledby`; dialog receives focus on open and returns focus to the opener on close; Escape closes; Tab/Shift+Tab cycle inside the dialog; backdrop click closes only when mousedown and click both land on the backdrop (a drag-select inside the textarea that ends outside does not close); every control is a real `<button>`/`<input>`/`<textarea>`.

**Step 1: Write the failing tests**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EventDetailModal from '../EventDetailModal';
import type { LeaveRequestWithProfile } from '@/types';

const base: LeaveRequestWithProfile = {
  id: 'req-1',
  profileId: 'user-1',
  startDate: '2026-07-06T00:00:00.000Z',
  endDate: '2026-07-10T00:00:00.000Z',
  daysCount: 5,
  status: 'REQUESTED',
  rejectionReason: null,
  createdAt: '2026-06-01T10:00:00.000Z',
  profile: { id: 'user-1', email: 'ana@lexi.hr', fullName: 'Ana Anić' },
};

function setup(overrides: Partial<LeaveRequestWithProfile> = {}) {
  const onClose = vi.fn();
  const onChanged = vi.fn().mockResolvedValue(undefined);
  const onNotify = vi.fn();
  render(
    <EventDetailModal
      request={{ ...base, ...overrides }}
      onClose={onClose}
      onChanged={onChanged}
      onNotify={onNotify}
    />
  );
  return { onClose, onChanged, onNotify };
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
  global.fetch = fetchMock as never;
});

describe('EventDetailModal', () => {
  it('renders name, status and details', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Ana Anić' })).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('ana@lexi.hr')).toBeInTheDocument();
    expect(screen.getByText(/5 business days/)).toBeInTheDocument();
  });

  it('shows all four actions for REQUESTED', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel leave' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reschedule' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('hides Approve for APPROVED', () => {
    setup({ status: 'APPROVED' });
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Cancel leave' })).toBeInTheDocument();
  });

  it('hides Cancel for CANCELLED but shows Approve', () => {
    setup({ status: 'CANCELLED' });
    expect(screen.queryByRole('button', { name: 'Cancel leave' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
  });

  it('approve sends PATCH, asks parent to refetch, then closes', async () => {
    const { onChanged, onNotify, onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/requests/req-1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'APPROVED' }) })
    );
    expect(onChanged).toHaveBeenCalled();
    expect(onNotify).toHaveBeenCalledWith('success', expect.any(String));
  });

  it('delete requires a confirmation step, then closes', async () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/requests/req-1',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('reschedule save is disabled until dates change, then PATCHes dates', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Reschedule' }));
    const save = screen.getByRole('button', { name: 'Save new dates' });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Start Date'), { target: { value: '2026-07-13' } });
    fireEvent.change(screen.getByLabelText('End Date'), { target: { value: '2026-07-15' } });
    expect(screen.getByText(/Business days: 3/)).toBeInTheDocument();
    expect(save).toBeEnabled();

    fireEvent.click(save);
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/requests/req-1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ startDate: '2026-07-13', endDate: '2026-07-15' }),
        })
      )
    );
  });

  it('cancel sends CANCELLED with trimmed optional reason', async () => {
    setup({ status: 'APPROVED' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel leave' }));
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: '  busy  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/requests/req-1',
        expect.objectContaining({
          body: JSON.stringify({ status: 'CANCELLED', rejectionReason: 'busy' }),
        })
      )
    );
  });

  it('shows a 400 error inline and does not refetch', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'Nope' }) });
    const { onChanged, onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Nope');
    expect(onChanged).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('on 409 shows the error, refetches, and stays open', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'Changed elsewhere' }),
    });
    const { onChanged, onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Changed elsewhere');
    expect(onChanged).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('survives a non-JSON error body', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('x');
      },
    });
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Something went wrong/);
  });

  it('focuses the dialog on open', () => {
    setup();
    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('Escape closes the modal', () => {
    const { onClose } = setup();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('backdrop click closes; click inside the dialog does not', () => {
    const { onClose } = setup();
    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.parentElement as HTMLElement;

    fireEvent.mouseDown(dialog);
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('warns when approved leave already ended', () => {
    setup({
      status: 'APPROVED',
      startDate: '2020-03-02T00:00:00.000Z',
      endDate: '2020-03-06T00:00:00.000Z',
    });
    expect(screen.getByText(/already been taken/)).toBeInTheDocument();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run components/calendar/__tests__/EventDetailModal.test.tsx`
Expected: FAIL — `Cannot find module '../EventDetailModal'`.

**Step 3: Implement the modal**

`components/calendar/EventDetailModal.tsx`:

```tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  CheckCircle,
  Ban,
  CalendarClock,
  Trash2,
  Mail,
  Calendar,
  Clock,
  AlertTriangle,
  Info,
} from 'lucide-react';
import type { LeaveRequestWithProfile } from '@/types';
import { calculateBusinessDays, parseLocalDate } from '@/lib/holidayCalculator';
import { canPerform } from '@/lib/requestTransitions';
import { formatLeaveDate } from '@/lib/requestStatus';
import RequestStatusBadge from '@/components/RequestStatusBadge';

type Mode = 'view' | 'reschedule' | 'cancel' | 'delete';

interface EventDetailModalProps {
  request: LeaveRequestWithProfile;
  onClose: () => void;
  /** Called after every successful mutation (and after a 409/404). Parent should refetch requests. */
  onChanged: () => Promise<void>;
  onNotify: (type: 'success' | 'error', text: string) => void;
}

/** Prisma stores dates as UTC midnight; the ISO string's first 10 chars are the calendar date. */
const toInputDate = (iso: string) => iso.slice(0, 10);

// Mirrors the server-side range in lib/validations.ts
const DATE_MIN = '2020-01-01';
const DATE_MAX = '2100-12-31';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled])';

const inputClass =
  'w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0041F0] focus:border-transparent';
const btnBase =
  'flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed';
const btnSecondary = `${btnBase} border border-slate-200 text-slate-600 hover:bg-slate-50`;

export default function EventDetailModal({
  request,
  onClose,
  onChanged,
  onNotify,
}: EventDetailModalProps) {
  const [mode, setMode] = useState<Mode>('view');
  const [startDate, setStartDate] = useState(toInputDate(request.startDate));
  const [endDate, setEndDate] = useState(toInputDate(request.endDate));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const mouseDownOnBackdrop = useRef(false);

  // Fresh data from the parent (after a 409/404 refetch) resets the form.
  useEffect(() => {
    setStartDate(toInputDate(request.startDate));
    setEndDate(toInputDate(request.endDate));
  }, [request.id, request.startDate, request.endDate]);

  // Focus the dialog on open; return focus to whatever opened it on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => opener?.focus();
  }, []);

  // Escape closes (unless busy). Tab / Shift+Tab cycle within the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!busy) onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusables = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialogRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const name = request.profile.fullName || request.profile.email;
  const dayWord = request.daysCount === 1 ? 'day' : 'days';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const alreadyTaken = request.status === 'APPROVED' && parseLocalDate(request.endDate) < today;

  const previewDays = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return null;
    return calculateBusinessDays(startDate, endDate);
  }, [startDate, endDate]);

  const datesChanged =
    startDate !== toInputDate(request.startDate) || endDate !== toInputDate(request.endDate);

  async function mutate(init: RequestInit, successText: string) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/requests/${request.id}`, init);
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => null);
        const serverMessage =
          data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
            ? data.error
            : null;
        setError(serverMessage || 'Something went wrong. Please try again.');
        // Stale data: someone else changed or deleted this request. Refresh so the
        // buttons reflect reality (a 404 unmounts us via the parent's derived selection).
        if (res.status === 409 || res.status === 404) {
          await onChanged();
          setMode('view');
        }
        return;
      }
      onNotify('success', successText);
      await onChanged();
      onClose();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const patch = (body: Record<string, unknown>, successText: string) =>
    mutate(
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      successText
    );

  const backButton = (
    <button
      type="button"
      onClick={() => {
        setMode('view');
        setError('');
      }}
      disabled={busy}
      className={`${btnSecondary} flex-1`}
    >
      Back
    </button>
  );

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => {
        mouseDownOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (mouseDownOnBackdrop.current && e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-modal-title"
        className="bg-white rounded-[24px] shadow-2xl max-w-lg w-full p-8 outline-none max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 id="event-modal-title" className="text-2xl font-bold text-slate-900">
              {name}
            </h2>
            <RequestStatusBadge status={request.status} className="mt-2" />
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
          >
            <X size={24} />
          </button>
        </div>

        {/* Details (icons live inside <dd> to keep the <dl> content model valid) */}
        <dl className="mb-6 p-4 bg-slate-50 rounded-lg space-y-2 text-sm text-slate-600">
          <div>
            <dt className="sr-only">Email</dt>
            <dd className="flex items-center gap-2">
              <Mail size={14} className="text-slate-500" aria-hidden="true" />
              {request.profile.email}
            </dd>
          </div>
          <div>
            <dt className="sr-only">Dates</dt>
            <dd className="flex items-center gap-2">
              <Calendar size={14} className="text-slate-500" aria-hidden="true" />
              {formatLeaveDate(request.startDate)} – {formatLeaveDate(request.endDate)}
            </dd>
          </div>
          <div>
            <dt className="sr-only">Duration</dt>
            <dd className="flex items-center gap-2 font-bold text-[#0041F0]">
              <Clock size={14} aria-hidden="true" />
              {request.daysCount} business {dayWord}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="text-slate-500">Requested on</dt>
            <dd>
              {new Date(request.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </dd>
          </div>
          {request.rejectionReason && (
            <div className="flex items-start gap-2">
              <dt className="text-slate-500">Reason</dt>
              <dd className={request.status === 'DENIED' ? 'text-red-700' : 'text-slate-700'}>
                {request.rejectionReason}
              </dd>
            </div>
          )}
        </dl>

        {alreadyTaken && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900 flex gap-2">
            <Info size={16} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              This leave has already been taken. Cancelling, rescheduling or deleting it will still
              refund {request.daysCount} {dayWord}.
            </span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800"
          >
            {error}
          </div>
        )}

        {/* View: actions */}
        {mode === 'view' && (
          <div className="grid grid-cols-2 gap-3">
            {canPerform('APPROVE', request.status) && (
              <button
                type="button"
                onClick={() => patch({ status: 'APPROVED' }, 'Request approved')}
                disabled={busy}
                className={`${btnBase} bg-green-600 text-white hover:bg-green-700`}
              >
                <CheckCircle size={18} strokeWidth={2.5} aria-hidden="true" />
                Approve
              </button>
            )}
            {canPerform('CANCEL', request.status) && (
              <button
                type="button"
                onClick={() => {
                  setReason('');
                  setError('');
                  setMode('cancel');
                }}
                disabled={busy}
                className={`${btnBase} bg-amber-700 text-white hover:bg-amber-600`}
              >
                <Ban size={18} strokeWidth={2.5} aria-hidden="true" />
                Cancel leave
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setError('');
                setMode('reschedule');
              }}
              disabled={busy}
              className={`${btnBase} border border-[#0041F0] text-[#0041F0] hover:bg-blue-50`}
            >
              <CalendarClock size={18} strokeWidth={2.5} aria-hidden="true" />
              Reschedule
            </button>
            <button
              type="button"
              onClick={() => {
                setError('');
                setMode('delete');
              }}
              disabled={busy}
              className={`${btnBase} border border-red-300 text-red-600 hover:bg-red-50`}
            >
              <Trash2 size={18} strokeWidth={2.5} aria-hidden="true" />
              Delete
            </button>
          </div>
        )}

        {/* Reschedule */}
        {mode === 'reschedule' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              patch({ startDate, endDate }, 'Dates updated. Request is pending re-approval.');
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="reschedule-start"
                  className="block text-sm font-bold text-slate-700 mb-2"
                >
                  Start Date
                </label>
                <input
                  id="reschedule-start"
                  type="date"
                  value={startDate}
                  min={DATE_MIN}
                  max={DATE_MAX}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  htmlFor="reschedule-end"
                  className="block text-sm font-bold text-slate-700 mb-2"
                >
                  End Date
                </label>
                <input
                  id="reschedule-end"
                  type="date"
                  value={endDate}
                  min={startDate || DATE_MIN}
                  max={DATE_MAX}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
            </div>

            {previewDays !== null && (
              <p className="text-sm font-bold text-blue-900">Business days: {previewDays}</p>
            )}

            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800 flex gap-2">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Saving sets the status to Pending and requires approval again.
                {request.status === 'APPROVED' &&
                  ` The current ${request.daysCount} ${dayWord} will be refunded.`}
              </span>
            </div>

            <div className="flex gap-3">
              {backButton}
              <button
                type="submit"
                disabled={busy || !datesChanged || !previewDays}
                className={`${btnBase} flex-1 bg-[#0041F0] text-white hover:bg-blue-700`}
              >
                {busy ? 'Saving...' : 'Save new dates'}
              </button>
            </div>
          </form>
        )}

        {/* Cancel */}
        {mode === 'cancel' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              patch(
                { status: 'CANCELLED', rejectionReason: reason.trim() || undefined },
                'Leave cancelled'
              );
            }}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="cancel-reason"
                className="block text-sm font-bold text-slate-700 mb-2"
              >
                Reason (optional)
              </label>
              <textarea
                id="cancel-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={3}
                className={`${inputClass} resize-none`}
              />
            </div>
            {request.status === 'APPROVED' && (
              <p className="text-sm text-slate-600">
                {request.daysCount} {dayWord} will be refunded to {name}.
              </p>
            )}
            <div className="flex gap-3">
              {backButton}
              <button
                type="submit"
                disabled={busy}
                className={`${btnBase} flex-1 bg-amber-700 text-white hover:bg-amber-600`}
              >
                {busy ? 'Cancelling...' : 'Confirm cancellation'}
              </button>
            </div>
          </form>
        )}

        {/* Delete */}
        {mode === 'delete' && (
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              This permanently deletes the request
              {request.status === 'APPROVED' && ` and refunds ${request.daysCount} ${dayWord}`}.
              This cannot be undone.
            </div>
            <div className="flex gap-3">
              {backButton}
              <button
                type="button"
                onClick={() => mutate({ method: 'DELETE' }, 'Request deleted')}
                disabled={busy}
                className={`${btnBase} flex-1 bg-red-600 text-white hover:bg-red-700`}
              >
                {busy ? 'Deleting...' : 'Delete permanently'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run components/calendar/__tests__/EventDetailModal.test.tsx`
Expected: PASS, 15 tests.

**Step 5: Commit**

```bash
git add components/calendar/EventDetailModal.tsx components/calendar/__tests__/EventDetailModal.test.tsx
git commit -m "feat: add calendar event detail modal with approve/cancel/reschedule/delete

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 8: Calendar page — all statuses, legend toggles, click-to-open modal

**Files:**

- Rewrite: `app/admin/calendar/page.tsx`

Changes vs. current file:

1. Fetch `/api/requests` (all statuses).
2. Precompute a `day → requests` map once per month (`useMemo`) instead of scanning all requests per cell; dates go through `parseLocalDate` (calendar date, timezone-safe); each day's list is sorted by `REQUEST_STATUS_PRIORITY` so approved/pending chips stay above the fold and denied/cancelled ghosts sink.
3. Chips become `<button>`s styled by `REQUEST_STATUS_META[status].chip`; click sets `selectedId`. Focus ring uses `focus-visible` + `ring-inset` so it is not clipped by the cell's `overflow-y-auto`.
4. Legend entries for the four statuses are toggle buttons (`aria-pressed`); hidden statuses don't render chips. Off state uses a dashed border and muted swatch (not opacity on the text).
5. Overlap badge: unchanged meaning (approved only, `OVERLAP_STATUSES`), now counts distinct people, independent of toggles; icon gets an accessible name.
6. Toast message pattern copied from `admin/requests` page (extracting a shared Toast is a follow-up).
7. `selectedRequest` is derived from `requests` by id, so after refetch the open modal shows fresh data; after delete (or a 404 refetch) it unmounts. `closeModal` is memoised so the modal's key listener isn't re-registered on every toast tick.
8. `fetchRequests` must **not** set `loading` back to `true` on refetch (it would unmount the modal via the early-return spinner).
9. The modal portals itself to `document.body`, so it can stay a child of the `space-y-8` root here without inheriting a margin.

**Step 1: Replace the file**

```tsx
'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, AlertTriangle } from 'lucide-react';
import { getHolidaysForMonth, Holiday, parseLocalDate } from '@/lib/holidayCalculator';
import {
  ALL_REQUEST_STATUSES,
  OVERLAP_STATUSES,
  REQUEST_STATUS_META,
  REQUEST_STATUS_PRIORITY,
  formatLeaveDate,
} from '@/lib/requestStatus';
import type { LeaveRequestWithProfile, RequestStatusValue } from '@/types';
import EventDetailModal from '@/components/calendar/EventDetailModal';

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function AdminCalendarPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [requests, setRequests] = useState<LeaveRequestWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [visibleStatuses, setVisibleStatuses] = useState<Set<RequestStatusValue>>(
    () => new Set(ALL_REQUEST_STATUSES)
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showMessage = useCallback((type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  }, []);

  // Check user role before rendering admin content
  useEffect(() => {
    async function checkRole() {
      try {
        const res = await fetch('/api/profile/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const profile = await res.json();
        if (profile?.role !== 'ADMIN') {
          router.push('/access-denied');
          return;
        }
        setIsAuthorized(true);
      } catch (error) {
        console.error('Failed to verify role:', error);
        router.push('/login');
      } finally {
        setIsChecking(false);
      }
    }
    checkRole();
  }, [router]);

  // NOTE: never sets loading=true — refetches after modal actions must not unmount the modal.
  const fetchRequests = useCallback(async () => {
    try {
      const response = await fetch('/api/requests');
      if (response.ok) {
        setRequests(await response.json());
      } else {
        showMessage('error', 'Failed to load requests');
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error);
      showMessage('error', 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [showMessage]);

  useEffect(() => {
    if (isAuthorized) {
      fetchRequests();
    }
  }, [fetchRequests, isAuthorized]);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const startDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // Monday-first grid

  const monthHolidays = useMemo(() => {
    const holidayMap = new Map<number, Holiday>();
    getHolidaysForMonth(currentYear, currentMonth).forEach((h) => {
      holidayMap.set(parseInt(h.date.split('-')[2], 10), h);
    });
    return holidayMap;
  }, [currentYear, currentMonth]);

  // day-of-month → every request (any status) covering that day
  const requestsByDay = useMemo(() => {
    const map = new Map<number, LeaveRequestWithProfile[]>();
    for (let day = 1; day <= daysInMonth; day++) map.set(day, []);

    const monthStart = new Date(currentYear, currentMonth, 1);
    const monthEnd = new Date(currentYear, currentMonth, daysInMonth);

    for (const request of requests) {
      const start = parseLocalDate(request.startDate);
      const end = parseLocalDate(request.endDate);
      if (end < monthStart || start > monthEnd) continue;

      const from = start < monthStart ? 1 : start.getDate();
      const to = end > monthEnd ? daysInMonth : end.getDate();
      for (let day = from; day <= to; day++) {
        map.get(day)!.push(request);
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => REQUEST_STATUS_PRIORITY[a.status] - REQUEST_STATUS_PRIORITY[b.status]);
    }
    return map;
  }, [requests, currentYear, currentMonth, daysInMonth]);

  const selectedRequest = selectedId ? (requests.find((r) => r.id === selectedId) ?? null) : null;
  const closeModal = useCallback(() => setSelectedId(null), []);

  const toggleStatus = (status: RequestStatusValue) => {
    setVisibleStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const prevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const calendarDays: (number | null)[] = [
    ...Array<null>(startDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentMonth === today.getMonth() &&
      currentYear === today.getFullYear()
    );
  };
  const isWeekend = (dayIndex: number) => dayIndex % 7 === 5 || dayIndex % 7 === 6;

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500">Verifying permissions...</div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null; // Redirecting
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Team Calendar</h1>
        <p className="text-slate-500 mt-2 font-medium">
          View and manage all leave requests, and spot scheduling conflicts. Click an entry for
          details.
        </p>
      </header>

      {message && (
        <div
          role="status"
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Calendar Container */}
      <section className="bg-white rounded-[24px] border border-slate-200 shadow-lg shadow-slate-200/50 overflow-hidden">
        {/* Calendar Header */}
        <div className="p-8 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <CalendarIcon className="text-[#0041F0]" size={24} strokeWidth={2} />
            <h2 className="text-2xl font-bold text-slate-900">
              {monthNames[currentMonth]} {currentYear}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={prevMonth}
              className="p-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-all"
              title="Previous month"
              aria-label="Previous month"
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all"
            >
              Today
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="p-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-all"
              title="Next month"
              aria-label="Next month"
            >
              <ChevronRight size={20} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Day Names Header */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {dayNames.map((day, index) => (
            <div
              key={day}
              className={`py-3 text-center text-xs font-black uppercase tracking-wider ${
                index >= 5 ? 'text-red-400' : 'text-slate-400'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 auto-rows-[140px]">
          {calendarDays.map((day, index) => {
            const allForDay = day ? (requestsByDay.get(day) ?? []) : [];
            const dayRequests = allForDay.filter((r) => visibleStatuses.has(r.status));
            const peopleAway = new Set(
              allForDay.filter((r) => OVERLAP_STATUSES.includes(r.status)).map((r) => r.profileId)
            );
            const overlap = peopleAway.size > 1;
            const weekend = isWeekend(index);
            const today = day ? isToday(day) : false;
            const holiday = day ? monthHolidays.get(day) : undefined;

            return (
              <div
                key={index}
                className={`border-r border-b border-slate-200 p-2 flex flex-col relative ${
                  !day ? 'bg-slate-50/30' : ''
                } ${holiday ? 'bg-purple-50' : weekend ? 'bg-slate-50/50' : ''} ${today ? 'bg-blue-50/30' : ''}`}
              >
                {day && (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-sm font-bold ${
                          today
                            ? 'bg-[#0041F0] text-white w-7 h-7 flex items-center justify-center rounded-full'
                            : holiday
                              ? 'text-purple-600'
                              : weekend
                                ? 'text-red-400'
                                : 'text-slate-600'
                        }`}
                      >
                        {day}
                      </span>
                      {overlap && (
                        <span
                          role="img"
                          aria-label="Multiple people away"
                          title="Multiple people away"
                        >
                          <AlertTriangle size={16} className="text-orange-500" aria-hidden="true" />
                        </span>
                      )}
                    </div>

                    {holiday && (
                      <div
                        className="text-[10px] font-semibold text-purple-700 mb-1 truncate"
                        title={`${holiday.name} (${holiday.nameHr})`}
                      >
                        {holiday.name}
                      </div>
                    )}

                    <div className="flex-1 space-y-1 overflow-y-auto">
                      {dayRequests.map((request) => {
                        const meta = REQUEST_STATUS_META[request.status];
                        const name = request.profile.fullName || request.profile.email;
                        const range = `${formatLeaveDate(request.startDate)} – ${formatLeaveDate(request.endDate)}`;
                        return (
                          <button
                            type="button"
                            key={request.id}
                            onClick={() => setSelectedId(request.id)}
                            title={`${name} · ${meta.label} · ${range}`}
                            aria-label={`${name}, ${meta.label}, ${range}`}
                            className={`w-full text-left text-xs font-bold px-2 py-1 rounded truncate transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0041F0] ${meta.chip}`}
                          >
                            {request.profile.fullName || request.profile.email.split('@')[0]}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Legend + status filters */}
      <div className="flex flex-wrap items-center justify-center gap-3 bg-white px-8 py-4 rounded-[24px] border border-slate-200 shadow-lg shadow-slate-200/50">
        {ALL_REQUEST_STATUSES.map((status) => {
          const meta = REQUEST_STATUS_META[status];
          const on = visibleStatuses.has(status);
          return (
            <button
              type="button"
              key={status}
              onClick={() => toggleStatus(status)}
              aria-pressed={on}
              title={
                on
                  ? `Hide ${meta.label.toLowerCase()} requests`
                  : `Show ${meta.label.toLowerCase()} requests`
              }
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                on
                  ? 'border-slate-300 bg-slate-50 text-slate-700'
                  : 'border-dashed border-slate-300 bg-white text-slate-500'
              }`}
            >
              <span
                className={`w-4 h-4 rounded ${meta.swatch} ${on ? '' : 'opacity-30'}`}
                aria-hidden="true"
              />
              <span className="text-sm font-medium">{meta.label}</span>
            </button>
          );
        })}
        <div className="flex items-center gap-2 px-3 py-1.5">
          <div className="w-4 h-4 rounded bg-purple-100 border border-purple-300" />
          <span className="text-sm font-medium text-slate-600">Public Holiday</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5">
          <AlertTriangle size={16} className="text-orange-500" />
          <span className="text-sm font-medium text-slate-600">Overlap Detected</span>
        </div>
      </div>

      {selectedRequest && (
        <EventDetailModal
          request={selectedRequest}
          onClose={closeModal}
          onChanged={fetchRequests}
          onNotify={showMessage}
        />
      )}
    </div>
  );
}
```

**Step 2: Type-check, lint, full test run**

Run: `npm run type-check && npm run lint && npx vitest run`
Expected: all clean.

**Step 3: Manual verification in the dev server (as admin)**

Run: `npm run dev` → `/admin/calendar`

Setup: have at least one request in each status. Create two pending ones from a test employee's `/dashboard`; deny one of them on `/admin/requests` so the denied style is exercised.

- [ ] Fresh load: all four legend toggles are on; pending = orange dashed chips, approved = solid blue, denied = red strikethrough with border, cancelled = grey italic strikethrough. Within a cell, approved/pending chips are listed before denied/cancelled.
- [ ] Legend toggles hide/show each status; overlap triangle unaffected by toggles.
- [ ] Click a pending chip → modal shows details (AC2). **Approve** → modal closes, toast shows, chip turns blue without reload (AC4, AC7).
- [ ] **Cancel leave** on the approved one with a reason → chip grey italic; `/admin/users` shows the employee's balance went back up (AC4).
- [ ] **Reschedule** the cancelled one to new dates → chip moves and turns orange, status Pending (AC3). Open `/admin/requests`: the request is listed for re-approval (AC3 "awaits admin approval").
- [ ] Balance round trip: approve a pending request (balance drops), reschedule it from the modal (balance restored), approve again from the modal (balance drops again).
- [ ] Log in as the employee: `/dashboard` history shows the "Cancelled" badge for the cancelled request and the new dates for the rescheduled one; inbox (or SendGrid activity) shows the cancellation + reschedule emails.
- [ ] **Delete** → first click shows confirmation, second removes chip and closes modal (AC5, AC6).
- [ ] Press Escape / click backdrop → modal closes and focus returns to the chip you opened it from. Tab from the last button wraps to the close button.
- [ ] Double-click **Approve** quickly: second click is disabled (busy). Open the same request in two tabs, approve in one, then approve in the other: the second gets the "changed by someone else" error and the modal refreshes to show Approved.
- [ ] Reschedule an approved request whose end date is in the past: the "already been taken" note is shown.

**Step 4: Commit**

```bash
git add app/admin/calendar/page.tsx
git commit -m "feat: calendar shows all request statuses with filters and detail modal

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 9: Docs, final verification, deploy order

**Files:**

- Modify: `CLAUDE.md` (Key Business Logic section)
- Modify: `README.md:88`
- Modify: `docs/TEST_AND_DOC_GAPS.md` (section 1.1, mark `[id]` route tests as done)

**Step 1: Document the state machine in CLAUDE.md**

Under "### Vacation Balance Updates" replace the code block with:

```markdown
All status changes go through `lib/requestTransitions.ts` (which actions are legal from which
status, and whether the balance is deducted/refunded) and `lib/requestMutations.ts`
(`commitRequestChange`: optimistic lock on status + updatedAt, profile row lock, and balance
adjustment in one transaction). Do not update `leaveRequest.status` or profile balances directly
in routes. A DEDUCT that would make the balance negative throws `InsufficientBalanceError`
(→ 400); approvals never go negative.

| Action                         | From                               | To        | Balance                   |
| ------------------------------ | ---------------------------------- | --------- | ------------------------- |
| APPROVE                        | REQUESTED, DENIED, CANCELLED       | APPROVED  | deduct (carry-over first) |
| DENY                           | REQUESTED                          | DENIED    | none                      |
| CANCEL                         | REQUESTED, APPROVED                | CANCELLED | refund if was APPROVED    |
| RESCHEDULE (admin date change) | any                                | REQUESTED | refund if was APPROVED    |
| DELETE                         | any (admin) / own REQUESTED (user) | —         | refund if was APPROVED    |
```

**Step 2: README + gaps doc**

- `README.md:88`: `REQUESTED | APPROVED | DENIED` → `REQUESTED | APPROVED | DENIED | CANCELLED`
- `README.md:89`: "Optional reason for denial" → "Optional reason for denial or cancellation"
- `docs/TEST_AND_DOC_GAPS.md` section 1.1: note that `app/api/requests/[id]/__tests__/route.test.ts` now exists; remaining gap is `app/api/requests/route.ts` (GET/POST).

**Step 3: Full verification**

Run: `npm run type-check && npm run lint && npx vitest run && npm run build`
Expected: all green; build succeeds.

**Step 4: Commit and push**

```bash
git add CLAUDE.md README.md docs/TEST_AND_DOC_GAPS.md
git commit -m "docs: document leave request transitions and CANCELLED status

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push origin master
```

**Step 5: Production rollout order (manual)**

1. Migrate prod **first**. Check whether prod has migration history (Supabase SQL editor):
   `select migration_name from _prisma_migrations;`
   - Table exists and lists `20260117212432_init` → with `DATABASE_URL`/`DIRECT_URL` pointed at prod: `npx prisma migrate deploy`
   - Table missing (prod was set up with `db push`) → run `ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';` in the SQL editor, then record history so future deploys work:
     `npx prisma migrate resolve --applied 20260117212432_init && npx prisma migrate resolve --applied <timestamp>_add_cancelled_request_status`
2. Then let Vercel deploy master. (Deploying code before the enum exists would make CANCEL / approve-from-cancelled fail with a Postgres enum error; reads are unaffected.)
3. Smoke-test `/admin/calendar` on prod with one cancel + one reschedule.

---

## Out of scope / follow-ups

- Deny from the calendar modal (stays on `/admin/requests`, where the required reason lives).
- Users cancelling their own approved leave (only admins can cancel).
- Creating requests from the calendar.
- Counting pending requests in the overlap warning (currently approved only, as before).
- Date-range filtering on `GET /api/requests` (fetches all; fine for a small team).
- Applying `escapeHtml` to the remaining pre-existing email templates (approval, request notification, invites).
- Extracting the duplicated toast into `components/Toast.tsx` with a permanently mounted live region.
- Returning 404 instead of 403 for non-owner non-admin on PATCH/DELETE (existence oracle; ids are cuids).
- Realtime cross-client updates (Supabase Realtime).
