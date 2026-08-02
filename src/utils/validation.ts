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
