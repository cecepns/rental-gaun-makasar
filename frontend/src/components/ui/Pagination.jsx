import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ pagination, onPageChange, onLimitChange }) {
  if (!pagination) return null;
  const { page, limit, total, totalPages } = pagination;
  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span>Menampilkan {total === 0 ? 0 : (page - 1) * limit + 1}-{Math.min(page * limit, total)} dari {total}</span>
        <select value={limit} onChange={(e) => onLimitChange(Number(e.target.value))} className="input w-auto py-1">
          {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="btn-secondary px-2 py-1.5">
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((p) => (
          <button key={p} onClick={() => onPageChange(p)}
            className={`min-w-[36px] rounded-lg px-2 py-1.5 text-sm font-medium ${p === page ? 'bg-primary-600 text-white' : 'hover:bg-slate-100'}`}>
            {p}
          </button>
        ))}
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="btn-secondary px-2 py-1.5">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
