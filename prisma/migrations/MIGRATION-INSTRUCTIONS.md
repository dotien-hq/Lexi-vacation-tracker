# Migration Instructions: isActive to status

## Pre-Migration Checklist

1. **Backup Database**

   ```bash
   # Export current data
   curl http://localhost:3000/api/backup > backup-$(date +%Y%m%d).json
   ```

2. **Update Schema**

   ```bash
   npx prisma db push
   ```

3. **Run Migration**

   ```bash
   # Connect to database and run migration SQL
   psql $DATABASE_URL -f prisma/migrations/migrate-isactive-to-status.sql
   ```

4. **Verify Migration**
   ```bash
   npx prisma studio
   # Check that all profiles have correct status values
   ```

## Post-Migration

1. Update Supabase Auth Settings:
   - Enable Email/Password provider
   - Disable Magic Link (after transition period)

2. Send notification to existing users:
   - Email blast explaining password setup
   - Direct them to "Forgot Password" flow

## Rollback

If needed, you can rollback by:

```sql
UPDATE "Profile"
SET "isActive" = true
WHERE status = 'ACTIVE';

UPDATE "Profile"
SET "isActive" = false
WHERE status IN ('PENDING', 'DEACTIVATED');
```
