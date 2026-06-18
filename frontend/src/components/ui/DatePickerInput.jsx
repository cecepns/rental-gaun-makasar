import DatePicker, { registerLocale } from 'react-datepicker';
import { id } from 'date-fns/locale/id';
import { Calendar } from 'lucide-react';
import { toInputDate } from '@/utils/helpers';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('id', id);

const parseDate = (value) => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export default function DatePickerInput({
  label,
  value,
  onChange,
  required = false,
  minDate,
  placeholder = 'Pilih tanggal',
}) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <div className="relative">
        <DatePicker
          selected={parseDate(value)}
          onChange={(date) => onChange(date ? toInputDate(date) : '')}
          dateFormat="dd MMM yyyy"
          locale="id"
          placeholderText={placeholder}
          minDate={minDate ? parseDate(minDate) : undefined}
          required={required}
          className="input w-full pr-10"
          wrapperClassName="w-full"
          popperClassName="datepicker-popper"
          calendarClassName="!font-sans !border-slate-200 !shadow-lg"
          showPopperArrow={false}
          autoComplete="off"
        />
        <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );
}
