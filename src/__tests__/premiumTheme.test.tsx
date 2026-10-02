/**
 * ForMeds Premium and ForMeds Material are additional themes. These lock in
 * the two promises: Classic stays exactly as it was (it is still the default),
 * and each new theme only applies when it has been chosen.
 */

function loadTheme(saved: string | null) {
  let mod: any;
  jest.isolateModules(() => {
    jest.doMock('expo-secure-store', () => ({ getItem: () => saved, setItem: jest.fn() }));
    mod = {
      theme: require('../theme'),
      trust: require('../components/TrustMark'),
    };
  });
  return mod;
}

describe('theme selection', () => {
  it('defaults to Classic when nothing has been chosen', () => {
    const { theme } = loadTheme(null);
    expect(theme.activeTheme).toBe('classic');
    expect(theme.isPremium).toBe(false);
    expect(theme.isMaterial).toBe(false);
    expect(theme.isRefined).toBe(false);
  });

  it('offers Premium, Material and Terracotta alongside Classic and Journal', () => {
    const { theme } = loadTheme(null);
    expect(theme.THEMES.map((t: any) => t.id)).toEqual(['classic', 'journal', 'premium', 'material', 'terracotta']);
  });

  it('ignores an unknown saved value', () => {
    expect(loadTheme('neon').theme.activeTheme).toBe('classic');
  });
});

describe('Classic is unchanged', () => {
  const { theme } = loadTheme(null);

  it('keeps its palette', () => {
    expect(theme.colors).toMatchObject({
      navy: '#1A3A5C', teal: '#0F766E', bg: '#F8FAFC', text: '#0F172A',
      textSecondary: '#475569', border: '#E2E8F0', card: '#FFFFFF',
    });
    // The new semantic roles equal what Classic already used for those jobs.
    expect(theme.colors.verified).toBe(theme.colors.teal);
    expect(theme.colors.aed).toBe(theme.colors.red);
    expect(theme.colors.selected).toBe('#EFF6FF');
  });

  it('keeps its type scale, radii and card shadow', () => {
    expect(theme.typography.h1).toMatchObject({ fontSize: 28, letterSpacing: -0.4 });
    expect(theme.typography.body).toEqual({ fontSize: 15, fontFamily: 'IBMPlexSans_400Regular' });
    expect(theme.radius).toMatchObject({ sm: 8, md: 10, lg: 12, xl: 14, pill: 999 });
    // Role-named radii match the values Classic components already used.
    expect(theme.radius.button).toBe(14);
    expect(theme.shadow.card).toEqual({
      shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 }, elevation: 2,
    });
  });

  it('gets flat colours where Material uses gradients and no glass blur', () => {
    const g = theme.materials.gradients;
    expect(g.hero.colors).toEqual(['#1A3A5C', '#1A3A5C']);
    expect(g.page.colors).toEqual(['#F8FAFC', '#F8FAFC']);
    expect(theme.materials.glass.blur).toBe('none');
  });

  it('keeps its spacing scale and column gutter', () => {
    expect(theme.spacing).toEqual({ xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 });
    expect(theme.layout.gutter).toBe(24);
  });

  it('keeps buttons navy and flat: no Material colour, gloss or glass', () => {
    expect(theme.colors.action).toBe(theme.colors.navy);
    expect(theme.colors.actionHover).toBe(theme.colors.navyLight);
    expect(theme.gloss.fill).toEqual({});
    expect(theme.gloss.glass).toEqual({});
  });
});

describe('Premium', () => {
  const { theme } = loadTheme('premium');

  it('applies its own tokens only when chosen', () => {
    expect(theme.isPremium).toBe(true);
    expect(theme.colors.bg).toBe('#F3F5F8');
    expect(theme.colors.featured).not.toBe(theme.colors.card);
    expect(theme.typography.h1.fontSize).toBe(30);
    expect(theme.radius.card).toBe(14);
  });

  it('keeps the brand fonts, teal for trust and red for AED', () => {
    expect(theme.fonts.heading.bold).toBe('Outfit_700Bold');
    expect(theme.fonts.body.regular).toBe('IBMPlexSans_400Regular');
    expect(theme.colors.verified).toBe(theme.colors.teal);
    expect(theme.colors.aed).toMatch(/^#D9/);
  });

  it('keeps shadows restrained', () => {
    for (const level of ['subtle', 'standard', 'featured']) {
      expect(theme.elevation[level].shadowOpacity).toBeLessThanOrEqual(0.08);
    }
  });
});

describe('Material', () => {
  const { theme } = loadTheme('material');

  it('applies its own tokens only when chosen, on the Premium structure', () => {
    expect(theme.isMaterial).toBe(true);
    expect(theme.isPremium).toBe(false);
    expect(theme.isRefined).toBe(true);
    expect(theme.colors.bg).toBe('#EEF2FB');
    expect(theme.radius.card).toBe(18);
  });

  it('keeps the brand fonts, teal for trust and red for AED', () => {
    expect(theme.fonts.body.regular).toBe('IBMPlexSans_400Regular');
    expect(theme.colors.verified).toBe(theme.colors.teal);
    expect(theme.colors.aed).toMatch(/^#D8/);
    expect(theme.materials.gradients.aed.colors[0]).toMatch(/^#E2/);
  });

  it('defines every gradient in the theme, each with at least two stops', () => {
    for (const name of ['hero', 'primary', 'featured', 'aed', 'shift', 'page']) {
      expect(theme.materials.gradients[name].colors.length).toBeGreaterThanOrEqual(2);
    }
    expect(theme.materials.glass.blur).toMatch(/blur\(/);
  });

  it('gives buttons colour and gloss', () => {
    expect(theme.colors.action).toBe('#003A72');
    expect(theme.colors.action).not.toBe(theme.colors.navy);
    expect(Object.keys(theme.gloss.fill).length).toBeGreaterThan(0);
    expect(Object.keys(theme.gloss.glass).length).toBeGreaterThan(0);
  });

  it('runs a little tighter than Classic, at every step', () => {
    const classic = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as Record<string, number>;
    for (const [k, v] of Object.entries(theme.spacing as Record<string, number>)) {
      expect(v).toBeLessThanOrEqual(classic[k]);
    }
    expect(theme.spacing.lg).toBe(14);
    expect(theme.layout.gutter).toBe(20);
  });

  it('keeps shadows soft: depth from layers, not heavy shadows', () => {
    for (const level of ['subtle', 'standard', 'featured']) {
      expect(theme.elevation[level].shadowOpacity).toBeLessThanOrEqual(0.15);
    }
  });
});

describe('Terracotta', () => {
  const { theme } = loadTheme('terracotta');
  const material = loadTheme('material').theme;

  it('is Material in structure: same spacing, radii, type, gutter and gloss', () => {
    expect(theme.isMaterial).toBe(true);
    expect(theme.isTerracotta).toBe(true);
    expect(theme.isRefined).toBe(true);
    expect(theme.spacing).toEqual(material.spacing);
    expect(theme.radius).toEqual(material.radius);
    expect(theme.typography.h1).toEqual(material.typography.h1);
    expect(theme.layout.gutter).toBe(material.layout.gutter);
    expect(Object.keys(theme.gloss.fill).length).toBeGreaterThan(0);
    expect(theme.materials.glass.blur).toMatch(/blur\(/);
  });

  it('swaps every white surface for off-white and the blue for terracotta', () => {
    for (const token of ['white', 'card', 'surface', 'surfaceElevated']) {
      expect(theme.colors[token]).not.toBe('#FFFFFF');
    }
    expect(theme.colors.card).toBe('#FCF9F4');
    expect(theme.colors.action).toBe('#A3472A');
    expect(theme.colors.teal).toBe('#A3472A');
    expect(theme.materials.tint).toBe('163,71,42');
    const blues = JSON.stringify([theme.colors, theme.materials.gradients, theme.materials.backdropWeb, theme.gloss]);
    for (const blue of ['#003A72', '#002E5C', '#1D5B9E', '0,58,114']) expect(blues).not.toContain(blue);
  });

  it('keeps red for AED alone and green for success', () => {
    expect(theme.colors.aed).toMatch(/^#D3/);
    expect(theme.materials.gradients.aed).toEqual(material.materials.gradients.aed);
    expect(theme.colors.success).toBe('#2F7A4E');
  });

  it('leaves Material blue as it was', () => {
    expect(material.isTerracotta).toBe(false);
    expect(material.colors.action).toBe('#003A72');
    expect(material.colors.card).toBe('#FFFFFF');
    expect(material.materials.tint).toBe('0,58,114');
  });
});
