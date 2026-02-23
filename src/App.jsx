import React, { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, AlertCircle, Sun, Moon, Info, X, RefreshCw, ArrowLeftRight } from 'lucide-react';
import { useTheme } from './contexts/ThemeContext';
import ProfileHeader from './components/ProfileHeader';
import SummaryTab from './components/SummaryTab';
import DetailTab from './components/DetailTab';
import CompareView from './components/CompareView';
import SkeletonUI from './components/SkeletonUI';
import { proxyImageUrl, getPlotImageUrl, getPlotImageUrls } from './utils/imageUtils';
import { getRecentSearches, addRecentSearch, removeRecentSearch } from './utils/storage';

async function fetchAllPlots(creatorId) {
  const all = [];
  let offset = 0;
  const limit = 200;
  while (true) {
    const res = await fetch(`/api/zeta/plots?creatorId=${creatorId}&limit=${limit}&offset=${offset}`);
    if (!res.ok) break;
    const data = await res.json();
    const plots = data.plots || [];
    all.push(...plots);
    if (plots.length < limit) break;
    offset += limit;
  }
  return all;
}

const CACHE_KEY_PREFIX = 'zeta_cache_v1_';
const CACHE_DURATION = 20 * 60 * 1000; // 20분

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('summary');
  const [recentSearches, setRecentSearches] = useState([]);
  const [cacheInfo, setCacheInfo] = useState(null); // { cachedAt: timestamp }
  const [compareMode, setCompareMode] = useState(false); // 비교 모드
  const [cacheRemaining, setCacheRemaining] = useState(null); // 남은 분

  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  // 캐시 카운트다운 타이머
  useEffect(() => {
    if (!cacheInfo) { setCacheRemaining(null); return; }
    const update = () => {
      const elapsed = Date.now() - cacheInfo.cachedAt;
      const remaining = Math.max(0, Math.ceil((CACHE_DURATION - elapsed) / 60000));
      setCacheRemaining(remaining);
    };
    update();
    const interval = setInterval(update, 30000); // 30초마다 갱신
    return () => clearInterval(interval);
  }, [cacheInfo]);

  const fetchData = async (inputStr, forceRefresh = false) => {
    let id = inputStr.trim();
    setLoading(true);
    setError(null);
    setData(null);
    setCacheInfo(null);
    setCompareMode(false);
    setTab('summary');

    try {
      if (id.startsWith('@')) {
        const res = await fetch(`/api/resolve-handle?handle=${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error('사용자를 찾을 수 없습니다.');
        const d = await res.json();
        id = d.id;
      } else if (id.includes('/creators/')) {
        const parts = id.split('/creators/');
        if (parts[1]) id = parts[1].split('/')[0];
      }

      if (!id.match(/^[0-9a-fA-F-]{36}$/)) {
        throw new Error('올바른 Creator ID 또는 @핸들이 아닙니다.');
      }

      const cacheKey = CACHE_KEY_PREFIX + id;
      if (!forceRefresh) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < CACHE_DURATION) {
              setData(parsed.data);
              setCacheInfo({ cachedAt: parsed.timestamp });
              setLoading(false);
              const newRecents = addRecentSearch(inputStr);
              if (newRecents) setRecentSearches(newRecents);
              return;
            }
          } catch (e) { localStorage.removeItem(cacheKey); }
        }
      }

      const [profileRes, statsRes] = await Promise.all([
        fetch(`/api/zeta/users/${id}`),
        fetch(`/api/zeta/creators/${id}/stats`),
      ]);
      if (!profileRes.ok) throw new Error('사용자를 찾을 수 없습니다.');
      if (!statsRes.ok) throw new Error('통계 정보를 불러올 수 없습니다.');

      const [profile, stats, allPlots] = await Promise.all([
        profileRes.json(),
        statsRes.json(),
        fetchAllPlots(id),
      ]);

      if (profile.profileImageUrl) profile.profileImageUrl = proxyImageUrl(profile.profileImageUrl);
      const characters = allPlots.map(p => ({
        ...p,
        imageUrl: getPlotImageUrl(p),
        imageUrls: getPlotImageUrls(p),
      }));

      const finalData = { profile, stats, characters };
      setData(finalData);
      setCacheInfo(null);

      try {
        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: finalData }));
      } catch (e) { console.warn('Failed to save to cache', e); }

      const newRecents = addRecentSearch(inputStr);
      if (newRecents) setRecentSearches(newRecents);
    } catch (err) {
      console.error(err);
      setError(err.message || '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => { e.preventDefault(); if (input.trim()) fetchData(input); };
  const handleBack = () => { setData(null); setError(null); setLoading(false); setCacheInfo(null); setCompareMode(false); };
  const handleDeleteRecent = (term, e) => { e.stopPropagation(); setRecentSearches(removeRecentSearch(term)); };

  // ===== 검색 화면 =====
  if (!data && !loading) {
    return (
      <div className="page-bg min-h-screen flex flex-col">
        <div className="absolute top-4 right-4 z-50">
          <ThemeToggle theme={theme} toggle={toggleTheme} />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-20">
          <div className="text-center mb-8">
            <div className="mb-4"><ZetaLogo /></div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-2">Zeta Analytics</h1>
            <p className="text-sm text-[var(--text-tertiary)]">크리에이터 통계 &amp; 업적 카드</p>
          </div>

          <form onSubmit={handleSubmit} className="w-full max-w-md relative">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="@핸들, Creator ID, 또는 프로필 URL"
              className="search-input w-full pl-5 pr-12 py-3.5 sm:py-4 rounded-xl text-sm sm:text-base"
              autoFocus
            />
            <button type="submit" disabled={loading || !input.trim()}
              className="absolute right-1.5 top-1.5 bottom-1.5 px-3 rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-40">
              <Search size={18} />
            </button>
          </form>

          {error && (
            <div className="mt-4 flex items-center gap-2 text-sm text-red-400 bg-red-400/10 px-4 py-2 rounded-lg">
              <AlertCircle size={16} /><span>{error}</span>
            </div>
          )}

          <div className="mt-8 w-full max-w-md">
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">최근 검색</h3>
              <div className="group relative">
                <Info size={14} className="text-[var(--text-tertiary)] cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg text-[10px] text-[var(--text-secondary)] invisible group-hover:visible z-10 text-center">
                  브라우저 Local Storage에 저장되며 서버에 저장되지 않습니다.
                </div>
              </div>
            </div>
            {recentSearches.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {recentSearches.map((term, i) => (
                  <button key={i} onClick={() => { setInput(term); fetchData(term); }}
                    className="flex items-center justify-between px-4 py-3 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--card)] border border-transparent hover:border-[var(--border)] transition-all text-left group">
                    <span className="text-sm text-[var(--text-secondary)] font-medium truncate">{term}</span>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <span className="text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity"><Search size={14} /></span>
                      <span role="button" onClick={e => handleDeleteRecent(term, e)}
                        className="text-[var(--text-tertiary)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-0.5 rounded" title="삭제">
                        <X size={13} />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-[var(--text-tertiary)] text-sm bg-[var(--bg-secondary)]/30 rounded-lg border border-dashed border-[var(--border)]">
                최근 검색 기록이 없습니다
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ===== 로딩 =====
  if (loading) {
    return (
      <div className="page-bg min-h-screen">
        <TopBar theme={theme} toggleTheme={toggleTheme} onBack={handleBack} input={input} onInputChange={setInput} onSubmit={handleSubmit} loading={loading} />
        <main className="max-w-3xl mx-auto px-4 pt-4 pb-12"><SkeletonUI /></main>
      </div>
    );
  }

  // ===== 결과 화면 =====
  return (
    <div className="page-bg min-h-screen">
      <TopBar theme={theme} toggleTheme={toggleTheme} onBack={handleBack} input={input} onInputChange={setInput} onSubmit={handleSubmit} loading={loading} />

      <main className="max-w-3xl mx-auto px-4 pt-4 pb-12 space-y-4">
        {/* 캐시 배너 with 카운트다운 */}
        {cacheInfo && cacheRemaining !== null && (
          <div className="animate-slide-down flex items-center justify-between px-4 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-tertiary)]">
            <span>
              📦 캐시 데이터 —{' '}
              <span className={`font-bold ${cacheRemaining <= 5 ? 'text-orange-400' : 'text-[var(--text-secondary)]'}`}>
                {cacheRemaining}분 후 만료
              </span>
            </span>
            <button onClick={() => fetchData(input, true)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all font-medium">
              <RefreshCw size={11} />새로고침
            </button>
          </div>
        )}

        <ProfileHeader profile={data.profile} stats={data.stats} characters={data.characters} />

        {/* 탭 + 비교 버튼 */}
        <div className="flex gap-2 items-center">
          <div className="flex gap-1 p-1 rounded-lg bg-[var(--bg-secondary)] flex-1">
            <TabButton active={tab === 'summary' && !compareMode} onClick={() => { setTab('summary'); setCompareMode(false); }}>요약</TabButton>
            <TabButton active={tab === 'detail' && !compareMode} onClick={() => { setTab('detail'); setCompareMode(false); }}>상세</TabButton>
          </div>
          <button
            onClick={() => setCompareMode(prev => !prev)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold transition-all ${compareMode
              ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
              : 'bg-[var(--card)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
              }`}
          >
            <ArrowLeftRight size={14} />
            비교
          </button>
        </div>

        <div className="animate-fade-in-up">
          {compareMode
            ? <CompareView baseData={data} onClose={() => setCompareMode(false)} />
            : tab === 'summary'
              ? <SummaryTab characters={data.characters} />
              : <DetailTab stats={data.stats} characters={data.characters} />
          }
        </div>
      </main>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${active
        ? 'bg-[var(--card)] text-[var(--text-primary)] shadow-sm'
        : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
        }`}
    >{children}</button>
  );
}

function TopBar({ theme, toggleTheme, onBack, input, onInputChange, onSubmit, loading }) {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[var(--bg-primary)]/80 border-b border-[var(--border)]">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
        <button onClick={onBack} className="shrink-0 p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors text-[var(--text-secondary)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <form onSubmit={onSubmit} className="flex-1 relative">
          <input type="text" value={input} onChange={e => onInputChange(e.target.value)} placeholder="검색..."
            className="search-input w-full pl-4 pr-10 py-2 rounded-lg text-sm" />
          <button type="submit" disabled={loading}
            className="absolute right-1 top-1 bottom-1 px-2 rounded-md text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors disabled:opacity-50">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          </button>
        </form>
        <ThemeToggle theme={theme} toggle={toggleTheme} />
      </div>
    </header>
  );
}

function ThemeToggle({ theme, toggle }) {
  return (
    <button onClick={toggle}
      className="p-2 rounded-lg bg-[var(--card)] border border-[var(--border)] shadow-sm hover:bg-[var(--bg-secondary)] transition-colors text-[var(--text-secondary)]"
      aria-label="테마 전환">
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

function ZetaLogo() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <rect width="48" height="48" rx="12" fill="var(--accent)" opacity="0.15" />
      <path d="M14 16H34L20 32H34" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
