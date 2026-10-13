import type Stripe from "stripe";
import type { CreditPackage } from "@/server/pricing/settings";

export type CheckoutInput = {
  stripe: Stripe;
  appUrl: string;
  locale: string;
  userId: string;
  pkg: CreditPackage;
  productName: string;
};

// Creates a one-time payment for a package. The credits are written into the session metadata by the server,
// and the webhook trusts them only because the event is signed by Stripe.
export async function createCheckoutUrl(input: CheckoutInput): Promise<string> {
  const { stripe, appUrl, locale, userId, pkg, productName } = input;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: userId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: pkg.priceCents,
          product_data: { name: productName },
        },
      },
    ],
    metadata: { userId, packageId: pkg.id, credits: String(pkg.credits) },
    success_url: `${appUrl}/${locale}/billing?checkout=success`,
    cancel_url: `${appUrl}/${locale}/billing?checkout=cancelled`,
    locale: locale as Stripe.Checkout.SessionCreateParams.Locale,
  });
  if (!session.url) throw new Error("Stripe non ha restituito un link di pagamento");
  return session.url;
}
