import { describe, it, expect } from "vitest";
import {
  createRegistrationSchema,
  approveRegistrationSchema,
  rejectRegistrationSchema,
  completeActivationSchema,
  ALLOWED_DEPARTMENTS,
} from "../src/lib/validation/registration";
import { createHash } from "crypto";

describe("Registration Request Schema Validation", () => {
  it("accepts valid self-registration input", () => {
    const result = createRegistrationSchema.safeParse({
      fullName: "Rahul Sharma",
      email: "rahul@vijayspheroidals.com",
      employeeId: "EMP-102",
      phone: "+91 9876543210",
      requestedDepartment: "Production",
      reason: "Need access for material dispatch management",
    });
    expect(result.success).toBe(true);
  });

  it("trims and lowercases email address", () => {
    const result = createRegistrationSchema.safeParse({
      fullName: "Anita Kumar",
      email: "  ANITA@VIJAYSPHEROIDALS.COM  ",
      requestedDepartment: "Quality",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("anita@vijayspheroidals.com");
    }
  });

  it("rejects invalid email formats", () => {
    const result = createRegistrationSchema.safeParse({
      fullName: "Rahul Sharma",
      email: "invalid-email-format",
      requestedDepartment: "Production",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid or unapproved departments", () => {
    const result = createRegistrationSchema.safeParse({
      fullName: "Test User",
      email: "test@vijayspheroidals.com",
      requestedDepartment: "SUPER_ADMIN_DEPT",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all allowed departmental options", () => {
    for (const dept of ALLOWED_DEPARTMENTS) {
      const result = createRegistrationSchema.safeParse({
        fullName: "Valid User",
        email: "user@vijayspheroidals.com",
        requestedDepartment: dept,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("Admin Approval & Rejection Schema Validation", () => {
  it("requires valid role and department for approval, and accepts approving person's name", () => {
    const result = approveRegistrationSchema.safeParse({
      requestId: "req-123",
      department: "Production",
      roleKey: "STORES",
      approvingPersonName: "Darshan Manager",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.approvingPersonName).toBe("Darshan Manager");
    }
  });

  it("rejects approval with invalid department", () => {
    const result = approveRegistrationSchema.safeParse({
      requestId: "req-123",
      department: "InvalidDept",
      roleKey: "STORES",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid rejection reason", () => {
    const result = rejectRegistrationSchema.safeParse({
      requestId: "req-123",
      rejectionReason: "Employee record could not be verified in HR database.",
    });
    expect(result.success).toBe(true);
  });
});

describe("Account Activation & Password Setup Schema Validation", () => {
  it("accepts strong valid passwords for account activation", () => {
    const result = completeActivationSchema.safeParse({
      token: "token-1234567890",
      password: "StrongP@ssword123",
      confirmPassword: "StrongP@ssword123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects activation with weak passwords missing special chars", () => {
    const result = completeActivationSchema.safeParse({
      token: "token-1234567890",
      password: "WeakPassword123",
      confirmPassword: "WeakPassword123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects activation with mismatching confirm password", () => {
    const result = completeActivationSchema.safeParse({
      token: "token-1234567890",
      password: "StrongP@ssword123",
      confirmPassword: "DifferentP@ssword123",
    });
    expect(result.success).toBe(false);
  });

  it("verifies SHA-256 token hashing consistency", () => {
    const rawToken = "sample-secret-activation-token";
    const hash1 = createHash("sha256").update(rawToken).digest("hex");
    const hash2 = createHash("sha256").update(rawToken).digest("hex");
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });
});
