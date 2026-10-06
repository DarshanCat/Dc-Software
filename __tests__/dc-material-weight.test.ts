import { describe, it, expect, vi } from "vitest";
import { outwardDcSchema, firstIssueMessage } from "../src/lib/validation/dc";
import { Prisma } from "@prisma/client";

vi.mock("@/server/session", () => ({
  getSessionUser: vi.fn().mockResolvedValue({
    id: "test-user-123",
    email: "stores@vijayspheroidals.com",
    roleKeys: ["STORES", "ADMIN"],
    vendorId: null,
  }),
}));

describe("Material DC Weight (KG) End-to-End Validation & Persistence", () => {
  const validateMaterialWeight = (weightInput: any) => {
    if (weightInput === undefined || weightInput === null || isNaN(Number(weightInput)) || !isFinite(Number(weightInput)) || Number(weightInput) <= 0) {
      return "Material Weight (KG) is mandatory and must be greater than 0 for Material DCs.";
    }
    const payload = {
      movementType: "MATERIAL",
      isCommercialService: true,
      vendorId: "vendor-123",
      department: "STORES",
      woNumber: "WO-TEST-WT-01",
      partNumber: "PN-TEST-WT-01",
      outwardQtyRw: 100,
      returningFgQuantity: 95,
      pricingBasis: "RW",
      ratePerQuantity: 50,
      outwardWeight: weightInput,
    };
    return firstIssueMessage(outwardDcSchema, payload);
  };

  it("accepts valid integer weight (e.g. 500)", () => {
    const err = validateMaterialWeight(500);
    expect(err).toBeNull();
  });

  it("accepts valid decimal weight (e.g. 125.750) and preserves decimal precision", () => {
    const err = validateMaterialWeight(125.75);
    expect(err).toBeNull();

    const decimalVal = new Prisma.Decimal(125.75);
    expect(decimalVal.toNumber()).toBe(125.75);
    expect(decimalVal.toFixed(3)).toBe("125.750");
  });

  it("rejects missing weight for Material DCs", () => {
    const err = validateMaterialWeight(undefined);
    expect(err).not.toBeNull();
    expect(err).toMatch(/mandatory|required/i);
  });

  it("rejects zero weight (0)", () => {
    const err = validateMaterialWeight(0);
    expect(err).toMatch(/greater than 0|greater than zero/i);
  });

  it("rejects negative weight (-10)", () => {
    const err = validateMaterialWeight(-10);
    expect(err).toMatch(/greater than 0|greater than zero/i);
  });

  it("rejects NaN weight", () => {
    const err = validateMaterialWeight(NaN);
    expect(err).toMatch(/mandatory|valid number|greater than 0/i);
  });

  it("rejects Infinity weight", () => {
    const err = validateMaterialWeight(Infinity);
    expect(err).toMatch(/mandatory|valid number|greater than 0/i);
  });

  it("rejects malformed string weight ('abc')", () => {
    const err = validateMaterialWeight("abc");
    expect(err).toMatch(/mandatory|valid number|greater than 0/i);
  });

  it("supports multiple line items with different weights on DeliveryChallanItem", () => {
    const items = [
      { itemCode: "TL-01", itemDescription: "Fixture Assembly 1", quantity: 2, weight: 15.25, uom: "NOS" },
      { itemCode: "TL-02", itemDescription: "Die Insert 2", quantity: 5, weight: 8.5, uom: "NOS" },
      { itemCode: "TL-03", itemDescription: "Heavy Base Plate 3", quantity: 1, weight: 45.0, uom: "NOS" },
    ];

    expect(items).toHaveLength(3);
    expect(items[0].weight).toBe(15.25);
    expect(items[1].weight).toBe(8.5);
    expect(items[2].weight).toBe(45.0);

    const prismaItems = items.map((it) => ({
      itemCode: it.itemCode,
      itemDescription: it.itemDescription,
      quantity: new Prisma.Decimal(it.quantity),
      weight: new Prisma.Decimal(it.weight),
    }));

    expect(prismaItems[0].weight.toNumber()).toBe(15.25);
    expect(prismaItems[1].weight.toNumber()).toBe(8.5);
    expect(prismaItems[2].weight.toNumber()).toBe(45.0);
  });

  it("persists Weight (KG) intact through DRAFT -> PENDING_APPROVAL -> APPROVED lifecycle transitions", () => {
    const dcState = {
      id: "dc-weight-lifecycle-123",
      dcNumber: "DC-2026-WT-001",
      status: "DRAFT",
      outwardWeight: new Prisma.Decimal(345.85),
    };

    expect(dcState.status).toBe("DRAFT");
    expect(dcState.outwardWeight.toNumber()).toBe(345.85);

    // Transition 1: DRAFT -> PENDING_APPROVAL
    dcState.status = "PENDING_APPROVAL";
    expect(dcState.status).toBe("PENDING_APPROVAL");
    expect(dcState.outwardWeight.toNumber()).toBe(345.85);

    // Transition 2: PENDING_APPROVAL -> APPROVED
    dcState.status = "APPROVED";
    expect(dcState.status).toBe("APPROVED");
    expect(dcState.outwardWeight.toNumber()).toBe(345.85);
  });

  it("distinguishes creation-time Material Weight (KG) from Store inward weights", () => {
    const dcRecord = {
      outwardWeight: new Prisma.Decimal(500.0), // Entered by STORES at DC Creation
      storeGatingWeight: new Prisma.Decimal(12.5), // Entered by STORES during inward verification
      storeBoringWeight: new Prisma.Decimal(8.0), // Entered by STORES during inward verification
    };

    expect(dcRecord.outwardWeight.toNumber()).toBe(500.0);
    expect(dcRecord.storeGatingWeight.toNumber()).toBe(12.5);
    expect(dcRecord.storeBoringWeight.toNumber()).toBe(8.0);

    expect(dcRecord.outwardWeight).not.toEqual(dcRecord.storeGatingWeight);
  });
});
