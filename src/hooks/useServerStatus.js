import { useState, useEffect } from 'react';

const SERVER_STATUS_CACHE_KEY = 'zeta_server_status_cache';
const SERVER_STATUS_CACHE_TTL = 30 * 1000; // 30초

export function useServerStatus() {
  const [data, setData] = useState(() => {
    try {
      const raw = sessionStorage.getItem(SERVER_STATUS_CACHE_KEY);
      if (raw) {
        const { status, message, ts } = JSON.parse(raw);
        if (Date.now() - ts < SERVER_STATUS_CACHE_TTL) return { status, message };
      }
    } catch { /* ignore */ }
    return { status: 'checking', message: null };
  });

  useEffect(() => {
    let lastCheckTs = 0;

    const check = async () => {
      if (Date.now() - lastCheckTs < SERVER_STATUS_CACHE_TTL) return;
      lastCheckTs = Date.now();
      try {
        const [sRes, mRes] = await Promise.all([
          fetch('https://emergency.zeta-ai.io/ko/status').then(r => r.text()),
          fetch('https://emergency.zeta-ai.io/ko/message').then(r => r.text()),
        ]);
        let status = 'error';
        const s = sRes.trim();
        if (s === 'green') status = 'ok';
        else if (s === 'yellow') status = 'warning';
        const message = mRes.trim();
        const result = { status, message: status === 'ok' ? null : (message || null) };
        setData(result);
        try { sessionStorage.setItem(SERVER_STATUS_CACHE_KEY, JSON.stringify({ ...result, ts: Date.now() })); } catch { /* ignore */ }
      } catch {
        setData(prev => ({ ...prev, status: 'error' }));
      }
    };

    if (data.status === 'checking') check();

    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    const intv = setInterval(check, 2 * 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(intv);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return data;
}
