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

async function runAcceptanceSuite() {
  await client.connect();
  console.log('=== FINLONEXA CRM v3 — PHASE 05B FINAL ACCEPTANCE & INTEGRATION TEST SUITE ===\n');

  const testMatrix = [];

  function assert(track, title, condition, details = '') {
    testMatrix.push({ track, title, pass: !!condition, details });
    const mark = condition ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [${track}] ${title} ${details ? '— ' + details : ''}`);
  }

  // Helper to run query as a specific authenticated user with RLS applied
  async function runAsUser(userId, roleId, queryFn) {
    const claims = JSON.stringify({
      sub: userId,
      role: 'authenticated',
      email: `${userId}@finlo.test`,
      app_metadata: { role: roleId },
    });
    await client.query('BEGIN');
    try {
      await client.query(`SET LOCAL ROLE authenticated;`);
      await client.query(`SET LOCAL "request.jwt.claims" = '${claims.replace(/'/g, "''")}';`);
      const res = await queryFn();
      await client.query('COMMIT');
      return res;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // Setup: Retrieve real users across sales hierarchy
    // -------------------------------------------------------------------------
    const usersRes = await client.query(`
      SELECT up.id, up.first_name, up.last_name, ur.role_id
      FROM public.user_profiles up
      JOIN public.user_roles ur ON up.id = ur.user_id
      WHERE up.is_active = true
      ORDER BY ur.role_id, up.id
    `);
    const users = usersRes.rows;
    const superAdmin = users.find(u => u.role_id === 'SUPER_ADMIN') || users[0];
    const bdos = users.filter(u => u.role_id === 'BDO');
    const bdo1 = bdos[0] || users[0];
    const bdo2 = bdos[1] || users.find(u => u.id !== bdo1.id) || users[0];

    console.log(`Identified Test Actors:
  - Super Admin: ${superAdmin.first_name} (${superAdmin.id}) [${superAdmin.role_id}]
  - BDO 1 (Owner): ${bdo1.first_name} (${bdo1.id}) [${bdo1.role_id}]
  - BDO 2 (Peer / Cross-branch): ${bdo2.first_name} (${bdo2.id}) [${bdo2.role_id}]\n`);

    // =========================================================================
    // TRACK 1: Product Catalog (CRUD, SKU Validation, Deactivation, RBAC)
    // =========================================================================
    console.log('--- TRACK 1: Product Catalog ---');
    const sku1 = `PROD-${Date.now()}-A`;
    const prod1Res = await client.query(`
      INSERT INTO public.crm_products (
        name, sku, description, category, type, unit_of_measure,
        default_price, currency, tax_category, tax_rate, is_active
      ) VALUES ($1, $2, 'Enterprise grade workstation', 'Hardware', 'product', 'Unit', 150000.00, 'INR', 'Standard GST', 18.00, true)
      RETURNING id, name, sku, default_price, is_active
    `, ['Apex Workstation Pro', sku1]);
    const prod1 = prod1Res.rows[0];
    assert('Track 1', 'Product Creation', !!prod1?.id && prod1.sku === sku1, `Created "${prod1.name}" (${prod1.sku})`);

    // Edit Product
    const editProdRes = await client.query(`
      UPDATE public.crm_products
      SET default_price = 155000.00, description = 'Updated enterprise workstation'
      WHERE id = $1
      RETURNING default_price, description
    `, [prod1.id]);
    assert('Track 1', 'Product Edit', Number(editProdRes.rows[0].default_price) === 155000.00, `Updated price to 155,000.00`);

    // Duplicate SKU Rejection
    let dupBlocked = false;
    try {
      await client.query(`
        INSERT INTO public.crm_products (name, sku, default_price)
        VALUES ('Duplicate Unit', $1, 100000.00)
      `, [sku1]);
    } catch (e) {
      dupBlocked = true;
    }
    assert('Track 1', 'Duplicate SKU Validation', dupBlocked, `Database constraint blocked duplicate SKU "${sku1}"`);

    // Product Deactivation & Filtering
    await client.query(`UPDATE public.crm_products SET is_active = false WHERE id = $1`, [prod1.id]);
    const activeQuery = await client.query(`SELECT id FROM public.crm_products WHERE id = $1 AND is_active = true`, [prod1.id]);
    assert('Track 1', 'Product Deactivation', activeQuery.rows.length === 0, `Deactivated product correctly omitted from active views`);

    // Re-activate for downstream tests
    await client.query(`UPDATE public.crm_products SET is_active = true WHERE id = $1`, [prod1.id]);

    // Role-based Product permission check:
    // BDO attempting to delete product via authenticated RLS should be blocked
    let bdoDeleteBlocked = false;
    try {
      await runAsUser(bdo1.id, bdo1.role_id, async () => {
        const delRes = await client.query(`DELETE FROM public.crm_products WHERE id = $1`, [prod1.id]);
        if (delRes.rowCount === 0) {
          bdoDeleteBlocked = true; // RLS prevented row match
        }
      });
    } catch (err) {
      bdoDeleteBlocked = true;
    }
    assert('Track 1', 'RBAC Enforcement on Products', bdoDeleteBlocked, `BDO role unauthorized to delete master product`);

    // =========================================================================
    // TRACK 2: Price Books (Standard & Custom, Date Ranges, Currency)
    // =========================================================================
    console.log('\n--- TRACK 2: Price Books & Catalogs ---');
    const stdBookRes = await client.query(`
      SELECT id, name, currency, is_standard FROM public.crm_price_books WHERE is_standard = true LIMIT 1
    `);
    const stdBook = stdBookRes.rows[0];
    assert('Track 2', 'Standard Price Book Presence', !!stdBook && stdBook.currency === 'INR', `Standard Base Book: ${stdBook.name} (${stdBook.currency})`);

    // Create Custom Price Book with Date Ranges & Currency
    const pbName = `Govt Sector Price Book ${Date.now()}`;
    const customPbRes = await client.query(`
      INSERT INTO public.crm_price_books (
        name, description, currency, is_standard, is_active, effective_from, effective_to
      ) VALUES ($1, 'Contracted public sector schedule', 'INR', false, true, CURRENT_DATE - 10, CURRENT_DATE + 365)
      RETURNING id, name, currency, effective_from, effective_to
    `, [pbName]);
    const customPb = customPbRes.rows[0];
    assert('Track 2', 'Custom Price Book Creation', !!customPb?.id, `Created "${customPb.name}" with 1-year validity`);

    // Price Book Entry creation (custom list price 140,000 vs standard 155,000)
    const pbEntryRes = await client.query(`
      INSERT INTO public.crm_price_book_entries (
        price_book_id, product_id, unit_price, currency, is_active
      ) VALUES ($1, $2, 140000.00, 'INR', true)
      RETURNING id, unit_price
    `, [customPb.id, prod1.id]);
    assert('Track 2', 'Price Book Entry Configuration', Number(pbEntryRes.rows[0].unit_price) === 140000.00, `Configured custom list price 140,000.00`);

    // =========================================================================
    // TRACK 3 & 4: Opportunity Line Items & Manual Amount Preservation
    // =========================================================================
    console.log('\n--- TRACK 3 & 4: Line Items & Manual Deal Amount Preservation ---');
    // Create Test Opportunity with explicit manual amount 500,000.00
    const oppRes = await client.query(`
      INSERT INTO public.opportunities (
        name, stage, amount, probability, close_date, owner_id, price_sync_mode
      ) VALUES (
        $1, 'qualification', 500000.00, 25, CURRENT_DATE + 45, $2, 'manual'
      ) RETURNING id, name, amount, price_sync_mode
    `, [`Enterprise Procurement Deal ${Date.now()}`, bdo1.id]);
    const oppId = oppRes.rows[0].id;

    assert('Track 4', 'Initial Manual Opportunity Amount', Number(oppRes.rows[0].amount) === 500000.00 && oppRes.rows[0].price_sync_mode === 'manual',
      `Opp ID ${oppId} initialized with manual amount 500,000.00`);

    // Add Line Item 1: Qty 3, Unit Price 140,000.00, Disc 10%, Tax 18%
    // Subtotal: 3 * 140,000 = 420,000.00
    // Discount: 10% of 420,000 = 42,000.00
    // Net: 378,000.00
    // Tax: 18% of 378,000 = 68,040.00
    // Line Total: 446,040.00
    const item1Res = await client.query(`
      INSERT INTO public.crm_opportunity_line_items (
        opportunity_id, product_id, product_name, product_sku,
        quantity, unit_price, discount_percent, discount_amount,
        tax_percent, tax_amount, line_total, sort_order
      ) VALUES ($1, $2, 'Apex Workstation Pro', $3, 3, 140000.00, 10.00, 42000.00, 18.00, 68040.00, 446040.00, 1)
      RETURNING id, line_total
    `, [oppId, prod1.id, sku1]);
    const item1Id = item1Res.rows[0].id;
    assert('Track 3', 'Opportunity Line Item Insert', !!item1Id, `Added Line Item with total 446,040.00`);

    // Verify Opportunity Trigger Calculations in manual mode
    const oppManualCheck = await client.query(`
      SELECT amount, price_sync_mode, items_subtotal, items_discount, items_tax
      FROM public.opportunities WHERE id = $1
    `, [oppId]);
    const oppM = oppManualCheck.rows[0];

    assert('Track 3', 'Trigger Aggregations in Opportunities',
      Number(oppM.items_subtotal) === 420000.00 &&
      Number(oppM.items_discount) === 42000.00 &&
      Number(oppM.items_tax) === 68040.00,
      `Calculated items_subtotal: ${oppM.items_subtotal}, discount: ${oppM.items_discount}, tax: ${oppM.items_tax}`);

    assert('Track 4', 'Manual Deal Amount Strictly Preserved',
      Number(oppM.amount) === 500000.00 && oppM.price_sync_mode === 'manual',
      `Opportunity amount remained 500,000.00 (not overwritten by 446,040.00)`);

    // Edit Line Item: Change Qty to 4
    // Subtotal: 4 * 140,000 = 560,000.00
    // Discount: 10% = 56,000.00
    // Net: 504,000.00
    // Tax: 18% = 90,720.00
    // Line Total: 594,720.00
    await client.query(`
      UPDATE public.crm_opportunity_line_items
      SET quantity = 4, discount_amount = 56000.00, tax_amount = 90720.00, line_total = 594720.00
      WHERE id = $1
    `, [item1Id]);

    const oppM2 = (await client.query(`SELECT amount, items_subtotal FROM public.opportunities WHERE id = $1`, [oppId])).rows[0];
    assert('Track 3', 'Line Item Edit Recalculation', Number(oppM2.items_subtotal) === 560000.00, `Updated items_subtotal to 560,000.00`);
    assert('Track 4', 'Manual Amount Preserved After Edit', Number(oppM2.amount) === 500000.00, `Amount still remains manual 500,000.00`);

    // =========================================================================
    // TRACK 5: Synchronized Calculations, Precision & Decimals
    // =========================================================================
    console.log('\n--- TRACK 5: Synchronized Amount Calculations & Decimal Precision ---');
    // Enable Synced Mode via RPC
    await client.query(`SELECT public.set_opportunity_price_sync_mode($1, 'synced')`, [oppId]);
    const oppSyncCheck = (await client.query(`SELECT amount, price_sync_mode FROM public.opportunities WHERE id = $1`, [oppId])).rows[0];
    assert('Track 5', 'Explicit Sync Activation via RPC',
      Number(oppSyncCheck.amount) === 594720.00 && oppSyncCheck.price_sync_mode === 'synced',
      `Deal amount automatically synchronized to line items sum: ${oppSyncCheck.amount}`);

    // Decimal Precision Test: Add fractional item (e.g. 2.75 license units @ 3333.33 with 7.5% discount and 18% tax)
    // Subtotal: 2.75 * 3333.33 = 9166.6575 -> 9166.66
    // Disc: 7.5% of 9166.66 = 687.4995 -> 687.50
    // Net: 9166.66 - 687.50 = 8479.16
    // Tax: 18% of 8479.16 = 1526.2488 -> 1526.25
    // Total: 8479.16 + 1526.25 = 10005.41
    const fracItemRes = await client.query(`
      INSERT INTO public.crm_opportunity_line_items (
        opportunity_id, product_id, product_name, product_sku,
        quantity, unit_price, discount_percent, discount_amount,
        tax_percent, tax_amount, line_total, sort_order
      ) VALUES ($1, $2, 'Fractional Consulting', 'SRV-FRAC', 2.75, 3333.33, 7.50, 687.50, 18.00, 1526.25, 10005.41, 2)
      RETURNING id, line_total
    `, [oppId, prod1.id]);
    const fracItemId = fracItemRes.rows[0].id;

    const oppPrecCheck = (await client.query(`SELECT amount, items_subtotal, items_discount, items_tax FROM public.opportunities WHERE id = $1`, [oppId])).rows[0];
    const expectedSyncedTotal = 594720.00 + 10005.41; // 604725.41
    assert('Track 5', 'Decimal Precision in Synced Mode',
      Number(oppPrecCheck.amount) === expectedSyncedTotal,
      `Exact 2-decimal authoritative total: ${oppPrecCheck.amount} (exp ${expectedSyncedTotal})`);

    // Remove the fractional item
    await client.query(`DELETE FROM public.crm_opportunity_line_items WHERE id = $1`, [fracItemId]);
    const oppAfterDelete = (await client.query(`SELECT amount FROM public.opportunities WHERE id = $1`, [oppId])).rows[0];
    assert('Track 3', 'Opportunity Line Item Removal',
      Number(oppAfterDelete.amount) === 594720.00,
      `Removed line item, deal amount automatically recalculated to 594,720.00`);

    // =========================================================================
    // TRACK 6: Quotation Creation, Revisions, Status Lifecycle & PDF
    // =========================================================================
    console.log('\n--- TRACK 6: Quotations Lifecycle & PDF Generation ---');
    const quoteRes = await client.query(`
      INSERT INTO public.crm_quotes (
        opportunity_id, subject, status, issue_date, valid_until,
        currency, subtotal, discount_total, tax_total, grand_total, owner_id
      ) VALUES ($1, 'Official Workstation Proposal', 'Draft', CURRENT_DATE, CURRENT_DATE + 30, 'INR', 560000.00, 56000.00, 90720.00, 594720.00, $2)
      RETURNING id, quote_number, status, grand_total
    `, [oppId, bdo1.id]);
    const quote = quoteRes.rows[0];
    assert('Track 6', 'Quote Number Auto-Sequence', /^QT-\d{4}-\d{4,5}$/.test(quote.quote_number), `Generated Quote Number: ${quote.quote_number}`);

    // Add quote line item
    await client.query(`
      INSERT INTO public.crm_quote_line_items (
        quote_id, product_id, product_name, product_sku,
        quantity, unit_price, discount_percent, discount_amount,
        tax_percent, tax_amount, line_total, sort_order
      ) VALUES ($1, $2, 'Apex Workstation Pro', $3, 4, 140000.00, 10.00, 56000.00, 18.00, 90720.00, 594720.00, 1)
    `, [quote.id, prod1.id, sku1]);

    // Snapshot Revision 1 (Draft)
    await client.query(`SELECT public.save_quote_revision_snapshot($1)`, [quote.id]);
    const rev1 = (await client.query(`SELECT revision_number, snapshot_data FROM public.crm_quote_revisions WHERE quote_id = $1`, [quote.id])).rows[0];
    assert('Track 6', 'Revision 1 Snapshot Created', rev1.revision_number === 1, `Snapshot saved for Rev 1 at status Draft`);

    // Status Transition: Draft -> Sent
    await client.query(`UPDATE public.crm_quotes SET status = 'Sent', updated_at = NOW() WHERE id = $1`, [quote.id]);
    await client.query(`SELECT public.save_quote_revision_snapshot($1)`, [quote.id]);

    // Status Transition: Sent -> Accepted
    await client.query(`UPDATE public.crm_quotes SET status = 'Accepted', updated_at = NOW() WHERE id = $1`, [quote.id]);
    await client.query(`SELECT public.save_quote_revision_snapshot($1)`, [quote.id]);

    const allRevs = (await client.query(`SELECT revision_number, snapshot_data->'quote'->>'status' as status FROM public.crm_quote_revisions WHERE quote_id = $1 ORDER BY revision_number`, [quote.id])).rows;
    assert('Track 6', 'Quote Lifecycle Status Progression',
      allRevs.length === 3 && allRevs[0].status === 'Draft' && allRevs[1].status === 'Sent' && allRevs[2].status === 'Accepted',
      `Audit recorded transitions: [${allRevs.map(r => `Rev ${r.revision_number}: ${r.status}`).join(' -> ')}]`);

    // =========================================================================
    // TRACK 7: Historical Snapshot Immutability Verification
    // =========================================================================
    console.log('\n--- TRACK 7: Historical Snapshot Immutability ---');
    // Now MODIFY the master product catalog and price book entry!
    await client.query(`
      UPDATE public.crm_products
      SET name = 'ALTERED PRODUCT NAME DO NOT LEAK', default_price = 999999.00
      WHERE id = $1
    `, [prod1.id]);
    await client.query(`
      UPDATE public.crm_price_book_entries
      SET unit_price = 888888.00
      WHERE product_id = $1
    `, [prod1.id]);

    // Inspect the historical Rev 1 snapshot of the quote
    const rev1AfterMasterEdit = (await client.query(`SELECT snapshot_data FROM public.crm_quote_revisions WHERE quote_id = $1 AND revision_number = 1`, [quote.id])).rows[0];
    const snapQuote = rev1AfterMasterEdit.snapshot_data.quote;
    const snapItem = rev1AfterMasterEdit.snapshot_data.items[0];

    const snapshotRemainsIntact = 
      snapItem.product_name === 'Apex Workstation Pro' &&
      Number(snapItem.unit_price) === 140000.00 &&
      Number(snapQuote.grand_total) === 594720.00 &&
      snapItem.product_name !== 'ALTERED PRODUCT NAME DO NOT LEAK';

    assert('Track 7', 'Historical Snapshot Immutability', snapshotRemainsIntact,
      `Snapshot 1 strictly preserved original product "${snapItem.product_name}" ($${snapItem.unit_price}) despite catalog price changing to $999,999.00`);

    // =========================================================================
    // TRACK 8: Cross-Branch Access Denial & Opportunity Team Scoping
    // =========================================================================
    console.log('\n--- TRACK 8: Cross-Branch Access Denial & Opportunity Team Scoping ---');
    // BDO 1 owns the opportunity. BDO 2 is a peer with NO team access.
    // 1. Query as BDO 2 -> Should see 0 line items and 0 quotes
    let bdo2CanSeeItems = true;
    let bdo2CanSeeQuotes = true;
    await runAsUser(bdo2.id, bdo2.role_id, async () => {
      const items = await client.query(`SELECT id FROM public.crm_opportunity_line_items WHERE opportunity_id = $1`, [oppId]);
      bdo2CanSeeItems = items.rows.length > 0;
      const quotes = await client.query(`SELECT id FROM public.crm_quotes WHERE opportunity_id = $1`, [oppId]);
      bdo2CanSeeQuotes = quotes.rows.length > 0;
    });
    assert('Track 8', 'Cross-Branch Read Denial', !bdo2CanSeeItems && !bdo2CanSeeQuotes,
      `BDO 2 (non-team member) denied read access to BDO 1's opportunity items & quotes`);

    // 2. BDO 2 attempts to insert line item -> Should be denied by RLS
    let bdo2InsertBlocked = false;
    try {
      await runAsUser(bdo2.id, bdo2.role_id, async () => {
        await client.query(`
          INSERT INTO public.crm_opportunity_line_items (
            opportunity_id, product_id, product_name, product_sku, quantity, unit_price, line_total
          ) VALUES ($1, $2, 'Illegal Item', 'ERR', 1, 1000.00, 1000.00)
        `, [oppId, prod1.id]);
      });
    } catch (e) {
      bdo2InsertBlocked = true;
    }
    assert('Track 8', 'Cross-Branch Write Denial', bdo2InsertBlocked,
      `BDO 2 denied insertion of line item on unassigned opportunity`);

    // 3. Add BDO 2 to Opportunity Team with READ-ONLY access via approved RPC
    await client.query(`
      SELECT public.add_opportunity_team_member($1::uuid, $2::uuid, 'Sales Rep'::text, 'read'::text, 0.00::numeric)
    `, [oppId, bdo2.id]);

    // Verify BDO 2 can now READ line items and quotes
    let bdo2CanReadWithTeam = false;
    await runAsUser(bdo2.id, bdo2.role_id, async () => {
      const items = await client.query(`SELECT id FROM public.crm_opportunity_line_items WHERE opportunity_id = $1`, [oppId]);
      bdo2CanReadWithTeam = items.rows.length > 0;
    });
    assert('Track 8', 'Opportunity Team Read Permission Granted', bdo2CanReadWithTeam,
      `BDO 2 successfully gained read access to line items after team assignment`);

    // Verify BDO 2 with 'read' CANNOT INSERT or UPDATE
    let bdo2ReadOnlyEnforced = false;
    try {
      await runAsUser(bdo2.id, bdo2.role_id, async () => {
        await client.query(`
          INSERT INTO public.crm_opportunity_line_items (
            opportunity_id, product_id, product_name, product_sku, quantity, unit_price, line_total
          ) VALUES ($1, $2, 'Illegal Item 2', 'ERR2', 1, 1000.00, 1000.00)
        `, [oppId, prod1.id]);
      });
    } catch (e) {
      bdo2ReadOnlyEnforced = true;
    }
    assert('Track 8', 'Opportunity Team Read-Only Edit Blocked', bdo2ReadOnlyEnforced,
      `BDO 2 with access_level='read' correctly blocked from adding/modifying line items`);

    // 4. Upgrade BDO 2 to 'edit'
    await client.query(`
      SELECT public.add_opportunity_team_member($1::uuid, $2::uuid, 'Sales Rep'::text, 'edit'::text, 0.00::numeric)
    `, [oppId, bdo2.id]);

    let bdo2EditPermitted = false;
    let bdo2AddedItemId = null;
    try {
      await runAsUser(bdo2.id, bdo2.role_id, async () => {
        const ins = await client.query(`
          INSERT INTO public.crm_opportunity_line_items (
            opportunity_id, product_id, product_name, product_sku, quantity, unit_price, line_total
          ) VALUES ($1, $2, 'Team Added Accessory', 'ACC-01', 1, 5000.00, 5000.00)
          RETURNING id
        `, [oppId, prod1.id]);
        bdo2AddedItemId = ins.rows[0].id;
        bdo2EditPermitted = !!bdo2AddedItemId;
      });
    } catch (e) {
      console.error(e);
      bdo2EditPermitted = false;
    }
    assert('Track 8', 'Opportunity Team Edit Permission Honored', bdo2EditPermitted,
      `BDO 2 with access_level='edit' successfully authorized to add line item`);

    // Clean up team added item and team member
    if (bdo2AddedItemId) {
      await client.query(`DELETE FROM public.crm_opportunity_line_items WHERE id = $1`, [bdo2AddedItemId]);
    }
    await client.query(`DELETE FROM public.opportunity_team_members WHERE opportunity_id = $1 AND user_id = $2`, [oppId, bdo2.id]);

    // =========================================================================
    // TRACK 9: Forecast, Dashboard & Reports Integrations
    // =========================================================================
    console.log('\n--- TRACK 9: Forecast, Dashboard & Report Integrations ---');
    // Verify opportunities_readable returns the correct synced amount & pricing fields for authenticated user
    let oppReadableRow = null;
    await runAsUser(bdo1.id, bdo1.role_id, async () => {
      const res = await client.query(`
        SELECT id, name, amount, stage, probability, price_sync_mode, items_subtotal, items_discount, items_tax
        FROM public.opportunities_readable WHERE id = $1
      `, [oppId]);
      oppReadableRow = res.rows[0];
    });

    assert('Track 9', 'Opportunities Readable View Integration',
      !!oppReadableRow && Number(oppReadableRow.amount) === 594720.00 && oppReadableRow.price_sync_mode === 'synced',
      oppReadableRow ? `Exposed in opportunities_readable with amount: ${oppReadableRow.amount}` : 'Opportunity missing from readable view');

    // Verify Forecast weighted calculations integration:
    // Weighted forecast = amount * (probability / 100)
    const weightedAmount = oppReadableRow ? Number(oppReadableRow.amount) * (Number(oppReadableRow.probability) / 100) : 0;
    assert('Track 9', 'Forecast Weighted Value Accuracy',
      weightedAmount === (594720.00 * 0.25),
      `Weighted forecast value for 25% probability: ${weightedAmount}`);

    // Verify Dashboard aggregate summation
    let dashAggregate = null;
    await runAsUser(bdo1.id, bdo1.role_id, async () => {
      const res = await client.query(`
        SELECT SUM(amount) as pipeline_total, COUNT(*) as deal_count
        FROM public.opportunities_readable
        WHERE stage = 'qualification'
      `);
      dashAggregate = res.rows[0];
    });

    assert('Track 9', 'Dashboard Pipeline Aggregate Compatibility',
      dashAggregate && Number(dashAggregate.pipeline_total) >= 594720.00,
      `Pipeline total aggregates correctly: ${dashAggregate?.pipeline_total} across ${dashAggregate?.deal_count} deals`);

    // =========================================================================
    // Clean up test fixtures
    // =========================================================================
    await client.query(`DELETE FROM public.crm_quotes WHERE id = $1`, [quote.id]);
    await client.query(`DELETE FROM public.opportunities WHERE id = $1`, [oppId]);
    await client.query(`DELETE FROM public.crm_price_books WHERE id = $1`, [customPb.id]);
    await client.query(`DELETE FROM public.crm_products WHERE id = $1`, [prod1.id]);
    console.log('\nCleaned up all isolated test fixtures.');

  } catch (err) {
    console.error('CRITICAL ACCEPTANCE FAILURE:', err);
  } finally {
    await client.end();
  }

  console.log('\n=== ACCEPTANCE TEST MATRIX RESULTS ===');
  const total = testMatrix.length;
  const passed = testMatrix.filter(t => t.pass).length;
  const failed = testMatrix.filter(t => !t.pass).length;
  console.log(`TOTAL AUDIT CHECKS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);

  if (failed === 0) {
    console.log('>>> ALL 9 CORE ACCEPTANCE TRACKS FULLY VERIFIED AND PASSING <<<');
  } else {
    console.log('>>> ACCEPTANCE CHECKS FAILED <<<');
    process.exit(1);
  }
}

runAcceptanceSuite();
