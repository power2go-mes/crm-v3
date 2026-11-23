# Shared CRM engines (Codex-owned)

Isolated backend/metadata infrastructure for the v2 migration. No React components,
Leads hooks, shell, authentication or existing database types were changed.

See [integration contracts](../../docs/CODEX_SHARED_ENGINES_INTEGRATION.md).
The SQL migration is **unapplied** and registers no business modules.
Until an approved INVOKER access adapter is bound, record values/history fail closed.
These services are not integrated end-user features.

Run from the repository root:

    node node_modules/vitest/vitest.mjs run --config packages/crm-shared/vitest.config.ts
    node node_modules/typescript/bin/tsc --project packages/crm-shared/tsconfig.json

No install, database connection, build, server or application-state mutation is needed.
Tests use synthetic data and Python's standard ZIP/XML reader for XLSX verification.
The separate isolated-database.sql suite is opt-in and was NOT executed.
