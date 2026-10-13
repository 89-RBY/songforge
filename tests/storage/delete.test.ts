import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DeleteObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { LocalAudioStorage } from "@/server/storage/local";
import { S3AudioStorage } from "@/server/storage/s3";

let root: string;

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "songforge-delete-"));
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("delete", () => {
  it("removes a local file and does not fail when it is already gone", async () => {
    const storage = new LocalAudioStorage(root);
    await storage.put("songs/to-delete.mp3", new Uint8Array([1]));

    await storage.delete("songs/to-delete.mp3");
    await expect(stat(path.join(root, "songs/to-delete.mp3"))).rejects.toThrow();

    await expect(storage.delete("songs/never-existed.mp3")).resolves.toBeUndefined();
  });

  it("sends a DeleteObject request to the bucket for S3 storage", async () => {
    const sent: Array<{ input: Record<string, unknown> }> = [];
    const client = {
      send: async (command: { input: Record<string, unknown> }) => {
        sent.push(command);
        return {};
      },
    };
    await new S3AudioStorage(client as unknown as Pick<S3Client, "send">, "songs-bucket").delete("songs/s3-9.wav");
    expect(sent[0].input).toEqual({ Bucket: "songs-bucket", Key: "songs/s3-9.wav" });
    expect(DeleteObjectCommand).toBeDefined();
  });

  it("refuses an invalid key before touching storage", async () => {
    await expect(new LocalAudioStorage(root).delete("../outside.mp3")).rejects.toThrow();
  });
});
