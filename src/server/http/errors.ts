import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { SongServiceError, type SongServiceErrorCode } from "@/server/songs/service";

const STATUS_BY_CODE: Record<SongServiceErrorCode, number> = {
  TOO_MANY_ACTIVE: 429,
  NOT_FOUND: 404,
  INVALID_STATE: 409,
  INVALID_PROVIDER: 422,
  MODERATION_BLOCKED: 422,
};

// Maps the errors of song operations to HTTP responses. Returns null for anything unexpected,
// so the caller can rethrow it and let Next.js report it.
export function songErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "VALIDATION", issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) },
      { status: 400 },
    );
  }
  if (error instanceof SongServiceError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: STATUS_BY_CODE[error.code] });
  }
  return null;
}
