import { useEffect, useState } from 'react';
import { AlertTriangle, AlertOctagon, X } from 'lucide-react';

const AUTO_DISMISS_MS = 10_000;

/**
 * 서버 상태가 warning/error 일 때 뜨는 알림 토스트다. 앱의 유일한 알림 경로다.
 * 화면 상단 고정, 최대 560px, --warn 2px 테두리. 10초 뒤 자동으로 닫힌다.
 * @param {object} props
 * @param {'warning'|'error'} props.status
 * @param {string|null} [props.message] 제타 비상 메시지.
 */
export default function ServerAlertCard({ status, message }) {
  const [visible, setVisible] = useState(true);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(false), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [visible]);

  useEffect(() => {
    setVisible(true);
    setEntered(false);
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [status, message]);

  if (!visible) return null;

  const isError = status === 'error';
  const Icon = isError ? AlertOctagon : AlertTriangle;
  const label = isError ? '서버 이상' : '서버 불안정';

  return (
    <div
      role="alert"
      className="fixed left-1/2 z-50 w-[calc(100%-32px)]"
      style={{
        top: 72,
        maxWidth: 560,
        transform: `translateX(-50%) translateY(${entered ? 0 : -8}px)`,
        opacity: entered ? 1 : 0,
        transition: 'opacity 200ms ease-out, transform 200ms ease-out',
        background: 'var(--surface-2)',
        border: '2px solid var(--warn)',
        borderRadius: 'var(--radius-l)',
        boxShadow: 'var(--shadow-overlay)',
        padding: '12px 16px',
      }}
    >
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="eb-btn-icon absolute top-2 right-2"
        style={{ width: 28, height: 28 }}
        aria-label="알림 닫기"
      >
        <X size={14} strokeWidth={2} />
      </button>

      <div className="flex items-center gap-2 pr-8">
        <Icon size={16} strokeWidth={2} style={{ color: 'var(--warn)', flexShrink: 0 }} />
        <span className="t-label" style={{ color: 'var(--warn)' }}>{label}</span>
        <span className="t-small" style={{ color: 'var(--fg-3)' }}>emergency.zeta-ai.io</span>
      </div>

      {message && (
        <p className="t-small mt-1.5 pr-8" style={{ color: 'var(--fg-2)' }}>
          {message}
        </p>
      )}
    </div>
  );
}
