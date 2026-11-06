import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseToolItemsData } from "@/lib/tool-excel";

describe("Tool Excel Parser", () => {
  it("parses rows with standard column headers", () => {
    const rawData = [
      {
        "Item Code / Tag": "TL-001",
        "Description": "12mm Carbide End Mill (Regrinding)",
        "Current Condition": "REPAIR_REQUIRED",
        "Qty": 10,
        "UOM": "NOS",
      },
      {
        "Item Code / Tag": "TL-002",
        "Description": "16mm Roughing Cutter",
        "Current Condition": "GOOD",
        "Qty": 5,
        "UOM": "NOS",
      },
    ];

    const parsed = parseToolItemsData(rawData);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].itemCode).toBe("TL-001");
    expect(parsed[0].itemDescription).toBe("12mm Carbide End Mill (Regrinding)");
    expect(parsed[0].conditionIn).toBe("REPAIR_REQUIRED");
    expect(parsed[0].quantity).toBe("10");
    expect(parsed[1].quantity).toBe("5");
  });

  it("handles regrinding and subcontracting in condition and variations in headers", () => {
    const rawData = [
      {
        "tool_code": "MILL-45",
        "tool_description": "Custom Chamfer Tool",
        "status": "for regrinding",
        "count": 25,
      },
      {
        "itemcode": "BOR-02",
        "name": "Boring Head",
        "condition": "subcontract rework",
        "qty": 3,
      },
    ];

    const parsed = parseToolItemsData(rawData);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].itemCode).toBe("MILL-45");
    expect(parsed[0].itemDescription).toBe("Custom Chamfer Tool");
    expect(parsed[0].conditionIn).toBe("REPAIR_REQUIRED");
    expect(parsed[0].quantity).toBe("25");
    expect(parsed[0].uom).toBe("NOS");

    expect(parsed[1].conditionIn).toBe("REPAIR_REQUIRED");
  });

  it("skips completely blank rows", () => {
    const rawData = [
      {},
      { "Description": "Valid tool", "Qty": 2 },
      { "other": "" },
    ];

    const parsed = parseToolItemsData(rawData);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].itemDescription).toBe("Valid tool");
    expect(parsed[0].quantity).toBe("2");
  });

  it("generates a valid XLSX binary and parses it back", () => {
    const ws = XLSX.utils.json_to_sheet([
      { "Item Code / Tag": "TL-A", "Description": "Tool A", "Qty": 3, "UOM": "NOS", "Condition": "GOOD" },
      { "Item Code / Tag": "TL-B", "Description": "Tool B (Regrind)", "Qty": 7, "UOM": "NOS", "Condition": "REPAIR" },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tools");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // Read back
    const readWb = XLSX.read(buf, { type: "buffer" });
    const sheetName = readWb.SheetNames[0];
    const sheetJson = XLSX.utils.sheet_to_json(readWb.Sheets[sheetName]);
    const parsed = parseToolItemsData(sheetJson);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].itemCode).toBe("TL-A");
    expect(parsed[1].conditionIn).toBe("REPAIR_REQUIRED");
    expect(parsed[1].quantity).toBe("7");
  });
});
