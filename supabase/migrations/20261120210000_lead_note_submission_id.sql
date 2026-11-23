begin;
-- Permit an idempotency ID for a combined note and attachment submission.
-- Lead scope and actor checks still run through the existing insert policy.
grant insert (id) on public.lead_notes to authenticated;
commit;
