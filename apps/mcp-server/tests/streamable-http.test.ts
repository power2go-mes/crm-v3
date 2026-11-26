import { createServer } from 'node:http';
import type { AddressInfo, Server as HttpServer } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const { authenticateMcpRequestMock } = vi.hoisted(() => ({
  authenticateMcpRequestMock: vi.fn(),
}));

vi.mock('../src/auth.js', () => ({
  authenticateMcpRequest: authenticateMcpRequestMock,
  mintMcpSessionToken: vi.fn(),
}));

import { app } from '../src/index.js';

describe('MCP Streamable HTTP endpoint', () => {
  let httpServer: HttpServer;
  let baseUrl: string;
  const auditInsertA = vi.fn().mockResolvedValue({ error: null });
  const userA = {
    userId: 'mcp-stream-user-a',
    email: 'user-a@example.test',
    fullName: 'User A',
    roles: ['BDO'],
    primaryRole: 'BDO',
    managerId: null,
    permissions: ['leads.view'],
    supabase: {
      from: vi.fn(() => ({ insert: auditInsertA })),
    },
  };
  const userB = {
    ...userA,
    userId: 'mcp-stream-user-b',
    email: 'user-b@example.test',
    fullName: 'User B',
  };

  beforeAll(async () => {
    authenticateMcpRequestMock.mockImplementation(
      async (authorization?: string) => {
        if (authorization === 'Bearer user-a-token') return userA;
        if (authorization === 'Bearer user-b-token') return userB;
        throw new Error('Invalid or expired authentication session');
      }
    );

    httpServer = createServer(app);
    await new Promise<void>((resolve) =>
      httpServer.listen(0, '127.0.0.1', resolve)
    );
    const address = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('authenticates, binds requests to the initialized session, and closes cleanly', async () => {
    const headers = {
      authorization: 'Bearer user-a-token',
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
    };
    const initializeResponse = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'streamable-http-test', version: '1.0.0' },
        },
      }),
    });

    expect(initializeResponse.status).toBe(200);
    const sessionId = initializeResponse.headers.get('mcp-session-id');
    expect(sessionId).toBeTruthy();

    const notificationResponse = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        ...headers,
        'mcp-session-id': sessionId!,
        'mcp-protocol-version': '2025-03-26',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      }),
    });
    expect(notificationResponse.status).toBe(202);

    const wrongUserResponse = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        ...headers,
        authorization: 'Bearer user-b-token',
        'mcp-session-id': sessionId!,
        'mcp-protocol-version': '2025-03-26',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'crm_whoami', arguments: {} },
      }),
    });
    expect(wrongUserResponse.status).toBe(403);

    const toolResponse = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        ...headers,
        'mcp-session-id': sessionId!,
        'mcp-protocol-version': '2025-03-26',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'crm_whoami', arguments: {} },
      }),
    });
    expect(toolResponse.status).toBe(200);
    const toolPayload = await toolResponse.json();
    expect(JSON.stringify(toolPayload)).toContain(userA.userId);
    expect(auditInsertA).toHaveBeenCalledTimes(1);

    auditInsertA.mockResolvedValueOnce({ error: { code: '42501' } });
    const auditFailureLog = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const auditFailureResponse = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        ...headers,
        'mcp-session-id': sessionId!,
        'mcp-protocol-version': '2025-03-26',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'crm_whoami', arguments: {} },
      }),
    });
    const auditFailurePayload = await auditFailureResponse.json();
    expect(auditFailureResponse.status).toBe(200);
    expect(auditFailurePayload.isError).toBeUndefined();
    expect(auditFailurePayload.result.content[0].text).toContain(userA.userId);
    expect(auditFailurePayload.result.content[0].text).toContain(
      '[Audit warning]'
    );
    expect(auditInsertA).toHaveBeenCalledTimes(2);
    auditFailureLog.mockRestore();

    const closeResponse = await fetch(`${baseUrl}/mcp`, {
      method: 'DELETE',
      headers: {
        authorization: 'Bearer user-a-token',
        'mcp-session-id': sessionId!,
        'mcp-protocol-version': '2025-03-26',
      },
    });
    expect(closeResponse.status).toBe(200);
  });

  it('rejects unauthenticated initialization and requests without a session', async () => {
    const initializeResponse = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'streamable-http-test', version: '1.0.0' },
        },
      }),
    });
    expect(initializeResponse.status).toBe(401);

    const toolResponse = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer user-a-token',
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'crm_whoami', arguments: {} },
      }),
    });
    expect(toolResponse.status).toBe(400);
  });
});
