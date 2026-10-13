import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type Stripe from "stripe";
import type { PrismaClient } from "@/generated/prisma/client";
import { applyStripeEvent, WebhookError } from "@/server/billing/webhook";
import { canUseTestDb, createTestDb, resetTables } from "../helpers/db";

type SessionOverrides = {
  sessionId?: string;
  userId?: string;
  credits?: string;
  paymentStatus?: string;
  currency?: string;
  mode?: string;
  type?: string;
  eventId?: string;
};

// Minimal event with the fields the handler reads, shaped like a real checkout.session.completed.
function checkoutEvent(o: SessionOverrides = {}): Stripe.Event {
  const type = o.type ?? "checkout.session.completed";
  return {
    id: o.eventId ?? `evt_${Math.random().toString(36).slice(2)}`,
    object: "event",
    type,
    created: 0,
    livemode: false,
    pending_webhooks: 0,
    request: null,
    api_version: null,
    data: {
      object: {
        id: o.sessionId ?? "cs_test_1",
        object: "checkout.session",
        mode: o.mode ?? "payment",
        payment_status: o.paymentStatus ?? "paid",
        currency: o.currency ?? "eur",
        amount_total: 900,
        client_reference_id: o.userId ?? null,
        metadata: { userId: o.userId ?? "", packageId: "plus", credits: o.credits ?? "100" },
      },
    },
  } as unknown as Stripe.Event;
}

describe.skipIf(!canUseTestDb)("Stripe webhook (database)", () => {
  let db: PrismaClient;
  let userId: string;

  beforeAll(() => {
    db = createTestDb();
  });

  afterAll(async () => {
    await resetTables(db);
    await db.$disconnect();
  });

  beforeEach(async () => {
    await resetTables(db);
    const user = await db.user.create({ data: { email: `stripe-${Math.random().toString(36).slice(2)}@test.it` } });
    userId = user.id;
  });

  const balance = async () =>
    (await db.user.findUniqueOrThrow({ where: { id: userId }, select: { creditBalance: true } })).creditBalance;

  it("credits the purchased amount and records the payment in the ledger", async () => {
    const outcome = await applyStripeEvent(db, checkoutEvent({ userId, credits: "100" }));
    expect(outcome).toBe("CREDITED");
    expect(await balance()).toBe(100);

    const entry = await db.creditEntry.findUniqueOrThrow({ where: { referenceKey: "stripe:cs_test_1" } });
    expect(entry).toMatchObject({ userId, amount: 100, balanceAfter: 100, reason: "PURCHASE", priceCents: 900 });
  });

  it("credits a session only once when Stripe delivers it again", async () => {
    const event = checkoutEvent({ userId });
    expect(await applyStripeEvent(db, event)).toBe("CREDITED");
    expect(await applyStripeEvent(db, event)).toBe("ALREADY_CREDITED");
    expect(await balance()).toBe(100);
  });

  it("credits once when two deliveries of the same session arrive at the same time", async () => {
    const event = checkoutEvent({ userId, sessionId: "cs_test_parallel" });
    const outcomes = await Promise.all([applyStripeEvent(db, event), applyStripeEvent(db, event)]);
    expect(outcomes.sort()).toEqual(["ALREADY_CREDITED", "CREDITED"]);
    expect(await balance()).toBe(100);
  });

  it("does not credit a session whose payment is still pending", async () => {
    const outcome = await applyStripeEvent(db, checkoutEvent({ userId, paymentStatus: "unpaid" }));
    expect(outcome).toBe("IGNORED");
    expect(await balance()).toBe(0);
  });

  it("credits a delayed payment when it succeeds", async () => {
    const event = checkoutEvent({
      userId,
      sessionId: "cs_test_async",
      type: "checkout.session.async_payment_succeeded",
    });
    expect(await applyStripeEvent(db, event)).toBe("CREDITED");
    expect(await balance()).toBe(100);
  });

  it("ignores event types it does not handle", async () => {
    expect(await applyStripeEvent(db, checkoutEvent({ userId, type: "customer.created" }))).toBe("IGNORED");
    expect(await balance()).toBe(0);
  });

  it("rejects a payment in another currency without crediting", async () => {
    await expect(applyStripeEvent(db, checkoutEvent({ userId, currency: "usd" }))).rejects.toMatchObject({
      code: "CURRENCY",
    });
    expect(await balance()).toBe(0);
  });

  it("rejects a session for an unknown user", async () => {
    await expect(applyStripeEvent(db, checkoutEvent({ userId: "utente-inesistente" }))).rejects.toBeInstanceOf(
      WebhookError,
    );
    expect(await db.creditEntry.count()).toBe(0);
  });

  it("rejects missing or invalid credit amounts", async () => {
    for (const credits of ["", "abc", "0", "-5", "1.5"]) {
      await expect(applyStripeEvent(db, checkoutEvent({ userId, credits, sessionId: `cs_${credits}` }))).rejects.toMatchObject({
        code: "INVALID_METADATA",
      });
    }
    expect(await balance()).toBe(0);
  });
});
