import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Loader2, AlertCircle, Sun, Moon, Info, X,
  RefreshCw, History, TrendingUp, ArrowLeft,
  Sparkles, Compass, BarChart3, ChevronRight, Flower2, Hash,
  HelpCircle, MessageSquare, Flame, Crown, Archive
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
import { getCreatorTier, calculateCreatorScore, formatNumber, toKST } from './utils/tierCalculator';
import { APP_VERSION, CHANGELOG } from './data/changelog';
import Highcharts from 'highcharts';
import { HighchartsReact } from 'highcharts-react-official';
import HC_treemap from 'highcharts/modules/treemap';

if (typeof Highcharts === 'object') {
  if (typeof HC_treemap === 'function') {
    HC_treemap(Highcharts);
  } else if (HC_treemap && typeof HC_treemap.default === 'function') {
    HC_treemap.default(Highcharts);
  }
}
// 서버 상태 훅
function useServerStatus() {
  const [data, setData] = useState({ status: 'checking', message: null });

  useEffect(() => {
    const check = async () => {
      try {
        const [sRes, mRes] = await Promise.all([
          fetch('https://emergency.zeta-ai.io/ko/status').then(r => r.text()),
          fetch('https://emergency.zeta-ai.io/ko/message').then(r => r.text())
        ]);

        let status = 'error';
        const s = sRes.trim();
        if (s === 'green') status = 'ok';
        else if (s === 'yellow') status = 'warning';

        const message = mRes.trim();
        // status가 'green' (ok)일 경우 message가 있더라도 배너를 띄우지 않음
        setData({ status, message: status === 'ok' ? null : (message || null) });
      } catch (err) {
        setData(prev => ({ ...prev, status: 'error' }));
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

  return data;
}

// 서버 상태 인디케이터 UI
function ServerStatusIndicator({ status, className = '' }) {
  const colors = {
    checking: 'bg-gray-400',
    ok: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
    warning: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    error: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
  };
  const labels = {
    checking: '확인 중...',
    ok: '제타 서비스 정상',
    warning: '제타 지연/불안정',
    error: '제타 서비스 이상 의심'
  };

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] text-[9px] font-bold tracking-wider uppercase text-[var(--text-secondary)] shrink-0 ${className}`}>
      <span className={`w-2 h-2 rounded-full ${colors[status] || colors.error} ${status === 'checking' ? 'animate-pulse' : ''}`} />
      <span className="hidden sm:inline">{labels[status] || labels.error}</span>
    </div>
  );
}

// 긴급 공지 배너 (Floating)
function EmergencyBanner({ message }) {
  if (!message) return null;
  return (
    <div className="fixed top-4 inset-x-4 z-[60] flex justify-center pointer-events-none animate-slide-down">
      <div className="max-w-xl w-full bg-[rgba(20,20,30,0.95)] border border-amber-500/30 rounded-2xl p-4 shadow-2xl shadow-amber-500/10 backdrop-blur-md pointer-events-auto flex items-start gap-3 ring-1 ring-white/10">
        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
          <AlertCircle size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Zeta Official Notice</div>
          <p className="text-sm text-gray-200 font-medium leading-relaxed break-words whitespace-pre-wrap">
            {message}
          </p>
        </div>
      </div>
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
      originalInteractionCount: p.interactionCount ?? 0,
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

  const limitedTags = tags.slice(0, 30);
  const data = limitedTags.map((t, i) => ({
    y: t.score,
    color: i === 0 ? '#F59E0B' : i === 1 ? '#94A3B8' : i === 2 ? '#D97706' : '#8B5CF6'
  }));

  const options = {
    chart: { type: 'bar', backgroundColor: 'transparent', height: Math.max(300, limitedTags.length * 36) },
    title: { text: null },
    xAxis: {
      categories: limitedTags.map(t => '#' + t.tag),
      labels: {
        style: { color: 'var(--text-primary)', fontWeight: 'bold' }
      },
      lineColor: 'var(--border)',
      tickColor: 'transparent',
    },
    yAxis: {
      title: { text: null },
      gridLineColor: 'var(--border)',
      gridLineDashStyle: 'Dash',
      labels: {
        style: { color: 'var(--text-tertiary)' },
        formatter: function () { return this.value >= 10000 ? (this.value / 10000).toFixed(0) + '만' : this.value.toLocaleString(); }
      }
    },
    tooltip: {
      backgroundColor: 'var(--card)',
      style: { color: 'var(--text-primary)' },
      borderColor: 'var(--border)',
      formatter: function () {
        return `<b>${this.x}</b><br/>수치: <b>${this.y.toLocaleString()}</b>`;
      }
    },
    plotOptions: {
      bar: {
        borderRadius: 4,
        dataLabels: {
          enabled: true,
          color: 'var(--text-secondary)',
          style: { textOutline: 'none', fontWeight: 'bold', fontSize: '10px' },
          formatter: function () {
            if (this.y >= 10000) return (this.y / 10000).toFixed(1) + '만';
            return this.y.toLocaleString();
          }
        },
        animation: {
          duration: 800
        }
      }
    },
    legend: { enabled: false },
    series: [{
      name: '태그',
      data: data
    }],
    credits: { enabled: false }
  };

  return (
    <div className="w-full animate-fade-in mt-4 bg-[var(--bg-secondary)]/20 p-2 rounded-xl border border-[var(--border)] overflow-hidden">
      <HighchartsReact highcharts={Highcharts} options={options} />
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
        <BarChart3 size={18} className="text-[var(--accent)]" />
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


// ─── Treemap Helpers ──────────────────────────────────────────────
function TagTreemap({ tags }) {
  if (!tags || tags.length === 0) return null;
  const data = tags.slice(0, 30).map((t, i) => ({
    name: t.tag,
    value: t.score,
    colorValue: i,
  }));

  const options = {
    chart: { type: 'treemap', backgroundColor: 'transparent', height: 400 },
    title: { text: null },
    colors: ['#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308'],
    tooltip: {
      useHTML: true,
      headerFormat: '<span style="font-size:12px; font-weight:bold; color:var(--accent)">#{point.key}</span><br/>',
      pointFormat: '<span style="color:var(--text-secondary)">집계수/점수: </span><b>{point.value:,.0f}</b>',
      backgroundColor: 'var(--card)',
      style: { color: 'var(--text-primary)' },
      borderColor: 'var(--border)'
    },
    plotOptions: {
      treemap: {
        layoutAlgorithm: 'squarified',
        alternateStartingDirection: true,
        colorByPoint: true,
        dataLabels: {
          enabled: true,
          style: {
            fontSize: '12px',
            textOutline: 'none',
            color: '#FFFFFF'
          }
        },
        states: {
          hover: { opacity: 0.8, borderColor: '#fff' }
        },
        animation: { duration: 500 }
      }
    },
    series: [{
      type: 'treemap',
      data: data
    }],
    credits: { enabled: false }
  };

  return (
    <div className="w-full h-[416px] animate-fade-in mt-4 bg-[var(--bg-secondary)]/20 p-2 rounded-xl border border-[var(--border)]">
      <HighchartsReact highcharts={Highcharts} options={options} />
    </div>
  );
}

// ─── Filter Helpers ───────────────────────────────────────────────────────────
const filterHashtags = (tags, filter) => {
  if (!tags) return [];
  if (filter === 'all') return tags;

  // 모의 필터링: 각 해시태그별 임의의 성향을 부여하여 프론트엔드에서 분리
  // 실제 프로덕션에서는 API에서 성별 필터링된 배열을 직접 제공받아야 합니다.
  const femaleKeywords = ['로맨스', '순애', '다공일수', '집착', '여우', '혐관', '피폐', '차가움', '소꿉친구', '존예', '츤데레', '다정', '존잘', '후회', '철벽', 'gl', '연상'];
  const maleKeywords = ['bl', '무뚝뚝', '대학생', '능글', '학교', '일진', '연애', '유저바라기', '남사친', '소유욕', '판타지', '남녀무리', '하렘', '얀데레', '동거', '먼치킨', '친구'];

  if (filter === 'female') {
    return tags.filter(t => femaleKeywords.some(k => t.tag.toLowerCase().includes(k)) || t.tag.length % 2 === 0);
  }
  if (filter === 'male') {
    return tags.filter(t => maleKeywords.some(k => t.tag.toLowerCase().includes(k)) || t.tag.length % 2 !== 0);
  }
  return tags;
};

// Helper icon component for gender filter
function GenderIcon({ type }) {
  if (type === 'female') return <span className="text-pink-400 font-bold inline-block mr-1">♀</span>;
  if (type === 'male') return <span className="text-blue-400 font-bold inline-block mr-1">♂</span>;
  return <span className="text-gray-400 font-bold inline-block mr-1">○</span>;
}

function TogetherView({ data }) {
  const [viewType, setViewType] = useState('list');
  const [filter, setFilter] = useState('all');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center bg-[var(--bg-secondary)] p-2 rounded-xl border border-[var(--border)] overflow-x-auto hide-scrollbar min-h-[52px]">
        <div className="flex gap-2">
          <button onClick={() => setFilter('all')} className={`flex items-center justify-center px-4 h-8 text-xs font-bold rounded-lg transition-all border ${filter === 'all' ? 'bg-[var(--accent)] text-white shadow-md border-transparent' : 'text-[var(--text-tertiary)] hover:bg-[var(--card)] border-transparent'}`}>전체</button>
          <button onClick={() => setFilter('female')} className={`flex items-center justify-center gap-1.5 px-4 h-8 text-xs font-bold rounded-lg transition-all border ${filter === 'female' ? 'bg-pink-500/20 text-pink-300 border-pink-500/30 shadow-md' : 'text-[var(--text-tertiary)] hover:bg-[var(--card)] border-transparent'}`}><GenderIcon type="female" />여성향</button>
          <button onClick={() => setFilter('male')} className={`flex items-center justify-center gap-1.5 px-4 h-8 text-xs font-bold rounded-lg transition-all border ${filter === 'male' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 shadow-md' : 'text-[var(--text-tertiary)] hover:bg-[var(--card)] border-transparent'}`}><GenderIcon type="male" />남성향</button>
        </div>
      </div>

      <div className="relative card p-5 overflow-hidden border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.1)] backdrop-blur-md">
        <div className="absolute top-0 right-0 w-40 h-40 bg-[var(--accent)] rounded-full blur-[60px] opacity-10 pointer-events-none -mr-10 -mt-10" />

        <div className="relative z-10">
          <GenreDistribution genres={filterHashtags(data?.genres, filter)} />

          <div className="mb-4 pt-4 border-t border-[var(--border)] flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 mt-4">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 mb-1">
                <TrendingUp size={14} className="text-[var(--accent)]" />
                랭킹 종합 해시태그 트렌드 TOP 30
                {filter !== 'all' && <span className="text-[10px] font-medium opacity-70 border border-current px-1.5 py-0.5 rounded-md text-[var(--accent)]">Filter On</span>}
              </h3>
              <p className="text-[10px] text-[var(--text-tertiary)] opacity-60">
                트렌딩×3 · 베스트×2 · 신작×1 가중치 적용 (각 최고 TOP 100 기준)
              </p>
            </div>

            <div className="flex bg-[var(--bg-secondary)] rounded-lg p-1 self-start sm:self-auto shrink-0 border border-[var(--border)]">
              <button onClick={() => setViewType('list')} className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all ${viewType === 'list' ? 'bg-[var(--card)] shadow text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>리스트</button>
              <button onClick={() => setViewType('treemap')} className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all ${viewType === 'treemap' ? 'bg-[var(--card)] shadow text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}>트리맵</button>
            </div>
          </div>

          {viewType === 'list' && <TagBarList tags={filterHashtags(data?.combined, filter)} />}
          {viewType === 'treemap' && <TagTreemap tags={filterHashtags(data?.combined, filter)} />}
        </div>
      </div>
    </div>
  );
}

function InteractionView({ data }) {
  const [filter, setFilter] = useState('all');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center bg-[var(--bg-secondary)] p-2 rounded-xl border border-[var(--border)] overflow-x-auto hide-scrollbar min-h-[52px]">
        <div className="flex gap-2">
          <button onClick={() => setFilter('all')} className={`flex items-center justify-center px-4 h-8 text-xs font-bold rounded-lg transition-all border ${filter === 'all' ? 'bg-[var(--accent)] text-white shadow-md border-transparent' : 'text-[var(--text-tertiary)] hover:bg-[var(--card)] border-transparent'}`}>전체</button>
          <button onClick={() => setFilter('female')} className={`flex items-center justify-center gap-1.5 px-4 h-8 text-xs font-bold rounded-lg transition-all border ${filter === 'female' ? 'bg-pink-500/20 text-pink-300 border-pink-500/30 shadow-md' : 'text-[var(--text-tertiary)] hover:bg-[var(--card)] border-transparent'}`}><GenderIcon type="female" />여성향</button>
          <button onClick={() => setFilter('male')} className={`flex items-center justify-center gap-1.5 px-4 h-8 text-xs font-bold rounded-lg transition-all border ${filter === 'male' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 shadow-md' : 'text-[var(--text-tertiary)] hover:bg-[var(--card)] border-transparent'}`}><GenderIcon type="male" />남성향</button>
        </div>
      </div>

      <div className="relative card p-5 overflow-hidden border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)] backdrop-blur-md">
        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500 rounded-full blur-[60px] opacity-10 pointer-events-none -mr-10 -mt-10" />
        <div className="mb-6 flex items-center justify-between border-b border-[var(--border)] pb-4 z-10 relative">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 mb-1">
              <MessageSquare size={14} className="text-blue-400" />
              해시태그별 대화량 총합 TOP 30
              {filter !== 'all' && <span className="text-[10px] font-medium opacity-70 border border-current px-1.5 py-0.5 rounded-md text-blue-400">Filter On</span>}
            </h3>
            <p className="text-[10px] text-[var(--text-tertiary)] opacity-60">
              현재 차트에 랭크된 모든 캐릭터들의 원본 대화 수치를 태그별로 합산
            </p>
          </div>
        </div>
        <div className="relative z-10">
          <TagBarList tags={filterHashtags(data?.interaction, filter)} />
        </div>
      </div>
    </div>
  );
}

function SeparateView({ data }) {
  const [filter, setFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('trending');

  const sections = [
    { key: 'trending', label: '트렌딩', icon: Flame, color: 'text-violet-300', bg: 'bg-[var(--card)]', shadow: 'shadow-[0_0_15px_rgba(139,92,246,0.1)] border-violet-500/30' },
    { key: 'best', label: '베스트', icon: Crown, color: 'text-amber-300', bg: 'bg-[var(--card)]', shadow: 'shadow-[0_0_15px_rgba(245,158,11,0.1)] border-amber-500/30' },
    { key: 'new', label: '신작', icon: Sparkles, color: 'text-emerald-300', bg: 'bg-[var(--card)]', shadow: 'shadow-[0_0_15px_rgba(16,185,129,0.1)] border-emerald-500/30' },
  ];

  const activeSection = sections.find(s => s.key === activeTab) || sections[0];

  return (
    <div className="flex flex-col gap-4">
      {/* Pill 탭 & 필터 통합 상단 바 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[var(--bg-secondary)] p-2 rounded-xl border border-[var(--border)] overflow-x-auto hide-scrollbar min-h-[52px]">

        {/* Pill 탭 네비게이션 */}
        <div className="flex gap-2 shrink-0">
          {sections.map(s => {
            const Icon = s.icon;
            const isActive = activeTab === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setActiveTab(s.key)}
                className={`flex items-center justify-center gap-1.5 px-4 h-8 text-xs font-bold rounded-lg transition-all whitespace-nowrap border ${isActive ? 'bg-[var(--accent)] text-white shadow-md border-transparent' : 'text-[var(--text-tertiary)] hover:bg-[var(--card)] border-transparent'}`}
              >
                <Icon size={14} className={isActive ? 'text-white' : s.color} />
                {s.label}
              </button>
            );
          })}
        </div>

        {/* 성별 필터 구역 */}
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setFilter('all')} className={`flex items-center justify-center px-4 h-8 text-xs font-bold rounded-lg transition-all border ${filter === 'all' ? 'bg-[var(--accent)] text-white shadow-md border-transparent' : 'text-[var(--text-tertiary)] hover:bg-[var(--card)] border-transparent'}`}>전체</button>
          <button onClick={() => setFilter('female')} className={`flex items-center justify-center gap-1.5 px-4 h-8 text-xs font-bold rounded-lg transition-all border ${filter === 'female' ? 'bg-pink-500/20 text-pink-300 border-pink-500/30 shadow-md' : 'text-[var(--text-tertiary)] hover:bg-[var(--card)] border-transparent'}`}><GenderIcon type="female" />여성향</button>
          <button onClick={() => setFilter('male')} className={`flex items-center justify-center gap-1.5 px-4 h-8 text-xs font-bold rounded-lg transition-all border ${filter === 'male' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 shadow-md' : 'text-[var(--text-tertiary)] hover:bg-[var(--card)] border-transparent'}`}><GenderIcon type="male" />남성향</button>
        </div>
      </div>

      <div className={`relative flex flex-col p-4 sm:p-5 rounded-2xl border ${activeSection.bg} ${activeSection.shadow} overflow-hidden backdrop-blur-md transition-all duration-300 animate-fade-in`}>
        {/* Glassmorphism gradient effect */}
        <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none -mr-10 -mt-10 ${activeTab === 'trending' ? 'bg-violet-500' : activeTab === 'best' ? 'bg-amber-500' : 'bg-emerald-500'}`} />

        <h4 className={`text-sm font-black mb-4 z-10 flex items-center gap-2 ${activeSection.color}`}>
          {activeSection.label} 순위
          {filter === 'female' && <span className="text-[10px] font-medium opacity-70 border border-current px-1.5 py-0.5 rounded-md text-pink-400">여성향</span>}
          {filter === 'male' && <span className="text-[10px] font-medium opacity-70 border border-current px-1.5 py-0.5 rounded-md text-blue-400">남성향</span>}
        </h4>

        <div className="relative z-10 flex-1">
          <TagBarList tags={filterHashtags(data?.[activeTab], filter)} />
        </div>
      </div>
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
  const serverData = useServerStatus();
  const serverStatus = serverData.status;
  const emergencyMessage = serverData.message;
  const [isRecapMode, setIsRecapMode] = useState(false);

  // RECAP 모드 감지 (해시 기반)
  useEffect(() => {
    const checkHash = () => setIsRecapMode(window.location.hash === '#recap');
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

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
        const handleCacheKey = 'HANDLE_MAP_' + id;
        const cachedHandleId = localStorage.getItem(handleCacheKey);

        if (cachedHandleId && !forceRefresh) {
          id = cachedHandleId;
        } else {
          const res = await fetch(`/api/resolve-handle?handle=${encodeURIComponent(id)}`);
          if (!res.ok) throw new Error('사용자를 찾을 수 없습니다.');
          const fetchedId = (await res.json()).id;
          localStorage.setItem(handleCacheKey, fetchedId);
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
                <p className="font-bold text-[var(--accent)] mb-1.5 flex items-center gap-1.5"><BarChart3 size={14} /> 랭킹 점수 집계 방식</p>
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
      </div >
    );
  }

  // 랭킹 미리보기 전용 서브 컴포넌트
  const RankingPreview = memo(({ openAction, data }) => {
    const [topTags, setTopTags] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatedAt, setUpdatedAt] = useState(null);
    const [progressPct, setProgressPct] = useState(0);
    const [timeLeftStr, setTimeLeftStr] = useState('');

    useEffect(() => {
      const handleData = (d) => {
        if (d && d.combined) setTopTags(d.combined.slice(0, 5));
        if (d && d.updatedAt) setUpdatedAt(toKST(d.updatedAt));
      };

      if (data && data.combined) {
        handleData(data);
        setLoading(false);
        return;
      }

      setLoading(true);
      fetch('/data/ranking_latest.json')
        .then(res => res.json())
        .then(handleData)
        .catch(err => console.error("Ranking fetch failed:", err))
        .finally(() => setLoading(false));
    }, [data]);

    useEffect(() => {
      if (!updatedAt) return;
      const interval = setInterval(() => {
        const now = toKST();

        // Target: KST 00:00 (which is UTC 15:00 previous day or same day)
        // Since toKST() returns a date shifted to KST "fake local",
        // we can just target 00:00:00 of the "next day" in this fake local.
        const nextUpdate = new Date(now);
        nextUpdate.setHours(24, 0, 0, 0);
        // 24,0,0,0 on a Date object automatically rolls over to 00:00 of next day.

        const remaining = nextUpdate.getTime() - now.getTime();
        const TOTAL_DAY_MS = 24 * 60 * 60 * 1000;
        const elapsed = TOTAL_DAY_MS - remaining;

        const pct = Math.min(100, Math.max(0, (elapsed / TOTAL_DAY_MS) * 100));
        setProgressPct(pct);

        if (remaining > 0) {
          const h = Math.floor(remaining / 3600000);
          const m = Math.floor((remaining % 3600000) / 60000);
          const s = Math.floor((remaining % 60000) / 1000);
          setTimeLeftStr(`${h}시간 ${m}분 ${s}초 후 갱신`);
        } else {
          setTimeLeftStr('업데이트 갱신중...');
        }
      }, 1000);
      return () => clearInterval(interval);
    }, [updatedAt]);

    return (
      <div className="card p-5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[var(--accent)] to-purple-500 opacity-[0.03] rounded-bl-full pointer-events-none" />

        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
              <TrendingUp size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">현재 제타 트렌딩 주제</h3>
              {updatedAt && (
                <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5 tracking-tight">
                  {updatedAt.getFullYear()}년 {updatedAt.getMonth() + 1}월 {updatedAt.getDate()}일 {String(updatedAt.getHours()).padStart(2, '0')}:{String(updatedAt.getMinutes()).padStart(2, '0')} 기준
                </p>
              )}
            </div>
          </div>
          <p className="text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-secondary)] px-2 py-0.5 rounded-full border border-[var(--border)] shrink-0">
            이번 주 TOP 5
          </p>
        </div>

        {updatedAt && (
          <div className="mb-4 relative z-10 w-full bg-[var(--bg-secondary)]/50 rounded-lg p-2.5 border border-[var(--border)]">
            <div className="flex justify-between items-center text-[10px] text-[var(--text-tertiary)] mb-1.5 px-0.5">
              <span className="flex items-center gap-1.5"><Loader2 size={10} className={progressPct < 100 ? "animate-spin" : ""} /> 랭킹 데이터 캐시 유효</span>
              <span className="font-mono font-medium">{timeLeftStr}</span>
            </div>
            <div className="h-1.5 bg-[var(--bg-primary)] rounded-full overflow-hidden shadow-inner">
              <div className="h-full bg-gradient-to-r from-purple-500 to-[var(--accent)] transition-all ease-linear duration-1000" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        {loading ? (
          <div className="h-[150px] flex items-center justify-center">
            <Loader2 size={16} className="animate-spin text-[var(--text-tertiary)]" />
          </div>
        ) : (
          <div className="space-y-2 mb-4 relative z-10">
            {topTags.map((t, i) => (
              <div key={t.tag} className={`flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-[var(--bg-secondary)] transition-all group/item ${i === 0 ? 'bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/10' : ''}`}>
                <div className="flex items-center gap-2.5">
                  <span className={`text-xs font-bold w-5 flex items-center justify-center shrink-0 ${i === 0 ? 'drop-shadow-[0_0_5px_rgba(250,204,21,0.6)]' : i < 3 ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`}>
                    {i === 0 ? <Crown size={16} fill="currentColor" className="text-yellow-500" /> : i + 1}
                  </span>
                  <div className="flex items-center gap-1 group-hover/item:text-[var(--text-primary)] transition-colors">
                    <Hash size={12} className={`opacity-50 shrink-0 ${i === 0 ? 'text-amber-500' : 'text-[var(--text-tertiary)]'}`} />
                    <span className={`text-sm ${i === 0 ? 'font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-amber-600 drop-shadow-[0_0_8px_rgba(252,211,77,0.4)]' : 'text-[var(--text-secondary)] font-medium'}`}>
                      {t.tag}
                    </span>
                  </div>
                </div>
                <div className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${i === 0 ? 'bg-amber-500/10 text-amber-600 font-bold' : 'text-[var(--text-tertiary)] bg-[var(--bg-primary)]'}`}>
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
        <EmergencyBanner message={emergencyMessage} />

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
            <div className="inline-flex items-center justify-center p-3 sm:p-4 rounded-2xl bg-[var(--card)] shadow-xl shadow-[var(--accent)]/5 border border-[var(--border)] mb-8 ring-1 ring-white/5">
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
            문의는 <a href="https://github.com/iris-out/ego-bloom/issues" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--accent)] hover:opacity-100 transition-all">https://github.com/iris-out/ego-bloom의 Issue 탭</a>에 부탁드립니다.
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
        {!isRecapMode && (
          <TopBar theme={theme} toggleTheme={toggleTheme} onBack={handleBack} input={input}
            onInputChange={setInput} onSubmit={handleSubmit} loading={loading}
            onChangelogOpen={() => setShowChangelog(true)} serverStatus={serverStatus} />
        )}
        <main className="max-w-7xl mx-auto px-4 pt-4 pb-12"><SkeletonUI /></main>
        <ChangelogModal isOpen={showChangelog} onClose={() => setShowChangelog(false)} />
      </div>
    );
  }

  // ===== 결과 화면 =====
  const score = calculateCreatorScore(data.stats, data.characters);
  const tier = getCreatorTier(score);

  return (
    <div className="page-bg min-h-screen">
      {!isRecapMode && (
        <TopBar theme={theme} toggleTheme={toggleTheme} onBack={handleBack} input={input}
          onInputChange={setInput} onSubmit={handleSubmit} loading={loading}
          onChangelogOpen={() => setShowChangelog(true)} serverStatus={serverStatus} />
      )}

      <main className="max-w-7xl mx-auto px-4 pt-4 pb-12 space-y-4">
        {cacheInfo && cacheRemaining !== null && (
          <div className="animate-slide-down flex items-center justify-between px-4 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-xs text-[var(--text-tertiary)]">
            <span className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1.5"><Archive size={14} className="text-[var(--text-secondary)]" /> <span className="font-medium">캐시 데이터 —{' '}</span>
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

        {/* 2-Column Layout Container */}
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-start">

          {/* Left Sidebar (Profile Header) */}
          <div className="w-full lg:w-[380px] shrink-0 lg:sticky lg:top-20 z-10">
            <ProfileHeader profile={data.profile} stats={data.stats} characters={data.characters} />
          </div>

          {/* Right Main Content (Tabs) */}
          <div className="flex-1 w-full min-w-0 flex flex-col gap-4">
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
          </div>
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
  // 현재 kst와 changelog 최신버전 비교
  const isRecent = useMemo(() => {
    try {
      if (!CHANGELOG || CHANGELOG.length === 0) return false;
      const latestDateStr = CHANGELOG[0].date;
      const latestDate = new Date(`${latestDateStr}T00:00:00+09:00`);

      const now = new Date();
      const diffTime = now.getTime() - latestDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      return diffDays >= -1 && diffDays <= 2;
    } catch {
      return false;
    }
  }, []);

  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--card)] text-xs transition-all shadow-sm ${isRecent
        ? 'border-2 border-[var(--accent)] text-[var(--accent)] shadow-[0_0_10px_rgba(168,85,247,0.4)]'
        : 'border border-[var(--border)] text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:border-[var(--accent)]'
        }`}>
      <History size={13} />
      <span className="font-mono font-bold">v{APP_VERSION}</span>
    </button>
  );
}

function TopBar({ theme, toggleTheme, onBack, input, onInputChange, onSubmit, loading, onChangelogOpen, serverStatus }) {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[var(--bg-primary)]/80 border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
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
