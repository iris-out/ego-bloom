import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Lock, BarChart2, Hash, Trophy, Star, Zap } from 'lucide-react';
import { useServerStatus } from '../hooks/useServerStatus';
import ChangelogModal from '../components/ChangelogModal';
import DataCollectionModal from '../components/DataCollectionModal';
import SearchWarningModal from '../components/SearchWarningModal';
import EmergencyToast from '../components/EmergencyToast';
import SearchPill from '../components/SearchPill';
import AnnouncementTicker from '../components/home/AnnouncementTicker';
import TagTrendStrip from '../components/home/TagTrendStrip';
import PlotRankingList from '../components/home/PlotRankingList';
import TagTrendingList from '../components/home/TagTrendingList';
import CreatorRankingList from '../components/home/CreatorRankingList';
import FavoritesPanel from '../components/home/FavoritesPanel';
import RankingTimeline from '../components/home/RankingTimeline';

function _lcg(seed) {
  let s = seed >>> 0;
  return () => { s = Math.imul(1664525, s) + 1013904223 >>> 0; return s / 0x100000000; };
}
const _r = _lcg(0xDEADBEEF);
const STAR_DATA = Array.from({ length: 52 }, (_, i) => ({
  id: i, x: _r() * 94 + 2, y: _r() * 90 + 2,
  size: 0.6 + _r() * 1.3, baseOpacity: 0.06 + _r() * 0.18,
  peakOpacity: 0.22 + _r() * 0.40, dur: 1.8 + _r() * 3.8, delay: _r() * 6.0,
}));

function StarField({ globalOpacity = 1 }) {
  if (globalOpacity === 0) return null;
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ opacity: globalOpacity, transition: 'opacity 1.5s ease' }}>
      {STAR_DATA.map(s => (
        <div key={s.id} className="absolute rounded-full bg-white star-twinkle" style={{
          left: `${s.x}%`, top: `${s.y}%`, width: `${s.size}px`, height: `${s.size}px`,
          '--star-base-opacity': s.baseOpacity, '--star-peak-opacity': s.peakOpacity,
          '--star-dur': `${s.dur}s`, animationDelay: `${s.delay}s`,
        }} />
      ))}
    </div>
  );
}

function getTimeSegment() {
  const h = new Date().getHours();
  if (h >= 21 || h < 4) return 'night';
  if (h >= 4 && h < 7) return 'dawn';
  if (h >= 7 && h < 18) return 'day';
  return 'evening';
}

const TIME_BG = {
  night: {
    base: 'linear-gradient(to bottom, #04091A 0%, #081530 22%, #0C1D45 45%, #111840 68%, #0E1228 100%)',
    horizon: 'radial-gradient(ellipse 130% 80% at 50% 115%, rgba(220,110,50,0.07) 0%, rgba(160,70,120,0.05) 40%, transparent 70%)',
    topGlow: 'radial-gradient(ellipse, rgba(35,80,200,0.20) 0%, transparent 70%)', stars: 1,
  },
  dawn: {
    base: 'linear-gradient(to bottom, #071427 0%, #0D1D40 22%, #102450 45%, #0E1E40 68%, #091324 100%)',
    horizon: 'radial-gradient(ellipse 120% 70% at 50% 115%, rgba(130,190,255,0.09) 0%, rgba(80,130,220,0.05) 40%, transparent 70%)',
    topGlow: 'radial-gradient(ellipse, rgba(20,60,180,0.15) 0%, transparent 70%)', stars: 0.3,
  },
  day: {
    base: 'linear-gradient(to bottom, #0A1628 0%, #0D1E3A 30%, #102348 60%, #0E1E38 100%)',
    horizon: 'radial-gradient(ellipse 100% 60% at 50% 120%, rgba(100,160,255,0.06) 0%, transparent 60%)',
    topGlow: 'radial-gradient(ellipse, rgba(20,50,150,0.12) 0%, transparent 70%)', stars: 0,
  },
  evening: {
    base: 'linear-gradient(to bottom, #060D1F 0%, #0A1530 22%, #0E1C42 45%, #101A3A 68%, #0A1020 100%)',
    horizon: 'radial-gradient(ellipse 140% 80% at 50% 110%, rgba(255,120,50,0.10) 0%, rgba(200,80,140,0.07) 35%, transparent 65%)',
    topGlow: 'radial-gradient(ellipse, rgba(30,70,180,0.18) 0%, transparent 70%)', stars: 0.6,
  },
};

const TABS = [
  { label: '2시간 차트',    short: '차트',   Icon: BarChart2 },
  { label: '지금 뜨는 태그', short: '태그',   Icon: Hash      },
  { label: '크리에이터 순위', short: '순위',   Icon: Trophy    },
  { label: '즐겨찾기',      short: '즐찾기', Icon: Star      },
  { label: '인사이트',      short: '인사이트', Icon: Zap, mobileOnly: true },
];

function ServerStatusBadge({ status }) {
  const color = status === 'ok' ? '#6CD97E' : status === 'warning' ? '#FBBF24' : status === 'checking' ? 'rgba(255,255,255,0.3)' : '#F87171';
  const label = status === 'ok' ? 'ZETA 서버 정상' : status === 'warning' ? 'ZETA 서버 불안정' : status === 'checking' ? 'ZETA 서버 확인 중' : 'ZETA 서버 이상';
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-medium text-white/50">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  );
}

function DataCollectionButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-[11px] font-medium text-white/70"
    >
      <Database size={11} className="text-blue-400" />
      <span className="hidden sm:inline">데이터 수집</span>
    </button>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { status: serverStatus } = useServerStatus();
  const [timeSegment] = useState(getTimeSegment);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [hasAgreedToWarning, setHasAgreedToWarning] = useState(
    () => localStorage.getItem('ego-bloom-warning-agreed') === 'true'
  );
  const [activeTab, setActiveTab] = useState(0);
  const [rankingData, setRankingData] = useState(null);

  const bg = TIME_BG[timeSegment];

  // 라우트 전환 중에도 body 배경이 유지되도록 선(先)적용 — 밝기 깜빡임 방지
  useLayoutEffect(() => {
    document.body.style.background = bg.base;
    return () => { document.body.style.background = ''; };
  }, [bg.base]);

  useEffect(() => {
    fetch('/data/ranking_latest.json')
      .then(r => r.json())
      .then(setRankingData)
      .catch(() => {});
  }, []);

  const SearchWithLock = ({ compact = false }) => (
    <div className="relative">
      <SearchPill suggestionsAbove={false} />
      {!hasAgreedToWarning && (
        <div
          onClick={() => setShowWarningModal(true)}
          className={`absolute inset-0 bg-[#0F0A1A]/60 backdrop-blur-[4px] rounded-full flex items-center justify-center cursor-pointer border border-orange-500/30 hover:bg-[#0F0A1A]/40 transition-all`}
        >
          <div className={`flex items-center gap-2 text-orange-400 font-bold ${compact ? 'text-xs' : 'text-sm'}`}>
            <Lock size={compact ? 13 : 16} />
            {!compact && <span>검색 가이드라인에 동의가 필요합니다</span>}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-dvh relative flex flex-col" style={{ background: bg.base }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: bg.horizon }} />
      <div className="absolute inset-x-0 top-0 h-64 pointer-events-none" style={{ background: bg.topGlow }} />
      <StarField globalOpacity={bg.stars} />

      <div className="relative z-10 flex flex-col min-h-dvh">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          {/* Left: logo + (PC) data btn + server status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setShowChangelogModal(true)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
                <path d="M8 12 L12 8 L16 12 L12 16 Z" fill="rgba(129,140,248,0.8)" />
              </svg>
              <h1 className="font-medium text-[18px] tracking-[-0.02em] text-white">EGO-BLOOM</h1>
            </div>
            {/* PC-only: data btn + server status */}
            <div className="hidden lg:flex items-center gap-2">
              <DataCollectionButton onClick={() => setShowDataModal(true)} />
              <ServerStatusBadge status={serverStatus} />
            </div>
          </div>

          {/* Right: mobile = status+openworld+data btn; PC = openworld btn + search bar */}
          <div className="flex items-center gap-2">
            {/* Mobile: status + openworld + data btn */}
            <div className="flex lg:hidden items-center gap-2">
              <ServerStatusBadge status={serverStatus} />
              <button
                onClick={() => navigate('/world')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-colors text-[11px] font-semibold"
                style={{ background: 'rgba(99,102,241,0.15)', borderColor: 'rgba(99,102,241,0.4)', color: 'rgba(165,180,252,0.9)' }}
              >
                오픈월드<span className="text-[9px] opacity-70">베타</span>
              </button>
              <DataCollectionButton onClick={() => setShowDataModal(true)} />
            </div>
            {/* PC: openworld btn + search bar in header */}
            <div className="hidden lg:flex items-center gap-2">
              <button
                onClick={() => navigate('/world')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all duration-200 text-[12px] font-semibold hover:brightness-110"
                style={{ background: 'rgba(99,102,241,0.15)', borderColor: 'rgba(99,102,241,0.4)', color: 'rgba(165,180,252,0.9)' }}
              >
                오픈월드 <span className="text-[10px] opacity-60">(베타)</span> 입장
              </button>
              <div className="w-72">
                <SearchWithLock compact />
              </div>
            </div>
          </div>
        </header>

        {/* Ticker */}
        <AnnouncementTicker />

        {/* Content */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 px-4 pt-4 pb-8 max-w-7xl w-full mx-auto">
          {/* Left column: main content */}
          <div className="flex flex-col gap-4 flex-1 min-w-0">
            {/* Mobile-only search */}
            <div className="lg:hidden">
              <SearchWithLock />
            </div>

            {/* Tag Trend Strip */}
            <TagTrendStrip tagTrend={rankingData?.tagTrend || {}} combined={rankingData?.combined || []} tagScores={rankingData?.tagScores ?? null} tagScoresDelta={rankingData?.tagScoresDelta ?? null} tagScoresDeltaRef={rankingData?.tagScoresDeltaRef ?? null} />

            {/* Main Tabs */}
            <div className="flex flex-col flex-1">
              <div className="flex border-b border-white/10 mb-4">
                {TABS.map(({ label, short, Icon, mobileOnly }, i) => (
                  <button
                    key={label}
                    onClick={() => setActiveTab(i)}
                    className={[
                      mobileOnly ? 'flex lg:hidden' : 'flex',
                      'flex-1 lg:flex-none flex-col lg:flex-row',
                      'items-center gap-1 lg:gap-1.5',
                      'px-1 lg:px-3 py-2 lg:py-2.5',
                      'font-medium transition-colors border-b-2 -mb-px',
                      activeTab === i
                        ? 'text-indigo-300 border-indigo-500'
                        : 'text-white/40 border-transparent hover:text-white/70',
                    ].join(' ')}
                  >
                    <Icon size={15} className="shrink-0 lg:w-[14px] lg:h-[14px]" />
                    {/* 모바일: short 레이블 */}
                    <span className="text-[11px] lg:hidden leading-none">{short}</span>
                    {/* PC: 전체 레이블 */}
                    <span className="hidden lg:inline text-[13px]">{label}</span>
                  </button>
                ))}
              </div>

              {activeTab === 0 && <PlotRankingList rankingData={rankingData} />}
              {activeTab === 1 && <TagTrendingList combined={rankingData?.combined || []} interaction={rankingData?.interaction || []} />}
              {activeTab === 2 && <CreatorRankingList />}
              {activeTab === 3 && <FavoritesPanel />}
              {/* 인사이트 탭: 모바일 전용 (PC는 사이드바로 표시) */}
              {activeTab === 4 && (
                <div className="lg:hidden">
                  <RankingTimeline rankingData={rankingData} />
                </div>
              )}
            </div>
          </div>

          {/* Right column: PC-only timeline */}
          <div className="hidden lg:flex flex-col lg:w-80 xl:w-[352px] shrink-0">
            <div className="sticky top-4 bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 max-h-[calc(100vh-80px)] overflow-y-auto flex flex-col scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
              <RankingTimeline rankingData={rankingData} />
            </div>
          </div>
        </div>
      </div>

      <ChangelogModal isOpen={showChangelogModal} onClose={() => setShowChangelogModal(false)} />
      <DataCollectionModal isOpen={showDataModal} onClose={() => setShowDataModal(false)} />
      <SearchWarningModal
        isOpen={showWarningModal}
        onClose={() => {
          setHasAgreedToWarning(localStorage.getItem('ego-bloom-warning-agreed') === 'true');
          setShowWarningModal(false);
        }}
      />
      <EmergencyToast />
    </div>
  );
}
