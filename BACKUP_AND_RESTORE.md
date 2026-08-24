# Database Backup, Recovery & Migration Safety Procedure — Neon PostgreSQL

This document details the exact operational procedure to create database recovery snapshots, safely apply schema migrations, and perform point-in-time recovery for the DC Material Management production Neon PostgreSQL database.

---

## 1. Overview of Neon Database Recovery Capabilities

Neon PostgreSQL provides automatic point-in-time recovery (PITR) and instant copy-on-write database branching:
- **Instant Branching**: Creates a copy-on-write clone of the production database at any specific point in time or current state without taking the database offline.
- **PITR (Point-In-Time Restore)**: Restores the production state to any timestamp within the retention window.

---

## 2. Pre-Migration Recovery Point Creation

Before executing any production migration, complete these steps:

### Step 1: Create a Pre-Migration Branch / Snapshot
Using the Neon Console:
1. Open [Neon Console](https://console.neon.tech/) and navigate to your project.
2. Select **Branches** → **Create Branch**.
3. Set **Branch Name**: `pre-migration-backup-YYYY-MM-DD-HHMM`.
4. Set **Parent Branch**: `main` (production).
5. Set **Point in Time**: Select **Head** (current production state).
6. Click **Create Branch**.

Using the Neon CLI:
```bash
neon branch create --name pre-migration-backup-$(date +%Y%m%d) --parent main
```

### Step 2: Verify Recovery Point Existence
1. In Neon Console, confirm `pre-migration-backup-YYYY-MM-DD-HHMM` is listed under **Branches** with state **Ready**.
2. Verify branch parent is `main` and parent LSN / timestamp matches the current head.

---

## 3. Safe Production Migration Execution

Once the recovery point is confirmed:

1. Obtain approval from project owner after reviewing the generated migration SQL:
   `prisma/migrations/20260824150000_add_password_change_tracking/migration.sql`
2. Set production environment variable `DATABASE_URL` securely in CLI (do not commit secrets).
3. Apply migration to production:
   ```bash
   npx prisma migrate deploy
   ```
4. Verify migration status:
   ```bash
   npx prisma migrate status
   ```

---

## 4. Post-Migration Schema & Data Verification

Run the following checks immediately after migration:

### Step 1: Verify Columns Present
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'User'
  AND column_name IN ('mustChangePassword', 'passwordChangedAt');
```

### Step 2: Verify Data Record Counts & Integrity
```sql
SELECT 'User' AS table_name, COUNT(*) FROM "User"
UNION ALL
SELECT 'DeliveryChallan', COUNT(*) FROM "DeliveryChallan"
UNION ALL
SELECT 'Vendor', COUNT(*) FROM "Vendor"
UNION ALL
SELECT 'MaterialReceipt', COUNT(*) FROM "MaterialReceipt";
```

---

## 5. Emergency Rollback / Recovery Procedure

If any issue occurs during or after migration:

### Option A: Restore Production Pointer to Pre-Migration Branch
In Neon Console:
1. Go to **Settings** → **Branches**.
2. Select `pre-migration-backup-YYYY-MM-DD-HHMM`.
3. Set as primary production branch or point `DATABASE_URL` in Vercel to the backup branch connection string.
4. Redeploy Vercel application.

### Option B: Point-In-Time Restore (PITR)
1. In Neon Console, go to **Branches** → **Restore**.
2. Choose timestamp prior to the migration execution time.
3. Name restored branch `main-restored`.
4. Update `DATABASE_URL` in Vercel and verify application connectivity.

---

## 6. Application Post-Recovery Verification Checklist

After restoring:
1. Access `https://dc.vijayspheroidals.in/login`.
2. Sign in with test credentials.
3. Verify Dashboard metrics load from DB.
4. Open an existing DC and verify items, receipts, and PDF download.
