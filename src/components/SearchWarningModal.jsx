import { useEffect, useState } from 'react';
import { AlertTriangle, ShieldCheck, UserMinus, Info, Mail, Check } from 'lucide-react';
import Modal from './ui/Modal';

const NOTICES = [
  { Icon: Info, text: '검색 시 자동으로 랭킹에 등재되며, 대화량과 팔로워가 내부 계산을 통하여 점수화되어 티어와 함께 올라가게 됩니다.' },
  { Icon: ShieldCheck, text: '제작자의 개인정보나 기타 민감한 정보를 수집하지 않습니다. 또한, 이를 이용하여 사적인 이득이나 영리적인 이득을 취하지 않습니다.' },
  { Icon: UserMinus, text: '다른 사람이 자신을 검색하는 경우에도 랭킹에 등재되게 설정되어 있습니다. (제작자가 제작자 자신임을 인증할 수단이 없기 때문에 개방해 둔 기능입니다.)' },
];

/**
 * 검색 전 주의사항 동의 모달. 동의하면 localStorage['ego-bloom-warning-agreed'] 에 기록한다.
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 */
export default function SearchWarningModal({ isOpen, onClose }) {
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setAgreed(localStorage.getItem('ego-bloom-warning-agreed') === 'true');
  }, [isOpen]);

  const handleConfirm = () => {
    if (!agreed) return;
    localStorage.setItem('ego-bloom-warning-agreed', 'true');
    onClose();
  };

  return (
    <Modal open={isOpen} onClose={onClose} title="검색 전 주의사항 (필독)">
      <div className="flex flex-col gap-5 -mt-1">
        <div className="flex items-center gap-2.5 -mt-2 mb-1">
          <div className="flex items-center justify-center shrink-0" style={{ width: 32, height: 32, borderRadius: 'var(--radius-s)', background: 'var(--surface-2)' }}>
            <AlertTriangle size={16} strokeWidth={2} style={{ color: 'var(--warn)' }} />
          </div>
        </div>

        {NOTICES.map((notice, i) => {
          const { Icon, text } = notice;
          return (
            <div key={i} className="flex gap-3">
              <Icon size={16} strokeWidth={2} className="shrink-0 mt-0.5" style={{ color: 'var(--accent-ink)' }} />
              <p className="t-body" style={{ color: 'var(--fg-2)' }}>{text}</p>
            </div>
          );
        })}

        <div className="eb-tile flex flex-col gap-3">
          <p className="t-small" style={{ color: 'var(--fg-3)' }}>
            만일 자신이 랭킹에 등재되는 것을 원하지 않는다면, 아래 채널로 문의해 주세요. 삭제 및 등록 방지 조치를 취하겠습니다.
          </p>
          <a
            href="mailto:irisout_@outlook.kr"
            className="flex items-center gap-2.5 t-small"
            style={{ padding: '10px 12px', borderRadius: 'var(--radius-s)', background: 'var(--surface-2)', color: 'var(--fg)' }}
          >
            <Mail size={14} strokeWidth={2} /> <span>이메일 문의 (irisout_@outlook.kr)</span>
          </a>
        </div>

        <button
          type="button"
          onClick={() => setAgreed((v) => !v)}
          aria-pressed={agreed}
          className="flex items-center gap-3 text-left"
          style={{
            padding: 16,
            borderRadius: 'var(--radius-m)',
            background: agreed ? 'var(--accent-soft)' : 'var(--surface-2)',
            border: `2px solid ${agreed ? 'var(--accent-ink)' : 'var(--line)'}`,
          }}
        >
          <span
            className="flex items-center justify-center shrink-0"
            style={{
              width: 22, height: 22, borderRadius: 'var(--radius-s)',
              background: agreed ? 'var(--accent)' : 'transparent',
              border: agreed ? 'none' : '2px solid var(--line)',
            }}
          >
            {agreed && <Check size={14} strokeWidth={3} style={{ color: 'var(--accent-fg)' }} />}
          </span>
          <span className="t-ui">위 주의사항을 모두 읽었으며, 이에 동의합니다.</span>
        </button>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!agreed}
          className="eb-btn eb-btn-primary w-full disabled:opacity-40"
        >
          확인했습니다
        </button>
      </div>
    </Modal>
  );
}
