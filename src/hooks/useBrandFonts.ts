import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
// Per-weight subpaths, NOT the package index. Importing from the index pulls
// every weight and italic of both families into the bundle -- 23 files and
// 3.5MB when eight faces and ~1.2MB is what we actually use. On the flaky
// hospital wifi this hook exists to tolerate, that difference is the point.
import { Outfit_400Regular } from '@expo-google-fonts/outfit/400Regular';
import { Outfit_500Medium } from '@expo-google-fonts/outfit/500Medium';
import { Outfit_600SemiBold } from '@expo-google-fonts/outfit/600SemiBold';
import { Outfit_700Bold } from '@expo-google-fonts/outfit/700Bold';
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular';
import { IBMPlexSans_500Medium } from '@expo-google-fonts/ibm-plex-sans/500Medium';
import { IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans/600SemiBold';
import { IBMPlexSans_700Bold } from '@expo-google-fonts/ibm-plex-sans/700Bold';

/**
 * Fonts are worth waiting for, but never worth being blocked by.
 *
 * On native these are bundled assets and resolve almost immediately. On web
 * they are fetched, and a doctor between shifts on hospital wifi must not get
 * a blank screen because a font file is slow. After this budget the app renders
 * in the system font and swaps to the brand face whenever the load lands.
 */
const FONT_TIMEOUT_MS = 3000;

/** True once it is safe to render — fonts ready, failed, or simply too slow. */
export function useBrandFonts(): boolean {
  const [loaded, error] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
  });

  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (loaded || error) return;
    const timer = setTimeout(() => setTimedOut(true), FONT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loaded, error]);

  return loaded || !!error || timedOut;
}
