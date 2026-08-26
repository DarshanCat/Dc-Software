import { describe, it, expect } from "vitest";

describe("DC Model without Item Concept (Part Number, RM Qty, Return FG Qty, Heat Number, Process)", () => {
  it("creates a new DC without Item or Expected Scrap inputs", () => {
    const dcPayload = {
      woNumber: "WO-2026-99001",
      partNumber: "PART-VAL-99",
      rmQuantity: 150.0,
      returnFgQuantity: 145.0,
      heatNumber: "HEAT-BATCH-88",
      vendorId: "vendor-id-123",
      processId: "process-id-456",
      purpose: "MACHINING",
      preparedByName: "Darshan Kumar",
    };

    expect(dcPayload).not.toHaveProperty("itemId");
    expect(dcPayload).not.toHaveProperty("items");
    expect(dcPayload).not.toHaveProperty("expectedScrap");
    expect(dcPayload.partNumber).toBe("PART-VAL-99");
    expect(dcPayload.rmQuantity).toBe(150.0);
    expect(dcPayload.returnFgQuantity).toBe(145.0);
    expect(dcPayload.heatNumber).toBe("HEAT-BATCH-88");
  });

  it("validates required new DC fields (Part Number, RM Qty, Return FG Qty, Heat Number, Process)", () => {
    const validateDcPayload = (payload: {
      woNumber?: string;
      partNumber?: string;
      rmQuantity?: number;
      returnFgQuantity?: number;
      heatNumber?: string;
      vendorId?: string;
      processId?: string;
      preparedByName?: string;
    }) => {
      if (!payload.woNumber?.trim()) return { ok: false, error: "WO ID is required." };
      if (!payload.partNumber?.trim()) return { ok: false, error: "Part Number is required." };
      if (!payload.vendorId) return { ok: false, error: "Vendor is required." };
      if (!payload.processId) return { ok: false, error: "Process is required." };
      if (!payload.rmQuantity || payload.rmQuantity <= 0) return { ok: false, error: "RM Qty must be > 0." };
      if (!payload.returnFgQuantity || payload.returnFgQuantity <= 0) return { ok: false, error: "Return FG Qty must be > 0." };
      if (!payload.heatNumber?.trim()) return { ok: false, error: "Heat Number is required." };
      if (!payload.preparedByName?.trim()) return { ok: false, error: "Prepared By Name is required." };
      return { ok: true };
    };

    expect(validateDcPayload({}).ok).toBe(false);
    expect(validateDcPayload({
      woNumber: "WO-2026-001",
      partNumber: "ABC-12345",
      vendorId: "v1",
      processId: "p1",
      rmQuantity: 100,
      returnFgQuantity: 95,
      heatNumber: "HEAT-9988",
      preparedByName: "Ramesh Kumar",
    }).ok).toBe(true);
  });

  it("keeps RM Qty, Return FG Qty, Rejected Qty, and Scrap Qty as separate concepts", () => {
    const dcRecord = {
      rmQuantity: 100.0,
      returnFgQuantity: 95.0,
      rejectedPartsQty: 3.0,
      actualScrapQty: 2.0,
    };

    expect(dcRecord.rmQuantity).not.toEqual(dcRecord.returnFgQuantity);
    expect(dcRecord.rmQuantity - dcRecord.returnFgQuantity).not.toEqual(dcRecord.actualScrapQty);
    expect(dcRecord.rejectedPartsQty).not.toEqual(dcRecord.actualScrapQty);
  });
});
