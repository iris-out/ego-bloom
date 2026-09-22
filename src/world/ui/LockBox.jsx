import { useEffect, useRef, useState } from 'react';
import { getLockScreen, lockNow } from '../lockStore.js';

/** 전투기 미사일 포착 네모다. 적기를 잡으면 큰 네모가 2초 동안 좁아지고, 다 좁아지면
 * 락온이다. 자리와 진행도는 `lockStore` 가 들고 있고 여기서 rAF 루프로 읽어 루트 div 의
 * transform 과 네모 크기만 직접 바꾼다. 상태로 올리면 HUD 전체가 프레임마다 다시 렌더된다.
 * 판정은 `missileLock.js` 가 한다. 이 파일에는 규칙을 두지 않는다. */

/** 막 잡았을 때와 락온했을 때의 한 변(px) 이다. */
const WIDE = 132;
const TIGHT = 38;
/** 이 시간(ms) 넘게 새 값이 없으면 네모를 지운다. 목표를 놓았거나 내린 것이다. */
const STALE = 400;
/** 모서리 괄호의 팔 길이 비율이다. */
const ARM = 0.28;

export default function LockBox({ active = false }) {
  const root = useRef(null), box = useRef(null), label = useRef(null);
  // 락온 여부만 상태로 올린다. 색과 글자가 바뀌는 순간뿐이라 2초에 한 번도 돌지 않는다.
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!active) return undefined;
    let frame = 0, shown = false, wasLocked = false;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const node = root.current;
      if (!node) return;
      const lock = getLockScreen();
      const fresh = lock.at > 0 && lockNow() - lock.at < STALE && !lock.behind;
      if (!fresh) {
        if (shown) { node.style.opacity = '0'; shown = false; }
        return;
      }
      if (!shown) { node.style.opacity = '1'; shown = true; }
      node.style.transform = `translate(${lock.x}px, ${lock.y}px)`;
      const side = WIDE + (TIGHT - WIDE) * lock.progress;
      if (box.current) {
        box.current.style.width = `${side}px`;
        box.current.style.height = `${side}px`;
      }
      if (label.current) label.current.textContent = lock.locked ? 'LOCK' : `${lock.range}M`;
      if (lock.locked !== wasLocked) { wasLocked = lock.locked; setLocked(lock.locked); }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  if (!active) return null;
  return <div ref={root} className="wui-lock" data-locked={locked ? 'true' : 'false'} aria-hidden="true" style={{ opacity: 0 }}>
    <div ref={box} className="wui-lock-box">
      {['tl', 'tr', 'bl', 'br'].map((corner) => <i key={corner} data-corner={corner} style={{ '--arm': `${ARM * 100}%` }} />)}
    </div>
    <span ref={label} className="wui-lock-label" />
  </div>;
}
