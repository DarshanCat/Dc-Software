import { promises as fs } from "fs";
import path from "path";
import { randomBytes } from "crypto";

export interface StorageDriver {
  save(data: Buffer, suggestedName: string): Promise<string>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

class LocalStorageDriver implements StorageDriver {
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

export const storage: StorageDriver = new LocalStorageDriver();