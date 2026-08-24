import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ProductionSafetyStorageDriver } from "../src/services/storage";
import { sanitizeFileName, validateUpload } from "../src/lib/validation/document";

describe("Production Storage Safety & Validation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws a configuration error in production when BLOB_READ_WRITE_TOKEN is missing", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.BLOB_READ_WRITE_TOKEN;

    const driver = new ProductionSafetyStorageDriver();
    const dummyBuffer = Buffer.from("test document content");

    await expect(driver.save(dummyBuffer, "test.pdf")).rejects.toThrow(
      "Cloud storage token (BLOB_READ_WRITE_TOKEN) is missing in production environment"
    );
  });

  it("selects VercelBlobStorageDriver when BLOB_READ_WRITE_TOKEN is present", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.BLOB_READ_WRITE_TOKEN = "test_blob_token_123";

    const driver = new ProductionSafetyStorageDriver();
    // Access internal getDriver method to verify driver selection
    const internalDriver = (driver as unknown as { getDriver(): { constructor: { name: string } } }).getDriver();
    expect(internalDriver.constructor.name).toBe("VercelBlobStorageDriver");
  });

  it("selects LocalStorageDriver in development mode when BLOB_READ_WRITE_TOKEN is absent", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    delete process.env.BLOB_READ_WRITE_TOKEN;

    const driver = new ProductionSafetyStorageDriver();
    const internalDriver = (driver as unknown as { getDriver(): { constructor: { name: string } } }).getDriver();
    expect(internalDriver.constructor.name).toBe("LocalStorageDriver");
  });

  it("sanitizes filenames stripping path traversal and illegal characters", () => {
    expect(sanitizeFileName("../../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\Windows\\System32\\test.pdf")).toBe("test.pdf");
    expect(sanitizeFileName("my<file>:name?.pdf")).toBe("my_file_name_.pdf");
    expect(sanitizeFileName(".hidden_file.pdf")).toBe("hidden_file.pdf");
  });

  it("validates file signatures and rejects unsupported file types", () => {
    const pdfBuffer = Buffer.from("%PDF-1.4 header content");
    const valid = validateUpload(pdfBuffer, "document.pdf");
    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.type).toBe("pdf");
      expect(valid.sanitizedName).toBe("document.pdf");
    }

    const invalidBuffer = Buffer.from("random text content");
    const invalid = validateUpload(invalidBuffer, "malicious.exe");
    expect(invalid.ok).toBe(false);
  });
});
