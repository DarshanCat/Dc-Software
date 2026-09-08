import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { deleteUser } from "@/server/users/actions";
import * as sessionModule from "@/server/session";

describe("Admin-Only Delete & Safe Deactivation User Functionality", () => {
  let adminUser: any;
  let nonAdminUser: any;
  let targetUnusedUser: any;
  let targetUserWithAudit: any;

  beforeEach(async () => {
    const adminRole = await prisma.role.upsert({
      where: { key: "ADMIN" },
      create: { key: "ADMIN", name: "Administrator", isSystem: true },
      update: {},
    });

    const storesRole = await prisma.role.upsert({
      where: { key: "STORES" },
      create: { key: "STORES", name: "Stores", isSystem: true },
      update: {},
    });

    const hash = await bcrypt.hash("Password@123", 10);

    // Protected Admins
    const darshan = await prisma.user.upsert({
      where: { email: "darshan@vijayspheroidals.com" },
      create: { email: "darshan@vijayspheroidals.com", name: "Darshan", passwordHash: hash, active: true },
      update: { active: true },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: darshan.id, roleId: adminRole.id } },
      create: { userId: darshan.id, roleId: adminRole.id },
      update: {},
    });

    const aravind = await prisma.user.upsert({
      where: { email: "aravind.gurudev@vijayspheroidals.com" },
      create: { email: "aravind.gurudev@vijayspheroidals.com", name: "Aravind", passwordHash: hash, active: true },
      update: { active: true },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: aravind.id, roleId: adminRole.id } },
      create: { userId: aravind.id, roleId: adminRole.id },
      update: {},
    });

    // Active Admin performing test operations
    adminUser = darshan;

    // Non-Admin User
    nonAdminUser = await prisma.user.upsert({
      where: { email: "nonadmin.stores@vijayspheroidals.com" },
      create: { email: "nonadmin.stores@vijayspheroidals.com", name: "Non Admin Stores", passwordHash: hash, active: true },
      update: { active: true },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: nonAdminUser.id, roleId: storesRole.id } },
      create: { userId: nonAdminUser.id, roleId: storesRole.id },
      update: {},
    });

    // Target Unused User (No historical audit/DC references)
    targetUnusedUser = await prisma.user.upsert({
      where: { email: "temp.unused.user@vijayspheroidals.com" },
      create: { email: "temp.unused.user@vijayspheroidals.com", name: "Temp Unused User", passwordHash: hash, active: true },
      update: { active: true },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: targetUnusedUser.id, roleId: storesRole.id } },
      create: { userId: targetUnusedUser.id, roleId: storesRole.id },
      update: {},
    });

    // Target User WITH Historical Audit Record
    targetUserWithAudit = await prisma.user.upsert({
      where: { email: "user.with.history@vijayspheroidals.com" },
      create: { email: "user.with.history@vijayspheroidals.com", name: "Historical User", passwordHash: hash, active: true },
      update: { active: true },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: targetUserWithAudit.id, roleId: storesRole.id } },
      create: { userId: targetUserWithAudit.id, roleId: storesRole.id },
      update: {},
    });

    await prisma.auditLog.create({
      data: {
        userId: targetUserWithAudit.id,
        action: "TEST_ACTION",
        module: "Test",
        entityType: "User",
        entityId: targetUserWithAudit.id,
        reason: "Test historical audit entry",
      },
    });

    // Mock session user as Admin by default
    vi.spyOn(sessionModule, "getSessionUser").mockResolvedValue({
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      roleKeys: ["ADMIN"],
    } as any);
  });

  it("allows Admin to hard-delete an eligible user with zero historical records", async () => {
    const res = await deleteUser(targetUnusedUser.id, targetUnusedUser.email);
    expect(res.ok).toBe(true);

    const check = await prisma.user.findUnique({ where: { id: targetUnusedUser.id } });
    expect(check).toBeNull();
  });

  it("rejects user deletion attempts by non-Admin users", async () => {
    vi.spyOn(sessionModule, "getSessionUser").mockResolvedValue({
      id: nonAdminUser.id,
      email: nonAdminUser.email,
      name: nonAdminUser.name,
      roleKeys: ["STORES"],
    } as any);

    const res = await deleteUser(targetUnusedUser.id, targetUnusedUser.email);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("You do not have permission to delete users.");
    }
  });

  it("rejects Admin self-deletion attempts", async () => {
    const res = await deleteUser(adminUser.id, adminUser.email);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("You cannot delete your own user account.");
    }
  });

  it("rejects deletion of protected Admin accounts (Darshan & Aravind)", async () => {
    const aravind = await prisma.user.findUnique({ where: { email: "aravind.gurudev@vijayspheroidals.com" } });
    const res = await deleteUser(aravind!.id, aravind!.email);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("Protected administrator accounts cannot be deleted.");
    }
  });

  it("rejects deletion when email confirmation string does not match target email", async () => {
    const res = await deleteUser(targetUnusedUser.id, "wrong.email@vijayspheroidals.com");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("The entered email address does not match the user's email.");
    }
  });

  it("safely deactivates user (active = false) when historical audit or DC records exist", async () => {
    const res = await deleteUser(targetUserWithAudit.id, targetUserWithAudit.email);
    expect(res.ok).toBe(true);

    // User record is PRESERVED, not physically deleted
    const preservedUser = await prisma.user.findUnique({ where: { id: targetUserWithAudit.id } });
    expect(preservedUser).not.toBeNull();
    expect(preservedUser?.active).toBe(false);

    // Audit Log is created
    const auditLogs = await prisma.auditLog.findMany({
      where: { action: "USER_DELETED", entityId: targetUserWithAudit.id },
    });
    expect(auditLogs.length).toBeGreaterThan(0);
  });
});
