/**
 * seed.ts — development seed data.
 * Run: npm run prisma:seed
 * DEV CREDENTIALS are printed at the end (development only).
 */
import {
  PrismaClient,
  CalculationType,
  DcPurpose,
  DcStatus,
  ExceptionType,
  ExceptionStatus,
  ReconciliationStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, ROLES } from "../src/config/permissions";

const prisma = new PrismaClient();
const DEV_PASSWORD = "Password@123";

async function main() {
  console.log("Seeding…");

  // Permissions
  const permissionKeys = Object.values(PERMISSIONS);
  for (const key of permissionKeys) {
    await prisma.permission.upsert({ where: { key }, create: { key }, update: {} });
  }

  // Roles + grants
  for (const roleKey of Object.values(ROLES)) {
    const role = await prisma.role.upsert({
      where: { key: roleKey },
      create: { key: roleKey, name: roleKey, isSystem: true },
      update: {},
    });
    const grants = DEFAULT_ROLE_PERMISSIONS[roleKey as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
    for (const permKey of grants) {
      const perm = await prisma.permission.findUnique({ where: { key: permKey } });
      if (perm) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
          create: { roleId: role.id, permissionId: perm.id },
          update: {},
        });
      }
    }
  }

  // Dev users
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);
  const userSpecs = [
    { email: "admin@example.com", name: "Admin User", role: ROLES.ADMIN },
    { email: "stores@example.com", name: "Stores User", role: ROLES.STORES },
    { email: "purchase@example.com", name: "Purchase User", role: ROLES.PURCHASE },
    { email: "production@example.com", name: "Production User", role: ROLES.PRODUCTION },
    { email: "quality@example.com", name: "Quality User", role: ROLES.QUALITY },
    { email: "accounts@example.com", name: "Accounts User", role: ROLES.ACCOUNTS },
    { email: "management@example.com", name: "Management User", role: ROLES.MANAGEMENT },
  ];
  const users: Record<string, string> = {};
  for (const u of userSpecs) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: { email: u.email, name: u.name, passwordHash },
      update: {},
    });
    users[u.role] = user.id;
    const role = await prisma.role.findUnique({ where: { key: u.role } });
    if (role) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        create: { userId: user.id, roleId: role.id },
        update: {},
      });
    }
  }

  // UOM
  for (const uom of [
    { code: "KG", name: "Kilogram", isWeight: true },
    { code: "NOS", name: "Numbers", isWeight: false },
    { code: "MTR", name: "Metre", isWeight: false },
  ]) {
    await prisma.uOM.upsert({ where: { code: uom.code }, create: uom, update: {} });
  }

  // Item categories
  for (const c of [
    { key: "RAW_MATERIAL", name: "Raw Material" },
    { key: "CASTING", name: "Casting" },
    { key: "MACHINED_COMPONENT", name: "Machined Component" },
    { key: "FINISHED_COMPONENT", name: "Finished Component" },
    { key: "SCRAP", name: "Scrap" },
    { key: "CONSUMABLE", name: "Consumable" },
    { key: "OTHER", name: "Other" },
  ]) {
    await prisma.itemCategory.upsert({ where: { key: c.key }, create: c, update: {} });
  }

  // Processes
  const processDefs: [string, string][] = [
    ["CNC_MACHINING", "CNC Machining"],
    ["TURNING", "Turning"],
    ["MILLING", "Milling"],
    ["HEAT_TREATMENT", "Heat Treatment"],
    ["SURFACE_TREATMENT", "Surface Treatment"],
  ];
  const processes: Record<string, string> = {};
  for (const [code, name] of processDefs) {
    const p = await prisma.process.upsert({ where: { code }, create: { code, name }, update: {} });
    processes[code] = p.id;
  }

  // Scrap types
  const scrapDefs: [string, string][] = [
    ["MACHINING_CHIPS", "Machining Chips"],
    ["TURNING_SCRAP", "Turning Scrap"],
    ["BORING_SCRAP", "Boring Scrap"],
    ["PROCESS_SCRAP", "Process Scrap"],
    ["REJECTION_SCRAP", "Rejection Scrap"],
  ];
  const scrapTypes: Record<string, string> = {};
  for (const [code, name] of scrapDefs) {
    const s = await prisma.scrapType.upsert({ where: { code }, create: { code, name }, update: {} });
    scrapTypes[code] = s.id;
  }

  // Vendors
  const vendorDefs: [string, string][] = [
    ["V-ABC", "ABC Machining"],
    ["V-XYZ", "XYZ CNC"],
    ["V-PQR", "PQR Engineering"],
    ["V-LMN", "LMN Industries"],
  ];
  const vendors: Record<string, string> = {};
  for (const [code, name] of vendorDefs) {
    const v = await prisma.vendor.upsert({
      where: { vendorCode: code },
      create: { vendorCode: code, vendorName: name, defaultReturnDays: 15, country: "India" },
      update: {},
    });
    vendors[code] = v.id;
  }

  // Items
  const machined = await prisma.itemCategory.findUnique({ where: { key: "MACHINED_COMPONENT" } });
  const itemDefs: [string, string, string, number][] = [
    ["IT-1001", "Shaft Blank 50mm", "EN8", 12.5],
    ["IT-1002", "Flange Casting 200mm", "SG Iron", 8.0],
    ["IT-1003", "Housing Machined", "Aluminium", 3.2],
  ];
  const items: Record<string, string> = {};
  for (const [code, name, grade, unitW] of itemDefs) {
    const it = await prisma.item.upsert({
      where: { itemCode: code },
      create: {
        itemCode: code,
        itemName: name,
        materialGrade: grade,
        defaultUOM: "NOS",
        weightUOM: "KG",
        standardUnitWeight: unitW,
        itemCategoryId: machined?.id,
      },
      update: {},
    });
    items[code] = it.id;
  }

  // Job Work Standard: IT-1001 + CNC, 1000 -> 900/90/10
  const standard = await prisma.jobWorkStandard.upsert({
    where: {
      itemId_processId_revision: {
        itemId: items["IT-1001"],
        processId: processes["CNC_MACHINING"],
        revision: 1,
      },
    },
    create: {
      itemId: items["IT-1001"],
      processId: processes["CNC_MACHINING"],
      inputUOM: "KG",
      inputWeight: 1000,
      expectedOutputWeight: 900,
      expectedScrapWeight: 90,
      expectedScrapPercentage: 9,
      allowedProcessLoss: 10,
      allowedProcessLossPercentage: 1,
      tolerancePercentage: 0,
      calculationType: CalculationType.PERCENTAGE,
      effectiveFrom: new Date("2026-04-01"),
      revision: 1,
      approved: true,
      approvedBy: users[ROLES.PRODUCTION],
      approvedAt: new Date(),
    },
    update: {},
  });

  // Number sequence
  await prisma.numberSequence.upsert({
    where: { key_fiscalYear: { key: "DC", fiscalYear: "2026" } },
    create: { key: "DC", fiscalYear: "2026", prefix: "DC-2026-", padding: 6, current: 1 },
    update: {},
  });

  // Demo DC-2026-000001 with 8 kg unaccounted exception
  const dcNumber = "DC-2026-000001";
  const existing = await prisma.deliveryChallan.findUnique({ where: { dcNumber } });
  if (!existing) {
    const dc = await prisma.deliveryChallan.create({
      data: {
        dcNumber,
        dcDate: new Date("2026-05-01"),
        vendorId: vendors["V-ABC"],
        purpose: DcPurpose.MACHINING,
        processId: processes["CNC_MACHINING"],
        expectedReturnDate: new Date("2026-05-16"),
        status: DcStatus.RECONCILIATION,
        createdBy: users[ROLES.STORES],
        approvedBy: users[ROLES.ADMIN],
        approvedAt: new Date("2026-05-01"),
        dispatchedBy: users[ROLES.STORES],
        dispatchedAt: new Date("2026-05-01"),
        qrToken: "demo-qr-token-000001",
        items: {
          create: [
            {
              itemId: items["IT-1001"],
              quantity: 80,
              uom: "NOS",
              inputUnitWeight: 12.5,
              inputWeight: 1000,
              expectedFinishedWeight: 900,
              expectedScrapWeight: 90,
              expectedProcessLoss: 10,
              tolerancePercentage: 0,
              jobWorkStandardId: standard.id,
            },
          ],
        },
        dispatch: {
          create: {
            dispatchedAt: new Date("2026-05-01"),
            dispatchedBy: users[ROLES.STORES],
            transporter: "BlueDart Logistics",
            vehicleNumber: "KA-01-AB-1234",
            totalInputWeight: 1000,
            items: { create: [{ itemId: items["IT-1001"], quantity: 80, weight: 1000 }] },
          },
        },
        receipts: {
          create: [
            {
              receiptNumber: "RCP-2026-000001",
              receiptDate: new Date("2026-05-12"),
              vendorId: vendors["V-ABC"],
              receivedBy: users[ROLES.STORES],
              items: { create: [{ itemId: items["IT-1001"], quantityReceived: 79, weightReceived: 895 }] },
            },
          ],
        },
        scrapReceipts: {
          create: [
            {
              scrapReceiptNumber: "SCR-2026-000001",
              receiptDate: new Date("2026-05-12"),
              vendorId: vendors["V-ABC"],
              receivedBy: users[ROLES.STORES],
              weighmentSlipNumber: "WS-55521",
              items: { create: [{ scrapTypeId: scrapTypes["MACHINING_CHIPS"], weight: 87, uom: "KG" }] },
            },
          ],
        },
      },
    });

    await prisma.reconciliation.create({
      data: {
        dcId: dc.id,
        status: ReconciliationStatus.EXCEPTION,
        totalInputWeight: 1000,
        totalFinishedWeight: 895,
        totalScrapWeight: 87,
        totalRejectedWeight: 0,
        approvedProcessLoss: 10,
        accountedWeight: 992,
        unaccountedWeight: 8,
        scrapRecoveryPercent: 96.6667,
        calculatedBy: users[ROLES.ADMIN],
      },
    });

    await prisma.exception.create({
      data: {
        dcId: dc.id,
        type: ExceptionType.MATERIAL_SHORTAGE,
        description: "8 kg material unaccounted after finished + scrap + approved loss.",
        expectedValue: 1000,
        actualValue: 992,
        variance: 8,
        status: ExceptionStatus.OPEN,
        createdBy: users[ROLES.ADMIN],
      },
    });

    await prisma.statusHistory.createMany({
      data: [
        { dcId: dc.id, toStatus: "APPROVED", changedBy: users[ROLES.ADMIN] },
        { dcId: dc.id, fromStatus: "APPROVED", toStatus: "DISPATCHED", changedBy: users[ROLES.STORES] },
        { dcId: dc.id, fromStatus: "DISPATCHED", toStatus: "RECONCILIATION", changedBy: users[ROLES.STORES] },
      ],
    });

    console.log(`  demo DC ${dcNumber} created with 8 kg unaccounted exception`);
  }

  // System settings
  const settings: [string, string, string][] = [
    ["companyName", "DC & Vendor Material Management", "company"],
    ["defaultTimezone", "Asia/Kolkata", "locale"],
    ["defaultCurrency", "INR", "locale"],
    ["weightUnit", "KG", "units"],
    ["dcNumberFormat", "DC-{FY}-{SEQ:6}", "numbering"],
    ["fiscalYearStartMonth", "4", "locale"],
    ["scrapTolerancePercentage", "2", "reconciliation"],
    ["unaccountedTolerancePercentage", "0", "reconciliation"],
  ];
  for (const [key, value, group] of settings) {
    await prisma.systemSetting.upsert({ where: { key }, create: { key, value, group }, update: {} });
  }

  console.log("Seed complete.");
  console.log("--------------------------------------------------");
  console.log(`DEV CREDENTIALS (dev only): password = ${DEV_PASSWORD}`);
  userSpecs.forEach((u) => console.log(`  ${u.role.padEnd(11)} ${u.email}`));
  console.log("--------------------------------------------------");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });