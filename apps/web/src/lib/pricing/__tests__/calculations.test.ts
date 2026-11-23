import { describe, it, expect } from 'vitest';
import { calculateLineItem, calculateDocumentTotals, roundMoney } from '../calculations';

describe('Pricing Calculations and Precision', () => {
  it('correctly calculates basic quantity and unit price without discount or tax', () => {
    const res = calculateLineItem(5, 100);
    expect(res.subtotal).toBe(500);
    expect(res.discountAmount).toBe(0);
    expect(res.taxAmount).toBe(0);
    expect(res.lineTotal).toBe(500);
  });

  it('correctly applies percentage discount before tax', () => {
    // 2 units @ $150 = $300. 10% discount = $30. Taxable = $270. 18% tax on 270 = $48.60. Total = $318.60.
    const res = calculateLineItem(2, 150, 10, 18);
    expect(res.subtotal).toBe(300);
    expect(res.discountAmount).toBe(30);
    expect(res.taxAmount).toBe(48.6);
    expect(res.lineTotal).toBe(318.6);
  });

  it('handles fractional quantities and rounding precision safely', () => {
    // 3.5 hours @ $95.50 = 334.25
    const res = calculateLineItem(3.5, 95.5, 5, 12);
    // 334.25 * 5% = 16.7125 -> 16.71
    expect(res.subtotal).toBe(334.25);
    expect(res.discountAmount).toBe(16.71);
    // After discount: 334.25 - 16.71 = 317.54
    // Tax 12% on 317.54 = 38.1048 -> 38.10
    expect(res.taxAmount).toBe(38.1);
    // Total: 317.54 + 38.10 = 355.64
    expect(res.lineTotal).toBe(355.64);
  });

  it('handles 100% discount cleanly', () => {
    const res = calculateLineItem(10, 50, 100, 18);
    expect(res.subtotal).toBe(500);
    expect(res.discountAmount).toBe(500);
    expect(res.taxAmount).toBe(0);
    expect(res.lineTotal).toBe(0);
  });

  it('correctly aggregates document totals across multiple line items', () => {
    const items = [
      { quantity: 2, unit_price: 100, discount_amount: 20, tax_amount: 18, line_total: 198 },
      { quantity: 1, unit_price: 50, discount_amount: 5, tax_amount: 4.5, line_total: 49.5 },
    ];
    const totals = calculateDocumentTotals(items);
    expect(totals.subtotal).toBe(250);
    expect(totals.discountTotal).toBe(25);
    expect(totals.taxTotal).toBe(22.5);
    expect(totals.grandTotal).toBe(247.5);
  });
});
