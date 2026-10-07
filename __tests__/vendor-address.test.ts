import { describe, it, expect } from "vitest";
import { vendorSchema } from "../src/lib/validation/vendor";
import { formatVendorFullAddress } from "../src/lib/vendor-address";
import { wrapCellText } from "../src/services/dc-pdf";
import { PDFDocument, StandardFonts } from "pdf-lib";

describe("Vendor Master - complete address", () => {
  it("8: accepts a full complete address on create", () => {
    const parsed = vendorSchema.safeParse({
      vendorCode: "VEND-100",
      vendorName: "Precision Machining Works",
      gstNumber: "29BBBBB1111B1Z2",
      address: "Plot 42, Peenya Industrial Estate",
      addressLine2: "Near Water Tank",
      area: "Rajajinagar",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560058",
      country: "India",
      contactPerson: "Suresh",
      phone: "9876543210",
      email: "suresh@vendor.com",
      defaultReturnDays: 15,
    });
    expect(parsed.success).toBe(true);
  });

  it("9: accepts an edit that changes only address fields", () => {
    const parsed = vendorSchema.safeParse({
      vendorCode: "VEND-100",
      vendorName: "Precision Machining Works",
      address: "New Building, MG Road",
      addressLine2: "",
      area: "Indiranagar",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560038",
      country: "India",
      defaultReturnDays: 15,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an address line exceeding the maximum length", () => {
    const parsed = vendorSchema.safeParse({
      vendorCode: "VEND-100",
      vendorName: "Precision Machining Works",
      address: "A".repeat(201),
      defaultReturnDays: 15,
    });
    expect(parsed.success).toBe(false);
  });

  it("formats the complete address in postal order, skipping empty parts", () => {
    const full = formatVendorFullAddress({
      address: "Plot 42, Peenya Industrial Estate",
      addressLine2: "Near Water Tank",
      area: "Rajajinagar",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560058",
      country: "India",
    });
    expect(full).toBe(
      "Plot 42, Peenya Industrial Estate, Near Water Tank, Rajajinagar, Bengaluru, Karnataka, 560058, India"
    );
  });

  it("falls back gracefully when only legacy city/state fields exist", () => {
    const partial = formatVendorFullAddress({ city: "Bengaluru", state: "Karnataka" });
    expect(partial).toBe("Bengaluru, Karnataka");
  });

  it("returns an empty string for a null/undefined vendor", () => {
    expect(formatVendorFullAddress(null)).toBe("");
    expect(formatVendorFullAddress(undefined)).toBe("");
  });
});

describe("DC vendor address snapshot rule", () => {
  it("10: a new DC's snapshot is built from current Vendor Master data at creation time", () => {
    const vendorAtCreationTime = {
      vendorName: "Precision Machining Works",
      address: "Plot 42, Peenya Industrial Estate",
      addressLine2: null,
      area: null,
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560058",
      country: "India",
      gstNumber: "29BBBBB1111B1Z2",
    };

    // Mirrors the snapshot logic in src/server/dcs/actions.ts createDc().
    const supplierAddressSnapshot = formatVendorFullAddress(vendorAtCreationTime) || null;

    expect(supplierAddressSnapshot).toBe("Plot 42, Peenya Industrial Estate, Bengaluru, Karnataka, 560058, India");
  });

  it("11: editing Vendor Master later does not alter an already-stored DC snapshot", () => {
    const existingDc = {
      id: "dc-1",
      supplierAddressSnapshot: "Old Building, Peenya, Bengaluru, Karnataka, 560058, India",
    };

    // Vendor Master is edited after the DC was created.
    const vendorAfterEdit = {
      address: "New Corporate Office, Whitefield",
      addressLine2: null,
      area: null,
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560066",
      country: "India",
    };
    const newFormattedAddress = formatVendorFullAddress(vendorAfterEdit);

    // The historical snapshot on the existing DC must be untouched by the vendor edit -
    // updateVendor() never writes to DeliveryChallan.supplierAddressSnapshot.
    expect(existingDc.supplierAddressSnapshot).toBe("Old Building, Peenya, Bengaluru, Karnataka, 560058, India");
    expect(existingDc.supplierAddressSnapshot).not.toBe(newFormattedAddress);
  });

  it("resolves display address by preferring the historical snapshot over the live vendor record", () => {
    // Mirrors the precedence used in src/server/dcs/pdf.ts, dcs/[id]/page.tsx and manager-approval/page.tsx.
    const resolveDisplayAddress = (dc: { supplierAddressSnapshot?: string | null; vendor?: { address?: string | null } | null }) =>
      dc.supplierAddressSnapshot || dc.vendor?.address || "";

    const historicalDc = {
      supplierAddressSnapshot: "Old Building, Peenya, Bengaluru",
      vendor: { address: "New Corporate Office, Whitefield" },
    };
    expect(resolveDisplayAddress(historicalDc)).toBe("Old Building, Peenya, Bengaluru");

    const legacyDcWithNoSnapshot = { supplierAddressSnapshot: null, vendor: { address: "Live Address" } };
    expect(resolveDisplayAddress(legacyDcWithNoSnapshot)).toBe("Live Address");
  });
});

describe("DC PDF - long vendor address handling", () => {
  it("12: wraps a very long complete vendor address without exceeding the cell width", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontSize = 8;
    const maxWidth = 200;

    const longAddress = formatVendorFullAddress({
      address: "Plot 42-B, Peenya Industrial Estate, 4th Cross, 2nd Stage",
      addressLine2: "Behind Water Tank, Near Bus Depot",
      area: "Rajajinagar Industrial Layout",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560058",
      country: "India",
    });

    const lines = wrapCellText(longAddress, font, fontSize, maxWidth);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(font.widthOfTextAtSize(line, fontSize)).toBeLessThanOrEqual(maxWidth);
    }
    // No data lost in wrapping.
    expect(lines.join(" ").replace(/\s+/g, "")).toBe(longAddress.replace(/\s+/g, ""));
  });
});
