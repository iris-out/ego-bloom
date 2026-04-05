import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, ChevronLeft } from 'lucide-react';
import { useServerStatus } from '../hooks/useServerStatus';

import TrendContent from '../components/TrendView';
import CreatorRankingView from '../components/CreatorRankingView';

async function fetchHashtagTrends() {
  try {
    const res = await fetch('/data/ranking_latest.json');
    if (!res.ok) throw new Error('Not found');
    return await res.json();
  } catch {
    return { combined: [], trending: [], best: [], new: [], genres: [], interaction: [] };
  }
}

export default function RankingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { status: serverStatus } = useServerStatus();
  const [hashtagData, setHashtagData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(
    searchParams.get('tab') === 'trend' ? 'trend' : 'creator'
  ); // 'creator' | 'trend'

  useEffect(() => {
    fetchHashtagTrends().then(d => {
      setHashtagData(d);
      setLoading(false);
    });
  }, []);

  const statusColor = serverStatus === 'ok' ? '#6CD97E' : serverStatus === 'warning' ? '#FBBF24' : '#F87171';

  return (
    <div className="min-h-[100dvh] bg-[#080F24]">
      {/* 배경 글로우 (fixed, pointer-events-none) */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-15%] left-[-8%] w-[55%] h-[55%] bg-[rgba(74,127,255,0.07)] rounded-full blur-[130px]" />
        <div className="absolute bottom-[-15%] right-[-8%] w-[45%] h-[55%] bg-[rgba(30,60,140,0.10)] rounded-full blur-[130px]" />
        {/* 헤더 아래 연결 글로우 */}
        <div className="absolute top-0 left-0 right-0 h-[140px] bg-gradient-to-b from-[rgba(74,127,255,0.05)] to-transparent pointer-events-none" />
      </div>

      {/* 헤더 */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[rgba(8,15,36,0.75)]">
        <div className="max-w-[680px] mx-auto px-4 sm:px-6 pt-4 pb-0 lg:max-w-[1280px] lg:px-12">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <button onClick={() => navigate('/')} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all">
                <ChevronLeft size={18} />
              </button>
              <span className="font-bold text-sm tracking-[0.10em] text-white/70 uppercase">Ranking</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-white/40 tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor, boxShadow: `0 0 8px ${statusColor}66` }} />
              <span>{serverStatus === 'ok' ? '정상' : serverStatus === 'warning' ? '불안정' : '이상'}</span>
            </div>
          </div>

          {/* 탭 네비게이션 — 헤더 하단 flush */}
          <div className="flex gap-0 border-b border-white/[0.05]">
            {[
              { key: 'creator', label: '크리에이터 랭킹' },
              { key: 'trend', label: '해시태그 트렌드' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-4 py-3 text-[13px] font-bold tracking-wide transition-all ${
                  activeTab === tab.key
                    ? 'text-white'
                    : 'text-white/35 hover:text-white/60'
                }`}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-[680px] mx-auto px-4 sm:px-6 py-6 relative z-10 lg:max-w-[1280px] lg:px-12">
        {activeTab === 'creator' && (
          <CreatorRankingView />
        )}

        {activeTab === 'trend' && (
          loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="animate-spin text-white/30" />
            </div>
          ) : (
            <TrendContent hashtagData={hashtagData} trendLoading={false} embedded={true} />
          )
        )}
      </main>
    </div>
  );

}
