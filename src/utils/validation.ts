/**
 * Client-side mirrors of the server's validation rules
 * (backend/models/schemas.py). Kept deliberately in lock-step: when the client
 * accepted a value the server rejects, the user got an unexplained 422 after a
 * "successful" submit. Each validator returns an error string, or null if valid.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mirrors _COMMON_PASSWORDS in backend/models/schemas.py. */
const COMMON_PASSWORDS = new Set([
  'password', 'password1', '12345678', '123456789', '1234567890',
  'qwerty123', 'password123', '11111111', '00000000', 'iloveyou',
  'admin123', 'welcome1', 'letmein1', 'abc12345',
]);

export function validateRequired(value: string, label: string): string | null {
  return value.trim() ? null : `${label} is required`;
}

export function validateEmail(email: string): string | null {
  const v = email.trim();
  if (!v) return 'Email is required';
  if (!EMAIL_RE.test(v)) return 'Enter a valid email address';
  return null;
}

/** Mirrors validate_password_strength(). */
export function validatePassword(pw: string): string | null {
  if (!pw) return 'Password is required';
  if (pw.length < 8 || pw.length > 128) return 'Password must be between 8 and 128 characters';
  if (!/[a-zA-Z]/.test(pw)) return 'Password must contain at least one letter';
  if (!/\d/.test(pw)) return 'Password must contain at least one number';
  if (COMMON_PASSWORDS.has(pw.toLowerCase())) return 'Password is too common; choose a stronger one';
  return null;
}

/** Mirrors normalize_phone(). Returns the error, or null when normalizable. */
export function validatePhone(phone: string): string | null {
  try {
    normalizePhone(phone);
    return null;
  } catch (e: any) {
    return e.message;
  }
}

/** Mirrors normalize_phone() — E.164 for Indian mobiles. Throws on invalid. */
export function normalizePhone(raw: string): string {
  const v = (raw || '').trim().replace(/[\s\-()]/g, '');
  let digits: string;

  if (v.startsWith('+')) {
    const rest = v.slice(1);
    if (!/^\d+$/.test(rest)) throw new Error('Enter a valid phone number');
    if (!rest.startsWith('91')) throw new Error('Only Indian (+91) numbers are supported right now');
    digits = rest.slice(2);
  } else {
    if (!/^\d+$/.test(v)) throw new Error('Enter a valid phone number');
    digits = v.replace(/^0+/, '');
    if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  }

  if (digits.length !== 10 || !'6789'.includes(digits[0])) {
    throw new Error('Enter a valid 10-digit Indian mobile number');
  }
  return `+91${digits}`;
}

/** First error across a set of field validations, or null when all pass. */
export function firstError(...errors: (string | null)[]): string | null {
  return errors.find((e) => e !== null) ?? null;
}

// ── Dates, times, numbers, links, business identifiers ─────────────────────
// One implementation per concept, shared by every form. Messages follow one
// style: say what is wrong and what is allowed ("Pay must be greater than 0."),
// never just "Invalid". The server re-checks all of these against ITS clock and
// is authoritative; these exist for instant feedback.

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Today as YYYY-MM-DD on this device (for feedback only; see above). */
export function todayString(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/** The current moment as YYYY-MM-DDTHH:MM, for a date-time picker's min. */
export function nowMinuteString(now: Date = new Date()): string {
  return `${todayString(now)}T${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

/** A real calendar date in YYYY-MM-DD: the shape alone lets 2026-02-30 through. */
export function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function validateDate(value: string, label: string, opts: {
  required?: boolean; notPast?: boolean; notFuture?: boolean; now?: Date;
} = {}): string | null {
  if (!value) return opts.required ? `Please choose the ${label.toLowerCase()}.` : null;
  if (!isRealDate(value)) return `Please choose a valid ${label.toLowerCase()}.`;
  const today = todayString(opts.now);
  if (opts.notPast && value < today) return `${label} cannot be in the past.`;
  if (opts.notFuture && value > today) return `${label} cannot be in the future.`;
  return null;
}

/** start <= end for two YYYY-MM-DD (or YYYY-MM) values; blank ends are open. */
export function validateDateOrder(start: string, end: string, message: string): string | null {
  return start && end && end < start ? message : null;
}

export const isTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

/**
 * A time window. With `allowOvernight` an end before the start is the next
 * morning (a night shift), which is only wrong when it is the SAME time.
 */
export function validateTimeRange(start: string, end: string, opts: { allowOvernight?: boolean } = {}): string | null {
  if (!start) return 'Please choose the start time.';
  if (!end) return 'Please choose the end time.';
  if (!isTime(start) || !isTime(end)) return 'Please choose valid times.';
  if (start === end) return 'Start and end times must be different.';
  if (!opts.allowOvernight && end < start) return 'End time must be later than start time.';
  return null;
}

/** A whole number in [min, max]. `value` is the raw field text. */
export function validateInteger(value: string, label: string, opts: {
  min?: number; max?: number; required?: boolean;
} = {}): string | null {
  const v = (value ?? '').trim();
  if (!v) return opts.required ? `${label} is required.` : null;
  if (!/^\d+$/.test(v)) return `${label} must be a whole number.`;
  const n = Number(v);
  if (opts.min !== undefined && n < opts.min) {
    return opts.min === 1 ? `${label} must be at least 1.` : `${label} must be at least ${opts.min}.`;
  }
  if (opts.max !== undefined && n > opts.max) return `${label} must be at most ${opts.max.toLocaleString('en-IN')}.`;
  return null;
}

/** An amount of money in whole rupees: positive unless `allowZero`. */
export function validateAmount(value: string, label: string, opts: {
  required?: boolean; allowZero?: boolean; max?: number;
} = {}): string | null {
  const v = (value ?? '').trim();
  if (!v) return opts.required ? `${label} is required.` : null;
  if (!/^\d+$/.test(v)) return `${label} must be a number.`;
  const n = Number(v);
  if (!opts.allowZero && n <= 0) return `${label} must be greater than 0.`;
  if (opts.max !== undefined && n > opts.max) return `${label} cannot exceed ₹${opts.max.toLocaleString('en-IN')}.`;
  return null;
}

/** "example.com" → "https://example.com"; the server stores the same. */
export function normalizeUrl(value: string): string {
  const v = (value ?? '').trim();
  if (!v) return '';
  if (/^http:\/\//i.test(v)) return `https://${v.slice(7)}`;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
}

export function validateUrl(value: string, label = 'Website'): string | null {
  const v = normalizeUrl(value);
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:' || !u.hostname.includes('.') || u.hostname.endsWith('.')) throw new Error();
    if (v.length > 500) return `${label} must be at most 500 characters.`;
    return null;
  } catch {
    return `Please enter a valid ${label.toLowerCase()}, e.g. https://example.com.`;
  }
}

export function validateOptionalEmail(value: string): string | null {
  const v = (value ?? '').trim();
  return !v || EMAIL_RE.test(v) ? null : 'Please enter a valid email address.';
}

/** A public or office number: landline and international allowed. */
export function validateContactPhone(value: string): string | null {
  const v = (value ?? '').trim();
  if (!v) return null;
  const digits = v.replace(/\D/g, '');
  return /^\+?[\d\s\-()]{8,20}$/.test(v) && digits.length >= 8 && digits.length <= 15
    ? null : 'Please enter a valid phone number.';
}

export function validateOptionalMobile(value: string): string | null {
  return (value ?? '').trim() ? validatePhone(value) : null;
}

export function validatePincode(value: string): string | null {
  const v = (value ?? '').trim();
  return !v || /^[1-9]\d{5}$/.test(v) ? null : 'Please enter a valid 6-digit PIN code.';
}

export function validateGstin(value: string): string | null {
  const v = (value ?? '').trim().toUpperCase();
  return !v || /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v)
    ? null : 'Please enter a valid 15-character GSTIN, e.g. 27ABCDE1234F1Z5.';
}

export function validatePan(value: string): string | null {
  const v = (value ?? '').trim().toUpperCase();
  return !v || /^[A-Z]{5}\d{4}[A-Z]$/.test(v) ? null : 'Please enter a valid 10-character PAN, e.g. ABCDE1234F.';
}

/** Collects field errors; `ok` is true when there are none. */
export function collectErrors<K extends string>(checks: Record<K, string | null>): {
  errors: Partial<Record<K, string>>; ok: boolean; first: string | null;
} {
  const errors: Partial<Record<K, string>> = {};
  (Object.keys(checks) as K[]).forEach(k => { if (checks[k]) errors[k] = checks[k] as string; });
  const first = (Object.values(errors)[0] as string | undefined) ?? null;
  return { errors, ok: !first, first };
}
