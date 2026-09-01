import { activeFilterCount, buildJobsQuery, jobsPath } from '../api/jobs';
import type { JobFilters } from '../types/jobs';

/**
 * Filter serialisation.
 *
 * This is the highest-value unit test in the Jobs work, because a filter that
 * stops being sent is indistinguishable from a filter that matches everything:
 * the request succeeds, the list fills with results, and nothing anywhere says
 * the user's choice was dropped. A pure function makes that catchable.
 */

const parse = (filters: JobFilters) => new URLSearchParams(buildJobsQuery(filters));

describe('buildJobsQuery', () => {
  it('sends nothing for an empty filter set', () => {
    expect(buildJobsQuery({})).toBe('');
    expect(jobsPath({})).toBe('/api/jobs/');
  });

  it('omits blanks rather than sending them empty', () => {
    // `?city=` is not "no city filter" — it asks the server for the empty
    // string and reliably returns nothing.
    const query = buildJobsQuery({ q: '   ', city: '', specialty: undefined, urgent_only: false });
    expect(query).toBe('');
  });

  it('repeats employment_type so the server reads it as a list', () => {
    const params = parse({ employment_type: ['locum', 'fellowship'] });
    expect(params.getAll('employment_type')).toEqual(['locum', 'fellowship']);
  });

  it('carries every range filter through', () => {
    const params = parse({ pay_min: 100000, pay_max: 500000, experience_max: 5 });
    expect(params.get('pay_min')).toBe('100000');
    expect(params.get('pay_max')).toBe('500000');
    expect(params.get('experience_max')).toBe('5');
  });

  it('keeps a zero, which is a real value', () => {
    // Number 0 must survive: "no experience needed" is a filter, not an absence.
    expect(parse({ experience_max: 0 }).get('experience_max')).toBe('0');
  });

  it('url-encodes values that would otherwise break the query string', () => {
    const params = parse({ specialty: 'Obstetrics & Gynaecology', city: 'Aalo (Along)' });
    expect(params.get('specialty')).toBe('Obstetrics & Gynaecology');
    expect(params.get('city')).toBe('Aalo (Along)');
    expect(buildJobsQuery({ specialty: 'Obstetrics & Gynaecology' })).toContain('%26');
  });

  it('trims the query but keeps the words inside it', () => {
    expect(parse({ q: '  cardiology hyderabad  ' }).get('q')).toBe('cardiology hyderabad');
  });

  it('is stable across calls, so the request path does not churn', () => {
    const filters: JobFilters = { specialty: 'Cardiology', city: 'Hyderabad', sort: 'newest' };
    expect(buildJobsQuery(filters)).toBe(buildJobsQuery({ ...filters }));
  });

  it('builds a path with a single separator', () => {
    expect(jobsPath({ q: 'nurse' })).toBe('/api/jobs/?q=nurse');
  });
});

describe('activeFilterCount', () => {
  it('does not count the search box or the sort control', () => {
    // Neither is a filter: "Clear filters" must not wipe what the user typed,
    // and a badge reading "Filters (1)" for the default sort is a lie.
    expect(activeFilterCount({ q: 'cardiology', sort: 'pay_high' })).toBe(0);
  });

  it('counts each set filter once, however many values it holds', () => {
    expect(activeFilterCount({ employment_type: ['locum', 'fellowship'] })).toBe(1);
    expect(activeFilterCount({ specialty: 'Cardiology', city: 'Hyderabad' })).toBe(2);
  });

  it('ignores emptied filters', () => {
    expect(activeFilterCount({ employment_type: [], city: '', urgent_only: false })).toBe(0);
  });

  it('counts an urgent-only toggle when it is on', () => {
    expect(activeFilterCount({ urgent_only: true })).toBe(1);
  });
});
