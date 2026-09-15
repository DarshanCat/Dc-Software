import { z } from "zod";

// Shared numeric/string guards for DC transition payloads.
// The core goal is fail-closed: NaN, ±Infinity, or unparseable dates must
// NEVER reach `new Prisma.Decimal(...)` / `new Date(...)` inside actions.

const MAX_QUANTITY = 1_000_000_000;
const MAX_TEXT = 500;

export const positiveQuantity = (message: string) =>
  z
    .number({ invalid_type_error: message })
    .finite(message)
    .min(0, message)
    .max(MAX_QUANTITY, message)
    .refine((n) => n > 0, { message });

export const nonNegativeQuantity = (message: string) =>
  z.number({ invalid_type_error: message }).finite(message).min(0, message).max(MAX_QUANTITY, message);

export const optionalFiniteNumber = (message: string) =>
  z.number({ invalid_type_error: message }).finite(message).max(1e12, message).nullable().optional();

export const optionalText = (message: string, max = MAX_TEXT) =>
  z.string({ invalid_type_error: message }).max(max, message).nullable().optional();

export const optionalDate = (message: string) =>
  z
    .union([
      z.literal(""),
      z.string().refine((s) => !Number.isNaN(Date.parse(s)), { message }),
    ])
    .nullable()
    .optional();

export const requiredDate = (message: string) =>
  z
    .string({ required_error: message, invalid_type_error: message })
    .refine((s) => s.trim().length > 0 && !Number.isNaN(Date.parse(s)), { message });

export const securityDispatchSchema = z.object({
  dispatchQuantity: positiveQuantity("Dispatch quantity must be greater than zero."),
  dispatchDate: optionalDate("Dispatch date is invalid."),
  dispatchTime: optionalText("Dispatch time is invalid.", 50),
  vehicleNumber: optionalText("Vehicle number is invalid.", 50),
  transporter: optionalText("Transporter is invalid.", 120),
  remarks: optionalText("Remarks are invalid."),
});

export const securityReturnSchema = z.object({
  actualInwardQty: positiveQuantity("Actual Inward Quantity must be greater than zero."),
  inwardDate: optionalDate("Inward date is invalid."),
  inwardDocumentNo: optionalText("Inward document number is invalid.", 100),
  invoiceNumber: optionalText("Invoice number is invalid.", 100),
  vehicleNumber: optionalText("Vehicle number is invalid.", 50),
  transporter: optionalText("Transporter is invalid.", 120),
  remarks: optionalText("Remarks are invalid."),
});

export const storeVerificationSchema = z.object({
  storeReceivedQty: positiveQuantity("Store Received Quantity must be greater than zero."),
  storeReceivedDate: optionalDate("Store Received Date is invalid."),
  storeGatingWeight: optionalFiniteNumber("Store Gating Weight must be a valid number."),
  storeBoringWeight: optionalFiniteNumber("Store Boring Weight must be a valid number."),
  storeRemarks: optionalText("Store remarks are invalid."),
});

export const custodianVerificationSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1, "Item id is required."),
        returnedQuantity: nonNegativeQuantity("Returned quantity must be a valid number."),
        conditionIn: optionalText("Condition is invalid.", 120),
      }),
    )
    .optional(),
  remarks: optionalText("Remarks are invalid."),
});

export const accountsPaymentEntrySchema = z.object({
  invoiceNumber: optionalText("Invoice Number is invalid.", 100),
  invoiceDate: optionalDate("Invoice Date is invalid."),
  invoiceAmount: optionalFiniteNumber("Invoice Amount must be a valid number.").refine(
    (n) => n === undefined || n === null || n > 0,
    { message: "Invoice Amount must be a valid number greater than zero." },
  ),
  paymentReferenceNumber: optionalText("Payment Reference Number is invalid.", 120),
  paymentDate: optionalDate("Payment Date is invalid."),
  paymentRemarks: optionalText("Payment remarks are invalid."),
});

export const transportDetailsSchema = z.object({
  vehicleNumber: optionalText("Vehicle number is invalid.", 50),
  transporter: optionalText("Transporter is invalid.", 120),
  ewayBillNumber: optionalText("E-Way Bill number is invalid.", 100),
  eSugamNumber: optionalText("E-Sugam number is invalid.", 100),
});

export const inwardReceiptSchema = z.object({
  actualInwardQty: positiveQuantity("Actual Inward Quantity must be greater than zero."),
  inwardDate: optionalDate("Inward date is invalid."),
  inwardDocumentNo: optionalText("Inward document number is invalid.", 100),
  invoiceNumber: optionalText("Invoice number is invalid.", 100),
  inwardGatingWeight: optionalFiniteNumber("Inward Gating Weight must be a valid number."),
  inwardBoringWeight: optionalFiniteNumber("Inward Boring Weight must be a valid number."),
  remarks: optionalText("Remarks are invalid."),
});

export const storeReceiptConfirmSchema = z.object({
  storeReceivedQty: positiveQuantity("Store Received Quantity must be greater than zero."),
  storeReceivedDate: optionalDate("Store Received Date is invalid."),
  storeGatingWeight: optionalFiniteNumber("Store Gating Weight must be a valid number."),
  storeBoringWeight: optionalFiniteNumber("Store Boring Weight must be a valid number."),
  storeRemarks: optionalText("Store remarks are invalid."),
});

export const qualityInspectionSchema = z.object({
  goodQty: nonNegativeQuantity("Quality quantities (Good, Rejection, Scrap) cannot be negative."),
  rejectionQty: nonNegativeQuantity("Quality quantities (Good, Rejection, Scrap) cannot be negative."),
  scrapQty: nonNegativeQuantity("Quality quantities (Good, Rejection, Scrap) cannot be negative."),
  qualityDecision: z.enum(["PASSED", "PARTIAL_ACCEPTANCE", "REJECTED", "SCRAPPED"], {
    errorMap: () => ({ message: "Invalid quality decision." }),
  }),
  inspectionRemarks: optionalText("Inspection remarks are invalid."),
});

export const outwardDcSchema = z.object({
  movementType: z.enum(["MATERIAL", "TOOL", "COMPANY_PROPERTY"]).nullable().optional(),
  isCommercialService: z.boolean().nullable().optional(),
  destinationDepartment: optionalText("Destination department is invalid.", 120),
  responsibleCustodian: optionalText("Responsible custodian is invalid.", 120),
  vendorId: z.string().min(1, "Supplier (Vendor) is mandatory.").optional(),
  department: optionalText("Department is invalid.", 120),
  woNumber: optionalText("Work Order number is invalid.", 100),
  partNumber: optionalText("Part number is invalid.", 100),
  partDescription: optionalText("Part description is invalid."),
  pricingBasis: z.enum(["RW", "FG"]).nullable().optional(),
  ratePerQuantity: optionalFiniteNumber("Rate Per Quantity must be a valid number.").refine(
    (n) => n === undefined || n === null || n > 0,
    { message: "Rate Per Quantity must be greater than zero." },
  ),
  outwardWeight: optionalFiniteNumber("Outward Weight must be a valid number."),
  outwardGatingWeight: optionalFiniteNumber("Outward Gating Weight must be a valid number."),
  outwardQtyRw: optionalFiniteNumber("Outward Qty (RW) must be a valid number.").refine(
    (n) => n === undefined || n === null || n > 0,
    { message: "Outward Qty RW must be greater than zero when Price Based On is RW Quantity." },
  ),
  returningFgQuantity: optionalFiniteNumber("Returning FG Qty must be a valid number.").refine(
    (n) => n === undefined || n === null || n > 0,
    { message: "Returning FG Qty must be greater than zero when Price Based On is Returning FG Quantity." },
  ),
  rmUom: optionalText("RM UOM is invalid.", 20),
  fgUom: optionalText("FG UOM is invalid.", 20),
  dimensionUom: optionalText("Dimension UOM is invalid.", 20),
  length: optionalFiniteNumber("Length must be a valid number."),
  width: optionalFiniteNumber("Width must be a valid number."),
  height: optionalFiniteNumber("Height must be a valid number."),
  outwardBoringWeight: optionalFiniteNumber("Outward Boring Weight must be a valid number."),
  remarks: optionalText("Remarks are invalid."),
  purpose: optionalText("Purpose is invalid.", 40),
  submitForApproval: z.boolean().nullable().optional(),
});

export function firstIssueMessage(schema: z.ZodTypeAny, data: unknown): string | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    return result.error.issues[0]?.message ?? "Please review the submitted details.";
  }
  return null;
}