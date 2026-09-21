/** 1인칭 카메라의 로컬 좌표다. 원점과 축은 각 모델과 같다.
 * 항공기는 코가 -Z 이므로 조종석은 음수 Z 다. 차량도 앞이 -Z 다.
 * 값을 바꾸면 cockpits/ 의 같은 기종 실내 위치도 함께 확인한다. */
export const EYE_POINTS = Object.freeze({
  jet: [0, 1.02, -3.4],
  // 이 도시는 우측통행이라(carPhysics 의 시작 x=6 이 오른쪽 차선이다) 기장석과 운전석이 왼쪽이다.
  bomber: [-0.46, 1.35, -5.6],
  // 단발기는 코 뒤 캐노피 한가운데 앉는다.
  prop: [0, 0.62, -0.7],
  fighter: [0, 1.16, -2.9],
  interceptor: [0, 0.86, -2.4],
  // 헬기만 기장이 오른쪽에 앉는 기종을 따른다.
  helicopter: [0.38, 0.92, -3.6],
  // 차량은 실내 폭의 4분의 1 지점에 앉는다. 실내 조각은 차체 중심 기준이라(cockpits/VehicleInteriors 의
  // cabin) 여기 x 를 0 에 가깝게 두면 운전석이 한가운데로 보인다.
  sedan: [-0.55, 0.55, -0.15],
  suv: [-0.57, 0.8, -0.2],
  convertible: [-0.53, 0.5, -0.05],
  // 캡오버라 운전석이 앞바퀴 위, 적재함보다 훨씬 앞에 있다.
  truck: [-0.6, 1.3, -2.2],
  // 두 바퀴라 눈이 세단보다 높고, 핸들바 위가 아니라 뒤에 앉으므로 z 가 양수다.
  motorcycle: [0, 0.78, 0.28],
  tank: [-0.5, 1.05, 0.15],
  howitzer: [-0.58, 1.12, 0.4],
  // 장갑차는 무인 포탑 안에 사람을 두지 않는다(무인 포탑 원통이 1인칭 화면 왼쪽을 가득
  // 채우는 문제가 있었다). 차장이 운전석 위 큐폴라 해치에 앉는 방식으로 바꿨다.
  // models/ArmoredCar.jsx 의 운전석 캐빈 박스 [-0.5,0.55,-1.95], 상판 y 0.55+0.175=0.725
  // (WP5a 표). 그 위 5cm(해치 안) 이 눈이다: 0.725+0.05=0.775. x, z 는 해치 중심(-0.5,-1.95)
  // 그대로 쓰되 x 만 1cm 옮겨 전차(x -0.5) 와 겹치지 않게 하고, y 도 0.775 로 둬 오토바이
  // (y 0.78) 와 겹치지 않게 한다("축마다 값이 겹치지 않는다" 테스트).
  armored: [-0.49, 0.775, -1.95],
  // 대공포는 포수가 포탑 안에 앉는다. 하늘을 보므로 눈이 장갑차보다 높다.
  aa: [-0.32, 1.34, -0.35],
});

/** 없는 키에는 좌표를 만들어 주지 않는다. 세단으로 폴백하면 장갑차 안에서
 * 카메라가 빈 공간에 놓인다. 호출자가 1인칭 전환 자체를 막아야 한다. */
export function eyePoint(key) {
  return EYE_POINTS[key] || null;
}

export function hasFirstPerson(key) {
  return Boolean(EYE_POINTS[key]);
}

/** 3인칭 기본 화각이다. WorldScene 의 Canvas camera 와 같은 값을 쓴다. */
export const FOV_DEFAULT = 38;

/** 1인칭에서만 근접면을 내린다. Canvas 의 near 0.5 는 눈에서 0.41 인 장갑차 스티어링 휠과
 * 0.42 인 전차 조준경을 통째로 잘라내 실내가 보이지 않는다. 깊이 해상도를 지키려 far 도 줄인다. */
export const NEAR_COCKPIT = 0.05, NEAR_DEFAULT = 0.5, FAR_COCKPIT = 2500, FAR_DEFAULT = 5000;

// 유리 면적과 조준 장비가 탈것마다 달라 화각을 따로 둔다. zoom 은 조준경을 당겼을 때의 화각이고
// 배율이 아니다. 전차 조준경 8배가 대략 세로 8도 안팎이라 실제 장비보다는 넓게 잡았다.
// 2도대까지 좁히면 화면이 목표 하나로 가득 차 주변 상황을 잃는다.
const COCKPIT_FOV = Object.freeze({
  jet: { fov: 72 },          // 거품 캐노피라 시야가 넓다
  bomber: { fov: 68 },       // 폭격기 조종석은 창이 크지만 코가 길다
  prop: { fov: 68 },         // 버블 캐노피라 시야가 넓다
  fighter: { fov: 74 },      // 캐노피 시야가 가장 넓다
  interceptor: { fov: 70 },  // 좁은 캐노피에 기수가 길다
  helicopter: { fov: 70 },   // 발밑까지 유리다
  sedan: { fov: 72 },        // 승용차 앞유리 기준이다
  suv: { fov: 70 },          // 앞유리가 세워져 있어 조금 좁다
  convertible: { fov: 74 },  // 지붕이 없어 위가 트인다
  truck: { fov: 68 },        // 높고 넓은 앞유리지만 기둥이 굵다
  motorcycle: { fov: 72 },   // 헬멧 없이 바람을 맞는다
  tank: { fov: 42, zoom: 16 },      // 직사 조준경이다
  howitzer: { fov: 40, zoom: 14 },  // 곡사 조준은 더 좁다
  armored: { fov: 68, zoom: 24 },   // 좁은 관측창으로 본다
  // 대공포만 배율 조준경을 쓴다. 고정 zoom 대신 배율 단계를 갖는다.
  aa: { fov: 66, scope: [1, 2, 3, 4, 6, 8, 12] },
  walk: { fov: 75 },         // 맨눈이다. 정조준 배율은 무기가 가진다
});

/** 배율 조준경을 쓰는 탈것의 배율 단계다. 없으면 null 이다. */
export function scopeSteps(key) {
  return COCKPIT_FOV[key]?.scope || null;
}

/** 배율을 화각으로 바꾼다. 2배면 기본 화각의 절반이다. 단계에 없는 값은 가장 가까운 단계로 맞춘다.
 * 조준경이 없는 탈것은 기본 화각을 그대로 준다. */
export function scopeFov(key, magnification = 1) {
  const steps = scopeSteps(key);
  const base = COCKPIT_FOV[key]?.fov ?? FOV_FALLBACK;
  if (!steps) return base;
  const want = Number.isFinite(magnification) ? magnification : steps[0];
  const near = steps.reduce((best, step) => Math.abs(step - want) < Math.abs(best - want) ? step : best, steps[0]);
  return base / near;
}

/** 배율을 한 단계 올린다. 끝에서 처음으로 돌고, 표에 없는 값은 첫 단계로 되돌린다. */
export function nextScope(key, magnification) {
  const steps = scopeSteps(key);
  if (!steps) return 1;
  const index = steps.indexOf(magnification);
  return steps[(index < 0 ? 0 : index + 1) % steps.length];
}

/** eyePoint 와 달리 모르는 키에도 값을 준다. 화각은 폴백해도 카메라가 빈 공간에 놓이지 않고
 * 시야만 어긋나므로, 1인칭 진입을 막는 판단은 hasFirstPerson 한 곳에만 둔다. */
const FOV_FALLBACK = 62;

/** 탈것별 1인칭 세로 화각(도) 이다. zoomed 가 참이면 조준경을 당긴 좁은 화각을 준다.
 *  배율이 없는 탈것은 zoomed 와 무관하게 같은 값을 준다. */
export function cockpitFov(key, zoomed = false) {
  const spec = COCKPIT_FOV[key];
  if (!spec) return FOV_FALLBACK;
  return zoomed && spec.zoom ? spec.zoom : spec.fov;
}
