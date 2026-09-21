/** 3인칭 계기판의 바늘 값이다. 순수 함수이며 Three, React 에 의존하지 않는다.
 *
 * 실제 변속기 상태를 3인칭 계기에 옮긴다. tachometer 는 상태가 없는 미리보기용 폴백이다.
 */

const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** 변속기 단수별 최고 속도 비율이다. 1단은 최고 속도의 22% 까지, 5단이 100% 다. */
export const GEAR_BANDS = Object.freeze([0.22, 0.4, 0.6, 0.8, 1]);
/** 공회전과 변속 회전수다. 실제 엔진이 아니라 눈금의 양 끝이다. */
export const IDLE_RPM = 800, SHIFT_RPM = 7200, MAX_RPM = 8000, REDLINE_RPM = 6800;

/** 속도에서 단수와 회전수를 만든다. speed 와 topSpeed 는 같은 단위면 된다(km/h 권장).
 * 후진과 정지는 1단 공회전이다. 단수가 올라갈 때마다 바늘이 떨어졌다 다시 올라간다. */
export function tachometer(speed, topSpeed) {
  const top = Math.max(1, finite(topSpeed, 1));
  const ratio = clamp(Math.abs(finite(speed)) / top, 0, 1.2);
  const index = GEAR_BANDS.findIndex((band) => ratio <= band);
  const gear = index < 0 ? GEAR_BANDS.length : index + 1;
  const floor = gear > 1 ? GEAR_BANDS[gear - 2] : 0;
  const ceiling = GEAR_BANDS[gear - 1];
  // 단 안에서의 진행도가 그대로 회전수다. 마지막 단은 최고 속도에서 변속 회전수에 닿는다.
  const within = ceiling > floor ? (ratio - floor) / (ceiling - floor) : 0;
  const rpm = Math.round(IDLE_RPM + clamp(within, 0, 1.15) * (SHIFT_RPM - IDLE_RPM));
  return { gear, rpm: Math.min(MAX_RPM, rpm), redline: rpm >= REDLINE_RPM };
}

/** 바늘 각도다. 7시에서 5시까지 시계 방향으로 sweep 만큼 돈다. 0 이 왼쪽 끝이다. */
export function needleAngle(value, max, sweep = 250, start = -215) {
  const span = Math.max(1, finite(max, 1));
  return start + clamp(finite(value) / span, 0, 1) * sweep;
}

/** 눈금 위치다. count 는 큰 눈금 수이고 값과 각도를 함께 준다. */
export function gaugeTicks(max, count = 6, sweep = 250, start = -215) {
  const total = Math.max(2, Math.round(finite(count, 2)));
  return Array.from({ length: total }, (_, index) => {
    const ratio = index / (total - 1);
    return { value: Math.round(finite(max) * ratio), angle: start + ratio * sweep, major: true };
  });
}
