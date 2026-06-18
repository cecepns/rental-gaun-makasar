import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Badge from '@/components/ui/Badge';
import { get } from '@/utils/request';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { formatDate, BOOKING_STATUS } from '@/utils/helpers';

const MODES = ['month', 'week', 'day'];

export default function CalendarPage() {
  const [mode, setMode] = useState('month');
  const [current, setCurrent] = useState(new Date());
  const [data, setData] = useState({ bookings: [], keeps: [] });
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);

  const year = current.getFullYear();
  const month = current.getMonth();

  useEffect(() => {
    setLoading(true);
    const start = new Date(year, month, 1).toISOString().split('T')[0];
    const end = new Date(year, month + 1, 0).toISOString().split('T')[0];
    get(API_ENDPOINTS.CALENDAR, { start, end })
      .then((res) => res.success && setData(res.data))
      .finally(() => setLoading(false));
  }, [year, month]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = current.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  const getEventsForDate = (dateStr) => {
    const bookings = data.bookings?.filter((b) => {
      const d = new Date(dateStr);
      return d >= new Date(b.pickup_date) && d <= new Date(b.return_date);
    }) || [];
    const keeps = data.keeps?.filter((k) => {
      const d = new Date(dateStr);
      return d >= new Date(k.start_date) && d <= new Date(k.end_date);
    }) || [];
    return { bookings, keeps };
  };

  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : null;

  const prevMonth = () => setCurrent(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrent(new Date(year, month + 1, 1));

  const getDayColor = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const { bookings, keeps } = getEventsForDate(dateStr);
    if (bookings.some((b) => ['DP', 'LUNAS', 'SEDANG_DISEWA'].includes(b.status))) return 'bg-red-100 border-red-200';
    if (keeps.length) return 'bg-yellow-100 border-yellow-200';
    if (bookings.some((b) => b.status === 'SELESAI')) return 'bg-slate-100 border-slate-200';
    return 'bg-green-50 border-green-100';
  };

  return (
    <AdminLayout title="Kalender Booking">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {MODES.map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`rounded-lg px-3 py-1.5 text-sm capitalize ${mode === m ? 'bg-primary-600 text-white' : 'bg-white border hover:bg-slate-50'}`}>
              {m === 'month' ? 'Bulanan' : m === 'week' ? 'Mingguan' : 'Harian'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="btn-secondary px-2 py-1.5"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[160px] text-center font-semibold capitalize">{monthName}</span>
          <button onClick={nextMonth} className="btn-secondary px-2 py-1.5"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 text-xs">
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-200" /> Booking</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-yellow-200" /> Keep</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-green-100" /> Available</span>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="card p-4 lg:col-span-2">
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-400 mb-2">
              {['Min','Sen','Sel','Rab','Kam','Jum','Sab'].map((d) => <div key={d} className="py-2">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isToday = new Date().toDateString() === new Date(dateStr).toDateString();
                return (
                  <button key={day} onClick={() => setSelectedDate(dateStr)}
                    className={`min-h-[60px] rounded-lg border p-1 text-left text-sm transition hover:ring-2 hover:ring-primary-300 ${getDayColor(day)} ${isToday ? 'ring-2 ring-primary-500' : ''} ${selectedDate === dateStr ? 'ring-2 ring-primary-600' : ''}`}>
                    <span className="font-medium">{day}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card p-4">
            <h3 className="font-semibold mb-3">
              {selectedDate ? `Jadwal ${formatDate(selectedDate)}` : 'Klik tanggal untuk detail'}
            </h3>
            {selectedEvents ? (
              <div className="space-y-3">
                {selectedEvents.bookings.map((b) => (
                  <Link key={b.id} to={`/bookings/${b.id}`} className="block rounded-lg bg-red-50 p-3 text-sm hover:bg-red-100">
                    <div className="flex justify-between"><span className="font-medium">{b.booking_number}</span><Badge status={b.status} map={BOOKING_STATUS} /></div>
                    <p className="text-xs text-slate-500">{b.customer_name} • {b.product_name}</p>
                  </Link>
                ))}
                {selectedEvents.keeps.map((k) => (
                  <div key={k.id} className="rounded-lg bg-yellow-50 p-3 text-sm">
                    <p className="font-medium">Keep: {k.product_name}</p>
                    <p className="text-xs text-slate-500">{k.customer_name}</p>
                  </div>
                ))}
                {!selectedEvents.bookings.length && !selectedEvents.keeps.length && (
                  <p className="text-sm text-green-600">✓ Tersedia</p>
                )}
              </div>
            ) : <p className="text-sm text-slate-400">Pilih tanggal di kalender</p>}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
