import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Loader2, Users, MessageCircle, Crown, X, Info, Github, Mail, ChevronRight } from 'lucide-react';
import { formatNumber, getCreatorTier } from '../utils/tierCalculator';
import TierIcon from './ui/TierIcon';

export default function CreatorRankingView() {
  const navigate = useNavigate();
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    fetch('/api/get-rankings')
      .then(res => {
        if (!res.ok) throw new Error('랭킹을 불러오는데 실패했습니다.');
        return res.json();
      })
      .then(data => {
        setRankings((data.rankings || []).slice(0, 5));
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

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
          <h2 className="text-lg font-bold text-white tracking-wide">글로벌 크리에이터 랭킹 TOP 5</h2>
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
    </div>
  );
}
