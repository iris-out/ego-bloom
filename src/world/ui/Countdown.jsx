import { useEffect, useRef, useState } from 'react';
import { countdownStep } from '../worldPhase.js';

const FACE = ['3', '2', '1', 'GO'];
const STEP_CAP = ['착석', '계기 점등', '엔진 시동', '조작 개방'];

/** 출발 카운트다운이다. setInterval 을 쓰지 않는다. 탭이 백그라운드에 갔다 오면
 * 타이머가 밀려 다른 접속자와 출발 시점이 어긋난다. 매 프레임 경과 시간을 다시 읽는다.
 * prefers-reduced-motion 에서도 총 시간은 같다. CSS 가 transform 만 끈다. */
export default function Countdown({ phase, startedAt, onDone, label }) {
  const [step, setStep] = useState(0);
  const fired = useRef(false);
  const frame = useRef(0);

  useEffect(() => {
    if (phase !== 'countdown') return undefined;
    fired.current = false;
    const state = { phase, countdownStartedAt: startedAt };
    const tick = () => {
      const next = countdownStep(state, performance.now());
      setStep((previous) => (previous === next ? previous : next));
      if (next >= 3 && !fired.current) { fired.current = true; onDone?.(); return; }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [phase, startedAt, onDone]);

  if (phase !== 'countdown') return null;
  const go = step >= 3;
  return <div className="wui-count" role="status" aria-live="assertive">
    <span className="wui-count-num" data-go={go ? 'true' : 'false'} key={step}>{FACE[step]}</span>
    <span className="wui-count-cap">{label ? `${label} · ${STEP_CAP[step]}` : STEP_CAP[step]}</span>
  </div>;
}
