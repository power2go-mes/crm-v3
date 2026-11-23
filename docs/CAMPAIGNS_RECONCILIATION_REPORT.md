# Campaign reconciliation and operational workflows

17 November 2026. **PARTIAL — not Phase 03 or visual completion.** User confirmed no other migration owner and authorized Codex reconciliation. User separately directed: keep Dashboard protected and retain the staged field-security handoff.

## Installed schema reconciliation

Preserved `202611170004_phase3_operational_modules.sql`, its installed rows and its existing unnamed/statement-less receipt. No old migration was replayed and no historic statement provenance was fabricated.

Applied uniquely versioned forward migrations:

| Version | Change |
| --- | --- |
| 202611170005 | Restrictive target-record policy fixes the executed Campaign member cross-scope P0. Existing Campaign/feature policies remain in force. |
| 202611170006 | Member uniqueness indexes, source member-type default/required status, transactionally recalculated Lead/Contact/response/converted counters. Old/new Campaign counters handled when membership changes Campaign. |
| 202611170007 | Source-backed SET NULL retention of member links on target deletion, consistent type constraints, actor derivation/immutability, conversion-triggered counters. Old unknown actors remain NULL. Also fixes readonly optional classification inserts: an omitted NULL value does not count as a forbidden field write. Explicit changes remain denied. |
| 202611170008 | Counter semantics match v2 recalculate_metrics: historical orphan memberships still count by member_type rather than requiring a live target. |
| 202611170009 | V2 Opportunity `primary_campaign_source` FK represented as nullable primary_campaign_source_id, with scoped reference guard/index and SET NULL deletion semantics. Existing Opportunities remain NULL; associations were not inferred. |

No migration bulk-recomputed existing Campaign business metrics. Derived counters update on future authorized member/conversion operations. Existing counter reconciliation, if required, needs an explicit data-repair procedure using authoritative links.

## Operational code added

- `/campaigns/[id]`: Campaign record fields/counters, owner presentation, parent/child navigation and Campaign Members. Its new summary read explicitly omits protected campaign_type pending the field-reader cutover.
- `components/campaigns/campaign-members.tsx`: bounded authenticated member list, visible Lead/Contact choices, member add, source-status edit and removal. Shared DataGrid and current-user query invalidation reused.
- `lib/campaigns/members.ts`: authenticated feature checks, validated IDs/status, exactly one target, parent-Campaign binding on updates/removal. Database policy/constraints provide independent enforcement; browser checks are not the security boundary.
- Campaign list names link to the new detail route.
- `hooks/use-campaigns.ts`: related Opportunities now use source-backed primary_campaign_source_id instead of nonexistent campaign_id; errors surface instead of returning fake empty results. Query key includes actor/role/permission signature and results are bounded.
- Shared database types reconciled with the actual installed member table instead of retaining duplicate table declarations.

The source status identifier **recieved** is deliberately retained. No Opportunity stage configuration was changed.

## Executed evidence

PASS, installed-schema rollback tests:

- Inaccessible Lead membership rejected; visible membership accepted.
- Member add/status/remove, duplicate rejection and preservation of other members.
- Lead/Contact/responded/converted counter values and response decrement.
- New Lead conversion refreshes the linked Campaign converted count.
- Deleting the synthetic Lead retains its membership with a NULL target; historic membership count remains source-correct.
- Forged created_by_id replaced with authenticated actor; historic unknown actors not guessed.
- Optional readonly NULL default permits otherwise authorized Account creation, allowing conversion while explicit classification changes remain denied by the existing write tests.
- Valid Opportunity–Campaign association persists; foreign-scope association rejected and previous link retained.

All synthetic records/users/mutations were rolled back. No real business record was used for mutation testing. One retention verification connection failed; retry exposed a genuine readonly-default defect, which was corrected and retested before installation. Failed runs were not counted as PASS.

PASS: 19 focused tests (Campaign validation/actions/member authorization/query contracts and existing navigation tests); focused Campaign ESLint. Full web TypeScript and webpack production build passed, including the new Campaign detail route. No shared-toolbar modification was necessary because the owner had already corrected the Tasks prop interface.

Reproduction commands from repository root:

- `node scripts/verify-installed-campaign-scope.cjs bpwdxslrkgmcoewkwufu`
- `node scripts/verify-campaign-count-semantics.cjs bpwdxslrkgmcoewkwufu`
- `node scripts/verify-campaign-opportunities.cjs bpwdxslrkgmcoewkwufu`

These inspect matching forward receipts and run rollback fixtures; do not run old uninstalled candidates against the installed 004 schema. Installed statements and original 004 provenance are distinct evidence.

## Field-security decision and browser acceptance

Raw REST field masking remains OPEN. The tested reader boundary remains outside executable migrations in `docs/staged-sql/202611170003_field_read_boundary.sql`. Deployment requires coordinated module/Dashboard reader changes. The user explicitly chose **Keep Dashboard protected; retain staged handoff**. No Dashboard source/migration or privileged credential was changed. See `FIELD_READ_SECURITY_CUTOVER.md`.

Browser/visual acceptance: BLOCKED by the previously denied Chrome computer-use access. No member button click, browser Back/Forward or matching v2 screenshot comparison is marked PASS.

## Remaining gaps and next work

Campaign source owner picker/assignment, complete original tabs, advanced filters/bulk/export/recycle, metadata/wizard layouts and exact controls remain unfinished. Opportunity-derived financial totals are not yet maintained by these member-counter triggers. V2 recalculate_metrics uses stage.is_final for its won aggregate; its mapping to the approved seven-stage won/lost semantics needs explicit reconciliation before implementation. Do not invent totals or treat every final stage as an approved win.

Next Campaign work: related Opportunity display/metrics contract, owner assignment and source tabs/advanced actions; field-read deployment stays blocked by the protected Dashboard scope. Calls/Meetings/Activities/Reports/Settings/Automation/Communications/Booking remain in the existing application queue and are not certified complete by these changes.
