import { describe, it, expect } from "vitest";
import { passwordPolicy, changePasswordSchema } from "../src/lib/validation/user";

describe("Password Policy Validation", () => {
  it("rejects short passwords (< 8 chars)", () => {
    const result = passwordPolicy.safeParse("Ab1!");
    expect(result.success).toBe(false);
  });

  it("rejects passwords missing uppercase letters", () => {
    const result = passwordPolicy.safeParse("password123!");
    expect(result.success).toBe(false);
  });

  it("rejects passwords missing lowercase letters", () => {
    const result = passwordPolicy.safeParse("PASSWORD123!");
    expect(result.success).toBe(false);
  });

  it("rejects passwords missing numbers", () => {
    const result = passwordPolicy.safeParse("Password!");
    expect(result.success).toBe(false);
  });

  it("rejects passwords missing special characters", () => {
    const result = passwordPolicy.safeParse("Password123");
    expect(result.success).toBe(false);
  });

  it("accepts valid complex passwords meeting all requirements", () => {
    const result = passwordPolicy.safeParse("SecureP@ss123");
    expect(result.success).toBe(true);
  });
});

describe("Change Password Schema", () => {
  it("rejects mismatching confirm passwords", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "OldPassword123!",
      newPassword: "NewPassword123!",
      confirmPassword: "DifferentPassword123!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects new password equal to current password", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "SamePassword123!",
      newPassword: "SamePassword123!",
      confirmPassword: "SamePassword123!",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid change password payloads", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "OldPassword123!",
      newPassword: "NewPassword123!",
      confirmPassword: "NewPassword123!",
    });
    expect(result.success).toBe(true);
  });
});
