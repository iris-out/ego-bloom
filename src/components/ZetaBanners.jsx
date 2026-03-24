import React, { useState, useEffect, useRef } from 'react';
import { proxyImageUrl } from '../utils/imageUtils';
import { Megaphone, MessageCircle, X, ChevronLeft, ChevronRight } from 'lucide-react';

const BANNERS_CACHE_KEY = 'zeta_banners_v1';
const BANNERS_TTL_MS = 60 * 60 * 1000;
const DISMISSED_KEY = 'zeta_banners_dismissed';

function getDismissed() {
  try { return new Set(JSON.parse(sessionStorage.getItem(DISMISSED_KEY) || '[]')); }
  catch { return new Set(); }
}

function saveDismissed(set) {
  try { sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...set])); } catch { }
}

export default function ZetaBanners() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(getDismissed);
  const [hidden, setHidden] = useState(false);
  const scrollRef = useRef(null);
  const dragState = useRef({ isDragging: false, startX: 0, scrollLeft: 0 });

  const onMouseDown = (e) => {
    dragState.current = { isDragging: true, startX: e.pageX, scrollLeft: scrollRef.current.scrollLeft };
    scrollRef.current.style.cursor = 'grabbing';
    scrollRef.current.style.userSelect = 'none';
  };
  const onMouseMove = (e) => {
    if (!dragState.current.isDragging) return;
    const dx = e.pageX - dragState.current.startX;
    scrollRef.current.scrollLeft = dragState.current.scrollLeft - dx;
  };
  const onMouseUp = () => {
    dragState.current.isDragging = false;
    scrollRef.current.style.cursor = '';
    scrollRef.current.style.userSelect = '';
  };

  const scrollBy = (dir) => {
    scrollRef.current?.scrollBy({ left: dir * 340, behavior: 'smooth' });
  };

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const cached = sessionStorage.getItem(BANNERS_CACHE_KEY);
        if (cached) {
          const { data, ts } = JSON.parse(cached);
          if (Date.now() - ts < BANNERS_TTL_MS && Array.isArray(data)) {
            setBanners(data);
            setLoading(false);
            return;
          }
        }
        const res = await fetch('/api/zeta/banners');
        if (res.ok) {
          const json = await res.json();
          const list = json.banners || [];
          setBanners(list);
          try { sessionStorage.setItem(BANNERS_CACHE_KEY, JSON.stringify({ data: list, ts: Date.now() })); } catch { }
        }
      } catch (e) {
        console.error('Failed to fetch banners', e);
      } finally {
        setLoading(false);
      }
    };
    fetch_();
  }, []);

  const dismiss = (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    setDismissed(prev => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  };

  if (loading) return null;

  const visible = banners.filter(b => !dismissed.has(b.id));
  if (visible.length === 0 || hidden) return null;

  return (
    <div className="w-full animate-fade-in-up">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider flex items-center gap-1.5">
          <Megaphone size={14} className="text-[var(--accent)]" /> Zeta 소식 &amp; 공지사항
        </h3>
        <button
          onClick={() => setHidden(true)}
          className="nav-btn"
          title="배너 전체 숨기기"
        >
          <X size={12} />
        </button>
      </div>
      <div className="relative">
        <button
          onClick={() => scrollBy(-1)}
          className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center rounded-full border border-[var(--border)] shadow-[0_2px_10px_rgba(0,0,0,0.6)] text-[var(--text-primary)] hover:text-white transition-all"
          style={{ background: 'var(--card)' }}
        >
          <ChevronLeft size={14} />
        </button>
        <button
          onClick={() => scrollBy(1)}
          className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 items-center justify-center rounded-full border border-[var(--border)] shadow-[0_2px_10px_rgba(0,0,0,0.6)] text-[var(--text-primary)] hover:text-white transition-all"
          style={{ background: 'var(--card)' }}
        >
          <ChevronRight size={14} />
        </button>
      <div
        ref={scrollRef}
        className="flex overflow-x-auto gap-3 pb-2 snap-x snap-mandatory custom-scrollbar cursor-grab"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {visible.map((banner) => {
          const isUrl = banner.clickAction?.type === 'externalLink';
          const rawHref = banner.clickAction?.href || '';
          const localHref = rawHref.startsWith('/ko') ? rawHref : `/ko${rawHref}`;
          const href = isUrl ? banner.clickAction.url : `https://zeta-ai.io${localHref}`;

          return (
            <div key={banner.id} className="relative flex-none w-[280px] sm:w-[320px] snap-center group">
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="relative block h-[100px] rounded-xl overflow-hidden border border-[var(--border)] group-hover:border-[var(--accent)] transition-all"
              >
                {banner.imageUrl ? (
                  <>
                    <img
                      src={proxyImageUrl(banner.imageUrl)}
                      alt={banner.titlePrimary}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  </>
                ) : (
                  <div className="absolute inset-0 bg-[var(--card)] flex items-center justify-center">
                    <MessageCircle size={36} className="opacity-10" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <h4 className="text-sm font-bold text-white leading-tight drop-shadow-md truncate">
                    {banner.titlePrimary}
                  </h4>
                  {banner.titleSecondary && banner.titleSecondary.trim() !== '' && (
                    <p className="text-[10px] text-gray-200 mt-0.5 drop-shadow-sm truncate">
                      {banner.titleSecondary}
                    </p>
                  )}
                </div>
              </a>
              <button
                onClick={(e) => dismiss(banner.id, e)}
                className="absolute top-2 right-2 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                title="이 배너 숨기기"
              >
                <X size={10} />
              </button>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
