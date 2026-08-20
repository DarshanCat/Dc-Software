import { z } from "zod";

export const itemSchema = z.object({
  itemCode: z.string().min(1, "Item code is required").max(40),
  itemName: z.string().min(1, "Item name is required").max(200),
  materialGrade: z.string().max(60).optional().or(z.literal("")),
  drawingNumber: z.string().max(60).optional().or(z.literal("")),
  defaultUOM: z.string().max(10).default("NOS"),
  weightUOM: z.string().max(10).default("KG"),
  standardUnitWeight: z.coerce.number().min(0).optional(),
});

export type ItemInput = z.infer<typeof itemSchema>;