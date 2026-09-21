import { Timer, Trophy } from 'lucide-react';
import { formatTimeAttack } from '../timeAttack.js';
import { useTimeAttack } from '../timeAttackStore.js';

/** 타임어택 점수판이다. 우상단에 남은 시간과 점수를 두고 판이 끝나면 결과를 띄운다.
 * 시간은 조종 루프가 흘리므로 여기서는 받아 적기만 한다. */
export default function TimeAttackHud({ onClose }) {
  const run = useTimeAttack();
  if (run.phase === 'off') return null;
  const done = run.phase === 'done';
  return <div className="wui-attack" data-done={done ? 'true' : 'false'} role="status" aria-live="polite">
    <span className="wui-attack-head">
      {done ? <Trophy size={13} aria-hidden="true" /> : <Timer size={13} aria-hidden="true" />}
      {done ? '타임어택 종료' : '타임어택'}
    </span>
    {!done && <b className="wui-attack-clock">{formatTimeAttack(run.remaining)}</b>}
    <b className="wui-attack-score">{run.score}<em>점</em></b>
    {done && <>
      <span className="wui-attack-note">3분 동안 {run.score}대를 부쉈다</span>
      <button type="button" className="wui-tab" onClick={onClose}>닫기</button>
    </>}
  </div>;
}
