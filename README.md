# DC & Vendor Material Management

A manufacturing-focused web application for managing Delivery Challans (DCs), material sent to vendors for job work, vendor returns, scrap recovery, material reconciliation, vendor outstanding, and operational reporting.

The application is designed around **material accountability** rather than simply tracking whether a DC is open or closed.

> **Core principle:** Every material movement should be traceable from the Work Order / DC → material sent to the vendor → material returned → recoverable material returned → internal material classification → reconciliation → closure.

---

## Current Technology Stack

- **Next.js 15** – application framework
- **React 18** – UI
- **TypeScript** – application language
- **PostgreSQL** – database
- **Prisma 5** – ORM and migrations
- **NextAuth** – authentication
- **Tailwind CSS** – styling
- **React Hook Form + Zod** – form handling and validation
- **TanStack Table** – data tables
- **Recharts** – dashboards and charts
- **Vitest** – unit/business-logic tests
- **Playwright** – end-to-end testing foundation
- **PDF-Lib** – DC PDF generation
- **QRCode** – DC QR-code generation
- **Decimal.js / PostgreSQL Decimal** – precise weight calculations

---

## Business Workflow

The system is being developed around the following manufacturing workflow:

```text
Work Order
    │
    ├── Delivery Challan 1
    ├── Delivery Challan 2
    └── Delivery Challan 3
            │
            ▼
      Material Sent to Vendor
            │
            ▼
        Vendor Processing
            │
            ├── Finished Material Return
            ├── Boring / Recoverable Material Return
            └── Other Recoverable Material
                    │
                    ▼
            Internal Material Receipt
                    │
                    ▼
          Internal Classification
              ┌─────┴─────┐
              │           │
            Good        Scrap
              │           │
              └─────┬─────┘
                    ▼
             Reconciliation
                    │
              ┌─────┴─────┐
              │           │
           Balanced    Exception
              │           │
              │      Investigation / Approval
              │           │
              └─────┬─────┘
                    ▼
                  Closed
```

### Important business distinction

The application does **not** treat returned material as vendor rejection.

The correct process is:

1. Vendor returns material.
2. Company receives the material.
3. Company internally decides whether returned material is good material or scrap.
4. Scrap is classified using the Scrap Master.

For example:

```text
Vendor Return: 50 Nos

Internal Classification:
Good: 47 Nos
Scrap: 3 Nos
Unclassified: 0 Nos
```

The 3 pieces are internally classified as scrap; they are not recorded as a vendor rejection.

---

## Key Features

### Delivery Challans

- Create and manage DCs
- Vendor and item tracking
- Process/job-work tracking
- DC approval workflow
- Dispatch tracking
- DC status lifecycle
- DC PDF generation
- QR-code support
- Document attachments
- Audit history
- Amendments for approved transactions

### Material Movement

Track:

- Material sent to vendor
- Quantity sent
- Input weight
- Expected finished material
- Expected return quantity
- Actual material returned
- Partial returns
- Remaining material at vendor

The returned item can be either the same item or a different item.

Example:

```text
Casting ABC — 10 Nos
        │
        ▼
   CNC / Boring
        │
        ▼
Machined ABC — 50 Nos
```

The system should therefore support explicit **input item → expected return item** relationships.

---

## Work Order / WO ID

The intended workflow uses a **WO ID / Work Order ID** as the parent reference for job-work transactions.

One WO can have multiple DCs:

```text
WO-2026-00452
│
├── DC-2026-00125 — 10 Nos
├── DC-2026-00126 — 20 Nos
└── DC-2026-00138 — 20 Nos
```

This is important when a vendor cannot process the initially supplied quantity.

Example:

```text
WO Requirement: 50 Nos
DC 1 Sent:      10 Nos
Balance:        40 Nos

Vendor: "Quantity insufficient; send more material."

DC 2 Sent:      40 Nos

Total Sent:     50 Nos
Balance:         0 Nos
```

The WO can therefore represent the overall job requirement while each DC represents an actual physical movement.

> **Note:** If the current database/application version does not yet contain the WO implementation, it should be added through a Prisma migration rather than by resetting the database.

---

## Boring / Recoverable Material

A special requirement is tracking **boring material in KG**.

Example:

```text
Boring Sent:       100.000 KG
Boring Received:    92.500 KG
Boring Pending:      7.500 KG
Recovery:              92.50%
```

Boring is a recoverable material and should be tracked separately from finished material and internal scrap classification.

Boring returns must support multiple receipts:

```text
Boring Sent: 100 KG

Receipt 1: 40 KG
Receipt 2: 30 KG
Receipt 3: 22.5 KG

Total Received: 92.5 KG
Pending:         7.5 KG
```

The system should not simply overwrite one `boringReceivedKg` field. Each receipt should be a transaction so that the recovery history remains auditable.

The architecture is intended to support future recoverable material types such as:

- Boring
- Machining chips
- Grinding dust
- Other recoverable material

---

## Reconciliation

Reconciliation is a core business function.

The system should separately reconcile:

### Finished Material

```text
Expected Return
Actual Return
Pending Return
```

### Recoverable Material / Boring

```text
Boring Sent
Boring Received
Boring Pending
Recovery %
```

### Internal Classification

```text
Received
Good
Scrap
Unclassified
```

The classification balance is:

```text
Unclassified = Received - Good - Scrap
```

A transaction with unclassified material should not be treated as fully processed unless an authorized exception is approved.

---

## Weight Reconciliation

For processes where weight reconciliation is applicable, the server-side reconciliation service can calculate the material balance using the applicable process/recovery rules.

A typical calculation is:

```text
Unaccounted Weight =
    Input Weight
  - Finished Weight
  - Recoverable Material Weight
  - Scrap Weight
  - Approved Process Loss
```

The exact components used in the calculation should be determined by the applicable job-work/process standard.

Business calculations must use decimal precision rather than JavaScript floating-point arithmetic.

---

## DC Status Lifecycle

The current DC workflow supports statuses such as:

```text
DRAFT
PENDING_APPROVAL
APPROVED
DISPATCHED
AT_VENDOR
PARTIALLY_RETURNED
MATERIAL_RETURNED
SCRAP_PENDING
RECONCILIATION
RECONCILED
CLOSED
CANCELLED
```

The long-term workflow also includes WO-level operational states such as:

```text
OPEN
WAITING_FOR_MATERIAL
READY_FOR_PROCESSING
PROCESSING
PARTIALLY_RETURNED
FULLY_RETURNED
RECONCILIATION
CLOSED
```

Statuses should be driven by actual transactions and business rules rather than arbitrary manual changes.

---

## Search

The application provides global search capabilities and is intended to support searches by:

- DC Number
- WO ID
- Vendor
- Item Code
- Item Name

The primary operational search should support both:

```text
DC-2026-00125
```

and:

```text
WO-2026-00452
```

Searching by WO should show the WO summary and all related DCs.

---

## Modules

The application currently contains or is structured around the following modules:

```text
Dashboard
Delivery Challans
Material Returns
Scrap Recovery
Reconciliation
Vendors
Items
Processes
Job Work Standards
Scrap Types
Reports
Notifications
Users
Roles
Permissions
System Settings
Audit Trail
```

---

## User Roles

The application includes role-based access control for roles such as:

- Admin
- Stores
- Purchase
- Production
- Quality
- Accounts
- Management

Permissions are granular and include actions such as:

```text
DC_CREATE
DC_VIEW
DC_EDIT
DC_APPROVE
DC_DISPATCH

RECEIPT_CREATE
RECEIPT_VIEW

SCRAP_CREATE
SCRAP_VIEW

RECONCILIATION_VIEW
RECONCILIATION_APPROVE
RECONCILIATION_CLOSE
RECONCILIATION_OVERRIDE

REPORT_VIEW
REPORT_EXPORT

USER_MANAGE
ROLE_MANAGE
SYSTEM_SETTINGS
AUDIT_VIEW
```

Authorization must always be enforced server-side.

---

## Database

The project uses PostgreSQL with Prisma.

The current schema contains major entities including:

```text
User
Role
Permission
UserRole
RolePermission

Vendor
VendorContact

ItemCategory
UOM
Item
Process

JobWorkStandard
JobWorkStandardRevision
ScrapType

DeliveryChallan
DcAmendment
DeliveryChallanItem
Dispatch
DispatchItem

MaterialReceipt
MaterialReceiptItem
ScrapReceipt
ScrapReceiptItem

Reconciliation
ReconciliationItem
Exception
ExceptionApproval

Document
Notification
AuditLog
StatusHistory
SystemSetting
NumberSequence
```

The database should be evolved using Prisma migrations. Avoid destructive resets for real data.

---

## Project Structure

High-level structure:

```text
.
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
│
├── src/
│   ├── app/
│   │   ├── (app)/
│   │   │   ├── admin/
│   │   │   ├── dashboard/
│   │   │   ├── dcs/
│   │   │   ├── masters/
│   │   │   ├── notifications/
│   │   │   ├── reports/
│   │   │   └── search/
│   │   └── api/
│   │
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── db.ts
│   │   ├── decimal.ts
│   │   ├── receipt.ts
│   │   └── validation/
│   │
│   ├── services/
│   │   ├── dispatch.service.ts
│   │   ├── number-sequence.service.ts
│   │   ├── reconciliation.service.ts
│   │   ├── scrap.service.ts
│   │   ├── dc-pdf.tsx
│   │   └── storage/
│   │
│   └── server/
│       └── notifications/
│
├── __tests__/
│   ├── reconciliation.test.ts
│   └── scrap.test.ts
│
├── package.json
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
└── README.md
```

---

## Prerequisites

Install:

- Node.js 20+ recommended
- npm
- PostgreSQL 14+ recommended

A PostgreSQL database is required for local development.

---

## Installation

Clone the repository:

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd Dc-Software-main
```

Install dependencies:

```bash
npm install
```

---

## Environment Variables

Create a `.env` file in the project root.

Example:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/dc_management?schema=public"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_URL="http://localhost:3000"
APP_URL="http://localhost:3000"
```

Do not commit `.env` files to GitHub.

The repository `.gitignore` excludes `.env*` files.

### PostgreSQL Port

PostgreSQL normally uses port `5432`.

If your PostgreSQL instance is configured on another port, update `DATABASE_URL` accordingly.

For example, if PostgreSQL is intentionally exposed on port `5433`:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5433/dc_management?schema=public"
```

If the application reports:

```text
Can't reach database server at localhost:5433
```

check that PostgreSQL is actually running on port `5433`. Otherwise use the correct PostgreSQL port, commonly `5432`.

---

## Database Setup

Generate the Prisma client:

```bash
npm run prisma:generate
```

For development migrations:

```bash
npm run prisma:migrate
```

Seed development data:

```bash
npm run prisma:seed
```

For an existing database in deployment:

```bash
npm run prisma:deploy
```

Check migration status:

```bash
npx prisma migrate status
```

Open Prisma Studio when needed:

```bash
npx prisma studio
```

### Warning

Do **not** run the database reset command against a real/shared database:

```bash
npm run db:reset
```

That command is intended only for disposable development databases.

---

## Development

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## Development Seed Users

The development seed creates example users for the configured roles.

Default development password in the current seed script:

```text
Password@123
```

Example accounts:

```text
admin@example.com
stores@example.com
purchase@example.com
production@example.com
quality@example.com
accounts@example.com
management@example.com
```

### Security warning

These credentials are for local development only.

Do not use the seeded development password or example accounts in production.
Change or remove development credentials before production deployment.

---

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build production application |
| `npm run start` | Start production server |
| `npm run lint` | Run lint checks |
| `npm run typecheck` | Run TypeScript checks |
| `npm run test` | Run Vitest tests |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | Create/apply development migration |
| `npm run prisma:deploy` | Apply production migrations |
| `npm run prisma:seed` | Seed development data |
| `npm run db:reset` | Reset disposable development database |

---

## Testing

Run the current automated tests:

```bash
npm run test
```

Type-check the project:

```bash
npm run typecheck
```

Run linting:

```bash
npm run lint
```

Before pushing changes, recommended checks are:

```bash
npm run typecheck
npm run test
npm run build
```

The most important business tests should cover:

- Expected scrap calculations
- Reconciliation calculations
- Decimal precision
- Scrap shortage
- Excess scrap
- Zero expected scrap
- Material quantity mismatch
- Partial returns
- Boring recovery
- Internal good/scrap classification
- WO-level aggregation

---

## Git Workflow

Before committing:

```bash
git status
git diff
```

Run validation:

```bash
npm run typecheck
npm run test
npm run build
```

Then commit:

```bash
git add README.md
git commit -m "docs: update DC management README"
```

Push to GitHub:

```bash
git push origin main
```

If the repository uses `master` instead:

```bash
git push origin master
```

If this is the first push and the remote is not configured:

```bash
git remote -v
git remote add origin <YOUR_GITHUB_REPOSITORY_URL>
git branch -M main
git push -u origin main
```

Do not commit secrets, `.env` files, database passwords, API keys, or production credentials.

---

## Production Deployment Checklist

Before deploying:

- [ ] Configure production PostgreSQL
- [ ] Configure `DATABASE_URL`
- [ ] Configure `NEXTAUTH_SECRET`
- [ ] Configure `NEXTAUTH_URL`
- [ ] Configure `APP_URL`
- [ ] Apply Prisma migrations
- [ ] Generate Prisma Client
- [ ] Remove development users/passwords
- [ ] Verify RBAC
- [ ] Verify file storage configuration
- [ ] Verify PDF generation
- [ ] Verify QR generation
- [ ] Run tests
- [ ] Run TypeScript checks
- [ ] Run production build
- [ ] Confirm `.env` is not committed
- [ ] Confirm database backups
- [ ] Confirm audit logging

---

## Roadmap

The application is being developed incrementally.

### Phase 1 — Foundation

- Authentication
- RBAC
- PostgreSQL/Prisma
- Master data
- Audit trail
- Number sequences

### Phase 2 — DC Operations

- DC creation
- WO ID integration
- Material-out tracking
- Expected return item/quantity
- DC approval
- Dispatch
- QR/PDF

### Phase 3 — Vendor Returns

- Actual material receipts
- Partial receipts
- Expected vs actual quantity
- Expected vs actual weight

### Phase 4 — Recoverable Material

- Boring KG sent
- Boring KG received
- Multiple boring receipts
- Recovery percentage
- Pending recovery
- WO-level recovery

### Phase 5 — Internal Classification

- Good material
- Scrap classification
- Scrap Master
- Unclassified material tracking
- No vendor-rejection workflow

### Phase 6 — Reconciliation

- Finished material reconciliation
- Recoverable material reconciliation
- Weight reconciliation
- Exceptions
- Approval/override
- Closure

### Phase 7 — Analytics

- Vendor outstanding
- WO ageing
- DC ageing
- Scrap recovery
- Boring recovery
- Vendor performance
- Management dashboard

### Phase 8 — Future Integrations

- Vendor portal
- ERP integration
- Production/WO integration
- Email/notification integrations
- AI-based analytics and anomaly detection

---

## Design Principles

### 1. Material first

The system is built around physical material movement, not just document status.

### 2. Expected and actual are separate

Never overwrite an expected return with the actual return.

### 3. Transactions are historical

Receipts and recoveries should be recorded as transactions, not overwritten fields.

### 4. Internal classification is separate from vendor return

Vendor returns material. The company decides afterward whether it is good or scrap.

### 5. Auditability

Important business actions must be traceable to the user, timestamp, transaction, and reason where applicable.

### 6. Decimal precision

Weight calculations must use precise decimal values.

### 7. Server-side business rules

Critical calculations and authorization rules must be enforced on the server, not only in the browser.

### 8. No destructive history changes

Approved/closed transactions should not be silently edited or deleted. Use amendments, reversals, or approved corrective transactions.

---

## Current Project Status

This repository contains the foundation and significant portions of the DC management workflow, including:

- Next.js application shell
- Authentication
- Role/permission framework
- Prisma/PostgreSQL schema
- Vendor management
- Item management
- Process/job-work standards
- DC creation and detail pages
- Dispatch workflow
- Material receipt workflow
- Scrap receipt workflow
- Reconciliation service
- Exception handling
- Audit/status history models
- DC PDF generation
- QR-code support
- Reports
- Dashboard views
- Automated reconciliation/scrap tests

The application is still under active development. The **WO → multiple DCs → expected return → actual return → boring recovery → internal classification → reconciliation** workflow is the target architecture for the next development iterations.

---

## Contributing

When modifying the application:

1. Inspect existing code before changing it.
2. Reuse existing services/components where appropriate.
3. Do not reset or destroy real database data.
4. Add Prisma migrations for schema changes.
5. Add tests for new business rules.
6. Run typecheck, tests, and build before committing.
7. Update this README when setup, architecture, or workflows change.
8. Never commit secrets or production credentials.

---

## License

Internal/private company application.

This project is not intended for public redistribution unless explicitly authorized.
