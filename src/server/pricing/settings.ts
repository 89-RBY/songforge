import { z } from "zod";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";

export const PRICING_KEY = "pricing";

export const creditPackageSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,32}$/, "Identificativo non valido"),
  credits: z.number().int().min(1).max(100_000),
  priceCents: z.number().int().min(50).max(1_000_000),
});

// Operator settings. Changing them does not touch past charges: each ledger row keeps its own amounts.
export const pricingSchema = z.object({
  marginMultiplier: z.number().min(1).max(10),
  centsPerCredit: z.number().int().min(1).max(1000),
  signupCredits: z.number().int().min(0).max(1000),
  dailyApiCapCents: z.number().int().min(0).max(10_000_000),
  packages: z
    .array(creditPackageSchema)
    .min(1)
    .max(6)
    .refine((packages) => new Set(packages.map((pkg) => pkg.id)).size === packages.length, "Identificativi pacchetto duplicati"),
  disabledProviders: z.array(z.string().min(1)).default([]),
});

export type Pricing = z.infer<typeof pricingSchema>;
export type CreditPackage = z.infer<typeof creditPackageSchema>;

// Provisional values: confirmed by the operator before billing is switched on.
export const DEFAULT_PRICING: Pricing = {
  marginMultiplier: 2.5,
  centsPerCredit: 10,
  signupCredits: 10,
  dailyApiCapCents: 5000,
  packages: [
    { id: "starter", credits: 25, priceCents: 250 },
    { id: "plus", credits: 100, priceCents: 900 },
    { id: "pro", credits: 400, priceCents: 3000 },
  ],
  disabledProviders: [],
};

// Falls back to the defaults when the stored value is missing or invalid, so a bad edit never stops the app.
export function parsePricing(value: unknown): Pricing {
  const result = pricingSchema.safeParse(value);
  return result.success ? result.data : DEFAULT_PRICING;
}

export async function getPricing(db: PrismaClient): Promise<Pricing> {
  const row = await db.appSetting.findUnique({ where: { key: PRICING_KEY }, select: { value: true } });
  return row ? parsePricing(row.value) : DEFAULT_PRICING;
}

export async function savePricing(db: PrismaClient, input: unknown): Promise<Pricing> {
  const pricing = pricingSchema.parse(input);
  const value = pricing as unknown as Prisma.InputJsonValue;
  await db.appSetting.upsert({
    where: { key: PRICING_KEY },
    create: { key: PRICING_KEY, value },
    update: { value },
  });
  return pricing;
}

export function findPackage(pricing: Pricing, id: string): CreditPackage | undefined {
  return pricing.packages.find((pkg) => pkg.id === id);
}
