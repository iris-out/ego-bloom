import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * 데스크톱은 가운데 다이얼로그, 640px 미만은 하단 시트로 바뀐다.
 * Esc 와 배경 클릭으로 닫히고, 닫힐 때 포커스를 원래 위치로 돌려준다.
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {string} [props.title]
 * @param {import('react').ReactNode} props.children
 * @param {string} [props.className]
 */
export default function Modal({ open, onClose, title, children, className = '' }) {
  const panelRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement;
    panelRef.current?.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'var(--scrim)' }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`eb-panel w-full sm:w-[480px] sm:max-w-[calc(100vw-32px)] max-h-[85vh] overflow-y-auto p-6 rounded-b-none sm:rounded-b-[var(--radius-l)] ${className}`}
        style={{ borderTopLeftRadius: 'var(--radius-l)', borderTopRightRadius: 'var(--radius-l)', boxShadow: 'var(--shadow-overlay)' }}
      >
        <div className="sm:hidden mx-auto mb-3 h-1 w-9" style={{ background: 'var(--line)', borderRadius: 'var(--radius-pill)' }} />

        <div className="flex items-start justify-between gap-4 mb-4">
          {title && <h2 className="t-h2">{title}</h2>}
          <button type="button" className="eb-btn-icon ml-auto shrink-0" onClick={onClose} aria-label="닫기">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {children}
      </div>
    </div>,
    document.body,
  );
}
