import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, RefreshCw, Archive, ChevronLeft, Link2, Check, IdCard, Tag } from 'lucide-react';
import { computeEarnedTitles } from '../data/badges';
import ProfileHeader from '../components/ProfileHeader';
import SummaryTab from '../components/SummaryTab';
import ZetaSpotlightCard from '../components/ZetaSpotlightCard';
import SkeletonUI from '../components/SkeletonUI';
import ChangelogModal from '../components/ChangelogModal';
import { proxyImageUrl, getPlotImageUrl, getPlotImageUrls } from '../utils/imageUtils';
import BirthdayBanner from '../components/BirthdayBanner';
import Segmented from '../components/ui/Segmented';
import { useRankingData } from '../hooks/useRankingData';
import { lazyWithRetry } from '../utils/lazyWithRetry';

const AchievementsTab = lazyWithRetry(() => import('../components/AchievementsTab'), 'AchievementsTab');
const StatsTab = lazyWithRetry(() => import('../components/StatsTab'), 'StatsTab');

const CACHE_KEY_PREFIX = 'zeta_cache_v2_';
const CACHE_DURATION = 30 * 60 * 1000;

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

const TABS = [
  { value: 'stats',        label: '통계'   },
  { value: 'achievements', label: '업적'   },
  { value: 'characters',   label: '캐릭터' },
];

function ProfilePageHeader({ onBack, hasEarnedTitles, onEditTitle }) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }, []);

  return (
    <header className="flex justify-between items-center px-4 pt-5 pb-2 lg:px-12">
      <button type="button" onClick={onBack} className="eb-btn-icon" aria-label="뒤로가기">
        <ChevronLeft size={20} strokeWidth={2} />
      </button>
      <span className="t-h3 hidden sm:inline">EGO-BLOOM</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={handleCopyLink} className="eb-btn-icon" aria-label="링크 복사">
          {copied ? <Check size={16} strokeWidth={2} /> : <Link2 size={16} strokeWidth={2} />}
        </button>
        <button
          type="button"
          onClick={() => { window.location.hash = 'recap'; }}
          className="eb-btn-icon sm:hidden"
          aria-label="카드 보기"
        >
          <IdCard size={16} strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => { window.location.hash = 'recap'; }}
          className="hidden sm:inline-flex eb-btn eb-btn-secondary"
        >
          CARD
        </button>
        {hasEarnedTitles && (
          <>
            <button type="button" onClick={onEditTitle} className="eb-btn-icon sm:hidden" aria-label="칭호 변경">
              <Tag size={16} strokeWidth={2} />
            </button>
            <button type="button" onClick={onEditTitle} className="hidden sm:inline-flex eb-btn eb-btn-secondary">
              칭호 변경
            </button>
          </>
        )}
      </div>
    </header>
  );
}

export default function ProfilePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialCreator = searchParams.get('creator');
  const onBack = () => navigate('/');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('stats');
  const [cacheInfo, setCacheInfo] = useState(null);
  const [cacheRemaining, setCacheRemaining] = useState(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [history, setHistory] = useState(null); // 1일 전 대비 성장 baseline

  const { data: rankingLatest } = useRankingData();

  // ranking_latest.json → 캐릭터 id 로 찾는 전역 랭킹 맵. useRankingData 가 파일을 한 번만 받아오고,
  // 여기서는 매번 파생만 한다.
  const rankingMap = useMemo(() => {
    const map = {};
    if (!rankingLatest) return map;
    (rankingLatest.trendingPlots || []).forEach(p => {
      map[p.id] = { ...map[p.id], trendingRank: p.rank, rankDiff: p.rankChange ?? 0 };
    });
    (rankingLatest.bestPlots || []).forEach(p => {
      map[p.id] = { ...map[p.id], bestRank: p.rank };
    });
    (rankingLatest.newPlots || []).forEach(p => {
      map[p.id] = { ...map[p.id], newRank: p.rank };
    });
    Object.values(map).forEach(r => {
      const ranks = [r.trendingRank, r.bestRank, r.newRank].filter(x => x != null);
      r.globalRank = ranks.length > 0 ? Math.min(...ranks) : null;
      r.rankDiff = r.rankDiff ?? 0;
      r.isNew = r.isNew ?? false;
    });
    return map;
  }, [rankingLatest]);

  const characters = useMemo(() => {
    if (!data?.characters) return [];
    return data.characters.map(c => ({ ...c, ...(rankingMap[c.id] || {}) }));
  }, [data, rankingMap]);

  const rankedCharacters = useMemo(() => {
    return characters
      .filter(c => c.globalRank != null)
      .sort((a, b) => a.globalRank - b.globalRank);
  }, [characters]);

  const hasEarnedTitles = useMemo(() => {
    if (!data) return false;
    return computeEarnedTitles({ characters, stats: data.stats }).some(t => t.earned);
  }, [data, characters]);

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
      fetchData(initialCreator);
    }
  }, [initialCreator]);

  const fetchData = async (inputStr, forceRefresh = false) => {
    let id = inputStr.trim();
    setLoading(true); setError(null); setData(null); setCacheInfo(null); setTab('stats'); setHistory(null);

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

      // 차단된 사용자 확인
      try {
        const blockedRes = await fetch(`/api/check-blocked?id=${id}`);
        if (blockedRes.ok) {
          const { blocked } = await blockedRes.json();
          if (blocked) throw new Error('존재하지 않는 사용자입니다.');
        }
      } catch (e) {
        if (e.message === '존재하지 않는 사용자입니다.') throw e;
      }

      const cacheKey = CACHE_KEY_PREFIX + id;
      if (!forceRefresh) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < CACHE_DURATION) {
              setData(parsed.data); setCacheInfo({ cachedAt: parsed.timestamp }); setLoading(false);
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

      const [profile, stats, allPlots] = await Promise.all([
        profileRes.json(), statsRes.json(), fetchAllPlots(id),
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

      // --- 1일 전 대비 성장 baseline 조회 (백그라운드) ---
      fetch(`/api/get-creator-history?id=${id}`)
        .then(res => res.ok ? res.json() : null)
        .then(h => { if (h && h.found) setHistory(h); })
        .catch(err => console.error('[Creator History Error]:', err));

      // 전역 랭킹 필드(trendingRank 등)는 저장하지 않는다. 렌더 시 rankingMap 에서 파생한다.
      const rawCharacters = allPlots.map(p => ({
        ...p,
        imageUrl: getPlotImageUrl(p),
        imageUrls: getPlotImageUrls(p),
      }));

      const minimalCharacters = rawCharacters.map(c => ({
        id: c.id, name: c.name,
        interactionCount: c.interactionCount,
        originalInteractionCount: c.originalInteractionCount,
        imageUrl: c.imageUrl, imageUrls: c.imageUrls,
        hashtags: c.hashtags, tags: c.tags,
        createdAt: c.createdAt, createdDate: c.createdDate,
        unlimitedAllowed: c.unlimitedAllowed, starCount: c.starCount,
        isLongDescriptionPublic: c.isLongDescriptionPublic,
        shortDescription: c.shortDescription,
      }));
      const finalData = { profile, stats, characters: rawCharacters };
      setData(finalData); setCacheInfo(null);
      try { localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: { ...finalData, characters: minimalCharacters } })); }
      catch { /* QuotaExceededError 무시 */ }
    } catch (err) {
      setError(err.message || '오류가 발생했습니다.');
    } finally { setLoading(false); }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh]" style={{ background: 'var(--bg)' }}>
        <ProfilePageHeader onBack={onBack} hasEarnedTitles={hasEarnedTitles} onEditTitle={() => setEditingTitle(true)} />
        <main className="max-w-[1200px] mx-auto px-4 py-4 lg:px-8"><SkeletonUI /></main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[100dvh]" style={{ background: 'var(--bg)' }}>
        <ProfilePageHeader onBack={onBack} hasEarnedTitles={hasEarnedTitles} onEditTitle={() => setEditingTitle(true)} />
        <main className="max-w-[1200px] mx-auto px-4 py-8 flex flex-col items-center gap-4 lg:px-8">
          <div className="flex items-center gap-2 t-body eb-panel px-4 py-3" style={{ color: 'var(--down)' }}>
            <AlertCircle size={16} strokeWidth={2} /><span>{error}</span>
          </div>
          <button type="button" onClick={onBack} className="eb-btn eb-btn-secondary">
            ← 홈으로 돌아가기
          </button>
        </main>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-[100dvh]" style={{ background: 'var(--bg)' }}>
      <ProfilePageHeader onBack={onBack} hasEarnedTitles={hasEarnedTitles} onEditTitle={() => setEditingTitle(true)} />

      <main className="max-w-[1200px] mx-auto px-4 pb-20 lg:px-8">
        {cacheInfo && cacheRemaining !== null && (
          <div className="eb-panel flex items-center justify-between px-4 py-2.5 mt-4 t-small" style={{ color: 'var(--fg-2)' }}>
            <span className="flex items-center gap-1.5">
              <Archive size={13} strokeWidth={2} style={{ color: 'var(--fg-3)' }} />
              <span>캐시 데이터 —</span>
              <span style={{ fontWeight: 700, color: cacheRemaining <= 5 ? 'var(--warn)' : 'var(--fg-2)' }}>
                {cacheRemaining}분 후 만료
              </span>
            </span>
            <button type="button" onClick={() => fetchData(initialCreator, true)} className="eb-chip inline-flex items-center gap-1">
              <RefreshCw size={11} strokeWidth={2} />새로고침
            </button>
          </div>
        )}

        <BirthdayBanner characters={characters} creatorName={data.profile?.nickname} />

        <div className="mt-6">
          <ProfileHeader
            profile={data.profile}
            stats={data.stats}
            characters={characters}
            growthHistory={history}
            editing={editingTitle}
            setEditing={setEditingTitle}
          />
        </div>

        <div className="mt-8">
          <Segmented options={TABS} value={tab} onChange={setTab} aria-label="프로필 탭" />
        </div>

        <div className="mt-4">
          <Suspense fallback={<div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin" style={{ color: 'var(--fg-3)' }} /></div>}>
            {tab === 'characters' && (
              <div>
                {rankedCharacters.length > 0 && (
                  <div className="mb-4">
                    <ZetaSpotlightCard characters={rankedCharacters} />
                  </div>
                )}
                <SummaryTab characters={characters} stats={data.stats} />
              </div>
            )}
            {tab === 'stats' && (
              <StatsTab stats={data.stats} characters={characters} />
            )}
            {tab === 'achievements' && (
              <AchievementsTab stats={data.stats} characters={characters} />
            )}
          </Suspense>
        </div>
      </main>

      <ChangelogModal isOpen={showChangelog} onClose={() => setShowChangelog(false)} />
    </div>
  );
}
