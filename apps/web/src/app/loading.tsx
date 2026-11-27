export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center space-y-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-100 border-t-transparent crm-loading-spinner" />
        <p className="text-sm text-slate-500 font-medium">Loading FINLONEXA CRM...</p>
      </div>
    </div>
  );
}
