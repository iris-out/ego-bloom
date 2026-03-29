import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, X, ChevronRight } from 'lucide-react';
import ChangelogModal from '../components/ChangelogModal';
import ZetaBanners from '../components/ZetaBanners';
import MyProfileCard from '../components/MyProfileCard';
import SearchPill from '../components/SearchPill';
import { getRecentSearches, removeRecentSearch } from '../utils/storage';
import { APP_VERSION } from '../data/changelog';
import { useServerStatus } from '../hooks/useServerStatus';

export default function HomePage() {
  const navigate = useNavigate();
  const [recentSearches, setRecentSearches] = useState([]);
  const [showChangelog, setShowChangelog] = useState(false);
  const { status: serverStatus, message: emergencyMessage } = useServerStatus();
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const noticeDismissTimerRef = useRef(null);
  const [topTags, setTopTags] = useState([]);

  useEffect(() => {
    if (!emergencyMessage) { setNoticeDismissed(false); return; }
    setNoticeDismissed(false);
    if (noticeDismissTimerRef.current) clearTimeout(noticeDismissTimerRef.current);
    noticeDismissTimerRef.current = setTimeout(() => setNoticeDismissed(true), 10000);
    return () => clearTimeout(noticeDismissTimerRef.current);
  }, [emergencyMessage]);

  useEffect(() => { setRecentSearches(getRecentSearches()); }, []);

  useEffect(() => {
    fetch('/data/ranking_latest.json')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.combined) setTopTags(d.combined.slice(0, 5)); })
      .catch(() => { });
  }, []);

  const handleDeleteRecent = (term, e) => {
    e.stopPropagation();
    setRecentSearches(removeRecentSearch(term));
  };

  const statusColor = serverStatus === 'ok' ? '#6CD97E' : serverStatus === 'warning' ? '#FBBF24' : '#F87171';

  return (
    <div className="min-h-[100dvh] flex flex-col relative overflow-hidden">
      {/* 배경 글로우 */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[rgba(121,155,196,0.15)] rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[60%] bg-[rgba(65,30,110,0.25)] rounded-full blur-[120px]" />
      </div>

      {/* 공지 배너 */}
      {emergencyMessage && !noticeDismissed && (
        <div className="fixed top-4 inset-x-0 z-[60] flex justify-center px-4 pointer-events-none">
          <div className="glass-pill pointer-events-auto flex items-center gap-3 px-4 py-2.5 max-w-md w-fit animate-di-expand shadow-xl">
            <AlertCircle size={14} className="text-amber-400 shrink-0" />
            <span className="text-[13px] text-white/80 truncate">{emergencyMessage}</span>
            <button onClick={() => { clearTimeout(noticeDismissTimerRef.current); setNoticeDismissed(true); }}
              className="shrink-0 text-white/30 hover:text-white/60"><X size={14} /></button>
          </div>
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <div className="flex flex-col flex-1 px-6 pt-8 pb-[140px] lg:pb-16 relative z-10 max-w-[680px] mx-auto w-full lg:max-w-[1280px] lg:px-[10%]">
        {/* 헤더 */}
        <header className="flex justify-between items-center mb-8 animate-fade-in-up">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 24 24" className="w-5 h-6 stroke-white fill-none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17 L17 17 L15 22 L9 22 Z" />
              <line x1="6" y1="17" x2="18" y2="17" />
              <line x1="12" y1="17" x2="12" y2="11" />
              <path d="M12 6 Q10 2 12 1 Q14 2 12 6" />
              <path d="M12 6 Q17 4 18 6 Q17 8 12 6" />
              <path d="M12 6 Q14 10 12 11 Q10 10 12 6" />
              <path d="M12 6 Q7 8 6 6 Q7 4 12 6" />
              <circle cx="12" cy="6" r="1.2" />
            </svg>
            <h1 className="font-medium text-[22px] tracking-[-0.02em] text-white">EGO-BLOOM</h1>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-white/70 tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor, boxShadow: `0 0 8px ${statusColor}66` }} />
            <span>{serverStatus === 'ok' ? '정상' : serverStatus === 'warning' ? '불안정' : '이상'}</span>
          </div>
        </header>

        {/* PC 검색바 (lg에서만 보임) */}
        <SearchPill className="hidden lg:block mb-10 animate-fade-in-up" style={{ animationDelay: '80ms' }} suggestionsAbove={false} />

        {/* 2열 그리드 (PC) / 단일 컬럼 (모바일) */}
        <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-12 lg:items-start flex-1">
          {/* 왼쪽: 히어로 + 배너 + 트렌딩 + 최근 검색 */}
          <div className="min-w-0">
            {/* 히어로 */}
            <section className="mb-12 animate-fade-in-up" style={{ animationDelay: '120ms' }}>
              <h2 className="font-display text-[56px] leading-[0.95] tracking-[-0.04em] font-normal text-white mb-4">
                Creator<br />
                <span className="font-serif-kr text-[42px] tracking-[-0.05em] block mt-1">에고 발사대</span>
              </h2>
              <p className="text-[14px] text-white/70 font-light leading-relaxed max-w-[80%]">
                당신의 에고를 발사하세요.<br />대화량, 티어, 그리고 업적으로.
              </p>
            </section>

            {/* 배너 */}
            <div className="mb-10 animate-fade-in-up" style={{ animationDelay: '180ms' }}>
              <ZetaBanners />
            </div>

            {/* 트렌딩 태그 */}
            <section className="mb-12 animate-fade-in-up" style={{ animationDelay: '240ms' }}>
              <div className="flex justify-between items-end mb-2 pb-2 border-b border-white/[0.06]">
                <span className="text-[12px] font-medium text-white/40 uppercase tracking-widest">Trending Tags</span>
                <button onClick={() => navigate('/ranking')} className="text-[12px] text-white/70 hover:text-white transition-colors flex items-center gap-1">
                  자세히 보기 <ChevronRight size={12} />
                </button>
              </div>
              <ul className="flex flex-col lg:grid lg:grid-cols-3 lg:gap-x-4">
                {topTags.length > 0 ? topTags.map((item, i) => (
                  <li key={item.tag} className="flex items-center py-3.5 border-b border-white/[0.03] last:border-b-0 lg:border-b-0 lg:py-3">
                    <span className="font-display italic text-[24px] text-white/40 w-8 text-left">{i + 1}</span>
                    <div className="flex-1 flex flex-col gap-0.5 ml-1 min-w-0">
                      <span className="text-[16px] font-medium text-white tracking-[-0.01em] truncate">#{item.tag}</span>
                      <span className="text-[12px] text-white/70 font-light">스코어 {item.score?.toLocaleString()}</span>
                    </div>
                  </li>
                )) : (
                  [1, 2, 3].map(i => (
                    <li key={i} className="flex items-center py-3.5 border-b border-white/[0.03] last:border-b-0">
                      <div className="skeleton-bone w-6 h-6 rounded mr-3" />
                      <div className="flex-1"><div className="skeleton-bone w-32 h-4 rounded mb-1" /><div className="skeleton-bone w-20 h-3 rounded" /></div>
                    </li>
                  ))
                )}
              </ul>
            </section>

            {/* 최근 검색 */}
            {recentSearches.length > 0 && (
              <section className="mb-8 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                <div className="flex items-center gap-2 mb-3">
                  <svg viewBox="0 0 24 24" className="w-3 h-3 stroke-white/40 fill-none stroke-2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  <span className="text-[12px] font-medium text-white/40 uppercase tracking-widest">최근 검색</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((term, i) => (
                    <button key={i} onClick={() => navigate(`/profile?creator=${encodeURIComponent(term)}`)}
                      className="glass-pill flex items-center gap-2 px-3.5 py-2 text-[13px] text-white/80 hover:text-white transition-all group"
                      style={{ background: 'rgba(255,255,255,0.12)' }}>
                      {term}
                      <span role="button" onClick={e => handleDeleteRecent(term, e)}
                        className="text-white/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                        <X size={11} />
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* 오른쪽: 내 프로필 카드 (PC에서 sticky) */}
          <div className="mb-10 lg:mb-0 lg:sticky lg:top-8 animate-fade-in-up order-first lg:order-none" style={{ animationDelay: '210ms' }}>
            <MyProfileCard />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-12 pb-2 text-center text-[11px] text-white/30">
          <span>v{APP_VERSION} · </span>
          <a href="https://github.com/iris-out/ego-bloom/issues" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/60 transition-all">문의/제보</a>
          <span> · </span>
          <button onClick={() => setShowChangelog(true)} className="underline hover:text-white/60 transition-all">변경 내역</button>
        </div>
      </div>

      {/* 하단 고정 검색 pill (모바일에서만) */}
      <div className="lg:hidden fixed bottom-0 left-0 w-full z-20" style={{ padding: '0 24px env(safe-area-inset-bottom, 24px)', background: 'linear-gradient(to top, var(--bg-base) 20%, transparent 100%)' }}>
        <div className="max-w-[680px] mx-auto mb-4">
          <SearchPill suggestionsAbove={true} />
        </div>
      </div>

      <ChangelogModal isOpen={showChangelog} onClose={() => setShowChangelog(false)} />
    </div>
  );
}
