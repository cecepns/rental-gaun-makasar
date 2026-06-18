import { useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { getAssetUrl } from '@/utils/config';

function ImagePreviewItem({ src, label, onRemove, removing }) {
  return (
    <div className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
      <img src={src} alt={label} className="h-full w-full object-cover" />
      {label && (
        <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {label}
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        disabled={removing}
        className="absolute right-2 top-2 rounded-full bg-red-500 p-1 text-white opacity-0 shadow transition group-hover:opacity-100 disabled:opacity-50"
        title="Hapus gambar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function UploadZone({ onSelect, multiple, label, hint, inputRef }) {
  return (
    <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 transition hover:border-primary-400 hover:bg-primary-50/50">
      <ImagePlus className="mb-2 h-8 w-8 text-slate-400" />
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <span className="mt-1 text-xs text-slate-400">{hint}</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={onSelect}
      />
    </label>
  );
}

export default function ProductImageFields({
  existingMain,
  existingGallery = [],
  pendingMain,
  pendingGallery = [],
  onSelectMain,
  onSelectGallery,
  onRemoveExistingMain,
  onRemoveExistingGallery,
  onRemovePendingMain,
  onRemovePendingGallery,
  removingMain = false,
  removingGalleryId = null,
}) {
  const mainInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const hasMain = existingMain || pendingMain;
  const totalGallery = existingGallery.length + pendingGallery.length;

  return (
    <div className="sm:col-span-2 space-y-5">
      <div>
        <label className="label">Foto Utama</label>
        {hasMain ? (
          <div className="flex flex-col items-start gap-2">
            {pendingMain && (
              <ImagePreviewItem
                src={pendingMain.preview}
                label="Baru"
                onRemove={onRemovePendingMain}
              />
            )}
            {existingMain && !pendingMain && (
              <ImagePreviewItem
                src={getAssetUrl(existingMain)}
                label="Utama"
                onRemove={onRemoveExistingMain}
                removing={removingMain}
              />
            )}
            {existingMain && pendingMain && (
              <p className="text-xs text-amber-600">Foto utama lama akan diganti saat disimpan</p>
            )}
            <button
              type="button"
              onClick={() => mainInputRef.current?.click()}
              className="text-xs text-primary-600 hover:underline"
            >
              Ganti foto utama
            </button>
            <input ref={mainInputRef} type="file" accept="image/*" className="hidden" onChange={onSelectMain} />
          </div>
        ) : (
          <UploadZone
            inputRef={mainInputRef}
            label="Upload foto utama"
            hint="JPG, PNG, WEBP — maks 5MB"
            onSelect={onSelectMain}
          />
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="label mb-0">Galeri Foto</label>
          <span className="text-xs text-slate-400">{totalGallery} foto</span>
        </div>

        {totalGallery > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {existingGallery.map((img) => (
              <ImagePreviewItem
                key={`db-${img.id}`}
                src={getAssetUrl(img.url)}
                label="Tersimpan"
                onRemove={() => onRemoveExistingGallery(img)}
                removing={removingGalleryId === img.id}
              />
            ))}
            {pendingGallery.map((item) => (
              <ImagePreviewItem
                key={item.id}
                src={item.preview}
                label="Baru"
                onRemove={() => onRemovePendingGallery(item.id)}
              />
            ))}
          </div>
        )}

        <UploadZone
          inputRef={galleryInputRef}
          label="Tambah ke galeri"
          hint="Bisa pilih beberapa foto sekaligus"
          multiple
          onSelect={onSelectGallery}
        />
      </div>
    </div>
  );
}
