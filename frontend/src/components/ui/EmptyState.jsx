import { Inbox } from 'lucide-react';

export default function EmptyState({ title = 'Tidak ada data', description = '' }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Inbox className="mb-3 h-12 w-12 text-slate-300" />
      <p className="font-medium text-slate-600">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
    </div>
  );
}
