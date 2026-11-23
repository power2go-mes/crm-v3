import { jsPDF } from 'jspdf';
import type { QuoteRecord, QuoteLineItemRecord } from '@/types/quotes';

export interface QuotePdfOptions {
  quote: QuoteRecord;
  items: QuoteLineItemRecord[];
  company: {
    company_name?: string | null;
    legal_name?: string | null;
    support_email?: string | null;
    phone_number?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    postal_code?: string | null;
    currency?: string | null;
  };
}

export function generateQuotePdf({ quote, items, company }: QuotePdfOptions): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = margin;

  // Header / Brand Banner
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(company.legal_name || company.company_name || 'FINLONEXA CRM', margin, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('OFFICIAL SALES QUOTATION', pageWidth - margin, 18, { align: 'right' });

  y = 36;

  // Metadata Columns: Company Info (Left), Quote Details (Right)
  doc.setTextColor(51, 65, 85); // Slate 700
  doc.setFontSize(9);

  // Left: Company Info
  doc.setFont('helvetica', 'bold');
  doc.text('ISSUED BY:', margin, y);
  doc.setFont('helvetica', 'normal');
  y += 5;
  doc.text(company.company_name || 'FINLONEXA Enterprise', margin, y);
  if (company.address) {
    y += 4;
    doc.text(company.address, margin, y);
  }
  const cityLine = [company.city, company.state, company.postal_code, company.country].filter(Boolean).join(', ');
  if (cityLine) {
    y += 4;
    doc.text(cityLine, margin, y);
  }
  if (company.support_email || company.phone_number) {
    y += 4;
    doc.text([company.support_email, company.phone_number].filter(Boolean).join(' | '), margin, y);
  }

  // Right: Quotation Identifiers
  let rightY = 36;
  const rightX = pageWidth - margin;
  doc.setFont('helvetica', 'bold');
  doc.text(`Quote #: ${quote.quote_number}`, rightX, rightY, { align: 'right' });
  rightY += 5;
  doc.setFont('helvetica', 'normal');
  doc.text(`Status: ${quote.status}`, rightX, rightY, { align: 'right' });
  rightY += 4;
  doc.text(`Issue Date: ${quote.issue_date}`, rightX, rightY, { align: 'right' });
  rightY += 4;
  doc.text(`Valid Until: ${quote.valid_until}`, rightX, rightY, { align: 'right' });
  rightY += 4;
  doc.text(`Currency: ${quote.currency}`, rightX, rightY, { align: 'right' });

  y = Math.max(y, rightY) + 8;

  // Separator
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Customer / Bill-To & Ship-To Information
  doc.setFont('helvetica', 'bold');
  doc.text('PREPARED FOR:', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');

  const customerName = quote.account?.name || quote.opportunity?.name || 'Customer';
  doc.text(customerName, margin, y);
  if (quote.contact) {
    y += 4;
    const contactLine = `${quote.contact.first_name} ${quote.contact.last_name}${quote.contact.email ? ` (${quote.contact.email})` : ''}`;
    doc.text(contactLine, margin, y);
  }
  if (quote.billing_address) {
    y += 4;
    doc.text(`Billing: ${quote.billing_address}`, margin, y);
  }
  if (quote.shipping_address) {
    y += 4;
    doc.text(`Shipping: ${quote.shipping_address}`, margin, y);
  }

  y += 8;

  // Subject
  doc.setFont('helvetica', 'bold');
  doc.text(`Subject: ${quote.subject}`, margin, y);
  y += 7;

  // Line Items Table Header
  const colX = {
    item: margin,
    qty: 110,
    price: 130,
    disc: 150,
    tax: 168,
    total: pageWidth - margin,
  };

  doc.setFillColor(241, 245, 249); // Slate 100
  doc.rect(margin, y, pageWidth - margin * 2, 7, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);

  doc.text('ITEM & DESCRIPTION', colX.item + 2, y + 5);
  doc.text('QTY', colX.qty, y + 5, { align: 'right' });
  doc.text('UNIT PRICE', colX.price, y + 5, { align: 'right' });
  doc.text('DISC %', colX.disc, y + 5, { align: 'right' });
  doc.text('TAX %', colX.tax, y + 5, { align: 'right' });
  doc.text('LINE TOTAL', colX.total - 2, y + 5, { align: 'right' });

  y += 8;

  // Line Items Rows
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);

  for (const item of items) {
    if (y > pageHeight - 40) {
      doc.addPage();
      y = margin + 10;
    }

    doc.setFont('helvetica', 'bold');
    doc.text(item.product_name, colX.item + 2, y + 4);
    doc.setFont('helvetica', 'normal');

    const skuText = item.product_sku ? ` [${item.product_sku}]` : '';
    if (skuText) {
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(skuText, colX.item + 2 + doc.getTextWidth(item.product_name) + 2, y + 4);
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
    }

    doc.text(Number(item.quantity).toLocaleString(), colX.qty, y + 4, { align: 'right' });
    doc.text(Number(item.unit_price).toFixed(2), colX.price, y + 4, { align: 'right' });
    doc.text(`${Number(item.discount_percent || 0).toFixed(0)}%`, colX.disc, y + 4, { align: 'right' });
    doc.text(`${Number(item.tax_percent || 0).toFixed(0)}%`, colX.tax, y + 4, { align: 'right' });
    doc.text(Number(item.line_total).toFixed(2), colX.total - 2, y + 4, { align: 'right' });

    y += 6;
    if (item.description) {
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      const descLines = doc.splitTextToSize(item.description, 85);
      doc.text(descLines, colX.item + 2, y + 2);
      y += descLines.length * 3.5;
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
    }

    doc.setDrawColor(241, 245, 249);
    doc.line(margin, y + 1, pageWidth - margin, y + 1);
    y += 3;
  }

  y += 4;

  // Totals Section
  if (y > pageHeight - 50) {
    doc.addPage();
    y = margin + 10;
  }

  const totalsLabelX = 140;
  const totalsValX = pageWidth - margin - 2;

  doc.setFontSize(9);
  doc.text('Subtotal:', totalsLabelX, y, { align: 'right' });
  doc.text(`${quote.currency} ${Number(quote.subtotal).toFixed(2)}`, totalsValX, y, { align: 'right' });
  y += 5;

  if (Number(quote.discount_total) > 0) {
    doc.text('Total Discount:', totalsLabelX, y, { align: 'right' });
    doc.text(`-${quote.currency} ${Number(quote.discount_total).toFixed(2)}`, totalsValX, y, { align: 'right' });
    y += 5;
  }

  if (Number(quote.tax_total) > 0) {
    doc.text('Applicable Taxes:', totalsLabelX, y, { align: 'right' });
    doc.text(`${quote.currency} ${Number(quote.tax_total).toFixed(2)}`, totalsValX, y, { align: 'right' });
    y += 5;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setFillColor(241, 245, 249);
  doc.rect(totalsLabelX - 25, y - 4, pageWidth - margin - (totalsLabelX - 25), 8, 'F');
  doc.text('Grand Total:', totalsLabelX, y + 2, { align: 'right' });
  doc.text(`${quote.currency} ${Number(quote.grand_total).toFixed(2)}`, totalsValX, y + 2, { align: 'right' });
  y += 12;

  // Terms and Notes
  if (quote.terms_and_conditions || quote.customer_notes) {
    if (y > pageHeight - 40) {
      doc.addPage();
      y = margin + 10;
    }

    if (quote.customer_notes) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Notes / Instructions:', margin, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      const noteLines = doc.splitTextToSize(quote.customer_notes, pageWidth - margin * 2);
      doc.text(noteLines, margin, y);
      y += noteLines.length * 3.5 + 4;
    }

    if (quote.terms_and_conditions) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Terms & Conditions:', margin, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      const termLines = doc.splitTextToSize(quote.terms_and_conditions, pageWidth - margin * 2);
      doc.text(termLines, margin, y);
      y += termLines.length * 3.5 + 4;
    }
  }

  // Footer on each page
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(
      `Generated by FINLONEXA CRM v3 | Quotation #${quote.quote_number} | Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  return doc;
}
