/** 1인칭 뷰모델의 자세 계산이다. 순수 함수이며 Three, React 에 의존하지 않는다.
 *
 * 뷰모델 계층은 루트(P) > 앵커(A) > 배율(s) > 총 로컬(L) 이라 화면 좌표가 P + A + s*L 이다.
 * 정조준에서 가늠쇠가 화면 정중앙에 오려면 루트 위치를 역산해야 한다. 예전에는 정조준
 * 자세가 총마다 같은 상수라, 조준기 높이와 좌우가 다른 총에서 조준점과 화면 조준선이
 * 어긋나 있었다.
 */

/** 총을 잡는 앵커다. WeaponView 의 각 무기 group 위치와 같은 값이다. */
export const ANCHOR = Object.freeze({
  pistol: [-0.02, -0.02, -0.18],
  smg: [-0.02, -0.02, -0.45],
  sniper: [-0.02, -0.02, -0.45],
  shotgun: [-0.02, -0.02, -0.46],
});

/** 허리에서 드는 자세의 크기다. 화면 구석에서 존재감을 준다. */
export const HIP_SCALE = Object.freeze({ pistol: 1.02, smg: 0.98, sniper: 1.08, shotgun: 1.05 });

/** 정조준 크기다. 화면 중앙으로 당겨오며 화각도 함께 좁아지므로 허리 자세보다 작게 잡는다. */
export const ADS_SCALE = Object.freeze({ pistol: 0.72, smg: 0.68, sniper: 0.78, shotgun: 0.74 });

/** 허리 자세다. 화면 오른쪽 아래에 눈에 가깝게 든다. z 가 멀면 총이 장난감처럼 떠 보인다. */
export const HIP_REST = Object.freeze([0.21, -0.24, -0.4]);

/** 정조준 깊이다. 좌우와 위아래는 총마다 가늠쇠 자리에서 계산한다. */
export const ADS_DEPTH = -0.34;

/** 조준선과 겹쳐야 하는 총의 한 점이다. 총 로컬 좌표이며 각 모델의 실제 조준기 자리에서 따왔다.
 * 모델의 조준기를 옮기면 이 표도 같이 옮긴다. */
export const SIGHT_POINT = Object.freeze({
  // 권총 가늠쇠는 슬라이드 윗면 앞쪽이다.
  pistol: [0, 0.055, -0.2],
  // 기관단총은 상부 레일에 얹은 도트 사이트 렌즈 한가운데다.
  smg: [0, 0.155, -0.06],
  // 저격총은 조준경 접안렌즈 축이다.
  sniper: [0, 0.14, -0.1],
  // 산탄총은 별도 가늠자 없이 총열 끝의 비드 사이트 하나뿐이다.
  shotgun: [0, 0.1, -0.74],
});

/** 정조준 루트 위치다. 이 자리에 두면 가늠쇠가 화면 (0, 0) 에 온다. */
export function adsRest(weapon) {
  const anchor = ANCHOR[weapon], sight = SIGHT_POINT[weapon];
  if (!anchor || !sight) return [0, 0, ADS_DEPTH];
  const scale = ADS_SCALE[weapon] ?? 1;
  return [-(anchor[0] + sight[0] * scale), -(anchor[1] + sight[1] * scale), ADS_DEPTH];
}

/** 주어진 자세에서 가늠쇠가 놓이는 화면 좌표다. 테스트가 정렬을 확인할 때 쓴다. */
export function sightScreenPoint(weapon, root, scale) {
  const anchor = ANCHOR[weapon], sight = SIGHT_POINT[weapon];
  if (!anchor || !sight) return null;
  const size = Number.isFinite(scale) ? scale : ADS_SCALE[weapon] ?? 1;
  return [root[0] + anchor[0] + sight[0] * size, root[1] + anchor[1] + sight[1] * size];
}

/** 정조준에서 레드도트를 쓰는 무기다. 도트 사이트를 단 기관단총만 해당한다.
 * 저격총은 전용 조준경 화면을 쓰고, 권총은 쇠 가늠쇠라 십자를 그대로 둔다. */
export function usesRedDot(weapon) {
  return weapon === 'smg';
}
