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

// tag_history에서 추이를 추적할 태그 키
const TREND_TAG_KEYS = ['순애', 'bl', 'gl', 'ntr_agg'];

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
    headers: { 'User-Agent': 'EGO-BLOOM Datalab Crawler/1.0' }
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

// 차트 데이터 포인트 기준: 2, 4, 6, 8, 10시간 전 (2시간 간격 5개)
const TREND_TARGET_HOURS = [10, 8, 6, 4, 2];

async function saveAndFetchTagHistory(tagScores) {
  if (!supabase) return {};
  const now = new Date().toISOString();
  const rows = Object.entries(tagScores).map(([tag, score]) => ({ tag, score, captured_at: now }));
  const { error: insertErr } = await supabase.from('tag_history').insert(rows);
  if (insertErr) console.error('tag_history insert error:', insertErr.message);

  // 11시간 이내 데이터 조회 → 2, 4, 6, 8, 10시간 전 각각 가장 가까운 포인트 선택
  const since = new Date(Date.now() - 11 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('tag_history')
    .select('tag, score, captured_at')
    .in('tag', TREND_TAG_KEYS)
    .gte('captured_at', since)
    .order('captured_at', { ascending: true });

  const nowMs = Date.now();

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
      const target = nowMs - h * 60 * 60 * 1000;
      const closest = tagRows.reduce((best, r) =>
        Math.abs(r.time - target) < Math.abs(best.time - target) ? r : best
      , tagRows[0]);
      return { score: closest.score, ts: closest.ts };
    });
  }
  return trend;
}

/**
 * 오래된 히스토리 행 정리
 * - plot_history : 12시간 이상 경과 → 삭제 (delta 계산은 최대 6시간 범위만 사용)
 * - tag_history  : 26시간 이상 경과 → 삭제 (트렌드 차트가 25시간 조회)
 */
async function cleanOldHistory() {
  if (!supabase) return;

  const cutoff12h = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const cutoff11h = new Date(Date.now() - 11 * 60 * 60 * 1000).toISOString();

  const [plotResult, tagResult] = await Promise.all([
    supabase.from('plot_history').delete({ count: 'exact' }).lt('captured_at', cutoff12h),
    supabase.from('tag_history').delete({ count: 'exact' }).lt('captured_at', cutoff11h),
  ]);

  if (plotResult.error) {
    console.error('🧹 plot_history 정리 실패:', plotResult.error.message);
  } else {
    console.log(`🧹 plot_history: ${plotResult.count ?? '?'}건 삭제 (12h 초과)`);
  }

  if (tagResult.error) {
    console.error('🧹 tag_history 정리 실패:', tagResult.error.message);
  } else {
    console.log(`🧹 tag_history: ${tagResult.count ?? '?'}건 삭제 (11h 초과)`);
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

    const ntrScore = NTR_TAGS.reduce((sum, t) => sum + (combined[t.toLowerCase()] || 0), 0);
    const tagScoresToSave = {
      '순애': combined['순애'] || 0,
      'bl':   combined['bl'] || 0,
      'gl':   combined['gl'] || 0,
      'ntr_agg': ntrScore,
    };
    const tagTrend = await saveAndFetchTagHistory(tagScoresToSave);

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

generateRankingData();
