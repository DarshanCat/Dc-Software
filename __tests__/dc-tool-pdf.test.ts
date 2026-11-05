import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderDcPdf, type DcPdfData } from "../src/services/dc-pdf";

// Module-level because vi.mock is hoisted above all other module code.
const prismaMock = {
  deliveryChallan: { findUnique: vi.fn() },
  systemSetting: { findMany: vi.fn().mockResolvedValue([]) },
  toolInstance: { findMany: vi.fn().mockResolvedValue([]) },
  assetMaster: { findMany: vi.fn().mockResolvedValue([]) },
};

vi.mock("../src/lib/db", () => ({ prisma: prismaMock }));
vi.mock("../src/services/company-branding", () => ({
  getCompanyLogoDataUrl: vi.fn().mockResolvedValue(null),
}));

const baseDc = {
  id: "dc-tool-1",
  dcNumber: "DC-TOOL-001",
  dcDate: new Date("2026-11-01"),
  status: "DRAFT",
  purpose: "OTHER",
  woNumber: "N/A",
  partNumber: null,
  rmQuantity: null,
  returnFgQuantity: null,
  rmUom: null,
  fgUom: null,
  outwardWeight: null,
  heatNumber: null,
  materialGrade: null,
  materialType: null,
  remarks: null,
  vehicleNumber: null,
  transporter: null,
  ewayBillNumber: null,
  eSugamNumber: null,
  referenceNumber: null,
  expectedReturnDate: new Date("2026-11-10"),
  qrToken: null,
  createdBy: "u-stores",
  approvedBy: null,
  preparedByName: "Stores Tester",
  approvedByName: null,
  length: null,
  width: null,
  height: null,
  dimensionUom: null,
  vendor: null,
  process: null,
};

describe("Tool/Company Property DC PDF - carries its own tool-appropriate layout, not the Material template", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.systemSetting.findMany.mockResolvedValue([]);
    prismaMock.toolInstance.findMany.mockResolvedValue([]);
    prismaMock.assetMaster.findMany.mockResolvedValue([]);
  });

  it("loadDcPdfData resolves Tool Code + Serial Number from ToolInstance/ToolMaster for a TOOL DC", async () => {
    prismaMock.deliveryChallan.findUnique.mockResolvedValue({
      ...baseDc,
      movementType: "TOOL",
      destinationDepartment: "PRODUCTION",
      responsibleCustodian: "Ravi Kumar",
      items: [
        { itemCode: null, itemDescription: "Digital Vernier Caliper", quantity: 2, uom: "NOS", conditionIn: "GOOD", toolInstanceId: "ti-1", assetMasterId: null },
      ],
    });
    prismaMock.toolInstance.findMany.mockResolvedValue([
      { id: "ti-1", serialNumber: "SN-9988", toolMaster: { toolCode: "TL-CAL-001", toolName: "Vernier Caliper" } },
    ]);

    const { loadDcPdfData } = await import("../src/server/dcs/pdf");
    const data = await loadDcPdfData("dc-tool-1");

    expect(data).not.toBeNull();
    expect(data!.movementType).toBe("TOOL");
    expect(data!.destinationDepartment).toBe("PRODUCTION");
    expect(data!.responsibleCustodian).toBe("Ravi Kumar");
    expect(data!.items).toHaveLength(1);
    expect(data!.items![0].label).toBe("TL-CAL-001");
    expect(data!.items![0].serial).toBe("SN-9988");
    expect(data!.items![0].description).toBe("Digital Vernier Caliper");
    expect(data!.items![0].condition).toBe("GOOD");
    // Material-only fields remain placeholders, never fabricated for a Tool DC.
    expect(data!.materialGrade).toBe("—");
    expect(data!.heatNumber).toBe("—");
  });

  it("loadDcPdfData resolves Asset Tag + Serial Number from AssetMaster for a COMPANY_PROPERTY DC", async () => {
    prismaMock.deliveryChallan.findUnique.mockResolvedValue({
      ...baseDc,
      movementType: "COMPANY_PROPERTY",
      destinationDepartment: "IT",
      responsibleCustodian: "Priya Singh",
      items: [
        { itemCode: null, itemDescription: "Dell Latitude Laptop", quantity: 1, uom: "NOS", conditionIn: "GOOD", toolInstanceId: null, assetMasterId: "am-1" },
      ],
    });
    prismaMock.assetMaster.findMany.mockResolvedValue([
      { id: "am-1", assetTag: "AST-LAP-042", serialNumber: "DL-SN-55" },
    ]);

    const { loadDcPdfData } = await import("../src/server/dcs/pdf");
    const data = await loadDcPdfData("dc-tool-1");

    expect(data!.movementType).toBe("COMPANY_PROPERTY");
    expect(data!.items![0].label).toBe("AST-LAP-042");
    expect(data!.items![0].serial).toBe("DL-SN-55");
  });

  it("falls back to the raw itemCode when no ToolInstance/AssetMaster is linked", async () => {
    prismaMock.deliveryChallan.findUnique.mockResolvedValue({
      ...baseDc,
      movementType: "TOOL",
      destinationDepartment: "PRODUCTION",
      responsibleCustodian: "Ravi Kumar",
      items: [
        { itemCode: "MISC-01", itemDescription: "Adjustable Wrench", quantity: 1, uom: "NOS", conditionIn: "GOOD", toolInstanceId: null, assetMasterId: null },
      ],
    });

    const { loadDcPdfData } = await import("../src/server/dcs/pdf");
    const data = await loadDcPdfData("dc-tool-1");

    expect(data!.items![0].label).toBe("MISC-01");
    expect(data!.items![0].serial).toBe("—");
  });

  it("renders a valid PDF for a TOOL DC without crashing, with multiple line items", async () => {
    const pdfData: DcPdfData = {
      company: { name: "Vijay Spheroidals Pvt Ltd", address: "Peenya, Bengaluru", gst: "29AAAAA0000A1Z5", contact: "info@vijayspheroidals.com" },
      dcNumber: "DC-TOOL-001",
      dcDate: "01/11/2026",
      woNumber: "N/A",
      status: "DRAFT",
      movementType: "TOOL",
      destinationDepartment: "PRODUCTION",
      responsibleCustodian: "Ravi Kumar",
      items: [
        { label: "TL-CAL-001", description: "Digital Vernier Caliper", serial: "SN-9988", quantity: "2.000 NOS", condition: "GOOD" },
        { label: "TL-MIC-002", description: "Micrometer", serial: "SN-1234", quantity: "1.000 NOS", condition: "CALIBRATION_DUE" },
      ],
      vendorName: "INTERNAL",
      vendorAddress: "",
      vendorGst: "",
      vendorPan: "",
      purpose: "OTHER",
      processName: "—",
      partNumber: "—",
      rmQuantity: "—",
      returnFgQuantity: "—",
      weightKg: "—",
      heatNumber: "—",
      materialGrade: "—",
      materialType: "—",
      vehicleNumber: "—",
      transporter: "—",
      ewayBillNumber: "—",
      eSugamNumber: "—",
      referenceNumber: "—",
      expectedReturnDate: "10/11/2026",
      qrDataUrl: null,
    };

    const pdfBuffer = await renderDcPdf(pdfData);
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("the TOOL/COMPANY_PROPERTY PDF layout never prints the Material-only labels (RM QTY, HEAT NUMBER, MATERIAL GRADE)", async () => {
    // A direct regression guard for the original bug report: TOOL DCs must not
    // render as a material-outward document. We can't extract rendered PDF text
    // without a PDF-parsing dependency, so this asserts the renderer source
    // itself never draws those labels outside the isMaterialDc branch - i.e.
    // the TOOL/COMPANY_PROPERTY branch is a structurally separate code path.
    const fs = await import("node:fs/promises");
    const src = await fs.readFile(new URL("../src/services/dc-pdf.tsx", import.meta.url), "utf8");
    const materialBranchMatch = src.match(/if \(isMaterialDc\) \{([\s\S]*?)\n {2}\} else \{([\s\S]*?)\n {2}\}/);
    expect(materialBranchMatch).not.toBeNull();
    const [, materialBranch, toolBranch] = materialBranchMatch!;
    expect(materialBranch).toContain("RM QTY (RAW MAT.)");
    expect(materialBranch).toContain("HEAT NUMBER");
    expect(materialBranch).toContain("MATERIAL GRADE");
    expect(toolBranch).not.toContain("RM QTY (RAW MAT.)");
    expect(toolBranch).not.toContain("HEAT NUMBER");
    expect(toolBranch).not.toContain("MATERIAL GRADE");
    expect(toolBranch).toContain("TOOL CODE");
    expect(toolBranch).toContain("ASSET TAG");
  });
});
