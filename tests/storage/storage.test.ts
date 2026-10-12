import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LocalAudioStorage } from "@/server/storage/local";
import { S3AudioStorage } from "@/server/storage/s3";
import { assertValidKey, extensionForMimeType, mimeTypeForKey } from "@/server/storage/types";

let root: string;

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "songforge-storage-"));
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("storage keys", () => {
  it("accepts song keys and maps them to a MIME type", () => {
    expect(() => assertValidKey("songs/clx12ab.mp3")).not.toThrow();
    expect(mimeTypeForKey("songs/clx12ab.mp3")).toBe("audio/mpeg");
    expect(mimeTypeForKey("songs/clx12ab.wav")).toBe("audio/wav");
  });

  it("rejects paths that could escape the storage root or use other extensions", () => {
    for (const key of ["../secret.mp3", "songs/../../x.mp3", "/etc/passwd.mp3", "songs/a.txt", "songs/a"]) {
      expect(() => assertValidKey(key), key).toThrow();
    }
  });

  it("maps audio MIME types to file extensions and refuses unknown ones", () => {
    expect(extensionForMimeType("audio/mpeg")).toBe("mp3");
    expect(extensionForMimeType("audio/wav")).toBe("wav");
    expect(() => extensionForMimeType("video/mp4")).toThrow();
  });
});

describe("LocalAudioStorage", () => {
  it("stores and reads back bytes with the MIME type from the key", async () => {
    const storage = new LocalAudioStorage(root);
    await storage.put("songs/local-1.wav", new Uint8Array([1, 2, 3]));
    const stored = await storage.get("songs/local-1.wav");
    expect(stored?.mimeType).toBe("audio/wav");
    expect(Array.from(stored!.data)).toEqual([1, 2, 3]);
  });

  it("returns null for a missing file", async () => {
    expect(await new LocalAudioStorage(root).get("songs/missing.mp3")).toBeNull();
  });

  it("refuses invalid keys before touching the disk", async () => {
    await expect(new LocalAudioStorage(root).put("../escape.mp3", new Uint8Array())).rejects.toThrow();
  });
});

describe("S3AudioStorage", () => {
  type Sent = { name: string; input: Record<string, unknown> };

  function fakeClient(respond: (command: Sent) => unknown) {
    const sent: Sent[] = [];
    const client = {
      send: async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
        const entry = { name: command.constructor.name, input: command.input };
        sent.push(entry);
        return respond(entry);
      },
    };
    return { client, sent };
  }

  it("uploads with the bucket, key and content type derived from the key", async () => {
    const { client, sent } = fakeClient(() => ({}));
    await new S3AudioStorage(client as never, "songs-bucket").put("songs/s3-1.wav", new Uint8Array([9]));
    expect(sent[0].input).toMatchObject({ Bucket: "songs-bucket", Key: "songs/s3-1.wav", ContentType: "audio/wav" });
  });

  it("reads back bytes and the stored content type", async () => {
    const { client } = fakeClient(() => ({
      ContentType: "audio/mpeg",
      Body: { transformToByteArray: async () => new Uint8Array([7, 8]) },
    }));
    const stored = await new S3AudioStorage(client as never, "b").get("songs/s3-2.mp3");
    expect(stored?.mimeType).toBe("audio/mpeg");
    expect(Array.from(stored!.data)).toEqual([7, 8]);
  });

  it("returns null when the object does not exist", async () => {
    const { client } = fakeClient(() => {
      throw Object.assign(new Error("not found"), { name: "NoSuchKey" });
    });
    expect(await new S3AudioStorage(client as never, "b").get("songs/s3-3.mp3")).toBeNull();
  });

  it("propagates other errors", async () => {
    const { client } = fakeClient(() => {
      throw Object.assign(new Error("forbidden"), { name: "AccessDenied" });
    });
    await expect(new S3AudioStorage(client as never, "b").get("songs/s3-4.mp3")).rejects.toThrow("forbidden");
  });
});
