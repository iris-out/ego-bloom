/** 승용차 1인칭 거울의 순수 상수다. Three 와 React 에 의존하지 않아 단위 테스트가 그대로 읽는다.
 * 그리는 쪽은 Mirrors.jsx 다. */
export const MIRROR_PASS = Object.freeze({
  low: { width: 320, height: 120, every: 5 },
  medium: { width: 448, height: 168, every: 4 },
  high: { width: 512, height: 192, every: 2 },
});
export const FOV = 50;
export const FAR = 420;

/** 거울면이 텍스처에서 잘라 쓰는 영역이다. u 는 좌우, v 는 상하다. 룸미러가 가운데,
 * 사이드미러가 양 끝을 본다. 거울이라 u 를 뒤집어 붙여야 차 오른쪽이 거울 오른쪽에 온다. */
export const CROP = Object.freeze({
  rear: [0.22, 0.78, 0.25, 0.75],
  left: [0, 0.34, 0.2, 0.8],
  right: [0.66, 1, 0.2, 0.8],
});

/** 화면 기준 거울 자리다. 가상 거울(카메라 모니터) 처럼 기울기 없이 화면에 평평하게 띄운다.
 * x, y 는 화면 정규 좌표(-1 에서 1) 이고 height 는 화면 세로에 대한 비율이다.
 * 가로는 잘라 쓰는 텍스처 영역의 비율에서 나온다. 시선을 돌려도 자리가 바뀌지 않는다. */
export const MIRROR_LAYOUT = Object.freeze({
  rear: { x: 0, y: 0.84, height: 0.1 },
  left: { x: -0.8, y: 0.8, height: 0.15 },
  right: { x: 0.8, y: 0.8, height: 0.15 },
});

/** Mirrors.jsx 가 vehicle 계열별로 고르는 거울 자리 표다. 오토바이는 룸미러가 없어
 * 좌우 둘뿐이고, 라이더 몸과 헬멧 시야에 가리지 않게 화면 더 안쪽, 더 낮게 둔다. */
export const MIRROR_LAYOUTS = Object.freeze({
  car: MIRROR_LAYOUT,
  motorcycle: Object.freeze({
    left: { x: -0.62, y: 0.36, height: 0.13 },
    right: { x: 0.62, y: 0.36, height: 0.13 },
  }),
});

/** 거울 평면을 카메라 앞에 두는 거리다. 근접면 0.05 보다 멀고 실내 조각과 겹쳐도 깊이 검사를 꺼 늘 위에 그린다. */
export const MIRROR_DEPTH = 0.6;

/** 잘라 쓰는 영역의 가로세로비다. 거울 평면의 비율이 이것과 같아야 그림이 눌리지 않는다. */
export function cropAspect(key, pass = MIRROR_PASS.medium) {
  const [u0, u1, v0, v1] = CROP[key];
  return ((u1 - u0) * pass.width) / ((v1 - v0) * pass.height);
}

/** 뒤 카메라 자리다. 차체 원점 기준이며 차마다 뒤 유리 높이가 다르다. 카메라는 +Z 를 본다. */
export const REAR_CAMERA = Object.freeze({
  sedan: [0, 0.75, 2.2], suv: [0, 1.0, 2.3], convertible: [0, 0.6, 2.0], truck: [0, 2.1, -1.6],
  // 라이더 몸을 피하려 승용차보다 조금 높게 둔다.
  motorcycle: [0, 0.75, 0.6],
});

export function hasMirrors(vehicle) {
  return vehicle in REAR_CAMERA;
}
