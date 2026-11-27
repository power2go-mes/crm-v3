'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useOpportunityQuotes } from '@/hooks/use-quotes';
import { useOpportunityLineItems } from '@/hooks/use-opportunity-line-items';
import { updateQuoteStatus, deleteQuote } from '@/app/(dashboard)/opportunities/[id]/quotes/actions';
import { QuoteEditorModal } from '@/components/opportunities/quote-editor-modal';
import { QuoteRevisionsModal } from '@/components/opportunities/quote-revisions-modal';
import { generateQuotePdf } from '@/lib/quotes/quote-pdf';
import type { QuoteRecord, QuoteStatus, QuoteLineItemRecord } from '@/types/quotes';
import {
  FileText,
  Plus,
  Download,
  History,
  Edit2,
  Trash2,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  AlertCircle,
} from 'lucide-react';
import { PermissionGate } from '@/components/auth/permission-gate';

interface OpportunityQuotesTabProps {
  opportunity: {
    id: string;
    name: string;
    account_id?: string | null;
    account?: { id: string; name: string } | null;
    currency?: string;
  };
}

export function OpportunityQuotesTab({ opportunity }: OpportunityQuotesTabProps) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  const { data: quotes = [], isLoading, refetch } = useOpportunityQuotes(opportunity.id);
  const { data: lineItems = [] } = useOpportunityLineItems(opportunity.id);

  // Fetch company details for PDF header
  const { data: companySettings } = useQuery({
    queryKey: ['company-settings-quote-pdf'],
    queryFn: async () => {
      const res = await supabase.from('company_settings').select('*').eq('id', 1).maybeSingle();
      return (
        res.data || {
          company_name: 'FINLONEXA Enterprise',
          currency: 'INR',
        }
      );
    },
  });

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<QuoteRecord | null>(null);
  const [existingItems, setExistingItems] = useState<QuoteLineItemRecord[]>([]);

  const [revisionsQuote, setRevisionsQuote] = useState<QuoteRecord | null>(null);
  const [statusMenuQuoteId, setStatusMenuQuoteId] = useState<string | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<string | null>(null);

  const handleCreateNewQuote = () => {
    setEditingQuote(null);
    setExistingItems([]);
    setIsEditorOpen(true);
  };

  const handleEditQuote = async (quote: QuoteRecord) => {
    const itemsRes = await (supabase as any)
      .from('crm_quote_line_items')
      .select('*')
      .eq('quote_id', quote.id)
      .order('sort_order', { ascending: true });

    setEditingQuote(quote);
    setExistingItems(itemsRes.data || []);
    setIsEditorOpen(true);
  };

  const handleStatusChange = async (quote: QuoteRecord, newStatus: QuoteStatus) => {
    setStatusMenuQuoteId(null);
    const res = await updateQuoteStatus(quote.id, newStatus);
    if (res.error) {
      alert(res.error);
    } else {
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['quote-revisions', quote.id] });
    }
  };

  const handleDeleteQuote = async (quote: QuoteRecord) => {
    if (confirm(`Are you sure you want to delete quote "${quote.quote_number}"?`)) {
      const res = await deleteQuote(quote.id);
      if (res.error) {
        alert(res.error);
      } else {
        await refetch();
      }
    }
  };

  const handleDownloadPdf = async (quote: QuoteRecord) => {
    setIsDownloadingPdf(quote.id);
    try {
      const itemsRes = await (supabase as any)
        .from('crm_quote_line_items')
        .select('*')
        .eq('quote_id', quote.id)
        .order('sort_order', { ascending: true });

      const items = itemsRes.data || [];
      const doc = generateQuotePdf({
        quote,
        items,
        company: companySettings || { company_name: 'FINLONEXA Enterprise' },
      });

      doc.save(`${quote.quote_number || 'Quotation'}.pdf`);
    } catch (err: any) {
      alert(`Error generating PDF: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsDownloadingPdf(null);
    }
  };

  const getStatusBadge = (status: QuoteStatus) => {
    switch (status) {
      case 'Draft':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <Clock className="h-3 w-3" /> Draft
          </span>
        );
      case 'Sent':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#eef2ff] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#4361ee] dark:bg-[#4361ee]/40 dark:text-[#4361ee]">
            <Send className="h-3 w-3" /> Sent
          </span>
        );
      case 'Accepted':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#eef2ff] px-2.5 py-0.5 text-[10px] font-bold uppercase text-[#4361ee] dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="h-3 w-3" /> Accepted
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-red-700 dark:bg-red-950/40 dark:text-red-300">
            <XCircle className="h-3 w-3" /> Rejected
          </span>
        );
      case 'Expired':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertCircle className="h-3 w-3" /> Expired
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner / Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#4361ee] dark:text-[#4361ee]" />
            <h3 className="text-base font-bold text-slate-900">
              Official Quotations &amp; Proposals ({quotes.length})
            </h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Generate formal price quotes, export vectorized branded PDFs, and track document status transitions.
          </p>
        </div>

        <PermissionGate action="quotes.create">
          <button
            type="button"
            onClick={handleCreateNewQuote}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#4361ee] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#4361ee]"
          >
            <Plus className="h-4 w-4" />
            <span>Generate New Quote</span>
          </button>
        </PermissionGate>
      </div>

      {/* Quotations List */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-3">Quote #</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Issue Date</th>
              <th className="px-4 py-3">Valid Until</th>
              <th className="px-4 py-3 text-right">Grand Total</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Loading quotes...
                </td>
              </tr>
            ) : quotes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                  <FileText className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="font-medium text-slate-600 dark:text-slate-300">
                    No quotations created for this opportunity yet.
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Create formal proposals with line items, tax breakdowns, and terms to send to customers.
                  </p>
                  <button
                    type="button"
                    onClick={handleCreateNewQuote}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#4361ee] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4361ee]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Create First Quotation</span>
                  </button>
                </td>
              </tr>
            ) : (
              quotes.map((quote) => (
                <tr key={quote.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">
                    {quote.quote_number}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {quote.subject}
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(quote.status as QuoteStatus)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {quote.issue_date}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {quote.valid_until}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                    {quote.currency} {Number(quote.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="relative inline-flex items-center gap-1">
                      {/* Download PDF button */}
                      <button
                        type="button"
                        disabled={isDownloadingPdf === quote.id}
                        onClick={() => handleDownloadPdf(quote)}
                        className="rounded p-1 text-slate-500 hover:text-[#4361ee] dark:hover:text-[#4361ee]"
                        title="Download Vectorized PDF"
                      >
                        <Download className="h-4 w-4" />
                      </button>

                      {/* View Revisions */}
                      <button
                        type="button"
                        onClick={() => setRevisionsQuote(quote)}
                        className="rounded p-1 text-slate-500 hover:text-[#4361ee] dark:hover:text-[#4361ee]"
                        title="View Revision History"
                      >
                        <History className="h-4 w-4" />
                      </button>

                      {/* Status Menu Trigger */}
                      <PermissionGate action="quotes.update">
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setStatusMenuQuoteId(statusMenuQuoteId === quote.id ? null : quote.id)
                            }
                            className="inline-flex items-center gap-0.5 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                          >
                            <span>Status</span>
                            <ChevronDown className="h-3 w-3" />
                          </button>

                          {statusMenuQuoteId === quote.id && (
                            <div className="absolute right-0 z-20 mt-1 w-32 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800 text-left">
                              {quote.status === 'Draft' && (
                                <>
                                  <button
                                    onClick={() => handleStatusChange(quote, 'Sent')}
                                    className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-[#eef2ff] dark:text-slate-200 dark:hover:bg-slate-700 text-left"
                                  >
                                    Mark as Sent
                                  </button>
                                  <button
                                    onClick={() => handleStatusChange(quote, 'Accepted')}
                                    className="w-full px-3 py-1.5 text-xs text-[#4361ee] hover:bg-[#eef2ff] dark:hover:bg-slate-700 text-left"
                                  >
                                    Mark Accepted
                                  </button>
                                  <button
                                    onClick={() => handleStatusChange(quote, 'Rejected')}
                                    className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700 text-left"
                                  >
                                    Mark Rejected
                                  </button>
                                </>
                              )}
                              {quote.status === 'Sent' && (
                                <>
                                  <button
                                    onClick={() => handleStatusChange(quote, 'Accepted')}
                                    className="w-full px-3 py-1.5 text-xs text-[#4361ee] hover:bg-[#eef2ff] dark:hover:bg-slate-700 text-left"
                                  >
                                    Mark Accepted
                                  </button>
                                  <button
                                    onClick={() => handleStatusChange(quote, 'Rejected')}
                                    className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700 text-left"
                                  >
                                    Mark Rejected
                                  </button>
                                  <button
                                    onClick={() => handleStatusChange(quote, 'Expired')}
                                    className="w-full px-3 py-1.5 text-xs text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-700 text-left"
                                  >
                                    Mark Expired
                                  </button>
                                </>
                              )}
                              {(quote.status === 'Rejected' || quote.status === 'Expired') && (
                                <button
                                  onClick={() => handleStatusChange(quote, 'Draft')}
                                  className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700 text-left"
                                >
                                  Revert to Draft
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </PermissionGate>

                      {/* Edit if Draft */}
                      {quote.status === 'Draft' && (
                        <PermissionGate action="quotes.update">
                          <button
                            type="button"
                            onClick={() => handleEditQuote(quote)}
                            className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            title="Edit Draft Quotation"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </PermissionGate>
                      )}

                      {/* Delete if Draft */}
                      {quote.status === 'Draft' && (
                        <PermissionGate action="quotes.delete">
                          <button
                            type="button"
                            onClick={() => handleDeleteQuote(quote)}
                            className="rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            title="Delete Draft"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </PermissionGate>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Quote Editor Modal */}
      {isEditorOpen && (
        <QuoteEditorModal
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          opportunity={opportunity}
          initialLineItems={lineItems}
          quote={editingQuote}
          existingItems={existingItems}
          onSuccess={async () => {
            await refetch();
          }}
        />
      )}

      {/* Quote Revisions Modal */}
      {revisionsQuote && (
        <QuoteRevisionsModal
          isOpen={!!revisionsQuote}
          onClose={() => setRevisionsQuote(null)}
          quote={revisionsQuote}
        />
      )}
    </div>
  );
}
