import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertValidKey, mimeTypeForKey, type AudioStorage, type StoredAudio } from "./types";

// Development storage on disk. Production uses the S3-compatible adapter.
export class LocalAudioStorage implements AudioStorage {
  private readonly root: string;

  constructor(rootDir: string) {
    this.root = path.resolve(rootDir);
  }

  private fileFor(key: string): string {
    assertValidKey(key);
    const file = path.resolve(this.root, key);
    if (!file.startsWith(this.root + path.sep)) throw new Error("Chiave fuori dalla cartella di storage");
    return file;
  }

  async put(key: string, data: Uint8Array): Promise<void> {
    const file = this.fileFor(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
  }

  async get(key: string): Promise<StoredAudio | null> {
    try {
      const data = await readFile(this.fileFor(key));
      return { data: new Uint8Array(data), mimeType: mimeTypeForKey(key) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
}
