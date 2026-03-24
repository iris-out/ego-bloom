import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, AlertCircle, Info, History, X, Flower2, TrendingUp, Hash, ChevronRight } from 'lucide-react';
import NavBar from '../components/NavBar';
import ChangelogModal from '../components/ChangelogModal';
import ZetaBanners from '../components/ZetaBanners';
import { getRecentSearches, addRecentSearch, removeRecentSearch } from '../utils/storage';
import { toKST } from '../utils/tierCalculator';
import { APP_VERSION, CHANGELOG } from '../data/changelog';
import { useServerStatus } from '../hooks/useServerStatus';
import ProfilePage from './ProfilePage';

export default function HomePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const creatorParam = searchParams.get('creator');

  const [input, setInput] = useState('');
  const [recentSearches, setRecentSearches] = useState([]);
  const [showChangelog, setShowChangelog] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { status: serverStatus, message: emergencyMessage } = useServerStatus();
  const [topTags, setTopTags] = useState([]);
  const [showStatusBanner, setShowStatusBanner] = useState(false);
  const statusBannerTimerRef = useRef(null);

  const handleStatusClick = () => {
    if (statusBannerTimerRef.current) clearTimeout(statusBannerTimerRef.current);
    setShowStatusBanner(true);
    statusBannerTimerRef.current = setTimeout(() => setShowStatusBanner(false), 10000);
  };

  const handleStatusBannerClose = () => {
    if (statusBannerTimerRef.current) clearTimeout(statusBannerTimerRef.current);
    setShowStatusBanner(false);
  };

  // 꽃 이스터에그: rAF 기반 각도 직접 제어
  const flowerRef = useRef(null);
  const angleRef = useRef(0);
  const speedRef = useRef(18); // deg/s 기본
  const rafRef = useRef(null);
  const lastTimeRef = useRef(null);

  useEffect(() => {
    const BASE_SPEED = 18;
    const tick = (now) => {
      if (lastTimeRef.current !== null) {
        const dt = (now - lastTimeRef.current) / 1000;
        angleRef.current += speedRef.current * dt;
        if (flowerRef.current) {
          flowerRef.current.style.transform = `rotate(${angleRef.current}deg)`;
        }
        // 감속: 기본 속도 초과 시 서서히 줄임
        if (speedRef.current > BASE_SPEED) {
          speedRef.current = Math.max(BASE_SPEED, speedRef.current * (1 - dt * 0.8));
        }
      }
      lastTimeRef.current = now;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const handleFlowerClick = () => {
    speedRef.current = Math.min(2000, speedRef.current * 2.5);
  };

  useEffect(() => { setRecentSearches(getRecentSearches()); }, []);

  useEffect(() => {
    fetch('/data/ranking_latest.json')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.combined) setTopTags(d.combined.slice(0, 3)); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!input.trim()) { setSuggestions([]); return; }
    const filtered = recentSearches.filter(t => t.toLowerCase().includes(input.toLowerCase())).slice(0, 5);
    setSuggestions(filtered);
  }, [input, recentSearches]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) {
      const nr = addRecentSearch(input.trim());
      if (nr) setRecentSearches(nr);
      setSearchParams({ creator: input.trim() });
    }
  };

  const handleDeleteRecent = (term, e) => {
    e.stopPropagation();
    setRecentSearches(removeRecentSearch(term));
  };

  const handleSelectRecent = (term) => {
    setInput(term);
    setSearchParams({ creator: term });
  };

  // ?creator= 쿼리파람이 있으면 ProfilePage 렌더
  if (creatorParam) {
    return (
      <ProfilePage
        initialCreator={creatorParam}
        onBack={() => setSearchParams({})}
        serverStatus={serverStatus}
      />
    );
  }

  return (
    <div className="page-bg min-h-[100dvh] flex flex-col relative overflow-hidden">
      {/* 긴급 공지 배너 — Dynamic Island */}
      {emergencyMessage && (
        <div className="fixed top-[calc(var(--nav-height,54px)+8px)] inset-x-0 z-[60] flex justify-center pointer-events-none px-4">
          <div
            className="max-w-md w-full pointer-events-auto animate-di-expand"
            style={{
              background: 'rgba(10,8,16,0.96)',
              border: '1px solid rgba(251,191,36,0.2)',
              borderRadius: '20px',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
              transformOrigin: 'top center',
            }}
          >
            <div className="flex items-start gap-3 px-4 py-3.5">
              <div className="mt-0.5 w-7 h-7 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
                <AlertCircle size={14} className="text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] font-black text-amber-500/70 uppercase tracking-[0.15em] mb-1">Zeta Official Notice</div>
                <p className="text-[13px] text-white/85 font-medium leading-relaxed break-words">{emergencyMessage}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <NavBar variant="home" serverStatus={serverStatus} onStatusClick={handleStatusClick} />

      {/* 서버 상태 클릭 배너 — Dynamic Island */}
      {showStatusBanner && (() => {
        const cfg = {
          ok:       { dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]',  border: 'rgba(52,211,153,0.2)',  label: '정상',   sub: 'Zeta 서버가 정상 운영 중입니다.' },
          warning:  { dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]',    border: 'rgba(251,191,36,0.2)',  label: '불안정', sub: '일부 서비스가 원활하지 않을 수 있습니다.' },
          error:    { dot: 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.9)]',     border: 'rgba(248,113,113,0.2)', label: '이상',   sub: '서비스 이용에 불편함이 있을 수 있습니다.' },
          checking: { dot: 'bg-gray-400 animate-pulse',                              border: 'rgba(255,255,255,0.08)',label: '확인 중',sub: '서버 상태를 확인하는 중입니다.' },
        };
        const c = cfg[serverStatus] || cfg.checking;
        return (
          <div className="fixed top-[calc(var(--nav-height,54px)+8px)] inset-x-0 z-[60] flex justify-center pointer-events-none px-4">
            <div
              className="animate-di-expand pointer-events-auto"
              style={{
                background: 'rgba(10,8,16,0.96)',
                border: `1px solid ${c.border}`,
                borderRadius: '18px',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
                transformOrigin: 'top center',
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                minWidth: '220px',
                maxWidth: '320px',
              }}
            >
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${c.dot}`} />
              <div className="flex-1">
                <div className="text-[11px] font-black text-white/50 uppercase tracking-[0.12em] leading-none mb-1">Zeta 서버 상태</div>
                <div className="text-[14px] font-bold text-white/90 leading-none">{c.label}</div>
                <div className="text-[11px] text-white/45 mt-1 leading-tight">{c.sub}</div>
              </div>
              <button
                onClick={handleStatusBannerClose}
                className="ml-1 p-1 rounded-full hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors flex-shrink-0"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        );
      })()}

      {/* 배경 그라데이션 */}
      <div className="absolute top-0 inset-x-0 h-[40vh] bg-gradient-to-b from-[var(--accent)]/8 to-transparent pointer-events-none" />

      <div className="flex-1 flex flex-col items-center pt-[10vh] px-4 pb-20 relative z-10">
        {/* 헤더 */}
        <div className="flex flex-col items-center text-center mb-10 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="inline-flex items-center justify-center p-3 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-lg cursor-pointer select-none"
              onClick={handleFlowerClick}
              title="?"
            >
              <div ref={flowerRef} style={{ display: 'flex' }}>
                <Flower2 size={28} className="text-[var(--accent)]" strokeWidth={1.5} />
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] via-purple-400 to-indigo-400">
                EGO-BLOOM
              </span>
            </h1>
          </div>
          <p className="text-sm text-[var(--text-tertiary)]">제타 제작자를 위한 통계 및 업적 대시보드</p>
        </div>

        {/* 배너 */}
        <div className="w-full max-w-lg mb-6 animate-fade-in-up" style={{ animationDelay: '80ms' }}>
          <ZetaBanners />
        </div>

        {/* 검색창 */}
        <div className="w-full max-w-lg animate-fade-in-up" style={{ animationDelay: '160ms' }}>
          <form onSubmit={handleSubmit}>
            <div className="relative flex items-center bg-[var(--card)] border border-[var(--border)] rounded-full p-1.5 shadow-lg hover:border-[var(--accent)]/50 focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-soft)] transition-all">
              <div className="pl-4 pr-2 text-[var(--text-tertiary)]">
                <Search size={20} className="opacity-60" />
              </div>
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="@핸들, ID, 또는 프로필 URL"
                  className="w-full bg-transparent border-none text-base text-[var(--text-primary)] placeholder-[var(--text-tertiary)]/60 py-3 px-2 focus:outline-none"
                  autoFocus
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
                    <div className="px-3 py-1.5 border-b border-[var(--border)] text-[10px] font-bold text-[var(--text-tertiary)] bg-[var(--bg-secondary)]">최근 검색어</div>
                    {suggestions.map((s, i) => (
                      <button key={i} type="button" onMouseDown={() => { setInput(s); setSearchParams({ creator: s }); setShowSuggestions(false); }}
                        className="w-full text-left px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--accent)] transition-colors flex items-center gap-2">
                        <History size={13} className="opacity-50" />{s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit" disabled={!input.trim()}
                className="shrink-0 h-10 px-5 bg-[var(--accent)] hover:bg-[var(--accent-dark)] text-white font-bold rounded-full transition-all disabled:opacity-40 text-sm">
                분석
              </button>
            </div>
          </form>
        </div>

        {/* 최근 검색 */}
        {recentSearches.length > 0 && (
          <div className="w-full max-w-lg mt-6 animate-fade-in-up" style={{ animationDelay: '240ms' }}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <History size={13} className="text-[var(--text-tertiary)]" />
              <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">최근 검색</span>
              <div className="group relative ml-auto">
                <Info size={12} className="text-[var(--text-tertiary)] cursor-help" />
                <div className="absolute bottom-full right-0 mb-1 w-48 p-2 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-xl text-[10px] text-[var(--text-secondary)] invisible group-hover:visible z-20 text-center">
                  브라우저 Local Storage에 기기 종속 저장
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((term, i) => (
                <button key={i} onClick={() => handleSelectRecent(term)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--card)] border border-transparent hover:border-[var(--border)] transition-all text-sm text-[var(--text-secondary)] group">
                  {term}
                  <span role="button" onClick={e => handleDeleteRecent(term, e)}
                    className="text-[var(--text-tertiary)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                    <X size={12} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 트렌딩 태그 미리보기 */}
        <div className="w-full max-w-lg mt-6 animate-fade-in-up" style={{ animationDelay: '320ms' }}>
          <div className="flex items-center gap-2 mb-2 px-1">
            <TrendingUp size={13} className="text-[var(--accent)]" />
            <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">지금 인기 태그</span>
          </div>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
            {topTags.length > 0 ? topTags.map((item, i) => (
              <div key={item.tag} className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] last:border-b-0">
                <span className={`text-sm font-black w-5 text-center shrink-0 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-400' : 'text-amber-600'}`}>
                  {i + 1}
                </span>
                <span className="flex-1 text-sm font-bold text-[var(--text-primary)]">#{item.tag}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="h-1.5 rounded-full bg-[var(--accent-soft)] overflow-hidden w-16">
                    <div className="h-full rounded-full bg-[var(--accent)]"
                      style={{ width: `${Math.round((item.score / topTags[0].score) * 100)}%`, opacity: 0.8 }} />
                  </div>
                  <span className="text-[10px] text-[var(--text-tertiary)] font-mono w-10 text-right">{item.score.toLocaleString()}</span>
                </div>
              </div>
            )) : (
              [1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] last:border-b-0">
                  <div className="skeleton-bone w-4 h-4 rounded" />
                  <div className="skeleton-bone flex-1 h-4 rounded" />
                  <div className="skeleton-bone w-20 h-3 rounded" />
                </div>
              ))
            )}
            <button onClick={() => navigate('/ranking')}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-bold text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors">
              전체 순위 보기 <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-16 pb-4 text-center text-[11px] text-[var(--text-tertiary)] opacity-50">
          <span>v{APP_VERSION} · </span>
          <a href="https://github.com/iris-out/ego-bloom/issues" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--accent)] hover:opacity-100 transition-all">문의/제보</a>
          <span> · </span>
          <button onClick={() => setShowChangelog(true)} className="underline hover:text-[var(--accent)] hover:opacity-100 transition-all">변경 내역</button>
        </div>
      </div>

      <ChangelogModal isOpen={showChangelog} onClose={() => setShowChangelog(false)} />
    </div>
  );
}
