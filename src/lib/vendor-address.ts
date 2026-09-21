export interface VendorAddressParts {
  address?: string | null;
  addressLine2?: string | null;
  area?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
}

/**
 * Builds the complete vendor address string from its parts, in postal order.
 * Used both for the DC vendor-address snapshot and for display.
 */
export function formatVendorFullAddress(vendor: VendorAddressParts | null | undefined): string {
  if (!vendor) return "";
  return [
    vendor.address,
    vendor.addressLine2,
    vendor.area,
    vendor.city,
    vendor.state,
    vendor.pincode,
    vendor.country,
  ]
    .map((part) => (part || "").trim())
    .filter(Boolean)
    .join(", ");
}
