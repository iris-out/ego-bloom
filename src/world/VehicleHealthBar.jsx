import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { trafficFrame } from './traffic.js';

const BAR_ABOVE_ROAD = 2.39;

/** 명중했지만 아직 부서지지 않은 AI 차량 위에 뜨는 체력 막대다. 차는 독립된 객체가 아니라
 * traffic.js 가 시간마다 다시 계산하는 좌표이므로, 매 프레임 같은 index 로 자세를 다시 구해 따라간다.
 * React state 를 쓰지 않고 DOM 을 직접 건드려, 맞은 차가 여럿이라도 리렌더가 쌓이지 않는다.
 * 체력 막대마다 trafficPose 를 따로 부르지 않고 한 프레임에 한 번 계산되는 trafficFrame 을 읽는다.
 * WalkMode 가 같은 (count, time, extent) 로 이미 한 번 불렀다면 이 호출은 그 결과를 그대로 재사용한다.
 */
export default function VehicleHealthBar({ index, extent, trafficCount = 0, damageRef }) {
  const group = useRef();
  const fill = useRef();

  useFrame(({ clock }) => {
    const remaining = 1 - (damageRef.current.get(index) || 0);
    const frame = trafficFrame(trafficCount, clock.elapsedTime, extent);
    // 품질이 낮아져 이 차가 더 이상 frame 안에 없으면(드묾) 마지막 자리에 그대로 둔다.
    if (group.current && index < frame.count) group.current.position.set(frame.x[index], frame.y[index] + BAR_ABOVE_ROAD, frame.z[index]);
    if (fill.current) {
      fill.current.style.width = `${Math.max(0, Math.min(1, remaining)) * 100}%`;
      fill.current.dataset.level = remaining <= 0.3 ? 'critical' : remaining <= 0.6 ? 'warn' : 'ok';
    }
  });

  return <group ref={group}>
    <Html transform sprite distanceFactor={22} zIndexRange={[18, 1]} style={{ pointerEvents: 'none' }}>
      <div className="world-vehicle-hp"><i ref={fill} data-level="ok" /></div>
    </Html>
  </group>;
}
