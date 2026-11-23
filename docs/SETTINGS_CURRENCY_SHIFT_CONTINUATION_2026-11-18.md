# Settings continuation: deployed Shifts and Currency Management

18 November 2026. **IN PROGRESS / PARTIAL, not complete CRM or Settings parity.** User confirmed Antigravity stopped and Codex may resume migration ownership. Work remains confined to Settings and necessary shared types/cache integration. Protected Dashboard/Sales source, v2 and MES are unchanged.

## Implemented and installed

### Shift Hours

Re-ran the staged candidate's complete rollback suite against verified development project `bpwdxslrkgmcoewkwufu`: PASS. Moved its reviewed SQL to `supabase/migrations/202611180101_shift_hours.sql`, updated the verifier path and applied only that version. Installed-schema fixture rerun: PASS.

The previous migration-ownership blocker is resolved. Existing `202611180007_notifications` and other Antigravity migrations were preserved; no duplicate version007, old migration replay, database reset or bulk push occurred. Shift list/form/detail/delete,50-per-company cap, same/different working hours, both contained breaks and scoped atomic user assignment now have installed backend support. Source validation remains different from Business Hours: shifts require end-after-start on the same day, while Business Hours can span overnight. Browser acceptance remains unexecuted, so Shift entries move from BLOCKED to PARTIAL, not VERIFIED.

### Currency Management — `/settings/currencies`

Added actual Settings search/navigation entry and source-backed page/control family:

- Enable Multiple Currency. Explicit activation initializes the default from the **existing configured company currency**, with identity rate1. It never chooses an arbitrary replacement for missing/unsupported company data.
-307 currency codes/names copied read-only from v2's installed `moneyed.CURRENCIES`, excluding `XXX`, following `djmoney.settings.CURRENCY_CHOICES`. Historical codes are retained, not replaced by a modern abbreviated list. Company Settings' existing six-choice selector now uses the same complete source metadata and preserves an unrecognized existing value as a legacy option.
- Add Currency; edit non-default conversion rate/precision; default-currency edit only changes precision; Save, Save & New, Cancel, validation, loading/error/success feedback.
- Server-paged Currency grid: Currency Code, Currency, Default Currency, Conversion Rate, Active, Decimal Places, row Edit/Delete. Sorting/bulk selection were not exposed where source disables them. Default currency cannot be deleted through either UI or RPC.
- Update Conversion Rates, with required fields for every non-default currency and one atomic transaction. An invalid field cannot partially update earlier currencies.
- Dated Exchange Rates view, source date-range labels, URL `dated_exchange`/`start_date` state, Back, New Exchange Rates and atomic dated batches. Duplicate dates fail without partial persistence. Latest effective date at/before a requested date wins; absent history falls back to the static rate.
- Change Default Currency: updates the company currency, rebases configured static rates and preserves historical conversion behavior as approved below.
- Non-default delete explicitly confirms removal of its dated rates; disabling multiple currencies retains all configured rows/history.
- Source Frankfurter automatic quote lookup with source open.er-api.com fallback. Only draft fields populate; saving is explicit. Manual entry remains available on failure and is not overwritten by late automatic results. The quote action verifies a normal authenticated identity and effective create/update/view permission before any provider request.

## Approved history-preservation exception

Source inspection of `core/views/multiple_currency.py:424–539` found a two-currency defect: the routine collects target dated rates, deletes them, then derives dates for the old default only from remaining rows. With only two currencies there may be no remaining dated rows, causing a historical conversion to fall back to the static rate. This was a source-level finding, not an observed v2 browser/database run.

User explicitly approved **“Preserve and rebase dated history.”** Implemented a transactional, history-preserving rebase instead of copying that loss:

1. Serialize Currency mutations and validate the selected base and rate bounds.
2. Snapshot original currencies and dated rows in immutable `crm_currency_rebases`, with the authenticated actor and old/new currency codes.
3. Use the union of historical start dates and each currency's latest effective rate at each boundary.
4. Rebase all non-target currencies, including the former default, at each boundary. Existing dated row IDs survive for keys that remain; original target rows remain traceable in the protected snapshot, with target rate1 implicit after rebasing.
5. Rebase static rates, maintain one default at identity rate1 and update the singleton company's currency in the same transaction.
6. Roll back rates, default identity, company setting and audit snapshot together if anything fails. Zero effective divisors are rejected instead of inventing an exchange rate.

Executed regression: after changing the base in a two-currency setup, the historical0.80 rate yields the old currency's dated reciprocal1.2500, while static0.90 yields1.1111. The dated lookup retains1.2500 rather than falling back to1.1111. Also executed an overflow after intermediate rebase work: all rates/history/default/audit state rolled back correctly.

Storage follows source `numeric(10,4)`. Batch forms accept source `decimal(10,6)` inputs (four integer digits); database rounding to four fractional places is explicitly tested. Individual model forms allow six integer/four fractional digits. Source signed numeric values and integer precision settings were not silently clamped to arbitrary new UI ranges; zero cannot become a mathematically invalid base. Rebase work above50,000 history cells/rows fails without mutation and requires a future background implementation.

## Data, authorization and performance contracts

Applied migrations:

| Version | Purpose |
|---|---|
|202611180101 | Previously staged Shift Hours, now installed |
|202611180102 | Currency code metadata, configured currencies, dated rates, rebase snapshots and trusted mutation/read functions |
|202611180103 | Server-paged static/dated Currency catalog |

New tables: `crm_currency_codes`, `crm_currencies`, `crm_currency_rates`, `crm_currency_rebases`. Existing company configuration gains source-default `activate_multiple_currencies=false`. Installation seeds only source code/name metadata; it does not activate the feature, seed assumed FX prices, rewrite financial records or change existing company currency.

Permissions: `currencies.view/create/update/delete`, `currency_rates.view/create`. Activation and default-currency change additionally require editable `settings.update`. **No feature grants were automatically assigned**, including to SUPER_ADMIN. Verifier compares the relevant role-grant fingerprint before/after candidate DDL. Source choices are active-user metadata; stored rates and snapshot reads enforce their feature grants through RLS. Dated lookup cannot bypass denied dated-rate read permission. Raw authenticated writes to all new tables are denied; trusted functions derive the actor and independently validate feature grants. This organization-wide Settings catalog does not widen any Sales record scope or six-role hierarchy.

`company_currency_page` returns20 static rows and20 dated rows at most, with counts/default/code-selection metadata. Full rates load only when opening the bounded batch/default-selection forms. The configured catalog cannot exceed the307 source codes; the editor also fails closed above its explicit500-row capacity. The first implementation paged in the browser; final review identified and corrected that gap through additive103, with real page-boundary tests. Older date-range selection lists100 recent boundaries and offers an explicit date field for older selections rather than silently truncating access.

Quote helpers use fixed source HTTPS endpoints,10-second timeouts,512 KB response limits and exact string/BigInt rounding matching source Decimal ties-to-even at four places. No provider credentials or fabricated fallback rates are used. Query keys include authenticated identity/effective permissions; quote keys additionally include base/target. Company Settings invalidates both its own and Currency caches after save.

## Actual verification

| Check | Actual result |
|---|---|
| Final focused Settings tests | PASS:67 tests /14 files, including16 new Currency/quote/page contract tests |
| Focused changed-file ESLint | PASS, exit0 |
| Full web TypeScript | PASS, exit0 after server-pagination integration |
| Shift installed-schema rollback suite | PASS: CRUD, times, break containment, scope, atomic assignment failure,50 cap, paging and feature revocation |
| Currency installed-schema rollback suite | PASS: activation/CRUD, source precision rounding, static and dated rebases, history retention, overflow rollback, raw-read/write denials, revoked features, protected snapshots and six canonical identities versus current effective read grants |
| Pagination installed-schema rollback suite | PASS:22 configured fixture rows return20 then2;21 dated rows return20 then1; invalid pages fail and denied dated rows remain hidden |
| Provider unit tests | PASS: authorization, identity, primary/fallback, failure, unsupported input, ties-to-even and oversized-body fallback; mocked network |
| Live public provider connectivity | Both fixed source providers returned HTTP200 and a valid numeric test quote for USD/EUR. No customer data or provider mutation involved; this is not authenticated UI acceptance. |
| Final production build after paging integration | PASS: webpack compilation, full TypeScript,44 static page generations and route optimization, exit0. `/settings/currencies` and `/settings/business-hours` compile. Existing middleware deprecation warning remains; no unrelated codemod applied. |
| Runtime/browser inspection | BLOCKED: configured localhost3000 is an unrelated SolisCloud Solar/Battery/BMS application; `/login` and `/settings` also return404 there. Those responses are not evidence FINLONEXA routes are missing. No server stopped, alternate port opened or browser/login bypass used. |
| Comparative v2/v3 screenshots and authenticated interactions | NOT EXECUTED / BLOCKED under code-first scope and unavailable authorized CRM runtime/session |

Initial Currency unit failure was a fixture mistake: `BAD` is a real historical currency code in source. Changed only the invalid test input, preserving307 choices. The preliminary history-blocking guard was replaced before deployment after the user's explicit safe-rebase approval. Applied102 was not edited or replayed to add paging;103 is a forward migration.

Synthetic verification refuses to replace a nonempty real Currency catalog. Company flag/base updates exercised by the fixture remain inside the rolled-back transaction; no existing setting, role assignment, account or financial amount change is committed. Only reviewed additive DDL/source metadata commits. Existing test accounts and previous migration history are preserved.

## Files and source evidence

Implementation:

- `apps/web/src/app/(dashboard)/settings/currencies/{page.tsx,actions.ts}`
- `apps/web/src/lib/settings/{currencies,exchange-quotes}.ts`, `currency-choices.json` and focused tests
- Settings search/links, navigation permission map, existing Company Settings modal's currency choices/cache invalidation
- `packages/database/src/types.ts`: additive RPC contracts
- Above applied migrations; `scripts/verify-{shift-hours,currency-settings,currency-pagination}.cjs`
- `packages/crm-shared/tests/{currency-settings,currency-pagination}-rollback.sql`

Source, read-only:

- `core/models/finance.py:25–145,210–257,318–387`: MultipleCurrency, dated lookup/conversion helpers, default identity and DatedConversionRate.
- `core/views/multiple_currency.py:45–182`: activation/provider behavior;185–270 list controls;273–570 default changes;571–653 add/edit form;654–848 batch/dates;849 onwards deletion guard.
- `core/forms/currency.py:22–144`: default selector and dynamic static/dated rate form fields/precision.
- `core/templates/settings/multiple_currency.html`: controls, conditions, dated navigation and activation.
- `core/utils.py:37–98`: Frankfurter and secondary API fallback/Decimal quantization.
- Installed v2 `moneyed/classes.py`, `djmoney/settings.py:17–28`: actual choices. Extraction used source Python with `-B`; no v2 cache/files were written.
- `finlo_crm/opportunities/models.py:350` stores a Decimal amount. Default changes above do not rewrite record amounts, matching the inspected source operation's focus on rate/configuration metadata.

## Remaining parity and next checkpoint

These page families remain PARTIAL. Exact v2 menu/dropdown placement, responsive views, modal/keyboard/Back/Forward acceptance, user locale/format preferences and downstream financial/report/dashboard consumption have not been certified. The source bulk-rate form's optional inline new-default selector is not yet reproduced; the separate source Change Default Currency workflow is implemented with the approved safe rebase. Generic custom layouts/field restrictions and source Active-column interaction need a later source/runtime acceptance pass. Direct Company currency edits can diverge from the configured default catalog, as the inspected v2 Company save path also permits; resolving that coupling needs a deliberate workflow/integrity pass rather than silently relabeling data.

Additional strict integrity behavior: one configured row per currency code avoids ambiguous rate mappings; exact source duplicate handling was not runtime-tested. History snapshots are stored/permission-protected, but no dedicated rebase-history/restore UI is claimed. Large-history background rebases are not implemented. Existing raw REST classification masking and credential-rotation verification remain separate OPEN gates, with the Dashboard handoff still protected.

Resume existing queue at Fiscal Year configuration/preview/calendar (**R0015, R0029–R0033**) next. Inspect its actual standard/custom fiscal rules and consumers before implementing; do not assume the company start-month field alone supplies parity. Do not recreate the audit, repeat passing Shift/Currency work, or declare all Settings complete.
