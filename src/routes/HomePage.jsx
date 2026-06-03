import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Lock, BarChart2, Hash, Trophy, Star, History, Clapperboard, Bell, Globe, Menu, Megaphone, Download } from 'lucide-react';
import { useServerStatus } from '../hooks/useServerStatus';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { triggerInstall } from '../lib/pwaInstall';
import ChangelogModal from '../components/ChangelogModal';
import DataCollectionModal from '../components/DataCollectionModal';
import SearchWarningModal from '../components/SearchWarningModal';
import EmergencyToast from '../components/EmergencyToast';
import ServerAlertCard from '../components/ServerAlertCard';
import SearchPill from '../components/SearchPill';
import TagTrendCards from '../components/home/TagTrendCards';
import MainHall from '../components/home/MainHall';
import PlotRankingList from '../components/home/PlotRankingList';
import CreatorRankingList from '../components/home/CreatorRankingList';
import FavoritesPanel from '../components/home/FavoritesPanel';

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
    base: 'linear-gradient(to bottom, #02050F 0%, #040C1C 22%, #071028 45%, #090E26 68%, #080A18 100%)',
    horizon: 'radial-gradient(ellipse 130% 80% at 50% 115%, rgba(220,110,50,0.07) 0%, rgba(160,70,120,0.05) 40%, transparent 70%)',
    topGlow: 'radial-gradient(ellipse, rgba(35,80,200,0.20) 0%, transparent 70%)', stars: 1,
  },
  dawn: {
    base: 'linear-gradient(to bottom, #040C17 0%, #071026 22%, #091530 45%, #081126 68%, #040B15 100%)',
    horizon: 'radial-gradient(ellipse 120% 70% at 50% 115%, rgba(130,190,255,0.09) 0%, rgba(80,130,220,0.05) 40%, transparent 70%)',
    topGlow: 'radial-gradient(ellipse, rgba(20,60,180,0.15) 0%, transparent 70%)', stars: 0.3,
  },
  day: {
    base: 'linear-gradient(to bottom, #050C18 0%, #071122 30%, #09142B 60%, #081121 100%)',
    horizon: 'radial-gradient(ellipse 100% 60% at 50% 120%, rgba(100,160,255,0.06) 0%, transparent 60%)',
    topGlow: 'radial-gradient(ellipse, rgba(20,50,150,0.12) 0%, transparent 70%)', stars: 0,
  },
  evening: {
    base: 'linear-gradient(to bottom, #030712 0%, #050C1C 22%, #081027 45%, #090F22 68%, #050913 100%)',
    horizon: 'radial-gradient(ellipse 140% 80% at 50% 110%, rgba(255,120,50,0.10) 0%, rgba(200,80,140,0.07) 35%, transparent 65%)',
    topGlow: 'radial-gradient(ellipse, rgba(30,70,180,0.18) 0%, transparent 70%)', stars: 0.6,
  },
};

const TABS = [
  { label: '메인',        short: '메인',   Icon: Clapperboard },
  { label: 'TOP 100',     short: 'TOP',    Icon: BarChart2 },
  { label: '제작자 순위',  short: '순위',   Icon: Trophy    },
  { label: '인기 태그',   short: '태그',   Icon: Hash      },
  { label: '즐겨찾기',    short: '즐겨찾기', Icon: Star, pcIconOnly: true },
];

const FAVORITES_TAB = TABS.findIndex(t => t.label === '즐겨찾기');

const SERVER_DOT = {
  ok: '#6CD97E', warning: '#FBBF24', checking: 'rgba(255,255,255,0.3)', error: '#F87171',
};
const SERVER_LABEL = {
  ok: '제타 서버 정상', warning: '제타 서버 불안정', checking: '제타 서버 확인 중', error: '제타 서버 이상',
};

// 공지 배너 — AnnouncementTicker와 동일 소스(세션 캐시 공유)
function useBanners() {
  const [banners, setBanners] = useState([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const cached = sessionStorage.getItem('zeta_banners_v1');
        if (cached) {
          const { data, ts } = JSON.parse(cached);
          if (Date.now() - ts < 3600000 && Array.isArray(data)) {
            if (alive) setBanners(data.filter(b => b.titlePrimary));
            return;
          }
        }
        const res = await fetch('/api/zeta/banners');
        if (!res.ok) return;
        const json = await res.json();
        const list = json.banners || [];
        try { sessionStorage.setItem('zeta_banners_v1', JSON.stringify({ data: list, ts: Date.now() })); } catch {}
        if (alive) setBanners(list.filter(b => b.titlePrimary));
      } catch {}
    })();
    return () => { alive = false; };
  }, []);
  return banners;
}

function bannerUrl(banner) {
  if (!banner.clickAction) return null;
  if (banner.clickAction.type === 'externalLink') return banner.clickAction.url;
  if (banner.clickAction.href) {
    const raw = banner.clickAction.href;
    const local = raw.startsWith('/ko') ? raw : `/ko${raw}`;
    return `https://zeta-ai.io${local}`;
  }
  return null;
}

// 헤더용 아이콘 버튼 — 동그란 글래스 버튼
function IconButton({ Icon, label, onClick, badge, active = false }) {
  return (
    <button
      type="button" onClick={onClick} title={label} aria-label={label}
      aria-pressed={active}
      className={[
        'relative w-9 h-9 rounded-full flex items-center justify-center transition-colors',
        active ? 'text-amber-300 bg-white/10' : 'text-white/75 hover:text-white hover:bg-white/10',
      ].join(' ')}
    >
      <Icon size={17} fill={active ? 'currentColor' : 'none'} />
      {badge && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: '#7AA3FF' }} />}
    </button>
  );
}

// 클릭-바깥-닫힘 팝오버
function Popover({ open, onClose, align = 'right', children }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      ref={ref}
      className={`absolute top-full mt-2 z-50 ${align === 'right' ? 'right-0' : 'left-0'} w-72 rounded-xl border border-white/12 bg-[#0b1018]/95 backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.55)] overflow-hidden`}
    >
      {children}
    </div>
  );
}

function MenuRow({ Icon, label, tag, onClick }) {
  return (
    <button
      type="button" onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-white/[0.06] transition-colors text-white/85"
    >
      <Icon size={15} className="text-white/60 shrink-0" />
      <span className="text-[13px] font-medium">{label}</span>
      {tag && <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(99,102,241,0.2)', color: 'rgba(165,180,252,0.95)' }}>{tag}</span>}
    </button>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { status: serverStatus, message: serverMessage } = useServerStatus();
  const [timeSegment] = useState(getTimeSegment);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [hasAgreedToWarning, setHasAgreedToWarning] = useState(
    () => localStorage.getItem('ego-bloom-warning-agreed') === 'true'
  );
  const [activeTab, setActiveTab] = useState(0);
  const [focusTag, setFocusTag] = useState(null);
  const [rankingData, setRankingData] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { canInstall: canInstallApp, installed: isInstalled } = usePwaInstall();
  const banners = useBanners();

  const handleInstallApp = async () => {
    setMenuOpen(false);
    const success = await triggerInstall();
    if (!success && !canInstallApp) {
      alert('이 브라우저에서는 바로 설치가 지원되지 않습니다.\n\nSafari의 경우: 하단 [공유] 버튼 -> [홈 화면에 추가]\nChrome(모바일)의 경우: 우상단 메뉴 -> [앱 설치] 또는 [홈 화면에 추가]를 눌러주세요.');
    }
  };

  const isMain = activeTab === 0;

  // 인기 태그 카드 클릭 → 메인 탭의 해당 태그 레일로 점프
  const handleTagJump = (familyKey) => {
    setFocusTag(familyKey);
    setActiveTab(0);
  };

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

  // 스크롤 시 오버레이 내비가 솔리드로 — Netflix식
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const SearchWithLock = ({ compact = false, suggestionsAbove = false }) => (
    <div className="relative">
      <SearchPill suggestionsAbove={suggestionsAbove} />
      {!hasAgreedToWarning && (
        <div
          onClick={() => setShowWarningModal(true)}
          className={`absolute inset-0 bg-[#0F0A1A]/60 backdrop-blur-[4px] rounded-full flex items-center justify-center cursor-pointer border border-indigo-400/30 hover:bg-[#0F0A1A]/40 transition-all`}
        >
          <div className={`flex items-center gap-2 text-indigo-300 font-bold ${compact ? 'text-xs' : 'text-sm'}`}>
            <Lock size={compact ? 13 : 16} />
            {!compact && <span>검색 가이드라인에 동의가 필요합니다</span>}
          </div>
        </div>
      )}
    </div>
  );

  // 공지 드롭다운 내용
  const BellPanel = (
    <Popover open={bellOpen} onClose={() => setBellOpen(false)} align="right">
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-white/8 text-white/80">
        <Megaphone size={14} className="text-indigo-400" />
        <span className="text-[13px] font-bold">공지</span>
      </div>
      <div className="max-h-80 overflow-y-auto py-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
        {banners.length === 0 ? (
          <div className="px-3.5 py-6 text-center text-[12px] text-white/40">새 공지가 없습니다.</div>
        ) : banners.map((b, i) => {
          const url = bannerUrl(b);
          const inner = (
            <div className="px-3.5 py-2.5 hover:bg-white/[0.06] transition-colors">
              <div className="text-[13px] font-medium text-white/90 leading-snug">{b.titlePrimary}</div>
              {b.titleSecondary && <div className="text-[11px] text-white/45 mt-0.5 leading-snug">{b.titleSecondary}</div>}
            </div>
          );
          return url ? (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer" onClick={() => setBellOpen(false)}>{inner}</a>
          ) : <div key={i}>{inner}</div>;
        })}
      </div>
    </Popover>
  );

  // 모바일 더보기 메뉴(부가기능)
  const MobileMenuPanel = (
    <Popover open={menuOpen} onClose={() => setMenuOpen(false)} align="right">
      <div className="py-1">
        {!isInstalled && (
          <MenuRow Icon={Download} label="앱으로 설치" tag="앱" onClick={handleInstallApp} />
        )}
        <MenuRow Icon={Globe} label="오픈월드 입장" tag="베타" onClick={() => { setMenuOpen(false); navigate('/world'); }} />
        <MenuRow Icon={History} label="업데이트 로그" onClick={() => { setMenuOpen(false); setShowChangelogModal(true); }} />
        <MenuRow Icon={Database} label="데이터 수집 안내" onClick={() => { setMenuOpen(false); setShowDataModal(true); }} />
        <div className="flex items-center gap-2 px-3.5 py-2.5 border-t border-white/8 text-[12px] text-white/55">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: SERVER_DOT[serverStatus] }} />
          {SERVER_LABEL[serverStatus]}
        </div>
      </div>
    </Popover>
  );

  return (
    <div className="min-h-dvh relative flex flex-col" style={{ background: bg.base }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: bg.horizon }} />
      <div className="absolute inset-x-0 top-0 h-64 pointer-events-none" style={{ background: bg.topGlow }} />
      <StarField globalOpacity={bg.stars} />

      <div className="relative z-10 flex flex-col min-h-dvh">
        {/* 서버 불안정/이상 알림 — 헤더 위 정상 흐름 */}
        {(serverStatus === 'warning' || serverStatus === 'error') && (
          <ServerAlertCard status={serverStatus} message={serverMessage} />
        )}

        {/* 본문 영역 — 오버레이 헤더의 포지셔닝 컨텍스트 */}
        <div className="relative flex-1">
          {/* ===== Cinematic Overlay 헤더 (히어로 위에 얹힘, 고정) ===== */}
          <header
            className="fixed inset-x-0 z-30 transition-colors duration-300"
            style={scrolled
              ? { top: 'var(--pwa-banner-h, 0px)', background: 'rgba(6,9,16,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }
              : { top: 'var(--pwa-banner-h, 0px)', background: 'linear-gradient(to bottom, rgba(3,5,12,0.82) 0%, rgba(3,5,12,0.40) 55%, transparent 100%)' }
            }
          >
            <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-5">
              {/* 로고 */}
              <div className="flex items-center gap-2 cursor-pointer select-none shrink-0" onClick={() => navigate('/')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
                  <path d="M8 12 L12 8 L16 12 L12 16 Z" fill="rgba(122,163,255,0.9)" />
                </svg>
                <h1 className="font-bold text-[18px] tracking-[-0.02em] text-white whitespace-nowrap">EGO-BLOOM</h1>
              </div>

              {/* PC 인라인 탭 내비 */}
              <nav className="hidden lg:flex items-center gap-5 ml-1">
                {TABS.map(({ label, pcIconOnly }, i) => (
                  pcIconOnly ? null : (
                    <button
                      key={label}
                      onClick={() => setActiveTab(i)}
                      className="text-[13.5px] font-medium transition-colors"
                      style={{ color: activeTab === i ? '#fff' : 'rgba(255,255,255,0.58)' }}
                    >
                      {label}
                    </button>
                  )
                ))}
              </nav>

              {/* 우측 클러스터 */}
              <div className="ml-auto flex items-center gap-1.5">
                {/* PC: 검색 + 부가 아이콘 */}
                <div className="hidden lg:block w-56">
                  <SearchWithLock compact />
                </div>
                <div className="hidden lg:flex items-center gap-0.5">
                  <IconButton Icon={Star} label="즐겨찾기" active={activeTab === FAVORITES_TAB} onClick={() => setActiveTab(FAVORITES_TAB)} />
                  <IconButton Icon={Globe} label="오픈월드(베타) 입장" onClick={() => navigate('/world')} />
                  <IconButton Icon={History} label="업데이트 로그" onClick={() => setShowChangelogModal(true)} />
                  <IconButton Icon={Database} label="데이터 수집 안내" onClick={() => setShowDataModal(true)} />
                </div>
                {/* 공지 벨 (전 뷰) */}
                <div className="relative">
                  <IconButton Icon={Bell} label="공지" onClick={() => setBellOpen(v => !v)} badge={banners.length > 0} />
                  {BellPanel}
                </div>
                {/* 서버 상태 — 점 + 텍스트 항상 표시 (PC) */}
                <span
                  className="hidden lg:flex items-center gap-1.5 ml-1.5 mr-0.5 text-[12px] font-medium text-white/70 whitespace-nowrap"
                  aria-label={SERVER_LABEL[serverStatus]}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: SERVER_DOT[serverStatus] }} />
                  {SERVER_LABEL[serverStatus]}
                </span>
                {/* 모바일 더보기 메뉴 */}
                <div className="relative lg:hidden">
                  <IconButton Icon={Menu} label="메뉴" onClick={() => setMenuOpen(v => !v)} />
                  {MobileMenuPanel}
                </div>
              </div>
            </div>
          </header>

          {/* ===== 콘텐츠 ===== */}
          <div
            className={[
              'flex-1 flex flex-col lg:flex-row gap-4 lg:gap-0 px-4 max-w-7xl w-full mx-auto',
              // 모바일: 하단 플로팅 바(검색+탭) 공간 확보. 데스크탑: 일반 여백
              'pb-[150px] lg:pb-8',
              // 메인 탭: 히어로가 헤더 아래로 풀블리드(데스크탑만). 모바일은 겹침 방지를 위해 헤더 높이만큼 패딩
              isMain ? 'pt-14 lg:pt-0' : 'pt-14 lg:pt-[72px]',
            ].join(' ')}
          >
            {/* Left column: main content */}
            <div className="flex flex-col gap-5 flex-1 min-w-0">
              <div className="flex flex-col flex-1">
                {activeTab === 0 && <MainHall rankingData={rankingData} focusTag={focusTag} />}
                {activeTab === 1 && <PlotRankingList rankingData={rankingData} />}
                {activeTab === 2 && <CreatorRankingList />}
                {activeTab === 3 && <TagTrendCards tagScores={rankingData?.tagScores ?? null} tagScoresDelta={rankingData?.tagScoresDelta ?? null} tagTrend={rankingData?.tagTrend ?? null} onTagClick={handleTagJump} />}
                {activeTab === 4 && <FavoritesPanel />}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 모바일 하단 플로팅 바 — 검색(iOS 26 Safari 스타일) + 탭 ===== */}
      <div
        className="lg:hidden fixed inset-x-0 bottom-0 z-40 px-3 pt-10 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(4,7,14,0.95) 38%, rgba(4,7,14,0.6) 70%, transparent 100%)' }}
      >
        <div className="pointer-events-auto mx-auto max-w-md flex flex-col gap-2">
          {/* 플로팅 검색 — 제안은 위로 펼침 */}
          <SearchWithLock suggestionsAbove />

          {/* 탭 바 */}
          <nav className="flex items-stretch rounded-2xl border border-white/12 bg-[#0b1018]/85 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] px-1 py-1">
            {TABS.map(({ short, Icon }, i) => {
              const active = activeTab === i;
              return (
                <button
                  key={short}
                  type="button"
                  onClick={() => setActiveTab(i)}
                  aria-current={active}
                  className={[
                    'flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition-colors',
                    active ? 'text-indigo-300 bg-white/[0.07]' : 'text-white/45 hover:text-white/75',
                  ].join(' ')}
                >
                  <Icon size={18} className="shrink-0" fill={active && i === FAVORITES_TAB ? 'currentColor' : 'none'} />
                  <span className="text-[10px] font-semibold leading-none">{short}</span>
                </button>
              );
            })}
          </nav>
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
