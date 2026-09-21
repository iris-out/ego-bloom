import { Play } from 'lucide-react';

/** 좌하단 진입 버튼이다. 도시를 보는 상태에서 탈것 선택을 여는 단 하나의 입구다. */
export default function RideLauncher({ onOpen, disabled }) {
  return <div className="wui-launcher-slot">
    <button type="button" className="wui-launcher" onClick={onOpen} disabled={disabled}
      aria-label="드라이브 시작, 단축키 스페이스바">
      <Play size={18} aria-hidden="true" />드라이브 시작<kbd>SPACE</kbd>
    </button>
  </div>;
}
