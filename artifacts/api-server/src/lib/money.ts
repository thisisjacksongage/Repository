export function toDollars(cents: number | null | undefined): number | null {
  return cents == null ? null : cents / 100;
}

export function resaleProfitCents(item: {
  status: string;
  soldPriceCents: number | null;
  purchasePriceCents: number;
  platformFeeCents: number | null;
  paymentFeeCents: number | null;
  shippingCostCents: number | null;
  otherCostsCents: number | null;
}): number | null {
  if (item.status !== "sold" || item.soldPriceCents == null) return null;
  return (
    item.soldPriceCents -
    item.purchasePriceCents -
    (item.platformFeeCents ?? 0) -
    (item.paymentFeeCents ?? 0) -
    (item.shippingCostCents ?? 0) -
    (item.otherCostsCents ?? 0)
  );
}