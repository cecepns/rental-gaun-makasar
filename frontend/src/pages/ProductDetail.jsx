import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Badge from '@/components/ui/Badge';
import { get } from '@/utils/request';
import { API_ENDPOINTS } from '@/utils/endpoints';
import { formatCurrency, formatDate, BOOKING_STATUS, getAssetUrl } from '@/utils/helpers';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get(API_ENDPOINTS.PRODUCTS.DETAIL(id))
      .then((res) => res.success && setProduct(res.data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <AdminLayout title="Detail Barang"><LoadingSpinner /></AdminLayout>;
  if (!product) return <AdminLayout title="Detail Barang"><p>Barang tidak ditemukan</p></AdminLayout>;

  return (
    <AdminLayout title="Detail Barang">
      <button onClick={() => navigate('/products')} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Kembali
      </button>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-1">
          {product.main_image ? (
            <img src={getAssetUrl(product.main_image)} alt={product.name} className="mb-4 w-full rounded-lg object-cover aspect-square" />
          ) : (
            <div className="mb-4 flex aspect-square items-center justify-center rounded-lg bg-slate-100 text-slate-400">No Image</div>
          )}
          {product.images?.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {product.images.map((img) => (
                <img key={img.id} src={getAssetUrl(img.url)} alt="" className="rounded object-cover aspect-square" />
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-400">{product.code}</p>
                <h2 className="text-xl font-bold">{product.name}</h2>
                <p className="text-sm text-slate-500">{product.category_name}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => navigate('/bookings', { state: { productId: product.id } })} className="btn-primary text-xs">
                  <Plus className="h-4 w-4" /> Booking
                </button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div><p className="text-xs text-slate-400">Harga Sewa</p><p className="font-semibold">{formatCurrency(product.rent_price)}</p></div>
              <div><p className="text-xs text-slate-400">Deposit</p><p className="font-semibold">{formatCurrency(product.deposit)}</p></div>
              <div><p className="text-xs text-slate-400">Stok</p><p className="font-semibold">{product.stock}</p></div>
              <div><p className="text-xs text-slate-400">Status</p>
                <span className={`text-sm font-medium ${product.is_active ? 'text-green-600' : 'text-slate-400'}`}>
                  {product.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>
            </div>
            {product.description && <p className="mt-4 text-sm text-slate-600">{product.description}</p>}
          </div>

          <div className="card p-5">
            <h3 className="mb-3 font-semibold">Riwayat Sewa</h3>
            {product.history?.length ? (
              <div className="space-y-2">
                {product.history.map((h) => (
                  <div key={h.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <div>
                      <Link to={`/bookings/${h.id}`} className="font-medium text-primary-600">{h.booking_number}</Link>
                      <p className="text-xs text-slate-400">{h.customer_name} • {formatDate(h.event_date)}</p>
                    </div>
                    <Badge status={h.status} map={BOOKING_STATUS} />
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-400">Belum ada riwayat</p>}
          </div>

          <div className="card p-5">
            <h3 className="mb-3 font-semibold">Daftar Keep</h3>
            {product.keeps?.length ? (
              <div className="space-y-2">
                {product.keeps.map((k) => (
                  <div key={k.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{k.customer_name}</p>
                      <p className="text-xs text-slate-400">{formatDate(k.start_date)} - {formatDate(k.end_date)}</p>
                    </div>
                    <Badge status={k.status} map={{ KEEP: { label: 'Keep', color: 'bg-yellow-100 text-yellow-800' }, EXPIRED: { label: 'Expired', color: 'bg-slate-100 text-slate-600' }, CANCEL: { label: 'Cancel', color: 'bg-red-100 text-red-800' } }} />
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-slate-400">Tidak ada keep</p>}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
