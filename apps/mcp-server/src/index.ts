import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { authenticateMcpRequest, mintMcpSessionToken, AuthenticatedUserContext } from './auth';
import { crmTools } from './tools';
import { checkRateLimit, recordAudit } from './guardrails';

const app = express();
app.use(express.json());

// In-memory active transports indexed by sessionId
const activeTransports = new Map<string, { transport: SSEServerTransport; ctx: AuthenticatedUserContext }>();
const activeStreamableSessions = new Map<
  string,
  { transport: StreamableHTTPServerTransport; server: Server; ctx: AuthenticatedUserContext }
>();

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
    let result: unknown;
    try {
      checkRateLimit(userCtx.userId);
      const tool = crmTools.find((candidate) => candidate.name === name);
      if (!tool) {
        throw new Error(`Tool "${name}" not found in FINLONEXA CRM tool catalog.`);
      }
      result = await tool.handler(args || {}, userCtx);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown tool error';
      const status =
        /^(access denied|permission denied|rate limit exceeded|tool ".+" not found)/i.test(
        errorMessage
        )
        ? 'DENIED'
        : 'FAILED';
      try {
        await recordAudit(userCtx, {
          toolName: name,
          arguments: args || {},
          status,
        });
      } catch {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `[CRM MCP Error] Tool returned an error (${errorMessage}), and its failure audit could not be saved. Any partial effects are unverified; inspect CRM before retrying.`,
            },
          ],
        };
      }

      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `[CRM Tool Error] ${errorMessage}`,
          },
        ],
      };
    }

    let resultText: string | undefined;
    try {
      resultText = JSON.stringify(result, null, 2);
    } catch {
      resultText = undefined;
    }

    try {
      await recordAudit(userCtx, {
        toolName: name,
        arguments: {},
        status: 'SUCCESS',
      });
    } catch {
      return {
        content: [
          {
            type: 'text',
            text:
              resultText === undefined
                ? 'Tool completed, but its result could not be serialized and its audit could not be saved. Verify the action before retrying.'
                : `${resultText}\n\n[Audit warning] Tool completed, but its audit could not be saved. Do not retry; verify the action in CRM.`,
          },
        ],
      };
    }

    if (resultText === undefined) {
      return {
        content: [
          {
            type: 'text',
            text: 'Tool completed successfully, but its result could not be serialized. Verify the action in CRM before retrying.',
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: resultText,
        },
      ],
    };
  });

  return server;
}

async function authenticateStreamableRequest(
  req: Request,
  res: Response
): Promise<AuthenticatedUserContext | undefined> {
  try {
    return await authenticateMcpRequest(req.get('Authorization'));
  } catch (error) {
    res.setHeader(
      'WWW-Authenticate',
      'Bearer realm="FINLONEXA CRM MCP", resource_metadata="/.well-known/oauth-protected-resource", scope="crm:read crm:write"'
    );
    res.status(401).json({
      error: error instanceof Error ? error.message : 'Authentication failed.',
    });
    return undefined;
  }
}

async function getStreamableSession(
  req: Request,
  res: Response
): Promise<{ transport: StreamableHTTPServerTransport; server: Server; ctx: AuthenticatedUserContext } | undefined> {
  const sessionId = req.get('Mcp-Session-Id');
  if (!sessionId) {
    res.status(400).json({ error: 'Mcp-Session-Id header is required.' });
    return undefined;
  }

  const session = activeStreamableSessions.get(sessionId);
  if (!session) {
    res.status(404).json({ error: 'MCP session not found or expired.' });
    return undefined;
  }

  const userCtx = await authenticateStreamableRequest(req, res);
  if (!userCtx) return undefined;
  if (userCtx.userId !== session.ctx.userId) {
    res.status(403).json({ error: 'MCP session belongs to another user.' });
    return undefined;
  }

  Object.assign(session.ctx, userCtx);
  return session;
}

async function handleStreamableRequest(
  req: Request,
  res: Response,
  session: { transport: StreamableHTTPServerTransport; server: Server; ctx: AuthenticatedUserContext }
): Promise<void> {
  try {
    await session.transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('[MCP Streamable] HTTP request handling failed');
    if (!res.headersSent) {
      res.status(500).json({ error: 'MCP request could not be completed.' });
    } else {
      res.end();
    }
  }
}

/**
 * Protected Resource Metadata (RFC 9728 / MCP Authorization Spec)
 */
app.get('/.well-known/oauth-protected-resource', (req: Request, res: Response) => {
  const host = req.get('host') || 'localhost:3005';
  const protocol = req.protocol || 'http';
  const resourceUri = `${protocol}://${host}/mcp`;

  res.json({
    resource: resourceUri,
    authorization_servers: [`https://bpwdxslrkgmcoewkwufu.supabase.co/auth/v1`],
    scopes_supported: ['crm:read', 'crm:write'],
    bearer_methods_supported: ['header'],
    resource_documentation: 'https://github.com/finlonexa/crm-v3/docs/FINLONEXA_CRM_MCP_CLIENT_SETUP.md',
  });
});

/**
 * Health endpoint
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ONLINE',
    service: 'FINLONEXA CRM MCP Server',
    version: '3.0.0',
    activeSessions: activeTransports.size + activeStreamableSessions.size,
  });
});

/**
 * Stateful MCP Streamable HTTP endpoint
 */
app.post('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.get('Mcp-Session-Id');
  if (sessionId) {
    const session = await getStreamableSession(req, res);
    if (session) await handleStreamableRequest(req, res, session);
    return;
  }

  if (req.body?.method !== 'initialize') {
    res.status(400).json({ error: 'A new MCP session must start with initialize.' });
    return;
  }

  const userCtx = await authenticateStreamableRequest(req, res);
  if (!userCtx) return;

  const mcpServer = createMcpServerInstance(userCtx);
  let transport: StreamableHTTPServerTransport;
  let activeSessionId: string | undefined;
  transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: randomUUID,
    enableJsonResponse: true,
    onsessioninitialized: (initializedSessionId) => {
      activeSessionId = initializedSessionId;
      activeStreamableSessions.set(initializedSessionId, {
        transport,
        server: mcpServer,
        ctx: userCtx,
      });
    },
  });
  transport.onclose = () => {
    if (activeSessionId) activeStreamableSessions.delete(activeSessionId);
    void mcpServer.close().catch(() => {
      console.error('[MCP Streamable] Session cleanup failed');
    });
  };

  try {
    await mcpServer.connect(transport);
    await handleStreamableRequest(req, res, { transport, server: mcpServer, ctx: userCtx });
  } catch (error) {
    await transport.close().catch(() => {});
    if (!res.headersSent) {
      res.status(500).json({ error: 'MCP session could not be initialized.' });
    }
  }
});

app.get('/mcp', async (req: Request, res: Response) => {
  const session = await getStreamableSession(req, res);
  if (session) await handleStreamableRequest(req, res, session);
});

app.delete('/mcp', async (req: Request, res: Response) => {
  const session = await getStreamableSession(req, res);
  if (session) await handleStreamableRequest(req, res, session);
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
