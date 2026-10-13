// Provisional pricing. The margin and the credit value are confirmed before billing is switched on (billing phase).
export const PRICING = { marginMultiplier: 2.5, centsPerCredit: 1 } as const;

// Credits charged to the user for a generation whose provider cost is apiCostCents. Free (0) when the provider is free.
export function creditsFor(apiCostCents: number): number {
  if (apiCostCents <= 0) return 0;
  return Math.ceil((apiCostCents * PRICING.marginMultiplier) / PRICING.centsPerCredit);
}
