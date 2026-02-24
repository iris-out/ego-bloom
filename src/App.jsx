import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Loader2, AlertCircle, Sun, Moon, Info, X,
  RefreshCw, History, TrendingUp, ArrowLeft,
  Sparkles, Compass, BarChart3, ChevronRight, Flower2, Hash,
  HelpCircle, MessageSquare
} from 'lucide-react';
import { memo } from 'react';
import { useTheme } from './contexts/ThemeContext';
import ProfileHeader from './components/ProfileHeader';
import SummaryTab from './components/SummaryTab';
import DetailTab from './components/DetailTab';
import AchievementsTab, { EncouragementBanner } from './components/AchievementsTab';
import SkeletonUI from './components/SkeletonUI';
import ChangelogModal from './components/ChangelogModal';
import { proxyImageUrl, getPlotImageUrl, getPlotImageUrls } from './utils/imageUtils';
import { getRecentSearches, addRecentSearch, removeRecentSearch } from './utils/storage';
import { getCreatorTier, calculateCreatorScore, formatNumber } from './utils/tierCalculator';
import { APP_VERSION } from './data/changelog';

// 서버 상태 훅
function useServerStatus() {
  const [status, setStatus] = useState('checking'); // checking, ok, error

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('https://emergency.zeta-ai.io/ko/status', { method: 'GET' });
        const text = await res.text();
        if (text.trim() === 'green') setStatus('ok');
        else setStatus('error');
      } catch (err) {
        setStatus('error');
      }
    };

    check();
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    const intervalMs = 2 * 60 * 1000; // 2분
    const intv = setInterval(onVisible, intervalMs);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(intv);
    };
  }, []);

  return status;
}

// 서버 상태 인디케이터 UI
function ServerStatusIndicator({ status }) {
  const colors = {
    checking: 'bg-gray-400',
    ok: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
    error: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
  };
  const labels = { checking: '확인 중...', ok: '제타 서비스 정상', error: '제타 서비스 이상 의심' };

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] text-[9px] font-bold tracking-wider uppercase text-[var(--text-secondary)]">
      <span className={`w-2 h-2 rounded-full ${colors[status]} ${status === 'checking' ? 'animate-pulse' : ''}`} />
      <span className="hidden sm:inline">{labels[status]}</span>
    </div>
  );
}

// ─── API helpers ──────────────────────────────────────────────────────────────
const parseRanking = async (res) => {
  if (!res.ok) return [];
  const data = await res.json();
  return data.rankings || data.plots || [];
};

const RANKING_MAP_CACHE_KEY = 'zeta_ranking_map_v1';
const RANKING_MAP_TTL_MS = 5 * 60 * 1000; // 5분

function getCachedRankingMap() {
  try {
    const raw = sessionStorage.getItem(RANKING_MAP_CACHE_KEY);
    if (!raw) return null;
    const { map, ts } = JSON.parse(raw);
    if (Date.now() - ts > RANKING_MAP_TTL_MS) return null;
    return map;
  } catch { return null; }
}

function setCachedRankingMap(map) {
  try {
    sessionStorage.setItem(RANKING_MAP_CACHE_KEY, JSON.stringify({ map, ts: Date.now() }));
  } catch { /* ignore */ }
}

async function fetchAllPlots(creatorId) {
  const all = [];
  let offset = 0;
  const limit = 200;
  while (true) {
    const res = await fetch(
      `/api/zeta/plots?creatorId=${creatorId}&limit=${limit}&offset=${offset}` +
      `&orderBy.property=INTERACTION_COUNT_WITH_REGEN&orderBy.direction=DESC`
    );
    if (!res.ok) break;
    const data = await res.json();
    const plots = (data.plots || []).map(p => ({
      ...p,
      interactionCount: p.interactionCountWithRegen ?? p.interactionCount ?? 0,
    }));
    all.push(...plots);
    if (plots.length < limit) break;
    offset += limit;
  }
  return all;
}

async function fetchRankingMap() {
  const cached = getCachedRankingMap();
  if (cached) return cached;

  try {
    const [tRes, bRes, nRes] = await Promise.all([
      fetch('/api/zeta/plots/ranking?type=TRENDING&limit=100&filterType=GENRE&filterValues=all'),
      fetch('/api/zeta/plots/ranking?type=BEST&limit=100&filterType=GENRE&filterValues=all'),
      fetch('/api/zeta/plots/ranking?type=NEW&limit=100&filterType=GENRE&filterValues=all'),
    ]);
    const [trending, best, newItems] = await Promise.all([
      parseRanking(tRes), parseRanking(bRes), parseRanking(nRes),
    ]);
    const map = {};
    trending.forEach(p => { map[p.id] = { ...map[p.id], trendingRank: p.rank, rankDiff: p.rankDiff ?? 0 }; });
    best.forEach(p => { map[p.id] = { ...map[p.id], bestRank: p.rank }; });
    newItems.forEach(p => { map[p.id] = { ...map[p.id], newRank: p.rank }; });
    Object.values(map).forEach(r => {
      const ranks = [r.trendingRank, r.bestRank, r.newRank].filter(x => x != null);
      r.globalRank = ranks.length > 0 ? Math.min(...ranks) : null;
      r.rankDiff = r.rankDiff ?? 0;
      r.isNew = r.isNew ?? false;
    });
    setCachedRankingMap(map);
    return map;
  } catch { return {}; }
}

const MAIN_GENRES = ['로맨스', '판타지', '현대', '일상', '학원', '로판', 'SF', '무협', '스릴러', '공포', 'HL', 'GL', 'BL', 'TS'];

// 각 타입별로 개별 해시태그 TOP 10 + 모아서 가중치 합산 TOP 10
async function fetchHashtagTrends() {
  try {
    const res = await fetch('/data/ranking_latest.json');
    if (!res.ok) throw new Error('Static ranking data not found');
    const data = await res.json();
    return data;
  } catch { return { combined: [], trending: [], best: [], new: [], genres: [] }; }
}

const CACHE_KEY_PREFIX = 'zeta_cache_v1_';
const CACHE_DURATION = 20 * 60 * 1000;

// ─── Tag bar chart helper ─────────────────────────────────────────────────────
function TagBarList({ tags }) {
  if (!tags || tags.length === 0) return <p className="text-xs text-[var(--text-tertiary)] py-4 text-center">데이터 없음</p>;
  const max = tags[0]?.score || 1;
  return (
    <div className="space-y-2.5">
      {tags.map(({ tag, score }, i) => {
        const pct = Math.round((score / max) * 100);
        return (
          <div key={tag} className="flex items-center gap-2.5">
            <span className={`text-xs font-black w-5 text-right shrink-0 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-[var(--text-tertiary)]'
              }`}>{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-[var(--text-primary)]">#{tag}</span>
                <span className="text-[9px] font-mono text-[var(--text-tertiary)] opacity-70">
                  {typeof score === 'number' && score > 20000 ? formatNumber(score) : score.toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[var(--accent)] to-purple-400 rounded-full transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Genre Distribution Helper ────────────────────────────────────────────────
function GenreDistribution({ genres }) {
  if (!genres || genres.length === 0) return null;
  const colors = ['bg-pink-500', 'bg-purple-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-slate-500'];

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[var(--accent)] text-lg">📊</span>
        <h3 className="text-sm font-bold text-[var(--text-primary)]">주요 장르 점유율</h3>
      </div>

      {/* 1) 스택 바(Stacked Bar) 시각화 */}
      <div className="w-full h-3 sm:h-4 bg-[var(--bg-secondary)] rounded-full overflow-hidden flex shadow-inner mb-3">
        {genres.map((g, i) => (
          <div
            key={g.tag}
            style={{ width: `${g.pct}%` }}
            className={`h-full ${colors[i % colors.length]} transition-all duration-1000 hover:brightness-110 cursor-help`}
            title={`${g.tag} (${g.pct}%)`}
          />
        ))}
      </div>

      {/* 2) 범례(Legend) 표시 */}
      <div className="flex flex-wrap gap-2.5 sm:gap-4 mt-2">
        {genres.map((g, i) => (
          <div key={g.tag} className="flex items-center gap-1.5 text-xs">
            <span className={`w-2.5 h-2.5 rounded-full ${colors[i % colors.length]} shadow-sm`} />
            <span className="font-medium text-[var(--text-secondary)]">{g.tag}</span>
            <span className="text-[10px] text-[var(--text-tertiary)] opacity-80 font-mono">{g.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Ranking Trend Views ──────────────────────────────────────────────────────
function TogetherView({ data }) {
  return (
    <div className="card p-5 animate-fade-in">
      <GenreDistribution genres={data?.genres} />

      <div className="mb-4 pt-4 border-t border-[var(--border)]">
        <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 mb-1">
          <TrendingUp size={14} className="text-[var(--accent)]" />
          랭킹 종합 해시태그 트렌드 TOP 30
        </h3>
        <p className="text-[10px] text-[var(--text-tertiary)] opacity-60">
          트렌딩×3 · 베스트×2 · 신작×1 가중치 적용 (각 최고 TOP 100 기준)
        </p>
      </div>
      <TagBarList tags={data?.combined} />
    </div>
  );
}

function InteractionView({ data }) {
  return (
    <div className="card p-5 animate-fade-in bg-gradient-to-br from-[var(--bg-primary)] to-blue-500/5">
      <div className="mb-6 flex items-center justify-between border-b border-[var(--border)] pb-4">
        <div>
          <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 mb-1">
            <MessageSquare size={14} className="text-blue-400" />
            해시태그별 대화량 총합 TOP 30
          </h3>
          <p className="text-[10px] text-[var(--text-tertiary)] opacity-60">
            현재 차트에 랭크된 모든 캐릭터들의 원본 대화 수치를 태그별로 합산
          </p>
        </div>
        <div className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20">
          HOT TRAFFIC
        </div>
      </div>
      <TagBarList tags={data?.interaction} />
    </div>
  );
}

function SeparateView({ data }) {
  const sections = [
    { key: 'trending', label: '🔥 트렌딩', color: 'text-violet-300', bg: 'bg-violet-500/10 border-violet-500/20' },
    { key: 'best', label: '👑 베스트', color: 'text-amber-300', bg: 'bg-amber-500/10 border-amber-500/20' },
    { key: 'new', label: '✨ 신작', color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  ];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {sections.map(s => (
        <div key={s.key} className={`card p-4 border ${s.bg}`}>
          <h4 className={`text-xs font-bold mb-3 ${s.color}`}>{s.label}</h4>
          <TagBarList tags={data?.[s.key]} />
        </div>
      ))}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('summary');
  const [recentSearches, setRecentSearches] = useState([]);
  const [cacheInfo, setCacheInfo] = useState(null);
  const [cacheRemaining, setCacheRemaining] = useState(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const serverStatus = useServerStatus();

  // 랭킹 트렌드 뷰
  const [showTrendView, setShowTrendView] = useState(false);
  const [hashtagData, setHashtagData] = useState(null);
  const [trendViewMode, setTrendViewMode] = useState('together');
  const [trendLoading, setTrendLoading] = useState(false);

  // 1-1. 최상단 라우터 매니저 (URL 변화 감지)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const view = params.get('view');
      const creator = params.get('creator');

      if (view === 'ranking') {
        setShowTrendView(true);
        if (!hashtagData) {
          setTrendLoading(true);
          fetchHashtagTrends().then(d => { setHashtagData(d); setTrendLoading(false); });
        }
        setData(null);
        setTab('summary');
      } else if (creator) {
        setShowTrendView(false);
        setInput(creator);
        // data가 없을 때만 fetch (무한루프 방지)
        if (!data || data?.profile?.id !== creator && data?.profile?.handle !== creator) {
          fetchData(creator, false, true); // true = 라우터에 의한 호춤 구분 플래그 추가
        }
      } else {
        // 홈 화면
        setShowTrendView(false);
        setData(null);
        setInput('');
      }
    };

    // 초기 마운트 시 URL 분석
    handlePopState();

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []); // 의도적으로 빈 배열을 주고, fetchData 내부에서 pushState 로직을 따로 관리합니다.

  useEffect(() => { setRecentSearches(getRecentSearches()); }, []);

  useEffect(() => {
    if (!cacheInfo) { setCacheRemaining(null); return; }
    const update = () => {
      const elapsed = Date.now() - cacheInfo.cachedAt;
      setCacheRemaining(Math.max(0, Math.ceil((CACHE_DURATION - elapsed) / 60000)));
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [cacheInfo]);

  const handleOpenTrend = () => {
    setShowTrendView(true);
    // 라우터 History 추가
    const url = new URL(window.location);
    url.searchParams.set('view', 'ranking');
    url.searchParams.delete('creator');
    window.history.pushState({}, '', url);

    if (!hashtagData) {
      setTrendLoading(true);
      fetchHashtagTrends().then(d => { setHashtagData(d); setTrendLoading(false); });
    }
  };

  const handleCloseTrend = () => {
    setShowTrendView(false);
    // 라우터 History 홈으로
    const url = new URL(window.location);
    url.searchParams.delete('view');
    window.history.pushState({}, '', url);
  };

  const fetchData = async (inputStr, forceRefresh = false, fromRouter = false) => {
    let id = inputStr.trim();
    setLoading(true); setError(null); setData(null); setCacheInfo(null); setTab('summary');
    setShowTrendView(false);

    if (!fromRouter) {
      const url = new URL(window.location);
      url.searchParams.set('creator', id);
      url.searchParams.delete('view');
      window.history.pushState({}, '', url);
    }

    try {
      if (id.startsWith('@')) {
        const res = await fetch(`/api/resolve-handle?handle=${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error('사용자를 찾을 수 없습니다.');
        id = (await res.json()).id;
      } else if (id.includes('/creators/')) {
        const parts = id.split('/creators/');
        if (parts[1]) id = parts[1].split('/')[0];
      }
      if (!id.match(/^[0-9a-fA-F-]{36}$/)) throw new Error('올바른 Creator ID 또는 @핸들이 아닙니다.');

      const cacheKey = CACHE_KEY_PREFIX + id;
      if (!forceRefresh) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < CACHE_DURATION) {
              const rankingMap = await fetchRankingMap();
              const updatedData = {
                ...parsed.data,
                characters: parsed.data.characters.map(c => ({ ...c, ...(rankingMap[c.id] || {}) })),
              };
              setData(updatedData); setCacheInfo({ cachedAt: parsed.timestamp }); setLoading(false);
              const nr = addRecentSearch(inputStr); if (nr) setRecentSearches(nr);
              return;
            }
          } catch { localStorage.removeItem(cacheKey); }
        }
      }

      const [profileRes, statsRes] = await Promise.all([
        fetch(`/api/zeta/users/${id}`),
        fetch(`/api/zeta/creators/${id}/stats`),
      ]);
      if (!profileRes.ok) throw new Error('사용자를 찾을 수 없습니다.');
      if (!statsRes.ok) throw new Error('통계 정보를 불러올 수 없습니다.');

      const [profile, stats, allPlots, rankingMap] = await Promise.all([
        profileRes.json(), statsRes.json(), fetchAllPlots(id), fetchRankingMap(),
      ]);

      if (profile.profileImageUrl) profile.profileImageUrl = proxyImageUrl(profile.profileImageUrl);
      const characters = allPlots.map(p => ({
        ...p,
        imageUrl: getPlotImageUrl(p),
        imageUrls: getPlotImageUrls(p),
        ...(rankingMap[p.id] || {}),
      }));

      const finalData = { profile, stats, characters };
      setData(finalData); setCacheInfo(null);
      try { localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: finalData })); }
      catch { console.warn('Failed to save to cache'); }
      const nr = addRecentSearch(inputStr); if (nr) setRecentSearches(nr);
    } catch (err) {
      console.error(err); setError(err.message || '오류가 발생했습니다.');
    } finally { setLoading(false); }
  };

  const handleSubmit = (e) => { e.preventDefault(); if (input.trim()) fetchData(input); };
  const handleBack = () => {
    setData(null); setError(null); setLoading(false); setCacheInfo(null);
    setShowTrendView(false);

    // 라우터 History 홈으로
    const url = new URL(window.location);
    url.searchParams.delete('view');
    url.searchParams.delete('creator');
    window.history.pushState({}, '', url);
  };
  const handleDeleteRecent = (term, e) => { e.stopPropagation(); setRecentSearches(removeRecentSearch(term)); };

  // ===== 랭킹 트렌드 전용 뷰 =====
  if (!data && !loading && showTrendView) {
    return (
      <div className="page-bg min-h-screen animate-fade-in-up">
        <div className="mx-auto px-4 pt-6 pb-16 max-w-4xl">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            {/* 원형 뒤로가기 */}
            <button
              onClick={handleCloseTrend}
              className="w-10 h-10 rounded-full bg-[var(--card)] border border-[var(--border)] flex items-center justify-center hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all shrink-0 text-[var(--text-secondary)] shadow-sm"
            >
              <ArrowLeft size={17} />
            </button>

            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-[var(--text-primary)] leading-tight">랭킹 트렌드 분석</h2>
              <p className="text-[10px] text-[var(--text-tertiary)] opacity-70">트렌딩 · 베스트 · 신작 TOP 50 기준</p>
            </div>

            {/* Pill tabs */}
            <div className="flex gap-1 p-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] shrink-0 overflow-x-auto no-scrollbar">
              {[
                ['together', '종합 분석'],
                ['separate', '차트별 분석'],
                ['interaction', '대화량 순위']
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTrendViewMode(key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all whitespace-nowrap ${trendViewMode === key
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="relative group">
              <button className="p-2 rounded-full hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] transition-colors">
                <HelpCircle size={18} />
              </button>
              <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-2xl invisible group-hover:visible z-[100] text-[11px] leading-relaxed text-[var(--text-secondary)] animate-fade-in">
                <p className="font-bold text-[var(--accent)] mb-1.5">📊 랭킹 점수 집계 방식</p>
                <ul className="space-y-1.5 list-disc pl-3">
                  <li><strong className="text-[var(--text-primary)]">종합 분석</strong>: [트렌딩×3] + [베스트×2] + [신작×1] 가중치를 각 순위별로 합산하여 산출</li>
                  <li><strong className="text-[var(--text-primary)]">차트별 분석</strong>: 각 순위권(TOP 100) 내 태그 빈도수와 순위 점수</li>
                  <li><strong className="text-[var(--text-primary)]">대화량 순위</strong>: 현재 차트인 된 모든 캐릭터의 원본 대화 수(Interaction)를 태그별로 단순 합계 (트래픽 규모 중심)</li>
                </ul>
              </div>
            </div>

            <ThemeToggle theme={theme} toggle={toggleTheme} />
          </div>

          {/* Content */}
          {trendLoading ? (
            <div className="flex items-center justify-center py-24 text-[var(--text-tertiary)]">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : trendViewMode === 'together' ? (
            <TogetherView data={hashtagData} />
          ) : trendViewMode === 'interaction' ? (
            <InteractionView data={hashtagData} />
          ) : (
            <SeparateView data={hashtagData} />
          )}
        </div>
        <ChangelogModal isOpen={showChangelog} onClose={() => setShowChangelog(false)} />
      </div>
    );
  }

  // 랭킹 미리보기 전용 서브 컴포넌트
  const RankingPreview = memo(({ openAction, data }) => {
    const [topTags, setTopTags] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      if (data && data.combined) {
        setTopTags(data.combined.slice(0, 5));
        setLoading(false);
        return;
      }

      setLoading(true);
      fetch('/data/ranking_latest.json')
        .then(res => res.json())
        .then(d => {
          if (d && d.combined) setTopTags(d.combined.slice(0, 5));
        })
        .catch(err => console.error("Ranking fetch failed:", err))
        .finally(() => setLoading(false));
    }, [data]);

    return (
      <div className="card p-5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[var(--accent)] to-purple-500 opacity-[0.03] rounded-bl-full pointer-events-none" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
              <TrendingUp size={16} />
            </div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">현재 제타 트렌딩 주제</h3>
          </div>
          <p className="text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded-full border border-[var(--border)]">
            이번 주 TOP 5
          </p>
        </div>

        {loading ? (
          <div className="h-[150px] flex items-center justify-center">
            <Loader2 size={16} className="animate-spin text-[var(--text-tertiary)]" />
          </div>
        ) : (
          <div className="space-y-2 mb-4 relative z-10">
            {topTags.map((t, i) => (
              <div key={t.tag} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors group/item">
                <div className="flex items-center gap-2.5">
                  <span className={`text-xs font-bold w-4 text-center ${i < 3 ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`}>
                    {i + 1}
                  </span>
                  <span className="text-sm text-[var(--text-secondary)] group-hover/item:text-[var(--text-primary)] transition-colors">
                    <Hash size={12} className="inline mr-0.5 opacity-50" />
                    {t.tag}
                  </span>
                </div>
                <div className="text-[10px] text-[var(--text-tertiary)] font-mono bg-[var(--bg-primary)] px-1.5 py-0.5 rounded">
                  {t.score.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={openAction}
          className="w-full py-2.5 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] border border-transparent hover:border-[var(--accent)]/20 transition-all text-xs font-semibold text-[var(--text-secondary)] flex items-center justify-center gap-1.5"
        >
          장르 분포 및 트렌드 전체 분석표 보기
          <ChevronRight size={14} />
        </button>
      </div>
    );
  });

  // ===== 메인 홈 대시보드 화면 =====
  if (!data && !loading) {
    return (
      <div className="page-bg min-h-screen flex flex-col relative overflow-hidden">
        {/* 우상단 시스템 제어 */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-50 flex items-center gap-2">
          <ChangelogBtn onClick={() => setShowChangelog(true)} />
          <ThemeToggle theme={theme} toggle={toggleTheme} />
        </div>

        {/* 배경 은은한 그라데이션 장식 */}
        <div className="absolute top-0 inset-x-0 h-[50vh] bg-gradient-to-b from-[var(--accent)]/10 via-[var(--bg-secondary)]/5 to-transparent pointer-events-none" />

        <div className="flex-1 flex flex-col pt-[15vh] px-4 pb-20 max-w-5xl mx-auto w-full relative z-10">

          {/* 퍼스널 인트로 헤더 영역 */}
          <div className="flex flex-col items-center text-center mb-10 w-full animate-fade-in-up">
            <div className="inline-flex items-center justify-center p-3 sm:p-4 rounded-2xl bg-[var(--card)] shadow-xl shadow-[var(--accent)]/5 border border-[var(--border)] mb-4 ring-1 ring-white/5">
              <ZetaLogo />
            </div>

            <ServerStatusIndicator status={serverStatus} className="mb-10" />

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-black tracking-tight mb-3 flex flex-col items-center justify-center gap-2 drop-shadow-sm font-display">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] via-purple-400 to-indigo-400 pb-1">
                EGO-BLOOM
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-tertiary)] max-w-sm mx-auto">
              제타 제작자를 위한 통계 및 업적 대시보드
            </p>
          </div>

          {/* 메인 라운드 검색창 (Pill shape) */}
          <div className="w-full max-w-2xl mx-auto animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <form onSubmit={handleSubmit} className="relative group/search">
              <div className="absolute inset-x-0 -bottom-2 -top-2 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-[var(--accent)]/20 rounded-full blur-xl opacity-0 group-hover/search:opacity-100 transition-opacity duration-700 pointer-events-none" />
              <div className="relative flex items-center bg-[var(--card)] border-[1.5px] border-[var(--border)] rounded-full p-1.5 sm:p-2 shadow-lg hover:border-purple-500/50 hover:shadow-purple-500/10 focus-within:border-[var(--accent)] focus-within:ring-4 focus-within:ring-[var(--accent)]/10 transition-all z-10">
                <div className="pl-4 sm:pl-5 pr-2 text-[var(--text-tertiary)]">
                  <Search size={22} className="opacity-70 group-focus-within/search:text-[var(--accent)] transition-colors" />
                </div>
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="@핸들, 크리에이터 ID, 혹은 프로필 URL"
                  className="w-full bg-transparent border-none text-base sm:text-lg text-[var(--text-primary)] placeholder-[var(--text-tertiary)]/70 py-3 sm:py-4 px-2 focus:outline-none"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="shrink-0 flex items-center justify-center h-12 sm:h-14 px-6 sm:px-8 bg-[var(--accent)] hover:bg-purple-600 text-white font-bold rounded-full transition-all disabled:opacity-50 disabled:hover:bg-[var(--accent)] shadow-md hover:shadow-lg disabled:shadow-none"
                >
                  분석하기
                </button>
              </div>
            </form>

            {error && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-red-400 bg-red-400/10 px-4 py-3 rounded-xl animate-shake">
                <AlertCircle size={16} /><span>{error}</span>
              </div>
            )}
          </div>

          <div className="w-full max-w-2xl mx-auto mt-10 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <RankingPreview openAction={handleOpenTrend} data={hashtagData} />
          </div>

          {/* 최근 검색 */}
          <div className="mt-12 w-full max-w-4xl mx-auto animate-fade-in-up" style={{ animationDelay: '300ms' }}>
            <div className="flex items-center justify-between mb-3 px-2">
              <div className="flex items-center gap-2">
                <History size={16} className="text-[var(--text-tertiary)]" />
                <h3 className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider">최근 검색 기록</h3>
              </div>
              <div className="group relative">
                <Info size={14} className="text-[var(--text-tertiary)] cursor-help hover:text-[var(--text-secondary)] transition-colors" />
                <div className="absolute bottom-full right-0 mb-2 w-56 p-2 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-xl text-[10px] text-[var(--text-secondary)] invisible group-hover:visible z-20 text-center">
                  브라우저 Local Storage에 기기 종속적으로 저장되며 서버로 전송되지 않습니다.
                </div>
              </div>
            </div>
            {recentSearches.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((term, i) => (
                  <button key={i} onClick={() => { setInput(term); fetchData(term); }}
                    className="flex flex-1 min-w-[140px] max-w-[200px] items-center justify-between px-3.5 py-2.5 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--card)] border border-transparent hover:border-[var(--border)] transition-all text-left group shadow-sm hover:shadow">
                    <span className="text-sm text-[var(--text-secondary)] font-medium truncate">{term}</span>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity"><Search size={12} /></span>
                      <span role="button" onClick={e => handleDeleteRecent(term, e)}
                        className="text-[var(--text-tertiary)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1 rounded-md hover:bg-red-400/10">
                        <X size={12} />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-[var(--text-tertiary)] text-xs bg-[var(--bg-secondary)]/30 rounded-xl border border-dashed border-[var(--border)]">
                기록이 없습니다. 첫 분석을 시작해보세요!
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-auto pt-20 pb-4 text-center text-xs text-[var(--text-tertiary)] opacity-60">
            zeta : @_leo 제작 / 문의는 <a href="https://github.com/iris-out/ego-bloom/issues" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--accent)] hover:opacity-100 transition-all">https://github.com/iris-out/ego-bloom의 Issue 탭</a>에 부탁드립니다.
          </div>
        </div>
        <ChangelogModal isOpen={showChangelog} onClose={() => setShowChangelog(false)} />
      </div>
    );
  }

  // ===== 로딩 =====
  if (loading) {
    return (
      <div className="page-bg min-h-screen">
        <TopBar theme={theme} toggleTheme={toggleTheme} onBack={handleBack} input={input}
          onInputChange={setInput} onSubmit={handleSubmit} loading={loading}
          onChangelogOpen={() => setShowChangelog(true)} serverStatus={serverStatus} />
        <main className="max-w-3xl mx-auto px-4 pt-4 pb-12"><SkeletonUI /></main>
        <ChangelogModal isOpen={showChangelog} onClose={() => setShowChangelog(false)} />
      </div>
    );
  }

  // ===== 결과 화면 =====
  const score = calculateCreatorScore(data.stats, data.characters);
  const tier = getCreatorTier(score);

  return (
    <div className="page-bg min-h-screen">
      <TopBar theme={theme} toggleTheme={toggleTheme} onBack={handleBack} input={input}
        onInputChange={setInput} onSubmit={handleSubmit} loading={loading}
        onChangelogOpen={() => setShowChangelog(true)} serverStatus={serverStatus} />

      <main className="max-w-3xl mx-auto px-4 pt-4 pb-12 space-y-4">
        {cacheInfo && cacheRemaining !== null && (
          <div className="animate-slide-down flex items-center justify-between px-4 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-tertiary)]">
            <span className="flex flex-col gap-0.5">
              <span>📦 캐시 데이터 —{' '}
                <span className={`font-bold ${cacheRemaining <= 5 ? 'text-orange-400' : 'text-[var(--text-secondary)]'}`}>
                  {cacheRemaining}분 후 만료
                </span>
              </span>
              <span className="text-[9px] opacity-60">서버가 아닌 내 브라우저에 저장된 데이터입니다</span>
            </span>
            <button onClick={() => fetchData(input, true)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all font-medium">
              <RefreshCw size={11} />새로고침
            </button>
          </div>
        )}

        <EncouragementBanner tier={tier} characters={data.characters} stats={data.stats} />
        <ProfileHeader profile={data.profile} stats={data.stats} characters={data.characters} />

        <div className="flex gap-1 p-1 rounded-lg bg-[var(--bg-secondary)]">
          <TabButton active={tab === 'summary'} onClick={() => setTab('summary')}>요약</TabButton>
          <TabButton active={tab === 'detail'} onClick={() => setTab('detail')}>상세</TabButton>
          <TabButton active={tab === 'achievements'} onClick={() => setTab('achievements')}>칭호/랭킹</TabButton>
        </div>

        <div className="animate-fade-in-up">
          {tab === 'summary'
            ? <SummaryTab characters={data.characters} />
            : tab === 'detail'
              ? <DetailTab stats={data.stats} characters={data.characters} />
              : <AchievementsTab stats={data.stats} characters={data.characters} />
          }
        </div>
      </main>

      <ChangelogModal isOpen={showChangelog} onClose={() => setShowChangelog(false)} />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function TabButton({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${active
        ? 'bg-[var(--card)] text-[var(--text-primary)] shadow-sm'
        : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>
      {children}
    </button>
  );
}

function ChangelogBtn({ onClick }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all shadow-sm">
      <History size={13} />
      <span className="font-mono font-bold">v{APP_VERSION}</span>
    </button>
  );
}

function TopBar({ theme, toggleTheme, onBack, input, onInputChange, onSubmit, loading, onChangelogOpen, serverStatus }) {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[var(--bg-primary)]/80 border-b border-[var(--border)]">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
        <button onClick={onBack}
          className="shrink-0 p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors text-[var(--text-secondary)]">
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
        <ServerStatusIndicator status={serverStatus} />
        <ChangelogBtn onClick={onChangelogOpen} />
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
    <div className="w-12 h-12 flex items-center justify-center animate-spin-slow" style={{ animationDuration: '20s' }}>
      <Flower2 size={36} className="text-[var(--accent)] drop-shadow-md" strokeWidth={1.5} />
    </div>
  );
}
