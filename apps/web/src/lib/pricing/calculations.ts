/**
 * Precise 2-decimal rounded financial arithmetic utilities.
 */

export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export interface CalculatedLine {
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  subtotal: number;
  lineTotal: number;
}

export function calculateLineItem(
  quantity: number,
  unitPrice: number,
  discountPercent: number = 0,
  taxPercent: number = 0
): CalculatedLine {
  const qty = Math.max(0.01, roundMoney(Number(quantity) || 0));
  const price = Math.max(0, roundMoney(Number(unitPrice) || 0));
  const discPct = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  const taxPct = Math.min(100, Math.max(0, Number(taxPercent) || 0));

  const subtotal = roundMoney(qty * price);
  const discountAmount = roundMoney(subtotal * (discPct / 100));
  const afterDiscount = Math.max(0, roundMoney(subtotal - discountAmount));
  const taxAmount = roundMoney(afterDiscount * (taxPct / 100));
  const lineTotal = roundMoney(afterDiscount + taxAmount);

  return {
    quantity: qty,
    unitPrice: price,
    discountPercent: discPct,
    discountAmount,
    taxPercent: taxPct,
    taxAmount,
    subtotal,
    lineTotal,
  };
}

export interface DocumentTotals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
}

export function calculateDocumentTotals(
  lines: Array<{
    quantity: number;
    unit_price: number;
    discount_amount?: number;
    tax_amount?: number;
    line_total?: number;
  }>
): DocumentTotals {
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  let grandTotal = 0;

  for (const item of lines) {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    const disc = Number(item.discount_amount) || 0;
    const tax = Number(item.tax_amount) || 0;
    const total = Number(item.line_total) || 0;

    subtotal = roundMoney(subtotal + qty * price);
    discountTotal = roundMoney(discountTotal + disc);
    taxTotal = roundMoney(taxTotal + tax);
    grandTotal = roundMoney(grandTotal + total);
  }

  return {
    subtotal,
    discountTotal,
    taxTotal,
    grandTotal,
  };
}
