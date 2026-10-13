import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AdminActionError } from "@/server/admin/users";

const STATUS_BY_CODE = { NOT_FOUND: 404, CANNOT_BLOCK_SELF: 422, BALANCE_NEGATIVE: 422 } as const;

// Maps admin errors to HTTP responses. Returns null for anything unexpected, so Next.js reports it.
export function adminErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "VALIDATION", issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) },
      { status: 400 },
    );
  }
  if (error instanceof AdminActionError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: STATUS_BY_CODE[error.code] });
  }
  return null;
}
