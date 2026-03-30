import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Loader2, Users, MessageCircle, Crown, Search, X, Info, Github, Mail, ChevronRight } from 'lucide-react';
import { formatNumber, getCreatorTier } from '../utils/tierCalculator';
import TierIcon from './ui/TierIcon';

export default function CreatorRankingView() {
  const navigate = useNavigate();
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    fetch('/api/get-rankings')
      .then(res => {
        if (!res.ok) throw new Error('랭킹을 불러오는데 실패했습니다.');
        return res.json();
      })
      .then(data => {
        setRankings((data.rankings || []).slice(0, 30));
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setSearchLoading(true);
    setSearchError(null);
    setSearchResult(null);
    
    try {
      const res = await fetch(`/api/search-rank?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();
      
      if (!res.ok || data.error) {
        throw new Error(data.error || '검색에 실패했습니다.');
      }
      
      setSearchResult({ user: data.user, rank: data.rank });
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setSearchLoading(false);
    }
  };

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
          <h2 className="text-lg font-bold text-white tracking-wide">글로벌 크리에이터 랭킹 TOP 30</h2>
        </div>
        <button
          onClick={() => setShowInfoModal(true)}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-300/80 hover:text-purple-200 transition-all px-3 py-1.5 rounded-full bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/25 hover:border-purple-400/40 tracking-wide"
        >
          <Info size={14} />
          <span>랭킹에 관하여 / 노출 금지 신청</span>
        </button>
      </div>

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
                  href="https://github.com/iris-out/ego-bloom/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] transition-all group"
                >
                  <div className="flex items-center gap-2.5">
                    <Github size={14} className="text-white/60 group-hover:text-white transition-colors" />
                    <div>
                      <div className="text-white/80 text-[12px] font-medium group-hover:text-white transition-colors">GitHub Issues</div>
                      <div className="text-white/35 text-[10px]">github.com/iris-out/ego-bloom</div>
                    </div>
                  </div>
                  <ChevronRight size={13} className="text-white/25 group-hover:text-white/60 transition-colors" />
                </a>
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

      <form onSubmit={handleSearch} className="mb-2 relative group px-1">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Search size={16} className="text-white/40 group-focus-within:text-white/80 transition-colors" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="닉네임 또는 핸들 검색 (@handle)"
          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-10 text-sm focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all text-white placeholder-white/30"
        />
        {searchQuery && (
          <button 
            type="button" 
            onClick={() => {
              setSearchQuery('');
              setSearchResult(null);
              setSearchError(null);
            }} 
            className="absolute inset-y-0 right-4 flex items-center justify-center w-8 h-full text-white/40 hover:text-white/80 transition-colors"
          >
            <X size={16} />
          </button>
        )}
        <button type="submit" className="hidden" />
      </form>

      <div className="flex flex-col gap-3 pb-24">
        {rankings.map((creator, index) => {
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
                className={`flex items-center gap-4 p-4 rounded-2xl transition-all cursor-pointer group relative overflow-hidden
                  ${isTop3 ? 'bg-gradient-to-r from-white/[0.08] to-transparent border border-white/10 hover:border-white/20' 
                           : 'bg-white/[0.02] border border-white/[0.02] hover:bg-white/[0.05] hover:border-white/10'}`}
              >
                {/* 1등 배경 하이라이트 효과 */}
                {index === 0 && (
                  <div className="absolute top-0 left-0 w-[150px] h-full bg-gradient-to-r from-yellow-500/10 to-transparent pointer-events-none" />
                )}

                {/* 등수 */}
                <div className={`w-10 text-center text-2xl ${isTop3 ? rankColors[index] : 'text-white/30 font-bold group-hover:text-white/50 transition-colors'}`}>
                  {index + 1}
                </div>

                {/* 유저 정보 */}
                <div className="flex-1 min-w-0 flex flex-col justify-center py-1 z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`truncate tracking-tight ${isTop3 ? 'font-black text-lg text-white' : 'font-bold text-base text-white/90'}`}>
                      {creator.nickname}
                    </span>
                    {creator.handle && (
                      <span className="text-xs text-white/40 truncate hidden sm:inline-block">@{creator.handle}</span>
                    )}
                  </div>
                  
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1 md:gap-x-4 text-[11px] text-white/50 font-medium tracking-wide">
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
                  </div>
                </div>

                {/* 우측: 티어 아이콘 + 티어 텍스트 */}
                <div className="flex flex-col items-center gap-0.5 shrink-0 z-10 w-[60px] md:w-[74px]">
                  <div className="w-10 h-10 md:w-[54px] md:h-[54px] flex items-center justify-center filter drop-shadow-xl transform group-hover:scale-110 transition-transform duration-300">
                    <TierIcon tier={tierData.key} size="100%" />
                  </div>
                  <div
                    className="text-[10px] md:text-[11px] font-black uppercase tracking-wider text-center w-full"
                    style={{ color: tierData.color, textShadow: `0 0 8px ${tierData.color}66` }}
                  >
                    {tierData.name}{subdivisionLabel}
                  </div>
                </div>
              </div>
            );
        })}
      </div>

      {/* 검색 결과 — createPortal로 viewport 기준 고정 */}
      {(searchResult || searchLoading || searchError) && createPortal(
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/95 backdrop-blur-2xl border-t border-white/10 z-[9998] animate-slide-up shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            {searchLoading ? (
              <div className="flex items-center gap-3 text-white/60 py-2">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">검색 중...</span>
              </div>
            ) : searchError ? (
              <div className="flex items-center gap-3 text-red-400 py-2">
                <span className="text-sm font-medium">{searchError}</span>
              </div>
            ) : searchResult && (
              <div 
                onClick={() => navigate(`/profile?creator=${encodeURIComponent(searchResult.user.handle ? `@${searchResult.user.handle}` : searchResult.user.id)}`)}
                className="w-full flex items-center gap-4 bg-white/5 hover:bg-white/10 p-3 rounded-xl border border-white/10 cursor-pointer transition-all"
              >
                {/* 등수 */}
                <div className="min-w-[40px] text-center font-black text-xl text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]">
                  {searchResult.rank}
                </div>

                {/* 정보 */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-base text-white truncate">
                      {searchResult.user.nickname}
                    </span>
                    {searchResult.user.handle && (
                      <span className="text-xs text-white/50 truncate">@{searchResult.user.handle}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-white/50">
                    <span className="flex items-center gap-1"><MessageCircle size={10} />{formatNumber(searchResult.user.plot_interaction_count)}</span>
                    <span className="flex items-center gap-1"><Users size={10} />{formatNumber(searchResult.user.follower_count)}</span>
                  </div>
                </div>

                {/* 티어 */}
                {(() => {
                  const tierData = getCreatorTier(searchResult.user.elo_score ?? 0);
                  return (
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-[12px] font-black uppercase" style={{ color: tierData.color }}>
                          {tierData.name}{tierData.subdivision ? ` ${tierData.subdivision}` : ''}
                        </div>
                        <div className="text-[10px] text-white/50 font-mono">
                          {formatNumber(searchResult.user.elo_score)} pt
                        </div>
                      </div>
                      <div className="w-10 h-10 flex items-center justify-center">
                        <TierIcon tier={tierData.key} size="100%" />
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            
            {(searchError || searchResult) && (
              <button 
                onClick={() => {
                  setSearchResult(null);
                  setSearchError(null);
                  setSearchQuery('');
                }}
                className="ml-4 p-2 text-white/40 hover:text-white/80 hover:bg-white/5 rounded-full transition-all shrink-0"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
