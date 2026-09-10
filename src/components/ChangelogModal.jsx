import { ClipboardList } from 'lucide-react';
import Modal from './ui/Modal';
import { CHANGELOG, APP_VERSION } from '../data/changelog';

/**
 * 업데이트 로그 모달. Modal 에 얹은 스크롤 목록이다.
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 */
export default function ChangelogModal({ isOpen, onClose }) {
  return (
    <Modal open={isOpen} onClose={onClose} title="업데이트 내역">
      <div className="flex flex-col gap-5 -mt-1">
        {CHANGELOG.map((entry) => (
          <div key={entry.version}>
            <div className="flex items-center gap-2 mb-2">
              <span className="t-h3" style={{ color: 'var(--accent-ink)' }}>v{entry.version}</span>
              {entry.label && (
                <span className="t-small" style={{ color: 'var(--fg-2)' }}>{entry.label}</span>
              )}
              {entry.version === APP_VERSION && (
                <span className="t-label ml-auto px-2 h-5 flex items-center" style={{ background: 'var(--accent)', color: 'var(--accent-fg)', borderRadius: 'var(--radius-pill)' }}>
                  최신
                </span>
              )}
            </div>
            <div className="t-small mb-2" style={{ color: 'var(--fg-3)' }}>{entry.date}</div>
            <ul className="flex flex-col gap-1.5">
              {entry.changes.map((change, i) => (
                <li key={i} className="t-small flex items-start gap-1.5" style={{ color: 'var(--fg-2)' }}>
                  <ClipboardList size={12} strokeWidth={2} className="shrink-0 mt-0.5" style={{ color: 'var(--fg-3)' }} />
                  {change}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Modal>
  );
}
