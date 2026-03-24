import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { AlertCircle, Loader2, RefreshCw, Archive } from 'lucide-react';
import NavBar from '../components/NavBar';
import ProfileHeader from '../components/ProfileHeader';
import SummaryTab from '../components/SummaryTab';
import SkeletonUI from '../components/SkeletonUI';
import ChangelogModal from '../components/ChangelogModal';
import { proxyImageUrl, getPlotImageUrl, getPlotImageUrls } from '../utils/imageUtils';
import { getCreatorTier, calculateCreatorScore } from '../utils/tierCalculator';

const DetailTab = lazy(() => import('../components/DetailTab'));
const AchievementsTab = lazy(() => import('../components/AchievementsTab'));
const StatsTab = lazy(() => import('../components/StatsTab'));

const CACHE_KEY_PREFIX = 'zeta_cache_v2_';
const CACHE_DURATION = 20 * 60 * 1000;
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
      all.push(...plots);
      if (plots.length < limit) { done = true; break; }
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
  { key: 'summary',      label: '요약' },
  { key: 'characters',   label: '캐릭터' },
  { key: 'achievements', label: '업적' },
  { key: 'stats',        label: '통계' },
];

export default function ProfilePage({ initialCreator, onBack, serverStatus }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('summary');
  const [cacheInfo, setCacheInfo] = useState(null);
  const [cacheRemaining, setCacheRemaining] = useState(null);
  const [showChangelog, setShowChangelog] = useState(false);

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
    if (initialCreator) fetchData(initialCreator);
  }, [initialCreator]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async (inputStr, forceRefresh = false) => {
    let id = inputStr.trim();
    setLoading(true); setError(null); setData(null); setCacheInfo(null); setTab('summary');

    try {
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

      // API는 voicePlaySeconds를 반환 — voicePlayCount로 매핑
      if (stats.voicePlaySeconds != null && stats.voicePlayCount == null) {
        stats.voicePlayCount = Math.round(stats.voicePlaySeconds);
      }

      if (profile.profileImageUrl) profile.profileImageUrl = proxyImageUrl(profile.profileImageUrl);
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

  if (loading) {
    return (
      <div className="page-bg min-h-[100dvh]">
        <NavBar variant="profile" onBack={onBack} serverStatus={serverStatus} />
        <main className="container py-4"><SkeletonUI /></main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-bg min-h-[100dvh]">
        <NavBar variant="profile" onBack={onBack} serverStatus={serverStatus} />
        <main className="container py-8 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 px-4 py-3 rounded-xl">
            <AlertCircle size={16} /><span>{error}</span>
          </div>
          <button onClick={onBack} className="chip">← 홈으로 돌아가기</button>
        </main>
      </div>
    );
  }

  if (!data) return null;

  const score = calculateCreatorScore(data.stats, data.characters);
  const tier = getCreatorTier(score);

  return (
    <div className="page-bg min-h-[100dvh]">
      <NavBar variant="profile" onBack={onBack} serverStatus={serverStatus} />

      <main className="container pb-20">
        {/* 캐시 알림 */}
        {cacheInfo && cacheRemaining !== null && (
          <div className="animate-slide-down flex items-center justify-between px-4 py-2.5 mt-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-tertiary)]">
            <span className="flex items-center gap-1.5">
              <Archive size={13} className="text-[var(--text-secondary)]" />
              <span className="font-medium">캐시 데이터 —</span>
              <span className={`font-bold ${cacheRemaining <= 5 ? 'text-orange-400' : 'text-[var(--text-secondary)]'}`}>
                {cacheRemaining}분 후 만료
              </span>
            </span>
            <button onClick={() => fetchData(initialCreator, true)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all font-medium">
              <RefreshCw size={11} />새로고침
            </button>
          </div>
        )}

        <div className="profile-layout">
          {/* 탭 바 — 전체 너비 상단 */}
          <div className="profile-layout-tabbar">
            <div className="tab-bar">
              {TABS.map(t => (
                <button
                  key={t.key}
                  className={`tab-item${tab === t.key ? ' active' : ''}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 왼쪽 사이드바 — 프로필 헤더 */}
          <aside className="profile-layout-sidebar">
            <ProfileHeader
              profile={data.profile}
              stats={data.stats}
              characters={data.characters}
            />
          </aside>

          {/* 오른쪽 — 탭 컨텐츠 */}
          <div className="profile-layout-main">
            <Suspense fallback={<div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-[var(--text-tertiary)]" /></div>}>
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
