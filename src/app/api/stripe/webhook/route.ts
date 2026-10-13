import { NextResponse } from "next/server";
import { getEnv } from "@/server/config/env";
import { applyStripeEvent, WebhookError } from "@/server/billing/webhook";
import { getStripe, verifyWebhook } from "@/server/billing/stripe";
import { getDb } from "@/server/db";

// Raw body is required for the signature check, so the payload is read as text and never parsed first.
export async function POST(request: Request) {
  const stripe = getStripe();
  const { STRIPE_WEBHOOK_SECRET } = getEnv();
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "BILLING_DISABLED" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 400 });

  const payload = await request.text();
  let event;
  try {
    event = verifyWebhook(stripe, payload, signature, STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 400 });
  }

  try {
    const outcome = await applyStripeEvent(getDb(), event);
    return NextResponse.json({ received: true, outcome });
  } catch (error) {
    if (error instanceof WebhookError) {
      console.error(`[stripe] evento ${event.id} non applicato: ${error.message}`);
      return NextResponse.json({ error: error.code }, { status: 422 });
    }
    throw error;
  }
}
