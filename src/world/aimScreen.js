import { Vector3 } from 'three';

/** 조준선이 화면 어디에 맺히는지 푸는 순수 모듈이다. 포구 위치와 발사 방향, 목표 거리,
 * 카메라만 있으면 되고 React, DOM, 게임 상태를 읽지 않는다.
 *
 * 카메라에서 읽는 것은 matrixWorldInverse 와 projectionMatrix 둘뿐이다. 부르기 전에
 * camera.updateMatrixWorld() 로 역행렬을 새로 맞춰야 그 프레임에 옮긴 카메라 자세가 반영된다.
 * 렌더러는 한 프레임 뒤에 맞추므로 그대로 두면 조준선이 한 프레임 늦는다.
 */

/** 화면 밖으로 나간 조준선을 붙잡아 두는 여백(픽셀) 이다. */
export const AIM_MARGIN = 24;
/** 카메라 앞이라고 볼 최소 깊이다. 렌즈에 붙은 점은 투영이 발산한다. */
const MIN_DEPTH = 1e-3;

// 프레임마다 새 벡터를 만들지 않는다. 투영은 한 번에 한 점씩만 푼다.
const probe = new Vector3();
const finite = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback);

/** origin + forward * distance 를 카메라로 투영해 화면 왼쪽 위 기준 픽셀을 준다.
 * viewport 는 캔버스의 화면 상자({ width, height, left, top }) 이고 margin 으로 여백을 바꾼다.
 * 화면 밖이면 여백 안으로 끌어 놓고 clamped 를, 카메라 뒤면 behind 를 켠다. */
export function projectAim(camera, origin, forward, distance = 0, viewport = {}) {
  const width = Math.max(1, finite(viewport.width, 1));
  const height = Math.max(1, finite(viewport.height, 1));
  const left = finite(viewport.left), top = finite(viewport.top);
  const margin = Math.max(0, Math.min(finite(viewport.margin, AIM_MARGIN), Math.min(width, height) / 2));
  const center = { x: left + width / 2, y: top + height / 2, behind: false, clamped: false };
  if (!camera?.matrixWorldInverse || !camera?.projectionMatrix) return center;

  const reach = finite(distance);
  probe.set(
    finite(origin?.x) + finite(forward?.x) * reach,
    finite(origin?.y) + finite(forward?.y) * reach,
    finite(origin?.z) + finite(forward?.z) * reach,
  );
  probe.applyMatrix4(camera.matrixWorldInverse);
  // three 카메라는 -Z 를 본다. 시야 좌표 z 가 음수여야 앞이다.
  const behind = !(probe.z < -MIN_DEPTH);
  probe.applyMatrix4(camera.projectionMatrix);
  if (!Number.isFinite(probe.x) || !Number.isFinite(probe.y)) return { ...center, behind: true, clamped: true };

  // 카메라 뒤 점은 원근 나눗셈에서 w 가 음수라 좌우 위아래가 뒤집힌다. 되돌려 두어야
  // 숨기지 않고 그릴 때도 엉뚱한 모서리에 붙지 않는다.
  const flip = behind ? -1 : 1;
  const rawX = left + (probe.x * flip * 0.5 + 0.5) * width;
  const rawY = top + (0.5 - probe.y * flip * 0.5) * height;
  const x = Math.min(left + width - margin, Math.max(left + margin, rawX));
  const y = Math.min(top + height - margin, Math.max(top + margin, rawY));
  return { x, y, behind, clamped: x !== rawX || y !== rawY };
}
