import { useEffect, useRef, useCallback } from 'react';
import { API_URL } from '../utils/api';

type Handler = (data: any) => void;

const BASE_DELAY = 1000;
const MAX_DELAY = 30000;
const CLOSE_UNAUTHORIZED = 4401;

/**
 * Shared realtime socket.
 * - Authenticates with a first `{type:'auth'}` message so the token never
 *   appears in a URL (and therefore never in proxy/server access logs).
 * - Reconnects with exponential backoff + jitter, and stops permanently on an
 *   auth rejection so a bad token can't cause a reconnect storm.
 */
export function useWebSocket(token: string | null, onMessage: Handler, enabled = true) {
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const timerRef = useRef<any>(null);
  const stoppedRef = useRef(false);
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  const connect = useCallback(() => {
    if (!token || !enabled || stoppedRef.current) return;

    const wsUrl = API_URL.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(`${wsUrl}/api/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Authenticate as the first frame — server closes the socket if this
      // doesn't arrive promptly.
      ws.send(JSON.stringify({ type: 'auth', token }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'auth_ok') {
          retryRef.current = 0; // only reset backoff once auth actually succeeds
          return;
        }
        handlerRef.current(data);
      } catch {}
    };

    ws.onclose = (e: any) => {
      wsRef.current = null;
      if (stoppedRef.current) return;
      if (e?.code === CLOSE_UNAUTHORIZED) {
        // Token rejected — don't hammer the server; a re-login remounts this hook.
        stoppedRef.current = true;
        return;
      }
      const attempt = retryRef.current++;
      const delay = Math.min(BASE_DELAY * 2 ** attempt, MAX_DELAY);
      const jitter = Math.random() * 0.3 * delay;
      timerRef.current = setTimeout(connect, delay + jitter);
    };

    ws.onerror = () => { try { ws.close(); } catch {} };
  }, [token, enabled]);

  useEffect(() => {
    stoppedRef.current = false;
    retryRef.current = 0;
    connect();
    return () => {
      stoppedRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (wsRef.current) { try { wsRef.current.close(); } catch {} wsRef.current = null; }
    };
  }, [connect]);

  const send = useCallback((payload: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  return { send };
}
