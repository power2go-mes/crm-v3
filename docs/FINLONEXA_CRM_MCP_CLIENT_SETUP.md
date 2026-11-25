# FINLONEXA CRM MCP Server — Client Setup Guide

## 1. Starting the MCP Server
Run the MCP server from the repository root:
```bash
npm --workspace=@finlonexa/mcp-server start
```
The server will bind to port `3005` (configurable via `MCP_PORT`).
- SSE URL: `http://localhost:3005/sse`
- Message URL: `http://localhost:3005/message`
- Health check: `http://localhost:3005/health`

## 2. Authentication Setup
Obtain a valid CRM session access token by signing in to the FINLONEXA CRM web application or via `/auth/token`.

## 3. Configuring Claude Desktop
Add the following to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "finlonexa-crm": {
      "command": "node",
      "args": ["C:/Users/izhar/Desktop/crm-v3/apps/mcp-server/dist/index.js"],
      "env": {
        "NEXT_PUBLIC_SUPABASE_URL": "https://bpwdxslrkgmcoewkwufu.supabase.co",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY": "sb_publishable_V1mUPdapSkd8PUJKe8ajZA_wvPz65q6",
        "MCP_PORT": "3005"
      }
    }
  }
}
```

## 4. Configuring Cursor / Remote AI Clients
For remote or SSE connections, configure the client to connect to:
- **Endpoint**: `http://localhost:3005/sse`
- **Headers**:
  ```http
  Authorization: Bearer <USER_SESSION_JWT>
  ```
