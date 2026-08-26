/**
 * seed.ts — development seed data.
 * Run: npm run prisma:seed
 * DEV ONLY CREDENTIALS — NEVER USE IN PRODUCTION.
 */
import {
  PrismaClient,
  DcPurpose,
  DcStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, ROLES } from "../src/config/permissions";

const prisma = new PrismaClient();
// DEV ONLY CREDENTIALS — FOR LOCAL DEVELOPMENT ONLY
const DEV_ONLY_PASSWORD = "Password@123";

async function main() {
  console.log("Seeding…");

  // Clean up any old demo `@example.com` accounts from local development database
  await prisma.user.deleteMany({
    where: { email: { endsWith: "@example.com" } },
  });

  const permissionKeys = Object.values(PERMISSIONS);
  for (const key of permissionKeys) {
    await prisma.permission.upsert({ where: { key }, create: { key }, update: {} });
  }

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

  const devPasswordHash = await bcrypt.hash(DEV_ONLY_PASSWORD, 10);
  const realCompanyUserDefs: [string, string, string][] = [
    ["darshan@vijayspheroidals.com", "Darshan", ROLES.ADMIN],
    ["aravind.gurudev@vijayspheroidals.com", "Aravind Gurudev", ROLES.ADMIN],
    ["data.analyst@vijayspheroidals.com", "Data Analyst", ROLES.ADMIN],
    ["loyed@vijayspheroidals.onmicrosoft.com", "Loyed", ROLES.MANAGEMENT],
    ["management@vijayspheroidals.com", "Management", ROLES.MANAGEMENT],
    ["accounts@vijayspheroidals.com", "Accounts User", ROLES.ACCOUNTS],
    ["quality@vijayspheroidals.com", "Quality User", ROLES.QUALITY],
    ["purchase@vijayspheroidals.com", "Purchase User", ROLES.PURCHASE],
    ["stores@vijayspheroidals.com", "Stores User", ROLES.STORES],
    ["production@vijayspheroidals.com", "Production User", ROLES.PRODUCTION],
  ];

  const users: Record<string, string> = {};
  for (const [email, name, roleKey] of realCompanyUserDefs) {
    const u = await prisma.user.upsert({
      where: { email },
      create: { email, name, passwordHash: devPasswordHash },
      update: { name, passwordHash: devPasswordHash },
    });
    users[roleKey] = u.id;
    const r = await prisma.role.findUnique({ where: { key: roleKey } });
    if (r) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: u.id, roleId: r.id } },
        create: { userId: u.id, roleId: r.id },
        update: {},
      });
    }
  }

  const processDefs: [string, string][] = [
    ["MILLING", "Milling"],
    ["TURNING", "Turning"],
    ["CNC_TURNING", "CNC Turning"],
    ["HMC", "HMC"],
    ["PLATING", "Plating"],
    ["ZINC_LITTLE_PLATING", "Zinc Little Plating"],
    ["BLACK_PASSIVATION", "Black Passivation"],
    ["HEAT_TREATMENT", "Heat Treatment"],
    ["ANNEALING", "Annealing"],
    ["STRESS_RELIEVING", "Stress Relieving"],
    ["SURFACE_GRINDING", "Surface Grinding"],
    ["SHOT_BLASTING_PAINTING", "Shot Blasting and Painting"],
    ["PAINTING", "Painting"],
    ["NOTCHING", "Notching"],
    ["FOR_CMM", "For CMM"],
    ["FOR_CUTTING", "For Cutting"],
    ["CNC_MACHINING", "CNC Machining"],
    ["SURFACE_TREATMENT", "Surface Treatment"],
  ];
  const processes: Record<string, string> = {};
  for (const [code, name] of processDefs) {
    const p = await prisma.process.upsert({ where: { code }, create: { code, name }, update: {} });
    processes[code] = p.id;
  }

  const scrapDefs: [string, string][] = [
    ["MACHINING_CHIPS", "Machining Chips"],
    ["TURNING_SCRAP", "Turning Scrap"],
    ["BORING_SCRAP", "Boring Scrap"],
    ["PROCESS_SCRAP", "Process Scrap"],
    ["REJECTION_SCRAP", "Rejection Scrap"],
  ];
  for (const [code, name] of scrapDefs) {
    await prisma.scrapType.upsert({ where: { code }, create: { code, name }, update: {} });
  }

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

  await prisma.numberSequence.upsert({
    where: { key_fiscalYear: { key: "DC", fiscalYear: "2026" } },
    create: { key: "DC", fiscalYear: "2026", prefix: "DC-2026-", padding: 6, current: 1 },
    update: {},
  });

  const recoveryDefs: [string, string][] = [
    ["BORING", "Boring"],
    ["MACHINING_CHIPS", "Machining Chips"],
    ["GRINDING_DUST", "Grinding Dust"],
    ["OTHER", "Other Recovery"],
  ];
  for (const [code, name] of recoveryDefs) {
    await prisma.recoveryType.upsert({
      where: { code },
      create: { code, name, unit: "KG" },
      update: {},
    });
  }

  const dcNumber = "DC-2026-000001";
  const existing = await prisma.deliveryChallan.findUnique({ where: { dcNumber } });
  if (!existing) {
    await prisma.deliveryChallan.create({
      data: {
        dcNumber,
        dcDate: new Date("2026-05-01"),
        woNumber: "WO-2026-00100",
        partNumber: "PART-1001",
        rmQuantity: 1000,
        returnFgQuantity: 900,
        heatNumber: "HEAT-8899",
        expectedScrap: 90,
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
        preparedByName: "Stores User",
        approvedByName: "Darshan",
        qrToken: "demo-qr-token-000001",
      },
    });
  }

  console.log("Seed complete.");
  console.log("--------------------------------------------------");
  console.log(`[DEV ONLY] credentials: password = ${DEV_ONLY_PASSWORD}`);
  for (const [email, , roleKey] of realCompanyUserDefs) {
    console.log(`  ${roleKey.padEnd(11)} ${email}`);
  }
  console.log("--------------------------------------------------");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });