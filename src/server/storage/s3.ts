import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { assertValidKey, mimeTypeForKey, type AudioStorage, type StoredAudio } from "./types";

export type S3SendClient = Pick<S3Client, "send">;

// Works with Cloudflare R2 and other S3-compatible services. Credentials come from env only.
export class S3AudioStorage implements AudioStorage {
  constructor(
    private readonly client: S3SendClient,
    private readonly bucket: string,
  ) {}

  async put(key: string, data: Uint8Array): Promise<void> {
    assertValidKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: mimeTypeForKey(key),
      }),
    );
  }

  async get(key: string): Promise<StoredAudio | null> {
    assertValidKey(key);
    try {
      const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const data = await response.Body?.transformToByteArray();
      if (!data) return null;
      return { data, mimeType: response.ContentType ?? mimeTypeForKey(key) };
    } catch (error) {
      if ((error as { name?: string }).name === "NoSuchKey") return null;
      throw error;
    }
  }
}
