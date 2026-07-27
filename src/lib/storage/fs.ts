import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import path from "node:path";
import { config } from "@/lib/env";
import { newId } from "@/lib/ids";
import type { StoredFile } from "@/lib/types";

export interface StorageDriver {
  put(
    bytes: Buffer,
    options: { mimeType: string; fileName?: string; folder?: string },
  ): Promise<StoredFile>;
  get(storagePath: string): Promise<Buffer>;
  publicUrl(storagePath: string): string;
}

export class FileSystemStorage implements StorageDriver {
  constructor(private readonly rootDir = config().storage.dir) {}

  async put(
    bytes: Buffer,
    options: { mimeType: string; fileName?: string; folder?: string },
  ): Promise<StoredFile> {
    const folder = options.folder ?? "uploads";
    const ext = extensionFor(options.mimeType, options.fileName);
    const name = `${newId("file")}${ext}`;
    const relative = path.posix.join(folder, name);
    const absolute = path.join(this.rootDir, relative);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, bytes);
    return {
      path: relative,
      mimeType: options.mimeType,
      size: bytes.length,
      url: this.publicUrl(relative),
    };
  }

  async get(storagePath: string): Promise<Buffer> {
    const absolute = path.join(this.rootDir, storagePath);
    await access(absolute);
    return readFile(absolute);
  }

  publicUrl(storagePath: string): string {
    return `/api/files/${storagePath
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
  }
}

function extensionFor(mimeType: string, fileName?: string): string {
  if (fileName && fileName.includes(".")) {
    return fileName.slice(fileName.lastIndexOf("."));
  }
  switch (mimeType) {
    case "application/pdf":
      return ".pdf";
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "audio/mpeg":
      return ".mp3";
    case "audio/wav":
      return ".wav";
    case "audio/webm":
      return ".webm";
    default:
      return ".bin";
  }
}

let singleton: StorageDriver | undefined;

export function storage(): StorageDriver {
  if (!singleton) singleton = new FileSystemStorage();
  return singleton;
}

export function resetStorageForTests(driver?: StorageDriver): void {
  singleton = driver;
}
