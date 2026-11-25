import express, { Request, Response } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { authenticateMcpRequest, mintMcpSessionToken, AuthenticatedUserContext } from './auth.js';
import { crmTools } from './tools.js';
import { checkRateLimit, recordAudit } from './guardrails.js';

const app = express();
app.use(express.json());

// In-memory active transports indexed by sessionId
const activeTransports = new Map<string, { transport: SSEServerTransport; ctx: AuthenticatedUserContext }>();

/**
 * Creates and initializes a new ModelContextProtocol Server instance bound to the user context
 */
function createMcpServerInstance(userCtx: AuthenticatedUserContext): Server {
  const server = new Server(
    {
      name: 'finlonexa-crm-mcp-server',
      version: '3.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Tools discovery handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    // Return all supported tools with schema definitions
    return {
      tools: crmTools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
  });

  // Tools execution handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // 1. Rate limiting check
    checkRateLimit(userCtx.userId);

    // 2. Find tool
    const tool = crmTools.find((t) => t.name === name);
    if (!tool) {
      throw new Error(`Tool "${name}" not found in FINLONEXA CRM tool catalog.`);
    }

    try {
      // 3. Execute tool under authenticated user's delegated context
      const result = await tool.handler(args || {}, userCtx);

      // 4. Safe audit log
      await recordAudit(userCtx, {
        toolName: name,
        arguments: args || {},
        status: 'SUCCESS',
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err: any) {
      // 5. Audit failed/denied attempt
      await recordAudit(userCtx, {
        toolName: name,
        arguments: args || {},
        status: 'DENIED',
        errorMessage: err.message,
      });

      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `[CRM Security Error] ${err.message}`,
          },
        ],
      };
    }
  });

  return server;
}

/**
 * Health endpoint
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ONLINE',
    service: 'FINLONEXA CRM MCP Server',
    version: '3.0.0',
    activeSessions: activeTransports.size,
  });
});

/**
 * OAuth 2.1 / Broker Token Exchange
 * Allows an AI Agent or MCP Client to exchange validated Supabase credentials for an audience-bound MCP token
 */
app.post('/auth/token', async (req: Request, res: Response) => {
  const { access_token } = req.body;
  if (!access_token) {
    return res.status(400).json({ error: 'Missing access_token in request body.' });
  }

  try {
    const userCtx = await authenticateMcpRequest(`Bearer ${access_token}`);
    const mcpToken = mintMcpSessionToken(userCtx.userId, userCtx.email, access_token);

    res.json({
      token_type: 'Bearer',
      access_token: mcpToken,
      expires_in: 28800, // 8 hours
      scope: 'crm:read crm:write',
      user: {
        id: userCtx.userId,
        email: userCtx.email,
        fullName: userCtx.fullName,
        role: userCtx.primaryRole,
      },
    });
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

/**
 * Streamable SSE MCP Endpoint (GET /sse)
 * Authenticates user before establishing SSE connection.
 */
app.get('/sse', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  let userCtx: AuthenticatedUserContext;

  try {
    userCtx = await authenticateMcpRequest(authHeader);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
    return;
  }

  const transport = new SSEServerTransport('/message', res);
  const sessionId = transport.sessionId;

  activeTransports.set(sessionId, { transport, ctx: userCtx });
  console.log(`[MCP SSE] Client connected: ${userCtx.email} (${userCtx.primaryRole}) Session: ${sessionId}`);

  const mcpServer = createMcpServerInstance(userCtx);

  req.on('close', () => {
    activeTransports.delete(sessionId);
    console.log(`[MCP SSE] Client disconnected: ${sessionId}`);
  });

  await mcpServer.connect(transport);
});

/**
 * MCP Message Postback Endpoint (POST /message)
 */
app.post('/message', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const session = activeTransports.get(sessionId);

  if (!session) {
    res.status(404).json({ error: `Session not found or expired: ${sessionId}` });
    return;
  }

  await session.transport.handlePostMessage(req, res);
});

const PORT = parseInt(process.env.MCP_PORT || '3005', 10);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`FINLONEXA CRM MCP Server active on port ${PORT}`);
    console.log(`SSE URL:     http://localhost:${PORT}/sse`);
    console.log(`Message URL: http://localhost:${PORT}/message`);
    console.log(`Health:      http://localhost:${PORT}/health`);
    console.log(`=======================================================`);
  });
}

export { app, createMcpServerInstance };
