import { at } from './cabinLayout.js';

/** 차량 실내등이다. 계기판 위에 두어 스티어링과 접안 마스크가 아래에서 빛을 받는다.
 * 전투 차량은 야간 시력을 지키려고 붉은 계열(기본값) 을 쓴다. 승용차는 돔등처럼 따뜻한 흰색을 넘긴다.
 * distance 를 좁혀 도시까지 새지 않게 하고 그림자 맵을 늘리지 않는다. 세게 두면 헤드라이너에 붉은 반점이 생긴다. */
export function CabinLamp({ vehicle, offset = [0, -0.06, -0.42], intensity = 0.55, color = '#ff7a5e', distance = 2.2 }) {
  return <pointLight position={at(vehicle, offset)} color={color} intensity={intensity} distance={distance} castShadow={false} />;
}
