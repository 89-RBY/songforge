import { NextResponse } from "next/server";
import { exportAccount } from "@/server/account/service";
import { getCurrentUser } from "@/server/auth/dal";
import { getDb } from "@/server/db";

// Downloads everything the account holds, as JSON. Only the signed-in user can request it.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const data = await exportAccount(getDb(), user.id);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": 'attachment; filename="songforge-dati.json"',
      "cache-control": "no-store",
    },
  });
}
