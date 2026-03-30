import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ChevronRight, Database } from 'lucide-react';
import { useServerStatus } from '../hooks/useServerStatus';
import ChangelogModal from '../components/ChangelogModal';
import DataCollectionModal from '../components/DataCollectionModal';
import ZetaBanners from '../components/ZetaBanners';
import MyProfileCard from '../components/MyProfileCard';
import SearchPill from '../components/SearchPill';
import { getRecentSearches, removeRecentSearch } from '../utils/storage';
import { APP_VERSION } from '../data/changelog';
import { getCreatorTier } from '../utils/tierCalculator';
import TierIcon from '../components/ui/TierIcon';

export default function HomePage() {
  const navigate = useNavigate();
  const [recentSearches, setRecentSearches] = useState([]);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);
  const [topTags, setTopTags] = useState([]);
  const [topCreators, setTopCreators] = useState([]);
  const { status: serverStatus } = useServerStatus();

  useEffect(() => { setRecentSearches(getRecentSearches()); }, []);

  // 첫 방문자에게 데이터 수집 안내 자동 표시
  useEffect(() => {
    const visited = localStorage.getItem('ego-bloom-visited');
    if (!visited) {
      setShowDataModal(true);
      localStorage.setItem('ego-bloom-visited', '1');
    }
  }, []);

  useEffect(() => {
    fetch('/data/ranking_latest.json')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.combined) setTopTags(d.combined.slice(0, 5)); })
      .catch(() => { });

    // 글로벌 랭킹 상위 5명 불러오기
    fetch('/api/get-rankings')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.rankings) setTopCreators(d.rankings.slice(0, 5)); })
      .catch(() => { });
  }, []);

  const handleDeleteRecent = (term, e) => {
    e.stopPropagation();
    setRecentSearches(removeRecentSearch(term));
  };

  return (
    <div className="min-h-[100dvh] flex flex-col relative overflow-hidden">
      {/* 배경 글로우 */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[rgba(121,155,196,0.15)] rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[60%] bg-[rgba(65,30,110,0.25)] rounded-full blur-[120px]" />
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex flex-col flex-1 px-6 pt-8 pb-[140px] lg:pb-16 relative z-10 max-w-[680px] mx-auto w-full lg:max-w-[1280px] lg:px-[10%]">
        {/* 헤더 */}
        <header className="flex justify-between items-center mb-8 animate-fade-in-up">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 24 24" className="w-5 h-6 stroke-white fill-none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17 L17 17 L15 22 L9 22 Z" />
              <line x1="6" y1="17" x2="18" y2="17" />
              <line x1="12" y1="17" x2="12" y2="11" />
              <path d="M12 6 Q10 2 12 1 Q14 2 12 6" />
              <path d="M12 6 Q17 4 18 6 Q17 8 12 6" />
              <path d="M12 6 Q14 10 12 11 Q10 10 12 6" />
              <path d="M12 6 Q7 8 6 6 Q7 4 12 6" />
              <circle cx="12" cy="6" r="1.2" />
            </svg>
            <h1 className="font-medium text-[22px] tracking-[-0.02em] text-white">EGO-BLOOM</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* 서버 상태 */}
            {(() => {
              const color = serverStatus === 'ok' ? '#6CD97E' : serverStatus === 'warning' ? '#FBBF24' : serverStatus === 'checking' ? 'rgba(255,255,255,0.3)' : '#F87171';
              const label = serverStatus === 'ok' ? 'ZETA 서버 정상' : serverStatus === 'warning' ? 'ZETA 서버 불안정' : serverStatus === 'checking' ? 'ZETA 서버 확인 중' : 'ZETA 서버 이상';
              return (
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-white/50 tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}88` }} />
                  <span className="hidden sm:inline">{label}</span>
                </div>
              );
            })()}
            <button
              onClick={() => setShowDataModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-[11px] font-medium text-white/70 tracking-wider"
            >
              <Database size={11} className="text-purple-400" />
              <span className="hidden sm:inline">데이터 수집</span>
            </button>
          </div>
        </header>

        {/* PC 검색바 (lg에서만 보임) */}
        <SearchPill className="hidden lg:block mb-10 animate-fade-in-up" style={{ animationDelay: '80ms' }} suggestionsAbove={false} />

        {/* 2열 그리드 (PC) / 단일 컬럼 (모바일) */}
        <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-12 lg:items-start flex-1">
          {/* 왼쪽: 히어로 + 소식 + 랭킹 + 트렌딩 + 최근 검색 */}
          <div className="min-w-0">
            {/* 히어로 */}
            <section className="mb-10 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
              <h2 className="font-display text-[56px] leading-[0.95] tracking-[-0.04em] font-normal text-white mb-4">
                Creator<br />
                <span className="font-serif-kr text-[42px] tracking-[-0.05em] block mt-1">에고 발사대</span>
              </h2>
              <p className="text-[14px] text-white/70 font-light leading-relaxed max-w-[80%]">
                당신의 에고를 발사하세요.<br />대화량, 티어, 그리고 업적으로.
              </p>
            </section>

            {/* Zeta 소식 & 공지사항 (히어로 아래) */}
            <div className="mb-10 animate-fade-in-up" style={{ animationDelay: '140ms' }}>
              <ZetaBanners />
            </div>

            {/* 글로벌 랭킹 (Top 5) */}
            <section className="mb-8 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              <div className="flex justify-between items-end mb-2 pb-2 border-b border-white/[0.06]">
                <span className="text-[12px] font-medium text-white/40 uppercase tracking-widest">Global Top Creators</span>
                <button onClick={() => navigate('/ranking')} className="text-[12px] text-white/70 hover:text-white transition-colors flex items-center gap-1">
                  전체 보기 <ChevronRight size={12} />
                </button>
              </div>
              <ul className="flex flex-col mt-3 gap-2">
                {topCreators.length > 0 ? topCreators.map((creator, i) => {
                  const isTop3 = i < 3;
                  const rankColors = ['text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]', 'text-gray-300 drop-shadow-[0_0_8px_rgba(209,213,219,0.5)]', 'text-amber-600 drop-shadow-[0_0_8px_rgba(217,119,6,0.5)]'];
                  return (
                    <li key={creator.id} onClick={() => navigate(`/?creator=${creator.handle || creator.id}`)}
                        className="flex items-center p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.08] cursor-pointer transition-all">
                      <span className={`font-display italic text-[20px] w-8 text-center mr-2 ${isTop3 ? rankColors[i] : 'text-white/40'}`}>{i + 1}</span>
                      <div className="flex-1 flex flex-col min-w-0">
                        <span className="text-[15px] font-bold text-white tracking-tight truncate">{creator.nickname}</span>
                        <span className="text-[11px] text-white/50 truncate font-mono tracking-wider">ELO {creator.elo_score?.toLocaleString()} pt</span>
                      </div>
                      {(() => {
                        const tierData = getCreatorTier(creator.elo_score ?? 0);
                        return (
                          <div className="flex flex-col items-center gap-0.5 ml-2 shrink-0">
                            <div className="w-9 h-9 flex items-center justify-center">
                              <TierIcon tier={tierData.key} size="100%" />
                            </div>
                            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: tierData.color }}>
                              {tierData.name}{tierData.subdivision ? ` ${tierData.subdivision}` : ''}
                            </span>
                          </div>
                        );
                      })()}
                    </li>
                  )
                }) : (
                  <div className="text-[13px] text-white/40 p-4 text-center bg-white/[0.02] rounded-xl border border-white/[0.05]">
                    아직 수집된 랭킹 데이터가 없습니다.
                  </div>
                )}
              </ul>
            </section>

            {/* 오픈월드 탐험하기 버튼 */}
            <div className="mb-12 animate-fade-in-up" style={{ animationDelay: '220ms' }}>
              <button
                onClick={() => navigate('/world')}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 hover:bg-purple-500/20 hover:border-purple-500/40 transition-all text-sm font-medium text-purple-200/80 hover:text-purple-100"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                오픈월드 탐험하기 (Beta)
              </button>
            </div>

            {/* 트렌딩 태그 */}
            <section className="mb-12 animate-fade-in-up" style={{ animationDelay: '240ms' }}>
              <div className="flex justify-between items-end mb-2 pb-2 border-b border-white/[0.06]">
                <span className="text-[12px] font-medium text-white/40 uppercase tracking-widest">Trending Tags</span>
              </div>
              <ul className="flex flex-col lg:grid lg:grid-cols-3 lg:gap-x-4">
                {topTags.length > 0 ? topTags.map((item, i) => (
                  <li key={item.tag} className="flex items-center py-3.5 border-b border-white/[0.03] last:border-b-0 lg:border-b-0 lg:py-3">
                    <span className="font-display italic text-[24px] text-white/40 w-8 text-left">{i + 1}</span>
                    <div className="flex-1 flex flex-col gap-0.5 ml-1 min-w-0">
                      <span className="text-[16px] font-medium text-white tracking-[-0.01em] truncate">#{item.tag}</span>
                      <span className="text-[12px] text-white/70 font-light">스코어 {item.score?.toLocaleString()}</span>
                    </div>
                  </li>
                )) : (
                  [1, 2, 3].map(i => (
                    <li key={i} className="flex items-center py-3.5 border-b border-white/[0.03] last:border-b-0">
                      <div className="skeleton-bone w-6 h-6 rounded mr-3" />
                      <div className="flex-1"><div className="skeleton-bone w-32 h-4 rounded mb-1" /><div className="skeleton-bone w-20 h-3 rounded" /></div>
                    </li>
                  ))
                )}
              </ul>
            </section>

            {/* 최근 검색 */}
            {recentSearches.length > 0 && (
              <section className="mb-8 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
                <div className="flex items-center gap-2 mb-3">
                  <svg viewBox="0 0 24 24" className="w-3 h-3 stroke-white/40 fill-none stroke-2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  <span className="text-[12px] font-medium text-white/40 uppercase tracking-widest">최근 검색</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((term, i) => (
                    <button key={i} onClick={() => navigate(`/profile?creator=${encodeURIComponent(term)}`)}
                      className="glass-pill flex items-center gap-2 px-3.5 py-2 text-[13px] text-white/80 hover:text-white transition-all group"
                      style={{ background: 'rgba(255,255,255,0.12)' }}>
                      {term}
                      <span role="button" onClick={e => handleDeleteRecent(term, e)}
                        className="text-white/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1.5 -m-1.5">
                        <X size={11} />
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* 오른쪽: 내 프로필 카드 (PC에서 sticky) */}
          <div className="mb-10 lg:mb-0 lg:sticky lg:top-8 animate-fade-in-up order-first lg:order-none" style={{ animationDelay: '210ms' }}>
            <MyProfileCard />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-12 pb-2 text-center text-[11px] text-white/30">
          <span>v{APP_VERSION} · </span>
          <a href="https://github.com/iris-out/ego-bloom/issues" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/60 transition-all">문의/제보</a>
          <span> · </span>
          <button onClick={() => setShowChangelog(true)} className="underline hover:text-white/60 transition-all">변경 내역</button>
        </div>
      </div>

      {/* 하단 고정 검색 pill (모바일에서만) */}
      <div className="lg:hidden fixed bottom-0 left-0 w-full z-20" style={{ padding: '0 24px env(safe-area-inset-bottom, 24px)', background: 'linear-gradient(to top, var(--bg-base) 20%, transparent 100%)' }}>
        <div className="max-w-[680px] mx-auto mb-4">
          <SearchPill suggestionsAbove={true} />
        </div>
      </div>

      <ChangelogModal isOpen={showChangelog} onClose={() => setShowChangelog(false)} />
      <DataCollectionModal isOpen={showDataModal} onClose={() => setShowDataModal(false)} />
    </div>
  );
}
