import Stripe from "stripe";
import { getEnv } from "@/server/config/env";

let client: Stripe | undefined;

// Null when Stripe is not configured: billing is then shown as unavailable instead of failing.
export function getStripe(): Stripe | null {
  const { STRIPE_SECRET_KEY } = getEnv();
  if (!STRIPE_SECRET_KEY) return null;
  client ??= new Stripe(STRIPE_SECRET_KEY);
  return client;
}

// Checks the signature before anything is trusted. Throws when the signature does not match.
export function verifyWebhook(stripe: Stripe, payload: string, signature: string, secret: string): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
