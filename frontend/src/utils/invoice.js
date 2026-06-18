import { jsPDF } from 'jspdf';
import { formatCurrency, formatDate } from './helpers';

export function generateInvoicePdf({ booking, settings }) {
  const doc = new jsPDF();
  const summary = booking.paymentSummary || {};
  const storeName = settings?.store_name || 'Rental Shop';
  const margin = 20;
  let y = margin;

  doc.setFontSize(18);
  doc.text(storeName, 105, y, { align: 'center' });
  y += 8;

  doc.setFontSize(10);
  if (settings?.address) {
    doc.text(settings.address, 105, y, { align: 'center' });
    y += 6;
  }

  y += 6;
  doc.setFontSize(14);
  doc.text('INVOICE / NOTA SEWA', margin, y);
  y += 10;

  doc.setFontSize(10);
  const lines = [
    `No. Booking: ${booking.booking_number}`,
    `Customer: ${booking.customer_name}`,
    `Telp: ${booking.customer_phone || '-'}`,
    `Tanggal Acara: ${formatDate(booking.event_date)}`,
    `Ambil: ${formatDate(booking.pickup_date)} | Kembali: ${formatDate(booking.return_date)}`,
  ];
  lines.forEach((line) => { doc.text(line, margin, y); y += 6; });

  y += 4;
  doc.text('Daftar Barang:', margin, y);
  y += 6;
  (booking.items || []).forEach((item) => {
    doc.text(`- ${item.product_name} x${item.quantity} @ ${formatCurrency(item.rent_price)}`, margin + 4, y);
    y += 6;
  });

  y += 4;
  doc.text(`Total Tagihan: ${formatCurrency(booking.total)}`, margin, y); y += 6;
  doc.text(`DP: ${formatCurrency(booking.dp_amount)}`, margin, y); y += 6;
  doc.text(`Total Dibayar: ${formatCurrency(summary.totalPaid)}`, margin, y); y += 6;
  doc.text(`Sisa Bayar: ${formatCurrency(summary.remaining)}`, margin, y);

  doc.save(`invoice-${booking.booking_number}.pdf`);
}

export function printInvoice({ booking, settings }) {
  const summary = booking.paymentSummary || {};
  const storeName = settings?.store_name || 'Rental Shop';
  const itemsHtml = (booking.items || [])
    .map((item) => `<tr><td>${item.product_name}</td><td>${item.quantity}</td><td>${formatCurrency(item.rent_price)}</td></tr>`)
    .join('');

  const html = `
    <!DOCTYPE html><html><head><title>Invoice ${booking.booking_number}</title>
    <style>body{font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto}
    h1{text-align:center}table{width:100%;border-collapse:collapse;margin:16px 0}
    td,th{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}
    .total{font-weight:bold}</style></head><body>
    <h1>${storeName}</h1>
    <p style="text-align:center">${settings?.address || ''}</p>
    <h2>INVOICE / NOTA SEWA</h2>
    <p><strong>No. Booking:</strong> ${booking.booking_number}</p>
    <p><strong>Customer:</strong> ${booking.customer_name}</p>
    <p><strong>Telp:</strong> ${booking.customer_phone || '-'}</p>
    <p><strong>Tanggal Acara:</strong> ${formatDate(booking.event_date)}</p>
    <p><strong>Ambil:</strong> ${formatDate(booking.pickup_date)} | <strong>Kembali:</strong> ${formatDate(booking.return_date)}</p>
    <table><thead><tr><th>Barang</th><th>Qty</th><th>Harga</th></tr></thead><tbody>${itemsHtml}</tbody></table>
    <p class="total">Total Tagihan: ${formatCurrency(booking.total)}</p>
    <p>DP: ${formatCurrency(booking.dp_amount)}</p>
    <p>Total Dibayar: ${formatCurrency(summary.totalPaid)}</p>
    <p class="total">Sisa Bayar: ${formatCurrency(summary.remaining)}</p>
    </body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}
