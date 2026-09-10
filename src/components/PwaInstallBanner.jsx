import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { triggerInstall, isInstallDismissed, dismissInstall } from '../lib/pwaInstall';

/**
 * 상단 얇은 PWA 설치 안내 배너다. 설치 가능하고(쿠키로) 닫지 않았을 때만 노출된다.
 * @returns {JSX.Element|null}
 */
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
        background: 'var(--surface)',
        borderBottom: '1px solid var(--line)',
        paddingLeft: 'max(0.875rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.5rem, env(safe-area-inset-right))',
      }}
    >
      <Download size={14} className="shrink-0" style={{ color: 'var(--accent-ink)' }} strokeWidth={2} />
      <span className="flex-1 min-w-0 truncate t-small" style={{ color: 'var(--fg-2)' }}>
        앱처럼 설치하여 편하게 사용하기
      </span>
      <button type="button" onClick={triggerInstall} className="eb-btn eb-btn-primary shrink-0" style={{ height: 28, padding: '0 12px', fontSize: 12 }}>
        설치
      </button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="닫기"
        className="eb-btn-icon shrink-0"
        style={{ width: 28, height: 28 }}
      >
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  );
}
