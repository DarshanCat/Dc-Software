# Production Database Migration Checklist — DC Material Management

This checklist must be executed sequentially prior to, during, and after applying schema migrations to the production Neon PostgreSQL database.

---

## PRE-MIGRATION

- [ ] Confirm correct Neon production project (`DarshanCat/Dc-Software` / Neon Production)
- [ ] Confirm production branch (`main`)
- [ ] Create Neon recovery point / snapshot / PITR branch (`pre-migration-backup-YYYY-MM-DD-HHMM`)
- [ ] Verify recovery point exists and state is **Ready** in Neon Console
- [ ] Confirm `DATABASE_URL` in execution context points to intended production database
- [ ] Review migration SQL (`prisma/migrations/20260824150000_add_password_change_tracking/migration.sql`)
- [ ] Confirm migration is additive and non-destructive (no `DROP TABLE` or `DROP COLUMN`)

---

## MIGRATION

- [ ] Project owner explicitly approves migration execution
- [ ] Run `npx prisma migrate deploy` against production database
- [ ] Verify successful migration completion output (Exit code 0)

---

## POST-MIGRATION

- [ ] Run `npx prisma migrate status` against production database
- [ ] Verify migration `20260824150000_add_password_change_tracking` is marked as **Applied**
- [ ] Deploy updated application code to Vercel
- [ ] Test user login (`/login`)
- [ ] Test self-service password change (`/change-password`)
- [ ] Test live Dashboard metrics load (`/dashboard`)
- [ ] Test DC search functionality (`/search`)
- [ ] Test opening DC detail view (`/dcs/[id]`)
- [ ] Test report generation and CSV export (`/reports/dc-register`)
- [ ] Verify existing production records (Users, Delivery Challans, Vendors, Receipts) remain 100% intact

---

## RECOVERY (ONLY IF MIGRATION FAILS)

- [ ] If migration fails or returns schema errors, STOP immediately
- [ ] DO NOT run `npx prisma migrate reset` or `npx prisma db push`
- [ ] Execute Neon Point-In-Time Restore (PITR) procedure as detailed in `BACKUP_AND_RESTORE.md`
- [ ] Verify application health after recovery point restoration
