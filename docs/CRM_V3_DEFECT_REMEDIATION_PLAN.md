# CRM v3 Defect Remediation Plan

## Objective

Resolve the verified findings from the read-only CRM v3 audit while preserving existing behavior, authorization boundaries, and migration safety. The sequence below includes implementation and acceptance checks; no changes should be considered complete solely because the code compiles.

## Phase 1 — Restore the Static Baseline

- Update or regenerate the Supabase database types to include `crm_calendar_connections` with the columns used by the calendar sync route.
- Fix the TypeScript error in `apps/web/src/app/api/calendar/sync/route.ts`.
- Run `npm run typecheck` and address errors caused by the corrected types.

**Acceptance:** Web TypeScript check passes.

## Phase 2 — Secure MCP Destructive Actions and Identity

### Confirmation token binding

- Store the entity type and record ID in each pending confirmation.
- Require the execute request to match the stored entity and ID before consuming the token.
- Preserve expiry, single-use, and user binding.
- Test matching, mismatched entity, mismatched ID, expiry, replay, and wrong-user cases.

### Authentication and roles

- Remove the hardcoded JWT secret fallback; require `MCP_JWT_SECRET` in production and fail clearly if absent.
- Remove role elevation based on email local-part.
- Load active roles and permissions from database assignments only.
- Make roleless-user behavior explicit and least-privileged.
- Add tests proving unassigned users cannot acquire roles from their email.

### Audit persistence

- Check the Supabase insert result's `error` field as well as thrown exceptions.
- Ensure audit persistence failures are surfaced and do not produce a misleading success for integrity-sensitive actions.
- Avoid logging raw arguments that may include credentials or personal data.
- Test database success, database error, and thrown-error behavior.

**Acceptance:** Destructive tokens cannot authorize another target; only database roles authorize users; audit failures are observable.

## Phase 3 — Secure the SMTP Test Endpoint

- Remove `rejectUnauthorized: false` and use normal TLS certificate validation.
- Validate request field types, email addresses, SMTP host, and port.
- Apply an explicit host policy for custom SMTP if the product requires user-supplied hosts.
- Never return or log app passwords; keep authentication checks.
- Add route tests for bad inputs, TLS failure, unauthenticated access, and credential non-disclosure.

**Acceptance:** SMTP credentials are sent only over validated TLS and are not exposed in logs or responses.

## Phase 4 — Make Recycle-Bin Restore Lossless

- Remove the UI fallback that deletes a recycle-bin row when restore fails.
- Extend the restore RPC to restore complete stored record data and relationships for supported models, including campaigns.
- Make restore and recycle-bin-row deletion atomic; delete the recycle-bin row only after a successful restore.
- Keep restore and permanent-delete permissions separate.
- Add database and UI tests for each supported model and RPC failure.

**Acceptance:** A failed restore preserves the recycle-bin entry; a successful restore preserves the original record fields and links.

## Phase 5 — Protect Public Web-to-Lead

- Do not return an existing lead ID when a submission is deduplicated.
- Return a generic response that does not distinguish an existing record from a newly created one.
- Set explicit execution grants and revokes for the SECURITY DEFINER RPC.
- Validate and bound request payload size and fields.
- Add suitable rate limiting/abuse controls.
- Test inactive forms, duplicate requests, malformed/oversized requests, and unauthorized RPC execution.

**Acceptance:** Anonymous submissions disclose no CRM record identifiers and are bounded against abuse.

## Phase 6 — Normalize Opportunity Stages Consistently

- Use the shared canonical stage normalizer for frontend filters, dashboards, forecast calculations, badges, and campaign metrics.
- Align SQL functions and automation predicates with the same canonical set, including supported legacy labels.
- Define and test behavior for unknown stage values so they are not silently omitted from totals.
- Add regression tests for canonical and display-name forms of each terminal stage.

**Acceptance:** Equivalent stage spellings produce consistent list membership and dashboard/forecast/sales metrics.

## Phase 7 — Make MCP Security Tests Reliable

- Replace silent test skips after invalid sign-in with explicit test failures or a clearly marked required-environment gate.
- Ensure the role matrix actually runs for SUPER_ADMIN, HEAD_OF_SALES, RSM, SSM, ASM, and BDO.
- Add tests for role isolation, delegated RLS, confirmation-token target binding, and token replay.
- Keep credentials out of source-controlled defaults; use securely configured test secrets.

**Acceptance:** The test suite cannot report role/security coverage as passing when its role tests were skipped.

## Phase 8 — Verification and Release Gate

Run, in order:

1. `npm run typecheck`
2. `npm run test`
3. `npm --workspace=apps/mcp-server run test`
4. `npm run build`
5. Migration ordering and database migration checks in a disposable/test database.
6. Focused security/data-integrity verification for MCP roles and confirmations, recycle-bin restoration, public Web-to-Lead grants, and stage normalization.

Before release:

- Rotate/revoke any historical privileged Supabase credential.
- Configure and verify `MCP_JWT_SECRET`, service-role credentials, and SMTP credentials through the deployment secret manager.
- Track Google/Microsoft OAuth setup separately if still pending.
- Record results and residual gaps in the existing verification documentation.

**Final acceptance:** All focused tests and build gates pass; no finding remains open without an explicitly accepted risk and owner.
