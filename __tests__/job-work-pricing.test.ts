import { describe, it, expect } from "vitest";

describe("Job Work Pricing Auto-Match and Amount Calculation", () => {
  const samplePricings = [
    {
      id: "1",
      vendorId: "v-steel",
      processId: "p-cut",
      partNumber: "ADN2",
      uom: "NO",
      rate: 600,
    },
    {
      id: "2",
      vendorId: "v-steel",
      processId: "p-cut",
      partNumber: "REJECTION CUTTING",
      uom: "KGS",
      rate: 8,
    },
    {
      id: "3",
      vendorId: "v-shine",
      processId: "p-anneal",
      partNumber: "ALL PARTS",
      uom: "KG",
      rate: 7.5,
    },
    {
      id: "4",
      vendorId: "v-ns",
      processId: "p-zinc",
      partNumber: "HIN21",
      uom: "KG",
      rate: 55,
    },
  ];

  function matchPricing(vendorId: string, processId: string, partNumber: string) {
    const cleanPart = partNumber.trim().toUpperCase();
    // 1. Exact match
    let match = samplePricings.find(
      (p) =>
        p.vendorId === vendorId &&
        p.processId === processId &&
        cleanPart &&
        p.partNumber.trim().toUpperCase() === cleanPart
    );
    // 2. Wildcard match
    if (!match) {
      match = samplePricings.find(
        (p) =>
          p.vendorId === vendorId &&
          p.processId === processId &&
          p.partNumber.toUpperCase().includes("ALL")
      );
    }
    return match;
  }

  function calculateAmount(pricingUom: string, rate: number, weightKg: number, qtyNos: number) {
    const isKg = pricingUom === "KG" || pricingUom === "KGS";
    const usedQty = isKg ? weightKg : qtyNos;
    return Number((usedQty * rate).toFixed(2));
  }

  it("accurately matches exact vendor + process + part number for piece pricing", () => {
    const matched = matchPricing("v-steel", "p-cut", "ADN2");
    expect(matched).toBeDefined();
    expect(matched?.rate).toBe(600);
    expect(matched?.uom).toBe("NO");

    const amount = calculateAmount(matched!.uom, matched!.rate, 120, 5);
    expect(amount).toBe(3000); // 5 NOS * 600
  });

  it("accurately matches exact vendor + process + part number for KG pricing", () => {
    const matched = matchPricing("v-ns", "p-zinc", "HIN21");
    expect(matched).toBeDefined();
    expect(matched?.rate).toBe(55);
    expect(matched?.uom).toBe("KG");

    const amount = calculateAmount(matched!.uom, matched!.rate, 100, 10);
    expect(amount).toBe(5500); // 100 KG * 55
  });

  it("accurately falls back to ALL PARTS wildcard for annealing", () => {
    const matched = matchPricing("v-shine", "p-anneal", "CUSTOM_PART_999");
    expect(matched).toBeDefined();
    expect(matched?.rate).toBe(7.5);
    expect(matched?.uom).toBe("KG");

    const amount = calculateAmount(matched!.uom, matched!.rate, 200, 25);
    expect(amount).toBe(1500); // 200 KG * 7.5
  });

  it("returns undefined when vendor or process does not have a matching rule", () => {
    const matched = matchPricing("v-other", "p-cut", "ADN2");
    expect(matched).toBeUndefined();
  });
});
