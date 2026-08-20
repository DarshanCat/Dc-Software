import { z } from "zod";

const receiptLineSchema = z
  .object({
    itemId: z.string().min(1),
    quantityReceived: z.coerce.number().positive("Quantity received must be > 0"),
    weightReceived: z.coerce.number().positive("Weight received must be > 0"),
    rejectedQuantity: z.coerce.number().min(0).default(0),
    rejectedWeight: z.coerce.number().min(0).default(0),
    batchNumber: z.string().max(60).optional().or(z.literal("")),
    heatNumber: z.string().max(60).optional().or(z.literal("")),
    remarks: z.string().max(500).optional().or(z.literal("")),
  })
  .refine((l) => l.rejectedQuantity <= l.quantityReceived, {
    message: "Rejected quantity cannot exceed quantity received",
    path: ["rejectedQuantity"],
  })
  .refine((l) => l.rejectedWeight <= l.weightReceived, {
    message: "Rejected weight cannot exceed weight received",
    path: ["rejectedWeight"],
  });

export const materialReceiptSchema = z.object({
  dcId: z.string().min(1),
  documentReference: z.string().max(120).optional().or(z.literal("")),
  remarks: z.string().max(500).optional().or(z.literal("")),
  lines: z.array(receiptLineSchema).min(1, "At least one item line is required"),
});

export type MaterialReceiptInput = z.infer<typeof materialReceiptSchema>;
export type MaterialReceiptLineInput = z.infer<typeof receiptLineSchema>;