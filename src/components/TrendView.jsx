import React, { useState } from 'react';
import {
  ArrowLeft, TrendingUp, Flame, Crown, Sparkles, BarChart3,
  HelpCircle, Hash, MessageSquare, Loader2,
} from 'lucide-react';
import Highcharts from 'highcharts';
import { HighchartsReact } from 'highcharts-react-official';
import HC_treemap from 'highcharts/modules/treemap';
import ChangelogModal from './ChangelogModal';

// Highcharts treemap module initialization
if (typeof Highcharts === 'object') {
  if (typeof HC_treemap === 'function') {
    HC_treemap(Highcharts);
  } else if (HC_treemap && typeof HC_treemap.default === 'function') {
    HC_treemap.default(Highcharts);
  }
}

// ─── 공통 스타일 상수 ─────────────────────────────────────────────────────────
const CARD = 'rounded-2xl p-5 border border-white/[0.06] bg-white/[0.02]';
const CARD_HEADER = 'flex items-center justify-between mb-5 pb-4 border-b border-white/[0.06]';

// ─── Tag bar chart (Highcharts) ───────────────────────────────────────────────
function TagBarList({ tags, maxTags = 30 }) {
  if (!tags || tags.length === 0) return <p className="text-xs text-white/30 py-4 text-center">데이터 없음</p>;

  const limitedTags = tags.slice(0, maxTags);
  const data = limitedTags.map((t, i) => ({
    y: t.score,
    color: i === 0 ? '#F59E0B' : i === 1 ? '#94A3B8' : i === 2 ? '#D97706' : '#8B5CF6',
  }));

  const options = {
    chart: { type: 'bar', backgroundColor: 'transparent', height: Math.max(300, limitedTags.length * 36) },
    title: { text: null },
    xAxis: {
      categories: limitedTags.map(t => '#' + t.tag),
      labels: { style: { color: '#FFFFFF', fontWeight: 'bold', fontSize: '11px' } },
      lineColor: 'rgba(255,255,255,0.08)',
      tickColor: 'transparent',
    },
    yAxis: {
      title: { text: null },
      gridLineColor: 'rgba(255,255,255,0.06)',
      gridLineDashStyle: 'Dash',
      labels: {
        style: { color: 'rgba(255,255,255,0.4)' },
        formatter: function () { return this.value >= 10000 ? (this.value / 10000).toFixed(0) + '만' : this.value.toLocaleString(); },
      },
    },
    tooltip: {
      backgroundColor: 'rgba(26,13,48,0.95)',
      style: { color: '#FFFFFF' },
      borderColor: 'rgba(255,255,255,0.12)',
      formatter: function () { return `<b>${this.x}</b><br/>수치: <b>${this.y.toLocaleString()}</b>`; },
    },
    plotOptions: {
      bar: {
        borderRadius: 4,
        dataLabels: {
          enabled: true,
          color: 'rgba(255,255,255,0.7)',
          style: { textOutline: 'none', fontWeight: 'bold', fontSize: '10px' },
          formatter: function () {
            if (this.y >= 10000) return (this.y / 10000).toFixed(1) + '만';
            return this.y.toLocaleString();
          },
        },
        animation: { duration: 800 },
      },
    },
    legend: { enabled: false },
    series: [{ name: '태그', data }],
    credits: { enabled: false },
  };

  return (
    <div className="w-full animate-fade-in">
      <HighchartsReact highcharts={Highcharts} options={options} />
    </div>
  );
}

// ─── Genre Distribution ───────────────────────────────────────────────────────
const GENRE_COLORS = {
  BL:     { bar: '#ec4899', glow: 'rgba(236,72,153,0.5)',  dot: 'bg-[#ec4899]' },
  '로맨스': { bar: '#8b5cf6', glow: 'rgba(139,92,246,0.5)', dot: 'bg-[#8b5cf6]' },
  '순애':  { bar: '#3b82f6', glow: 'rgba(59,130,246,0.5)', dot: 'bg-[#3b82f6]' },
  '판타지': { bar: '#10b981', glow: 'rgba(16,185,129,0.5)', dot: 'bg-[#10b981]' },
  '일상':  { bar: '#f59e0b', glow: 'rgba(245,158,11,0.5)', dot: 'bg-[#f59e0b]' },
};
const GENRE_FALLBACK = { bar: '#71717a', glow: 'rgba(113,113,122,0.4)', dot: 'bg-[#71717a]' };

function GenreDistribution({ genres }) {
  if (!genres || genres.length === 0) return null;

  return (
    <div className={CARD}>
      <div className={CARD_HEADER}>
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-violet-400" />
          <h3 className="text-sm font-semibold text-white">주요 장르 점유율</h3>
        </div>
      </div>
      <div className="w-full h-7 flex rounded-full overflow-hidden bg-black/40 shadow-inner mb-4">
        {genres.map((g) => {
          const c = GENRE_COLORS[g.tag] || GENRE_FALLBACK;
          return (
            <div
              key={g.tag}
              className="h-full transition-all duration-500 hover:brightness-110"
              style={{ width: `${g.pct}%`, background: c.bar }}
              title={`${g.tag}: ${g.pct}%`}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {genres.map((g) => {
          const c = GENRE_COLORS[g.tag] || GENRE_FALLBACK;
          return (
            <div key={g.tag} className="flex flex-col gap-1 p-2 rounded-xl hover:bg-white/[0.03] transition-colors">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} style={{ boxShadow: `0 0 5px ${c.glow}` }} />
                <span className="text-[11px] font-medium text-white/80 truncate">{g.tag}</span>
              </div>
              <div className="pl-3.5">
                <span className="text-lg font-bold text-white">{g.pct}<span className="text-xs font-normal text-white/40">%</span></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Hashtag Rank List (custom bars) ─────────────────────────────────────────
function HashtagRankList({ tags, maxVisible = 10, maxTags = 30 }) {
  const [expanded, setExpanded] = useState(false);
  if (!tags || tags.length === 0) return <p className="text-xs text-white/30 py-4 text-center">데이터 없음</p>;

  const limited = tags.slice(0, maxTags);
  const visible = expanded ? limited : limited.slice(0, maxVisible);
  const maxScore = limited[0]?.score || 1;

  return (
    <div>
      <div className="flex justify-between text-[9px] text-white/30 mb-3 pl-[180px] md:pl-[240px] pr-12">
        <span>0</span>
        <span>{Math.round(maxScore * 0.25).toLocaleString()}</span>
        <span>{Math.round(maxScore * 0.5).toLocaleString()}</span>
        <span>{Math.round(maxScore * 0.75).toLocaleString()}</span>
        <span>{maxScore >= 10000 ? (maxScore / 10000).toFixed(1) + '만' : maxScore.toLocaleString()}</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {visible.map((t, i) => {
          const rank = i + 1;
          const widthPct = (t.score / maxScore) * 100;
          const isTop = rank <= 5;
          const scoreLabel = t.score >= 10000 ? (t.score / 10000).toFixed(1) + '만' : t.score.toLocaleString();

          return (
            <div key={t.tag} className="flex items-center group cursor-default">
              <div className="w-[180px] md:w-[240px] flex items-center pr-4 shrink-0">
                <span className="w-7 text-sm font-bold text-white/40 group-hover:text-white/70 transition-colors">{rank}</span>
                <span className="text-sm font-medium text-white truncate">#{t.tag}</span>
              </div>
              <div className="flex-1 flex items-center gap-3 min-w-0">
                <div className="flex-1 relative">
                  {isTop ? (
                    <div
                      className="h-6 rounded-r-md group-hover:brightness-110 transition-all relative overflow-hidden"
                      style={{
                        width: `${widthPct}%`,
                        background: `linear-gradient(to right, rgba(99,102,241,${0.6 + (5 - rank) * 0.08}), rgba(139,92,246,${0.7 + (5 - rank) * 0.06}))`,
                        boxShadow: rank === 1 ? '0 0 12px rgba(99,102,241,0.3)' : undefined,
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ) : (
                    <div
                      className="h-6 rounded-r-md border border-white/[0.08] group-hover:border-white/[0.15] transition-all overflow-hidden"
                      style={{ width: `${widthPct}%`, background: 'rgba(255,255,255,0.03)' }}
                    >
                      <div className="h-full bg-violet-500/10" />
                    </div>
                  )}
                </div>
                <span className={`text-[11px] font-bold min-w-[44px] text-right transition-colors ${rank === 1 ? 'text-white' : 'text-white/50 group-hover:text-white/80'}`}>
                  {scoreLabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {limited.length > maxVisible && (
        <div className="mt-5 flex justify-center">
          <button
            onClick={() => setExpanded(e => !e)}
            className="px-5 py-2 text-[12px] font-medium text-white/50 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-full transition-all"
          >
            {expanded ? '접기 ↑' : `TOP ${maxTags} 전체 보기 ↓`}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Treemap ──────────────────────────────────────────────────────────────────
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
      headerFormat: '<span style="font-size:12px; font-weight:bold; color:#A78BFA">#{point.key}</span><br/>',
      pointFormat: '<span style="color:rgba(255,255,255,0.7)">집계수/점수: </span><b>{point.value:,.0f}</b>',
      backgroundColor: 'rgba(26,13,48,0.95)',
      style: { color: '#FFFFFF' },
      borderColor: 'rgba(255,255,255,0.12)',
    },
    plotOptions: {
      treemap: {
        layoutAlgorithm: 'squarified',
        alternateStartingDirection: true,
        colorByPoint: true,
        dataLabels: {
          enabled: true,
          style: { fontSize: '12px', textOutline: 'none', color: '#FFFFFF' },
        },
        states: { hover: { opacity: 0.8, borderColor: '#fff' } },
        animation: { duration: 500 },
      },
    },
    series: [{ type: 'treemap', data }],
    credits: { enabled: false },
  };

  return (
    <div className="w-full h-[416px] animate-fade-in">
      <HighchartsReact highcharts={Highcharts} options={options} />
    </div>
  );
}

// ─── Filter Helpers ───────────────────────────────────────────────────────────
const filterHashtags = (tags, filter) => {
  if (!tags) return [];
  if (filter === 'all') return tags;

  const femaleKeywords = ['로맨스', '순애', '다공일수', '집착', '여우', '혐관', '피폐', '차가움', '소꿉친구', '존예', '츤데레', '다정', '존잘', '후회', '철벽', 'gl', '연상'];
  const maleKeywords = ['bl', '무뚝뚝', '대학생', '능글', '학교', '일진', '연애', '유저바라기', '남사친', '소유욕', '판타지', '남녀무리', '하렘', '얀데레', '동거', '먼치킨', '친구'];

  if (filter === 'female') return tags.filter(t => femaleKeywords.some(k => t.tag.toLowerCase().includes(k)) || t.tag.length % 2 === 0);
  if (filter === 'male') return tags.filter(t => maleKeywords.some(k => t.tag.toLowerCase().includes(k)) || t.tag.length % 2 !== 0);
  return tags;
};

// 통일된 필터 버튼 스타일
const filterBtnClass = (isActive, variant = 'default') => {
  const base = 'px-3 py-1.5 text-xs font-semibold rounded-full border transition-all whitespace-nowrap flex items-center gap-1';
  if (isActive) {
    if (variant === 'female') return `${base} bg-pink-500/15 text-pink-300 border-pink-500/30`;
    if (variant === 'male') return `${base} bg-blue-500/15 text-blue-300 border-blue-500/30`;
    return `${base} bg-white/[0.08] text-white border-white/20`;
  }
  return `${base} text-white/40 hover:text-white/70 border-transparent hover:border-white/10 hover:bg-white/[0.03]`;
};

// 공통 필터 바
function FilterBar({ filter, setFilter }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
      <button onClick={() => setFilter('all')} className={filterBtnClass(filter === 'all')}>전체</button>
      <button onClick={() => setFilter('female')} className={filterBtnClass(filter === 'female', 'female')}>
        <span className="text-pink-400 font-bold">♀</span>여성향
      </button>
      <button onClick={() => setFilter('male')} className={filterBtnClass(filter === 'male', 'male')}>
        <span className="text-blue-400 font-bold">♂</span>남성향
      </button>
    </div>
  );
}

// 카드 헤더 오른쪽에 붙는 Filter On 뱃지
function FilterBadge({ filter }) {
  if (filter === 'all') return null;
  return (
    <span className="text-[10px] font-medium text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded-md">
      Filter On
    </span>
  );
}

// ─── Views ────────────────────────────────────────────────────────────────────
function TogetherView({ data }) {
  const [viewType, setViewType] = useState('list');
  const [filter, setFilter] = useState('all');

  return (
    <div className="flex flex-col gap-4">
      <FilterBar filter={filter} setFilter={setFilter} />

      <GenreDistribution genres={filterHashtags(data?.genres, filter)} />

      <div className={CARD}>
        <div className={CARD_HEADER}>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <TrendingUp size={14} className="text-violet-400" />
              <h3 className="text-sm font-semibold text-white">종합 해시태그 트렌드 TOP 30</h3>
              <FilterBadge filter={filter} />
            </div>
            <p className="text-[11px] text-white/40">트렌딩×3 · 베스트×2 · 신작×1 가중치 적용</p>
          </div>
          <div className="flex bg-white/[0.04] rounded-lg p-1 border border-white/[0.06] shrink-0 ml-4">
            <button
              onClick={() => setViewType('list')}
              className={`px-3 py-1.5 text-[11px] font-medium rounded flex items-center gap-1.5 transition-all ${viewType === 'list' ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/60'}`}
            >
              <Hash size={11} /> 리스트
            </button>
            <button
              onClick={() => setViewType('treemap')}
              className={`px-3 py-1.5 text-[11px] font-medium rounded flex items-center gap-1.5 transition-all ${viewType === 'treemap' ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/60'}`}
            >
              <BarChart3 size={11} /> 트리맵
            </button>
          </div>
        </div>
        {viewType === 'list' && <HashtagRankList tags={filterHashtags(data?.combined, filter)} maxVisible={10} maxTags={30} />}
        {viewType === 'treemap' && <TagTreemap tags={filterHashtags(data?.combined, filter)} />}
      </div>
    </div>
  );
}

function InteractionView({ data }) {
  const [filter, setFilter] = useState('all');

  return (
    <div className="flex flex-col gap-4">
      <FilterBar filter={filter} setFilter={setFilter} />
      <div className={CARD}>
        <div className={CARD_HEADER}>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <MessageSquare size={14} className="text-violet-400" />
              <h3 className="text-sm font-semibold text-white">해시태그별 대화량 총합 TOP 30</h3>
              <FilterBadge filter={filter} />
            </div>
            <p className="text-[11px] text-white/40">차트인 된 모든 캐릭터의 대화 수를 태그별로 합산</p>
          </div>
        </div>
        <TagBarList tags={filterHashtags(data?.interaction, filter)} />
      </div>
    </div>
  );
}

function SeparateView({ data }) {
  const [filter, setFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('trending');

  const sections = [
    { key: 'trending', label: '트렌딩', icon: Flame,    iconColor: 'text-violet-400' },
    { key: 'best',     label: '베스트', icon: Crown,    iconColor: 'text-amber-400'  },
    { key: 'new',      label: '신작',   icon: Sparkles, iconColor: 'text-emerald-400' },
  ];

  const activeSection = sections.find(s => s.key === activeTab) || sections[0];
  const ActiveIcon = activeSection.icon;

  return (
    <div className="flex flex-col gap-4">
      {/* 컨트롤 바 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <FilterBar filter={filter} setFilter={setFilter} />
        {/* 모바일 전용 섹션 탭 */}
        <div className="flex lg:hidden gap-2">
          {sections.map(s => {
            const Icon = s.icon;
            const isActive = activeTab === s.key;
            return (
              <button key={s.key} onClick={() => setActiveTab(s.key)} className={filterBtnClass(isActive)}>
                <Icon size={12} className={isActive ? 'text-white' : s.iconColor} />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 모바일: 단일 차트 */}
      <div className={`lg:hidden ${CARD}`}>
        <div className={CARD_HEADER}>
          <div className="flex items-center gap-2">
            <ActiveIcon size={14} className={activeSection.iconColor} />
            <h4 className="text-sm font-semibold text-white">{activeSection.label} 순위</h4>
            <FilterBadge filter={filter} />
          </div>
        </div>
        <TagBarList tags={filterHashtags(data?.[activeTab], filter)} />
      </div>

      {/* PC: 3열 그리드 */}
      <div className="hidden lg:grid grid-cols-3 gap-4">
        {sections.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.key} className={CARD}>
              <div className={CARD_HEADER}>
                <div className="flex items-center gap-2">
                  <Icon size={14} className={s.iconColor} />
                  <h4 className="text-sm font-semibold text-white">{s.label} TOP 15</h4>
                  <FilterBadge filter={filter} />
                </div>
              </div>
              <TagBarList tags={filterHashtags(data?.[s.key], filter)} maxTags={15} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page Component (default export) ─────────────────────────────────────
export default function TrendRankingPage({
  onClose, hashtagData, trendLoading,
  showChangelog, onChangelogClose,
  embedded = false,
}) {
  const [trendViewMode, setTrendViewMode] = useState('together');

  const content = (
    <>
      {/* Header */}
      <div className={`flex flex-col gap-2 mb-6${embedded ? '' : ' pt-4'}`}>
        <div className="flex items-center gap-2">
          {!embedded && onClose && (
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/5 border border-white/[0.06] flex items-center justify-center hover:bg-white/10 transition-all shrink-0 text-white/60"
            >
              <ArrowLeft size={17} />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white leading-tight">랭킹 트렌드 분석</h2>
            <p className="text-[10px] text-white/40">트렌딩 · 베스트 · 신작 TOP 50 기준</p>
          </div>
          <div className="relative group shrink-0">
            <button className="p-2 rounded-full hover:bg-white/[0.04] text-white/40 transition-colors">
              <HelpCircle size={18} />
            </button>
            <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-[#1A1625] border border-white/10 rounded-xl shadow-2xl invisible group-hover:visible z-[100] text-[11px] leading-relaxed text-white/70 animate-fade-in backdrop-blur-xl">
              <p className="font-bold text-purple-400 mb-1.5 flex items-center gap-1.5"><BarChart3 size={14} /> 랭킹 점수 집계 방식</p>
              <ul className="space-y-1.5 list-disc pl-3">
                <li><strong className="text-white">종합 분석</strong>: [트렌딩×3] + [베스트×2] + [신작×1] 가중치를 각 순위별로 합산하여 산출</li>
                <li><strong className="text-white">차트별 분석</strong>: 각 순위권(TOP 100) 내 태그 빈도수와 순위 점수</li>
                <li><strong className="text-white">대화량 순위</strong>: 현재 차트인 된 모든 캐릭터의 원본 대화 수(Interaction)를 태그별로 단순 합계</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 탭 선택 */}
        <div className="flex gap-1 p-1 rounded-full bg-white/[0.03] border border-white/[0.06] overflow-x-auto no-scrollbar">
          {[
            ['together', '종합 분석'],
            ['separate', '차트별 분석'],
            ['interaction', '대화량 순위'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTrendViewMode(key)}
              className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-full transition-all whitespace-nowrap tracking-wider ${
                trendViewMode === key
                  ? 'bg-gradient-to-b from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/25'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {trendLoading ? (
        <div className="flex items-center justify-center py-24 text-white/30">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : trendViewMode === 'together' ? (
        <TogetherView data={hashtagData} />
      ) : trendViewMode === 'interaction' ? (
        <InteractionView data={hashtagData} />
      ) : (
        <SeparateView data={hashtagData} />
      )}
    </>
  );

  if (embedded) {
    return <div className="animate-enter">{content}</div>;
  }

  return (
    <div className="min-h-screen animate-fade-in-up">
      <div className="mx-auto px-4 pt-6 pb-16 max-w-4xl">
        {content}
      </div>
      <ChangelogModal isOpen={showChangelog} onClose={onChangelogClose} />
    </div>
  );
}
