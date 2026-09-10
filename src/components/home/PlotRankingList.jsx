import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { toBlob, toCanvas } from 'html-to-image';
import { Camera } from 'lucide-react';
import { PlotTopCard, PlotRow } from './PlotRankingItem';
import FilterDropdown from './FilterDropdown';
import Segmented from '../ui/Segmented';
import Num from '../ui/Num';
import Delta from '../ui/Delta';
import { proxyThumbnailUrl } from '../../utils/imageUtils';

const SUB_TABS = ['트렌딩', '베스트', '신작'];
const DATA_KEYS = { '트렌딩': 'trendingPlots', '베스트': 'bestPlots', '신작': 'newPlots' };
const SUB_TAB_OPTIONS = SUB_TABS.map((t) => ({ value: t, label: t }));
const LIST_COL_OPTIONS = [{ value: 1, label: '1열' }, { value: 2, label: '2열' }];

const LOAD_STEPS = [30, 30, 40]; // 30 → +30 → +40

const NTR_TAGS = new Set(['ntr', 'ntl', '빼앗김', '뺏김', '배신', '바람', '불륜', '네토라레']);
const SNAP_GENRE = new Set(['로맨스', '판타지', '무협', 'sf', '스릴러', '공포', '현대', '게임', '스포츠', '일상', '학원', '이세계', '전생', '회귀', '빙의', '시스템', '성좌', '대체역사', '밀리터리', '추리', '착각', '아포칼립스', '디스토피아', '사이버펑크', '스팀펑크', '로판', '무가', '하렘', '역하렘', '피카레스크', '군상극', '먼치킨', '착각계', '전문직', '인방', '재벌', '연예계', '요리', '음악', '미술']);
const SNAP_ORIENT = new Set(['hl', 'bl', 'gl', '백합', '비엘', '언리밋']);
const SNAP_DYN = new Set(['순애', '빼앗김', '뺏김', '불륜', '배신', '바람', 'ntr']);

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
  return plots.filter((p) =>
    (p.hashtags || []).some((t) => NTR_TAGS.has(t?.toLowerCase()))
  ).length;
}

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
  const imgs = [...imgElements].filter((img) => img.src && !img.src.startsWith('data:'));
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

// ─── Tall-node capture (split + vertical stitch) ───────────────────────────
// Browsers/GPUs cap a single canvas dimension (commonly 8192px on mobile Safari/
// Android; older iOS as low as 4096). A ranking snapshot is ~8–9k px tall, so a
// one-shot toBlob() silently clips everything past the limit (the "only top ~80"
// bug). We render the node in vertical slices that each stay well under the cap,
// read their raw pixels, and assemble the final PNG from a pixel buffer — never
// allocating a canvas taller than one slice — so the output can exceed the cap.
const SNAPSHOT_SLICE_HEIGHT = 3500; // safe per-slice canvas height (< 4096 floor)

function readSnapshotBg() {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  return v || undefined;
}

async function captureTallNode(node, width, totalHeight, backgroundColor) {
  // Single slice fits comfortably → keep the simple, fast one-shot path.
  if (totalHeight <= SNAPSHOT_SLICE_HEIGHT) {
    return toBlob(node, {
      pixelRatio: 1,
      backgroundColor,
      cacheBust: false,
      skipFonts: true,
      width,
      height: totalHeight,
    });
  }

  const full = new Uint8ClampedArray(width * totalHeight * 4);
  for (let y = 0; y < totalHeight; y += SNAPSHOT_SLICE_HEIGHT) {
    const sliceHeight = Math.min(SNAPSHOT_SLICE_HEIGHT, totalHeight - y);
    // Shift the cloned node up by `y` and clip to `sliceHeight` → renders the
    // [y, y+sliceHeight) band into a small canvas.
    const canvas = await toCanvas(node, {
      pixelRatio: 1,
      backgroundColor,
      cacheBust: false,
      skipFonts: true,
      width,
      height: sliceHeight,
      style: {
        transform: `translateY(${-y}px)`,
        transformOrigin: 'top left',
      },
    });
    const { data } = canvas.getContext('2d').getImageData(0, 0, width, sliceHeight);
    full.set(data, y * width * 4);
  }

  const { encode } = await import('fast-png');
  const png = encode({ width, height: totalHeight, data: full, depth: 8, channels: 4 });
  return new Blob([png], { type: 'image/png' });
}

// ─── Snapshot header (토큰만 사용, 캡처용 별도 트리) ─────────────────────────
function SnapshotHeader({ subTab, updatedAt, topTags, ntrCount, totalCount }) {
  return (
    <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--line)' }}>
      <div className="flex items-center gap-2.5" style={{ marginBottom: 6 }}>
        <span className="t-h3" style={{ color: 'var(--fg)' }}>EGO-BLOOM</span>
        <span className="t-label" style={{ color: 'var(--fg-3)' }}>RANKING SNAPSHOT</span>
      </div>

      <div className="flex items-baseline gap-2 whitespace-nowrap" style={{ marginBottom: 12 }}>
        <span className="t-h1" style={{ color: 'var(--fg)' }}>{subTab} TOP {totalCount}</span>
        <span className="t-small" style={{ color: 'var(--fg-3)' }}>{formatKST(updatedAt)}</span>
      </div>

      <div className="flex items-center gap-4 flex-wrap whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <span className="t-label" style={{ color: 'var(--fg-3)' }}>인기 태그</span>
          <div className="flex gap-1">
            {topTags.map(({ tag, count }) => (
              <span key={tag} className="eb-chip">{tag} <span style={{ opacity: 0.6, marginLeft: 3 }}>{count}</span></span>
            ))}
          </div>
        </div>
        {ntrCount > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="t-label" style={{ color: 'var(--fg-3)' }}>NTR/NTL 포함</span>
            <span
              className="t-small"
              style={{ fontWeight: 700, color: 'var(--down)', background: 'color-mix(in srgb, var(--down) 12%, var(--bg))', borderRadius: 'var(--radius-pill)', padding: '1px 10px' }}
            >
              {ntrCount}개
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Snapshot row — Num/Delta 재사용, 토큰만 사용 ────────────────────────────
function SnapshotRow({ plot, rank }) {
  const { name, imageUrl, hashtags = [], interactionCount = 0, interactionDelta, rankChange, creatorHandle } = plot;
  const tags = snapPriorityTags(hashtags).slice(0, 2);

  return (
    <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--line)' }}>
      <div className="flex items-center gap-3">
        <span className="t-figure shrink-0 text-right tabular-nums" style={{ width: 28, color: 'var(--fg-2)' }}>{rank}</span>

        <div className="shrink-0 rounded-full overflow-hidden" style={{ width: 44, height: 44, background: 'var(--surface-2)' }}>
          {imageUrl && (
            <img
              src={proxyThumbnailUrl(imageUrl, 64, { forExport: true })}
              alt=""
              crossOrigin="anonymous"
              width={44}
              height={44}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="t-h3 truncate" style={{ color: 'var(--fg)' }}>{name}</p>
            {rankChange === null ? (
              <span className="t-label shrink-0" style={{ color: 'var(--accent-ink)' }}>NEW</span>
            ) : (
              <Delta value={rankChange} format={(n) => String(n)} />
            )}
          </div>
          {creatorHandle && <p className="t-small truncate" style={{ color: 'var(--fg-2)' }}>@{creatorHandle}</p>}
        </div>

        <div className="shrink-0 text-right">
          <Num value={interactionCount} />
        </div>
      </div>

      {(tags.length > 0 || interactionDelta > 0) && (
        <div className="flex items-center gap-1.5 flex-wrap" style={{ marginTop: 6, paddingLeft: 75 }}>
          {tags.map((t) => (
            <span key={t} className="eb-chip">{t}</span>
          ))}
          {interactionDelta > 0 && <Delta value={interactionDelta} className="ml-auto" />}
        </div>
      )}
    </div>
  );
}

export default function PlotRankingList({ rankingData }) {
  const [subTab, setSubTab] = useState('트렌딩');
  const [filter, setFilter] = useState({ sortBy: '순위', direction: '내림차순' });
  const [stepIndex, setStepIndex] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const [listCols, setListCols] = useState(2);
  const sentinelRef = useRef(null);
  const snapshotRef = useRef(null);
  const loadingRef = useRef(false);

  const rawPlots = rankingData?.[DATA_KEYS[subTab]] || [];
  const plots = useMemo(() => applyFilter(rawPlots, filter.sortBy, filter.direction), [rawPlots, filter]);

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
      setStepIndex((prev) => prev + 1);
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
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
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
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (!snapshotRef.current) throw new Error('snapshot node not mounted');

      // 이미지가 모두 로드될 때까지 대기 (visible list와 동일 URL이므로 캐시에서 즉시 로드되는 경우가 대부분)
      const imgEls = snapshotRef.current.querySelectorAll('img');
      await Promise.all([...imgEls].map((img) => {
        if (img.complete && img.naturalWidth > 0) return null;
        return new Promise((res) => {
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

      // Capture in vertical slices and stitch — a one-shot canvas would be
      // clipped at the device's max canvas height (~8192px), dropping the
      // lower-ranked rows. See captureTallNode.
      const blob = await captureTallNode(node, 560, node.scrollHeight, readSnapshotBg());
      if (!blob) throw new Error('snapshot capture returned null');

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

  return (
    <div className="flex flex-col flex-1">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3">
        {/* 서브탭 + 기준 시각 */}
        <div className="flex items-center gap-3 flex-wrap">
          <Segmented options={SUB_TAB_OPTIONS} value={subTab} onChange={setSubTab} aria-label="랭킹 구간" />
          {rankingData?.updatedAt && (
            <span className="t-small shrink-0" style={{ color: 'var(--fg-3)' }}>
              {formatKST(rankingData.updatedAt)}
            </span>
          )}
        </div>

        {/* 우측: (lg) 1열/2열 토글 + 스냅샷 버튼 + 정렬 */}
        <div className="flex items-center gap-2">
          <div className="hidden lg:block">
            <Segmented options={LIST_COL_OPTIONS} value={listCols} onChange={setListCols} aria-label="리스트 열 수" />
          </div>
          <button
            type="button"
            onClick={captureSnapshot}
            disabled={capturing || !rankingData}
            title="랭킹 스냅샷 저장"
            className="eb-btn eb-btn-secondary !h-9 !px-3 !text-[12px] gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {capturing ? (
              <span
                className="w-3.5 h-3.5 rounded-full animate-spin"
                style={{ border: '2px solid var(--accent-ink)', borderTopColor: 'transparent' }}
              />
            ) : (
              <Camera size={13} />
            )}
            <span className="hidden sm:inline">{capturing ? '저장 중…' : '스냅샷'}</span>
          </button>
          <FilterDropdown sortBy={filter.sortBy} direction={filter.direction} onChange={setFilter} />
        </div>
      </div>

      {!rankingData ? (
        <div className="eb-skel flex flex-col gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="eb-bone" style={{ aspectRatio: '5 / 7' }} />
            ))}
          </div>
          <div className="eb-panel overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3" style={{ height: 60, borderBottom: i < 5 ? '1px solid var(--line)' : 'none' }}>
                <div className="eb-bone" style={{ width: 24, height: 20 }} />
                <div className="eb-bone shrink-0" style={{ width: 40, height: 56 }} />
                <div className="flex-1 space-y-1.5">
                  <div className="eb-bone h-4 w-3/4" />
                  <div className="eb-bone h-3 w-1/2" />
                </div>
                <div className="eb-bone h-4 w-10" />
              </div>
            ))}
          </div>
        </div>
      ) : plots.length === 0 ? (
        <div className="flex-1 flex items-center justify-center t-body" style={{ color: 'var(--fg-3)' }}>
          데이터 없음
        </div>
      ) : (
        <>
          {/* Top 10 — 5x2 (390: 2열) CharCard 그리드 */}
          {visiblePlots.length > 0 && (
            <div className="mb-5 grid grid-cols-2 sm:grid-cols-5 gap-3 xl:gap-4">
              {visiblePlots.slice(0, 10).map((plot, i) => (
                <PlotTopCard key={plot.id} plot={plot} rank={i + 1} priority={i === 0} />
              ))}
            </div>
          )}

          {/* 11위~ 리스트 — 하나의 패널, lg 에서만 1열/2열 토글 */}
          {visiblePlots.length > 10 && (
            <div className="eb-panel overflow-hidden">
              <div className={listCols === 2 ? 'flex flex-col lg:grid lg:grid-cols-2' : 'flex flex-col'}>
                {visiblePlots.slice(10).map((plot, i) => (
                  <PlotRow key={plot.id} plot={plot} rank={i + 11} />
                ))}
              </div>
            </div>
          )}

          {/* 무한 스크롤 센티넬 */}
          {hasMore && (
            <div ref={sentinelRef} className="flex items-center justify-center py-6">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="eb-skel rounded-full"
                    style={{ width: 6, height: 6, background: 'var(--fg-3)', animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          {!hasMore && plots.length > 30 && (
            <div className="py-4 text-center t-small" style={{ color: 'var(--fg-3)' }}>
              총 {plots.length}개 표시됨
            </div>
          )}
        </>
      )}

      {/* ── 캡처용 스냅샷 (capturing 중에만 마운트 — 상시 렌더 시 모바일 메모리 압박 및 불필요한 이미지 다운로드) ── */}
      {capturing && rankingData && plots.length > 0 && (
        <div
          aria-hidden="true"
          style={{ position: 'fixed', top: 0, left: 0, opacity: 0, pointerEvents: 'none', zIndex: -1, width: '560px', height: 0, overflow: 'visible' }}
        >
          <div
            ref={snapshotRef}
            style={{ width: '560px', background: 'var(--bg)', color: 'var(--fg)', fontFamily: 'var(--font-sans)' }}
          >
            <SnapshotHeader
              subTab={subTab}
              updatedAt={rankingData.updatedAt}
              topTags={snapshotStats.topTags}
              ntrCount={snapshotStats.ntrCount}
              totalCount={plots.length}
            />

            <div>
              {plots.map((plot, i) => (
                <SnapshotRow key={plot.id} plot={plot} rank={i + 1} />
              ))}
            </div>

            <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="t-small" style={{ color: 'var(--fg-3)' }}>ego-bloom.vercel.app</span>
              <span className="t-small" style={{ color: 'var(--fg-3)' }}>{formatKST(rankingData.updatedAt)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
