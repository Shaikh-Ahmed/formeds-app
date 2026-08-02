import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Countdown that gates "resend code" buttons. The server rate-limits resends to
 * 3 per 5 minutes; without a visible cooldown users tap repeatedly, burn the
 * allowance, and get an opaque 429 at the moment they most need a code.
 */
export function useResendCooldown(seconds = 45) {
  const [remaining, setRemaining] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  const start = useCallback(() => {
    clear();
    setRemaining(seconds);
    timer.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clear();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }, [seconds, clear]);

  useEffect(() => clear, [clear]);

  return { remaining, active: remaining > 0, start };
}
