import { z } from "zod";

export const systemSettingsSchema = z.object({
  companyName: z.string().max(200).optional().or(z.literal("")),
  companyAddress: z.string().max(500).optional().or(z.literal("")),
  gstNumber: z.string().max(30).optional().or(z.literal("")),
  contactEmail: z.string().email().optional().or(z.literal("")),
  contactPhone: z.string().max(30).optional().or(z.literal("")),
  defaultCurrency: z.string().max(10).optional().or(z.literal("")),
  defaultTimezone: z.string().max(60).optional().or(z.literal("")),
  weightUnit: z.string().max(10).optional().or(z.literal("")),
  dateFormat: z.string().max(20).optional().or(z.literal("")),
  fiscalYearStartMonth: z.coerce.number().min(1).max(12).optional(),
  unaccountedTolerancePercentage: z.coerce.number().min(0).max(100).optional(),
  scrapTolerancePercentage: z.coerce.number().min(0).max(100).optional(),
  approvedProcessLossPercentage: z.coerce.number().min(0).max(100).optional(),
});

export type SystemSettingsInput = z.infer<typeof systemSettingsSchema>;

export const SETTINGS_FIELDS: { key: keyof SystemSettingsInput; label: string; group: string }[] = [
  { key: "companyName", label: "Company Name", group: "Company" },
  { key: "companyAddress", label: "Address", group: "Company" },
  { key: "gstNumber", label: "GST Number", group: "Company" },
  { key: "contactEmail", label: "Contact Email", group: "Company" },
  { key: "contactPhone", label: "Contact Phone", group: "Company" },
  { key: "defaultCurrency", label: "Default Currency", group: "Regional" },
  { key: "defaultTimezone", label: "Default Timezone", group: "Regional" },
  { key: "weightUnit", label: "Weight Unit", group: "Regional" },
  { key: "dateFormat", label: "Date Format", group: "Regional" },
  { key: "fiscalYearStartMonth", label: "Fiscal Year Start Month (1-12)", group: "Regional" },
  { key: "unaccountedTolerancePercentage", label: "Unaccounted Weight Tolerance %", group: "Reconciliation" },
  { key: "scrapTolerancePercentage", label: "Scrap Tolerance %", group: "Reconciliation" },
  { key: "approvedProcessLossPercentage", label: "Approved Process Loss %", group: "Reconciliation" },
];