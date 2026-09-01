import { useEffect, useState } from 'react';

/**
 * Value that settles `delay` ms after the input stops changing.
 *
 * Every search box in the app had its own copy of this effect with its own
 * timeout constant (400ms in the case list, 300ms in universal search). The
 * behaviour is identical; only the number differs, so the number is the
 * argument.
 */
export function useDebounced<T>(value: T, delay = 350): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}
