import { describe, it, expect, vi, beforeEach } from "vitest";

// Module-level because vi.mock is hoisted above all other module code.
const prismaMock = {
  document: { findUnique: vi.fn() },
  deliveryChallan: { findUnique: vi.fn() },
};

vi.mock("../src/lib/db", () => ({ prisma: prismaMock }));
vi.mock("../src/server/authorize", () => ({ hasPermission: vi.fn().mockResolvedValue(true) }));
vi.mock("../src/services/storage", () => ({ storage: { read: vi.fn().mockResolvedValue(Buffer.from("x")) } }));

let currentUser: any;
vi.mock("../src/server/session", () => ({ getSessionUser: vi.fn(() => Promise.resolve(currentUser)) }));

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.document.findUnique.mockResolvedValue({
    id: "doc-1",
    entityType: "DeliveryChallan",
    entityId: "dc-1",
    storageKey: "key-1",
    fileType: "pdf",
    fileName: "doc.pdf",
  });
});

describe("GET /api/documents/[id] - vendor scope must fail closed, not open, on a missing vendorId", () => {
  it("denies a VENDOR-role user when the related DC has no vendorId (e.g. a TOOL/COMPANY_PROPERTY DC)", async () => {
    currentUser = { id: "u-vendor", vendorId: "v-1", roleKeys: ["VENDOR"] };
    prismaMock.deliveryChallan.findUnique.mockResolvedValue({ vendorId: null });

    const { GET } = await import("../src/app/api/documents/[id]/route");
    const res = await GET(new Request("http://x/api/documents/doc-1"), { params: Promise.resolve({ id: "doc-1" }) });

    expect(res.status).toBe(403);
  });

  it("allows a VENDOR-role user whose vendorId matches the DC's vendorId", async () => {
    currentUser = { id: "u-vendor", vendorId: "v-1", roleKeys: ["VENDOR"] };
    prismaMock.deliveryChallan.findUnique.mockResolvedValue({ vendorId: "v-1" });

    const { GET } = await import("../src/app/api/documents/[id]/route");
    const res = await GET(new Request("http://x/api/documents/doc-1"), { params: Promise.resolve({ id: "doc-1" }) });

    expect(res.status).toBe(200);
  });

  it("denies a VENDOR-role user whose vendorId does not match the DC's vendorId", async () => {
    currentUser = { id: "u-vendor", vendorId: "v-1", roleKeys: ["VENDOR"] };
    prismaMock.deliveryChallan.findUnique.mockResolvedValue({ vendorId: "v-2" });

    const { GET } = await import("../src/app/api/documents/[id]/route");
    const res = await GET(new Request("http://x/api/documents/doc-1"), { params: Promise.resolve({ id: "doc-1" }) });

    expect(res.status).toBe(403);
  });

  it("a non-VENDOR role with DC_VIEW can still view a document for a vendor-less (internal) DC", async () => {
    currentUser = { id: "u-stores", vendorId: null, roleKeys: ["STORES"] };
    prismaMock.deliveryChallan.findUnique.mockResolvedValue({ vendorId: null });

    const { GET } = await import("../src/app/api/documents/[id]/route");
    const res = await GET(new Request("http://x/api/documents/doc-1"), { params: Promise.resolve({ id: "doc-1" }) });

    expect(res.status).toBe(200);
  });
});
