import { z } from "zod";

export const vendorSchema = z.object({
  vendorCode: z.string().min(1, "Vendor code is required").max(40),
  vendorName: z.string().min(1, "Vendor name is required").max(200),
  gstNumber: z.string().max(20).optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  state: z.string().max(100).optional().or(z.literal("")),
  contactPerson: z.string().max(120).optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  defaultReturnDays: z.coerce.number().int().min(0).max(365).default(15),
});

export type VendorInput = z.infer<typeof vendorSchema>;