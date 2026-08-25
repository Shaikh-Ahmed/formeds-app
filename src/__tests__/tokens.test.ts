import { compactAction, MIN_TOUCH_TARGET, spacing, radius } from '../theme/tokens';

/**
 * `compactAction` trades painted height for hit slop so a dense action row
 * (post like / comment / share) can be short without becoming hard to tap.
 * That trade only holds while the two halves stay in sync, which is exactly
 * the kind of thing a later "just make it a bit tighter" edit breaks silently
 * — the row would still look fine and simply become worse to use.
 */
describe('compactAction', () => {
  it('still reaches the minimum touch target once hit slop is counted', () => {
    const effectiveHeight =
      compactAction.height + compactAction.hitSlop.top + compactAction.hitSlop.bottom;
    expect(effectiveHeight).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  });

  it('is actually shorter than the target it stands in for', () => {
    // Otherwise the hit slop is pointless and the row should just be 44px.
    expect(compactAction.height).toBeLessThan(MIN_TOUCH_TARGET);
  });

  it('extends the touch area horizontally too', () => {
    expect(compactAction.hitSlop.left).toBeGreaterThan(0);
    expect(compactAction.hitSlop.right).toBeGreaterThan(0);
  });
});

describe('spacing and radius scales', () => {
  it('increase monotonically, so a larger token is never visually smaller', () => {
    const steps = [spacing.xs, spacing.sm, spacing.md, spacing.lg, spacing.xl, spacing.xxl, spacing.xxxl];
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    }
    const radii = [radius.sm, radius.md, radius.lg, radius.xl];
    for (let i = 1; i < radii.length; i++) {
      expect(radii[i]).toBeGreaterThan(radii[i - 1]);
    }
  });
});
