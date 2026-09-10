import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import HomePage from './routes/HomePage';
import ProfilePage from './routes/ProfilePage';
import PwaInstallBanner from './components/PwaInstallBanner';
import { lazyWithRetry } from './utils/lazyWithRetry';
const TierPage = lazyWithRetry(() => import('./routes/TierPage'), 'TierPage');
const WorldPage = lazyWithRetry(() => import('./routes/WorldPage'), 'WorldPage');
const AdminPage = lazyWithRetry(() => import('./routes/AdminPage'), 'AdminPage');
// 개발 전용 디자인 시스템 갤러리다. import.meta.env.DEV 로 감싸 프로덕션 번들에서 제외한다.
const DesignSandbox = import.meta.env.DEV
  ? lazyWithRetry(() => import('./routes/DesignSandbox'), 'DesignSandbox')
  : null;

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
        {import.meta.env.DEV && <Route path="/dev/design" element={<DesignSandbox />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </>
  );
}
