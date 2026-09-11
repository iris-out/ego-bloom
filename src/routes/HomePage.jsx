import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database, Lock, BarChart2, Hash, Trophy, Star, History, Clapperboard,
  Bell, Globe, Menu as MenuIcon, Megaphone, Download, Search,
} from 'lucide-react';
import { useServerStatus } from '../hooks/useServerStatus';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { useRankingData } from '../hooks/useRankingData';
import { triggerInstall } from '../lib/pwaInstall';
import ChangelogModal from '../components/ChangelogModal';
import DataCollectionModal from '../components/DataCollectionModal';
import SearchWarningModal from '../components/SearchWarningModal';
import ServerAlertCard from '../components/ServerAlertCard';
import SearchPill from '../components/SearchPill';
import ThemeToggle from '../components/ui/ThemeToggle';
import Segmented from '../components/ui/Segmented';
import Modal from '../components/ui/Modal';
import TagTrendCards from '../components/home/TagTrendCards';
import MainHall from '../components/home/MainHall';
import PlotRankingList from '../components/home/PlotRankingList';
import CreatorRankingList from '../components/home/CreatorRankingList';
import FavoritesPanel from '../components/home/FavoritesPanel';

const TABS = [
  { label: '메인', short: '메인', Icon: Clapperboard },
  { label: 'TOP 100', short: 'TOP', Icon: BarChart2 },
  { label: '제작자 랭킹', short: '랭킹', Icon: Trophy },
  { label: '인기 태그', short: '태그', Icon: Hash },
  { label: '즐겨찾기', short: '즐겨찾기', Icon: Star },
  { label: '오픈월드', short: '월드', Icon: Globe, href: '/world' },
];

const SERVER_DOT = {
  ok: 'var(--up)', warning: 'var(--warn)', checking: 'var(--fg-3)', error: 'var(--down)',
};
const SERVER_LABEL = {
  ok: '제타 서버 정상', warning: '제타 서버 불안정', checking: '제타 서버 확인 중', error: '제타 서버 이상',
};

// titlePrimary 가 공백 문자뿐인 배너가 섞여 오는 경우가 있다(서버 데이터 이슈) -
// 그대로 렌더하면 목록 위에 빈 줄만 차지하는 항목이 생기므로 trim 해서 걸러낸다.
function hasBannerTitle(b) {
  return typeof b.titlePrimary === 'string' && b.titlePrimary.trim().length > 0;
}

// 공지 배너 - AnnouncementTicker 와 동일 소스(세션 캐시 공유)
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
            if (alive) setBanners(data.filter(hasBannerTitle));
            return;
          }
        }
        const res = await fetch('/api/zeta/banners');
        if (!res.ok) return;
        const json = await res.json();
        const list = json.banners || [];
        try { sessionStorage.setItem('zeta_banners_v1', JSON.stringify({ data: list, ts: Date.now() })); } catch { /* noop */ }
        if (alive) setBanners(list.filter(hasBannerTitle));
      } catch { /* noop */ }
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

/**
 * 검색 필드다. 검색 가이드라인에 동의하기 전에는 필드 대신 동의 버튼을 보여준다.
 * HomePage 렌더 도중 선언하면 매 렌더마다 리마운트되므로 모듈 스코프로 뺐다.
 * @param {object} props
 * @param {boolean} props.hasAgreed
 * @param {() => void} props.onRequestAgreement
 * @param {boolean} [props.suggestionsAbove]
 * @param {string} [props.className]
 */
function SearchField({ hasAgreed, onRequestAgreement, suggestionsAbove = false, className = '' }) {
  if (!hasAgreed) {
    return (
      <button
        type="button"
        onClick={onRequestAgreement}
        className={`eb-btn eb-btn-secondary w-full ${className}`}
      >
        <Lock size={14} strokeWidth={2} />
        검색 가이드라인에 동의하기
      </button>
    );
  }
  return <SearchPill suggestionsAbove={suggestionsAbove} className={className} />;
}

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
      className={`absolute top-full mt-2 z-50 ${align === 'right' ? 'right-0' : 'left-0'} w-72 overflow-hidden`}
      style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-m)', boxShadow: 'var(--shadow-overlay)' }}
    >
      {children}
    </div>
  );
}

function MenuRow(props) {
  const { Icon, label, tag, onClick } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left"
    >
      <Icon size={15} strokeWidth={2} className="shrink-0" style={{ color: 'var(--fg-3)' }} />
      <span className="t-ui">{label}</span>
      {tag && (
        <span className="ml-auto t-label px-1.5 h-4 flex items-center" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)', borderRadius: 'var(--radius-s)' }}>
          {tag}
        </span>
      )}
    </button>
  );
}

function BellList({ banners, onNavigate }) {
  if (banners.length === 0) {
    return <div className="px-3.5 py-6 text-center t-small" style={{ color: 'var(--fg-3)' }}>새 공지가 없습니다.</div>;
  }
  return (
    <div className="max-h-80 overflow-y-auto py-1">
      {banners.map((b, i) => {
        const url = bannerUrl(b);
        const inner = (
          <div className="px-3.5 py-2.5">
            <div className="t-small" style={{ color: 'var(--fg)' }}>{b.titlePrimary}</div>
            {b.titleSecondary && <div className="t-small mt-0.5" style={{ color: 'var(--fg-3)' }}>{b.titleSecondary}</div>}
          </div>
        );
        return url ? (
          <a key={i} href={url} target="_blank" rel="noopener noreferrer" onClick={onNavigate}>{inner}</a>
        ) : <div key={i}>{inner}</div>;
      })}
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { status: serverStatus, message: serverMessage } = useServerStatus();
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [hasAgreedToWarning, setHasAgreedToWarning] = useState(
    () => localStorage.getItem('ego-bloom-warning-agreed') === 'true',
  );
  const [activeTab, setActiveTab] = useState(0);
  const [focusTag, setFocusTag] = useState(null);
  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const { canInstall: canInstallApp, installed: isInstalled } = usePwaInstall();
  const { data: rankingData } = useRankingData();
  const banners = useBanners();

  const handleInstallApp = async () => {
    setMenuOpen(false);
    const success = await triggerInstall();
    if (!success && !canInstallApp) {
      alert('이 브라우저에서는 바로 설치가 지원되지 않습니다.\n\nSafari의 경우: 하단 [공유] 버튼 -> [홈 화면에 추가]\nChrome(모바일)의 경우: 우상단 메뉴 -> [앱 설치] 또는 [홈 화면에 추가]를 눌러주세요.');
    }
  };

  // 인기 태그 카드 클릭 -> 메인 탭의 해당 태그 레일로 점프
  const handleTagJump = (familyKey) => {
    setFocusTag(familyKey);
    setActiveTab(0);
  };

  const openWarningModal = () => setShowWarningModal(true);

  const closeWarningModal = () => {
    setHasAgreedToWarning(localStorage.getItem('ego-bloom-warning-agreed') === 'true');
    setShowWarningModal(false);
  };

  return (
    <div className="min-h-dvh flex flex-col">
      {(serverStatus === 'warning' || serverStatus === 'error') && (
        <ServerAlertCard status={serverStatus} message={serverMessage} />
      )}

      {/* ===== 헤더: 56 고정, sticky, 하단 1px 라인 ===== */}
      <header
        className="sticky z-30"
        style={{ top: 'var(--pwa-banner-h, 0px)', height: 56, background: 'var(--bg)', borderBottom: '1px solid var(--line)' }}
      >
        <div className="max-w-7xl mx-auto h-full px-4 flex items-center gap-5">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="shrink-0"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em', color: 'var(--fg)' }}
          >
            EGO-BLOOM
          </button>

          {/* 데스크톱: 필 탭 내비 */}
          <nav className="hidden sm:block min-w-0 overflow-x-auto shrink">
            <Segmented
              options={TABS.map((t, i) => ({ value: i, label: t.label }))}
              value={activeTab}
              onChange={(v) => TABS[v].href ? navigate(TABS[v].href) : setActiveTab(v)}
              aria-label="메인 내비게이션"
            />
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {/* 데스크톱: 검색 필드 220 */}
            <div className="hidden xl:block" style={{ width: 220 }}>
              <SearchField hasAgreed={hasAgreedToWarning} onRequestAgreement={openWarningModal} />
            </div>

            {/* 공지 벨 - 데스크톱 전용, 모바일은 메뉴 시트에 접힌다 */}
            <div className="hidden sm:block relative">
              <button type="button" className="eb-btn-icon relative" onClick={() => setBellOpen((v) => !v)} aria-label="공지">
                <Bell size={17} strokeWidth={2} />
                {banners.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 rounded-full" style={{ width: 6, height: 6, background: 'var(--accent-ink)' }} />
                )}
              </button>
              <Popover open={bellOpen} onClose={() => setBellOpen(false)}>
                <div className="flex items-center gap-2 px-3.5 py-2.5" style={{ borderBottom: '1px solid var(--line)' }}>
                  <Megaphone size={14} strokeWidth={2} style={{ color: 'var(--accent-ink)' }} />
                  <span className="t-ui">공지</span>
                </div>
                <BellList banners={banners} onNavigate={() => setBellOpen(false)} />
              </Popover>
            </div>

            {/* 서버 상태 - 점 + 라벨, 데스크톱만 텍스트 노출 */}
            <span className="hidden sm:flex items-center gap-1.5 t-small" style={{ color: 'var(--fg-2)' }} aria-label={SERVER_LABEL[serverStatus]}>
              <span className="rounded-full shrink-0" style={{ width: 8, height: 8, background: SERVER_DOT[serverStatus] }} />
              {SERVER_LABEL[serverStatus]}
            </span>

            <ThemeToggle className="hidden sm:inline-flex" />

            {/* 모바일: 검색 아이콘 */}
            <button type="button" className="eb-btn-icon sm:hidden" onClick={() => setMobileSearchOpen(true)} aria-label="검색">
              <Search size={17} strokeWidth={2} />
            </button>

            {/* 메뉴: 데스크톱은 다이얼로그, 640 미만은 하단 시트(Modal 이 알아서 전환) */}
            <button type="button" className="eb-btn-icon" onClick={() => setMenuOpen(true)} aria-label="메뉴">
              <MenuIcon size={17} strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      {/* ===== 콘텐츠 ===== */}
      <div className="flex-1 flex flex-col max-w-7xl w-full mx-auto px-4 py-5 pb-28 sm:pb-10">
        {activeTab === 0 && <MainHall rankingData={rankingData} focusTag={focusTag} />}
        {activeTab === 1 && <PlotRankingList rankingData={rankingData} />}
        {activeTab === 2 && <CreatorRankingList />}
        {activeTab === 3 && (
          <TagTrendCards
            tagScores={rankingData?.tagScores ?? null}
            tagScoresDelta={rankingData?.tagScoresDelta ?? null}
            tagTrend={rankingData?.tagTrend ?? null}
            onTagClick={handleTagJump}
          />
        )}
        {activeTab === 4 && <FavoritesPanel />}
      </div>

      {/* ===== 모바일 하단 내비: 64 + safe area ===== */}
      <nav
        className="sm:hidden fixed inset-x-0 bottom-0 z-40 flex items-stretch"
        style={{
          height: 64,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          background: 'var(--surface)',
          borderTop: '1px solid var(--line)',
        }}
      >
        {TABS.map((tab, i) => {
          const { short, Icon } = tab;
          const active = activeTab === i;
          return (
            <button
              key={short}
              type="button"
              onClick={() => tab.href ? navigate(tab.href) : setActiveTab(i)}
              aria-current={active}
              className="flex-1 flex flex-col items-center justify-center gap-1"
            >
              <span
                className="flex items-center justify-center"
                style={{ width: 44, height: 28, borderRadius: 'var(--radius-pill)', background: active ? 'var(--accent-soft)' : 'transparent' }}
              >
                <Icon size={22} strokeWidth={2} style={{ color: active ? 'var(--accent-ink)' : 'var(--fg-2)' }} />
              </span>
              <span className="t-label" style={{ fontSize: 10, color: active ? 'var(--accent-ink)' : 'var(--fg-3)' }}>{short}</span>
            </button>
          );
        })}
      </nav>

      {/* ===== 모바일 검색 시트 ===== */}
      <Modal open={mobileSearchOpen} onClose={() => setMobileSearchOpen(false)} title="검색">
        <SearchField
          hasAgreed={hasAgreedToWarning}
          onRequestAgreement={() => { setMobileSearchOpen(false); openWarningModal(); }}
          suggestionsAbove={false}
        />
      </Modal>

      {/* ===== 메뉴: 테마 토글 + PWA 설치 + 부가 메뉴 + 공지 ===== */}
      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title="메뉴">
        <div className="flex flex-col gap-4 -mt-2">
          <div className="flex items-center justify-between">
            <span className="t-small" style={{ color: 'var(--fg-2)' }} aria-label={SERVER_LABEL[serverStatus]}>
              <span className="rounded-full inline-block mr-1.5" style={{ width: 8, height: 8, background: SERVER_DOT[serverStatus] }} />
              {SERVER_LABEL[serverStatus]}
            </span>
            <ThemeToggle />
          </div>

          <div className="flex flex-col" style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-m)', overflow: 'hidden' }}>
            {!isInstalled && <MenuRow Icon={Download} label="앱으로 설치" tag="앱" onClick={handleInstallApp} />}
            <MenuRow Icon={Globe} label="오픈월드 입장" tag="베타" onClick={() => { setMenuOpen(false); navigate('/world'); }} />
            <MenuRow Icon={History} label="업데이트 로그" onClick={() => { setMenuOpen(false); setShowChangelogModal(true); }} />
            <MenuRow Icon={Database} label="데이터 수집 안내" onClick={() => { setMenuOpen(false); setShowDataModal(true); }} />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Megaphone size={14} strokeWidth={2} style={{ color: 'var(--accent-ink)' }} />
              <span className="t-ui">공지</span>
            </div>
            <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-m)', overflow: 'hidden' }}>
              <BellList banners={banners} onNavigate={() => setMenuOpen(false)} />
            </div>
          </div>
        </div>
      </Modal>

      <ChangelogModal isOpen={showChangelogModal} onClose={() => setShowChangelogModal(false)} />
      <DataCollectionModal isOpen={showDataModal} onClose={() => setShowDataModal(false)} />
      <SearchWarningModal isOpen={showWarningModal} onClose={closeWarningModal} />
    </div>
  );
}
