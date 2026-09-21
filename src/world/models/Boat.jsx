/** 바다를 도는 배 셋(돛단배, 여객선, 화물선) 이다. Ocean.jsx 의 물고기와 같은 규약을 쓴다.
 * 종류마다 instancedMesh 하나씩 총 세 개만 쓰고 매 프레임에는 인스턴스 행렬만 갱신한다.
 * 로컬 원점(y=0)은 boatPose 가 돌려주는 BOAT_Y 다. 선체 아래는 흘수만큼 물 밑으로 잠기고
 * 상부 구조는 물 위로 올라간다. heading 규약은 Sedan.jsx 와 같다. 앞(뱃머리)이 -Z 다.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { boatRoutes, boatPose } from '../../../shared/coast.js';

const HULL = '#3d4339';
const HULL_TRIM = '#5b6152';
const CABIN = '#e6e0cd';
const BRIDGE = '#cfd0c6';
const SAIL_CLOTH = '#efe9d8';
const MAST = '#8a7355';
const STACK = '#8a3b32';
const CONTAINER_RED = '#973b34';
const CONTAINER_BLUE = '#33607f';
const CONTAINER_GREEN = '#3f7a52';
const CONTAINER_MUSTARD = '#c98a2e';

/* coast.js 의 boatRoutes 가 내는 항로 여섯은 sail 3, ferry 2, cargo 1 로 고정이다.
 * low 는 종류마다 하나로 줄이고, medium 이상은 있는 만큼 다 쓴다. */
const BOAT_LIMITS = Object.freeze({
  low: { sail: 1, ferry: 1, cargo: 1 },
  medium: { sail: 2, ferry: 2, cargo: 1 },
  high: { sail: 3, ferry: 2, cargo: 1 },
});

/** 항로를 종류별로 나누고 quality 상한만큼만 남긴다. limits 에 없는 키는 전부 버린다. */
function groupBoatRoutes(routes, limits) {
  const counts = { sail: 0, ferry: 0, cargo: 0 };
  const groups = { sail: [], ferry: [], cargo: [] };
  routes.forEach((route) => {
    const limit = limits[route.kind] ?? 0;
    if (counts[route.kind] >= limit) return;
    counts[route.kind] += 1;
    groups[route.kind].push(route);
  });
  return groups;
}

/** BoxGeometry 와 CylinderGeometry 는 인덱스가 있고 ExtrudeGeometry 는 없다.
 * 섞인 채로 mergeGeometries 를 부르면 null 이 돌아오고 primitive 가 그걸 받아
 * 장면 전체가 터진다. 합치기 전에 전부 비인덱스로 맞춘다. */
function merge(parts) {
  const flat = parts.map((part) => {
    if (!part.index) return part;
    const plain = part.toNonIndexed();
    part.dispose();
    return plain;
  });
  const merged = mergeGeometries(flat, false);
  for (const part of flat) part.dispose();
  if (!merged) throw new Error('배 geometry 병합에 실패했다');
  return merged;
}

/** geometry 정점에 단색을 입힌다. mergeGeometries 로 합친 뒤에도 색이 살아 있다. */
function paint(geometry, color) {
  const rgb = new THREE.Color(color);
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = rgb.r; colors[i * 3 + 1] = rgb.g; colors[i * 3 + 2] = rgb.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function box(sx, sy, sz, x, y, z, color) {
  const geometry = new THREE.BoxGeometry(sx, sy, sz);
  geometry.translate(x, y, z);
  return paint(geometry, color);
}

/** 실린더를 밑면 기준으로 놓는다. baseY 는 바닥, 중심은 baseY + height/2 다. */
function cylinderFromBase(radius, height, x, baseY, z, color, segments = 8) {
  const geometry = new THREE.CylinderGeometry(radius, radius, height, segments);
  geometry.translate(x, baseY + height / 2, z);
  return paint(geometry, color);
}

/* Sedan.jsx 의 extrudeUpright 와 같은 규약이다. points 는 [z, y] 다. depth 만큼 X 로
 * 두께를 주고 두께 중심을 X=0 에 맞춘다. 돛처럼 얇고 평평한 판을 만들 때 쓴다. */
function panel(points, depth, color) {
  const shape = new THREE.Shape();
  points.forEach(([z, y], index) => (index ? shape.lineTo(z, y) : shape.moveTo(z, y)));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(-depth / 2, 0, 0);
  return paint(geometry, color);
}

/** 돛단배. 흘수 0.6, 마스트 꼭대기까지 수면 위 6.6. 전장 8, 전폭 2.2. */
function buildSail() {
  const parts = [
    box(2.2, 0.9, 8, 0, -0.15, 0, HULL),
    box(2.4, 0.14, 8.2, 0, 0.37, 0, HULL_TRIM),
    cylinderFromBase(0.07, 6.2, 0, 0.37, -1.6, MAST),
    // 마스트 앞쪽 활대(luff)에서 고물 쪽 갑판(leech)으로 떨어지는 삼각 돛이다.
    panel([[-1.6, 0.5], [-1.6, 6.3], [2.6, 0.9]], 0.08, SAIL_CLOTH),
  ];
  return merge(parts);
}

/** 여객선. 흘수 1.0, 굴뚝까지 수면 위 7.4. 전장 34, 전폭 7.
 * simple(저사양) 은 상부 구조를 선실 한 단으로 줄인다. */
function buildFerry(simple) {
  const parts = [
    box(7, 1.8, 34, 0, -0.1, 0, HULL),
    box(6, 2.4, 20, 0, 2.0, 2, CABIN),
  ];
  if (!simple) {
    parts.push(box(4.2, 1.8, 9, 0, 4.1, -2, BRIDGE));
    parts.push(cylinderFromBase(0.85, 2.4, 0, 5.0, 9, STACK));
  }
  return merge(parts);
}

const CONTAINER_SIZE = [2.2, 1.3, 2.2];
/* [x, 층, z, 색] 이다. 층 0 이 갑판에 바로 얹힌 첫 단, 1 이 그 위 둘째 단이다. */
const CARGO_CONTAINERS = [
  [-3, 0, -18, CONTAINER_RED], [3, 0, -18, CONTAINER_BLUE],
  [-3, 0, -12, CONTAINER_GREEN], [0, 0, -12, CONTAINER_MUSTARD], [3, 0, -12, CONTAINER_RED],
  [-3, 0, -6, CONTAINER_BLUE], [3, 0, -6, CONTAINER_GREEN],
  [-3, 1, -6, CONTAINER_RED], [3, 1, -6, CONTAINER_MUSTARD],
  [-3, 0, 0, CONTAINER_MUSTARD], [0, 0, 0, CONTAINER_BLUE], [3, 0, 0, CONTAINER_GREEN],
  [-3, 1, 0, CONTAINER_GREEN], [3, 1, 0, CONTAINER_RED],
  [-3, 0, 6, CONTAINER_BLUE], [3, 0, 6, CONTAINER_MUSTARD],
];

/** 화물선. 흘수 1.2, 선교까지 수면 위 5.1. 전장 54, 전폭 10.
 * simple(저사양) 은 컨테이너 열여섯 개 대신 화물 더미 한 덩이로 실루엣만 남긴다. */
function buildCargo(simple) {
  const deckY = 0.6;
  const parts = [
    box(10, 1.8, 54, 0, -0.3, 0, HULL),
    box(4.5, 4.5, 4.5, 0, deckY + 2.25, 22, BRIDGE),
  ];
  if (simple) {
    parts.push(box(8, 1.6, 26, 0, deckY + 0.8, -6, CONTAINER_BLUE));
  } else {
    CARGO_CONTAINERS.forEach(([x, layer, z, color]) => {
      const y = deckY + CONTAINER_SIZE[1] / 2 + layer * CONTAINER_SIZE[1];
      parts.push(box(CONTAINER_SIZE[0], CONTAINER_SIZE[1], CONTAINER_SIZE[2], x, y, z, color));
    });
  }
  return merge(parts);
}

export default function Boat({ extent, quality }) {
  const sailMesh = useRef(), ferryMesh = useRef(), cargoMesh = useRef();
  const transform = useMemo(() => new THREE.Object3D(), []);
  const limits = BOAT_LIMITS[quality] ?? BOAT_LIMITS.high;
  const simple = quality === 'low';

  const routes = useMemo(() => boatRoutes(extent), [extent]);
  const grouped = useMemo(() => groupBoatRoutes(routes, limits), [routes, limits]);

  const geometries = useMemo(() => ({
    sail: buildSail(),
    ferry: buildFerry(simple),
    cargo: buildCargo(simple),
  }), [simple]);
  useEffect(() => () => Object.values(geometries).forEach((geometry) => geometry.dispose()), [geometries]);

  const material = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }), []);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    [[sailMesh, grouped.sail], [ferryMesh, grouped.ferry], [cargoMesh, grouped.cargo]].forEach(([ref, list]) => {
      const mesh = ref.current;
      if (!mesh) return;
      list.forEach((route, i) => {
        const pose = boatPose(route, time);
        transform.position.set(pose.x, pose.y, pose.z);
        transform.rotation.set(0, pose.angle, 0);
        transform.updateMatrix();
        mesh.setMatrixAt(i, transform.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    });
  });

  return <>
    <instancedMesh ref={sailMesh} args={[null, null, grouped.sail.length]} frustumCulled={false}>
      <primitive object={geometries.sail} attach="geometry" dispose={null} />
      <primitive object={material} attach="material" dispose={null} />
    </instancedMesh>
    <instancedMesh ref={ferryMesh} args={[null, null, grouped.ferry.length]} frustumCulled={false}>
      <primitive object={geometries.ferry} attach="geometry" dispose={null} />
      <primitive object={material} attach="material" dispose={null} />
    </instancedMesh>
    <instancedMesh ref={cargoMesh} args={[null, null, grouped.cargo.length]} frustumCulled={false}>
      <primitive object={geometries.cargo} attach="geometry" dispose={null} />
      <primitive object={material} attach="material" dispose={null} />
    </instancedMesh>
  </>;
}
