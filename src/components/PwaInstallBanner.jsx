import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { triggerInstall, isInstallDismissed, dismissInstall } from '../lib/pwaInstall';

// 상단 얇은 PWA 설치 안내 배너.
// 설치 가능하고(쿠키로) 닫지 않았을 때만 노출된다.
export default function PwaInstallBanner() {
  const { canInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(isInstallDismissed);

  const show = canInstall && !dismissed;

  // 배너 높이만큼 고정 헤더/콘텐츠를 밀어내기 위한 전역 CSS 변수.
  // index.css 의 body / .nav / 홈 헤더가 이 값을 참조한다.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--pwa-banner-h', show ? '36px' : '0px');
    return () => root.style.setProperty('--pwa-banner-h', '0px');
  }, [show]);

  if (!show) return null;

  const handleDismiss = () => {
    dismissInstall();
    setDismissed(true);
  };

  return (
    <div
      role="region"
      aria-label="앱 설치 안내"
      className="fixed top-0 inset-x-0 z-[60] h-9 flex items-center gap-2.5 pl-3.5 pr-2"
      style={{
        background: 'linear-gradient(90deg, rgba(13,17,28,0.97) 0%, rgba(23,21,46,0.97) 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(12px)',
        paddingLeft: 'max(0.875rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.5rem, env(safe-area-inset-right))',
      }}
    >
      <Download size={14} className="shrink-0 text-indigo-300" />
      <span className="flex-1 min-w-0 truncate text-[12.5px] font-medium text-white/85 leading-none">
        앱처럼 설치하여 편하게 사용하기
      </span>
      <button
        type="button"
        onClick={triggerInstall}
        className="shrink-0 text-[11.5px] font-bold px-3 py-1 rounded-full text-white transition-opacity hover:opacity-90"
        style={{ background: 'linear-gradient(90deg, #6366f1 0%, #818cf8 100%)' }}
      >
        설치
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="닫기"
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-white/55 hover:text-white/90 hover:bg-white/10 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}
