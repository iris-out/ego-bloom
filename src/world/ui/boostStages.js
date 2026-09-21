import { BOOST_BURN, OVERDRIVE_BURN, displaySpeed, planeSpec } from '../flightPhysics.js';

/** 부스트 단계 표다. 화면 안내가 계기 km/h 와 연료 배수를 여기서 읽는다.
 * 부스트가 없는 기종은 빈 배열이라 안내가 서지 않는다.
 * 컴포넌트와 같은 파일에 두면 fast refresh 가 깨지므로 분리한다. */
export function boostStages(plane) {
  const spec = planeSpec(plane);
  if (!spec.boostSpeed) return [];
  const stages = [{ key: 'boost', ko: '기본', kmh: Math.round(displaySpeed(spec.boostSpeed)), burn: BOOST_BURN }];
  if (spec.overdriveSpeed) {
    stages.push({ key: 'overdrive', ko: '강화', kmh: Math.round(displaySpeed(spec.overdriveSpeed)), burn: OVERDRIVE_BURN });
  }
  return stages;
}
