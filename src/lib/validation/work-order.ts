import { z } from "zod";

export const workOrderSchema = z.object({
    woNumber: z
    .string()
    .min(1, "WO number is required")
    .max(40)
    .regex(/^[A-Za-z0-9/-]+$/, "Only letters, numbers, hyphens and slashes allowed")
    .transform((v) => v.trim().toUpperCase()),
  vendorId: z.string().min(1, "Vendor is required"),
  processId: z.string().optional(),
  requiredInputQty: z.coerce.number().positive("Required input qty must be > 0"),
  requiredInputUOM: z.string().max(10).default("NOS"),
  expectedOutputQty: z.coerce.number().positive("Expected output qty must be > 0"),
  expectedOutputUOM: z.string().max(10).default("NOS"),
  remarks: z.string().max(500).optional(),
});

export type WorkOrderInput = z.infer<typeof workOrderSchema>;