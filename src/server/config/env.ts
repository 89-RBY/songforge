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
  })
  .superRefine((env, ctx) => {
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
