# FINLONEXA CRM v3 — MCP Client Setup Guide

## Overview

The FINLONEXA CRM v3 MCP (Model Context Protocol) Server provides a secure, role-bounded, and RLS-enforced bridge for AI assistants (such as OpenAI Codex, Cursor, Claude Desktop, and ChatGPT) to interact with CRM data.

> **Zero Privilege Elevation Guarantee:** An AI agent connected via MCP can see, modify, and execute **only** what the authenticated FINLONEXA CRM user is authorized to see, modify, and execute in PostgreSQL.

---

## 1. Connection & Endpoint Specifications

| Specification | Value |
|---|---|
| **Server Name** | `finlonexa-crm-mcp-server` |
| **Protocol Version** | `2025-03-26` |
| **Primary Transport** | Streamable HTTP |
| **Primary Endpoint** | `http://127.0.0.1:3005/mcp` |
| **Legacy Fallback** | `GET http://127.0.0.1:3005/sse` + `POST http://127.0.0.1:3005/message` |
| **Health Check** | `GET http://127.0.0.1:3005/health` |
| **Protected Resource Metadata** | `GET http://127.0.0.1:3005/.well-known/oauth-protected-resource` |
| **Token Broker Endpoint** | `POST http://127.0.0.1:3005/auth/token` |
| **Expected Token Audience** | `finlonexa-crm-mcp` |
| **Required Header (Session)** | `Mcp-Session-Id: <session-id>` (returned upon initialization) |
| **Required Header (Protocol)** | `Mcp-Protocol-Version: 2025-03-26` |
| **Required Header (Accept)** | `application/json, text/event-stream` |

---

## 2. Authentication Methods

### Method A: Direct FINLONEXA CRM / Supabase User Token
Clients provide the user's active CRM JWT directly in the `Authorization` header:
```http
Authorization: Bearer <FINLONEXA_USER_TOKEN>
```
The MCP server uses this token for caller-bound identity verification and delegates queries to PostgreSQL via Supabase RLS.

### Method B: MCP Broker Token Exchange
Clients can exchange a user access token for a scoped, audience-bound token:
```bash
curl -X POST http://127.0.0.1:3005/auth/token \
  -H "Content-Type: application/json" \
  -d '{"access_token": "<FINLONEXA_USER_TOKEN>"}'
```
Response:
```json
{
  "token_type": "Bearer",
  "access_token": "<MCP_BROKER_TOKEN>",
  "expires_in": 28800,
  "scope": "crm:read crm:write",
  "user": {
    "id": "<user-uuid>",
    "email": "user@example.com",
    "fullName": "User Name",
    "role": "BDO"
  }
}
```

---

## 3. Client Integration Matrices

### OpenAI Codex CLI / Agent
- **Transport:** Streamable HTTP
- **Status:** CONFIGURATION DOCUMENTED (Streamable HTTP verified via automated CLI client test)
- **Configuration:**
  Pass the URL `http://127.0.0.1:3005/mcp` and `Authorization: Bearer <FINLONEXA_USER_TOKEN>`.

### Cursor IDE
- **Transport:** SSE / HTTP
- **Status:** CONFIGURATION DOCUMENTED
- **Settings (.cursor/mcp.json):**
  ```json
  {
    "mcpServers": {
      "finlonexa-crm": {
        "url": "http://127.0.0.1:3005/mcp",
        "headers": {
          "Authorization": "Bearer <FINLONEXA_USER_TOKEN>",
          "Mcp-Protocol-Version": "2025-03-26"
        }
      }
    }
  }
  ```

### Claude Desktop
- **Transport:** Streamable HTTP / SSE fallback
- **Status:** CONFIGURATION DOCUMENTED
- **Settings (claude_desktop_config.json):**
  ```json
  {
    "mcpServers": {
      "finlonexa-crm": {
        "url": "http://127.0.0.1:3005/sse",
        "headers": {
          "Authorization": "Bearer <FINLONEXA_USER_TOKEN>"
        }
      }
    }
  }
  ```

### ChatGPT (Developer Preview)
- **Transport:** Streamable HTTP
- **Status:** CONFIGURATION DOCUMENTED (requires public HTTPS reverse proxy with valid TLS certificate).

---

## 4. Production Deployment & Limitations

1. **Process-Local State:** Active Streamable HTTP sessions and confirmation tokens are currently in-memory. For horizontal multi-instance deployments, configure sticky routing or Redis-backed session management.
2. **Rate Limiting:** Enforces a per-user limit of 120 requests/minute stored in-memory.
3. **Environment Isolation:** The MCP server reads `MCP_JWT_SECRET` from its package-local `.env.local` or environment variables; never commit this secret to source control. For Vercel deployments, configure it as a server-side Environment Variable for every deployed environment that issues MCP broker tokens. `turbo.json` passes this variable to the build task so the production configuration check can run. Generate a unique random secret of at least 32 bytes; do not use a `NEXT_PUBLIC_` prefix.
