# Admin Role in Invite Flow + Status Display Bug Fix

**Date:** 2026-01-18
**Status:** Approved Design

## Overview

This design covers two related improvements to the user management system:

1. **Feature:** Add ability to invite ADMIN users through the invite flow
2. **Bug Fix:** Fix PENDING users showing as "Archived" in the user list

## Problem Statement

### Feature Need

Currently, the invite flow hardcodes all new users as USER role. Admins cannot create other admin accounts through the UI, requiring direct database access to create additional admins.

### Bug

Users who have been invited but haven't accepted yet (status: PENDING) are incorrectly displayed with an "Archived" badge because the UI checks the legacy `isActive` field (which is `false` for PENDING users) instead of the new `status` field.

## Design

### 1. Database & API Changes

#### API Route: POST /api/profiles

**Current behavior:** Hardcodes `role: Role.USER`

**New behavior:** Accept optional `role` field from request body, defaulting to USER

```typescript
const { email, fullName, daysCarryOver, daysCurrentYear, role } = body;

// Validate role if provided
if (role && !['USER', 'ADMIN'].includes(role)) {
  return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
}

const profile = await prisma.profile.create({
  data: {
    email,
    fullName: fullName || null,
    role: role || Role.USER,
    daysCurrentYear: daysCurrentYear ?? 20,
    daysCarryOver: daysCarryOver ?? 0,
    status: 'PENDING',
    // ... rest unchanged
  },
});
```

#### API Route: PATCH /api/profiles/[id]

**New behavior:** Accept role updates with protection logic

**Protection Rules:**

1. Admins cannot change their own role
2. Cannot demote the last admin (must have at least one ACTIVE admin)

**Implementation:**

```typescript
// Get requesting admin's profile
const requestingAdmin = await getAuthenticatedProfile();

// If role is being changed
if (body.role && body.role !== currentProfile.role) {
  // Check 1: Prevent self-role change
  if (currentProfile.id === requestingAdmin.id) {
    return NextResponse.json({ error: 'Cannot change your own role' }, { status: 403 });
  }

  // Check 2: Prevent demoting last admin
  if (currentProfile.role === 'ADMIN' && body.role === 'USER') {
    const activeAdminCount = await prisma.profile.count({
      where: {
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    if (activeAdminCount <= 1) {
      return NextResponse.json({ error: 'Cannot demote the last active admin' }, { status: 403 });
    }
  }
}
```

### 2. Invite Form UI Changes

**File:** `app/admin/users/page.tsx`

**Form State Update:**

```typescript
const [inviteForm, setInviteForm] = useState({
  email: '',
  fullName: '',
  daysCarryOver: 0,
  daysCurrentYear: 20,
  role: 'USER' as 'USER' | 'ADMIN', // New field
});
```

**Form UI Addition (after Full Name field):**

```tsx
<div>
  <label className="block text-sm font-medium text-slate-700 mb-2">Role</label>
  <select
    value={inviteForm.role}
    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as 'USER' | 'ADMIN' })}
    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
  >
    <option value="USER">User</option>
    <option value="ADMIN">Admin</option>
  </select>
</div>
```

**Form Reset:** Include role reset to 'USER' when form is closed/submitted

### 3. Edit Profile Modal Changes

**Edit Form State Update:**

```typescript
const [editForm, setEditForm] = useState({
  daysCarryOver: 0,
  daysCurrentYear: 0,
  isActive: true,
  role: 'USER' as 'USER' | 'ADMIN', // New field
});
```

**Initialize on Edit:**

```typescript
const startEdit = (profile: Profile) => {
  setEditingProfile(profile);
  setEditForm({
    daysCarryOver: profile.daysCarryOver,
    daysCurrentYear: profile.daysCurrentYear,
    isActive: profile.isActive,
    role: profile.role, // Initialize from profile
  });
};
```

**Form UI Addition (before vacation days):**

```tsx
<div>
  <label className="block text-sm font-medium text-slate-700 mb-2">Role</label>
  <select
    value={editForm.role}
    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as 'USER' | 'ADMIN' })}
    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
  >
    <option value="USER">User</option>
    <option value="ADMIN">Admin</option>
  </select>
</div>
```

**Error Handling:** Display API errors in the message component when role change is blocked

### 4. Status Display Bug Fix

**Profile Interface Update:**

```typescript
interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  role: 'USER' | 'ADMIN';
  status: 'PENDING' | 'ACTIVE' | 'DEACTIVATED'; // Use status field
  daysCarryOver: number;
  daysCurrentYear: number;
  isActive: boolean; // Legacy - keep for compatibility
  createdAt: string;
  updatedAt: string;
}
```

**Opacity Logic Fix:**

```tsx
// Change from checking isActive to checking status
className={`p-6 hover:bg-slate-50/50 transition-colors ${
  profile.status === 'DEACTIVATED' ? 'opacity-50' : ''
}`}
```

**Badge Display Logic:**

```tsx
{
  profile.status === 'PENDING' && (
    <span className="px-2 py-0.5 rounded text-xs font-black bg-yellow-100 text-yellow-700 flex items-center gap-1">
      <Mail size={12} />
      Pending Invitation
    </span>
  );
}
{
  profile.status === 'DEACTIVATED' && (
    <span className="px-2 py-0.5 rounded text-xs font-black bg-red-100 text-red-700 flex items-center gap-1">
      <Archive size={12} />
      Archived
    </span>
  );
}
```

**Archive Button Logic:**

- For PENDING users: Disable or hide archive button (they haven't activated yet)
- For ACTIVE users: Archive button toggles to DEACTIVATED
- For DEACTIVATED users: Activate button toggles to ACTIVE

## Security Considerations

1. **Admin-only operations:** All endpoints enforce ADMIN role requirement
2. **Self-protection:** Admins cannot change their own role
3. **System protection:** Cannot demote the last active admin
4. **Validation:** Role values validated against enum before database update

## Testing Considerations

1. **Invite flow:**
   - Invite USER, verify role is USER after activation
   - Invite ADMIN, verify role is ADMIN after activation

2. **Edit role:**
   - Change USER → ADMIN, verify success
   - Change ADMIN → USER, verify success
   - Attempt to change own role, verify blocked
   - Attempt to demote last admin, verify blocked

3. **Status display:**
   - PENDING users show "Pending Invitation" badge (yellow)
   - ACTIVE users show no status badge
   - DEACTIVATED users show "Archived" badge (red) and are grayed out

4. **Archive functionality:**
   - Archive ACTIVE user → becomes DEACTIVATED
   - Activate DEACTIVATED user → becomes ACTIVE
   - PENDING users cannot be archived

## Implementation Notes

- No database migrations required (schema already supports all fields)
- API changes are backward compatible (role defaults to USER)
- Legacy `isActive` field remains for gradual migration
- Status field is source of truth for user state
