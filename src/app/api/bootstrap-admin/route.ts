import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, ROLES } from "@/config/permissions";

export async function POST(req: Request) {
  try {
    // Check if an active ADMIN already exists
    const existingAdminCount = await prisma.user.count({
      where: {
        active: true,
        roles: {
          some: {
            role: {
              key: "ADMIN",
            },
          },
        },
      },
    });

    if (existingAdminCount > 0) {
      return NextResponse.json(
        { error: "An active Administrator already exists. One-time bootstrap is disabled." },
        { status: 403 },
      );
    }

    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email, and password are required." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    // Ensure permissions and ADMIN role exist
    const permissionKeys = Object.values(PERMISSIONS);
    for (const key of permissionKeys) {
      await prisma.permission.upsert({
        where: { key },
        create: { key },
        update: {},
      });
    }

    const adminRole = await prisma.role.upsert({
      where: { key: ROLES.ADMIN },
      create: { key: ROLES.ADMIN, name: "System Administrator", isSystem: true },
      update: {},
    });

    const grants = DEFAULT_ROLE_PERMISSIONS.ADMIN || [];
    for (const permKey of grants) {
      const permission = await prisma.permission.findUnique({ where: { key: permKey } });
      if (permission) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
          create: { roleId: adminRole.id, permissionId: permission.id },
          update: {},
        });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name.trim(),
        passwordHash,
        active: true,
        mustChangePassword: false,
        roles: {
          create: {
            roleId: adminRole.id,
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "FIRST_ADMIN_BOOTSTRAPPED",
        module: "System",
        entityType: "User",
        entityId: user.id,
        reason: `Initial System Administrator ${user.email} bootstrapped safely.`,
      },
    });

    return NextResponse.json({
      ok: true,
      message: `Initial Administrator account ${user.email} bootstrapped successfully.`,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bootstrap failed." },
      { status: 500 },
    );
  }
}
