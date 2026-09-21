/** 밤에 카메라와 가장 가까운 가로등 몇 개만 골라 실제 광원을 켠다. 손전등, 차량
 * 전조등과 같은 자리다. 그림자는 만들지 않고 도달 거리도 짧게 잡아 비용을 억제한다.
 *
 * 광원 개수는 three 셰이더 프로그램의 캐시 키다. 가까운 가로등 수에 맞춰 광원을 붙였다 떼면
 * 개수가 바뀔 때마다 도시 전체 재질이 다시 컴파일된다. 밤에는 늘 같은 수를 두고 쓰지 않는 자리는
 * 세기 0 으로 끈다. 위치와 세기는 React 상태가 아니라 광원 객체에 바로 쓴다.
 */
import { memo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

const REACH = 70;
const INTENSITY = 9;
/** 광원 하나가 불투명 재질의 모든 화소에서 조명 계산을 한 번 더 한다. 가로등 불빛 웅덩이가 이미
 * 가로마다 깔려 있으므로 high 도 medium 과 같은 6개로 묶는다. */
const MAX_LIGHTS = 6;

function StreetLamps({ lamps, night, cap = 6 }) {
  const slots = Math.max(1, Math.min(cap, MAX_LIGHTS));
  const lights = useRef([]);
  const checked = useRef(-1), nearest = useRef([]);
  useFrame(({ camera, clock }) => {
    if (!night || clock.elapsedTime - checked.current < 0.3) return;
    checked.current = clock.elapsedTime;
    const candidates = nearest.current;
    candidates.length = 0;
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
    for (const lamp of lamps) {
      const dx = lamp.x - cx, dy = lamp.y - cy, dz = lamp.z - cz;
      if (dx * dx + dy * dy + dz * dz < REACH * REACH) candidates.push(lamp);
    }
    candidates.sort((a, b) => ((a.x - cx) ** 2 + (a.z - cz) ** 2) - ((b.x - cx) ** 2 + (b.z - cz) ** 2));
    for (let i = 0; i < slots; i++) {
      const light = lights.current[i];
      if (!light) continue;
      const lamp = candidates[i];
      if (lamp) { light.position.set(lamp.x, lamp.y, lamp.z); light.intensity = INTENSITY; }
      else light.intensity = 0;
    }
  });
  if (!night) return null;
  return Array.from({ length: slots }, (_, index) => <pointLight key={index} ref={(node) => { lights.current[index] = node; }}
    color="#ffdb92" intensity={0} distance={28} decay={2} castShadow={false} />);
}

export default memo(StreetLamps);
