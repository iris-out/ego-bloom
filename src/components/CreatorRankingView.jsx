import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Loader2, Users, MessageCircle, Crown, X, Info, Github, Mail, ChevronRight, Search } from 'lucide-react';
import { formatNumber, getCreatorTier } from '../utils/tierCalculator';
import TierIcon from './ui/TierIcon';

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
        setRankings((data.rankings || []).slice(0, 40));
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

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
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <Crown className="text-yellow-500" size={20} />
          <h2 className="text-lg font-bold text-white tracking-wide">글로벌 크리에이터 랭킹 TOP 40</h2>
        </div>
        <button
          onClick={() => setShowInfoModal(true)}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-300/80 hover:text-purple-200 transition-all px-3 py-1.5 rounded-full bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/25 hover:border-purple-400/40 tracking-wide"
        >
          <Info size={14} />
          <span>랭킹에 관하여 / 노출 금지 신청</span>
        </button>
      </div>

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
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-[13px] text-white focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.08] transition-all placeholder:text-white/30"
          />
        </div>
        <button
          type="submit"
          disabled={searchLoading}
          className="bg-purple-600/90 hover:bg-purple-500 text-white px-5 py-2.5 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50 flex items-center justify-center min-w-[72px]"
        >
          {searchLoading ? <Loader2 size={16} className="animate-spin" /> : '검색'}
        </button>
      </form>

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
            <div className="h-[3px] bg-gradient-to-r from-purple-500 to-indigo-500" />

            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Info size={15} className="text-purple-400" />
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
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
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

      <div className="flex flex-col gap-3 pb-8">
        {paginatedRankings.map((creator, i) => {
            const index = (currentPage - 1) * ITEMS_PER_PAGE + i;
            const isTop3 = index < 3;
            const rankColors = [
              'text-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.6)] font-black',
              'text-gray-300 drop-shadow-[0_0_10px_rgba(209,213,219,0.5)] font-black',
              'text-amber-600 drop-shadow-[0_0_10px_rgba(217,119,6,0.5)] font-black',
            ];

            const tierData = getCreatorTier(creator.elo_score ?? 0);
            const subdivisionLabel = tierData.subdivision !== null ? ` ${tierData.subdivision}` : '';

            return (
              <div
                key={creator.id}
                onClick={() => navigate(`/profile?creator=${encodeURIComponent(creator.handle ? `@${creator.handle}` : creator.id)}`)}
                className={`flex items-center gap-4 px-4 py-3 rounded-2xl transition-all cursor-pointer group relative overflow-hidden
                  ${isTop3 ? 'bg-gradient-to-r from-white/[0.08] to-transparent border border-white/10 hover:border-white/20'
                           : 'bg-white/[0.02] border border-white/[0.02] hover:bg-white/[0.05] hover:border-white/10'}`}
              >
                {/* hover 힌트 */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] text-white/30 font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none pr-[70px] md:pr-[86px]">
                  프로필 보기 <ChevronRight size={11} />
                </div>
                {/* 1등 배경 하이라이트 효과 */}
                {index === 0 && (
                  <div className="absolute top-0 left-0 w-[150px] h-full bg-gradient-to-r from-yellow-500/10 to-transparent pointer-events-none" />
                )}

                {/* 등수 */}
                <div className={`w-10 text-center text-2xl ${isTop3 ? rankColors[index] : 'text-white/30 font-bold group-hover:text-white/50 transition-colors'}`}>
                  {index + 1}
                </div>

                {/* 유저 정보 */}
                <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5 z-10">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`truncate tracking-tight ${isTop3 ? 'font-black text-lg text-white' : 'font-bold text-base text-white/90'}`}>
                      {creator.nickname}
                    </span>
                    {creator.handle && (
                      <span className="text-xs text-white/40 truncate hidden sm:inline-block">@{creator.handle}</span>
                    )}
                  </div>
                  
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1 md:gap-x-4 text-[10px] md:text-[11px] text-white/50 font-medium tracking-wide">
                    <div className="flex items-center gap-1.5" title="총 대화 수">
                      <MessageCircle size={12} className={isTop3 ? 'text-white/60' : 'text-white/30'} />
                      <span>{formatNumber(creator.plot_interaction_count)}</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="팔로워">
                      <Users size={12} className={isTop3 ? 'text-white/60' : 'text-white/30'} />
                      <span>{formatNumber(creator.follower_count)}</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono" title="ELO 점수">
                      <span className={isTop3 ? 'text-white/50' : 'text-white/25'}>ELO</span>
                      <span>{formatNumber(creator.elo_score)}</span>
                      <span className={`text-[10px] font-sans ${isTop3 ? 'text-white/30' : 'text-white/20'}`}>pt</span>
                    </div>
                    {/* 순위 변동 */}
                    {creator.rank_change === null ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/20">NEW</span>
                    ) : creator.rank_change > 0 ? (
                      <span className="text-emerald-400 font-bold">↑{creator.rank_change}</span>
                    ) : creator.rank_change < 0 ? (
                      <span className="text-red-400 font-bold">↓{Math.abs(creator.rank_change)}</span>
                    ) : (
                      <span className="text-white/25">—</span>
                    )}
                  </div>
                </div>

                {/* 우측: 티어 아이콘 + 티어 텍스트 */}
                <div className="flex flex-col items-center gap-0.5 shrink-0 z-10 w-[60px] md:w-[74px]">
                  <div className="w-8 h-8 md:w-12 md:h-12 flex items-center justify-center filter drop-shadow-xl transform group-hover:scale-110 transition-transform duration-300">
                    <TierIcon tier={tierData.key} size="100%" />
                  </div>
                  <div
                    className="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-center w-full"
                    style={{ color: tierData.color, textShadow: `0 0 8px ${tierData.color}66` }}
                  >
                    {tierData.name}{subdivisionLabel}
                  </div>
                </div>
              </div>
            );
        })}
      </div>

      {/* 페이지네이션 */}
      <div className="flex items-center justify-center gap-2 mb-20 px-1">
        {[1, 2, 3, 4].map(num => (
          <button
            key={num}
            onClick={() => {
              setCurrentPage(num);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`w-10 h-10 rounded-xl font-bold transition-all border ${
              currentPage === num
                ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/20'
                : 'bg-white/[0.04] border-white/5 text-white/30 hover:bg-white/[0.08] hover:text-white/60'
            }`}
          >
            {num}
          </button>
        ))}
      </div>

      {searchResult && searchResult.user && createPortal(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-48px)] max-w-[632px] z-[9999] animate-slide-up">
          <div className="relative bg-[#1A0D30] border border-purple-500/40 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5),0_0_20px_rgba(139,92,246,0.2)]">
            <button 
              onClick={() => setSearchResult(null)}
              className="absolute -top-2 -right-2 w-7 h-7 bg-purple-600 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-purple-500 transition-colors z-10"
            >
              <X size={14} />
            </button>

            <div className="text-[11px] font-bold text-purple-300 mb-2 px-1 flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-purple-400 animate-pulse" />
              검색된 크리에이터 (내 랭킹)
            </div>

            <div
              onClick={() => {
                navigate(`/profile?creator=${encodeURIComponent(searchResult.user?.handle ? `@${searchResult.user.handle}` : searchResult.user?.id)}`);
                setSearchResult(null);
              }}
              className="flex items-center gap-4 px-4 py-3 rounded-xl transition-all cursor-pointer bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] hover:border-white/20 group"
            >
              <div className="w-10 text-center text-2xl text-purple-300 font-bold group-hover:text-purple-200 transition-colors">
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
                  const subdivisionLabel = tierData.subdivision !== null ? ` ${tierData.subdivision}` : '';
                  return (
                    <>
                      <div className="w-8 h-8 md:w-12 md:h-12 flex items-center justify-center filter drop-shadow-xl transform group-hover:scale-110 transition-transform duration-300">
                        <TierIcon tier={tierData.key} size="100%" />
                      </div>
                      <div
                        className="text-[9px] md:text-[10px] font-black uppercase tracking-wider text-center w-full"
                        style={{ color: tierData.color, textShadow: `0 0 8px ${tierData.color}66` }}
                      >
                        {tierData.name}{subdivisionLabel}
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
