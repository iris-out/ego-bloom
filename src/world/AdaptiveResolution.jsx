/** 프레임이 계속 예산을 넘으면 렌더 해상도(dpr) 를 내리고, 조감 시점에서 여유가 크면 되돌린다.
 * 판정은 전부 adaptiveResolution.js 의 순수 함수가 하고 여기서는 표본을 넣고 바뀐 값만 적용한다.
 * dpr 의 주인은 이 컴포넌트다. Canvas 의 dpr prop 을 쓰면 Canvas 가 다시 렌더될 때마다 등급 값으로
 * 되돌려 캔버스 버퍼를 다시 잡는다(20초에 setSize 만 0.5초). WorldScene 이 dpr={null} 로 둔 이유다.
 */
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { createResolutionTrack, stepResolution } from './adaptiveResolution.js';

export default function AdaptiveResolution({ base = 1, piloting = false }) {
  const setDpr = useThree((state) => state.setDpr);
  const track = useRef(null);
  const steering = useRef(piloting);
  useEffect(() => { steering.current = piloting; }, [piloting]);
  useEffect(() => {
    // 품질 등급이 바뀌면 그 등급의 dpr 에서 다시 시작한다. 자동 조절은 이 값을 넘지 않는다.
    track.current = createResolutionTrack(base);
    setDpr(base);
  }, [base, setDpr]);
  useFrame(({ viewport, setDpr: apply, clock }, delta) => {
    if (typeof document !== 'undefined' && document.hidden) return;
    const current = track.current;
    if (!current) return;
    const { dpr } = stepResolution(current, delta, clock.elapsedTime, steering.current);
    if (Math.abs(dpr - viewport.dpr) > 0.005) apply(dpr);
  });
  return null;
}
