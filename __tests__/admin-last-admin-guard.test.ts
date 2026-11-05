import { describe, it, expect, vi, beforeEach } from "vitest";

// Module-level because vi.mock is hoisted above all other module code.
const usersById = new Map<string, any>();

const prismaMock = {
  user: {
    findUnique: vi.fn(async ({ where }: any) => usersById.get(where.id) ?? null),
    update: vi.fn(async ({ where, data }: any) => {
      const existing = usersById.get(where.id);
      const updated = { ...existing, ...data };
      usersById.set(where.id, updated);
      return updated;
    }),
    count: vi.fn(),
  },
  role: { findMany: vi.fn() },
  userRole: { deleteMany: vi.fn().mockResolvedValue({}), createMany: vi.fn().mockResolvedValue({}) },
  $transaction: vi.fn((arg: any) => (typeof arg === "function" ? arg(prismaMock) : Promise.all(arg))),
};

vi.mock("../src/lib/db", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../src/server/audit", () => ({ writeAudit: vi.fn().mockResolvedValue(undefined) }));

let currentUser: any = { id: "u-admin-1", roleKeys: ["ADMIN"] };
vi.mock("../src/server/session", () => ({ getSessionUser: vi.fn(() => Promise.resolve(currentUser)) }));
vi.mock("../src/server/authorize", () => ({
  requirePermission: vi.fn(async () => currentUser),
  ForbiddenError: class ForbiddenError extends Error {},
  UnauthenticatedError: class UnauthenticatedError extends Error {},
}));

function setUser(id: string, data: Record<string, any>) {
  usersById.set(id, { id, email: `${id}@factory.com`, active: true, ...data });
}

beforeEach(() => {
  usersById.clear();
  vi.clearAllMocks();
});

describe("setUserActive - last-Admin protection (previously had no guard at all)", () => {
  beforeEach(() => {
    currentUser = { id: "u-admin-1", roleKeys: ["ADMIN"] };
  });

  it("blocks deactivating the last active Administrator", async () => {
    setUser("u-admin-2", { active: true, roles: [{ role: { key: "ADMIN" } }] });
    prismaMock.user.count.mockResolvedValue(1); // only 1 active admin left (the target)

    const { setUserActive } = await import("../src/server/users/actions");
    const res = await setUserActive("u-admin-2", false);

    expect(res.ok).toBe(false);
    expect(usersById.get("u-admin-2").active).toBe(true);
  });

  it("allows deactivating an Admin when at least one other active Admin remains", async () => {
    setUser("u-admin-2", { active: true, roles: [{ role: { key: "ADMIN" } }] });
    prismaMock.user.count.mockResolvedValue(2); // target + at least one other active admin

    const { setUserActive } = await import("../src/server/users/actions");
    const res = await setUserActive("u-admin-2", false);

    expect(res.ok).toBe(true);
    expect(usersById.get("u-admin-2").active).toBe(false);
  });

  it("does not apply the last-admin check to a non-Admin user", async () => {
    setUser("u-stores-1", { active: true, roles: [{ role: { key: "STORES" } }] });

    const { setUserActive } = await import("../src/server/users/actions");
    const res = await setUserActive("u-stores-1", false);

    expect(res.ok).toBe(true);
    expect(prismaMock.user.count).not.toHaveBeenCalled();
  });
});

describe("updateUserRoles - last-Admin protection when removing the ADMIN role (previously had no guard at all)", () => {
  beforeEach(() => {
    currentUser = { id: "u-admin-1", roleKeys: ["ADMIN"] };
    prismaMock.role.findMany.mockResolvedValue([{ id: "role-stores", key: "STORES" }]);
  });

  it("blocks removing ADMIN from the last active Administrator", async () => {
    usersById.set("u-admin-2", {
      id: "u-admin-2",
      email: "u-admin-2@factory.com",
      active: true,
      roles: [{ role: { key: "ADMIN" } }],
    });
    prismaMock.user.count.mockResolvedValue(1);

    const { updateUserRoles } = await import("../src/server/users/actions");
    const res = await updateUserRoles("u-admin-2", ["STORES"]);

    expect(res.ok).toBe(false);
    expect(prismaMock.userRole.deleteMany).not.toHaveBeenCalled();
  });

  it("allows removing ADMIN when another active Administrator remains", async () => {
    usersById.set("u-admin-2", {
      id: "u-admin-2",
      email: "u-admin-2@factory.com",
      active: true,
      roles: [{ role: { key: "ADMIN" } }],
    });
    prismaMock.user.count.mockResolvedValue(2);

    const { updateUserRoles } = await import("../src/server/users/actions");
    const res = await updateUserRoles("u-admin-2", ["STORES"]);

    expect(res.ok).toBe(true);
  });
});
