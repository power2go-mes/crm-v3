# Dashboard data contract coordination — Antigravity-owned modules

Dashboard consumes these contracts through invoker/RLS SQL. Do not change Accounts/Contacts/Opportunities files from the Dashboard task.

Pending owner coordination: public.accounts.account_type (v2 accounts/dashboard.py:89), public.campaigns.campaign_type with owner-scoped RLS and editable campaigns.view permission (campaigns/dashboard.py:90), public.opportunities.lead_source (opportunities/dashboard.py:56). Latest verified database metadata returned none of these three columns. Preserve unknown values; do not guess backfills or replay 00006/003. No module schema changes were made for these dependencies.

The Dashboard table RPC safely reports absent columns and uses existing permitted fields; the chart RPC marks absent grouping columns unavailable. When module owner installs contracts, these fixed-name consumers can use them without a Dashboard rewrite. Contact widget also awaits contact_source. Clarify Campaign source table/owner/type/status column names before enabling its widget. Keep seven approved opportunity stages unchanged.

Coordination channel: Antigravity runs as an external IDE, not an addressable Codex chat in the discovered chat inventory. This file records the exact contract handoff; no message was sent to an unrelated chat or user account. Need owner acknowledgement before overlapping module DDL.
