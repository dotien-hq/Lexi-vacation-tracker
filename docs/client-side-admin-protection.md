# Feature Spec: Client-Side Admin Page Protection

## Problem

Currently, if a regular user manually navigates to admin pages (e.g., `/admin/users`), they experience poor UX:

- Page loads and shows loading state
- API calls fail with 403 Forbidden
- User sees error messages or infinite loading

While the system is secure at the API level, the client-side experience is confusing.

## Solution

Add client-side role verification on all admin pages that redirects unauthorized users to an access-denied page before making any API calls.

## Technical Design

### Components Affected

1. **Admin Pages** (add role check hook)
   - `app/admin/users/page.tsx`
   - `app/admin/requests/page.tsx`
   - `app/admin/calendar/page.tsx`

2. **New Access Denied Page**
   - `app/access-denied/page.tsx` (if doesn't exist)

### Implementation Pattern

Each admin page will:

1. Check user role on mount via `/api/profile/me`
2. If role is not ADMIN, redirect to `/access-denied`
3. Show loading state during verification
4. Only fetch admin data after role verification passes

### Code Pattern

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

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
        router.push('/login');
      } finally {
        setIsChecking(false);
      }
    }

    checkRole();
  }, [router]);

  if (isChecking) {
    return <div>Verifying permissions...</div>;
  }

  if (!isAuthorized) {
    return null; // Redirecting
  }

  // Render admin page content
  return (
    // ...existing page content
  );
}
```

## Benefits

1. **Better UX**: Clear, immediate feedback for unauthorized access
2. **Consistent Error Handling**: Centralized access-denied page
3. **No API Call Waste**: Prevents unnecessary 403 responses
4. **Security Defense in Depth**: Client-side check + API-level enforcement

## Security Note

This is a **UX enhancement only**. All security enforcement remains at the API level. Malicious users can bypass client-side checks, but API endpoints will still return 403 Forbidden.

## Testing Checklist

- [ ] Admin user can access all admin pages normally
- [ ] Regular user accessing `/admin/users` redirects to `/access-denied`
- [ ] Regular user accessing `/admin/requests` redirects to `/access-denied`
- [ ] Regular user accessing `/admin/calendar` redirects to `/access-denied`
- [ ] Unauthenticated user redirects to `/login`
- [ ] No API calls are made before role verification
- [ ] Loading state shows during verification
