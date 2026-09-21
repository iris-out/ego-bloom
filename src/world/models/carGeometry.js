import * as THREE from 'three';

/** 승용차 계열이 함께 쓰는 팔레트와 순수 헬퍼다. 컴포넌트는 carParts.jsx 에 있다. */
const HALF_PI = Math.PI / 2;
const TWO_PI = Math.PI * 2;

export const CAR_PALETTE = Object.freeze({
  tire: '#2a3134', rim: '#c7ccce', trim: '#8e979b', headLamp: '#ffe6a0', tailLamp: '#d94f3d',
  grille: '#3a4245', plate: '#dfe2e0', exhaust: '#5b6467', disc: '#9a9d9e', caliper: '#7a352c',
  glass: '#385c6d', cabinDark: '#3a3f42', cabinDark2: '#4a5054', leather: '#5a5450', bezel: '#2a3134',
});
export const GLASS_OPACITY = 0.45;
export const MAX_STEER = 0.5;
export const MAX_STEP = 0.05;

/** 앞바퀴 조향 group 의 Y 회전이다. 부호는 한 곳에서만 정한다.
 * carPhysics 의 steer 는 +1 이 우회전(D) 이고 `heading -= turn` 으로 기수를 오른쪽으로 돌린다.
 * 모델의 전진은 -Z 라 yaw θ 의 진행 방향이 (-sinθ, -cosθ) 다. 오른쪽(+X) 을 가리키려면
 * θ 가 음수여야 하므로 steer 에 음수를 곱한다. 양수로 두면 바퀴가 도는 쪽의 반대를 가리킨다. */
export function steerAngle(steer, max = MAX_STEER) {
  return -Math.max(-1, Math.min(1, Number(steer) || 0)) * max;
}

/* Helicopter.jsx 의 extrudeUpright 와 같은 규약이다. shape 의 x 는 Z 축, y 는 Y 축, 두께는 X 로 가운데 정렬한다. */
export function extrudeUpright(points, depth) {
  const shape = new THREE.Shape();
  points.forEach(([z, y], index) => (index ? shape.lineTo(z, y) : shape.moveTo(z, y)));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geometry.rotateY(-HALF_PI);
  geometry.translate(depth / 2, 0, 0);
  return geometry;
}

/** 조향 바퀴 두 개와 고정 바퀴 축들을 굴린다. steerRefs 는 rotation.y, wheelRefs 는 rotation.x 를 받는다. */
export function rollWheels(wheels, delta, speed) {
  const step = Math.min(delta, MAX_STEP) * speed;
  wheels.forEach((wheel) => {
    if (wheel) wheel.rotation.x = (wheel.rotation.x + step) % TWO_PI;
  });
}
