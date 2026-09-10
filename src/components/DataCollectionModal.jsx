import { Database, ShieldCheck, Clock } from 'lucide-react';
import Modal from './ui/Modal';

const ITEMS = [
  {
    Icon: Database,
    title: '수집 항목',
    body: '크리에이터 닉네임, 팔로워 수, 대화량 총합, 보이스 재생 시간. 개인정보를 수집하지 않습니다.',
  },
  {
    Icon: ShieldCheck,
    title: '수집 목적',
    body: '글로벌 랭킹 산정, 티어 분포 분석, 인기 트렌드 분석 및 오픈월드 콘텐츠 시각화.',
  },
  {
    Icon: Clock,
    title: '보관 및 파기',
    body: '수집된 랭킹 데이터는 제타에서 공개된 데이터 중 최소한의 데이터만을 사용하면서 트렌드 분석을 위해 일정 기간 보관되며, 서비스 운영 목적이 달성된 후(또는 유저 요청 시) 지체 없이 파기됩니다. 본인의 등수가 랭킹에 노출되는 것을 원하지 않으시다면, irisout_@outlook.kr 에 문의해 주세요.',
  },
];

/**
 * 데이터 수집 안내 모달.
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 */
export default function DataCollectionModal({ isOpen, onClose }) {
  return (
    <Modal open={isOpen} onClose={onClose} title="데이터 수집 안내">
      <div className="flex flex-col gap-5 -mt-1">
        <p className="t-body" style={{ color: 'var(--fg-2)' }}>
          Ego-Bloom은 랭킹 시스템 운영 및 트렌드 분석을 위해 최소한의 공개 데이터를 수집하여 저장하고 있습니다. 수집된 데이터는 서비스 개선 목적으로만 사용됩니다.
        </p>

        <div className="flex flex-col gap-4">
          {ITEMS.map((item) => {
            const { Icon, title, body } = item;
            return (
            <div key={title} className="flex items-start gap-3">
              <div
                className="shrink-0 flex items-center justify-center mt-0.5"
                style={{ width: 28, height: 28, borderRadius: 'var(--radius-s)', background: 'var(--surface-2)' }}
              >
                <Icon size={14} strokeWidth={2} style={{ color: 'var(--accent-ink)' }} />
              </div>
              <div className="min-w-0">
                <div className="t-h3 mb-1">{title}</div>
                <div className="t-small" style={{ color: 'var(--fg-2)' }}>{body}</div>
              </div>
            </div>
            );
          })}
        </div>

        <button type="button" onClick={onClose} className="eb-btn eb-btn-primary w-full mt-1">
          확인했습니다
        </button>
      </div>
    </Modal>
  );
}
