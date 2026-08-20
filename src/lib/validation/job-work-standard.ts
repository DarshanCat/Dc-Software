import { z } from "zod";

export const jobWorkStandardSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  processId: z.string().min(1, "Process is required"),
  calculationType: z.enum(["FIXED", "PERCENTAGE", "INPUT_MINUS_OUTPUT", "MANUAL"]).default("PERCENTAGE"),
  inputUOM: z.string().min(1).max(10).default("KG"),
  inputWeight: z.coerce.number().positive("Reference input weight must be > 0"),
  expectedOutputWeight: z.coerce.number().min(0).default(0),
  expectedScrapWeight: z.coerce.number().min(0).default(0),
  expectedScrapPercentage: z.coerce.number().min(0).max(100).optional(),
  allowedProcessLoss: z.coerce.number().min(0).default(0),
  allowedProcessLossPercentage: z.coerce.number().min(0).max(100).optional(),
  tolerancePercentage: z.coerce.number().min(0).max(100).default(0),
  effectiveFrom: z.string().min(1, "Effective-from date is required"),
  effectiveTo: z.string().optional(),
});

export type JobWorkStandardInput = z.infer<typeof jobWorkStandardSchema>;