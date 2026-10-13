import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { createCheckoutUrl } from "@/server/billing/checkout";
import { verifyWebhook } from "@/server/billing/stripe";

const SECRET = "whsec_test_unit";
// Building the client does not contact Stripe.
const stripe = new Stripe("sk_test_unit");
const payload = JSON.stringify({ id: "evt_1", object: "event", type: "customer.created", data: { object: {} } });

describe("webhook signature", () => {
  it("accepts a payload signed with the endpoint secret", () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    expect(verifyWebhook(stripe, payload, header, SECRET).id).toBe("evt_1");
  });

  it("rejects a signature made with another secret", () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_altro" });
    expect(() => verifyWebhook(stripe, payload, header, SECRET)).toThrow();
  });

  it("rejects a payload changed after signing", () => {
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    const tampered = payload.replace("customer.created", "checkout.session.completed");
    expect(() => verifyWebhook(stripe, tampered, header, SECRET)).toThrow();
  });

  it("rejects a malformed signature header", () => {
    expect(() => verifyWebhook(stripe, payload, "non-una-firma", SECRET)).toThrow();
  });
});

describe("createCheckoutUrl", () => {
  type CreateParams = Parameters<Stripe["checkout"]["sessions"]["create"]>[0];

  function fakeStripe(url: string | null, calls: CreateParams[]): Stripe {
    return {
      checkout: {
        sessions: {
          create: async (params: CreateParams) => {
            calls.push(params);
            return { url };
          },
        },
      },
    } as unknown as Stripe;
  }

  it("creates a one-time payment with the price and credits of the server-side package", async () => {
    const calls: CreateParams[] = [];
    const url = await createCheckoutUrl({
      stripe: fakeStripe("https://checkout.stripe.test/s_1", calls),
      appUrl: "https://songforge.test",
      locale: "ro",
      userId: "user_1",
      pkg: { id: "plus", credits: 100, priceCents: 900 },
      productName: "SongForge · 100 crediti",
    });

    expect(url).toBe("https://checkout.stripe.test/s_1");
    const params = calls[0]!;
    expect(params).toMatchObject({
      mode: "payment",
      client_reference_id: "user_1",
      metadata: { userId: "user_1", packageId: "plus", credits: "100" },
      success_url: "https://songforge.test/ro/billing?checkout=success",
      cancel_url: "https://songforge.test/ro/billing?checkout=cancelled",
      locale: "ro",
    });
    expect(params.line_items?.[0]).toMatchObject({
      quantity: 1,
      price_data: { currency: "eur", unit_amount: 900 },
    });
    // The email is collected by Stripe on its own page: it is not sent from here.
    expect(params.customer_email).toBeUndefined();
  });

  it("fails when Stripe returns no link", async () => {
    await expect(
      createCheckoutUrl({
        stripe: fakeStripe(null, []),
        appUrl: "https://songforge.test",
        locale: "it",
        userId: "user_1",
        pkg: { id: "starter", credits: 25, priceCents: 250 },
        productName: "SongForge · 25 crediti",
      }),
    ).rejects.toThrow();
  });
});
