import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import SearchInput from '@/components/ui/SearchInput';
import Pagination from '@/components/ui/Pagination';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import { useDebounce } from '@/hooks/useDebounce';
import { get } from '@/utils/request';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { formatCurrency, formatDate } from '@/utils/helpers';

export default function Payments() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const debouncedSearch = useDebounce(search);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get(API_ENDPOINTS.PAYMENTS.LIST, { page, limit, search: debouncedSearch });
      if (res.success) { setItems(res.data); setPagination(res.pagination); }
    } finally { setLoading(false); }
  }, [page, limit, debouncedSearch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <AdminLayout title="Pembayaran">
      <div className="mb-4 max-w-sm"><SearchInput value={search} onChange={setSearch} placeholder="Cari booking atau customer..." /></div>

      {loading ? <LoadingSpinner /> : items.length === 0 ? <EmptyState /> : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">No. Booking</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Nominal</th>
                  <th className="px-4 py-3">Metode</th>
                  <th className="px-4 py-3">Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">{formatDate(item.paid_at)}</td>
                    <td className="px-4 py-3 font-mono text-xs">{item.booking_number}</td>
                    <td className="px-4 py-3">{item.customer_name}</td>
                    <td className="px-4 py-3 font-medium text-green-600">{formatCurrency(item.amount)}</td>
                    <td className="px-4 py-3"><span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{item.method}</span></td>
                    <td className="px-4 py-3 text-slate-500">{item.admin_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 p-4">
            <Pagination pagination={pagination} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} />
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
