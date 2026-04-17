import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { toBlob } from 'html-to-image';
import { Camera } from 'lucide-react';
import PlotRankingItem from './PlotRankingItem';
import FilterDropdown from './FilterDropdown';
import { proxyThumbnailUrl } from '../../utils/imageUtils';
import { formatNumber } from '../../utils/tierCalculator';

const SUB_TABS = ['트렌딩', '베스트', '신작'];
const DATA_KEYS = { '트렌딩': 'trendingPlots', '베스트': 'bestPlots', '신작': 'newPlots' };

const LOAD_STEPS = [30, 30, 40]; // 30 → +30 → +40

const NTR_TAGS = new Set(['ntr', 'ntl', '빼앗김', '뺏김', '배신', '바람', '불륜', '네토라레']);

function applyFilter(plots, sortBy, direction) {
  const sorted = [...plots].sort((a, b) => {
    if (sortBy === '순위') return a.rank - b.rank;
    if (sortBy === '상승률') {
      const aBase = a.interactionCount - (a.interactionDelta || 0);
      const bBase = b.interactionCount - (b.interactionDelta || 0);
      const aRate = aBase > 0 && a.interactionDelta ? a.interactionDelta / aBase : 0;
      const bRate = bBase > 0 && b.interactionDelta ? b.interactionDelta / bBase : 0;
      return bRate - aRate;
    }
    if (sortBy === '대화량') return b.interactionCount - a.interactionCount;
    return 0;
  });
  return direction === '오름차순' ? sorted.reverse() : sorted;
}

function formatKST(isoStr) {
  if (!isoStr) return null;
  const d = new Date(isoStr);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const mo = kst.getUTCMonth() + 1;
  const dd = kst.getUTCDate();
  const hh = String(kst.getUTCHours()).padStart(2, '0');
  const mm = String(kst.getUTCMinutes()).padStart(2, '0');
  return `${mo}월 ${dd}일 ${hh}:${mm} 기준`;
}

function getDisplayCount(stepIndex) {
  return LOAD_STEPS.slice(0, stepIndex + 1).reduce((a, b) => a + b, 0);
}

function computeTopTags(plots) {
  const counts = {};
  for (const plot of plots) {
    for (const tag of (plot.hashtags || [])) {
      if (!tag) continue;
      const lower = tag.toLowerCase();
      counts[lower] = (counts[lower] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([tag, count]) => ({ tag, count }));
}

function computeNtrCount(plots) {
  return plots.filter(p =>
    (p.hashtags || []).some(t => NTR_TAGS.has(t?.toLowerCase()))
  ).length;
}

/**
 * 원본 프록시 이미지는 장당 4MB+ → html-to-image 내부 직렬화 부담이 크다.
 * 캡처 전에 48×48 JPEG data URL로 교체해 둔다.
 * 가능하면 이미 로드된 HTMLImageElement를 바로 canvas로 그려서(fetch 없이) 처리.
 */
const DATA_URL_CACHE = new Map(); // src → data URL (세션 내 재사용)
const MAX_DATA_URL_CACHE_SIZE = 100;

function drawLoadedImg(img, size = 48, quality = 0.85) {
  if (!img.complete || img.naturalWidth === 0) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return null; // tainted canvas 등
  }
}

async function fetchToDataUrl(url, size = 48, quality = 0.85) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const side = Math.min(bitmap.width, bitmap.height);
      const sx = (bitmap.width - side) / 2;
      const sy = (bitmap.height - side) / 2;
      ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
      return canvas.toDataURL('image/jpeg', quality);
    } finally {
      bitmap.close?.();
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** img 요소들의 src를 작은 JPEG data URL로 교체. 이미 로드된 건 바로 canvas로 그려 즉시 처리. */
async function inlineImages(imgElements) {
  const imgs = [...imgElements].filter(img => img.src && !img.src.startsWith('data:'));
  const origSrcs = new Map();
  const needFetch = new Map(); // url → [img, img, ...]

  // 1st pass: 캐시 또는 이미 로드된 <img>로 즉시 교체
  for (const img of imgs) {
    origSrcs.set(img, img.src);
    const cached = DATA_URL_CACHE.get(img.src);
    if (cached) { img.src = cached; continue; }
    const drawn = drawLoadedImg(img);
    if (drawn) {
      if (DATA_URL_CACHE.size >= MAX_DATA_URL_CACHE_SIZE) {
        DATA_URL_CACHE.delete(DATA_URL_CACHE.keys().next().value);
      }
      DATA_URL_CACHE.set(origSrcs.get(img), drawn);
      img.src = drawn;
      continue;
    }
    const url = origSrcs.get(img);
    if (!needFetch.has(url)) needFetch.set(url, []);
    needFetch.get(url).push(img);
  }

  // 2nd pass: 나머지는 fetch (드문 케이스)
  if (needFetch.size > 0) {
    await Promise.all([...needFetch.entries()].map(async ([url, targets]) => {
      const dataUrl = await fetchToDataUrl(url);
      if (dataUrl) {
        if (DATA_URL_CACHE.size >= MAX_DATA_URL_CACHE_SIZE) {
          DATA_URL_CACHE.delete(DATA_URL_CACHE.keys().next().value);
        }
        DATA_URL_CACHE.set(url, dataUrl);
        for (const t of targets) t.src = dataUrl;
      } else {
        for (const t of targets) t.style.visibility = 'hidden';
      }
    }));
  }
  return origSrcs;
}

function restoreImages(origSrcs) {
  for (const [img, src] of origSrcs) {
    img.src = src;
    img.style.visibility = '';
  }
}

// ─── Snapshot ranking row — mobile-style vertical, fully inline-styled ─────
const SNAP_GENRE = new Set(['로맨스','판타지','무협','sf','스릴러','공포','현대','게임','스포츠','일상','학원','이세계','전생','회귀','빙의','시스템','성좌','대체역사','밀리터리','추리','착각','아포칼립스','디스토피아','사이버펑크','스팀펑크','로판','무가','하렘','역하렘','피카레스크','군상극','먼치킨','착각계','전문직','인방','재벌','연예계','요리','음악','미술']);
const SNAP_ORIENT = new Set(['hl','bl','gl','백합','비엘','언리밋']);
const SNAP_DYN = new Set(['순애','빼앗김','뺏김','불륜','배신','바람','ntr']);

function snapPriorityTags(hashtags) {
  if (!hashtags || hashtags.length === 0) return [];
  let g = null, o = null, d = null;
  const rest = [];
  for (const tag of hashtags) {
    if (!tag) continue;
    const lower = tag.toLowerCase();
    if (!g && SNAP_GENRE.has(lower)) { g = tag; continue; }
    if (!o && SNAP_ORIENT.has(lower)) { o = tag; continue; }
    if (!d && SNAP_DYN.has(lower)) { d = tag; continue; }
    rest.push(tag);
  }
  return [g, o, d, ...rest].filter(Boolean).slice(0, 3);
}

function snapSplitFormatted(str) {
  const m = str.match(/^(-?[0-9,.]+)([만천억]?)$/);
  return m ? { num: m[1], unit: m[2] } : { num: str, unit: '' };
}

function snapPctStr(delta, current) {
  if (delta == null || !current || delta <= 0) return null;
  const base = current - delta;
  if (base <= 0) return null;
  return ((delta / base) * 100).toFixed(1) + '%';
}

function SnapshotRankingItem({ plot, rank, maxDelta }) {
  const { name, imageUrl, hashtags = [], interactionCount = 0, interactionDelta, rankChange, creatorHandle } = plot;
  const tags = snapPriorityTags(hashtags).slice(0, 2);
  const pct = snapPctStr(interactionDelta, interactionCount);
  const { num, unit } = snapSplitFormatted(formatNumber(interactionCount));
  const deltaRatio = maxDelta > 0 && interactionDelta > 0 ? Math.max(0.12, Math.min(0.85, interactionDelta / maxDelta)) : 0;
  const rankColor = rank === 1 ? '#facc15' : rank <= 3 ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.35)';
  const medalBg =
    rank === 1 ? 'rgba(250,204,21,0.05)' :
    rank === 2 ? 'rgba(203,213,225,0.04)' :
    rank === 3 ? 'rgba(217,119,6,0.05)' : 'transparent';

  return (
    <div style={{
      padding: '14px 14px 14px 12px',
      background: medalBg,
      borderLeft: deltaRatio > 0 ? `2px solid rgba(74,222,128,${deltaRatio})` : '2px solid transparent',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      {/* Row 1: rank + avatar + name/handle + chats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{
          fontSize: '18px',
          fontWeight: 700,
          textAlign: 'center',
          width: '28px',
          flexShrink: 0,
          fontVariantNumeric: 'tabular-nums',
          color: rankColor,
        }}>{rank}</span>

        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '9999px',
          overflow: 'hidden',
          flexShrink: 0,
          background: 'rgba(255,255,255,0.1)',
        }}>
          {imageUrl && (
            <img
              src={proxyThumbnailUrl(imageUrl, 64, { forExport: true })}
              alt=""
              crossOrigin="anonymous"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            <span style={{
              fontSize: '19px',
              fontWeight: 600,
              color: '#fff',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: 1.2,
              minWidth: 0,
              flex: '0 1 auto',
            }}>{name}</span>
            {rankChange === null ? (
              <span style={{
                flexShrink: 0,
                fontSize: '10px',
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: '4px',
                background: 'rgba(59,130,246,0.2)',
                color: '#93c5fd',
                border: '1px solid rgba(59,130,246,0.3)',
              }}>NEW</span>
            ) : rankChange > 0 ? (
              <span style={{ flexShrink: 0, fontSize: '12px', fontWeight: 700, color: '#4ade80' }}>▲{rankChange}</span>
            ) : rankChange < 0 ? (
              <span style={{ flexShrink: 0, fontSize: '12px', fontWeight: 700, color: '#f87171' }}>▼{Math.abs(rankChange)}</span>
            ) : null}
          </div>
          {creatorHandle && (
            <div style={{
              fontSize: '14px',
              color: 'rgba(255,255,255,0.38)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              marginTop: '1px',
            }}>@{creatorHandle}</div>
          )}
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 'auto' }}>
          <span style={{
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.03em',
            fontFamily: 'var(--font-mono), ui-monospace, monospace',
          }}>
            <span style={{ fontSize: '26px', fontWeight: 700, color: '#fff' }}>{num}</span>
            {unit && <span style={{ fontSize: '15px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginLeft: '1px' }}>{unit}</span>}
          </span>
        </div>
      </div>

      {/* Row 2: tags + delta */}
      {(tags.length > 0 || (interactionDelta != null && interactionDelta > 0)) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', paddingLeft: '88px' }}>
          {tags.map((t, i) => (
            <span key={i} style={{
              fontSize: '12px',
              padding: '1px 8px',
              borderRadius: '9999px',
              background: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.55)',
              whiteSpace: 'nowrap',
              maxWidth: '120px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>{t}</span>
          ))}
          {interactionDelta != null && interactionDelta > 0 && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: '6px', flexShrink: 0 }}>
              {pct && (
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#34d399', fontVariantNumeric: 'tabular-nums' }}>
                  +{pct}
                </span>
              )}
              <span style={{ fontSize: '13px', color: 'rgba(167,243,208,0.9)', fontVariantNumeric: 'tabular-nums' }}>
                +{formatNumber(interactionDelta)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Snapshot header (inline-styled for reliable capture) ───────────────────
function SnapshotHeader({ subTab, updatedAt, topTags, ntrCount, totalCount }) {
  return (
    <div style={{
      padding: '20px 20px 16px',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      marginBottom: '4px',
    }}>
      {/* Branding row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
          <path d="M8 12 L12 8 L16 12 L12 16 Z" fill="rgba(129,140,248,0.8)" />
        </svg>
        <span style={{ fontWeight: 700, fontSize: '15px', color: '#fff', letterSpacing: '-0.02em' }}>EGO-BLOOM</span>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em' }}>RANKING SNAPSHOT</span>
      </div>

      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '12px', whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: '22px', fontWeight: 700, color: '#fff', letterSpacing: '-0.03em' }}>
          {subTab} TOP {totalCount}
        </span>
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
          {formatKST(updatedAt)}
        </span>
      </div>

      {/* Stats row — single line, no wrap */}
      <div style={{ display: 'flex', gap: '18px', flexWrap: 'nowrap', alignItems: 'center', whiteSpace: 'nowrap' }}>
        {/* Top tags */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>인기 태그</span>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'nowrap' }}>
            {topTags.map(({ tag, count }) => (
              <span key={tag} style={{
                fontSize: '11px',
                color: 'rgba(167,139,250,0.9)',
                background: 'rgba(167,139,250,0.1)',
                border: '1px solid rgba(167,139,250,0.2)',
                borderRadius: '999px',
                padding: '1px 8px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                lineHeight: 1.5,
              }}>
                {tag} <span style={{ opacity: 0.6 }}>{count}</span>
              </span>
            ))}
          </div>
        </div>

        {/* NTR count */}
        {ntrCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>NTR/NTL 포함</span>
            <span style={{
              fontSize: '12px', fontWeight: 700,
              color: 'rgba(248,113,113,0.9)',
              background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.2)',
              borderRadius: '999px',
              padding: '1px 10px',
              whiteSpace: 'nowrap',
              lineHeight: 1.5,
            }}>
              {ntrCount}개
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlotRankingList({ rankingData }) {
  const [subTab, setSubTab] = useState('트렌딩');
  const [filter, setFilter] = useState({ sortBy: '순위', direction: '내림차순' });
  const [stepIndex, setStepIndex] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const sentinelRef = useRef(null);
  const snapshotRef = useRef(null);
  const loadingRef = useRef(false);

  const rawPlots = rankingData?.[DATA_KEYS[subTab]] || [];
  const plots = useMemo(() => applyFilter(rawPlots, filter.sortBy, filter.direction), [rawPlots, filter]);
  const maxDelta = useMemo(() => Math.max(0, ...plots.map(p => p.interactionDelta ?? 0)), [plots]);

  const displayCount = getDisplayCount(stepIndex);
  const visiblePlots = plots.slice(0, displayCount);
  const hasMore = displayCount < plots.length && stepIndex < LOAD_STEPS.length - 1;

  const snapshotStats = useMemo(() => ({
    topTags: computeTopTags(plots),
    ntrCount: computeNtrCount(plots),
  }), [plots]);

  const loadMore = useCallback(() => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setTimeout(() => {
      setStepIndex(prev => prev + 1);
      loadingRef.current = false;
    }, 120);
  }, [hasMore]);

  // Reset when sub-tab or filter changes
  useEffect(() => {
    setStepIndex(0);
  }, [subTab, filter]);

  // IntersectionObserver on sentinel
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: '200px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadMore]);

  async function captureSnapshot() {
    if (capturing || !rankingData) return;
    setCapturing(true);
    let origSrcs = null;
    try {
      // capturing=true 이후 React가 스냅샷 트리를 마운트할 때까지 대기
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (!snapshotRef.current) throw new Error('snapshot node not mounted');

      // 이미지가 모두 로드될 때까지 대기 (visible list와 동일 URL이므로 캐시에서 즉시 로드되는 경우가 대부분)
      const imgEls = snapshotRef.current.querySelectorAll('img');
      await Promise.all([...imgEls].map(img => {
        if (img.complete && img.naturalWidth > 0) return null;
        return new Promise(res => {
          const done = () => { img.onload = null; img.onerror = null; res(); };
          img.onload = done;
          img.onerror = done;
          setTimeout(done, 2000);
        });
      }));

      // 스냅샷 div 안의 img를 data URL로 교체 → toBlob 내부 fetch 차단
      origSrcs = await inlineImages(imgEls);

      const node = snapshotRef.current;
      // Force layout flush before capture
      // eslint-disable-next-line no-unused-expressions
      node.offsetHeight;

      const blob = await toBlob(node, {
        pixelRatio: 1,
        backgroundColor: '#0F0B1F',
        cacheBust: false,
        skipFonts: true,
        width: 560,
        height: node.scrollHeight,
      });
      if (!blob) throw new Error('toBlob returned null');

      const dateStr = rankingData.updatedAt
        ? new Date(rankingData.updatedAt).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.download = `ego-bloom-ranking-${subTab}-${dateStr}.png`;
      a.href = objectUrl;
      a.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    } catch (e) {
      console.error('Snapshot failed', e);
    } finally {
      if (origSrcs) restoreImages(origSrcs);
      setCapturing(false);
    }
  }

  function handleSubTab(t) {
    setSubTab(t);
  }

  return (
    <div className="flex flex-col flex-1">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3">
        {/* 서브탭 + 기준 시각 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1.5">
            {SUB_TABS.map(t => (
              <button
                key={t}
                onClick={() => handleSubTab(t)}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-[13px] sm:text-[15px] font-semibold transition-all ${
                  subTab === t
                    ? 'bg-indigo-500/50 text-white border border-indigo-400/70 shadow-sm shadow-indigo-500/20'
                    : 'bg-white/[0.07] text-white/50 border border-white/[0.13] hover:bg-white/[0.12] hover:text-white/75 hover:border-white/25'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {rankingData?.updatedAt && (
            <span className="text-[11px] text-white/25 shrink-0">
              {formatKST(rankingData.updatedAt)}
            </span>
          )}
        </div>

        {/* 우측: 스냅샷 버튼 + 필터 */}
        <div className="flex items-center gap-2">
          <button
            onClick={captureSnapshot}
            disabled={capturing || !rankingData}
            title="랭킹 스냅샷 저장"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all duration-200 text-[12px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: capturing ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.05)',
              borderColor: capturing ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.12)',
              color: capturing ? 'rgba(167,139,250,0.9)' : 'rgba(255,255,255,0.55)',
            }}
          >
            {capturing ? (
              <span className="w-3.5 h-3.5 border-2 border-violet-400/60 border-t-violet-400 rounded-full animate-spin" />
            ) : (
              <Camera size={13} />
            )}
            <span className="hidden sm:inline">{capturing ? '저장 중…' : '스냅샷'}</span>
          </button>
          <FilterDropdown
            sortBy={filter.sortBy}
            direction={filter.direction}
            onChange={setFilter}
          />
        </div>
      </div>

      {/* 데스크탑 헤더 (sm+): 5열 그리드 */}
      <div className="hidden sm:grid plot-ranking-grid items-center gap-x-2 mb-1" style={{ paddingLeft: '10px' }}>
        <span style={{ fontSize: '9px', color: 'var(--c-label)', letterSpacing: 'var(--label-tracking)', textAlign: 'center' }}>#</span>
        <span style={{ fontSize: '9px', color: 'var(--c-label)', letterSpacing: 'var(--label-tracking)' }}>NAME</span>
        <span style={{ fontSize: '9px', color: 'var(--c-label)', letterSpacing: 'var(--label-tracking)', textAlign: 'right' }}>TAGS</span>
        <span style={{ fontSize: '9px', color: 'var(--c-label)', letterSpacing: 'var(--label-tracking)', textAlign: 'right' }}>CHATS</span>
        <div className="text-right">
          <span style={{ fontSize: '9px', color: 'var(--c-label)', letterSpacing: 'var(--label-tracking)' }}>2H CHG</span>
        </div>
      </div>
      {/* 모바일 헤더 (< sm): 2열 단순화 */}
      <div className="sm:hidden flex items-center px-2 mb-1 gap-x-2">
        <span className="text-[11px] text-white/20 w-5 text-center shrink-0">#</span>
        <span className="text-[11px] text-white/20 flex-1">플롯</span>
        <span className="text-[11px] text-white/20">대화량 / 상승 <span className="text-white/15">(2h)</span></span>
      </div>

      {!rankingData ? (
        /* 스켈레톤 */
        <div className="flex flex-col">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border-b border-white/5">
              <div className="hidden sm:grid plot-ranking-grid items-center gap-x-2 py-3 px-2">
                <div className="h-4 w-4 rounded bg-white/10 animate-pulse mx-auto" />
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 rounded bg-white/10 animate-pulse w-3/4" />
                    <div className="h-3 rounded bg-white/5 animate-pulse w-1/2" />
                  </div>
                </div>
                <div className="h-5 rounded-full bg-white/5 animate-pulse" />
                <div className="h-4 rounded bg-white/10 animate-pulse" />
                <div className="h-2 rounded-full bg-white/5 animate-pulse" />
              </div>
              <div className="sm:hidden py-3 px-2">
                <div className="flex items-center gap-2.5 mb-1.5">
                  <div className="w-5 h-4 rounded bg-white/10 animate-pulse shrink-0" />
                  <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 rounded bg-white/10 animate-pulse w-3/4" />
                    <div className="h-3 rounded bg-white/5 animate-pulse w-1/2" />
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-20">
                  <div className="h-3 w-12 rounded-full bg-white/5 animate-pulse" />
                  <div className="h-3 w-10 rounded bg-white/10 animate-pulse ml-auto" />
                  <div className="w-10 h-2 rounded-full bg-white/5 animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : plots.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-white/20 text-[14px]">
          데이터 없음
        </div>
      ) : (
        <>
          <div className="flex flex-col divide-y divide-white/5">
            {visiblePlots.map((plot, i) => (
              <PlotRankingItem
                key={plot.id}
                plot={plot}
                rank={i + 1}
                maxDelta={maxDelta}
              />
            ))}
          </div>

          {/* 무한 스크롤 센티넬 */}
          {hasMore && (
            <div ref={sentinelRef} className="flex items-center justify-center py-6">
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-white/25 animate-pulse"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          {!hasMore && plots.length > 30 && (
            <div className="py-4 text-center text-[12px] text-white/20">
              총 {plots.length}개 표시됨
            </div>
          )}
        </>
      )}

      {/* ── 캡처용 스냅샷 (capturing 중에만 마운트 — 상시 렌더 시 모바일 메모리 압박 및 불필요한 이미지 다운로드) ── */}
      {capturing && rankingData && plots.length > 0 && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            opacity: 0,
            pointerEvents: 'none',
            zIndex: -1,
            width: '560px',
            height: 0,
            overflow: 'visible',
          }}
        >
        <div
          ref={snapshotRef}
          style={{
            width: '560px',
            background: '#0F0B1F',
            color: '#ffffff',
            fontFamily: 'Pretendard Variable, -apple-system, BlinkMacSystemFont, sans-serif',
          }}
        >
          <SnapshotHeader
            subTab={subTab}
            updatedAt={rankingData.updatedAt}
            topTags={snapshotStats.topTags}
            ntrCount={snapshotStats.ntrCount}
            totalCount={plots.length}
          />

          {/* All plots — mobile vertical style */}
          <div>
            {plots.map((plot, i) => (
              <SnapshotRankingItem
                key={plot.id}
                plot={plot}
                rank={i + 1}
                maxDelta={maxDelta}
              />
            ))}
          </div>

          {/* Footer */}
          <div style={{
            padding: '14px 20px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            marginTop: '4px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>
              ego-bloom.vercel.app
            </span>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>
              {formatKST(rankingData.updatedAt)}
            </span>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
