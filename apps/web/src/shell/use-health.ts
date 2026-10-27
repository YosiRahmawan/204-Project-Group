import { useEffect, useState } from 'react';
import { checkHealth } from './health';

export function useHealth() {
  const [status, setStatus] = useState<
    'loading' | 'connected' | 'error' | 'offline'
  >('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let controller: AbortController | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    async function refresh() {
      controller?.abort();
      clearTimeout(timeout);
      if (!navigator.onLine) {
        setStatus('offline');
        return;
      }
      const current = new AbortController();
      controller = current;
      setStatus('loading');
      timeout = setTimeout(() => current.abort(), 5000);
      try {
        await checkHealth(current.signal);
        if (!disposed && controller === current) setStatus('connected');
      } catch {
        if (!disposed && controller === current)
          setStatus(navigator.onLine ? 'error' : 'offline');
      } finally {
        if (controller === current) clearTimeout(timeout);
      }
    }
    const offline = () => {
      controller?.abort();
      setStatus('offline');
    };
    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, 30000);
    window.addEventListener('online', refresh);
    window.addEventListener('offline', offline);
    return () => {
      disposed = true;
      controller?.abort();
      clearTimeout(timeout);
      clearInterval(interval);
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', offline);
    };
  }, [attempt]);
  return { status, retry: () => setAttempt((value) => value + 1) };
}
