import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Package, Users, CalendarDays, Truck, Bookmark, DollarSign, AlertTriangle,
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import StatCard from '@/components/ui/StatCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { get } from '@/utils/request';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { formatCurrency, formatDate } from '@/utils/helpers';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get(API_ENDPOINTS.DASHBOARD)
      .then((res) => res.success && setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <AdminLayout title="Dashboard"><LoadingSpinner /></AdminLayout>;

  const { stats, reminders } = data || {};

  return (
    <AdminLayout title="Dashboard">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Barang" value={stats?.totalProducts || 0} icon={Package} />
        <StatCard title="Total Customer" value={stats?.totalCustomers || 0} icon={Users} color="bg-blue-50 text-blue-600" />
        <StatCard title="Booking Aktif" value={stats?.activeBookings || 0} icon={CalendarDays} color="bg-green-50 text-green-600" />
        <StatCard title="Sedang Disewa" value={stats?.rentedItems || 0} icon={Truck} color="bg-purple-50 text-purple-600" />
        <StatCard title="Booking Hari Ini" value={stats?.todayBookings || 0} icon={CalendarDays} color="bg-orange-50 text-orange-600" />
        <StatCard title="Booking Minggu Ini" value={stats?.weekBookings || 0} icon={CalendarDays} color="bg-cyan-50 text-cyan-600" />
        <StatCard title="Keep Aktif" value={stats?.activeKeeps || 0} icon={Bookmark} color="bg-yellow-50 text-yellow-600" />
        <StatCard title="Pendapatan Bulan Ini" value={formatCurrency(stats?.monthRevenue)} icon={DollarSign} color="bg-emerald-50 text-emerald-600" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-5 w-5 text-amber-500" /> Reminder
          </h3>
          <div className="space-y-4">
            <ReminderSection title="Diambil Hari Ini" items={reminders?.pickupToday} field="products" />
            <ReminderSection title="Dikembalikan Hari Ini" items={reminders?.returnToday} field="products" />
            <ReminderSection title="Keep Expired Hari Ini" items={reminders?.keepExpireToday} field="product_name" />
            <ReminderSection title="Belum Lunas" items={reminders?.unpaidBookings} field="booking_number" isCurrency />
          </div>
        </div>

        <div className="card p-5">
          <h3 className="mb-4 font-semibold">Kalender Overview</h3>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {['Min','Sen','Sel','Rab','Kam','Jum','Sab'].map((d) => (
              <div key={d} className="py-1 font-medium text-slate-400">{d}</div>
            ))}
            <CalendarGrid data={data?.calendar} />
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-green-400" /> Tersedia</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-yellow-400" /> Keep</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-400" /> Booking</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-slate-300" /> Selesai</span>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function ReminderSection({ title, items, field, isCurrency }) {
  if (!items?.length) return (
    <div>
      <p className="text-sm font-medium text-slate-600">{title}</p>
      <p className="text-xs text-slate-400">Tidak ada</p>
    </div>
  );
  return (
    <div>
      <p className="text-sm font-medium text-slate-600">{title} ({items.length})</p>
      <ul className="mt-1 space-y-1">
        {items.slice(0, 3).map((item) => (
          <li key={item.id} className="text-xs text-slate-500">
            {item.customer_name} — {isCurrency ? item.booking_number : item[field]}
            {isCurrency && ` (${formatCurrency(item.total)})`}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CalendarGrid({ data }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dateMap = {};
  data?.forEach((d) => {
    const key = new Date(d.date).getDate();
    dateMap[key] = d;
  });

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} />);
  for (let day = 1; day <= daysInMonth; day++) {
    const info = dateMap[day];
    let color = 'bg-green-100';
    if (info?.bookings > 0) color = 'bg-red-200';
    else if (info?.keeps > 0) color = 'bg-yellow-200';
    cells.push(
      <div key={day} className={`rounded p-1 ${color} ${day === now.getDate() ? 'ring-2 ring-primary-500' : ''}`}>
        {day}
      </div>
    );
  }
  return cells;
}
