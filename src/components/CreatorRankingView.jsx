import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Loader2, Users, MessageCircle, Crown, X, Info, Mail, ChevronRight, Search, TrendingUp, FlaskConical } from 'lucide-react';
import { formatNumber, getCreatorTier } from '../utils/tierCalculator';
import { proxyImageUrl } from '../utils/imageUtils';
import TierIcon from './ui/TierIcon';

// ── 전체 랭킹 렌더러 ─────────────────────────────────────────
function GlobalRankingList({ paginatedRankings, currentPage, ITEMS_PER_PAGE, navigate }) {
  const goTo = useCallback((creator) => () => navigate(buildProfileUrl(creator)), [navigate]);

  if (currentPage === 1 && paginatedRankings.length > 0) {
    const [first, second, third, ...rest] = paginatedRankings;
    return (
      <div className="flex flex-col pb-8">
        <div className="flex flex-col gap-3 mb-3 stagger-2">
          {first && (
            <RankHeroCard
              creator={first}
              rank={1}
              tierData={getCreatorTier(first.elo_score ?? 0)}
              onClick={goTo(first)}
            />
          )}
          {second && (
            <RankHeroCard
              creator={second}
              rank={2}
              tierData={getCreatorTier(second.elo_score ?? 0)}
              onClick={goTo(second)}
            />
          )}
          {third && (
            <RankHeroCard
              creator={third}
              rank={3}
              tierData={getCreatorTier(third.elo_score ?? 0)}
              onClick={goTo(third)}
            />
          )}
        </div>
        {rest.length > 0 && (
          <div className="flex flex-col gap-2 mt-1">
            {rest.map((creator, i) => (
              <ListRankItem
                key={creator.id}
                creator={creator}
                index={i + 3}
                tierData={getCreatorTier(creator.elo_score ?? 0)}
                onClick={goTo(creator)}
                staggerClass={`stagger-${Math.min(6, i + 3)}`}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 pb-8">
      {paginatedRankings.map((creator, i) => (
        <ListRankItem
          key={creator.id}
          creator={creator}
          index={(currentPage - 1) * ITEMS_PER_PAGE + i}
          tierData={getCreatorTier(creator.elo_score ?? 0)}
          onClick={goTo(creator)}
          staggerClass={`stagger-${Math.min(6, i + 1)}`}
        />
      ))}
    </div>
  );
}

// 🚧 개발 중인 기능 — 사용자에게 노출할 준비가 되면 true로 변경
const SHOW_GROWTH_RANKING = false;

function buildProfileUrl(creator) {
  return `/profile?creator=${encodeURIComponent(creator.handle ? `@${creator.handle}` : creator.id)}`;
}

// _ 로 시작하면 첫 번째 비-underscore 글자 반환
function getInitial(nickname) {
  const str = nickname || '?';
  for (let i = 0; i < str.length; i++) {
    if (str[i] !== '_') return str[i];
  }
  return '?';
}

// ── 1~3위 히어로 카드 ──────────────────────────────────────────
function RankHeroCard({ creator, rank, tierData, onClick }) {
  const tierColor = tierData.color;
  const barColor = rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : '#CD7F32';
  return (
    <div
      onClick={onClick}
      className="relative w-full overflow-hidden cursor-pointer group animate-fade-in-up transition-colors duration-300"
      style={{ 
        background: '#0C1018', 
        border: `1px solid ${tierColor}20`, 
        borderRadius: '4px'
      }}
    >
      {/* 좌측 rank accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-[4px]" style={{ background: barColor, boxShadow: `0 0 15px ${barColor}80` }} />

      <div className="flex items-center gap-4 sm:gap-6 px-4 py-4 sm:px-6 sm:py-5 pl-5 sm:pl-8">
        {/* 랭킹 번호 */}
        <div
          className="w-6 sm:w-8 text-center font-sans font-bold shrink-0 tabular-nums flex items-center justify-center"
          style={{ fontSize: 'clamp(24px, 4vw, 36px)', color: barColor }}
        >
          {rank}
        </div>

        {/* 아바타 */}
        <div className="relative shrink-0">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full overflow-hidden"
            style={{ border: `2px solid ${tierColor}50` }}>
            {creator.profile_image_url ? (
              <img src={proxyImageUrl(creator.profile_image_url)}
                alt={creator.nickname} className="w-full h-full object-cover" crossOrigin="anonymous" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl font-black"
                style={{ background: '#1A1F2C', color: `${tierColor}80` }}>
                {getInitial(creator.nickname)}
              </div>
            )}
          </div>
        </div>

        {/* 이름 + 통계 */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-white text-[16px] sm:text-[22px] truncate tracking-tight">
              {creator.nickname}
            </span>
            {creator.handle && (
              <span className="text-[12px] text-white/30 truncate hidden sm:inline-block">@{creator.handle}</span>
            )}
          </div>
          <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-[11px] sm:text-[12px] text-white/45 font-medium">
            <div className="flex items-center gap-1.5" title="총 대화 수">
              <MessageCircle size={12} className="text-white/30" />
              <span>{formatNumber(creator.plot_interaction_count)}</span>
            </div>
            <div className="flex items-center gap-1.5" title="팔로워">
              <Users size={12} className="text-white/30" />
              <span>{formatNumber(creator.follower_count)}</span>
            </div>
            <span className="font-mono text-white/45">ELO <span className="text-white/75 font-bold">{formatNumber(creator.elo_score)}</span></span>
            {creator.rank_change === null ? (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/20">NEW</span>
            ) : creator.rank_change > 0 ? (
              <span className="text-emerald-400 font-bold">↑{creator.rank_change}</span>
            ) : creator.rank_change < 0 ? (
              <span className="text-red-400 font-bold">↓{Math.abs(creator.rank_change)}</span>
            ) : null}
          </div>
        </div>

        {/* 티어 아이콘 */}
        <div className="flex flex-col items-center gap-1 shrink-0 z-10 w-[64px] sm:w-[86px]">
          <div className="w-10 h-10 sm:w-14 sm:h-14 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <TierIcon tier={tierData.key} size="100%" rank={rank} />
          </div>
          <div className="text-[9px] sm:text-[11px] font-black uppercase tracking-wider text-center w-full"
            style={
              rank <= 10
                ? { color: '#FFF', textShadow: `0 0 8px rgba(255,255,255,0.6)` }
                : { color: tierData.color, textShadow: `0 0 12px ${tierData.color}66` }
            }>
            {rank <= 10 ? `TOP ${rank}` : `${tierData.name}${tierData.subdivision !== null ? ' ' + tierData.subdivision : ''}`}
          </div>
        </div>
      </div>
    </div>
  );
}



// ── 4위+ 리스트 아이템 ────────────────────────────────────────
function ListRankItem({ creator, index, tierData, onClick, staggerClass }) {
  const tierLabel = index + 1 <= 10
    ? `TOP ${index + 1}`
    : `${tierData.name}${tierData.subdivision !== null ? ' ' + tierData.subdivision : ''}`;
  const tierLabelStyle = index + 1 <= 10
    ? { color: '#FFF', textShadow: `0 0 8px rgba(255,255,255,0.6)` }
    : { color: tierData.color };

  return (
    <div
      onClick={onClick}
      className={`flex flex-col sm:flex-row sm:items-center gap-0 sm:gap-4 px-4 py-3.5 sm:py-4 transition-all cursor-pointer group relative overflow-hidden
        bg-white/[0.02] border border-white/[0.03] border-l-[3px] border-l-blue-500/50 hover:bg-white/[0.05] hover:border-white/[0.06] hover:border-l-blue-400/80 ${staggerClass || ''}`}
      style={{ borderRadius: '4px' }}
    >
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] text-white/25 font-medium
        opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none pr-[70px] md:pr-[86px]">
        프로필 보기 <ChevronRight size={11} />
      </div>

      {/* Row 1 (항상): 순위 + 닉네임 + [모바일 티어] + [데스크탑 티어] */}
      {/* sm:contents → 데스크탑에서 자식들이 부모 flex의 직접 항목이 됨 */}
      <div className="flex items-center gap-4 w-full sm:contents">
        <div className="w-8 sm:w-10 text-center text-[18px] sm:text-[20px] font-black text-white/30 group-hover:text-white/60 transition-colors tabular-nums shrink-0">
          {index + 1}
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5 z-10">
          <div className="flex items-center gap-2 mb-0.5 sm:mb-1">
            <span className="truncate tracking-tight font-bold text-[16px] sm:text-[18px] text-white/90">
              {creator.nickname}
            </span>
            {creator.handle && (
              <span className="text-xs text-white/30 truncate hidden sm:inline-block">@{creator.handle}</span>
            )}
          </div>
          {/* 데스크탑 전용 스탯 */}
          <div className="hidden sm:flex items-center flex-wrap gap-x-3 gap-y-1 text-[13px] text-white/40 font-medium tracking-wide">
            <div className="flex items-center gap-1.5" title="총 대화 수">
              <MessageCircle size={12} className="text-white/30" />
              <span>{formatNumber(creator.plot_interaction_count)}</span>
            </div>
            <div className="flex items-center gap-1.5" title="팔로워">
              <Users size={12} className="text-white/30" />
              <span>{formatNumber(creator.follower_count)}</span>
            </div>
            <span className="font-mono text-white/30">ELO <span className="font-bold text-white/50">{formatNumber(creator.elo_score)}</span></span>
            {creator.rank_change === null ? (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/20">NEW</span>
            ) : creator.rank_change > 0 ? (
              <span className="text-emerald-400 font-bold">↑{creator.rank_change}</span>
            ) : creator.rank_change < 0 ? (
              <span className="text-red-400 font-bold">↓{Math.abs(creator.rank_change)}</span>
            ) : (
              <span className="text-white/20">—</span>
            )}
          </div>
        </div>

        {/* 모바일 전용 컴팩트 티어 (sm:hidden) */}
        <div className="sm:hidden flex flex-col items-center gap-0.5 shrink-0 w-14 z-10">
          <div className="w-9 h-9 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <TierIcon tier={tierData.key} size="100%" rank={index + 1} />
          </div>
          <div className="text-[9px] font-black uppercase tracking-wider text-center w-full" style={tierLabelStyle}>
            {tierLabel}
          </div>
        </div>

        {/* 데스크탑 전용 티어 블록 (hidden sm:flex) */}
        <div className="hidden sm:flex flex-col items-center gap-1 shrink-0 z-10 w-[64px] md:w-[80px]">
          <div className="w-10 h-10 md:w-14 md:h-14 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <TierIcon tier={tierData.key} size="100%" rank={index + 1} />
          </div>
          <div className="text-[10px] md:text-[11px] font-black uppercase tracking-wider text-center w-full" style={tierLabelStyle}>
            {tierLabel}
          </div>
        </div>
      </div>

      {/* Row 2 (모바일 < sm 전용): 스탯 */}
      {/* pl-12 = rank(w-8=32px) + gap-4(16px) = 48px */}
      <div className="sm:hidden flex items-center gap-x-3 text-[12px] text-white/40 font-medium tracking-wide mt-1.5 pl-12">
        <div className="flex items-center gap-1.5" title="총 대화 수">
          <MessageCircle size={11} className="text-white/30" />
          <span>{formatNumber(creator.plot_interaction_count)}</span>
        </div>
        <div className="flex items-center gap-1.5" title="팔로워">
          <Users size={11} className="text-white/30" />
          <span>{formatNumber(creator.follower_count)}</span>
        </div>
      </div>
    </div>
  );
}

export default function CreatorRankingView() {
  const navigate = useNavigate();
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showInfoModal, setShowInfoModal] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // 성장 랭킹 탭
  const [rankTab, setRankTab] = useState('global'); // 'global' | 'growth'
  const [growthRankings, setGrowthRankings] = useState([]);
  const [growthLoading, setGrowthLoading] = useState(false);
  const [growthLoaded, setGrowthLoaded] = useState(false);
  const [growthError, setGrowthError] = useState(null);
  const [growthDataAvailable, setGrowthDataAvailable] = useState(true);

  const handleSearch = async (e) => {
    e.preventDefault();
    // @ 기호 모두 제거 후 앞뒤 공백 제거
    const q = searchQuery.toString().replace(/@/g, '').trim();
    if (!q || q.length < 2) {
      alert('검색어는 2자 이상 입력해주세요.');
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/search-rank?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '검색에 실패했습니다.');
      }
      const data = await res.json();
      setSearchResult(data);
    } catch (err) {
      alert(err.message);
      setSearchResult(null);
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/get-rankings')
      .then(res => {
        if (!res.ok) throw new Error('랭킹을 불러오는데 실패했습니다.');
        return res.json();
      })
      .then(data => {
        setRankings((data.rankings || []).slice(0, 50));
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // 성장 랭킹 — 탭 클릭 시 최초 1회만 로드
  useEffect(() => {
    if (rankTab !== 'growth' || growthLoaded) return;
    setGrowthLoading(true);
    fetch('/api/get-growth-ranking')
      .then(res => res.ok ? res.json() : Promise.reject('로드 실패'))
      .then(data => {
        setGrowthRankings(data.rankings || []);
        setGrowthDataAvailable(data.dataAvailable !== false);
        setGrowthLoaded(true);
        setGrowthLoading(false);
      })
      .catch(err => {
        setGrowthError(String(err));
        setGrowthLoading(false);
      });
  }, [rankTab, growthLoaded]);

  const paginatedRankings = rankings.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={32} className="animate-spin text-white/30" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 text-white/60 text-sm bg-black/20 rounded-3xl border border-white/5">
        {error}
      </div>
    );
  }

  if (rankings.length === 0) {
    return (
      <div className="text-center py-24 text-white/60 text-sm bg-black/20 rounded-3xl border border-white/5 shadow-inner">
        아직 수집된 랭킹 데이터가 없습니다.<br/>
        메인 화면에서 유저를 검색하여 랭킹에 등록해보세요!
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-8 animate-enter relative">
      {/* 헤더: 제목 + 탭 pill + 정보 버튼 */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          {/* 탭 pill 버튼 */}
          <div className="flex gap-1.5 bg-white/[0.04] rounded-full p-1 border border-white/[0.07]">
            <button
              onClick={() => setRankTab('global')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[12px] font-bold tracking-wide transition-all ${
                rankTab === 'global'
                  ? 'bg-white/[0.10] text-white border border-white/15'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              <Crown size={11} />
              <span>전체 랭킹</span>
            </button>
            {SHOW_GROWTH_RANKING && (
            <button
              onClick={() => setRankTab('growth')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold tracking-wide transition-all ${
                rankTab === 'growth'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              <TrendingUp size={11} />
              <span>성장 랭킹</span>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">β</span>
            </button>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowInfoModal(true)}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-300/80 hover:text-blue-200 transition-all px-3 py-1.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 hover:border-blue-400/40 tracking-wide"
        >
          <Info size={14} />
          <span className="hidden sm:inline">랭킹에 관하여 / 노출 금지 신청</span>
          <span className="sm:hidden">정보</span>
        </button>
      </div>

      {rankTab === 'global' && (
      <form onSubmit={handleSearch} className="flex gap-2 mb-4 px-1">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-white/30" />
          </div>
          <input
            type="text"
            placeholder="닉네임 또는 @핸들 검색..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-[13px] text-white focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.08] transition-all placeholder:text-white/30"
          />
        </div>
        <button
          type="submit"
          disabled={searchLoading}
          className="bg-white/[0.07] hover:bg-white/[0.12] border border-white/15 text-white/75 hover:text-white px-5 py-2.5 rounded-sm text-[13px] font-bold transition-all disabled:opacity-50 flex items-center justify-center min-w-[72px]"
        >
          {searchLoading ? <Loader2 size={16} className="animate-spin" /> : '검색'}
        </button>
      </form>
      )}

      {/* 랭킹 정보 모달 — createPortal로 viewport 기준 고정 */}
      {showInfoModal && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowInfoModal(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-sm bg-[#0A0612] border border-white/10 rounded-2xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.6)] animate-slide-up sm:animate-di-expand"
            onClick={e => e.stopPropagation()}
          >
            {/* 상단 컬러 바 */}
            <div className="h-[3px] bg-gradient-to-r from-blue-500 to-indigo-500" />

            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Info size={15} className="text-blue-400" />
                <span className="text-white font-bold text-[14px]">랭킹에 관하여 / 노출 금지 신청</span>
              </div>
              <button onClick={() => setShowInfoModal(false)} className="text-white/30 hover:text-white/80 transition-colors p-1">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-5">
              {/* 수집 원리 */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span className="text-white font-semibold text-[13px]">랭킹이 수집되는 원리</span>
                </div>
                <p className="text-white/55 text-[12px] leading-relaxed pl-3.5">
                  자동 수집이 <span className="text-white/80 font-medium">아닙니다.</span> 누군가가 메인 화면 검색창에서 해당 크리에이터를 검색할 때만 통계가 수집되어 랭킹에 등록됩니다. 등록된 이후에는 매일 자정(KST) 자동으로 갱신됩니다.
                </p>
              </div>

              <div className="h-px bg-white/[0.06]" />

              {/* 노출 금지 신청 */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  <span className="text-white font-semibold text-[13px]">노출 금지 신청</span>
                </div>
                <p className="text-white/55 text-[12px] leading-relaxed pl-3.5 mb-2">
                  랭킹 노출을 원하지 않으시면 아래 방법으로 신청해 주세요. 확인 후 즉시 삭제 처리됩니다.
                </p>
                <a
                  href="mailto:irisout_@outlook.kr"
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] transition-all group"
                >
                  <div className="flex items-center gap-2.5">
                    <Mail size={14} className="text-white/60 group-hover:text-white transition-colors" />
                    <div>
                      <div className="text-white/80 text-[12px] font-medium group-hover:text-white transition-colors">이메일</div>
                      <div className="text-white/35 text-[10px]">irisout_@outlook.kr</div>
                    </div>
                  </div>
                  <ChevronRight size={13} className="text-white/25 group-hover:text-white/60 transition-colors" />
                </a>
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ===== 성장 랭킹 탭 ===== */}
      {SHOW_GROWTH_RANKING && rankTab === 'growth' && (
        <div className="flex flex-col gap-3 pb-8">
          {/* 베타 배너 */}
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
            <FlaskConical size={15} className="text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[12px] font-bold text-emerald-300">성장 랭킹 베타</p>
              <p className="text-[11px] text-emerald-200/60 mt-0.5 leading-relaxed">
                최근 3일간 ELO 상승폭 기준 · 상대 평가 티어 부여 · 데이터 누적에 따라 결과가 달라질 수 있습니다
              </p>
            </div>
          </div>

          {growthLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="animate-spin text-white/30" />
            </div>
          )}

          {!growthLoading && growthError && (
            <div className="text-center py-16 text-white/50 text-sm">{growthError}</div>
          )}

          {!growthLoading && !growthError && !growthDataAvailable && (
            <div className="text-center py-16 text-white/40 text-sm">
              <TrendingUp size={32} className="mx-auto mb-3 opacity-30" />
              아직 성장 데이터가 충분하지 않습니다.<br />
              <span className="text-[11px]">최소 2일 이상의 데이터가 필요합니다.</span>
            </div>
          )}

          {!growthLoading && !growthError && growthRankings.length === 0 && growthDataAvailable && (
            <div className="text-center py-16 text-white/40 text-sm">
              이번 주 성장 데이터가 없습니다.
            </div>
          )}

          {/* 3일 전 대비 헤더 */}
          {!growthLoading && !growthError && growthRankings.length > 0 && (
            <div className="flex items-center justify-between px-1 py-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08]">
                  <TrendingUp size={12} className="text-emerald-400" />
                  <span className="text-[12px] font-black text-white/70 tracking-wide">3일 전 대비 성장</span>
                </div>
              </div>
              <span className="text-[11px] text-white/30">TOP {growthRankings.length}</span>
            </div>
          )}

          {!growthLoading && growthRankings.map((creator) => {
            const RANK_BADGE = [
              { bg: 'from-yellow-400/25 to-amber-500/15', border: 'border-yellow-400/50', textColor: '#FDE68A', glow: 'rgba(250,204,21,0.5)' },
              { bg: 'from-gray-200/20 to-slate-400/15',   border: 'border-gray-300/45',   textColor: '#E2E8F0', glow: 'rgba(209,213,219,0.4)' },
              { bg: 'from-amber-500/20 to-orange-600/15', border: 'border-amber-500/45',  textColor: '#FCA244', glow: 'rgba(217,119,6,0.4)' },
              { bg: 'from-violet-500/18 to-purple-600/12',border: 'border-violet-400/40', textColor: '#C4B5FD', glow: 'rgba(139,92,246,0.3)' },
              { bg: 'from-violet-500/18 to-purple-600/12',border: 'border-violet-400/40', textColor: '#C4B5FD', glow: 'rgba(139,92,246,0.3)' },
              { bg: 'from-blue-500/18 to-indigo-600/12',  border: 'border-blue-400/40',   textColor: '#93C5FD', glow: 'rgba(59,130,246,0.28)' },
              { bg: 'from-blue-500/18 to-indigo-600/12',  border: 'border-blue-400/40',   textColor: '#93C5FD', glow: 'rgba(59,130,246,0.28)' },
              { bg: 'from-teal-500/15 to-cyan-600/10',    border: 'border-teal-400/35',   textColor: '#5EEAD4', glow: 'rgba(20,184,166,0.22)' },
              { bg: 'from-teal-500/15 to-cyan-600/10',    border: 'border-teal-400/35',   textColor: '#5EEAD4', glow: 'rgba(20,184,166,0.22)' },
              { bg: 'from-teal-500/15 to-cyan-600/10',    border: 'border-teal-400/35',   textColor: '#5EEAD4', glow: 'rgba(20,184,166,0.22)' },
            ];
            const badge = RANK_BADGE[Math.min((creator.growth_rank || 1) - 1, RANK_BADGE.length - 1)];
            return (
              <div
                key={creator.id}
                onClick={() => navigate(`/profile?creator=${encodeURIComponent(creator.handle ? `@${creator.handle}` : creator.id)}`)}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all cursor-pointer group relative overflow-hidden bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] hover:border-white/10"
              >
                {/* 등수 (좌측, 작게) */}
                <div className="w-5 text-center text-sm font-bold shrink-0 text-white/20">
                  {creator.growth_rank}
                </div>

                {/* 유저 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-[15px] text-white/90 truncate">{creator.nickname}</span>
                    {creator.handle && (
                      <span className="text-[11px] text-white/35 truncate hidden sm:inline">@{creator.handle}</span>
                    )}
                  </div>
                  {(() => {
                    const chatDelta = (creator.plot_interaction_count || 0) - (creator.plot_interaction_oldest || 0);
                    const followerDelta = (creator.follower_count || 0) - (creator.follower_count_oldest || 0);
                    const deltaClass = (d) => d > 0 ? 'text-emerald-400' : d < 0 ? 'text-red-400' : 'text-white/30';
                    const deltaStr = (d) => (d > 0 ? '+' : '') + formatNumber(d);
                    return (
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-medium mt-0.5">
                        <div className="flex items-center gap-1">
                          <MessageCircle size={10} className="text-white/30 shrink-0" />
                          <span className={`font-bold ${deltaClass(chatDelta)}`}>{deltaStr(chatDelta)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users size={10} className="text-white/30 shrink-0" />
                          <span className={`font-bold ${deltaClass(followerDelta)}`}>{deltaStr(followerDelta)}</span>
                        </div>
                        <span className="text-white/20 font-mono text-[10px]">ELO {formatNumber(creator.elo_score)}</span>
                      </div>
                    );
                  })()}
                </div>

                {/* 글로우 랜크 배지 */}
                <div className="flex flex-col items-center gap-0.5 shrink-0">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center bg-gradient-to-br ${badge.bg} border ${badge.border} transition-transform duration-300 group-hover:scale-105`}
                    style={{ boxShadow: `0 0 18px ${badge.glow}, inset 0 1px 0 rgba(255,255,255,0.08)` }}
                  >
                    <span
                      className="text-[18px] font-black leading-none"
                      style={{ color: badge.textColor, textShadow: `0 0 12px ${badge.glow}` }}
                    >
                      {creator.growth_rank}
                    </span>
                  </div>
                  <span className="text-[8px] text-white/20 font-bold tracking-widest">RANK</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* ===== 전체 랭킹 탭 ===== */}
      {rankTab === 'global' && (
        <GlobalRankingList
          paginatedRankings={paginatedRankings}
          currentPage={currentPage}
          ITEMS_PER_PAGE={ITEMS_PER_PAGE}
          navigate={navigate}
        />
      )}

      {/* 페이지네이션 (전체 랭킹 탭에서만) */}
      {rankTab === 'global' && (
      <div className="flex items-center justify-center gap-2 mb-20 px-1">
        {[1, 2, 3, 4, 5].map(num => (
          <button
            key={num}
            onClick={() => {
              setCurrentPage(num);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`w-10 h-10 font-bold transition-all border ${
              currentPage === num
                ? 'bg-[#4A7FFF] border-[#4A7FFF] text-white'
                : 'bg-white/[0.03] border-white/[0.06] text-white/30 hover:bg-white/[0.07] hover:text-white/60'
            }`}
            style={{ borderRadius: '3px' }}
          >
            {num}
          </button>
        ))}
      </div>)}

      {searchResult && searchResult.user && createPortal(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-48px)] max-w-[632px] z-[9999] animate-slide-up">
          <div className="relative bg-[#080F24] border border-blue-500/40 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_20px_rgba(74,127,255,0.2)]">
            <button 
              onClick={() => setSearchResult(null)}
              className="absolute -top-2 -right-2 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-blue-500 transition-colors z-10"
            >
              <X size={14} />
            </button>

            <div className="text-[11px] font-bold text-blue-300 mb-2 px-1 flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
              검색된 크리에이터 (내 랭킹)
            </div>

            <div
              onClick={() => {
                navigate(`/profile?creator=${encodeURIComponent(searchResult.user?.handle ? `@${searchResult.user.handle}` : searchResult.user?.id)}`);
                setSearchResult(null);
              }}
              className="flex items-center gap-4 px-4 py-3 rounded-xl transition-all cursor-pointer bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-white/20 group"
            >
              <div className="w-10 text-center text-2xl text-blue-300 font-bold group-hover:text-blue-200 transition-colors">
                {searchResult.rank}
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-center z-10">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-base text-white/90 truncate tracking-tight">
                    {searchResult.user?.nickname}
                  </span>
                  {searchResult.user?.handle && (
                    <span className="text-xs text-white/40 truncate hidden sm:inline-block">@{searchResult.user.handle}</span>
                  )}
                </div>

                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 md:gap-x-4 text-[10px] md:text-[11px] text-white/50 font-medium tracking-wide">
                  <div className="flex items-center gap-1.5">
                    <MessageCircle size={12} className="text-white/30" />
                    <span>{formatNumber(searchResult.user?.plot_interaction_count)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users size={12} className="text-white/30" />
                    <span>{formatNumber(searchResult.user?.follower_count)}</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono">
                    <span className="text-white/25">ELO</span>
                    <span>{formatNumber(searchResult.user?.elo_score)}</span>
                    <span className="text-[10px] font-sans text-white/20">pt</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-0.5 shrink-0 z-10 w-[60px] md:w-[74px]">
                {(() => {
                  const tierData = getCreatorTier(searchResult.user?.elo_score ?? 0);
                  return (
                    <>
                      <div className="w-8 h-8 md:w-12 md:h-12 flex items-center justify-center filter drop-shadow-xl transform group-hover:scale-110 transition-transform duration-300">
                        <TierIcon tier={tierData.key} size="100%" rank={searchResult.rank} />
                      </div>
                      <div
                        className="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-center w-full"
                        style={
                          searchResult.rank <= 10
                            ? { color: '#FFF', textShadow: `0 0 8px rgba(255,255,255,0.6)` }
                            : { color: tierData.color, textShadow: `0 0 8px ${tierData.color}66` }
                        }
                      >
                        {searchResult.rank <= 10 ? `TOP ${searchResult.rank}` : `${tierData.name}${tierData.subdivision !== null ? ' ' + tierData.subdivision : ''}`}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
