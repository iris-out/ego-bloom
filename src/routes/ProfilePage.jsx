import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, RefreshCw, Archive, ChevronLeft } from 'lucide-react';
import { computeEarnedTitles } from '../data/badges';
import ProfileHeader from '../components/ProfileHeader';
import SummaryTab from '../components/SummaryTab';
import SkeletonUI from '../components/SkeletonUI';
import ChangelogModal from '../components/ChangelogModal';
import { proxyImageUrl, getPlotImageUrl, getPlotImageUrls } from '../utils/imageUtils';
import { getCreatorTier, calculateCreatorScore } from '../utils/tierCalculator';
import { useServerStatus } from '../hooks/useServerStatus';

const DetailTab = lazy(() => import('../components/DetailTab'));
const AchievementsTab = lazy(() => import('../components/AchievementsTab'));
const StatsTab = lazy(() => import('../components/StatsTab'));

const CACHE_KEY_PREFIX = 'zeta_cache_v2_';
const CACHE_DURATION = 30 * 60 * 1000;
const RANKING_MAP_CACHE_KEY = 'zeta_ranking_map_v1';
const RANKING_MAP_TTL_MS = 20 * 60 * 1000;

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

function mapPlots(rawPlots) {
  return (rawPlots || []).map(p => ({
    ...p,
    originalInteractionCount: p.interactionCount ?? 0,
    interactionCount: p.interactionCountWithRegen ?? p.interactionCount ?? 0,
  }));
}

async function fetchAllPlots(creatorId) {
  const limit = 200;
  const baseUrl = `/api/zeta/plots?creatorId=${creatorId}&limit=${limit}` +
    `&orderBy.property=INTERACTION_COUNT_WITH_REGEN&orderBy.direction=DESC`;

  const firstRes = await fetch(`${baseUrl}&offset=0`);
  if (!firstRes.ok) return [];
  const firstData = await firstRes.json();
  const firstPlots = mapPlots(firstData.plots);
  if (firstPlots.length < limit) return firstPlots;

  const seenIds = new Set(firstPlots.map(p => p.id));
  let all = [...firstPlots];
  let offset = limit;
  const MAX_PLOTS = 2000;

  while (offset < MAX_PLOTS) {
    const batchOffsets = [offset, offset + limit, offset + limit * 2];
    const batchResults = await Promise.all(
      batchOffsets.map(o =>
        fetch(`${baseUrl}&offset=${o}`)
          .then(r => r.ok ? r.json() : { plots: [] })
          .then(d => mapPlots(d.plots))
          .catch(() => [])
      )
    );
    let done = false;
    for (const plots of batchResults) {
      if (plots.length < limit) { done = true; }
      for (const p of plots) {
        if (seenIds.has(p.id)) { done = true; break; }
        seenIds.add(p.id);
        all.push(p);
      }
      if (done) break;
    }
    if (done) break;
    offset += limit * 3;
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
    const parseRanking = async (res) => {
      if (!res.ok) return [];
      const data = await res.json();
      return data.rankings || data.plots || [];
    };
    const [trending, best, newItems] = await Promise.all([parseRanking(tRes), parseRanking(bRes), parseRanking(nRes)]);
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

const TABS = [
  { key: 'summary',      label: '프로필' },
  { key: 'characters',   label: '캐릭터' },
  { key: 'achievements', label: '업적' },
  { key: 'stats',        label: '통계' },
];

export default function ProfilePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialCreator = searchParams.get('creator');
  const { status: serverStatus } = useServerStatus();
  const onBack = () => navigate('/');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('summary');
  const [cacheInfo, setCacheInfo] = useState(null);
  const [cacheRemaining, setCacheRemaining] = useState(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const tabBarRef = useRef(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  // A1: 탭 슬라이딩 인디케이터
  useLayoutEffect(() => {
    if (!tabBarRef.current) return;
    const activeBtn = tabBarRef.current.querySelector('.ph-tab-item.active');
    if (!activeBtn) return;
    const barRect = tabBarRef.current.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    setIndicator({ left: btnRect.left - barRect.left, width: btnRect.width, ready: true });
  }, [tab]);

  // A3: 티어별 배경 글로우 색조
  const glowColor = useMemo(() => {
    if (!data) return 'rgba(74,127,255,0.10)';
    const s = calculateCreatorScore(data.stats, data.characters);
    const t = getCreatorTier(s);
    const map = {
      champion: 'rgba(249,115,22,0.13)',
      master:   'rgba(217,70,239,0.10)',
      diamond:  'rgba(59,130,246,0.12)',
      gold:     'rgba(251,191,36,0.10)',
    };
    return map[t.key] || 'rgba(74,127,255,0.10)';
  }, [data]);

  const hasEarnedTitles = useMemo(() => {
    if (!data) return false;
    return computeEarnedTitles({ characters: data.characters, stats: data.stats }).some(t => t.earned);
  }, [data]);

  useEffect(() => {
    if (!initialCreator) { navigate('/', { replace: true }); }
  }, [initialCreator, navigate]);

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

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [initialCreator]);

  useEffect(() => {
    if (initialCreator) fetchData(initialCreator);
  }, [initialCreator]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async (inputStr, forceRefresh = false) => {
    let id = inputStr.trim();
    setLoading(true); setError(null); setData(null); setCacheInfo(null); setTab('summary');

    try {
      // UUID 형식이 아니면서, URL 형태도 아니라면 핸들(@) 검색으로 간주함
      const isUUID = /^[0-9a-fA-F-]{36}$/.test(id);
      const isURL = id.includes('/creators/');
      
      if (!isUUID && !isURL && !id.startsWith('@')) {
        id = '@' + id;
      }

      if (id.startsWith('@')) {
        const handleCacheKey = 'HANDLE_MAP_' + id;
        const HANDLE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
        let cachedHandleId = null;
        try {
          const raw = localStorage.getItem(handleCacheKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && parsed.id && parsed.ts) {
              if (Date.now() - parsed.ts < HANDLE_TTL_MS) cachedHandleId = parsed.id;
              else localStorage.removeItem(handleCacheKey);
            } else if (typeof parsed === 'string') {
              cachedHandleId = parsed;
              localStorage.setItem(handleCacheKey, JSON.stringify({ id: parsed, ts: Date.now() }));
            }
          }
        } catch { localStorage.removeItem(handleCacheKey); }

        if (cachedHandleId && !forceRefresh) {
          id = cachedHandleId;
        } else {
          const res = await fetch(`/api/resolve-handle?handle=${encodeURIComponent(id)}`);
          if (!res.ok) throw new Error('사용자를 찾을 수 없습니다.');
          const fetchedId = (await res.json()).id;
          localStorage.setItem(handleCacheKey, JSON.stringify({ id: fetchedId, ts: Date.now() }));
          id = fetchedId;
        }
      } else if (isURL) {
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

      if (stats.voicePlaySeconds != null && stats.voicePlayCount == null) {
        stats.voicePlayCount = Math.round(stats.voicePlaySeconds);
      }
      // 삭제되거나 비공개된 캐릭터 개수가 통계에 반영되는 문제를 막기 위해 실제 목록과 동기화
      stats.plotCount = allPlots ? allPlots.length : 0;

      if (profile.profileImageUrl) profile.profileImageUrl = proxyImageUrl(profile.profileImageUrl);

      // --- 백그라운드 랭킹 데이터 수집 시작 ---
      // 주의: 아직 rankingMap이 병합되지 않은 상태의 allPlots를 기준으로 점수를 계산합니다.
      const eloScore = calculateCreatorScore(stats, allPlots);
      const tierInfo = getCreatorTier(eloScore);
      
      // 유저의 데이터를 DB에 업데이트합니다 (결과를 기다리지 않고 비동기로 찔러주기만 함)
      fetch('/api/update-creator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          handle: profile.username || null,
          nickname: profile.nickname || 'Unknown',
          profileImageUrl: profile.profileImageUrl,
          followerCount: stats.followerCount || 0,
          plotInteractionCount: stats.plotInteractionCount || 0,
          voicePlayCount: stats.voicePlayCount || 0,
          eloScore: eloScore,
          tierName: tierInfo.name
        })
      }).catch(err => console.error('[Ranking Update Error]:', err));
      // --- 백그라운드 랭킹 데이터 수집 끝 ---

      const characters = allPlots.map(p => ({
        ...p,
        imageUrl: getPlotImageUrl(p),
        imageUrls: getPlotImageUrls(p),
        ...(rankingMap[p.id] || {}),
      }));

      const minimalCharacters = characters.map(c => ({
        id: c.id, name: c.name,
        interactionCount: c.interactionCount,
        originalInteractionCount: c.originalInteractionCount,
        imageUrl: c.imageUrl, imageUrls: c.imageUrls,
        hashtags: c.hashtags, tags: c.tags,
        createdAt: c.createdAt, createdDate: c.createdDate,
        unlimitedAllowed: c.unlimitedAllowed, starCount: c.starCount,
        isLongDescriptionPublic: c.isLongDescriptionPublic,
        shortDescription: c.shortDescription,
        trendingRank: c.trendingRank, bestRank: c.bestRank,
        newRank: c.newRank, globalRank: c.globalRank,
        rankDiff: c.rankDiff, isNew: c.isNew,
      }));
      const finalData = { profile, stats, characters };
      setData(finalData); setCacheInfo(null);
      try { localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: { ...finalData, characters: minimalCharacters } })); }
      catch { /* QuotaExceededError 무시 */ }
    } catch (err) {
      setError(err.message || '오류가 발생했습니다.');
    } finally { setLoading(false); }
  };

  // 공통 헤더
  const Header = () => (
    <header className="flex justify-between items-center px-6 pt-5 pb-2 relative z-20 lg:px-12">
      <button
        onClick={onBack}
        className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
      >
        <ChevronLeft size={20} className="text-gray-300" />
      </button>
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 17 L17 17 L15 22 L9 22 Z" />
          <line x1="6" y1="17" x2="18" y2="17" />
          <line x1="12" y1="17" x2="12" y2="11" />
          <path d="M12 6 Q10 2 12 1 Q14 2 12 6" />
          <path d="M12 6 Q17 4 18 6 Q17 8 12 6" />
          <path d="M12 6 Q14 10 12 11 Q10 10 12 6" />
          <path d="M12 6 Q7 8 6 6 Q7 4 12 6" />
          <circle cx="12" cy="6" r="1.2" />
        </svg>
        <span className="font-bold tracking-[0.15em] text-xs text-white uppercase">Ego-Bloom</span>
      </div>
      {hasEarnedTitles ? (
        <button
          onClick={() => setEditingTitle(true)}
          className="px-3 py-1.5 rounded-full text-[11px] font-semibold text-white/70 hover:text-white transition-all"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          칭호 변경
        </button>
      ) : (
        <div className="w-10" />
      )}
    </header>
  );

  if (loading) {
    return (
      <div className="bg-profile min-h-[100dvh]">
        <Header />
        <main className="max-w-[680px] mx-auto px-6 py-4 lg:max-w-[1280px] lg:px-[6%]"><SkeletonUI /></main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-profile min-h-[100dvh]">
        <Header />
        <main className="max-w-[680px] mx-auto px-6 py-8 flex flex-col items-center gap-4 lg:max-w-[1280px] lg:px-[6%]">
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 px-4 py-3 rounded-xl border border-red-400/20">
            <AlertCircle size={16} /><span>{error}</span>
          </div>
          <button onClick={onBack} className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-white/70 hover:bg-white/10 transition-colors">
            ← 홈으로 돌아가기
          </button>
        </main>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-profile min-h-[100dvh] relative">
      {/* 배경 글로우 — 티어에 따라 색조 변화 */}
      <div
        className="fixed top-[10%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] rounded-full blur-[130px] pointer-events-none"
        style={{ background: glowColor, transition: 'background 1.2s ease' }}
      />

      <Header />

      <main className="max-w-[680px] mx-auto px-6 pb-20 relative z-10 lg:max-w-[1280px] lg:px-[6%]">
        {/* 캐시 알림 */}
        {cacheInfo && cacheRemaining !== null && (
          <div className="animate-slide-down flex items-center justify-between px-4 py-2.5 mt-4 rounded-xl bg-white/[0.02] border border-white/[0.05] text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <Archive size={13} className="text-gray-400" />
              <span className="font-medium">캐시 데이터 —</span>
              <span className={`font-bold ${cacheRemaining <= 5 ? 'text-orange-400' : 'text-gray-400'}`}>
                {cacheRemaining}분 후 만료
              </span>
            </span>
            <button onClick={() => fetchData(initialCreator, true)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:border-blue-500/40 hover:text-blue-400 transition-all font-medium text-gray-400">
              <RefreshCw size={11} />새로고침
            </button>
          </div>
        )}

        <div className="profile-layout">
          {/* 탭 바 — 전체 너비 상단 */}
          <div className="profile-layout-tabbar">
            <div className="ph-tab-bar" ref={tabBarRef}>
              {TABS.map(t => (
                <button
                  key={t.key}
                  className={`ph-tab-item${tab === t.key ? ' active' : ''}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
              <div
                className="ph-tab-indicator"
                style={{
                  left: indicator.left,
                  width: indicator.width,
                  opacity: indicator.ready ? 1 : 0,
                }}
              />
            </div>
          </div>

          {/* 왼쪽 사이드바 — 프로필 헤더 */}
          <aside className="profile-layout-sidebar">
            <ProfileHeader
              profile={data.profile}
              stats={data.stats}
              characters={data.characters}
              editing={editingTitle}
              setEditing={setEditingTitle}
            />
          </aside>

          {/* 오른쪽 — 탭 컨텐츠 */}
          <div className="profile-layout-main">
            <Suspense fallback={<div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-gray-600" /></div>}>
              {tab === 'summary' && (
                <div className="animate-enter">
                  <DetailTab stats={data.stats} characters={data.characters} />
                </div>
              )}
              {tab === 'characters' && (
                <div className="animate-enter">
                  <SummaryTab characters={data.characters} stats={data.stats} />
                </div>
              )}
              {tab === 'achievements' && (
                <div className="animate-enter">
                  <AchievementsTab stats={data.stats} characters={data.characters} />
                </div>
              )}
              {tab === 'stats' && (
                <div className="animate-enter">
                  <StatsTab stats={data.stats} characters={data.characters} />
                </div>
              )}
            </Suspense>
          </div>
        </div>
      </main>

      <ChangelogModal isOpen={showChangelog} onClose={() => setShowChangelog(false)} />
    </div>
  );
}
