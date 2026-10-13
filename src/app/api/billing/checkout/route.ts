import { NextResponse } from "next/server";
import { z } from "zod";
import { createCheckoutUrl } from "@/server/billing/checkout";
import { getStripe } from "@/server/billing/stripe";
import { getCurrentUser } from "@/server/auth/dal";
import { getEnv } from "@/server/config/env";
import { getDb } from "@/server/db";
import { findPackage, getPricing } from "@/server/pricing/settings";

const checkoutInput = z.object({ packageId: z.string().min(1).max(32), locale: z.string().min(2).max(5) });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "UNSUPPORTED_MEDIA_TYPE" }, { status: 415 });
  }

  const parsed = checkoutInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "VALIDATION" }, { status: 400 });

  const stripe = getStripe();
  if (!stripe) return NextResponse.json({ error: "BILLING_DISABLED" }, { status: 503 });

  const db = getDb();
  const pkg = findPackage(await getPricing(db), parsed.data.packageId);
  if (!pkg) return NextResponse.json({ error: "INVALID_PACKAGE" }, { status: 422 });

  try {
    const url = await createCheckoutUrl({
      stripe,
      appUrl: getEnv().APP_URL,
      locale: parsed.data.locale,
      userId: user.id,
      pkg,
      productName: `SongForge · ${pkg.credits} crediti`,
    });
    return NextResponse.json({ url }, { status: 201 });
  } catch (error) {
    console.error("[billing] creazione checkout non riuscita:", error);
    return NextResponse.json({ error: "CHECKOUT_FAILED" }, { status: 502 });
  }
}
