import { promises as fs } from "fs";
import path from "path";
import { randomBytes } from "crypto";
import { put, del } from "@vercel/blob";

export interface StorageDriver {
  save(data: Buffer, suggestedName: string): Promise<string>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export class LocalStorageDriver implements StorageDriver {
  private readonly root = path.join(process.cwd(), ".storage-uploads");

  private async ensureRoot() {
    await fs.mkdir(this.root, { recursive: true });
  }

  async save(data: Buffer, suggestedName: string): Promise<string> {
    await this.ensureRoot();
    const ext = path.extname(suggestedName).slice(0, 10);
    const key = randomBytes(16).toString("hex") + ext;
    await fs.writeFile(path.join(this.root, key), data);
    return key;
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(path.join(this.root, key));
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(path.join(this.root, key));
    } catch {
      // Already gone — deleting a missing key is not an error for callers.
    }
  }
}

export class VercelBlobStorageDriver implements StorageDriver {
  async save(data: Buffer, suggestedName: string): Promise<string> {
    const ext = path.extname(suggestedName).slice(0, 10);
    const filename = `documents/${randomBytes(16).toString("hex")}${ext}`;
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const blob = await put(filename, data, {
      access: "public",
      token,
    });
    return blob.url;
  }

  async read(key: string): Promise<Buffer> {
    const url = key.startsWith("http") ? key : key;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch blob: ${res.statusText}`);
    }
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  }

  async delete(key: string): Promise<void> {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    try {
      await del(key, { token });
    } catch {
      // Ignore missing key deletion errors
    }
  }
}

export class ProductionSafetyStorageDriver implements StorageDriver {
  private getDriver(): StorageDriver {
    const hasBlobToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
    const isProduction = process.env.NODE_ENV === "production";

    if (hasBlobToken) {
      return new VercelBlobStorageDriver();
    }

    if (isProduction) {
      throw new Error(
        "Cloud storage token (BLOB_READ_WRITE_TOKEN) is missing in production environment. Document upload rejected."
      );
    }

    return new LocalStorageDriver();
  }

  async save(data: Buffer, suggestedName: string): Promise<string> {
    return this.getDriver().save(data, suggestedName);
  }

  async read(key: string): Promise<Buffer> {
    if (key.startsWith("http")) {
      return new VercelBlobStorageDriver().read(key);
    }
    return this.getDriver().read(key);
  }

  async delete(key: string): Promise<void> {
    if (key.startsWith("http")) {
      return new VercelBlobStorageDriver().delete(key);
    }
    return this.getDriver().delete(key);
  }
}

export const storage: StorageDriver = new ProductionSafetyStorageDriver();