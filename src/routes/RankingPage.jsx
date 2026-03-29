import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ChevronLeft } from 'lucide-react';
import { useServerStatus } from '../hooks/useServerStatus';

const TrendContent = lazy(() => import('../components/TrendView'));
const CreatorRankingView = lazy(() => import('../components/CreatorRankingView'));

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
  const { status: serverStatus } = useServerStatus();
  const [hashtagData, setHashtagData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('creator'); // 'creator' | 'trend'

  useEffect(() => {
    fetchHashtagTrends().then(d => {
      setHashtagData(d);
      setLoading(false);
    });
  }, []);

  const statusColor = serverStatus === 'ok' ? '#6CD97E' : serverStatus === 'warning' ? '#FBBF24' : '#F87171';

  return (
    <div className="min-h-[100dvh] relative overflow-hidden bg-[#0F0817]">
      {/* 배경 글로우 */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[rgba(121,155,196,0.08)] rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[60%] bg-[rgba(65,30,110,0.15)] rounded-full blur-[120px]" />
      </div>

      {/* 헤더 */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#1A0D30]/80 backdrop-blur-md">
        <div className="max-w-[680px] mx-auto px-6 py-4 lg:max-w-[1280px] lg:px-12">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/')} className="text-white/60 hover:text-white transition-colors">
                <ChevronLeft size={20} />
              </button>
              <h1 className="font-bold text-lg tracking-[0.1em] text-white uppercase">Ranking</h1>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-white/70 tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor, boxShadow: `0 0 8px ${statusColor}66` }} />
              <span>{serverStatus === 'ok' ? '정상' : serverStatus === 'warning' ? '불안정' : '이상'}</span>
            </div>
          </div>

          {/* 탭 네비게이션 */}
          <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
            <button
              onClick={() => setActiveTab('creator')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold tracking-wider transition-all ${
                activeTab === 'creator'
                  ? 'bg-gradient-to-b from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/25'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              글로벌 랭킹
            </button>
            <button
              onClick={() => setActiveTab('trend')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold tracking-wider transition-all ${
                activeTab === 'trend'
                  ? 'bg-gradient-to-b from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/25'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              해시태그 트렌드
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[680px] mx-auto px-6 py-6 relative z-10 lg:max-w-[1280px] lg:px-12">
        {activeTab === 'creator' ? (
          <Suspense fallback={
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="animate-spin text-white/30" />
            </div>
          }>
            <CreatorRankingView />
          </Suspense>
        ) : (
          loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="animate-spin text-white/30" />
            </div>
          ) : (
            <Suspense fallback={
              <div className="flex items-center justify-center py-20">
                <Loader2 size={28} className="animate-spin text-white/30" />
              </div>
            }>
              <TrendContent
                hashtagData={hashtagData}
                trendLoading={false}
                embedded={true}
              />
            </Suspense>
          )
        )}
      </main>
    </div>
  );
}
