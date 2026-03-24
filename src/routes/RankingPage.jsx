import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import NavBar from '../components/NavBar';
import { useServerStatus } from '../hooks/useServerStatus';

// Highcharts 번들은 lazy load
const TrendContent = lazy(() => import('../components/TrendView'));

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

  useEffect(() => {
    fetchHashtagTrends().then(d => {
      setHashtagData(d);
      setLoading(false);
    });
  }, []);

  return (
    <div className="page-bg min-h-[100dvh]">
      <NavBar
        variant="ranking"
        onBack={() => navigate('/')}
        serverStatus={serverStatus}
      />

      <main className="container pb-16">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-[var(--text-tertiary)]" />
          </div>
        ) : (
          <Suspense fallback={
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="animate-spin text-[var(--text-tertiary)]" />
            </div>
          }>
            <TrendContent
              hashtagData={hashtagData}
              trendLoading={false}
              embedded={true}
            />
          </Suspense>
        )}
      </main>
    </div>
  );
}
