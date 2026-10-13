import type Stripe from "stripe";
import type { PrismaClient } from "@/generated/prisma/client";
import { postCredits } from "@/server/credits/ledger";

export type WebhookOutcome = "CREDITED" | "ALREADY_CREDITED" | "IGNORED";

export class WebhookError extends Error {
  constructor(
    readonly code: "INVALID_METADATA" | "UNKNOWN_USER" | "CURRENCY",
    message: string,
  ) {
    super(message);
    this.name = "WebhookError";
  }
}

const PAID_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);

// Credits a paid checkout session. Idempotent: Stripe may deliver the same event more than once, and the
// session id is the referenceKey, so the credits are granted once.
export async function applyStripeEvent(db: PrismaClient, event: Stripe.Event): Promise<WebhookOutcome> {
  if (!PAID_EVENTS.has(event.type)) return "IGNORED";

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.mode !== "payment" || session.payment_status !== "paid") return "IGNORED";
  if (session.currency !== "eur") {
    throw new WebhookError("CURRENCY", `Valuta inattesa: ${session.currency}`);
  }

  const userId = session.metadata?.userId ?? session.client_reference_id;
  const credits = Number(session.metadata?.credits);
  if (!userId || !Number.isInteger(credits) || credits < 1 || credits > 100_000) {
    throw new WebhookError("INVALID_METADATA", `Sessione ${session.id} senza crediti validi`);
  }

  // A deleted or unknown account is reported (non-2xx), so the payment shows up in the Stripe dashboard.
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new WebhookError("UNKNOWN_USER", `Utente non trovato per la sessione ${session.id}`);

  const result = await db.$transaction((tx) =>
    postCredits(tx, {
      userId,
      amount: credits,
      reason: "PURCHASE",
      referenceKey: `stripe:${session.id}`,
      priceCents: session.amount_total ?? undefined,
      note: session.metadata?.packageId ? `Pacchetto ${session.metadata.packageId}` : "Acquisto crediti",
    }),
  );
  return result.applied ? "CREDITED" : "ALREADY_CREDITED";
}
