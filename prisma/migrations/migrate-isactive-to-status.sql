-- Migrate existing isActive field to status field
-- Run this after schema update is pushed

-- Map isActive = true AND authUserId exists → ACTIVE
UPDATE "Profile"
SET status = 'ACTIVE'
WHERE "isActive" = true AND "authUserId" IS NOT NULL;

-- Map isActive = true AND authUserId is null → PENDING
-- (These are legacy users who haven't linked to Supabase Auth yet)
UPDATE "Profile"
SET status = 'PENDING'
WHERE "isActive" = true AND "authUserId" IS NULL;

-- Map isActive = false → DEACTIVATED
UPDATE "Profile"
SET status = 'DEACTIVATED'
WHERE "isActive" = false;

-- For ACTIVE users, ensure they have authUserId linked
-- This assumes Supabase auth.users were created with matching emails
-- You may need to manually link some users

-- Optional: Print summary
SELECT
  status,
  COUNT(*) as count
FROM "Profile"
GROUP BY status;
