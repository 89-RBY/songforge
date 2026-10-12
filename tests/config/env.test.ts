import { describe, expect, it } from "vitest";
import { parseEnv } from "@/server/config/env";

const base = {
  DATABASE_URL: "postgresql://localhost:5432/songforge",
  AUTH_SECRET: "x".repeat(32),
  MOCK_PROVIDER: "true",
};

describe("parseEnv", () => {
  it("applies defaults for optional settings", () => {
    const env = parseEnv(base);
    expect(env.EMAIL_TRANSPORT).toBe("console");
    expect(env.APP_URL).toBe("http://localhost:3000");
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(env.STORAGE_DRIVER).toBe("local");
    expect(env.MOCK_PROVIDER).toBe(true);
  });

  it("rejects an AUTH_SECRET shorter than 32 characters", () => {
    expect(() => parseEnv({ ...base, AUTH_SECRET: "troppo-corto" })).toThrow(/AUTH_SECRET/);
  });

  it("requires DATABASE_URL", () => {
    expect(() => parseEnv({ AUTH_SECRET: base.AUTH_SECRET, MOCK_PROVIDER: "true" })).toThrow(/DATABASE_URL/);
  });

  it("requires SMTP_URL when EMAIL_TRANSPORT is smtp", () => {
    expect(() => parseEnv({ ...base, EMAIL_TRANSPORT: "smtp" })).toThrow(/SMTP_URL/);
    expect(() =>
      parseEnv({ ...base, EMAIL_TRANSPORT: "smtp", SMTP_URL: "smtps://u:p@smtp.example.it:465" }),
    ).not.toThrow();
  });

  it("refuses the console transport in production, so links never reach logs", () => {
    expect(() => parseEnv({ ...base, NODE_ENV: "production", EMAIL_TRANSPORT: "console" })).toThrow(
      /EMAIL_TRANSPORT/,
    );
  });

  it("treats empty strings as unset", () => {
    const env = parseEnv({ ...base, SMTP_URL: "", GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" });
    expect(env.SMTP_URL).toBeUndefined();
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
  });

  it("requires Google client id and secret to be set together", () => {
    expect(() => parseEnv({ ...base, GOOGLE_CLIENT_ID: "id" })).toThrow(/GOOGLE_CLIENT_SECRET/);
    expect(() => parseEnv({ ...base, GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "s" })).not.toThrow();
  });

  it("needs at least one music provider: a Gemini key or the mock", () => {
    expect(() => parseEnv({ ...base, MOCK_PROVIDER: "false" })).toThrow(/GEMINI_API_KEY/);
    expect(() => parseEnv({ ...base, MOCK_PROVIDER: "false", GEMINI_API_KEY: "k" })).not.toThrow();
  });

  it("refuses the mock provider in production", () => {
    expect(() => parseEnv({ ...base, NODE_ENV: "production", EMAIL_TRANSPORT: "smtp", SMTP_URL: "smtps://x" })).toThrow(
      /MOCK_PROVIDER/,
    );
  });

  it("requires S3 credentials when storage is S3", () => {
    expect(() => parseEnv({ ...base, STORAGE_DRIVER: "s3" })).toThrow(/S3_BUCKET/);
    expect(
      () =>
        parseEnv({
          ...base,
          STORAGE_DRIVER: "s3",
          S3_BUCKET: "songs",
          S3_ACCESS_KEY_ID: "id",
          S3_SECRET_ACCESS_KEY: "secret",
        }),
    ).not.toThrow();
  });
});
