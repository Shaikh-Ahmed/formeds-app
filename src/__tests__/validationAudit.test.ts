import {
  isRealDate, normalizeUrl, validateAmount, validateContactPhone, validateDate, validateDateOrder, validateGstin,
  validateInteger, validatePan, validatePincode, validateTimeRange, validateUrl,
} from '../utils/validation';
import { ENTRY_FORMS, SCALAR_FORMS, entryFieldErrors, normalizeEntryValues } from '../components/profile/entryForms';
import { shiftDuration, splitShiftTime } from '../components/jobs/wizard/JobWizard';
import { ApiError, errorFields } from '../utils/api';

/**
 * The shared validators every form uses. One test per rule the audit relies
 * on, including the legitimate values that must NOT be rejected.
 */
const NOW = new Date(2026, 8, 27, 10, 0); // 27 Sep 2026, 10:00

describe('dates', () => {
  it('knows a real calendar date from a well-shaped impossible one', () => {
    expect(isRealDate('2028-02-29')).toBe(true); // leap year
    expect(isRealDate('2027-02-29')).toBe(false);
    expect(isRealDate('2026-04-31')).toBe(false);
    expect(isRealDate('27/09/2026')).toBe(false);
  });

  it('applies past/future rules against today, with today allowed', () => {
    expect(validateDate('2026-09-26', 'Locum date', { notPast: true, now: NOW })).toBe('Locum date cannot be in the past.');
    expect(validateDate('2026-09-27', 'Locum date', { notPast: true, now: NOW })).toBeNull();
    expect(validateDate('2026-09-28', 'Date of birth', { notFuture: true, now: NOW })).toBe('Date of birth cannot be in the future.');
    expect(validateDate('', 'Start date', { required: true })).toBe('Please choose the start date.');
    expect(validateDate('', 'Start date')).toBeNull();
  });

  it('orders a range, leaving an open end open', () => {
    expect(validateDateOrder('2026-10-15', '2026-10-13', 'End date cannot be before the start date.'))
      .toBe('End date cannot be before the start date.');
    expect(validateDateOrder('2026-10-15', '', 'x')).toBeNull();
    expect(validateDateOrder('2026-10-15', '2026-10-15', 'x')).toBeNull();
  });
});

describe('times', () => {
  it('rejects end before start unless overnight is supported', () => {
    expect(validateTimeRange('17:00', '09:00')).toBe('End time must be later than start time.');
    expect(validateTimeRange('09:00', '17:00')).toBeNull();
    expect(validateTimeRange('20:00', '08:00', { allowOvernight: true })).toBeNull();
    expect(validateTimeRange('09:00', '09:00', { allowOvernight: true })).toBe('Start and end times must be different.');
    expect(validateTimeRange('', '09:00')).toBe('Please choose the start time.');
  });
});

describe('numbers', () => {
  it('takes whole numbers in range only', () => {
    expect(validateInteger('3', 'Number of openings', { min: 1, max: 999, required: true })).toBeNull();
    expect(validateInteger('0', 'Number of openings', { min: 1 })).toBe('Number of openings must be at least 1.');
    expect(validateInteger('1.5', 'Number of openings', { min: 1 })).toBe('Number of openings must be a whole number.');
    expect(validateInteger('-1', 'Number of openings', { min: 1 })).toBe('Number of openings must be a whole number.');
    expect(validateInteger('abc', 'Number of openings')).toBe('Number of openings must be a whole number.');
    expect(validateInteger('', 'Number of openings', { required: true })).toBe('Number of openings is required.');
  });

  it('takes a positive amount of money and nothing else', () => {
    expect(validateAmount('3000', 'Pay', { required: true })).toBeNull();
    expect(validateAmount('0', 'Pay')).toBe('Pay must be greater than 0.');
    expect(validateAmount('three thousand', 'Pay')).toBe('Pay must be a number.');
    expect(validateAmount('₹1,000', 'Pay')).toBe('Pay must be a number.');
    expect(validateAmount('20000000', 'Pay', { max: 10_000_000 })).toMatch(/cannot exceed/);
  });
});

describe('links, contacts and identifiers', () => {
  it('turns "example.com" into the https URL it means', () => {
    expect(normalizeUrl('careplus.in')).toBe('https://careplus.in');
    expect(normalizeUrl('http://careplus.in')).toBe('https://careplus.in');
    expect(validateUrl('careplus.in')).toBeNull();
    expect(validateUrl('not a site')).toMatch(/valid website/);
    expect(validateUrl('')).toBeNull();
  });

  it('accepts real office numbers, including landlines and international', () => {
    expect(validateContactPhone('020 2612 3456')).toBeNull();
    expect(validateContactPhone('+44 20 7946 0958')).toBeNull();
    expect(validateContactPhone('hello')).toBe('Please enter a valid phone number.');
  });

  it('checks Indian business identifiers by their real formats', () => {
    expect(validatePincode('411001')).toBeNull();
    expect(validatePincode('011001')).toMatch(/6-digit/);
    expect(validateGstin('27abcde1234f1z5')).toBeNull();
    expect(validateGstin('27ABCDE')).toMatch(/GSTIN/);
    expect(validatePan('ABCDE1234F')).toBeNull();
    expect(validatePan('1234')).toMatch(/PAN/);
  });
});

describe('profile entries', () => {
  it('refuses history dated in the future and ranges that run backwards', () => {
    const exp = entryFieldErrors(ENTRY_FORMS.experience, {
      title: 'Registrar', organization: 'AIIMS', start_date: '2027-01', end_date: '2020-01',
    }, NOW);
    expect(exp.start_date).toBe('Start date cannot be in the future.');
    expect(exp.end_date).toBe('End date cannot be earlier than start date.');
    const edu = entryFieldErrors(ENTRY_FORMS.education, {
      degree: 'MD', institution: 'AIIMS', start_year: 2020, end_year: 2018,
    }, NOW);
    expect(edu.end_year).toBe('End year cannot be earlier than start year.');
    // This month is fine; a hidden field (current role) is not judged.
    expect(entryFieldErrors(ENTRY_FORMS.experience, {
      title: 'Registrar', organization: 'AIIMS', start_date: '2026-09', is_current: true, end_date: '2001-01',
    }, NOW)).toEqual({});
  });

  it('checks links, including where they must point', () => {
    const errs = entryFieldErrors(SCALAR_FORMS.links, { linkedin: 'https://example.com/me', website: 'mysite.in' });
    expect(errs.linkedin).toBe('LinkedIn must be a link to linkedin.com.');
    expect(errs.website).toBeUndefined();
    expect(normalizeEntryValues(SCALAR_FORMS.links, { website: 'mysite.in' }).website).toBe('https://mysite.in');
  });

  it('keeps CME credits a number in range', () => {
    const f = ENTRY_FORMS.conference;
    expect(entryFieldErrors(f, { name: 'CSI', cme_credits: 600 }).cme_credits).toBe('CME credits must be at most 500.');
    expect(entryFieldErrors(f, { name: 'CSI', cme_credits: 4.5 })).toEqual({});
  });
});

describe('job shift times', () => {
  it('reads and writes the stored "HH:MM–HH:MM", overnight aware', () => {
    expect(splitShiftTime('20:00–08:00')).toEqual({ shift_start_time: '20:00', shift_end_time: '08:00' });
    expect(splitShiftTime('Nights, flexible')).toEqual({ shift_start_time: '', shift_end_time: '' });
    expect(shiftDuration('20:00', '08:00')).toBe('12 hours');
    expect(shiftDuration('09:00', '17:30')).toBe('8 hours 30 min');
  });
});

describe('server errors', () => {
  it('places 422 messages and business-rule codes on their fields', () => {
    const e422 = new ApiError('x', 422, { detail: [{ field: 'title', msg: 'Title must be at least 6 characters' }] });
    expect(errorFields(e422)).toEqual({ title: 'Title must be at least 6 characters' });
    const e400 = new ApiError('Locum date cannot be in the past', 400, { detail: { code: 'shift_in_past', message: 'Locum date cannot be in the past' } });
    expect(errorFields(e400, { shift_in_past: 'shift_date' })).toEqual({ shift_date: 'Locum date cannot be in the past' });
  });
});
