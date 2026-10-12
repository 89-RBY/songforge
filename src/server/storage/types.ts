export type StoredAudio = { data: Uint8Array; mimeType: string };

export interface AudioStorage {
  put(key: string, data: Uint8Array): Promise<void>;
  get(key: string): Promise<StoredAudio | null>;
}

const MIME_BY_EXTENSION: Record<string, string> = { mp3: "audio/mpeg", wav: "audio/wav" };
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9/_-]*\.(mp3|wav)$/;

// Keys look like "songs/<id>.mp3". Only this shape is accepted, so no key can escape the storage root.
export function assertValidKey(key: string): void {
  if (!KEY_PATTERN.test(key) || key.includes("..")) {
    throw new Error(`Chiave di storage non valida: ${key}`);
  }
}

export function mimeTypeForKey(key: string): string {
  const extension = key.slice(key.lastIndexOf(".") + 1);
  const mimeType = MIME_BY_EXTENSION[extension];
  if (!mimeType) throw new Error(`Estensione non supportata: ${extension}`);
  return mimeType;
}

export function extensionForMimeType(mimeType: string): "mp3" | "wav" {
  if (mimeType === "audio/mpeg" || mimeType === "audio/mp3") return "mp3";
  if (mimeType === "audio/wav" || mimeType === "audio/x-wav" || mimeType === "audio/wave") return "wav";
  throw new Error(`Formato audio non supportato: ${mimeType}`);
}
