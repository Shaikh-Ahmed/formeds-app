import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Dictation for AED's question box, using the free speech recognition built
 * into the platform: the Web Speech API in Chrome, Edge and Safari, and the
 * iOS / Android system recognisers in a development or store build. No ForMeds
 * server and no paid API is involved.
 *
 * Expo Go cannot load the native recogniser, and Firefox has none, so
 * `available` is false there and the mic is simply not shown.
 */

type Module = {
  isRecognitionAvailable(): boolean;
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  start(options: Record<string, unknown>): void;
  stop(): void;
  abort(): void;
  addListener(event: string, listener: (ev: any) => void): { remove(): void };
};

let cached: Module | null | undefined;

/** The recogniser, or null when this build or browser has none. Loaded lazily:
 * importing the package in Expo Go throws, since its native half is missing. */
export function speechModule(): Module | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod: Module = require('expo-speech-recognition').ExpoSpeechRecognitionModule;
    cached = mod?.isRecognitionAvailable?.() ? mod : null;
  } catch {
    cached = null;
  }
  return cached;
}

/** For tests. */
export function resetSpeechModule() { cached = undefined; }

export type DictationState = 'idle' | 'starting' | 'listening';

const MESSAGES: Record<string, string> = {
  'not-allowed': 'Allow microphone access to dictate your question.',
  'service-not-allowed': 'Speech recognition is turned off on this device.',
  'audio-capture': 'No microphone was found.',
  network: 'Dictation needs an internet connection.',
  'language-not-supported': 'Dictation isn’t available in this language on this device.',
};

const join = (a: string, b: string) => (a && b && !/\s$/.test(a) ? `${a} ${b}` : a + b);

/**
 * `start(base)` begins listening; `onText` then receives `base` followed by
 * everything heard so far, updated live as words are recognised.
 */
export function useDictation(onText: (text: string) => void, lang = 'en-IN') {
  const [state, setState] = useState<DictationState>('idle');
  const [error, setError] = useState<string | null>(null);
  const base = useRef('');
  const committed = useRef('');
  const subs = useRef<{ remove(): void }[]>([]);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const detach = useCallback(() => {
    subs.current.forEach(s => s.remove());
    subs.current = [];
  }, []);

  const emit = (interim: string) => onTextRef.current(join(base.current, join(committed.current, interim).trim()));

  const start = useCallback(async (baseText: string) => {
    const mod = speechModule();
    if (!mod) return;
    setError(null);
    setState('starting');
    try {
      const permission = await mod.requestPermissionsAsync();
      if (!permission.granted) {
        setError(MESSAGES['not-allowed']);
        setState('idle');
        return;
      }
    } catch {
      // The browser asks for the microphone itself when recognition starts.
    }
    base.current = baseText;
    committed.current = '';
    detach();
    subs.current = [
      mod.addListener('start', () => setState('listening')),
      mod.addListener('result', (ev: { isFinal: boolean; results: { transcript: string }[] }) => {
        const text = (ev?.results?.[0]?.transcript ?? '').trim();
        // Recognisers differ: the browser and Android report one phrase at a
        // time, iOS usually the whole session so far. A result that repeats
        // what is already committed is the cumulative kind.
        const done = committed.current;
        const cumulative = !!done && text.startsWith(done);
        if (ev?.isFinal) {
          committed.current = cumulative ? text : join(done, text);
          emit('');
        } else {
          emit(cumulative ? text.slice(done.length).trim() : text);
        }
      }),
      mod.addListener('error', (ev: { error: string }) => {
        // Silence and a deliberate stop are not failures worth a message.
        if (ev?.error && ev.error !== 'aborted' && ev.error !== 'no-speech') {
          setError(MESSAGES[ev.error] ?? 'Dictation stopped unexpectedly. Please try again.');
        }
      }),
      mod.addListener('end', () => { setState('idle'); detach(); }),
    ];
    try {
      mod.start({ lang, interimResults: true, continuous: true, addsPunctuation: true });
    } catch {
      setError('Dictation couldn’t start. Please try again.');
      setState('idle');
      detach();
    }
  }, [lang, detach]);

  const stop = useCallback(() => {
    speechModule()?.stop();
  }, []);

  // Never leave the microphone open when the screen goes away.
  useEffect(() => () => {
    if (subs.current.length) speechModule()?.abort();
    detach();
  }, [detach]);

  return {
    available: !!speechModule(),
    state,
    listening: state !== 'idle',
    error,
    clearError: () => setError(null),
    start,
    stop,
  };
}
