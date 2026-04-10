import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import HomePage from './routes/HomePage';
import ProfilePage from './routes/ProfilePage';
import RankingPage from './routes/RankingPage';

const TierPage = lazy(() => import('./routes/TierPage'));
const WorldPage = lazy(() => import('./routes/WorldPage'));

// Redirect old /?creator=X to /profile?creator=X
function LegacyRedirect() {
  const [searchParams] = useSearchParams();
  const creator = searchParams.get('creator');
  if (creator) {
    return <Navigate to={`/profile?creator=${encodeURIComponent(creator)}`} replace />;
  }
  return <HomePage />;
}

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<LegacyRedirect />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/ranking" element={<RankingPage />} />
        <Route path="/tier" element={<TierPage />} />
        <Route path="/world" element={<WorldPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
