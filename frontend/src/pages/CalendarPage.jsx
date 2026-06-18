import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Badge from '@/components/ui/Badge';
import { get } from '@/utils/request';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { formatDate, BOOKING_STATUS, getLocalDateStr } from '@/utils/helpers';

const MODES = ['month', 'week', 'day'];
const ACTIVE_BOOKING_STATUS = ['DP', 'LUNAS', 'SEDANG_DISEWA', 'KEEP'];

const toLocalDateStr = (year, month, day) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export default function CalendarPage() {
  const [mode, setMode] = useState('month');
  const [current, setCurrent] = useState(new Date());
  const [data, setData] = useState({ bookings: [], keeps: [] });
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);

  const year = current.getFullYear();
  const month = current.getMonth();
  const todayStr = getLocalDateStr();

  useEffect(() => {
    setLoading(true);
    const start = toLocalDateStr(year, month, 1);
    const end = toLocalDateStr(year, month, new Date(year, month + 1, 0).getDate());
    Promise.all([
      get(API_ENDPOINTS.CALENDAR, { start, end }),
      get(API_ENDPOINTS.PRODUCTS.LIST, { limit: 100, is_active: true }),
    ])
      .then(([calRes, prodRes]) => {
        if (calRes.success) setData(calRes.data);
        if (prodRes.success) setProducts(prodRes.data);
      })
      .finally(() => setLoading(false));
  }, [year, month]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = current.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  const isDateInRange = (dateStr, start, end) => dateStr >= start && dateStr <= end;

  const getEventsForDate = (dateStr) => {
    const bookings = data.bookings?.filter((b) =>
      isDateInRange(dateStr, b.pickup_date?.split('T')[0], b.return_date?.split('T')[0])
    ) || [];
    const keeps = data.keeps?.filter((k) =>
      isDateInRange(dateStr, k.start_date?.split('T')[0], k.end_date?.split('T')[0])
    ) || [];
    return { bookings, keeps };
  };

  const getProductAvailability = (dateStr) => {
    const { bookings, keeps } = getEventsForDate(dateStr);
    const bookedMap = {};

    bookings
      .filter((b) => ACTIVE_BOOKING_STATUS.includes(b.status))
      .forEach((b) => {
        bookedMap[b.product_id] = bookedMap[b.product_id] || { product: b, count: 0, type: 'booking' };
        bookedMap[b.product_id].count += 1;
      });

    keeps.forEach((k) => {
      bookedMap[k.product_id] = bookedMap[k.product_id] || { product: k, count: 0, type: 'keep' };
      bookedMap[k.product_id].count += 1;
    });

    const booked = [];
    const available = [];

    products.forEach((p) => {
      const entry = bookedMap[p.id];
      const stock = Number(p.stock) || 1;
      if (entry && entry.count >= stock) {
        booked.push({ ...p, bookingInfo: entry.product, bookingType: entry.type });
      } else {
        available.push({ ...p, remaining: entry ? stock - entry.count : stock });
      }
    });

    return { booked, available, bookings, keeps };
  };

  const selectedEvents = selectedDate ? getProductAvailability(selectedDate) : null;

  const prevMonth = () => setCurrent(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrent(new Date(year, month + 1, 1));

  const getDayColor = (day) => {
    const dateStr = toLocalDateStr(year, month, day);
    const { bookings, keeps } = getEventsForDate(dateStr);
    if (bookings.some((b) => ACTIVE_BOOKING_STATUS.includes(b.status))) return 'bg-red-100 border-red-200';
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
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-200" /> Terbooking</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-yellow-200" /> Keep</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-green-100" /> Tersedia</span>
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
                const dateStr = toLocalDateStr(year, month, day);
                const isToday = dateStr === todayStr;
                return (
                  <button key={day} onClick={() => setSelectedDate(dateStr)}
                    className={`min-h-[60px] rounded-lg border p-1 text-left text-sm transition hover:ring-2 hover:ring-primary-300 ${getDayColor(day)} ${isToday ? 'ring-2 ring-slate-400' : ''} ${selectedDate === dateStr ? 'ring-2 ring-primary-600' : ''}`}>
                    <span className="font-medium">{day}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card p-4 space-y-4">
            <h3 className="font-semibold">
              {selectedDate ? `Gaun — ${formatDate(selectedDate)}` : 'Klik tanggal untuk detail'}
            </h3>
            {selectedEvents ? (
              <div className="space-y-4">
                {selectedEvents.bookings.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Booking Aktif</p>
                    <div className="space-y-2">
                      {selectedEvents.bookings.map((b) => (
                        <Link key={b.id} to={`/bookings/${b.id}`} className="block rounded-lg bg-red-50 p-3 text-sm hover:bg-red-100">
                          <div className="flex justify-between"><span className="font-medium">{b.booking_number}</span><Badge status={b.status} map={BOOKING_STATUS} /></div>
                          <p className="text-xs text-slate-500">{b.customer_name} • {b.product_code} - {b.product_name}</p>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-red-500">
                    <XCircle className="h-3.5 w-3.5" /> Terbooking ({selectedEvents.booked.length})
                  </p>
                  {selectedEvents.booked.length ? (
                    <ul className="space-y-1.5">
                      {selectedEvents.booked.map((p) => (
                        <li key={p.id} className="rounded-lg bg-red-50 px-3 py-2 text-sm">
                          <span className="font-medium">{p.code}</span>
                          <span className="text-slate-500"> — {p.name}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-400">Tidak ada gaun terbooking</p>
                  )}
                </div>

                <div>
                  <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-green-600">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Tersedia ({selectedEvents.available.length})
                  </p>
                  {selectedEvents.available.length ? (
                    <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                      {selectedEvents.available.map((p) => (
                        <li key={p.id} className="rounded-lg bg-green-50 px-3 py-2 text-sm">
                          <span className="font-medium">{p.code}</span>
                          <span className="text-slate-500"> — {p.name}</span>
                          {p.remaining > 1 && <span className="ml-1 text-xs text-green-600">({p.remaining} unit)</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-400">Semua gaun terbooking</p>
                  )}
                </div>

                {selectedEvents.keeps.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-yellow-600">Keep</p>
                    {selectedEvents.keeps.map((k) => (
                      <div key={k.id} className="rounded-lg bg-yellow-50 p-3 text-sm mb-2">
                        <p className="font-medium">{k.product_code} - {k.product_name}</p>
                        <p className="text-xs text-slate-500">{k.customer_name}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : <p className="text-sm text-slate-400">Pilih tanggal di kalender</p>}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
