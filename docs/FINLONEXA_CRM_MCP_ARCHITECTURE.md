# FINLONEXA CRM v3 — Enterprise MCP Server Architecture

## 1. Executive Summary
The FINLONEXA CRM Model Context Protocol (MCP) Server enables compatible AI agents (Claude Desktop, Cursor, Gemini, custom LLM agents) to securely query and operate the FINLONEXA CRM system. It operates under a zero-trust model where an AI agent acts exclusively as an extension of an authenticated human CRM user, bound strictly by the user's canonical role, reporting hierarchy, dynamic feature permissions, and PostgreSQL Row-Level Security (RLS).

## 2. Architectural Principles
1. **Never More Privileged Than The User**: An AI client inherits the exact rights of the authenticated CRM user. Direct database service roles or elevated privileges are never exposed to the agent.
2. **Native Delegated Context**: All database interactions execute using the user's delegated Supabase session JWT, ensuring that database-level RLS policies evaluate `auth.uid() = user.id`.
3. **Multi-Layer Defense**:
   - Transport Security (HTTPS / SSE / Bearer Auth)
   - Dynamic RBAC & Hierarchy Scope (`SUPER_ADMIN` down to `BDO`)
   - Field-Level Masking (`crm_masked_reader` for sensitive financial/tax data)
   - Two-Step Confirmation for High-Impact / Destructive operations
   - Rate limiting and immutable audit logging

## 3. Component Diagram
```
+-----------------------------------------------------------+
|                        AI Agent                           |
|        (Cursor, Claude Desktop, Antigravity, Custom)      |
+-----------------------------+-----------------------------+
                              |
               Bearer Token   | Streamable HTTP (SSE)
                              v
+-----------------------------------------------------------+
|           FINLONEXA CRM MCP Server (apps/mcp-server)      |
|  - Auth Verification & Audience Check (finlonexa-crm-mcp) |
|  - Rate Limiter (120 req/min per user)                    |
|  - Dynamic RBAC & Hierarchy Resolver                      |
|  - Tool Catalog & Input Sanitizer (Zod)                   |
|  - Two-Step Confirmation Engine                           |
|  - Field-Level Masking Engine                             |
+-----------------------------+-----------------------------+
                              |
     Delegated User Session   | PostgREST / Supabase Client
                              v
+-----------------------------------------------------------+
|              Supabase PostgreSQL Database                |
|  - Row-Level Security (RLS) Enforced at PostgreSQL layer  |
|  - Canonical Role Hierarchy & Reporting Trees             |
|  - Audit Log Ledger                                       |
+-----------------------------------------------------------+
```
