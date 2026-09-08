import { z } from "zod";

export const ALLOWED_DEPARTMENTS = [
  "IT / Admin",
  "Management",
  "Accounts",
  "Quality",
  "Purchase",
  "Production",
] as const;

export type DepartmentOption = (typeof ALLOWED_DEPARTMENTS)[number];

export const ALLOWED_EMAIL_DOMAINS = [
  "vijayspheroidals.com",
  "vijayspheroidals.onmicrosoft.com",
] as const;

export function isAllowedCompanyEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const normalized = email.trim().toLowerCase();
  const parts = normalized.split("@");
  if (parts.length !== 2) return false;
  const domain = parts[1];
  return (ALLOWED_EMAIL_DOMAINS as readonly string[]).includes(domain);
}

export const companyEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Please enter a valid email address.")
  .refine(
    (val) => isAllowedCompanyEmail(val),
    {
      message:
        "Registration is restricted to official Vijay Spheroidals email accounts (@vijayspheroidals.com or @vijayspheroidals.onmicrosoft.com).",
    }
  );

export const createRegistrationSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters.")
    .max(100, "Full name cannot exceed 100 characters."),
  email: companyEmailSchema,
  employeeId: z
    .string()
    .trim()
    .max(50, "Employee ID cannot exceed 50 characters.")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .max(20, "Phone number cannot exceed 20 characters.")
    .optional()
    .or(z.literal("")),
  requestedDepartment: z.enum(ALLOWED_DEPARTMENTS, {
    errorMap: () => ({ message: "Please select a valid department." }),
  }),
  reason: z
    .string()
    .trim()
    .max(500, "Reason cannot exceed 500 characters.")
    .optional()
    .or(z.literal("")),
});

export type CreateRegistrationInput = z.infer<typeof createRegistrationSchema>;

export const approveRegistrationSchema = z.object({
  requestId: z.string().min(1, "Request ID is required."),
  department: z.enum(ALLOWED_DEPARTMENTS, {
    errorMap: () => ({ message: "Please select a valid department." }),
  }),
  roleKey: z.string().min(1, "Role is required."),
  approvingPersonName: z
    .string()
    .trim()
    .min(2, "Approving person's name must be at least 2 characters.")
    .optional()
    .or(z.literal("")),
});

export type ApproveRegistrationInput = z.infer<typeof approveRegistrationSchema>;

export const rejectRegistrationSchema = z.object({
  requestId: z.string().min(1, "Request ID is required."),
  rejectionReason: z
    .string()
    .trim()
    .max(500, "Rejection reason cannot exceed 500 characters.")
    .optional()
    .or(z.literal("")),
});

export type RejectRegistrationInput = z.infer<typeof rejectRegistrationSchema>;

export const completeActivationSchema = z
  .object({
    token: z.string().min(1, "Activation token is required."),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long.")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
      .regex(/[0-9]/, "Password must contain at least one number.")
      .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character (!@#$%^&*)."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type CompleteActivationInput = z.infer<typeof completeActivationSchema>;
