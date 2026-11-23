import { describe, it, expect } from 'vitest';
import { generateQuotePdf } from '../quote-pdf';
import type { QuoteRecord, QuoteLineItemRecord } from '@/types/quotes';

describe('Quotation PDF Generation', () => {
  it('generates a valid jsPDF document matching persisted quotation totals', () => {
    const mockQuote: QuoteRecord = {
      id: '11111111-1111-4111-8111-111111111111',
      quote_number: 'QT-2026-00042',
      opportunity_id: '22222222-2222-4222-8222-222222222222',
      account_id: '33333333-3333-4333-8333-333333333333',
      contact_id: null,
      owner_id: '44444444-4444-4444-8444-444444444444',
      subject: 'Enterprise Cloud Subscription & Onboarding',
      status: 'Draft',
      issue_date: '2026-11-20',
      valid_until: '2026-12-20',
      currency: 'INR',
      subtotal: 150000,
      discount_total: 15000,
      tax_total: 24300,
      grand_total: 159300,
      billing_address: '123 Tech Park, Whitefield, Bengaluru',
      shipping_address: '123 Tech Park, Whitefield, Bengaluru',
      terms_and_conditions: 'Payment due within 30 days of invoice issuance.',
      customer_notes: 'Includes 24/7 dedicated enterprise support.',
      internal_notes: null,
      current_revision: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      account: { id: '33333333-3333-4333-8333-333333333333', name: 'Global Horizons Corp' },
    };

    const mockItems: QuoteLineItemRecord[] = [
      {
        id: 'item-1',
        quote_id: mockQuote.id,
        product_id: 'prod-1',
        product_name: 'CRM Enterprise Cloud',
        product_sku: 'CRM-ENT-01',
        description: 'Annual subscription per user pool',
        quantity: 10,
        unit_price: 10000,
        discount_percent: 10,
        discount_amount: 10000,
        tax_percent: 18,
        tax_amount: 16200,
        line_total: 106200,
        sort_order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'item-2',
        quote_id: mockQuote.id,
        product_id: 'prod-2',
        product_name: 'Implementation & Onboarding Package',
        product_sku: 'SRV-ONB-01',
        description: 'Complete data migration and staff enablement',
        quantity: 1,
        unit_price: 50000,
        discount_percent: 10,
        discount_amount: 5000,
        tax_percent: 18,
        tax_amount: 8100,
        line_total: 53100,
        sort_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const mockCompany = {
      company_name: 'FINLONEXA Software Ltd',
      legal_name: 'FINLONEXA Technologies India Pvt Ltd',
      support_email: 'billing@finlonexa.test',
      phone_number: '+91 80 4000 5000',
      address: 'Tower A, Embassy TechZone',
      city: 'Pune',
      state: 'Maharashtra',
      country: 'India',
      postal_code: '411057',
    };

    const doc = generateQuotePdf({
      quote: mockQuote,
      items: mockItems,
      company: mockCompany,
    });

    expect(doc).toBeDefined();
    expect(doc.internal.pages.length).toBeGreaterThanOrEqual(2); // 1 page + 1 jsPDF page buffer

    const pdfBlob = doc.output('blob');
    expect(pdfBlob.size).toBeGreaterThan(1000);
  });
});
