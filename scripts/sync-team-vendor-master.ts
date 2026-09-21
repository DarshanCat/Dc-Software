/**
 * Team Vendor Master sync — imports scripts/data/team-vendor-master-source.json
 * (an exact, unmodified transcription of the "Suppliers" sheet from the team's
 * VSPL_Supplier_List Excel) into the Vendor table.
 *
 * SAFE BY DEFAULT: runs as a dry run and only prints what it would do.
 * Pass --apply to actually write to whichever database DATABASE_URL points at.
 *
 *   npx tsx scripts/sync-team-vendor-master.ts            # dry run (default)
 *   npx tsx scripts/sync-team-vendor-master.ts --apply    # writes changes
 *
 * Matching rules (conservative — never guesses vendor identity):
 *   1. If a GSTIN value in the source file is shared by more than one source
 *      row (e.g. the two EXCELLENCE TECHNOLOGIES rows), none of those rows are
 *      auto-matched against any existing vendor, even if one already carries
 *      that GSTIN or name. Each such row is only ever CREATEd as its own new
 *      vendor record. We never decide which address/record an existing vendor
 *      keeps when the source itself has an unresolved duplicate.
 *   2. Otherwise, match by exact GSTIN (case-insensitive, trimmed) against
 *      existing vendors. Exactly one match -> UPDATE that vendor's fields from
 *      the source. Zero or more than one -> fall through to name matching (and
 *      report ambiguity if more than one).
 *   3. Otherwise (source has no GSTIN, or GSTIN matched nothing), match by
 *      exact vendorName (case-insensitive, trimmed). Exactly one match ->
 *      UPDATE. Zero -> CREATE a new vendor. More than one -> flagged as
 *      ambiguous and skipped (no write), for a human to resolve.
 *
 * UPDATE never blanks an existing non-null field with a null source value, and
 * never touches vendorCode/id, so DeliveryChallan.vendorId relationships and
 * historical snapshots are untouched either way.
 *
 * New vendors get a deterministic vendorCode "TEAM-<source S.No, zero-padded>"
 * so every created record is traceable back to its exact source row.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import sourceRecords from "./data/team-vendor-master-source.json";

const prisma = new PrismaClient();

interface SourceRecord {
  sNo: number;
  supplierName: string | null;
  address: string | null;
  gstin: string | null;
  phone: string | null;
  email: string | null;
  contactPerson: string | null;
  businessType: string | null;
  remarks: string | null;
}

const records = sourceRecords as SourceRecord[];

function normGst(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim().toUpperCase();
  return t || null;
}

function normName(v: string | null | undefined): string | null {
  if (!v) return null;
  const t = v.trim().toUpperCase();
  return t || null;
}

function buildNotes(rec: SourceRecord): string | null {
  const parts: string[] = [];
  if (rec.businessType) parts.push(`Business Type: ${rec.businessType}`);
  if (rec.remarks) parts.push(`Remarks: ${rec.remarks}`);
  return parts.length ? parts.join("\n") : null;
}

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "APPLY MODE — writes will be made." : "DRY RUN — no writes will be made (pass --apply to write).");
  console.log(`Database: ${process.env.DATABASE_URL?.replace(/:[^:@]*@/, ":<redacted>@")}`);
  console.log(`Source records: ${records.length}\n`);

  const existingVendors = await prisma.vendor.findMany({
    select: {
      id: true,
      vendorCode: true,
      vendorName: true,
      address: true,
      gstNumber: true,
      phone: true,
      email: true,
      contactPerson: true,
      notes: true,
    },
  });
  console.log(`Existing vendors in this database: ${existingVendors.length}\n`);

  const gstCounts = new Map<string, number>();
  for (const rec of records) {
    const g = normGst(rec.gstin);
    if (g) gstCounts.set(g, (gstCounts.get(g) ?? 0) + 1);
  }

  const summary = {
    created: [] as { sNo: number; name: string; vendorCode: string }[],
    updated: [] as { sNo: number; name: string; vendorId: string; vendorCode: string }[],
    ambiguousSourceDuplicateGst: [] as { sNo: number; name: string; gstin: string }[],
    ambiguousMultipleDbMatches: [] as { sNo: number; name: string; reason: string }[],
    unchanged: [] as { sNo: number; name: string }[],
  };

  for (const rec of records) {
    const codeSuffix = String(rec.sNo).padStart(2, "0");
    const gst = normGst(rec.gstin);
    const name = normName(rec.supplierName);

    if (!rec.supplierName) {
      console.log(`Row ${rec.sNo}: SKIPPED — no supplier name in source.`);
      continue;
    }

    // Rule 1: the source file itself has 2+ rows sharing this GSTIN (e.g. the
    // two EXCELLENCE TECHNOLOGIES entries). Never auto-match; always create.
    if (gst && (gstCounts.get(gst) ?? 0) > 1) {
      const clash = existingVendors.filter((v) => normGst(v.gstNumber) === gst || normName(v.vendorName) === name);
      if (clash.length > 0) {
        console.log(
          `Row ${rec.sNo} (${rec.supplierName}): AMBIGUOUS SOURCE DUPLICATE GSTIN (${rec.gstin}). ` +
          `Existing vendor(s) sharing this GSTIN/name were found and will NOT be modified: ` +
          clash.map((v) => `${v.vendorName} [${v.vendorCode}] (current address: ${v.address ?? "—"})`).join("; ") +
          `. This row will be created as its own new vendor record instead — a human must confirm ` +
          `whether the existing vendor should be relabeled/merged.`
        );
      }
      summary.ambiguousSourceDuplicateGst.push({ sNo: rec.sNo, name: rec.supplierName, gstin: rec.gstin! });
      await createVendor(rec, codeSuffix, apply);
      continue;
    }

    // Rule 2: match by GSTIN.
    let dbMatches = gst ? existingVendors.filter((v) => normGst(v.gstNumber) === gst) : [];
    if (dbMatches.length === 0) {
      // Rule 3: fall back to exact name match.
      dbMatches = existingVendors.filter((v) => normName(v.vendorName) === name);
    }

    if (dbMatches.length > 1) {
      console.log(`Row ${rec.sNo} (${rec.supplierName}): AMBIGUOUS — ${dbMatches.length} existing vendors matched. Skipped, no write.`);
      summary.ambiguousMultipleDbMatches.push({ sNo: rec.sNo, name: rec.supplierName, reason: `${dbMatches.length} matches by GSTIN/name` });
      continue;
    }

    if (dbMatches.length === 1) {
      await updateVendor(dbMatches[0], rec, apply, summary);
      continue;
    }

    await createVendor(rec, codeSuffix, apply);
    summary.created.push({ sNo: rec.sNo, name: rec.supplierName, vendorCode: `TEAM-${codeSuffix}` });
  }

  console.log("\n===== SUMMARY =====");
  console.log(`Created:  ${summary.created.length}`);
  console.log(`Updated:  ${summary.updated.length}`);
  console.log(`Unchanged (matched, nothing new to fill in): ${summary.unchanged.length}`);
  console.log(`Ambiguous source duplicate GSTIN (always created as new): ${summary.ambiguousSourceDuplicateGst.length}`);
  console.log(`Ambiguous multiple DB matches (skipped): ${summary.ambiguousMultipleDbMatches.length}`);
  if (!apply) console.log("\nThis was a DRY RUN. Re-run with --apply to write these changes.");
}

async function createVendor(rec: SourceRecord, codeSuffix: string, apply: boolean) {
  const vendorCode = `TEAM-${codeSuffix}`;
  console.log(`Row ${rec.sNo}: CREATE new vendor "${rec.supplierName}" (vendorCode=${vendorCode}, gstin=${rec.gstin ?? "—"})`);
  if (!apply) return;
  await prisma.vendor.create({
    data: {
      vendorCode,
      vendorName: rec.supplierName!,
      address: rec.address,
      gstNumber: rec.gstin,
      phone: rec.phone,
      email: rec.email,
      contactPerson: rec.contactPerson,
      notes: buildNotes(rec),
      active: true,
    },
  });
}

async function updateVendor(
  existing: { id: string; vendorCode: string; vendorName: string; address: string | null; gstNumber: string | null; phone: string | null; email: string | null; contactPerson: string | null; notes: string | null },
  rec: SourceRecord,
  apply: boolean,
  summary: { updated: { sNo: number; name: string; vendorId: string; vendorCode: string }[]; unchanged: { sNo: number; name: string }[] },
) {
  // Never blank an existing populated field with a null/missing source value.
  const data: Prisma.VendorUpdateInput = {};
  if (rec.address && rec.address !== existing.address) data.address = rec.address;
  if (rec.gstin && rec.gstin !== existing.gstNumber) data.gstNumber = rec.gstin;
  if (rec.phone && rec.phone !== existing.phone) data.phone = rec.phone;
  if (rec.email && rec.email !== existing.email) data.email = rec.email;
  if (rec.contactPerson && rec.contactPerson !== existing.contactPerson) data.contactPerson = rec.contactPerson;
  const notes = buildNotes(rec);
  if (notes && notes !== existing.notes) data.notes = notes;

  if (Object.keys(data).length === 0) {
    console.log(`Row ${rec.sNo}: MATCH "${existing.vendorName}" [${existing.vendorCode}] — already up to date, no fields to change.`);
    summary.unchanged.push({ sNo: rec.sNo, name: rec.supplierName! });
    return;
  }

  console.log(`Row ${rec.sNo}: UPDATE "${existing.vendorName}" [${existing.vendorCode}] — fields: ${Object.keys(data).join(", ")}`);
  summary.updated.push({ sNo: rec.sNo, name: rec.supplierName!, vendorId: existing.id, vendorCode: existing.vendorCode });
  if (!apply) return;
  await prisma.vendor.update({ where: { id: existing.id }, data });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
