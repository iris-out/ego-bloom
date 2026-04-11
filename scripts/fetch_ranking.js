import fs from 'fs/promises';
import { readFileSync } from 'fs';
import path, { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

const ZETA_API_BASE = 'https://api.zeta-ai.io/v1';
const OUTPUT_FILE = path.join(process.cwd(), 'public', 'data', 'ranking_latest.json');

const MAIN_GENRES = [
  '판타지', '로맨스', '무협', 'SF', '스릴러', '공포', '현대', '게임',
  '스포츠', '일상', '학원', '이세계', '전생', '회귀', '빙의', '시스템',
  '성좌', '대체역사', '밀리터리', '추리', '착각',
  '아포칼립스', '디스토피아', '사이버펑크', '스팀펑크', '로판', '무가',
  '순애', '하렘', '역하렘', '피카레스크', '군상극', '먼치킨', '착각계',
  '전문직', '인방', '재벌', '연예계', '요리', '음악', '미술'
];

// 랭킹 집계에서 제외할 태그 (성인/무제한 마커만)
const RANKING_SKIP_TAGS = ['언리밋'];

// NTR 계열 태그 (tag_history에서 ntr_agg로 합산)
const NTR_TAGS = ['빼앗김', '뺏김', '불륜', '바람'];

// 후회/피폐/집착 계열 태그 (hpj_agg로 합산)
const HPJ_TAGS = ['후회', '피폐', '집착'];

// 판타지 계열 태그 (fantasy_agg로 합산)
const FANTASY_TAGS = ['판타지', '현대판타지'];

const HAREM_TAGS    = ['하렘', '역하렘'];
const ISEKAI_TAGS   = ['이세계', '전생', '회귀', '빙의'];
const THRILLER_TAGS = ['스릴러', '공포'];

// tag_history에서 추이를 추적할 태그 키
const TREND_TAG_KEYS = [
  '순애', 'bl', 'gl', 'ntr_agg', 'hpj_agg', 'harem_agg',
  '혐관', '능글', '소꿉친구', '배신', '오지콤', '짝사랑',
  'fantasy_agg', 'isekai_agg', '무협', 'sf', 'thriller_agg', '학원', '현대', '수인',
  '재벌', '연예계', '게임', '일상', '대학생', '일진', '조직', '정략결혼',
];

// ── Supabase 초기화 (환경 변수 없으면 null — graceful fallback) ──
for (const file of ['.env.local', '.env']) {
  try {
    const lines = readFileSync(resolve(process.cwd(), file), 'utf-8').split('\n');
    for (const line of lines) {
      const m = line.match(/^([^=#\s][^=]*)=(.*)$/);
      if (m && !process.env[m[1].trim()]) {
        process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch { /* file not present */ }
}

const supabase = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

async function fetchApi(endpoint) {
  const url = `${ZETA_API_BASE}${endpoint}`;
  console.log(`Fetching ${url}...`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'EGO-BLOOM Ranking Service/1.0' }
  });
  if (!res.ok) throw new Error(`API fetch failed: ${res.status}`);
  const data = await res.json();
  return data.rankings || data.plots || [];
}

function shouldSkipForRanking(tag) {
  return RANKING_SKIP_TAGS.includes(tag.toLowerCase());
}

function mapPlot(p, prevMap) {
  const cur = p.interactionCountWithRegen ?? p.interactionCount ?? 0;
  const prev = prevMap ? prevMap.get(p.id) : null;
  const prevInteraction = prev ? prev.interactionCount : null;
  const prevRank = prev ? prev.rank : null;
  return {
    id: p.id,
    name: p.name || '',
    imageUrl: p.imageUrl || p.characters?.[0]?.imageUrl || null,
    hashtags: (p.hashtags || []).slice(0, 5),
    interactionCount: cur,
    interactionDelta: (prevInteraction != null && cur >= prevInteraction) ? cur - prevInteraction : null,
    // rankChange: 양수=상승, 음수=하락, 0=유지, null=신규(2시간 전 데이터 없음)
    rankChange: prevRank != null ? prevRank - p.rank : null,
    creatorHandle: p.creator?.username || null,
    creatorNickname: p.creator?.nickname || null,
    creatorImageUrl: p.creator?.profileImageUrl || null,
    rank: p.rank,
  };
}

async function fetchPrevPlotMap(rankType) {
  if (!supabase) return new Map();
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const until = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('plot_history')
    .select('plot_id, interaction_count, rank_position')
    .eq('rank_type', rankType)
    .gte('captured_at', since)
    .lte('captured_at', until)
    .order('captured_at', { ascending: false });
  const map = new Map();
  for (const row of (data || [])) {
    if (!map.has(row.plot_id)) map.set(row.plot_id, { interactionCount: row.interaction_count, rank: row.rank_position });
  }
  return map;
}

async function savePlotHistory(plots, rankType) {
  if (!supabase || !plots.length) return;
  const now = new Date().toISOString();
  const rows = plots.map(p => ({
    plot_id: p.id,
    interaction_count: p.interactionCountWithRegen ?? p.interactionCount ?? 0,
    rank_type: rankType,
    rank_position: p.rank,
    captured_at: now,
  }));
  const { error } = await supabase.from('plot_history').insert(rows);
  if (error) console.error(`plot_history insert error (${rankType}):`, error.message);
  else console.log(`✅ plot_history: saved ${rows.length} rows for ${rankType}`);
}

// 차트 데이터 포인트 기준: 2~46시간 전 (총 8개 타겟, 48h 탭까지 지원)
const TREND_TARGET_HOURS = [46, 36, 24, 16, 10, 6, 4, 2];

async function saveAndFetchTagHistory(tagScores) {
  if (!supabase) return { trend: {}, tagScoresDelta: {}, tagScoresDeltaRef: {} };

  // INSERT 전에 1시간 이상 전 ranking score 조회 (delta 계산용)
  // 직전 값이 아닌 1h+ 이전 값과 비교 → 연속 실행 시에도 의미 있는 delta 보장
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: prevRows } = await supabase
    .from('tag_history')
    .select('tag, score, captured_at')
    .in('tag', TREND_TAG_KEYS)
    .lte('captured_at', oneHourAgo)
    .order('captured_at', { ascending: false })
    .limit(TREND_TAG_KEYS.length);

  // 태그별 가장 최신 이전 값 (오염 데이터 필터: tagScores 대비 100배 초과면 무시)
  const prevScoreMap = {};
  const prevCapturedAtMap = {};
  for (const row of (prevRows || [])) {
    if (prevScoreMap[row.tag] != null) continue;
    const curScore = tagScores[row.tag];
    if (curScore != null && row.score > curScore * 100) continue; // 오염 데이터 스킵
    prevScoreMap[row.tag] = row.score;
    prevCapturedAtMap[row.tag] = row.captured_at;
  }

  const nowMs = Date.now();
  const tagScoresDelta = {};
  const tagScoresDeltaRef = {}; // 기준점까지의 시간(시간 단위, 반올림)
  for (const [tag, score] of Object.entries(tagScores)) {
    const prev = prevScoreMap[tag];
    tagScoresDelta[tag] = prev != null ? score - prev : null;
    if (prevCapturedAtMap[tag]) {
      const diffMs = nowMs - new Date(prevCapturedAtMap[tag]).getTime();
      tagScoresDeltaRef[tag] = Math.max(1, Math.round(diffMs / (60 * 60 * 1000)));
    }
  }

  const now = new Date().toISOString();
  const rows = Object.entries(tagScores).map(([tag, score]) => ({ tag, score, captured_at: now }));
  const { error: insertErr } = await supabase.from('tag_history').insert(rows);
  if (insertErr) console.error('tag_history insert error:', insertErr.message);

  // 49시간 이내 데이터 조회 → TREND_TARGET_HOURS 각각 가장 가까운 포인트 선택 (48h 탭 지원)
  const since = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('tag_history')
    .select('tag, score, captured_at')
    .in('tag', TREND_TAG_KEYS)
    .gte('captured_at', since)
    .order('captured_at', { ascending: true });

  const trendNowMs = Date.now();

  // 태그별로 모든 포인트 그룹화
  const byTag = {};
  for (const row of (data || [])) {
    if (!byTag[row.tag]) byTag[row.tag] = [];
    byTag[row.tag].push({
      score: row.score,
      ts: row.captured_at,
      time: new Date(row.captured_at).getTime(),
    });
  }

  const trend = {};
  for (const tag of TREND_TAG_KEYS) {
    const tagRows = byTag[tag] || [];
    if (!tagRows.length) continue;
    // 각 타겟 시간(오래된→최신 순)에 가장 가까운 포인트 선택
    trend[tag] = TREND_TARGET_HOURS.map(h => {
      const target = trendNowMs - h * 60 * 60 * 1000;
      const closest = tagRows.reduce((best, r) =>
        Math.abs(r.time - target) < Math.abs(best.time - target) ? r : best
      , tagRows[0]);
      return { score: closest.score, ts: closest.ts };
    });
    // 현재값을 마지막 포인트로 append (DB 스냅샷 대신 실시간 값 반영)
    trend[tag].push({ score: tagScores[tag], ts: now });
  }
  return { trend, tagScoresDelta, tagScoresDeltaRef };
}

/**
 * 오래된 히스토리 행 정리
 * - plot_history : 48시간 이상 경과 → 삭제
 * - tag_history  : 48시간 이상 경과 → 삭제 (트렌드 차트가 최대 48h 조회)
 */
async function cleanOldHistory() {
  if (!supabase) return;

  const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const [plotResult, tagResult] = await Promise.all([
    supabase.from('plot_history').delete({ count: 'exact' }).lt('captured_at', cutoff48h),
    supabase.from('tag_history').delete({ count: 'exact' }).lt('captured_at', cutoff48h),
  ]);

  if (plotResult.error) {
    console.error('🧹 plot_history 정리 실패:', plotResult.error.message);
  } else {
    console.log(`🧹 plot_history: ${plotResult.count ?? '?'}건 삭제 (48h 초과)`);
  }

  if (tagResult.error) {
    console.error('🧹 tag_history 정리 실패:', tagResult.error.message);
  } else {
    console.log(`🧹 tag_history: ${tagResult.count ?? '?'}건 삭제 (48h 초과)`);
  }
}

async function generateRankingData() {
  try {
    const [trending, best, newItems] = await Promise.all([
      fetchApi('/plots/ranking?type=TRENDING&limit=100&filterType=GENRE&filterValues=all'),
      fetchApi('/plots/ranking?type=BEST&limit=100&filterType=GENRE&filterValues=all'),
      fetchApi('/plots/ranking?type=NEW&limit=100&filterType=GENRE&filterValues=all'),
    ]);

    const calcTags = (list) => {
      const w = {};
      list.forEach(p => {
        const s = Math.max(1, 101 - p.rank);
        (p.hashtags || []).forEach(t => {
          if (!shouldSkipForRanking(t)) w[t.toLowerCase()] = (w[t.toLowerCase()] || 0) + s;
        });
      });
      return Object.entries(w).sort(([, a], [, b]) => b - a).slice(0, 30).map(([tag, score]) => ({ tag, score }));
    };

    const combined = {};
    const allPlotsMap = new Map();
    const processPlot = (p, weight) => {
      if (!p) return;
      allPlotsMap.set(p.id, p);
      const s = Math.max(1, 101 - p.rank) * weight;
      (p.hashtags || []).forEach(t => {
        if (!shouldSkipForRanking(t)) combined[t.toLowerCase()] = (combined[t.toLowerCase()] || 0) + s;
      });
    };
    trending.forEach(p => processPlot(p, 3));
    best.forEach(p => processPlot(p, 2));
    newItems.forEach(p => processPlot(p, 1));

    const combinedList = Object.entries(combined).sort(([, a], [, b]) => b - a).slice(0, 30).map(([tag, score]) => ({ tag, score }));

    const interactionMap = {};
    allPlotsMap.forEach(p => {
      const interactions = p.interactionCountWithRegen ?? p.interactionCount ?? 0;
      (p.hashtags || []).forEach(t => {
        if (!shouldSkipForRanking(t)) {
          interactionMap[t.toLowerCase()] = (interactionMap[t.toLowerCase()] || 0) + interactions;
        }
      });
    });
    const interactionList = Object.entries(interactionMap).sort(([, a], [, b]) => b - a).slice(0, 30).map(([tag, score]) => ({ tag, score }));

    const genreMap = {};
    Object.entries(combined).forEach(([tag, score]) => {
      const upperTag = tag.toUpperCase();
      if (MAIN_GENRES.includes(upperTag) || MAIN_GENRES.includes(tag)) {
        const displayTag = MAIN_GENRES.find(g => g.toUpperCase() === upperTag) || tag;
        genreMap[displayTag] = (genreMap[displayTag] || 0) + score;
      }
    });
    const genreEntries = Object.entries(genreMap).sort(([, a], [, b]) => b - a);
    const mainGenres = genreEntries.slice(0, 5).map(([tag, score]) => ({ tag, score }));
    const etcScore = genreEntries.slice(5).reduce((acc, [, score]) => acc + score, 0);
    if (etcScore > 0) mainGenres.push({ tag: '기타', score: etcScore });
    const genreTotal = mainGenres.reduce((acc, curr) => acc + curr.score, 0);
    const genreDist = mainGenres.map(g => ({ ...g, pct: Math.round((g.score / genreTotal) * 100) }));

    // Plot data with deltas
    const [prevTrending, prevBest, prevNew] = await Promise.all([
      fetchPrevPlotMap('trending'),
      fetchPrevPlotMap('best'),
      fetchPrevPlotMap('new'),
    ]);

    const trendingPlots = trending.slice(0, 100).map(p => mapPlot(p, prevTrending));
    const bestPlots = best.slice(0, 100).map(p => mapPlot(p, prevBest));
    const newPlots = newItems.slice(0, 100).map(p => mapPlot(p, prevNew));

    await Promise.all([
      savePlotHistory(trending, 'trending'),
      savePlotHistory(best, 'best'),
      savePlotHistory(newItems, 'new'),
    ]);

    // 태그별 순위 기반 가중치 점수 (대화량 제거 — combined 재사용)
    // combined[tag] = Σ (101 - rank) × typeWeight  (trending×3, best×2, new×1)
    const ts = combined; // alias for readability

    const tagScoresToSave = {
      '순애':         ts['순애'] || 0,
      'bl':           ts['bl'] || 0,
      'gl':           ts['gl'] || 0,
      'ntr_agg':      NTR_TAGS.reduce((s, t) => s + (ts[t.toLowerCase()] || 0), 0),
      'hpj_agg':      HPJ_TAGS.reduce((s, t) => s + (ts[t.toLowerCase()] || 0), 0),
      'harem_agg':    HAREM_TAGS.reduce((s, t) => s + (ts[t.toLowerCase()] || 0), 0),
      '혐관':         ts['혐관'] || 0,
      '능글':         ts['능글'] || 0,
      '소꿉친구':     ts['소꿉친구'] || 0,
      '배신':         ts['배신'] || 0,
      '오지콤':       ts['오지콤'] || 0,
      '짝사랑':       ts['짝사랑'] || 0,
      'fantasy_agg':  FANTASY_TAGS.reduce((s, t) => s + (ts[t.toLowerCase()] || 0), 0),
      'isekai_agg':   ISEKAI_TAGS.reduce((s, t) => s + (ts[t.toLowerCase()] || 0), 0),
      '무협':         ts['무협'] || 0,
      'sf':           ts['sf'] || 0,
      'thriller_agg': THRILLER_TAGS.reduce((s, t) => s + (ts[t.toLowerCase()] || 0), 0),
      '학원':         ts['학원'] || 0,
      '현대':         ts['현대'] || 0,
      '수인':         ts['수인'] || 0,
      '재벌':         ts['재벌'] || 0,
      '연예계':       ts['연예계'] || 0,
      '게임':         ts['게임'] || 0,
      '일상':         ts['일상'] || 0,
      '대학생':       ts['대학생'] || 0,
      '일진':         ts['일진'] || 0,
      '조직':         ts['조직'] || 0,
      '정략결혼':     ts['정략결혼'] || 0,
    };
    const { trend: tagTrend, tagScoresDelta, tagScoresDeltaRef } = await saveAndFetchTagHistory(tagScoresToSave);

    // 플롯별 interactionHistory 조회 (PlotSparkline 컴포넌트용 시계열 데이터)
    const allPlots = [...trendingPlots, ...bestPlots, ...newPlots];
    const plotIds = [...new Set(allPlots.map(p => p.id).filter(Boolean))];

    if (supabase && plotIds.length > 0) {
      const since = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
      const { data: histRows } = await supabase
        .from('plot_history')
        .select('plot_id, interaction_count, captured_at')
        .in('plot_id', plotIds)
        .gte('captured_at', since)
        .order('captured_at', { ascending: true });

      // plot_id별 그룹화 (최대 6포인트)
      const histByPlot = {};
      for (const row of (histRows || [])) {
        if (!histByPlot[row.plot_id]) histByPlot[row.plot_id] = [];
        histByPlot[row.plot_id].push(row.interaction_count);
      }
      // 최대 6개 균등 샘플링
      for (const id of Object.keys(histByPlot)) {
        const arr = histByPlot[id];
        if (arr.length > 6) {
          const step = (arr.length - 1) / 5;
          histByPlot[id] = Array.from({ length: 6 }, (_, i) => arr[Math.round(i * step)]);
        }
      }
      // 각 플롯에 추가
      for (const p of allPlots) {
        if (p.id && histByPlot[p.id]) {
          p.interactionHistory = histByPlot[p.id];
        }
      }
    }

    const finalData = {
      updatedAt: new Date().toISOString(),
      combined: combinedList,
      trending: calcTags(trending),
      best: calcTags(best),
      new: calcTags(newItems),
      interaction: interactionList,
      genres: genreDist,
      trendingPlots,
      bestPlots,
      newPlots,
      tagTrend,
      tagScores: tagScoresToSave,
      tagScoresDelta,
      tagScoresDeltaRef,
    };

    await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(finalData, null, 2), 'utf-8');
    console.log(`✅ ranking_latest.json 생성 완료`);

    // 오래된 히스토리 정리 (수집 성공 이후에만 실행)
    await cleanOldHistory();
  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  }
}

// --reset-tag-history 플래그: tag_history 전체 삭제 후 수집 실행
async function resetTagHistory() {
  if (!supabase) {
    console.error('❌ Supabase 환경 변수가 없어 tag_history 초기화를 건너뜁니다.');
    return;
  }
  const { error, count } = await supabase
    .from('tag_history')
    .delete({ count: 'exact' })
    .gte('captured_at', '2000-01-01T00:00:00Z'); // 전체 삭제
  if (error) {
    console.error('❌ tag_history 초기화 실패:', error.message);
    process.exit(1);
  }
  console.log(`🗑️  tag_history 초기화 완료: ${count ?? '?'}건 삭제`);
}

const shouldReset = process.argv.includes('--reset-tag-history');

if (shouldReset) {
  console.log('🔄 tag_history 초기화 모드로 실행합니다...');
  resetTagHistory().then(() => generateRankingData());
} else {
  generateRankingData();
}
