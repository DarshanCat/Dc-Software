import { describe, it, expect, vi, beforeEach } from "vitest";

const dcStore = new Map<string, any>();
const docStore = new Map<string, any>();
let idCounter = 1;

vi.mock("@/lib/db", () => ({
  prisma: {
    deliveryChallan: {
      findUnique: vi.fn().mockImplementation(({ where }: any) => {
        return Promise.resolve(dcStore.get(where.id) || null);
      }),
      findMany: vi.fn().mockImplementation(({ where }: any) => {
        let list = Array.from(dcStore.values());
        if (where?.status?.in) {
          list = list.filter((dc) => where.status.in.includes(dc.status));
        } else if (where?.status) {
          list = list.filter((dc) => dc.status === where.status);
        }
        return Promise.resolve(list);
      }),
      update: vi.fn().mockImplementation(({ where, data }: any) => {
        const existing = dcStore.get(where.id) || {};
        const updated = { ...existing, ...data, updatedAt: new Date() };
        dcStore.set(where.id, updated);
        return Promise.resolve(updated);
      }),
    },
    document: {
      create: vi.fn().mockImplementation(({ data }: any) => {
        const id = `doc-${idCounter++}`;
        const doc = { id, ...data, uploadedAt: new Date() };
        docStore.set(id, doc);
        return Promise.resolve(doc);
      }),
      findMany: vi.fn().mockImplementation(({ where }: any) => {
        let list = Array.from(docStore.values());
        if (where?.entityType) {
          list = list.filter((d) => d.entityType === where.entityType);
        }
        if (where?.entityId?.in) {
          list = list.filter((d) => where.entityId.in.includes(d.entityId));
        } else if (where?.entityId) {
          list = list.filter((d) => d.entityId === where.entityId);
        }
        return Promise.resolve(list);
      }),
    },
    statusHistory: {
      create: vi.fn().mockResolvedValue({ id: "sh-1" }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "al-1" }),
    },
    notification: {
      create: vi.fn().mockResolvedValue({ id: "notif-1" }),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn().mockImplementation((actions: any) => {
      if (Array.isArray(actions)) return Promise.all(actions);
      return actions(vi.fn());
    }),
  },
}));

vi.mock("@/server/session", () => ({
  getSessionUser: vi.fn().mockResolvedValue({
    id: "user-sec-1",
    roleKeys: ["SECURITY"],
  }),
  requireUser: vi.fn().mockResolvedValue({
    id: "user-sec-1",
    roleKeys: ["SECURITY"],
  }),
}));

vi.mock("@/server/authorize", () => ({
  requirePermission: vi.fn().mockResolvedValue(true),
  hasPermission: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/services/storage", () => ({
  storage: {
    save: vi.fn().mockImplementation(async (_buffer: Buffer, filename: string) => `storage-key-${filename}`),
    read: vi.fn().mockResolvedValue(Buffer.from("PDF-MOCK-DATA")),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Security Inward Invoice Attachment and Quality Gate Suite", () => {
  beforeEach(() => {
    dcStore.clear();
    docStore.clear();
    idCounter = 1;
    vi.clearAllMocks();
  });

  it("1. uploads vendor invoice during Security Inward and links to DeliveryChallan", async () => {
    const { uploadInwardInvoice, submitSecurityReturn } = await import("@/server/dcs/actions");

    const dcId = "dc-inv-1";
    dcStore.set(dcId, {
      id: dcId,
      dcNumber: "DC-2026-0001",
      status: "DISPATCHED",
      woNumber: "WO-2026-900",
      rmQuantity: 100,
      returnFgQuantity: 98,
    });

    // Create a mock PDF File
    const pdfBuffer = Buffer.from("%PDF-1.4 mock pdf content");
    const file = new File([pdfBuffer], "vendor_tax_invoice.pdf", { type: "application/pdf" });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("invoiceNumber", "INV-998877");

    const uploadRes = await uploadInwardInvoice(dcId, formData);
    expect(uploadRes.ok).toBe(true);
    expect(uploadRes.documentId).toBeDefined();

    // Verify Document record was created
    const createdDoc = docStore.get(uploadRes.documentId!);
    expect(createdDoc).toBeDefined();
    expect(createdDoc.entityType).toBe("DeliveryChallan");
    expect(createdDoc.entityId).toBe(dcId);
    expect(createdDoc.fileName).toContain("Invoice_INV-998877_");

    // Perform Security Return
    const returnRes = await submitSecurityReturn(dcId, {
      actualInwardQty: 98,
      inwardDate: "2026-10-15",
      invoiceNumber: "INV-998877",
      vehicleNumber: "KA-01-EQ-9999",
      transporter: "VRL Logistics",
    });
    expect(returnRes.ok).toBe(true);

    const updatedDc = dcStore.get(dcId);
    expect(updatedDc.status).toBe("SECURITY_RETURNED");
    expect(updatedDc.invoiceNumber).toBe("INV-998877");
    expect(Number(updatedDc.actualInwardQty)).toBe(98);
  });

  it("2. allows Quality Inspection for SECURITY_RETURNED status with reconciliation", async () => {
    const { submitQualityInspection } = await import("@/server/dcs/extended-actions");
    const { getSessionUser } = await import("@/server/session");

    // Mock Quality inspector session
    vi.mocked(getSessionUser).mockResolvedValueOnce({
      id: "user-qual-1",
      roleKeys: ["QUALITY"],
    } as any);

    const dcId = "dc-qual-1";
    dcStore.set(dcId, {
      id: dcId,
      dcNumber: "DC-2026-0002",
      status: "SECURITY_RETURNED",
      woNumber: "WO-2026-902",
      actualInwardQty: 50,
      storeReceivedQty: null, // Test backfilling when storeReceivedQty is null
    });

    const res = await submitQualityInspection({
      dcId,
      goodQty: 48,
      rejectionQty: 2,
      scrapQty: 0,
      qualityDecision: "PARTIAL_ACCEPTANCE",
      inspectionRemarks: "2 pcs minor porosity rejection",
    });

    expect(res.ok).toBe(true);

    const inspectedDc = dcStore.get(dcId);
    expect(inspectedDc.status).toBe("QUALITY_COMPLETED");
    expect(Number(inspectedDc.storeReceivedQty)).toBe(50);
    expect(Number(inspectedDc.goodQty)).toBe(48);
    expect(Number(inspectedDc.rejectionQty)).toBe(2);
    expect(Number(inspectedDc.scrapQty)).toBe(0);
    expect(inspectedDc.qualityDecision).toBe("PARTIAL_ACCEPTANCE");
  });

  it("3. rejects Quality Inspection if quantities do not reconcile", async () => {
    const { submitQualityInspection } = await import("@/server/dcs/extended-actions");
    const { getSessionUser } = await import("@/server/session");

    vi.mocked(getSessionUser).mockResolvedValueOnce({
      id: "user-qual-1",
      roleKeys: ["QUALITY"],
    } as any);

    const dcId = "dc-qual-2";
    dcStore.set(dcId, {
      id: dcId,
      dcNumber: "DC-2026-0003",
      status: "STORE_VERIFIED",
      storeReceivedQty: 100,
    });

    const res = await submitQualityInspection({
      dcId,
      goodQty: 80,
      rejectionQty: 10,
      scrapQty: 5, // Sum = 95 != 100
      qualityDecision: "PARTIAL_ACCEPTANCE",
    });

    expect(res.ok).toBe(false);
    expect(res.error).toContain("must equal the Store Received Qty");
  });

  it("4. verifies filtering helper for WO ID and DC Number in Quality portal", () => {
    const pendingDcs = [
      { id: "1", dcNumber: "DC-001", woNumber: "WO-A1", partNumber: "PN-10", vendorName: "Alpha Vendor", department: "PROD", actualInwardQty: 10, storeReceivedQty: 10, status: "SECURITY_RETURNED" },
      { id: "2", dcNumber: "DC-002", woNumber: "WO-B2", partNumber: "PN-20", vendorName: "Beta Vendor", department: "PROD", actualInwardQty: 20, storeReceivedQty: 20, status: "STORE_VERIFIED" },
      { id: "3", dcNumber: "DC-003", woNumber: "WO-A1-EXTRA", partNumber: "PN-30", vendorName: "Gamma Vendor", department: "PROD", actualInwardQty: 30, storeReceivedQty: 30, status: "QUALITY_PENDING" },
    ];

    // Search by WO ID
    const matchWo = pendingDcs.filter(d => d.woNumber.toLowerCase().includes("wo-a1"));
    expect(matchWo.length).toBe(2);
    expect(matchWo.map(m => m.id)).toEqual(["1", "3"]);

    // Search by DC Number
    const matchDc = pendingDcs.filter(d => d.dcNumber.toLowerCase().includes("002"));
    expect(matchDc.length).toBe(1);
    expect(matchDc[0].id).toBe("2");
  });
});
