// Pure functions shared by the server and the wizard. The rates come from the pricing settings (see src/server/pricing).
export type CreditRates = { marginMultiplier: number; centsPerCredit: number };

// Credits charged to the user for a generation whose provider cost is apiCostCents. Free (0) when the provider is free.
export function creditsFor(apiCostCents: number, rates: CreditRates): number {
  if (apiCostCents <= 0) return 0;
  return Math.ceil((apiCostCents * rates.marginMultiplier) / rates.centsPerCredit);
}
