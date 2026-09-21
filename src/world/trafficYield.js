/** 뒤따라오는 AI 차량이 앞차(주인공 차) 를 보고 늦추는 판정이다. 순수 함수이며
 * Three, React 에 기대지 않는다.
 *
 * 차의 자리는 시간만으로 정해지므로 위치를 직접 밀지 않고 그 차만 시간을 늦춘다.
 * 늦춘 만큼 제 차선 위에서 뒤로 남으므로 경로를 벗어나지 않고 속도만 준다.
 * 늦추는 양은 브라우저마다 다를 수 있다. 주인공 차는 브라우저마다 다른 자리에 있다.
 */

/** 앞차와 벌리는 간격이다. 차체 사이의 거리다. */
export const YIELD_GAP = 8;
/** 이 거리 안에 있는 앞차만 본다. */
export const YIELD_REACH = 44;
/** 중심선에서 이만큼 벗어난 차는 다른 차선으로 본다. */
export const YIELD_LANE = 3.4;
/** 이 거리부터 속도를 줄이기 시작한다. 간격까지 남은 거리에 비례해 세게 잡는다. */
export const YIELD_BRAKE_ZONE = 14;
/** 늦출 수 있는 최대 시간이다. 앞차가 계속 서 있어도 이 이상은 멈춰 있지 않는다. */
export const YIELD_MAX = 20;
/** 앞이 비면 이 속도로 시간을 되돌려 따라붙는다. 1 을 넘으면 순간이동처럼 보인다. */
export const YIELD_CATCHUP = 0.5;

const finite = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback);

/** 앞차 때문에 잡아야 하는 브레이크 세기다. 0 이면 그냥 가고 1 이면 완전히 선다.
 * 옆 차선이거나 뒤에 있으면 0 이다. */
export function yieldBrake(car, player) {
  if (!car || !player) return 0;
  const angle = finite(car.angle);
  const fx = Math.sin(angle), fz = Math.cos(angle);
  const dx = finite(player.x) - finite(car.x), dz = finite(player.z) - finite(car.z);
  const ahead = dx * fx + dz * fz;
  if (!(ahead > 0) || ahead > YIELD_REACH) return 0;
  const side = Math.abs(dx * -fz + dz * fx);
  // 차체 반폭까지는 같은 차선으로 본다. 나란히 달리는 옆 차선 차에는 서지 않는다.
  if (side > YIELD_LANE + finite(player.width, 2.2) / 2) return 0;
  const half = finite(car.depth, 4.3) / 2 + finite(player.depth, 4.6) / 2;
  const gap = ahead - half;
  if (gap >= YIELD_GAP + YIELD_BRAKE_ZONE) return 0;
  // 간격까지 남은 거리가 줄수록 세게 잡는다. 간격에 닿으면 1 이라 그 자리에 선다.
  return Math.max(0, Math.min(1, (YIELD_GAP + YIELD_BRAKE_ZONE - gap) / YIELD_BRAKE_ZONE));
}

/** 늦춤을 한 걸음 옮긴다. 브레이크 1 이면 한 걸음만큼 그대로 늦춰 시간이 멈춘 것과 같고,
 * 앞이 비면 천천히 되돌려 따라붙는다. 한 걸음에 dt 보다 많이 늦추지 않는다.
 * 그보다 크면 차가 뒤로 간다. */
export function nextYieldLag(previous, car, player, dt) {
  const lag = Math.max(0, finite(previous));
  const step = Math.max(0, Math.min(finite(dt), 0.05));
  const brake = yieldBrake(car, player);
  if (brake > 0) return Math.min(YIELD_MAX, lag + step * brake);
  return Math.max(0, lag - step * YIELD_CATCHUP);
}
