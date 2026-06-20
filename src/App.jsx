import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import HomePage from './routes/HomePage';
import ProfilePage from './routes/ProfilePage';
import PwaInstallBanner from './components/PwaInstallBanner';
import { lazyWithRetry } from './utils/lazyWithRetry';
const TierPage = lazyWithRetry(() => import('./routes/TierPage'), 'TierPage');
const WorldPage = lazyWithRetry(() => import('./routes/WorldPage'), 'WorldPage');
const AdminPage = lazyWithRetry(() => import('./routes/AdminPage'), 'AdminPage');
const TierPreviewPage = lazyWithRetry(() => import('./routes/TierPreviewPage'), 'TierPreviewPage');

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
    <>
      <PwaInstallBanner />
      <Suspense fallback={null}>
        <Routes>
        <Route path="/" element={<LegacyRedirect />} />
        <Route path="/profile" element={<ProfilePage />} />
<Route path="/tier" element={<TierPage />} />
        <Route path="/world" element={<WorldPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/tier-preview" element={<TierPreviewPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </>
  );
}
