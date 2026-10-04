/**
 * How a locum reads, in one place, so the card, the detail panel, the
 * hospital's list and the applicant's list cannot phrase the same shift two
 * different ways.
 *
 * Shift date and times are IST wall-clock values from the hospital, and are
 * rendered as written -- never pushed through a Date and back, which would
 * move "09:00" to wherever the reader's device happens to be.
 */

import { formatPayValue } from '../jobs/JobMeta';
import {
  LOCUM_PAY_LABELS, LOCUM_ROLE_LABELS, type Locum,
} from '../../types/locum';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A YYYY-MM-DD as a calendar date, with no timezone attached. */
export function parseDay(day: string): Date {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toDayString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "Today", "Tomorrow", or "Sat, 12 Oct". */
export function formatShiftDay(day: string, today: Date = new Date()): string {
  const date = parseDay(day);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((date.getTime() - start.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "09:00" → "9 AM", "20:30" → "8:30 PM". */
export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, '0')} ${suffix}` : `${hour} ${suffix}`;
}

export const isOvernight = (locum: Pick<Locum, 'start_time' | 'end_time'>): boolean =>
  locum.end_time <= locum.start_time;

/** "9 AM – 5 PM", or "8 PM – 8 AM (next day)". */
export function formatShiftHours(locum: Pick<Locum, 'start_time' | 'end_time'>): string {
  const range = `${formatClock(locum.start_time)} – ${formatClock(locum.end_time)}`;
  return isOvernight(locum) ? `${range} (next day)` : range;
}

/** "₹12K per shift", or "Negotiable". */
export function formatLocumPay(locum: Pick<Locum, 'pay_amount' | 'pay_type'>): string {
  if (locum.pay_type === 'negotiable' || !locum.pay_amount) return 'Pay negotiable';
  const period = locum.pay_type === 'fixed' ? '' : ` ${LOCUM_PAY_LABELS[locum.pay_type]}`;
  return `${formatPayValue(locum.pay_amount)}${period}`;
}

/** "Doctor · General Medicine". */
export function formatRoleLine(locum: Pick<Locum, 'role_required' | 'specialty'>): string {
  return [LOCUM_ROLE_LABELS[locum.role_required], locum.specialty].filter(Boolean).join(' · ');
}

/** "2 doctors needed" or "1 of 3 still open". */
export function formatOpenings(locum: Pick<Locum, 'openings' | 'openings_left' | 'role_required'>): string {
  if (locum.openings === 1) return '1 needed';
  if (locum.openings_left === locum.openings) return `${locum.openings} needed`;
  return `${locum.openings_left} of ${locum.openings} still open`;
}

/** "Closes in 5h" when it is close, otherwise "Apply by 11 Oct, 6 PM". */
export function formatDeadline(applyBy: string, now: Date = new Date()): string {
  const deadline = new Date(applyBy);
  if (Number.isNaN(deadline.getTime())) return '';
  const ms = deadline.getTime() - now.getTime();
  if (ms <= 0) return 'Applications closed';
  const hours = Math.floor(ms / 3600000);
  if (hours < 1) return `Closes in ${Math.max(Math.round(ms / 60000), 1)} min`;
  if (hours < 24) return `Closes in ${hours}h`;
  const time = formatClock(
    `${String(deadline.getHours()).padStart(2, '0')}:${String(deadline.getMinutes()).padStart(2, '0')}`,
  );
  return `Apply by ${deadline.getDate()} ${MONTHS[deadline.getMonth()]}, ${time}`;
}

/** "Hyderabad" or "Ward 4, Hyderabad". */
export function formatPlace(locum: Pick<Locum, 'city' | 'address'>): string {
  return [locum.address, locum.city].filter(Boolean).join(', ');
}

/** Status tones mapped onto the badge tones JobBadge understands. */
export const BADGE_TONE = {
  neutral: 'neutral', teal: 'teal', navy: 'navy', warning: 'warning', danger: 'danger',
} as const;
