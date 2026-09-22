/** 주행 내비게이션의 순수 좌표 계산이다. React/SVG 와 분리해 카메라가 움직여도 도시
 * 계획을 다시 만들지 않고, 방향과 확대 규칙을 단위 테스트할 수 있게 한다. */

export const NAV_ANCHOR = Object.freeze({ x: 50, y: 66 });

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

const ZOOM_STOPS = Object.freeze([
  Object.freeze([0, 75]),
  Object.freeze([30, 95]),
  Object.freeze([80, 140]),
  Object.freeze([160, 215]),
  Object.freeze([300, 300]),
]);

/** 속도(km/h)를 화면 반경(m)으로 바꾼다. 구간 선형이라 단조롭고 정차/최고속도에서
 * 정확한 끝값을 가지며, UI 쪽에서 이 목표값을 감쇠해 기어 변속 때 펌핑하지 않게 한다. */
export function navigationRadius(speedKmh) {
  const speed = clamp(finite(speedKmh), 0, 300);
  for (let index = 1; index < ZOOM_STOPS.length; index += 1) {
    const [nextSpeed, nextRadius] = ZOOM_STOPS[index];
    if (speed > nextSpeed) continue;
    const [previousSpeed, previousRadius] = ZOOM_STOPS[index - 1];
    const ratio = (speed - previousSpeed) / (nextSpeed - previousSpeed);
    return previousRadius + (nextRadius - previousRadius) * ratio;
  }
  return ZOOM_STOPS.at(-1)[1];
}

const normalHeading = (heading) => ((heading % 360) + 360) % 360;

/** 정차 직전 센서/물리 각도의 작은 흔들림은 마지막 유효 방향을 유지한다. */
export function stableHeading(previous, next, speedKmh) {
  const fallback = normalHeading(finite(previous));
  if (finite(speedKmh) < 2 || !Number.isFinite(Number(next))) return fallback;
  return normalHeading(Number(next));
}

/** 세계 좌표를 차량 헤딩업 SVG 좌표로 옮긴다. radius 는 차량에서 화면 좌우 끝까지의
 * 거리이고, 차량은 앞쪽 길을 더 많이 보여 주려고 중앙보다 아래에 앉는다. */
export function toNavigationPoint(point, pose, radius) {
  const validPoint = Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.z));
  const px = finite(point?.x), pz = finite(point?.z);
  const originX = finite(pose?.x), originZ = finite(pose?.z);
  const span = Math.max(1, finite(radius, 75));
  const radians = normalHeading(finite(pose?.heading)) * Math.PI / 180;
  const dx = px - originX, dz = pz - originZ;
  const right = dx * Math.cos(radians) + dz * Math.sin(radians);
  const forward = dx * Math.sin(radians) - dz * Math.cos(radians);
  const x = NAV_ANCHOR.x + right / span * 50;
  const y = NAV_ANCHOR.y - forward / span * 50;
  const visible = validPoint && x >= -5 && x <= 105 && y >= -5 && y <= 105;
  return { x: finite(x, NAV_ANCHOR.x), y: finite(y, NAV_ANCHOR.y), visible };
}

const TIER_MARKERS = Object.freeze({
  bronze: Object.freeze({ shape: 'square', size: 0.9 }),
  silver: Object.freeze({ shape: 'diamond', size: 1 }),
  gold: Object.freeze({ shape: 'hexagon', size: 1.1 }),
  platinum: Object.freeze({ shape: 'ring', size: 1.25 }),
  diamond: Object.freeze({ shape: 'star', size: 1.4 }),
});

export function tierMarker(tier) {
  return TIER_MARKERS[String(tier || '').toLowerCase()] || TIER_MARKERS.bronze;
}
