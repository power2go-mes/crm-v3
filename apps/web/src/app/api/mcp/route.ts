import { NextRequest, NextResponse } from 'next/server';
import { authenticateMcpRequest, type AuthenticatedUserContext } from '@finlonexa/mcp-server/auth';
import { crmTools, type ToolDefinition } from '@finlonexa/mcp-server/tools';
import { checkRateLimit, recordAudit } from '@finlonexa/mcp-server/guardrails';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface JsonRpcRequest {
  jsonrpc: string;
  id?: string | number | null;
  method: string;
  params?: Record<string, any>;
}

function jsonRpcSuccess(id: string | number | null | undefined, result: any) {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    result,
  };
}

function jsonRpcError(id: string | number | null | undefined, code: number, message: string, data?: any) {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error: {
      code,
      message,
      ...(data !== undefined ? { data } : {}),
    },
  };
}

/**
 * Handle incoming MCP requests over Streamable HTTP.
 * Complies with MCP specification 2025-03-26.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || undefined;

  // 1. Enforce Authentication
  let userCtx: AuthenticatedUserContext;
  try {
    userCtx = await authenticateMcpRequest(authHeader);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication required';
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message,
        },
      },
      {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Bearer realm="finlonexa-crm-mcp"',
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // 2. Parse JSON-RPC Payload
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      jsonRpcError(null, -32700, 'Parse error: Invalid JSON was received by the server.'),
      { status: 400 }
    );
  }

  const isBatch = Array.isArray(body);
  const requests: JsonRpcRequest[] = isBatch ? body : [body];
  const responses: any[] = [];

  for (const r of requests) {
    const { id, method, params } = r;

    // A) MCP Initialize
    if (method === 'initialize') {
      responses.push(
        jsonRpcSuccess(id, {
          protocolVersion: '2025-03-26',
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: 'finlonexa-crm-mcp-server',
            version: '3.0.0',
          },
        })
      );
      continue;
    }

    // B) MCP Notifications (Initialized, etc.)
    if (method === 'notifications/initialized' || method.startsWith('notifications/')) {
      // Notifications do not require a JSON-RPC response
      continue;
    }

    // C) MCP List Tools
    if (method === 'tools/list') {
      responses.push(
        jsonRpcSuccess(id, {
          tools: crmTools.map((t: ToolDefinition) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        })
      );
      continue;
    }

    // D) MCP Call Tool
    if (method === 'tools/call') {
      const toolName = params?.name;
      const args = params?.arguments || {};

      try {
        checkRateLimit(userCtx.userId);
        const tool = crmTools.find((candidate: ToolDefinition) => candidate.name === toolName);
        if (!tool) {
          throw new Error(`Tool "${toolName}" not found in FINLONEXA CRM tool catalog.`);
        }

        const result = await tool.handler(args, userCtx);

        let resultText: string;
        if (typeof result === 'string') {
          resultText = result;
        } else {
          resultText = JSON.stringify(result, null, 2);
        }

        await recordAudit(userCtx, {
          toolName,
          arguments: args,
          status: 'SUCCESS',
        });

        responses.push(
          jsonRpcSuccess(id, {
            content: [
              {
                type: 'text',
                text: resultText,
              },
            ],
          })
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown tool error';
        const status = /^(access denied|permission denied|rate limit exceeded|tool ".+" not found)/i.test(
          errorMessage
        )
          ? 'DENIED'
          : 'FAILED';

        try {
          await recordAudit(userCtx, {
            toolName: toolName || 'unknown',
            arguments: args,
            status,
          });
        } catch {
          // Failure recording audit
        }

        responses.push(
          jsonRpcSuccess(id, {
            isError: true,
            content: [
              {
                type: 'text',
                text: `[CRM Tool Error] ${errorMessage}`,
              },
            ],
          })
        );
      }
      continue;
    }

    // E) MCP Ping
    if (method === 'ping') {
      responses.push(jsonRpcSuccess(id, {}));
      continue;
    }

    // Unknown method
    responses.push(
      jsonRpcError(id, -32601, `Method "${method}" not found or unsupported by FINLONEXA CRM MCP.`)
    );
  }

  if (!isBatch && responses.length === 0) {
    // E.g. single notification
    return new Response(null, { status: 204 });
  }

  const responsePayload = isBatch ? responses : responses[0];
  return NextResponse.json(responsePayload, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Mcp-Protocol-Version': '2025-03-26',
    },
  });
}

/**
 * Health check & Discovery metadata
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ONLINE',
      service: 'FINLONEXA CRM MCP Server (Vercel Edge/Serverless)',
      version: '3.0.0',
      transport: 'Streamable HTTP',
      protocolVersion: '2025-03-26',
      supportedToolsCount: crmTools.length,
      authRequirement: 'Bearer <FINLONEXA_SUPABASE_JWT>',
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
