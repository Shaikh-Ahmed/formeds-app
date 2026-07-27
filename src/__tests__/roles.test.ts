import { getRoleMeta, ROLE_META } from '../theme/roles';

describe('getRoleMeta', () => {
  it('returns the right meta for each known role', () => {
    expect(getRoleMeta('hospital').label).toBe('Hospital');
    expect(getRoleMeta('clinic').label).toBe('Clinic');
    expect(getRoleMeta('healthcare_professional').label).toBe('Professional');
  });

  it('falls back to healthcare_professional for unknown/missing roles', () => {
    expect(getRoleMeta('astronaut')).toBe(ROLE_META.healthcare_professional);
    expect(getRoleMeta(undefined)).toBe(ROLE_META.healthcare_professional);
    expect(getRoleMeta(null)).toBe(ROLE_META.healthcare_professional);
    expect(getRoleMeta('')).toBe(ROLE_META.healthcare_professional);
  });

  it('gives every role a colour, background and both labels', () => {
    Object.values(ROLE_META).forEach(meta => {
      expect(meta.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(meta.bg).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.longLabel.length).toBeGreaterThan(0);
    });
  });
});
