'use client';

import React, { useState } from 'react';
import { PageContainer } from '@/components/shell/page-container';
import { PageHeader } from '@/components/shell/page-header';
import { useAuth } from '@/components/providers/auth-provider';
import {
  Key,
  RotateCw,
  Copy,
  Check,
  ShieldCheck,
  Bot,
  ExternalLink,
  Code2,
  Terminal,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';

export default function McpSettingsPage() {
  const { user, profile, isLoading } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate / Rotate Token
  const handleGenerateToken = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/mcp/token', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate token');
      }
      setToken(data.token);
      setExpiresAt(data.expiresAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generating token');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'token' | 'config') => {
    await navigator.clipboard.writeText(text);
    if (type === 'token') {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } else {
      setCopiedConfig(true);
      setTimeout(() => setCopiedConfig(false), 2000);
    }
  };

  const mcpServerUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/mcp`
    : 'https://finlonexa-crm.vercel.app/api/mcp';

  const clientJsonConfig = JSON.stringify(
    {
      mcpServers: {
        'finlonexa-crm': {
          url: mcpServerUrl,
          transport: 'streamable-http',
          headers: {
            Authorization: `Bearer ${token || '<YOUR_MCP_TOKEN>'}`,
          },
        },
      },
    },
    null,
    2
  );

  return (
    <PageContainer>
      <PageHeader
        title="AI & MCP Agent Access"
        subtitle="Generate and rotate scoped Model Context Protocol (MCP) tokens for AI agents (Antigravity, Cursor, Claude, Codex)."
      />

      <div className="space-y-6">
        {/* Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-[#3a5bf0] via-[#4361ee] to-slate-900 p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-bold uppercase tracking-wider">
              <Bot className="h-3.5 w-3.5" />
              <span>Model Context Protocol 2025-03-26</span>
            </div>
            <h2 className="text-xl font-bold">Personal Agent Key</h2>
            <p className="text-xs text-indigo-100 max-w-xl">
              Connect AI coding assistants and autonomous agents directly to FINLONEXA CRM. The AI will only see and perform what your account ({profile?.email || user?.email}) is authorized to do.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGenerateToken}
            disabled={isGenerating || isLoading}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-slate-900 hover:bg-slate-100 rounded-xl font-bold text-xs shadow-sm transition disabled:opacity-50 shrink-0 cursor-pointer"
          >
            <RotateCw className={`h-4 w-4 text-[#4361ee] ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{token ? 'Rotate MCP Token' : 'Generate MCP Token'}</span>
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Token Display Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-[#eef2ff] text-[#4361ee] border border-indigo-100/60 flex items-center justify-center">
                <Key className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Your MCP Bearer Token</h3>
                <p className="text-xs text-slate-500">
                  {expiresAt ? (
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <Clock className="h-3 w-3 text-slate-400" />
                      Active until {new Date(expiresAt).toLocaleTimeString()} ({new Date(expiresAt).toLocaleDateString()})
                    </span>
                  ) : (
                    'No active token generated yet. Click Generate to create one.'
                  )}
                </p>
              </div>
            </div>

            {token && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#eef2ff] text-[#4361ee] border border-indigo-100/60">
                <ShieldCheck className="h-3 w-3" />
                Active
              </span>
            )}
          </div>

          {token ? (
            <div className="space-y-3 pt-2">
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  value={token}
                  className="w-full pl-3 pr-24 py-2.5 font-mono text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none select-all"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(token, 'token')}
                  className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#4361ee] hover:bg-[#3a5bf0] text-white font-semibold text-xs shadow-2xs transition cursor-pointer"
                >
                  {copiedToken ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-slate-500 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <ShieldCheck className="h-4 w-4 text-[#4361ee]" />
                  <span>Bound to: <strong className="text-slate-800">{user?.email}</strong></span>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateToken}
                  disabled={isGenerating}
                  className="text-xs text-slate-600 hover:text-[#4361ee] font-semibold underline underline-offset-2 transition"
                >
                  Rotate this token now
                </button>
              </div>
            </div>
          ) : (
            <div className="py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 flex flex-col items-center justify-center gap-2 text-center p-4">
              <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <Key className="h-5 w-5" />
              </div>
              <p className="text-xs text-slate-600 font-medium">
                Click <strong className="text-[#4361ee]">Generate MCP Token</strong> above to generate a secure agent credential.
              </p>
            </div>
          )}
        </div>

        {/* AI Client Connection Snippet */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60 flex items-center justify-center">
                <Code2 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">AI Client Configuration</h3>
                <p className="text-xs text-slate-500">
                  Copy this JSON snippet into your AI client configuration (<code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">mcp_config.json</code>).
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => copyToClipboard(clientJsonConfig, 'config')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs shadow-2xs transition cursor-pointer"
            >
              {copiedConfig ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#4361ee]" />
                  <span>Config Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Configuration</span>
                </>
              )}
            </button>
          </div>

          <div className="relative rounded-xl bg-slate-900 p-4 font-mono text-xs text-slate-200 overflow-x-auto shadow-inner">
            <pre className="overflow-x-auto">{clientJsonConfig}</pre>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="font-bold text-slate-800 block mb-0.5">Antigravity / Gemini</span>
              <span className="text-slate-500">Paste in <code className="text-[10px] bg-white px-1 border rounded">mcp_config.json</code> under <code className="text-[10px] bg-white px-1 border rounded">mcpServers</code></span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="font-bold text-slate-800 block mb-0.5">Cursor</span>
              <span className="text-slate-500">Add new server in Settings &gt; MCP with Type: <code className="text-[10px] bg-white px-1 border rounded">command / sse</code></span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="font-bold text-slate-800 block mb-0.5">Claude Desktop</span>
              <span className="text-slate-500">Add to <code className="text-[10px] bg-white px-1 border rounded">claude_desktop_config.json</code></span>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
