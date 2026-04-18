import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, RefreshCw, Archive, ChevronLeft } from 'lucide-react';
import { computeEarnedTitles } from '../data/badges';
import ProfileHeader from '../components/ProfileHeader';
import SummaryTab from '../components/SummaryTab';
import ZetaSpotlightCard from '../components/ZetaSpotlightCard';
import HeroCard from '../components/HeroCard';
import SkeletonUI from '../components/SkeletonUI';
import ChangelogModal from '../components/ChangelogModal';
import { proxyImageUrl, getPlotImageUrl, getPlotImageUrls } from '../utils/imageUtils';
import { getCharacterTier, formatCompactNumber } from '../utils/tierCalculator';
import ImageWithFallback from '../components/ImageWithFallback';
import { useServerStatus } from '../hooks/useServerStatus';

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
    const batchOffsets = [
      offset,
      offset + limit,
      offset + limit * 2,
      offset + limit * 3,
      offset + limit * 4,
      offset + limit * 5,
    ];
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
    offset += limit * 6;
  }
  return all;
}

async function fetchRankingMap() {
  const cached = getCachedRankingMap();
  if (cached) return cached;
  try {
    // ranking_latest.json을 재활용 — 3개 Zeta API 호출 대신 이미 캐싱된 정적 파일 1회 요청
    const res = await fetch('/data/ranking_latest.json');
    if (!res.ok) throw new Error('ranking JSON fetch failed');
    const rankingData = await res.json();
    const map = {};
    // ranking_latest.json은 rankChange 필드 사용 (API의 rankDiff와 동일 의미)
    (rankingData.trendingPlots || []).forEach(p => {
      map[p.id] = { ...map[p.id], trendingRank: p.rank, rankDiff: p.rankChange ?? 0 };
    });
    (rankingData.bestPlots || []).forEach(p => {
      map[p.id] = { ...map[p.id], bestRank: p.rank };
    });
    (rankingData.newPlots || []).forEach(p => {
      map[p.id] = { ...map[p.id], newRank: p.rank };
    });
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
  { key: 'characters',   label: '캐릭터' },
  { key: 'achievements', label: '업적'   },
  { key: 'stats',        label: '통계'   },
];

const TIER_BADGE_STYLES = {
  B:  { color: '#A0AEC0', bg: 'rgba(160,174,192,0.15)', border: 'rgba(160,174,192,0.3)' },
  A:  { color: '#48BB78', bg: 'rgba(72,187,120,0.15)',  border: 'rgba(72,187,120,0.3)' },
  S:  { color: '#4299E1', bg: 'rgba(66,153,225,0.15)',  border: 'rgba(66,153,225,0.3)' },
  R:  { color: '#9F7AEA', bg: 'rgba(159,122,234,0.15)', border: 'rgba(159,122,234,0.3)' },
  SR: { color: '#ED8936', bg: 'rgba(237,137,54,0.15)',  border: 'rgba(237,137,54,0.3)' },
  X:  { color: '#F56565', bg: 'rgba(245,101,101,0.15)', border: 'rgba(245,101,101,0.3)' },
};

const PALETTES = [
  'from-indigo-500/20 to-blue-500/20',
  'from-emerald-500/20 to-teal-500/20',
  'from-rose-500/20 to-pink-500/20',
  'from-amber-500/20 to-orange-500/20',
  'from-sky-500/20 to-blue-500/20',
  'from-violet-500/20 to-fuchsia-500/20',
];

function paletteIndex(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return h % PALETTES.length;
}

function SidebarCharCards({ characters }) {
  const top20 = useMemo(() => {
    if (!characters?.length) return [];
    return [...characters]
      .sort((a, b) => (b.interactionCount || 0) - (a.interactionCount || 0))
      .slice(0, 20);
  }, [characters]);

  if (top20.length === 0) return null;

  return (
    <div
      className="hidden lg:block mt-4 rounded-2xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-wider text-white/30 px-4 pt-3 pb-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        캐릭터 TOP 20
      </p>
      <div className="flex flex-wrap gap-1.5 px-4 py-3">
        {top20.map(char => {
          const tier = getCharacterTier(char.interactionCount || 0);
          const ts = TIER_BADGE_STYLES[tier.name] || TIER_BADGE_STYLES.B;
          return (
            <span
              key={char.id}
              title={char.name}
              className="text-[11px] font-bold px-2 py-[3px] rounded-full"
              style={{ color: ts.color, background: ts.bg, border: `1px solid ${ts.border}` }}
            >
              {tier.name}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ProfilePageHeader({ onBack, hasEarnedTitles, onEditTitle }) {
  return (
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
      <div className="flex items-center gap-2">
        <button
          onClick={() => { window.location.hash = 'recap'; }}
          className="px-3 py-1.5 rounded-full text-[11px] font-bold transition-all hover:opacity-80"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.25))',
            border: '1px solid rgba(139,92,246,0.35)',
            color: '#c4b5fd',
          }}
        >
          CARD
        </button>
        {hasEarnedTitles && (
          <button
            onClick={onEditTitle}
            className="px-3 py-1.5 rounded-full text-[11px] font-semibold text-white/70 hover:text-white transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            칭호 변경
          </button>
        )}
      </div>
    </header>
  );
}

export default function ProfilePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialCreator = searchParams.get('creator');
  const { status: serverStatus } = useServerStatus();
  const onBack = () => navigate('/');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('characters');
  const [cacheInfo, setCacheInfo] = useState(null);
  const [cacheRemaining, setCacheRemaining] = useState(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [tierRevealed, setTierRevealed] = useState(false);

  const rankedCharacters = useMemo(() => {
    if (!data?.characters) return [];
    return data.characters
      .filter(c => c.globalRank != null)
      .sort((a, b) => a.globalRank - b.globalRank);
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
    if (initialCreator) {
      setTierRevealed(false);
      fetchData(initialCreator);
    }
  }, [initialCreator]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async (inputStr, forceRefresh = false) => {
    let id = inputStr.trim();
    setLoading(true); setError(null); setData(null); setCacheInfo(null); setTab('characters');

    try {
      // UUID 형식이 아니면서, URL 형태도 아니라면 핸들(@) 검색으로 간주함
      const isUUID = /^[0-9a-fA-F-]{36}$/.test(id);
      const isURL = id.includes('/creators/');
      
      if (!isUUID && !isURL && !id.startsWith('@')) {
        id = '@' + id;
      }

      if (id.startsWith('@')) {
        const handleCacheKey = 'HANDLE_MAP_' + id;
        const HANDLE_TTL_MS = 1 * 24 * 60 * 60 * 1000;
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
        stats.voicePlayUnit = '초'; // seconds fallback — unit is 초, not 회
      } else {
        stats.voicePlayUnit = '회';
      }
      // 삭제되거나 비공개된 캐릭터 개수가 통계에 반영되는 문제를 막기 위해 실제 목록과 동기화
      stats.plotCount = allPlots ? allPlots.length : 0;

      if (profile.profileImageUrl) profile.profileImageUrl = proxyImageUrl(profile.profileImageUrl);

      // --- 백그라운드 랭킹 데이터 수집 시작 ---
      // eloScore/tierName은 서버에서 raw stats로 재계산하므로 전송하지 않음
      const sortedByInteraction = [...allPlots].sort((a, b) => (b.interactionCount || 0) - (a.interactionCount || 0));
      const oldestCharDate = allPlots.reduce((oldest, c) => {
        const d = c.createdAt || c.createdDate;
        if (!d) return oldest;
        return !oldest || d < oldest ? d : oldest;
      }, null);

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
          plotCount: allPlots.length,
          topCharInteractions: sortedByInteraction.slice(0, 20).map(c => c.interactionCount || 0),
          oldestCharCreatedAt: oldestCharDate,
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

  if (loading) {
    return (
      <div className="bg-profile min-h-[100dvh]">
        <ProfilePageHeader onBack={onBack} hasEarnedTitles={hasEarnedTitles} onEditTitle={() => setEditingTitle(true)} />
        <main className="max-w-[680px] mx-auto px-6 py-4 lg:max-w-[1280px] lg:px-[6%]"><SkeletonUI /></main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-profile min-h-[100dvh]">
        <ProfilePageHeader onBack={onBack} hasEarnedTitles={hasEarnedTitles} onEditTitle={() => setEditingTitle(true)} />
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
      <ProfilePageHeader onBack={onBack} hasEarnedTitles={hasEarnedTitles} onEditTitle={() => setEditingTitle(true)} />

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
            <div
              className="flex p-[3px] rounded-[9px] mb-4"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="flex-1 py-[6px] lg:py-2 rounded-[7px] text-[11px] lg:text-[13px] font-semibold transition-all"
                  style={tab === t.key
                    ? { background: '#2c2c34', color: '#fff' }
                    : { color: 'rgba(255,255,255,0.35)' }
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 왼쪽 사이드바 — 프로필 헤더 + HeroCard + 캐릭터 카드(PC) */}
          <aside className="profile-layout-sidebar">
            <ProfileHeader
              profile={data.profile}
              stats={data.stats}
              characters={data.characters}
              editing={editingTitle}
              setEditing={setEditingTitle}
              onTierReveal={() => setTierRevealed(true)}
            />
            <HeroCard stats={data.stats} characters={data.characters} />
            <SidebarCharCards characters={data.characters} />
          </aside>

          {/* 오른쪽 — 탭 컨텐츠 */}
          <div className="profile-layout-main">
            <Suspense fallback={<div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-gray-600" /></div>}>
              {tab === 'characters' && (
                <div className="animate-enter">
                  {rankedCharacters.length > 0 && (
                    <div className="mb-4">
                      <ZetaSpotlightCard characters={rankedCharacters} />
                    </div>
                  )}
                  <SummaryTab characters={data.characters} stats={data.stats} />
                </div>
              )}
              {tab === 'stats' && (
                <div className="animate-enter">
                  <StatsTab stats={data.stats} characters={data.characters} />
                </div>
              )}
              {tab === 'achievements' && (
                <div className="animate-enter">
                  <AchievementsTab stats={data.stats} characters={data.characters} />
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
