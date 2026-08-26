import { z } from "zod";

export const requestAmendmentSchema = z.object({
  dcId: z.string().min(1),
  newQuantity: z.coerce.number().positive("Quantity must be > 0"),
  newWeight: z.coerce.number().positive("Weight must be > 0"),
  reason: z.string().min(10, "Explain why this correction is needed (at least 10 characters)"),
});

export type RequestAmendmentInput = z.infer<typeof requestAmendmentSchema>;