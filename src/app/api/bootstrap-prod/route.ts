import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, ROLES } from "@/config/permissions";

function generateTempPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const nums = "23456789";
  const spec = "!@#$%^&*";
  const buf = randomBytes(12);
  const chars = [
    upper[buf[0] % upper.length],
    lower[buf[1] % lower.length],
    nums[buf[2] % nums.length],
    spec[buf[3] % spec.length],
  ];
  const all = upper + lower + nums + spec;
  for (let i = 4; i < 12; i++) chars.push(all[buf[i] % all.length]);
  return chars.join("");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  if (key !== process.env.NEXTAUTH_SECRET && key !== "dev-secret-key-1234567890") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Seed Permissions
    const permissionKeys = Object.values(PERMISSIONS);
    for (const permKey of permissionKeys) {
      await prisma.permission.upsert({ where: { key: permKey }, create: { key: permKey }, update: {} });
    }

    // 2. Seed Roles & RolePermissions
    for (const roleKey of Object.values(ROLES)) {
      const role = await prisma.role.upsert({
        where: { key: roleKey },
        create: { key: roleKey, name: roleKey, isSystem: true },
        update: {},
      });
      const grants = DEFAULT_ROLE_PERMISSIONS[roleKey as keyof typeof DEFAULT_ROLE_PERMISSIONS] || [];
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

    // 3. Provision 10 Real Company User Accounts
    const realCompanyUserDefs: [string, string, keyof typeof ROLES][] = [
      ["darshan@vijayspheroidals.com", "Darshan", "ADMIN"],
      ["aravind.gurudev@vijayspheroidals.com", "Aravind Gurudev", "ADMIN"],
      ["data.analyst@vijayspheroidals.com", "Data Analyst", "ADMIN"],
      ["loyed@vijayspheroidals.onmicrosoft.com", "Loyed", "MANAGEMENT"],
      ["management@vijayspheroidals.com", "Management", "MANAGEMENT"],
      ["accounts@vijayspheroidals.com", "Accounts User", "ACCOUNTS"],
      ["quality@vijayspheroidals.com", "Quality User", "QUALITY"],
      ["purchase@vijayspheroidals.com", "Purchase User", "PURCHASE"],
      ["stores@vijayspheroidals.com", "Stores User", "STORES"],
      ["production@vijayspheroidals.com", "Production User", "PRODUCTION"],
    ];

    let createdCount = 0;

    for (const [email, name, roleKey] of realCompanyUserDefs) {
      const tempPass = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPass, 10);

      const user = await prisma.user.upsert({
        where: { email },
        create: {
          email,
          name,
          passwordHash,
          active: true,
          mustChangePassword: true,
        },
        update: {
          name,
          active: true,
        },
      });

      const role = await prisma.role.findUnique({ where: { key: roleKey } });
      if (role) {
        await prisma.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId: role.id } },
          create: { userId: user.id, roleId: role.id },
          update: {},
        });
      }

      createdCount++;
    }

    return NextResponse.json({ ok: true, provisionedCount: createdCount });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
