/**
 * The ForMeds loading heart, as plain SVG markup and CSS.
 *
 * A red heart outline with an ECG trace running through it; the heart fills
 * with red from the bottom as loading progresses, with a gentle wave on the
 * surface. Where the trace crosses the filled part it turns white, so it
 * stays visible at every level.
 *
 * Plain strings rather than components so the very same heart can be written
 * into the HTML shell (+html.tsx) -- painted before any JavaScript arrives --
 * and reused by HeartLoader inside the app. The fill level is the CSS
 * transform on `.hl-level`; the shell's boot script drives it with real
 * progress, the in-app loader loops it.
 */

export const HEART_RED = '#E5484D';

const HEART = 'M100 108 C64 82 44 60 44 38 C44 20 58 8 74 8 C86 8 95 15 100 24 '
  + 'C105 15 114 8 126 8 C142 8 156 20 156 38 C156 60 136 82 100 108 Z';
const EKG = 'M4 62 H62 L70 62 L76 50 L82 62 L90 62 L98 28 L106 94 L112 62 L120 62 L126 54 L132 62 H196';
// A surface wave twice as wide as the heart, so sliding it by one wavelength loops seamlessly.
const WAVE = `M-100 6 ${Array.from({ length: 12 }, () => 'q12.5 -6 25 0 q12.5 6 25 0').join(' ')} V140 H-100 Z`;

/** Level (the y of the fill surface) for a progress from 0 to 1. */
export const heartLevel = (p: number) => 108 - Math.min(1, Math.max(0, p)) * 106;

/**
 * The heart's SVG. `id` keeps the clip-path ids unique when more than one is
 * on the page; `loop` makes the fill rise and fall on its own (no progress).
 */
export function heartSvg(id: string, { loop = false, size = 120 }: { loop?: boolean; size?: number } = {}): string {
  const clipHeart = `${id}-heart`;
  const clipFill = `${id}-fill`;
  const grad = `${id}-grad`;
  return `<svg class="hl" viewBox="0 0 200 120" width="${size}" height="${Math.round(size * 0.6)}" aria-hidden="true" focusable="false">`
    + '<defs>'
    + `<linearGradient id="${grad}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F26464"/><stop offset="1" stop-color="#C4283A"/></linearGradient>`
    + `<clipPath id="${clipHeart}"><path d="${HEART}"/></clipPath>`
    // A mask, not a clipPath: the level and the wave are two nested moving
    // groups, and a clipPath may not contain groups.
    + `<mask id="${clipFill}" maskUnits="userSpaceOnUse" x="-20" y="-20" width="240" height="160">`
    + `<g class="hl-level${loop ? ' hl-level-loop' : ''}" style="transform:translateY(${heartLevel(0)}px)">`
    + `<path class="hl-wave" d="${WAVE}" fill="#FFFFFF"/></g></mask>`
    + '</defs>'
    + '<g class="hl-beat">'
    // The empty heart: a faint red wash and the outline.
    + `<path d="${HEART}" fill="${HEART_RED}" fill-opacity="0.08"/>`
    // The red filling up, clipped to the heart and to the current level.
    + `<g clip-path="url(#${clipHeart})"><g mask="url(#${clipFill})">`
    + `<rect x="0" y="0" width="200" height="120" fill="url(#${grad})"/>`
    + '</g>'
    // A soft highlight, so the filled heart reads as glossy rather than flat.
    + '<ellipse cx="78" cy="30" rx="20" ry="11" fill="#FFFFFF" fill-opacity="0.22" transform="rotate(-24 78 30)"/>'
    + '</g>'
    + `<path d="${HEART}" fill="none" stroke="${HEART_RED}" stroke-width="3.5" stroke-linejoin="round"/>`
    + '</g>'
    // The ECG: a faint full trace, and a bright pulse running along it...
    + `<path d="${EKG}" fill="none" stroke="${HEART_RED}" stroke-opacity="0.28" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`
    + `<path class="hl-run" d="${EKG}" pathLength="400" fill="none" stroke="${HEART_RED}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`
    // ...drawn again in white where it crosses the red fill.
    + `<g clip-path="url(#${clipHeart})"><g mask="url(#${clipFill})">`
    + `<path d="${EKG}" fill="none" stroke="#FFFFFF" stroke-opacity="0.45" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`
    + `<path class="hl-run" d="${EKG}" pathLength="400" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`
    + '</g></g>'
    + '</svg>';
}

/** The heart's animation. Reduced-motion users get a still heart (see +html.tsx). */
export const HEART_CSS = `
.hl { display: block; overflow: visible; }
.hl-run { stroke-dasharray: 64 336; animation: hl-run 1.5s linear infinite; }
@keyframes hl-run { from { stroke-dashoffset: 400; } to { stroke-dashoffset: 0; } }
.hl-beat { transform-origin: 100px 60px; animation: hl-beat 1.5s ease-in-out infinite; }
@keyframes hl-beat { 0%, 100% { transform: scale(1); } 12% { transform: scale(1.045); } 24% { transform: scale(1); } 36% { transform: scale(1.03); } 48% { transform: scale(1); } }
.hl-level { transition: transform 450ms cubic-bezier(.2,.7,.2,1); }
.hl-level-loop { animation: hl-loop 2.6s ease-in-out infinite; }
@keyframes hl-loop { 0% { transform: translateY(108px); } 80%, 100% { transform: translateY(2px); } }
.hl-wave { animation: hl-wave 1.2s linear infinite; }
@keyframes hl-wave { to { transform: translateX(50px); } }
`;
