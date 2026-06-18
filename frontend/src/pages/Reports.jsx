import { useEffect, useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { get } from '@/utils/request';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { formatCurrency } from '@/utils/helpers';

const PERIODS = [
  { value: 'daily', label: 'Harian' },
  { value: 'weekly', label: 'Mingguan' },
  { value: 'monthly', label: 'Bulanan' },
  { value: 'yearly', label: 'Tahunan' },
];

export default function Reports() {
  const [period, setPeriod] = useState('monthly');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    get(API_ENDPOINTS.REPORTS, { period })
      .then((res) => res.success && setData(res.data))
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <AdminLayout title="Laporan">
      <div className="mb-6 flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <button key={p.value} onClick={() => setPeriod(p.value)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${period === p.value ? 'bg-primary-600 text-white' : 'bg-white border hover:bg-slate-50'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card p-5">
              <p className="text-sm text-slate-500">Total Transaksi</p>
              <p className="mt-1 text-2xl font-bold">{formatCurrency(data?.revenue?.total_transactions)}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-slate-500">Total DP</p>
              <p className="mt-1 text-2xl font-bold text-blue-600">{formatCurrency(data?.revenue?.total_dp)}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm text-slate-500">Total Lunas</p>
              <p className="mt-1 text-2xl font-bold text-green-600">{formatCurrency(data?.revenue?.total_lunas)}</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card p-5">
              <h3 className="mb-4 font-semibold">Barang Terlaris</h3>
              <div className="space-y-2">
                {data?.topProducts?.map((p, i) => (
                  <div key={p.code} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-600">{i + 1}</span>
                      <div><p className="font-medium">{p.name}</p><p className="text-xs text-slate-400">{p.rental_count} kali sewa</p></div>
                    </div>
                    <p className="font-medium">{formatCurrency(p.revenue)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <h3 className="mb-4 font-semibold">Customer Teraktif</h3>
              <div className="space-y-2">
                {data?.topCustomers?.map((c, i) => (
                  <div key={c.phone} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">{i + 1}</span>
                      <div><p className="font-medium">{c.name}</p><p className="text-xs text-slate-400">{c.booking_count} booking</p></div>
                    </div>
                    <p className="font-medium">{formatCurrency(c.total_transactions)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
