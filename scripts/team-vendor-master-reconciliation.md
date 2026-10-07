# Team Vendor Master Reconciliation

Source: `VSPL_Supplier_List (1).xlsx`, sheet "Suppliers" — 29 rows, transcribed verbatim into
[`scripts/data/team-vendor-master-source.json`](data/team-vendor-master-source.json) (no
normalization, no invented values).

## IMPORTANT — this reconciliation was run against the local dev database only

`DATABASE_URL` in this environment points at `localhost:5433` (a local Postgres instance), **not**
the live Neon database behind `dc.vijayspheroidals.in` / the `dc-software` Vercel project. This
session has no credentials for the real production database. Everything below demonstrates the
sync script's behavior and matching methodology against local dev data (38 existing vendors,
clearly a superset that includes several obviously-synthetic test rows: "Darsh", "ABC Machining",
"XYZ CNC", "PQR Engineering", "LMN Industries", "JNR Enterprises", "MRS Industries" etc.) so the
matching logic can be reviewed before anyone runs it for real. **The actual production
reconciliation must be produced by running `scripts/sync-team-vendor-master.ts` (no `--apply`)
against the real production `DATABASE_URL`.**

## Counts (local dev dry run)

- Excel vendor count: **29**
- Existing vendor count (local dev DB, NOT production): **38**
- Matched by exact GSTIN, exact vendor name, or a human-confirmed alias -> would UPDATE: **22**
- No match found -> would CREATE: **5** (CIMTRIX SYSTEMS PVT LTD, SREE VISHNU ENTERPRICES, SRI J.D. INDUSTRIES, VIJAY SPHEROIDALS PRIVATE LIMITED (TUMKUR), plus the 2 EXCELLENCE TECHNOLOGIES rows counted separately below) — **7 total CREATEs**
- Ambiguous multiple-DB-match (skipped, no write): **0**

**Update 2026-09-21:** all 12 "possible match" pairs below were reviewed and confirmed by the
team to be the same vendor as the candidate listed. The sync script now carries an explicit,
reviewed `CONFIRMED_ALIASES` table (keyed by source row S.No, listing every spelling of that
vendor's name known to be in use) so each of these 12 rows UPDATEs the existing vendor instead of
creating a duplicate — confirmed by re-running the dry run above. This is a fixed, human-reviewed
list, not a fuzzy-matching algorithm, so no other row is affected.

## Matched rows (would UPDATE, no new vendor, no ID change)

| Row | Excel Supplier Name | Matched local-dev vendor | Fields the sync would fill in |
|---|---|---|---|
| 1 | ALTECH PRECISION | Altech Precision [VEND-002] | address, gstNumber |
| 2 | ANUGRAHA ENTERPRISES | Anugraha Enterprises [VEND-003] | address, notes (blank-GSTIN remark) |
| 11 | RP ENGINEERING | RP Engineering [VEND-015] | address, gstNumber |
| 15 | SHINE ENGINEERING TECHNOLOGY | Shine Engineering Technology [VEND-017] | address, gstNumber, phone, contactPerson |
| 16 | SHREE NANJUNDESHWARA GRINDING | Shree Nanjundeshwara Grinding [VEND-033] | address, gstNumber |
| 18 | SHRI SAI ENGINEERING | Shri Sai Engineering [VEND-019] | address, notes (blank-GSTIN remark) |
| 19 | SKT ENGINEERING | SKT Engineering [VEND-020] | address, gstNumber, phone |
| 21 | SRI GANGA INDUSTRIES | SRI GANGA INDUSTRIES [VEND-030] | address, gstNumber, phone, contactPerson, notes |
| 26 | SRI VENGAMAMBA ENTERPRISES | Sri Vengamamba Enterprises [VEND-027] | address, gstNumber, phone, contactPerson, notes |
| 28 | STEEL PROFILES INDIA | Steel Profiles India [VEND-028] | address, gstNumber, phone, email |

These are exact case-insensitive name matches. No vendor ID, vendorCode, or existing populated
field is ever overwritten with a blank — only fields the source actually supplies are filled in.

## Confirmed alias pairs -> now UPDATE, not CREATE

These 12 rows had no *exact* name/GSTIN match, but were confirmed by the team to be the same
vendor as the candidate below. The script now matches each one against a reviewed, explicit list
of that vendor's known name spellings (`CONFIRMED_ALIASES` in the script, keyed by source row
S.No) and UPDATEs the existing record — the Excel spelling becomes the new `vendorName`, and the
existing `vendorCode`/`id` (and therefore every historical `DeliveryChallan.vendorId`) is
untouched.

| Row | Excel Supplier Name | Confirmed same vendor as (local dev) |
|---|---|---|
| 6 | HARSHA ENTERPRICES | "M/S HARSHA ENTERPRISES" [VEND-010] |
| 7 | HARSHITH CNC TECH | "HARSHITHA CNC TECH" [VEND-005] |
| 9 | LOUKIK INDUSTRIEAS (S) | "Loukik Industries" [VEND-008] |
| 10 | NS TECHNOLOGIES | "N S Technologies" [VEND-011] |
| 12 | S P PRECISION ENGINERRING COMPONENTS | "S.P.PRECISION ENGINEERING COMPONENTS" [VEND-022] |
| 13 | S. P ENGINEERING ENTERPRISES | "S P Engineering Enterprises" [VEND-021] |
| 14 | S.S Industries | "S S INDUSTRIES" [VEND-032] |
| 17 | Shree Nanjundeshwara Industries(GK) | "Shree Nanjundeshwara Industries" [VEND-018] |
| 23 | Sri lakshmi narashima industries(SLN NEW) | "Sri Lakshmi Narasimha Industries-SLN NEW" [VEND-024] |
| 24 | SRI LAKSHMI NARASIMHA INDUSTRIES(CHINNODU) | "Sri Lakshmi Narasimha Industries-Chinnodu 2ZO" [VEND-023] |
| 25 | SRI SAMRUDHI INDUSTRIES | "SAMRUDHI INDUSTRIES" [VEND-016] |
| 27 | SRI VENKATESHWARA INDUSTRIES (MEGHANA) | "Sri Venkateshwara Industries" [VEND-031] |

If the real production vendor happens to be spelled differently from every alias listed for that
row, the match will simply fail and the row will fall through to CREATE — the dry-run output must
be checked against production before running with `--apply`.

## Rows with genuinely no match -> sync would CREATE a new vendor

| Row | Excel Supplier Name | Notes |
|---|---|---|
| 3 | CIMTRIX SYSTEMS PVT LTD | none found — genuinely new |
| 20 | SREE VISHNU ENTERPRICES | none found — genuinely new |
| 22 | SRI J.D. INDUSTRIES | none found — genuinely new |
| 29 | VIJAY SPHEROIDALS PRIVATE LIMITED (TUMKUR) | your own Tumkur unit, per the source Remarks column; not previously in the local dev vendor list |

## Missing GSTIN (per source Remarks — not invented)

- Row 2, **ANUGRAHA ENTERPRISES** — GSTIN blank in source ("GST No. is blank in the screenshot"). `gstNumber` stays `null`.
- Row 18, **SHRI SAI ENGINEERING** — GSTIN blank in source ("GST No. is blank; address incomplete in screenshot"). `gstNumber` stays `null`.

## Duplicate/conflicting records: EXCELLENCE TECHNOLOGIES

Rows 4 and 5 share the exact same GSTIN (`29ADWPC7169B1Z7`) and name (`EXCELLENCE TECHNOLOGIES`)
but have two different addresses:

- Row 4: `NO-32,JANHAVI INDUSTRIAL ESTATE, OFF KUNIGAL ROAD,HANCHIPURA,NELAMANGALA-562123`
- Row 5: `B- 380 4 th Main, 8 th Cross, Peenya Industrial Area 1 st Phase Peenya Bangalore - 560058`

**Schema check:** `Vendor.gstNumber` and `Vendor.vendorName` are **not** unique constraints in
`prisma/schema.prisma` — only `vendorCode` (`@unique`) is. Two vendor rows with the same name and
GSTIN are therefore already representable; **no migration is required** to support this.

The sync script never merges or picks one address over the other: both rows are always created as
their own distinct vendor records (`TEAM-04` and `TEAM-05`), each keeping its own address and the
shared GSTIN. It does not touch the local dev DB's existing "Excellence Technologies-Sub
Contracting" [VEND-004] vendor either way, since its name does not exactly match "EXCELLENCE
TECHNOLOGIES" and it has no GSTIN to match on — worth a manual look, since it may be a third,
earlier record for the same real business that predates this Excel.

## How to run this for real

1. Review the tables above and the "possible match" list with the team; tell us which pairs are
   the same vendor so any existing record can be renamed to match before running the script (so
   the exact-match path updates it instead of creating a duplicate).
2. Run against production **as a dry run first** (no `--apply`) with the real production
   `DATABASE_URL`, and review its console output — it changes nothing.
3. Re-run with `--apply` once the dry-run output is confirmed correct.

We do not have the production database connection in this session, so step 2/3 must be run by
someone with that access (or the production `DATABASE_URL` must be explicitly provided here).
