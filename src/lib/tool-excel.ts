import * as XLSX from "xlsx";

export interface ParsedToolRow {
  itemCode: string;
  itemDescription: string;
  quantity: string;
  uom: string;
  conditionIn: string;
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Parses raw JSON rows from XLSX / CSV into structured LineItemState objects.
 * Handles diverse header names and auto-normalizes conditions (e.g. "regrind" -> "REPAIR_REQUIRED").
 */
export function parseToolItemsData(data: any[]): ParsedToolRow[] {
  const parsedRows: ParsedToolRow[] = [];

  for (const rawRow of data) {
    if (!rawRow || typeof rawRow !== "object") continue;

    const row: Record<string, any> = {};
    for (const [k, v] of Object.entries(rawRow)) {
      row[normalizeKey(k)] = v;
    }

    const findVal = (keywords: string[]): string => {
      // 1. Direct match on normalized keys
      for (const kw of keywords) {
        const normKw = normalizeKey(kw);
        if (row[normKw] !== undefined && row[normKw] !== null && String(row[normKw]).trim() !== "") {
          return String(row[normKw]).trim();
        }
      }
      // 2. Substring match
      for (const [k, v] of Object.entries(row)) {
        if (v !== undefined && v !== null && String(v).trim() !== "") {
          for (const kw of keywords) {
            const normKw = normalizeKey(kw);
            if (k.includes(normKw)) {
              return String(v).trim();
            }
          }
        }
      }
      return "";
    };

    const itemCode = findVal(["itemcode", "toolcode", "code", "tag", "partnumber", "partno"]);
    const itemDescription = findVal(["description", "itemdescription", "tooldescription", "desc", "name", "toolname", "itemname"]);

    // If both empty, skip row
    if (!itemCode && !itemDescription) continue;

    const rawCondition = findVal(["condition", "currentcondition", "status"]).toUpperCase();
    let conditionIn = "GOOD";
    if (rawCondition.includes("REPAIR") || rawCondition.includes("REGRIND") || rawCondition.includes("SUB CONTRACT") || rawCondition.includes("SUBCONTRACT")) {
      conditionIn = "REPAIR_REQUIRED";
    } else if (rawCondition.includes("CALIBRAT")) {
      conditionIn = "CALIBRATION_DUE";
    } else if (rawCondition.includes("DAMAG")) {
      conditionIn = "DAMAGED";
    } else if (rawCondition.includes("SCRAP")) {
      conditionIn = "SCRAP";
    }

    const rawQty = findVal(["qty", "quantity", "quantitysent", "nos", "count"]);
    const numQty = parseFloat(rawQty);
    const quantity = !isNaN(numQty) && numQty > 0 ? String(numQty) : "1";

    const rawUom = findVal(["uom", "unit"]).toUpperCase();
    const uom = rawUom || "NOS";

    parsedRows.push({
      itemCode,
      itemDescription: itemDescription || itemCode,
      quantity,
      uom,
      conditionIn,
    });
  }

  return parsedRows;
}

/**
 * Parses an uploaded File (Excel .xlsx/.xls or .csv) in the browser into tool rows.
 */
export async function parseExcelOrCsvFile(file: File): Promise<{
  rows: ParsedToolRow[];
  totalParsed: number;
  filename: string;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          throw new Error("No sheets found in the uploaded workbook.");
        }
        const worksheet = workbook.Sheets[sheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        const rows = parseToolItemsData(rawJson);

        resolve({
          rows,
          totalParsed: rows.length,
          filename: file.name,
        });
      } catch (err: any) {
        reject(new Error(err.message || "Failed to parse spreadsheet. Please ensure it is a valid Excel or CSV file."));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read the file from disk."));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Downloads a sample Excel template for users to fill and upload.
 */
export function downloadToolItemsTemplate() {
  const sampleData = [
    {
      "Item Code / Tag": "TL-001",
      "Description": "12mm Carbide End Mill (Regrinding)",
      "Current Condition": "REPAIR_REQUIRED",
      "Qty": 10,
      "UOM": "NOS",
    },
    {
      "Item Code / Tag": "TL-002",
      "Description": "16mm Roughing Cutter (Subcontract Work)",
      "Current Condition": "REPAIR_REQUIRED",
      "Qty": 5,
      "UOM": "NOS",
    },
    {
      "Item Code / Tag": "TL-003",
      "Description": "Boring Bar Shank Assembly",
      "Current Condition": "GOOD",
      "Qty": 2,
      "UOM": "NOS",
    },
    {
      "Item Code / Tag": "TL-004",
      "Description": "Face Mill Insert Holder (Calibration)",
      "Current Condition": "CALIBRATION_DUE",
      "Qty": 4,
      "UOM": "NOS",
    },
    {
      "Item Code / Tag": "TL-005",
      "Description": "Drill Bit 8.5mm HSS",
      "Current Condition": "GOOD",
      "Qty": 15,
      "UOM": "NOS",
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);

  // Set column widths
  worksheet["!cols"] = [
    { wch: 18 }, // Item Code
    { wch: 42 }, // Description
    { wch: 22 }, // Condition
    { wch: 10 }, // Qty
    { wch: 10 }, // UOM
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Tool_Items");

  XLSX.writeFile(workbook, "tool_items_upload_template.xlsx");
}
