import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/dal";
import { getDb } from "@/server/db";
import { songErrorResponse } from "@/server/http/errors";
import { setSharing } from "@/server/songs/service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { id } = await params;
  try {
    const token = await setSharing(getDb(), user.id, id, true);
    return NextResponse.json({ token });
  } catch (error) {
    const response = songErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const { id } = await params;
  try {
    await setSharing(getDb(), user.id, id, false);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const response = songErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
