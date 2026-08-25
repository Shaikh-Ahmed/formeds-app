/** Date and range formatting for resume entries. */

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** `2022-01` → `Jan 2022`. Returns '' for anything unparseable. */
export function formatMonth(value?: string | null): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return value;
  return `${MONTHS[month - 1]} ${match[1]}`;
}

/**
 * `Jan 2022 — Present`, or a single date, or ''.
 *
 * An open-ended range reads as "Present" rather than being left blank: on a CV
 * a missing end date is ambiguous between "current" and "not filled in".
 */
export function formatRange(
  start?: string | null,
  end?: string | null,
  isCurrent?: boolean,
): string {
  const from = formatMonth(start);
  const to = isCurrent ? 'Present' : formatMonth(end);
  if (from && to) return `${from} — ${to}`;
  return from || to || '';
}

export function formatYearRange(start?: number | null, end?: number | null): string {
  if (start && end) return `${start} — ${end}`;
  return String(start || end || '');
}

/** Joins the parts of a meta line, dropping blanks so no stray separators show. */
export function joinMeta(...parts: (string | null | undefined)[]): string {
  return parts.filter((p) => !!p && String(p).trim()).join(' · ');
}

/** Splits a description into bullet lines, tolerating `-`/`•` prefixes. */
export function toBullets(description?: string | null): string[] {
  if (!description) return [];
  return description
    .split('\n')
    .map((line) => line.replace(/^\s*[-•*]\s*/, '').trim())
    .filter(Boolean);
}

/**
 * Masks all but the last four characters of a registration number.
 *
 * A council number is a real-world identifier, so the default view shows enough
 * to recognise it without publishing it in full.
 */
export function maskNumber(value?: string | null): string {
  if (!value) return '';
  const text = String(value);
  if (text.length <= 4) return text;
  return `${'•'.repeat(Math.min(text.length - 4, 8))}${text.slice(-4)}`;
}
