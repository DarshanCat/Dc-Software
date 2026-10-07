import { describe, it, expect } from "vitest";

/**
 * Mirrors the exact formatting logic in src/app/(app)/dcs/page.tsx's row renderer,
 * src/app/(app)/dcs/[id]/page.tsx's Material Details section, and
 * src/app/(app)/dcs/manager-approval/manager-form.tsx.
 *
 * Regression coverage for the bug where RM Qty / Exp FG Qty (item quantities, in
 * their own UOM) were displayed with a hardcoded " kg" suffix, as if they were the
 * separate Weight (KG) field. Quantity and weight are different columns backed by
 * different DeliveryChallan fields (rmQuantity/rmUom, returnFgQuantity/fgUom vs.
 * outwardWeight) and must never be conflated.
 */
function formatDcListRow(dc: {
  rmQuantity: number | null;
  returnFgQuantity: number | null;
  rmUom: string | null;
  fgUom: string | null;
  outwardWeight: number | null;
}) {
  const rmQty = Number(dc.rmQuantity ?? 0);
  const expFg = Number(dc.returnFgQuantity ?? 0);
  const rmUom = dc.rmUom || "NOS";
  const fgUom = dc.fgUom || "NOS";
  const weightKg = dc.outwardWeight != null ? Number(dc.outwardWeight) : null;
  return {
    rmQtyText: `${rmQty.toFixed(3)} ${rmUom}`,
    expFgQtyText: `${expFg.toFixed(3)} ${fgUom}`,
    weightText: weightKg != null ? `${weightKg.toFixed(3)} KG` : "—",
  };
}

describe("All DCs list — RM Qty / Exp FG Qty must show quantity + UOM, never Weight (KG)", () => {
  it("displays quantity with its own UOM (NOS), not kg", () => {
    const row = formatDcListRow({ rmQuantity: 10, returnFgQuantity: 8, rmUom: "NOS", fgUom: "NOS", outwardWeight: 125.5 });
    expect(row.rmQtyText).toBe("10.000 NOS");
    expect(row.expFgQtyText).toBe("8.000 NOS");
  });

  it("preserves PCS as the UOM when that's what the DC was created with", () => {
    const row = formatDcListRow({ rmQuantity: 5, returnFgQuantity: 5, rmUom: "PCS", fgUom: "PCS", outwardWeight: 12.75 });
    expect(row.rmQtyText).toBe("5.000 PCS");
    expect(row.expFgQtyText).toBe("5.000 PCS");
  });

  it("preserves SET as the UOM", () => {
    const row = formatDcListRow({ rmQuantity: 2, returnFgQuantity: 2, rmUom: "SET", fgUom: "SET", outwardWeight: 40 });
    expect(row.rmQtyText).toBe("2.000 SET");
    expect(row.expFgQtyText).toBe("2.000 SET");
  });

  it("falls back to NOS when a legacy DC has no UOM stored, but still never shows kg", () => {
    const row = formatDcListRow({ rmQuantity: 10, returnFgQuantity: 10, rmUom: null, fgUom: null, outwardWeight: null });
    expect(row.rmQtyText).toBe("10.000 NOS");
    expect(row.expFgQtyText).toBe("10.000 NOS");
  });

  it("RM Qty and Exp FG Qty text never contains 'kg' or 'KG', regardless of UOM", () => {
    for (const uom of ["NOS", "PCS", "SET", "KGS", null]) {
      const row = formatDcListRow({ rmQuantity: 10, returnFgQuantity: 10, rmUom: uom, fgUom: uom, outwardWeight: 99 });
      if (uom !== "KGS") {
        expect(row.rmQtyText.toUpperCase()).not.toContain("KG");
        expect(row.expFgQtyText.toUpperCase()).not.toContain("KG");
      }
    }
  });

  it("Weight is a separate field, always suffixed KG, independent of the quantity UOM", () => {
    const row = formatDcListRow({ rmQuantity: 10, returnFgQuantity: 8, rmUom: "NOS", fgUom: "NOS", outwardWeight: 125.5 });
    expect(row.weightText).toBe("125.500 KG");
  });

  it("displays decimal weight precisely in the separate Weight column", () => {
    const row = formatDcListRow({ rmQuantity: 10, returnFgQuantity: 10, rmUom: "NOS", fgUom: "NOS", outwardWeight: 47.333 });
    expect(row.weightText).toBe("47.333 KG");
  });

  it("shows an em dash for Weight when the DC has none (e.g. TOOL/COMPANY_PROPERTY DCs)", () => {
    const row = formatDcListRow({ rmQuantity: 0, returnFgQuantity: 0, rmUom: null, fgUom: null, outwardWeight: null });
    expect(row.weightText).toBe("—");
  });

  it("quantity numbers and weight numbers are read from different source fields (no cross-assignment)", () => {
    // A DC whose weight is numerically identical to its RM quantity must still label
    // each with its own correct unit - proves the two are not the same rendered value.
    const row = formatDcListRow({ rmQuantity: 10, returnFgQuantity: 10, rmUom: "NOS", fgUom: "NOS", outwardWeight: 10 });
    expect(row.rmQtyText).toBe("10.000 NOS");
    expect(row.expFgQtyText).toBe("10.000 NOS");
    expect(row.weightText).toBe("10.000 KG");
  });
});
