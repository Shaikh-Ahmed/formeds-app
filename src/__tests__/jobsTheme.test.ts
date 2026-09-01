import fs from 'fs';
import path from 'path';

/**
 * The Jobs surface stays on the design system.
 *
 * This is a lint expressed as a test, in the spirit of `tokens.test.ts`, and it
 * exists because the screen it replaced had drifted badly in exactly two ways:
 *
 *  1. Around forty raw hex literals instead of `colors.*`, so a token change
 *     updated the whole app except Jobs.
 *  2. Bare `fontSize`/`fontWeight` instead of the `typography.*` variants. That
 *     one is worse than it looks: React Native does not synthesise weights, so
 *     a `fontWeight` set alongside a brand family silently falls back to the
 *     SYSTEM font. Half the old Jobs screen was not rendering in Outfit or IBM
 *     Plex Sans at all, and it looked close enough that nobody caught it.
 *
 * Both are invisible in review and obvious in a diff of the rendered app, which
 * is the worst possible combination — hence a test.
 */

const JOBS_DIR = path.join(__dirname, '..', 'components', 'jobs');

const sourceFiles = fs
  .readdirSync(JOBS_DIR)
  .filter(f => f.endsWith('.tsx') || f.endsWith('.ts'))
  .map(name => ({ name, body: fs.readFileSync(path.join(JOBS_DIR, name), 'utf8') }));

/** Strips comments so an explanatory hex in prose is not a violation. */
function code(body: string): string {
  return body
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

it('has jobs components to check', () => {
  // Guards the guard: a rename that empties this list must not turn the whole
  // file into a silent pass.
  expect(sourceFiles.length).toBeGreaterThan(5);
});

describe.each(sourceFiles)('$name', ({ body }) => {
  const source = code(body);

  it('uses colour tokens rather than raw hex', () => {
    const hex = source.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    // #EFF6FF is the navy tint that never made it into the token set; it is
    // already spelled this way across the existing components.
    const offenders = hex.filter(h => h.toUpperCase() !== '#EFF6FF');
    expect(offenders).toEqual([]);
  });

  it('never pairs fontWeight with a brand font family', () => {
    // The two together mean the brand family loses and the system font renders.
    const styleBlocks = source.match(/\{[^{}]*fontFamily[^{}]*\}/g) ?? [];
    const broken = styleBlocks.filter(b => /fontWeight/.test(b) && /fonts\./.test(b));
    expect(broken).toEqual([]);
  });

  it('sizes text through typography variants, not bare fontSize', () => {
    const bare = source.match(/^\s*fontSize:\s*\d+/gm) ?? [];
    expect(bare).toEqual([]);
  });
});
