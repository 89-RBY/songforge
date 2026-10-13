import { z } from "zod";

// Empty strings in .env files mean "not set".
const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_URL: z.url().default("http://localhost:3000"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL è obbligatorio"),
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET deve avere almeno 32 caratteri"),
    EMAIL_FROM: z.string().min(1).default("SongForge <no-reply@localhost>"),
    EMAIL_TRANSPORT: z.enum(["console", "smtp"]).default("console"),
    SMTP_URL: optionalString,
    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,
    MOCK_PROVIDER: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    GEMINI_API_KEY: optionalString,
    GEMINI_BASE_URL: z.url().default("https://generativelanguage.googleapis.com"),
    LYRIA_SONG_MODEL: z.string().min(1).default("lyria-3.5"),
    LYRIA_CLIP_MODEL: z.string().min(1).default("lyria-3-clip-preview"),
    LYRIA_TIMEOUT_MS: z.coerce.number().int().positive().default(10 * 60 * 1000),
    MOCK_DELAY_MS: z.coerce.number().int().nonnegative().default(1500),
    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    STORAGE_LOCAL_DIR: z.string().min(1).default(".data/audio"),
    S3_ENDPOINT: optionalString,
    S3_REGION: z.string().min(1).default("auto"),
    S3_BUCKET: optionalString,
    S3_ACCESS_KEY_ID: optionalString,
    S3_SECRET_ACCESS_KEY: optionalString,
    WORKER_POLL_MS: z.coerce.number().int().positive().default(2000),
    ANTHROPIC_API_KEY: optionalString,
    LYRICS_MODEL: z.string().min(1).default("claude-opus-5-5"),
    AUDIO_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
  })
  .superRefine((env, ctx) => {
    if (!env.MOCK_PROVIDER && !env.GEMINI_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["GEMINI_API_KEY"],
        message: "Nessun provider musicale attivo: imposta GEMINI_API_KEY oppure MOCK_PROVIDER=true",
      });
    }
    if (env.MOCK_PROVIDER && env.NODE_ENV === "production") {
      ctx.addIssue({
        code: "custom",
        path: ["MOCK_PROVIDER"],
        message: "MOCK_PROVIDER non è ammesso in produzione: genererebbe audio finti per gli utenti",
      });
    }
    if (env.STORAGE_DRIVER === "s3") {
      for (const key of ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const) {
        if (!env[key]) {
          ctx.addIssue({ code: "custom", path: [key], message: `${key} è obbligatorio con STORAGE_DRIVER=s3` });
        }
      }
    }
    if (env.EMAIL_TRANSPORT === "smtp" && !env.SMTP_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["SMTP_URL"],
        message: "SMTP_URL è obbligatorio quando EMAIL_TRANSPORT=smtp",
      });
    }
    if (env.EMAIL_TRANSPORT === "console" && env.NODE_ENV === "production") {
      ctx.addIssue({
        code: "custom",
        path: ["EMAIL_TRANSPORT"],
        message: "In produzione serve EMAIL_TRANSPORT=smtp: i link di accesso non devono finire nei log",
      });
    }
    if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) {
      ctx.addIssue({
        code: "custom",
        path: ["GOOGLE_CLIENT_SECRET"],
        message: "GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET vanno impostati insieme",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `- ${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Configurazione non valida:\n${details}`);
  }
  return result.data;
}

let cached: Env | undefined;

// Lazy and memoized: nothing is read at import time, so `next build` works without secrets.
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
