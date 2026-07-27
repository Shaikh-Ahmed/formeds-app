import { timeAgo, initialOf } from '../utils/time';

describe('timeAgo', () => {
  const at = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

  it('returns "now" for very recent times', () => {
    expect(timeAgo(at(5 * 1000))).toBe('now');
  });

  it('formats minutes, hours, days and weeks', () => {
    expect(timeAgo(at(5 * 60 * 1000))).toBe('5m');
    expect(timeAgo(at(3 * 60 * 60 * 1000))).toBe('3h');
    expect(timeAgo(at(2 * 24 * 60 * 60 * 1000))).toBe('2d');
    expect(timeAgo(at(14 * 24 * 60 * 60 * 1000))).toBe('2w');
  });

  it('handles missing and invalid input without throwing', () => {
    expect(timeAgo(undefined)).toBe('');
    expect(timeAgo(null)).toBe('');
    expect(timeAgo('not-a-date')).toBe('');
  });
});

describe('initialOf', () => {
  it('uppercases the first character', () => {
    expect(initialOf('priya')).toBe('P');
    expect(initialOf('  ahmed')).toBe('A');
  });

  it('falls back to U when there is no name', () => {
    expect(initialOf('')).toBe('U');
    expect(initialOf(undefined)).toBe('U');
  });
});
