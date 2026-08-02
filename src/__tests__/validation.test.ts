import {
  validateEmail,
  validatePassword,
  validatePhone,
  validateRequired,
  normalizePhone,
  firstError,
} from '../utils/validation';

/**
 * These rules must stay in lock-step with backend/models/schemas.py — the point
 * of the module is that the client never accepts what the server will reject.
 */

describe('validateEmail', () => {
  it('accepts a normal address', () => {
    expect(validateEmail('doc@example.com')).toBeNull();
    expect(validateEmail('  doc@example.com  ')).toBeNull();
  });

  it('rejects empty and malformed addresses', () => {
    expect(validateEmail('')).toBe('Email is required');
    expect(validateEmail('not-an-email')).toBeTruthy();
    expect(validateEmail('missing@domain')).toBeTruthy();
    expect(validateEmail('two @spaces.com')).toBeTruthy();
  });
});

describe('validatePassword', () => {
  it('accepts a letter+digit password of 8 or more', () => {
    expect(validatePassword('strongpass1')).toBeNull();
  });

  it('enforces the same rules as the server', () => {
    expect(validatePassword('short1')).toBe('Password must be between 8 and 128 characters');
    expect(validatePassword('onlyletters')).toBe('Password must contain at least one number');
    expect(validatePassword('12345678')).toBe('Password must contain at least one letter');
    expect(validatePassword('a'.repeat(129) + '1')).toBeTruthy();
  });

  it('rejects passwords on the shared denylist', () => {
    expect(validatePassword('password123')).toBe('Password is too common; choose a stronger one');
    expect(validatePassword('PASSWORD123')).toBe('Password is too common; choose a stronger one');
  });
});

describe('normalizePhone', () => {
  it.each([
    ['9812345678', '+919812345678'],
    ['+91 98123 45678', '+919812345678'],
    ['+91-9812345678', '+919812345678'],
    ['09812345678', '+919812345678'],
    ['919812345678', '+919812345678'],
    ['(981) 234-5678', '+919812345678'],
  ])('normalizes %s to E.164', (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  it.each(['12345', '5512345678', 'not-a-phone', '+15551234567', ''])(
    'rejects %s',
    (raw) => {
      expect(() => normalizePhone(raw)).toThrow();
      expect(validatePhone(raw)).toBeTruthy();
    },
  );

  it('rejects landline-style leading digits', () => {
    // Indian mobiles start 6-9; 2xx is a landline prefix.
    expect(() => normalizePhone('2212345678')).toThrow();
  });
});

describe('validateRequired', () => {
  it('treats whitespace as missing', () => {
    expect(validateRequired('   ', 'Full name')).toBe('Full name is required');
    expect(validateRequired('Dr. A', 'Full name')).toBeNull();
  });
});

describe('firstError', () => {
  it('returns the first problem, or null when everything passes', () => {
    expect(firstError(null, 'second', 'third')).toBe('second');
    expect(firstError(null, null)).toBeNull();
  });
});
