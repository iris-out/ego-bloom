import React, { useState, useEffect } from 'react';
import { Megaphone } from 'lucide-react';

const CACHE_KEY = 'zeta_banners_v1';
const TTL = 60 * 60 * 1000;

export default function AnnouncementTicker() {
  const [banners, setBanners] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, ts } = JSON.parse(cached);
          if (Date.now() - ts < TTL && Array.isArray(data)) {
            setBanners(data.filter(b => b.titlePrimary));
            return;
          }
        }
        const res = await fetch('/api/zeta/banners');
        if (!res.ok) return;
        const json = await res.json();
        const list = json.banners || [];
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: list, ts: Date.now() })); } catch {}
        setBanners(list.filter(b => b.titlePrimary));
      } catch {}
    })();
  }, []);

  if (!banners.length) return null;

  const combined = [...banners, ...banners];

  return (
    <div className="flex items-center gap-2 overflow-hidden py-2 px-4 border-b border-white/5">
      <Megaphone size={14} className="text-indigo-400 shrink-0" />
      <div className="overflow-hidden flex-1 relative h-5">
        <div
          className="flex gap-8 absolute whitespace-nowrap will-change-transform"
          style={{ animation: 'ticker-scroll 40s linear infinite' }}
        >
          {combined.map((banner, i) => {
            const url =
              banner.redirectUrl || banner.url || banner.link ||
              banner.targetUrl || banner.linkUrl || banner.deepLink ||
              (banner.id ? `https://zeta-ai.io/ko/notices/${banner.id}` : null);
            const cls = "text-[13px] font-medium text-white/85 tracking-wide";
            return url ? (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                className={`${cls} hover:text-white transition-colors hover:underline underline-offset-2 decoration-white/40`}>
                {banner.titlePrimary}
              </a>
            ) : (
              <span key={i} className={cls}>{banner.titlePrimary}</span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
