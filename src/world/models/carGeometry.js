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

const freezePoint = (point) => Object.freeze(point);
const freezePane = (points) => Object.freeze(points.map(freezePoint));

const SEDAN_WINDSHIELD = freezePane([
  [-0.75, 0.312, -1.006], [0.75, 0.312, -1.006],
  [0.70, 0.831, -0.667], [-0.70, 0.831, -0.667],
]);
const SUV_WINDSHIELD = freezePane([
  [-0.83, 0.337, -1.406], [0.83, 0.337, -1.406],
  [0.78, 1.145, -1.045], [-0.78, 1.145, -1.045],
]);

/** Sedan/SUV 외장과 실내가 함께 읽는 작은 형상 명세다. 유리 점은 차체 절대 좌표다. */
export const VEHICLE_SHAPES = Object.freeze({
  sedan: Object.freeze({
    beltY: 0.30, sillY: -0.64, skinX: 0.98, skinDepth: 0.08,
    zMin: -2.45, zMax: 2.45, roofMax: 0.89,
    wheels: Object.freeze({ y: -0.48, z: Object.freeze([-1.55, 1.55]), radius: 0.47 }),
    sideUpper: Object.freeze([
      Object.freeze([-2.45, 0.16, 0.98]), Object.freeze([-2.18, 0.21, 0.97]), Object.freeze([-1.01, 0.30, 1.03]),
      Object.freeze([1.58, 0.30, 1.03]), Object.freeze([2.22, 0.15, 0.95]), Object.freeze([2.45, 0.12, 0.98]),
    ]),
    windshield: SEDAN_WINDSHIELD,
    sideWindows: Object.freeze({
      left: Object.freeze({
        front: freezePane([SEDAN_WINDSHIELD[0], SEDAN_WINDSHIELD[3], [-0.77, 0.855, 0.12], [-0.82, 0.30, 0.12]]),
        rear: freezePane([[-0.82, 0.30, 0.18], [-0.77, 0.855, 0.18], [-0.68, 0.82, 0.88], [-0.82, 0.30, 1.45]]),
      }),
    }),
    rearWindow: freezePane([[-0.75, 0.30, 1.58], [0.75, 0.30, 1.58], [0.68, 0.82, 0.88], [-0.68, 0.82, 0.88]]),
    roofSections: Object.freeze([
      Object.freeze({ z: -0.67, width: 0.72, lowerY: 0.81, shoulderY: 0.84, topWidth: 0.63, topY: 0.85, crown: 0.012 }),
      Object.freeze({ z: -0.32, width: 0.77, lowerY: 0.84, shoulderY: 0.86, topWidth: 0.67, topY: 0.875, crown: 0.012 }),
      Object.freeze({ z: 0.05, width: 0.79, lowerY: 0.85, shoulderY: 0.87, topWidth: 0.69, topY: 0.88, crown: 0.01 }),
      Object.freeze({ z: 0.48, width: 0.76, lowerY: 0.83, shoulderY: 0.85, topWidth: 0.66, topY: 0.865, crown: 0.01 }),
      Object.freeze({ z: 0.92, width: 0.68, lowerY: 0.78, shoulderY: 0.81, topWidth: 0.60, topY: 0.825, crown: 0.01 }),
    ]),
  }),
  suv: Object.freeze({
    beltY: 0.46, sillY: -0.52, skinX: 1.05, skinDepth: 0.10,
    zMin: -2.40, zMax: 2.40, roofMax: 1.19,
    wheels: Object.freeze({ y: -0.42, z: Object.freeze([-1.60, 1.65]), radius: 0.53 }),
    sideUpper: Object.freeze([
      Object.freeze([-2.40, 0.34, 1.04]), Object.freeze([-2.15, 0.36, 1.06]), Object.freeze([-1.40, 0.46, 1.10]),
      Object.freeze([2.00, 0.46, 1.10]), Object.freeze([2.40, 0.34, 1.04]),
    ]),
    windshield: SUV_WINDSHIELD,
    sideWindows: Object.freeze({
      left: Object.freeze({
        front: freezePane([SUV_WINDSHIELD[0], SUV_WINDSHIELD[3], [-0.91, 1.17, 0.28], [-0.93, 0.46, 0.28]]),
        rear: freezePane([[-0.93, 0.46, 0.34], [-0.91, 1.17, 0.34], [-0.88, 1.14, 1.24], [-0.93, 0.46, 1.24]]),
        quarter: freezePane([[-0.93, 0.46, 1.31], [-0.88, 1.14, 1.31], [-0.80, 0.66, 1.94], [-0.92, 0.46, 1.94]]),
      }),
    }),
    rearWindow: freezePane([[-0.80, 0.45, 2.00], [0.80, 0.45, 2.00], [0.72, 1.12, 1.34], [-0.72, 1.12, 1.34]]),
    roofSections: Object.freeze([
      Object.freeze({ z: -1.045, width: 0.80, lowerY: 1.13, shoulderY: 1.16, topWidth: 0.72, topY: 1.175, crown: 0.01 }),
      Object.freeze({ z: 0.40, width: 0.91, lowerY: 1.13, shoulderY: 1.16, topWidth: 0.82, topY: 1.17, crown: 0.02 }),
      Object.freeze({ z: 1.34, width: 0.84, lowerY: 1.09, shoulderY: 1.12, topWidth: 0.75, topY: 1.14, crown: 0.02 }),
    ]),
  }),
});

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

/** Z축 단면들을 이어 차체처럼 폭과 높이가 연속으로 변하는 닫힌 셸을 만든다.
 * 각 단면은 아래 모서리, 벨트라인, 윗면 베벨의 세 폭/높이를 가진다. */
export function loftBody(sections) {
  const ring = (section) => [
    [-(section.bottomWidth ?? section.width * 0.88), section.lowerY],
    [-section.width, section.lowerY + Math.max(0, Math.min(0.08, (section.shoulderY - section.lowerY) * 0.45))],
    [-section.width, section.shoulderY],
    [-section.topWidth, section.topY],
    [-section.topWidth * 0.42, section.topY + (section.crown ?? 0.025)],
    [section.topWidth * 0.42, section.topY + (section.crown ?? 0.025)],
    [section.topWidth, section.topY],
    [section.width, section.shoulderY],
    [section.width, section.lowerY + Math.max(0, Math.min(0.08, (section.shoulderY - section.lowerY) * 0.45))],
    [(section.bottomWidth ?? section.width * 0.88), section.lowerY],
  ];
  const positions = [];
  for (const section of sections) {
    for (const [x, y] of ring(section)) positions.push(x, y, section.z);
  }
  const indices = [];
  const stride = 10;
  for (let section = 0; section < sections.length - 1; section += 1) {
    const current = section * stride;
    const next = current + stride;
    for (let edge = 0; edge < stride; edge += 1) {
      const after = (edge + 1) % stride;
      indices.push(current + edge, next + edge, next + after, current + edge, next + after, current + after);
    }
  }
  for (let edge = 1; edge < stride - 1; edge += 1) indices.push(0, edge, edge + 1);
  const end = (sections.length - 1) * stride;
  for (let edge = 1; edge < stride - 1; edge += 1) indices.push(end, end + edge + 1, end + edge);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function mergeGeometryParts(parts) {
  const positions = [], normals = [], indices = [];
  let offset = 0;
  for (const geometry of parts) {
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    for (const value of position.array) positions.push(value);
    for (const value of normal.array) normals.push(value);
    const index = geometry.getIndex();
    if (index) for (const value of index.array) indices.push(value + offset);
    else for (let value = 0; value < position.count; value += 1) indices.push(value + offset);
    offset += position.count;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return geometry;
}

function archSideProfile(shape) {
  const points = shape.sideUpper.map(([z, y]) => [z, y]);
  points.push([shape.zMax, shape.sillY]);
  const { y: wheelY, radius } = shape.wheels;
  const ratio = Math.max(-0.98, Math.min(0.98, (shape.sillY - wheelY) / radius));
  const start = Math.asin(ratio);
  const end = Math.PI - start;
  for (const centerZ of [...shape.wheels.z].sort((a, b) => b - a)) {
    for (let step = 0; step <= 12; step += 1) {
      const angle = start + (end - start) * (step / 12);
      points.push([centerZ + Math.cos(angle) * radius, wheelY + Math.sin(angle) * radius]);
    }
  }
  points.push([shape.zMin, shape.sillY]);
  return points;
}

function sideMagnitudeAt(shape, z) {
  const rows = shape.sideUpper;
  if (z <= rows[0][0]) return rows[0][2];
  if (z >= rows[rows.length - 1][0]) return rows[rows.length - 1][2];
  for (let index = 0; index < rows.length - 1; index += 1) {
    const a = rows[index], b = rows[index + 1];
    if (z < a[0] || z > b[0]) continue;
    const t = (z - a[0]) / (b[0] - a[0]);
    return a[2] + (b[2] - a[2]) * t;
  }
  return shape.skinX;
}

function taperedSideSkin(shape) {
  const profile = archSideProfile(shape);
  const contour = profile.map(([z, y]) => new THREE.Vector2(z, y));
  const faces = THREE.ShapeUtils.triangulateShape(contour, []);
  const positions = [], normals = [], indices = [];
  for (const side of [-1, 1]) {
    const base = positions.length / 3;
    for (const layer of [0, 1]) {
      for (const [z, y] of profile) {
        const outer = sideMagnitudeAt(shape, z);
        const magnitude = layer === 0 ? outer : outer - shape.skinDepth;
        positions.push(side * magnitude, y, z);
        normals.push(layer === 0 ? side : -side, 0, 0);
      }
    }
    const count = profile.length;
    for (const [a, b, c] of faces) {
      if (side < 0) {
        indices.push(base + a, base + b, base + c, base + count + a, base + count + c, base + count + b);
      } else {
        indices.push(base + a, base + c, base + b, base + count + a, base + count + b, base + count + c);
      }
    }
    for (let index = 0; index < count; index += 1) {
      const next = (index + 1) % count;
      indices.push(base + index, base + next, base + count + next, base + index, base + count + next, base + count + index);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  // 옆판은 z에 따라 폭이 변하지만 페인트 면의 조명은 큰 삼각형마다 갈라지지 않도록
  // 바깥/안쪽 법선을 각각 옆 방향으로 고정한다. 얇은 경계도 같은 면에 묻힌다.
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return geometry;
}

function pairedDeckGeometry(rows) {
  const parts = [-1, 1].map((side) => {
    const positions = [];
    for (const [z, innerX, innerY, outerX, outerY] of rows) {
      positions.push(side * innerX, innerY, z, side * outerX, outerY, z);
    }
    const geometry = new THREE.BufferGeometry(), indices = [];
    for (let index = 0; index < rows.length - 1; index += 1) {
      const at = index * 2, next = at + 2;
      if (side < 0) indices.push(at, next, next + 1, at, next + 1, at + 1);
      else indices.push(at, next + 1, next, at, at + 1, next + 1);
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  });
  const geometry = mergeGeometryParts(parts);
  parts.forEach(part => part.dispose());
  return geometry;
}

function translatedBox(width, height, depth, x, y, z) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  geometry.translate(x, y, z);
  return geometry;
}

/** 중앙 승객 공간은 비우고 바닥, 좁은 중앙 보닛/테일, 휠 아치가 뚫린 얇은 옆판을 만든다. */
export function createVehicleBodyGeometries(vehicle) {
  const shape = VEHICLE_SHAPES[vehicle];
  if (!shape) throw new Error(`Unknown vehicle body: ${vehicle}`);
  const sideSkin = taperedSideSkin(shape);

  const sedan = vehicle === 'sedan';
  const floor = translatedBox(sedan ? 1.72 : 1.86, sedan ? 0.08 : 0.07, sedan ? 3.42 : 3.64, 0, sedan ? -0.68 : -0.55, 0.04);
  const frontDeck = pairedDeckGeometry(sedan ? [
    [-2.45, 0.86, 0.16, 0.98, 0.16], [-2.18, 0.84, 0.21, 0.97, 0.21], [-1.01, 0.76, 0.30, 1.03, 0.30],
  ] : [
    [-2.40, 0.68, 0.34, 1.04, 0.34], [-2.15, 0.76, 0.36, 1.06, 0.36], [-1.40, 0.78, 0.39, 1.10, 0.46],
  ]);
  const rearDeck = pairedDeckGeometry(sedan ? [
    [1.58, 0.75, 0.23, 1.03, 0.30], [2.22, 0.84, 0.15, 0.95, 0.15], [2.45, 0.90, 0.12, 0.98, 0.12],
  ] : [
    [2.00, 0.76, 0.48, 1.10, 0.46], [2.40, 0.68, 0.34, 1.04, 0.34],
  ]);
  const hood = loftBody(sedan ? [
    { z: -2.45, width: 0.90, lowerY: -0.58, shoulderY: 0.08, topWidth: 0.86, topY: 0.16 },
    { z: -2.18, width: 0.90, lowerY: -0.62, shoulderY: 0.12, topWidth: 0.84, topY: 0.21 },
    { z: -1.01, width: 0.78, lowerY: -0.62, shoulderY: 0.22, topWidth: 0.76, topY: 0.30 },
  ] : [
    { z: -2.40, width: 0.88, lowerY: -0.54, shoulderY: 0.22, topWidth: 0.68, topY: 0.34 },
    { z: -2.15, width: 0.88, lowerY: -0.55, shoulderY: 0.25, topWidth: 0.76, topY: 0.36 },
    { z: -1.40, width: 0.80, lowerY: -0.55, shoulderY: 0.31, topWidth: 0.78, topY: 0.39 },
  ]);
  const tail = loftBody(sedan ? [
    { z: 1.58, width: 0.78, lowerY: -0.62, shoulderY: 0.17, topWidth: 0.75, topY: 0.23 },
    { z: 2.22, width: 0.88, lowerY: -0.60, shoulderY: 0.03, topWidth: 0.84, topY: 0.15 },
    { z: 2.45, width: 0.95, lowerY: -0.54, shoulderY: 0.02, topWidth: 0.90, topY: 0.12 },
  ] : [
    { z: 2.00, width: 0.80, lowerY: -0.55, shoulderY: 0.42, topWidth: 0.76, topY: 0.48 },
    { z: 2.40, width: 0.88, lowerY: -0.53, shoulderY: 0.22, topWidth: 0.68, topY: 0.34 },
  ]);
  return { floor, hood, tail, sideSkin, frontDeck, rearDeck };
}

/** 네 모서리를 두 삼각형으로 잇는 얇은 양면 판 geometry다. */
export function quadGeometry(corners) {
  const positions = corners.flat();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return geometry;
}

/** XY 윤곽을 한 장의 후면 패널로 삼는다. z 는 차량 뒤쪽 면의 절대 좌표다. */
export function flatPolygonGeometry(points, z) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], index) => (index ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.translate(0, 0, z);
  geometry.computeVertexNormals();
  return geometry;
}

/** 로컬 +Y 박스를 두 점 사이에 놓는 position/quaternion/length다. */
export function beamBetween(a, b) {
  const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
  const direction = to.clone().sub(from);
  return {
    position: from.add(to).multiplyScalar(0.5).toArray(),
    quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()).toArray(),
    length: direction.length(),
  };
}

/** 조향 바퀴 두 개와 고정 바퀴 축들을 굴린다. steerRefs 는 rotation.y, wheelRefs 는 rotation.x 를 받는다. */
export function rollWheels(wheels, delta, speed) {
  const step = Math.min(delta, MAX_STEP) * speed;
  wheels.forEach((wheel) => {
    if (wheel) wheel.rotation.x = (wheel.rotation.x + step) % TWO_PI;
  });
}
