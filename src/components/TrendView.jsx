import React, { useState } from 'react';
import {
  ArrowLeft, TrendingUp, Flame, Crown, Sparkles, BarChart3,
  HelpCircle, Hash, MessageSquare, Loader2, ChevronRight
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

// ─── Tag bar chart ────────────────────────────────────────────────────────────
function TagBarList({ tags, maxTags = 30 }) {
  if (!tags || tags.length === 0) return <p className="text-xs text-white/30 py-4 text-center">데이터 없음</p>;

  const limitedTags = tags.slice(0, maxTags);
  const data = limitedTags.map((t, i) => ({
    y: t.score,
    color: i === 0 ? '#F59E0B' : i === 1 ? '#94A3B8' : i === 2 ? '#D97706' : '#8B5CF6'
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
        formatter: function () { return this.value >= 10000 ? (this.value / 10000).toFixed(0) + '만' : this.value.toLocaleString(); }
      }
    },
    tooltip: {
      backgroundColor: 'rgba(26,13,48,0.95)',
      style: { color: '#FFFFFF' },
      borderColor: 'rgba(255,255,255,0.12)',
      formatter: function () { return `<b>${this.x}</b><br/>수치: <b>${this.y.toLocaleString()}</b>`; }
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
          }
        },
        animation: { duration: 800 }
      }
    },
    legend: { enabled: false },
    series: [{ name: '태그', data }],
    credits: { enabled: false }
  };

  return (
    <div className="w-full animate-fade-in mt-4 bg-white/[0.02] p-2 rounded-xl border border-white/[0.06] overflow-hidden">
      <HighchartsReact highcharts={Highcharts} options={options} />
    </div>
  );
}

// ─── Genre Distribution ───────────────────────────────────────────────────────
function GenreDistribution({ genres }) {
  if (!genres || genres.length === 0) return null;
  const colors = ['bg-pink-500', 'bg-purple-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-slate-500'];

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 size={18} className="text-purple-400" />
        <h3 className="text-sm font-bold text-white">주요 장르 점유율</h3>
      </div>
      <div className="w-full h-3 sm:h-4 bg-black/40 rounded-full overflow-hidden flex shadow-inner mb-3">
        {genres.map((g, i) => (
          <div
            key={g.tag}
            style={{ width: `${g.pct}%` }}
            className={`h-full ${colors[i % colors.length]} transition-all duration-1000 hover:brightness-110 cursor-help`}
            title={`${g.tag} (${g.pct}%)`}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
        {genres.map((g, i) => (
          <div key={g.tag} className="flex items-center gap-1.5 text-xs min-w-0">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${colors[i % colors.length]} shadow-sm`} />
            <span className="font-medium text-white/70 truncate">{g.tag}</span>
            <span className="text-[10px] text-white/40 font-mono shrink-0">{g.pct}%</span>
          </div>
        ))}
      </div>
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
      borderColor: 'rgba(255,255,255,0.12)'
    },
    plotOptions: {
      treemap: {
        layoutAlgorithm: 'squarified',
        alternateStartingDirection: true,
        colorByPoint: true,
        dataLabels: {
          enabled: true,
          style: { fontSize: '12px', textOutline: 'none', color: '#FFFFFF' }
        },
        states: { hover: { opacity: 0.8, borderColor: '#fff' } },
        animation: { duration: 500 }
      }
    },
    series: [{ type: 'treemap', data }],
    credits: { enabled: false }
  };

  return (
    <div className="w-full h-[416px] animate-fade-in mt-4 bg-white/[0.02] p-2 rounded-xl border border-white/[0.06]">
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

  if (filter === 'female') {
    return tags.filter(t => femaleKeywords.some(k => t.tag.toLowerCase().includes(k)) || t.tag.length % 2 === 0);
  }
  if (filter === 'male') {
    return tags.filter(t => maleKeywords.some(k => t.tag.toLowerCase().includes(k)) || t.tag.length % 2 !== 0);
  }
  return tags;
};

function GenderIcon({ type }) {
  if (type === 'female') return <span className="text-pink-400 font-bold inline-block mr-1">♀</span>;
  if (type === 'male') return <span className="text-blue-400 font-bold inline-block mr-1">♂</span>;
  return <span className="text-gray-400 font-bold inline-block mr-1">○</span>;
}

// Filter button style helper
const filterBtnClass = (isActive, variant = 'default') => {
  if (isActive) {
    if (variant === 'female') return 'bg-pink-500/15 text-pink-300 border-pink-500/30 shadow-md';
    if (variant === 'male') return 'bg-blue-500/15 text-blue-300 border-blue-500/30 shadow-md';
    return 'bg-purple-500/20 text-white shadow-md border-purple-500/30';
  }
  return 'text-white/40 hover:bg-white/[0.04] border-transparent';
};

// ─── Views ────────────────────────────────────────────────────────────────────
function TogetherView({ data }) {
  const [viewType, setViewType] = useState('list');
  const [filter, setFilter] = useState('all');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center bg-white/[0.02] p-2 rounded-xl border border-white/[0.06] overflow-x-auto hide-scrollbar min-h-[52px]">
        <div className="flex gap-2">
          <button onClick={() => setFilter('all')} className={`flex items-center justify-center px-4 h-8 text-xs font-bold rounded-lg transition-all border ${filterBtnClass(filter === 'all')}`}>전체</button>
          <button onClick={() => setFilter('female')} className={`flex items-center justify-center gap-1.5 px-4 h-8 text-xs font-bold rounded-lg transition-all border ${filterBtnClass(filter === 'female', 'female')}`}><GenderIcon type="female" />여성향</button>
          <button onClick={() => setFilter('male')} className={`flex items-center justify-center gap-1.5 px-4 h-8 text-xs font-bold rounded-lg transition-all border ${filterBtnClass(filter === 'male', 'male')}`}><GenderIcon type="male" />남성향</button>
        </div>
      </div>

      <div className="relative p-5 overflow-hidden rounded-2xl bg-white/[0.02] border border-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.08)] backdrop-blur-sm">
        <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500 rounded-full blur-[60px] opacity-10 pointer-events-none -mr-10 -mt-10" />
        <div className="relative z-10">
          <GenreDistribution genres={filterHashtags(data?.genres, filter)} />
          <div className="mb-4 pt-4 border-t border-white/[0.06] flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 mt-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                <TrendingUp size={14} className="text-purple-400" />
                랭킹 종합 해시태그 트렌드 TOP 30
                {filter !== 'all' && <span className="text-[10px] font-medium opacity-70 border border-current px-1.5 py-0.5 rounded-md text-purple-400">Filter On</span>}
              </h3>
              <p className="text-[10px] text-white/40">트렌딩×3 · 베스트×2 · 신작×1 가중치 적용 (각 최고 TOP 100 기준)</p>
            </div>
            <div className="flex bg-black/30 rounded-lg p-1 self-start sm:self-auto shrink-0 border border-white/[0.06]">
              <button onClick={() => setViewType('list')} className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all ${viewType === 'list' ? 'bg-white/[0.08] shadow text-white' : 'text-white/40 hover:text-white/60'}`}>리스트</button>
              <button onClick={() => setViewType('treemap')} className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all ${viewType === 'treemap' ? 'bg-white/[0.08] shadow text-white' : 'text-white/40 hover:text-white/60'}`}>트리맵</button>
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
      <div className="flex justify-between items-center bg-white/[0.02] p-2 rounded-xl border border-white/[0.06] overflow-x-auto hide-scrollbar min-h-[52px]">
        <div className="flex gap-2">
          <button onClick={() => setFilter('all')} className={`flex items-center justify-center px-4 h-8 text-xs font-bold rounded-lg transition-all border ${filterBtnClass(filter === 'all')}`}>전체</button>
          <button onClick={() => setFilter('female')} className={`flex items-center justify-center gap-1.5 px-4 h-8 text-xs font-bold rounded-lg transition-all border ${filterBtnClass(filter === 'female', 'female')}`}><GenderIcon type="female" />여성향</button>
          <button onClick={() => setFilter('male')} className={`flex items-center justify-center gap-1.5 px-4 h-8 text-xs font-bold rounded-lg transition-all border ${filterBtnClass(filter === 'male', 'male')}`}><GenderIcon type="male" />남성향</button>
        </div>
      </div>
      <div className="relative p-5 overflow-hidden rounded-2xl bg-white/[0.02] border border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.08)] backdrop-blur-sm">
        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500 rounded-full blur-[60px] opacity-10 pointer-events-none -mr-10 -mt-10" />
        <div className="mb-6 flex items-center justify-between border-b border-white/[0.06] pb-4 z-10 relative">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
              <MessageSquare size={14} className="text-blue-400" />
              해시태그별 대화량 총합 TOP 30
              {filter !== 'all' && <span className="text-[10px] font-medium opacity-70 border border-current px-1.5 py-0.5 rounded-md text-blue-400">Filter On</span>}
            </h3>
            <p className="text-[10px] text-white/40">현재 차트에 랭크된 모든 캐릭터들의 원본 대화 수치를 태그별로 합산</p>
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
    { key: 'trending', label: '트렌딩', icon: Flame, color: 'text-violet-300', glowColor: 'bg-violet-500', borderColor: 'border-violet-500/20', shadowColor: 'shadow-[0_0_20px_rgba(139,92,246,0.08)]' },
    { key: 'best', label: '베스트', icon: Crown, color: 'text-amber-300', glowColor: 'bg-amber-500', borderColor: 'border-amber-500/20', shadowColor: 'shadow-[0_0_20px_rgba(245,158,11,0.08)]' },
    { key: 'new', label: '신작', icon: Sparkles, color: 'text-emerald-300', glowColor: 'bg-emerald-500', borderColor: 'border-emerald-500/20', shadowColor: 'shadow-[0_0_20px_rgba(16,185,129,0.08)]' },
  ];

  const activeSection = sections.find(s => s.key === activeTab) || sections[0];

  const filterBar = (
    <div className="flex gap-2 shrink-0">
      <button onClick={() => setFilter('all')} className={`flex items-center justify-center px-4 h-8 text-xs font-bold rounded-lg transition-all border ${filterBtnClass(filter === 'all')}`}>전체</button>
      <button onClick={() => setFilter('female')} className={`flex items-center justify-center gap-1.5 px-4 h-8 text-xs font-bold rounded-lg transition-all border ${filterBtnClass(filter === 'female', 'female')}`}><GenderIcon type="female" />여성향</button>
      <button onClick={() => setFilter('male')} className={`flex items-center justify-center gap-1.5 px-4 h-8 text-xs font-bold rounded-lg transition-all border ${filterBtnClass(filter === 'male', 'male')}`}><GenderIcon type="male" />남성향</button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* 모바일: 탭 + 필터 + 단일 차트 */}
      <div className="lg:hidden flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white/[0.02] p-2 rounded-xl border border-white/[0.06] overflow-x-auto hide-scrollbar min-h-[52px]">
          <div className="flex gap-2 shrink-0">
            {sections.map(s => {
              const Icon = s.icon;
              const isActive = activeTab === s.key;
              return (
                <button key={s.key} onClick={() => setActiveTab(s.key)}
                  className={`flex items-center justify-center gap-1.5 px-4 h-8 text-xs font-bold rounded-lg transition-all whitespace-nowrap border ${filterBtnClass(isActive)}`}>
                  <Icon size={14} className={isActive ? 'text-white' : s.color} />
                  {s.label}
                </button>
              );
            })}
          </div>
          {filterBar}
        </div>
        <div className={`relative flex flex-col p-4 sm:p-5 rounded-2xl border bg-white/[0.02] ${activeSection.borderColor} ${activeSection.shadowColor} overflow-hidden backdrop-blur-sm transition-all duration-300 animate-fade-in`}>
          <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-15 pointer-events-none -mr-10 -mt-10 ${activeSection.glowColor}`} />
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

      {/* PC: 필터 + 2열 차트 그리드 */}
      <div className="hidden lg:flex flex-col gap-4">
        <div className="flex items-center justify-between bg-white/[0.02] p-2 rounded-xl border border-white/[0.06] min-h-[52px]">
          {filterBar}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {sections.slice(0, 2).map(s => (
            <div key={s.key} className={`relative flex flex-col p-4 rounded-2xl border bg-white/[0.02] ${s.borderColor} ${s.shadowColor} overflow-hidden backdrop-blur-sm`}>
              <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-15 pointer-events-none -mr-6 -mt-6 ${s.glowColor}`} />
              <h4 className={`text-sm font-black mb-3 z-10 flex items-center gap-2 ${s.color}`}>
                <s.icon size={14} />
                {s.label} 순위 TOP 15
                {filter !== 'all' && <span className={`text-[10px] font-medium opacity-70 border border-current px-1.5 py-0.5 rounded-md ${filter === 'female' ? 'text-pink-400' : 'text-blue-400'}`}>{filter === 'female' ? '여성향' : '남성향'}</span>}
              </h4>
              <div className="relative z-10 flex-1">
                <TagBarList tags={filterHashtags(data?.[s.key], filter)} maxTags={15} />
              </div>
            </div>
          ))}
        </div>
        <div className={`relative flex flex-col p-4 rounded-2xl border bg-white/[0.02] ${sections[2].borderColor} ${sections[2].shadowColor} overflow-hidden backdrop-blur-sm`}>
          <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-15 pointer-events-none -mr-6 -mt-6 ${sections[2].glowColor}`} />
          <h4 className={`text-sm font-black mb-3 z-10 flex items-center gap-2 ${sections[2].color}`}>
            {React.createElement(sections[2].icon, { size: 14 })}
            {sections[2].label} 순위 TOP 30
            {filter !== 'all' && <span className={`text-[10px] font-medium opacity-70 border border-current px-1.5 py-0.5 rounded-md ${filter === 'female' ? 'text-pink-400' : 'text-blue-400'}`}>{filter === 'female' ? '여성향' : '남성향'}</span>}
          </h4>
          <div className="relative z-10">
            <TagBarList tags={filterHashtags(data?.[sections[2].key], filter)} />
          </div>
        </div>
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
      <div className="flex flex-col gap-2 mb-6 pt-4">
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
                <li><strong className="text-white">대화량 순위</strong>: 현재 차트인 된 모든 캐릭터의 원본 대화 수(Interaction)를 태그별로 단순 합계 (트래픽 규모 중심)</li>
              </ul>
            </div>
          </div>
        </div>

        {/* 탭 선택 */}
        <div className="flex gap-1 p-1 rounded-full bg-white/[0.03] border border-white/[0.06] overflow-x-auto no-scrollbar">
          {[
            ['together', '종합 분석'],
            ['separate', '차트별 분석'],
            ['interaction', '대화량 순위']
          ].map(([key, label]) => (
            <button key={key} onClick={() => setTrendViewMode(key)}
              className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-full transition-all whitespace-nowrap ${trendViewMode === key
                ? 'bg-purple-500/20 text-white shadow-sm border border-purple-500/30'
                : 'text-white/40 hover:text-white/60 border border-transparent'
                }`}>
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
