import { z } from "zod";

export const createUserSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  name: z.string().min(1, "Name is required").max(120),
  password: z.string().min(8, "Password must be at least 8 characters"),
  roleKeys: z.array(z.string()).min(1, "Select at least one role"),
  vendorId: z.string().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;