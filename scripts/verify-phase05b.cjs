const fs = require('fs');
const { Client } = require('pg');

const envContent = fs.readFileSync('apps/web/.env.local', 'utf8');
const connectionString = envContent
  .split(/\r?\n/)
  .find((v) => /^DATABASE_URL\s*=/.test(v))
  .split('=')[1]
  .trim()
  .replace(/^['"]|['"]$/g, '');

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function verifyPhase05B() {
  await client.connect();
  console.log('=== FINLONEXA CRM v3 — PHASE 05B COMPREHENSIVE VERIFICATION ===\n');

  const results = [];

  function record(testName, passed, details) {
    results.push({ testName, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} | ${testName} - ${details}`);
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Permissions Installed
    // -------------------------------------------------------------
    const permsRes = await client.query(`
      SELECT count(*) as count FROM public.permissions 
      WHERE module IN ('products', 'price_books', 'quotes')
    `);
    const permCount = parseInt(permsRes.rows[0].count, 10);
    record('RBAC Permissions', permCount === 11, `Found ${permCount}/11 Phase 05B permissions`);

    // -------------------------------------------------------------
    // Test 2: Standard Price Book exists
    // -------------------------------------------------------------
    const stdBookRes = await client.query(`
      SELECT id, name, currency, is_standard, is_active FROM public.crm_price_books 
      WHERE is_standard = true LIMIT 1
    `);
    const stdBook = stdBookRes.rows[0];
    record('Standard Price Book Seeded', !!stdBook && stdBook.is_standard && stdBook.currency === 'INR', 
      stdBook ? `ID: ${stdBook.id}, Name: "${stdBook.name}", Currency: ${stdBook.currency}` : 'Missing standard price book');

    // -------------------------------------------------------------
    // Test 3: Product Creation & Unique SKU Check
    // -------------------------------------------------------------
    const testSku = `TEST-SKU-${Date.now()}`;
    const insertProd = await client.query(`
      INSERT INTO public.crm_products (name, sku, category, type, unit_of_measure, default_price, currency, is_active)
      VALUES ($1, $2, 'Hardware', 'product', 'Unit', 5000.00, 'INR', true)
      RETURNING id, name, sku, default_price
    `, [`Test Server ${Date.now()}`, testSku]);
    const prodId = insertProd.rows[0].id;
    record('Product Creation', !!prodId, `Created product ID ${prodId} with SKU ${testSku}`);

    // Verify duplicate SKU rejection
    let dupFailed = false;
    try {
      await client.query(`
        INSERT INTO public.crm_products (name, sku, category, default_price)
        VALUES ('Duplicate Prod', $1, 'Hardware', 3000.00)
      `, [testSku]);
    } catch (e) {
      dupFailed = true;
    }
    record('Duplicate SKU Rejection', dupFailed, `Unique constraint correctly blocked duplicate SKU "${testSku}"`);

    // -------------------------------------------------------------
    // Test 4: Custom Price Book & Price Book Entry
    // -------------------------------------------------------------
    const customBook = await client.query(`
      INSERT INTO public.crm_price_books (name, description, currency, is_standard, is_active)
      VALUES ($1, 'Special partner tier pricing', 'INR', false, true)
      RETURNING id, name
    `, [`Partner Book ${Date.now()}`]);
    const customBookId = customBook.rows[0].id;

    const pbEntry = await client.query(`
      INSERT INTO public.crm_price_book_entries (price_book_id, product_id, unit_price, currency, is_active)
      VALUES ($1, $2, 4200.00, 'INR', true)
      RETURNING id, unit_price
    `, [customBookId, prodId]);
    record('Custom Price Book Entry', pbEntry.rows.length === 1 && Number(pbEntry.rows[0].unit_price) === 4200.00,
      `Configured custom price 4200.00 in price book ${customBookId}`);

    // -------------------------------------------------------------
    // Test 5: Opportunity Line Items & Authoritative Trigger Calculations
    // -------------------------------------------------------------
    // Create a temporary Opportunity with initial manual amount 25,000
    const oppRes = await client.query(`
      INSERT INTO public.opportunities (name, stage, amount, probability, price_sync_mode, close_date)
      VALUES ($1, 'qualification', 25000.00, 20, 'manual', CURRENT_DATE + 30)
      RETURNING id, name, amount, price_sync_mode
    `, [`Test Deal ${Date.now()}`]);
    const oppId = oppRes.rows[0].id;
    record('Test Opportunity Created', !!oppId, `Opp ID: ${oppId}, Initial Amount: $${oppRes.rows[0].amount}, Mode: ${oppRes.rows[0].price_sync_mode}`);

    // Insert Line Item 1: Qty 2, Unit Price 5000, Disc 10%, Tax 18%
    // Subtotal = 10000, Disc = 1000, Tax = 1620, Line Total = 10620
    await client.query(`
      INSERT INTO public.crm_opportunity_line_items (
        opportunity_id, product_id, product_name, product_sku,
        quantity, unit_price, discount_percent, discount_amount,
        tax_percent, tax_amount, line_total, sort_order
      ) VALUES ($1, $2, 'Line Item 1', $3, 2, 5000.00, 10.00, 1000.00, 18.00, 1620.00, 10620.00, 0)
    `, [oppId, prodId, testSku]);

    // Insert Line Item 2: Qty 1, Unit Price 4200, Disc 0%, Tax 18%
    // Subtotal = 4200, Disc = 0, Tax = 756, Line Total = 4956
    await client.query(`
      INSERT INTO public.crm_opportunity_line_items (
        opportunity_id, product_id, product_name, product_sku,
        quantity, unit_price, discount_percent, discount_amount,
        tax_percent, tax_amount, line_total, sort_order
      ) VALUES ($1, $2, 'Line Item 2', $3, 1, 4200.00, 0.00, 0.00, 18.00, 756.00, 4956.00, 1)
    `, [oppId, prodId, testSku]);

    // Verify opportunity table values after trigger
    const oppAfterItems = await client.query(`
      SELECT amount, price_sync_mode, items_subtotal, items_discount, items_tax
      FROM public.opportunities WHERE id = $1
    `, [oppId]);
    const oppData = oppAfterItems.rows[0];

    const expectedSubtotal = 14200.00;
    const expectedDiscount = 1000.00;
    const expectedTax = 2376.00;
    const expectedTotal = 15576.00;

    const totalsMatch = 
      Number(oppData.items_subtotal) === expectedSubtotal &&
      Number(oppData.items_discount) === expectedDiscount &&
      Number(oppData.items_tax) === expectedTax;

    record('Trigger Totals Recalculation', totalsMatch,
      `Subtotal: ${oppData.items_subtotal} (exp ${expectedSubtotal}), Disc: ${oppData.items_discount} (exp ${expectedDiscount}), Tax: ${oppData.items_tax} (exp ${expectedTax})`);

    // In 'manual' mode, opp.amount MUST NOT be overwritten (remains 25000)
    record('Manual Amount Protection', Number(oppData.amount) === 25000.00,
      `Opportunity amount remained ${oppData.amount} (protected from unrequested sync)`);

    // -------------------------------------------------------------
    // Test 6: Sync Mode Switching via RPC
    // -------------------------------------------------------------
    await client.query(`SELECT public.set_opportunity_price_sync_mode($1, 'synced')`, [oppId]);
    const oppSynced = await client.query(`SELECT amount, price_sync_mode FROM public.opportunities WHERE id = $1`, [oppId]);
    const isSynced = Number(oppSynced.rows[0].amount) === expectedTotal && oppSynced.rows[0].price_sync_mode === 'synced';
    record('Synced Mode Switching (RPC)', isSynced,
      `Opportunity amount synced to line total sum: ${oppSynced.rows[0].amount} (exp ${expectedTotal})`);

    // Switch back to manual mode
    await client.query(`SELECT public.set_opportunity_price_sync_mode($1, 'manual')`, [oppId]);
    const oppManualAgain = await client.query(`SELECT amount, price_sync_mode FROM public.opportunities WHERE id = $1`, [oppId]);
    record('Revert to Manual Mode', oppManualAgain.rows[0].price_sync_mode === 'manual',
      `Mode returned to manual with preserved value ${oppManualAgain.rows[0].amount}`);

    // -------------------------------------------------------------
    // Test 7: Quotation Generation & Auto-Numbering
    // -------------------------------------------------------------
    const quoteRes = await client.query(`
      INSERT INTO public.crm_quotes (
        opportunity_id, subject, status, issue_date, valid_until,
        currency, subtotal, discount_total, tax_total, grand_total
      ) VALUES ($1, 'Formal Enterprise Proposal', 'Draft', CURRENT_DATE, CURRENT_DATE + 30, 'INR', $2, $3, $4, $5)
      RETURNING id, quote_number, status, grand_total
    `, [oppId, expectedSubtotal, expectedDiscount, expectedTax, expectedTotal]);
    const quote = quoteRes.rows[0];

    const hasQuoteNumber = /^QT-\d{4}-\d{4,5}$/.test(quote.quote_number);
    record('Quotation Sequence Auto-Numbering', hasQuoteNumber,
      `Generated Quote Number: "${quote.quote_number}"`);

    // Add quote line items
    await client.query(`
      INSERT INTO public.crm_quote_line_items (
        quote_id, product_id, product_name, product_sku,
        quantity, unit_price, discount_percent, discount_amount,
        tax_percent, tax_amount, line_total, sort_order
      ) VALUES ($1, $2, 'Line Item 1', $3, 2, 5000.00, 10.00, 1000.00, 18.00, 1620.00, 10620.00, 0)
    `, [quote.id, prodId, testSku]);

    // -------------------------------------------------------------
    // Test 8: Quote Revision Snapshots & Status Lifecycle
    // -------------------------------------------------------------
    // Trigger snapshot for initial draft
    await client.query(`SELECT public.save_quote_revision_snapshot($1)`, [quote.id]);
    const rev1 = await client.query(`
      SELECT revision_number, snapshot_data->'quote'->>'status' as status, snapshot_data->'quote'->>'grand_total' as grand_total 
      FROM public.crm_quote_revisions WHERE quote_id = $1
    `, [quote.id]);
    record('Revision 1 Snapshot Saved', rev1.rows.length === 1 && rev1.rows[0].revision_number === 1,
      `Revision 1 created at status "${rev1.rows[0]?.status}" with grand total ${rev1.rows[0]?.grand_total}`);

    // Transition: Draft -> Sent
    await client.query(`UPDATE public.crm_quotes SET status = 'Sent', updated_at = NOW() WHERE id = $1`, [quote.id]);
    await client.query(`SELECT public.save_quote_revision_snapshot($1)`, [quote.id]);

    // Transition: Sent -> Accepted
    await client.query(`UPDATE public.crm_quotes SET status = 'Accepted', updated_at = NOW() WHERE id = $1`, [quote.id]);
    await client.query(`SELECT public.save_quote_revision_snapshot($1)`, [quote.id]);

    const revAll = await client.query(`
      SELECT revision_number, snapshot_data->'quote'->>'status' as status, snapshot_data->'quote'->>'grand_total' as grand_total 
      FROM public.crm_quote_revisions 
      WHERE quote_id = $1 
      ORDER BY revision_number ASC
    `, [quote.id]);

    const revisionsOk = revAll.rows.length === 3 &&
      revAll.rows[0].status === 'Draft' &&
      revAll.rows[1].status === 'Sent' &&
      revAll.rows[2].status === 'Accepted';

    record('Quote Status Lifecycle & Immutable Ledger', revisionsOk,
      `Recorded ${revAll.rows.length} snapshots: [${revAll.rows.map(r => `Rev ${r.revision_number}:${r.status}`).join(' -> ')}]`);

    // -------------------------------------------------------------
    // Test 9: RLS & Scoped Opportunity Access Helper
    // -------------------------------------------------------------
    const rlsCheck = await client.query(`
      SELECT tablename, rowsecurity FROM pg_tables 
      WHERE schemaname = 'public' AND tablename LIKE 'crm_%'
      ORDER BY tablename
    `);
    const allRlsEnabled = rlsCheck.rows.every(r => r.rowsecurity === true);
    record('RLS Policies Active on All Tables', allRlsEnabled,
      `${rlsCheck.rows.length} tables verified with rowsecurity = true`);

    // -------------------------------------------------------------
    // Cleanup Test Artifacts
    // -------------------------------------------------------------
    await client.query(`DELETE FROM public.crm_quotes WHERE id = $1`, [quote.id]);
    await client.query(`DELETE FROM public.opportunities WHERE id = $1`, [oppId]);
    await client.query(`DELETE FROM public.crm_price_books WHERE id = $1`, [customBookId]);
    await client.query(`DELETE FROM public.crm_products WHERE id = $1`, [prodId]);
    console.log('\nCleaned up all temporary test records.');

  } catch (err) {
    console.error('VERIFICATION SUITE ERROR:', err);
  } finally {
    await client.end();
  }

  console.log('\n=== VERIFICATION SUMMARY ===');
  const allPassed = results.every(r => r.passed);
  console.log(`TOTAL TESTS: ${results.length} | PASSED: ${results.filter(r => r.passed).length} | FAILED: ${results.filter(r => !r.passed).length}`);
  if (allPassed) {
    console.log('>>> ALL PHASE 05B ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY <<<');
  } else {
    console.log('>>> SOME VERIFICATION TESTS FAILED <<<');
    process.exit(1);
  }
}

verifyPhase05B();
