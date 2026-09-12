import { APPLICATION_STATUS_META, type ApplicationStatusKey } from '../types/jobs';

/**
 * How an application's stage is presented.
 *
 * The rule these enforce is that status is never carried by colour alone.
 * "Offered" and "Not selected" are the two outcomes a candidate most needs to
 * tell apart, and distinguishing them by hue fails for a red-green colourblind
 * reader, on a dim screen, and in bright sun — which is most of the places a
 * clinician checks their phone.
 */

const ALL: ApplicationStatusKey[] = [
  'applied', 'reviewing', 'shortlisted', 'interviewing',
  'offered', 'hired', 'rejected', 'withdrawn',
];

describe('APPLICATION_STATUS_META', () => {
  it('covers every status the server can send', () => {
    // A status with no entry renders as undefined and crashes the row, so the
    // map has to stay in step with the backend Literal.
    for (const status of ALL) {
      expect(APPLICATION_STATUS_META[status]).toBeDefined();
    }
    expect(Object.keys(APPLICATION_STATUS_META).sort()).toEqual([...ALL].sort());
  });

  it('gives every status both an icon and words', () => {
    for (const status of ALL) {
      const meta = APPLICATION_STATUS_META[status];
      expect(meta.icon).toBeTruthy();
      expect(meta.label.trim().length).toBeGreaterThan(0);
    }
  });

  it('labels are human, not the wire value', () => {
    // 'reviewing' is a database word; 'Under review' is what a person reads.
    expect(APPLICATION_STATUS_META.reviewing.label).toBe('Under review');
    expect(APPLICATION_STATUS_META.rejected.label).toBe('Not selected');
    for (const status of ALL) {
      expect(APPLICATION_STATUS_META[status].label).not.toBe(status);
    }
  });

  it('does not reuse one icon for opposite outcomes', () => {
    // Offered and rejected sharing an icon would leave colour as the only
    // difference, which is the exact failure this map exists to prevent.
    const { offered, rejected, hired } = APPLICATION_STATUS_META;
    expect(offered.icon).not.toBe(rejected.icon);
    expect(hired.icon).not.toBe(rejected.icon);
  });

  it('reserves the danger tone for the one genuinely bad outcome', () => {
    const danger = ALL.filter(s => APPLICATION_STATUS_META[s].tone === 'danger');
    expect(danger).toEqual(['rejected']);
  });

  it('treats withdrawn as neutral, because it was the candidate’s own choice', () => {
    expect(APPLICATION_STATUS_META.withdrawn.tone).toBe('neutral');
  });

  it('marks the stages that mean things are going well', () => {
    for (const status of ['shortlisted', 'interviewing', 'offered', 'hired'] as const) {
      expect(APPLICATION_STATUS_META[status].tone).toBe('teal');
    }
  });
});
