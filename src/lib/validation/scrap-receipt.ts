import { z } from "zod";

const scrapLineSchema = z.object({
  scrapTypeId: z.string().min(1),
  weight: z.coerce.number().positive("Weight must be > 0"),
  quantity: z.coerce.number().min(0).optional(),
  uom: z.string().max(10).default("KG"),
  batchReference: z.string().max(60).optional().or(z.literal("")),
  documentReference: z.string().max(120).optional().or(z.literal("")),
  remarks: z.string().max(500).optional().or(z.literal("")),
});

export const scrapReceiptSchema = z.object({
  dcId: z.string().min(1),
  weighmentSlipNumber: z.string().max(60).optional().or(z.literal("")),
  remarks: z.string().max(500).optional().or(z.literal("")),
  lines: z.array(scrapLineSchema).min(1, "At least one scrap line is required"),
});

export type ScrapReceiptInput = z.infer<typeof scrapReceiptSchema>;
export type ScrapReceiptLineInput = z.infer<typeof scrapLineSchema>;