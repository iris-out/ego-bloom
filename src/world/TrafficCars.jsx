/** 도시를 도는 AI 차량의 렌더러다. 위치는 traffic.js 가 계산하고 여기서는 instancing 만 맡는다.
 * 공유 geometry 와 material 은 WorldScene.useResources 의 것을 받아 쓰고 해제하지 않는다. */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { QUALITY } from './cityModels.js';
import { trafficFrame } from './traffic.js';

/** AI 차량 한 대의 조각 배치다. 로컬 +Z 가 진행 방향이고 도로 상판 윗면이 y 0.31 이다.
 * 차체 색은 인스턴스 색으로 실리므로 여기서는 크기와 자리만 정한다. */
const CAR_PARTS = Object.freeze({
  car: {
    hull: [{ y: 1.0, z: 0, s: [2.2, 0.75, 4.3] }, { y: 1.62, z: -0.15, s: [1.55, 0.55, 2.1] }],
    // 앞뒤 유리는 기울인 판이고 가운데 한 장이 옆유리로 삐져나온다.
    glass: [{ y: 1.62, z: -0.15, s: [1.92, 0.46, 2.0], tilt: 0 },
      { y: 1.66, z: 1.0, s: [1.75, 0.52, 0.08], tilt: -0.5 },
      { y: 1.66, z: -1.28, s: [1.7, 0.5, 0.08], tilt: 0.5 }],
    wheel: [[0.95, 1.42], [-0.95, 1.42], [0.95, -1.42], [-0.95, -1.42]],
    wheelSize: [0.35, 0.25],
    head: [{ x: 0.72, y: 1.0, z: 2.16, s: [0.5, 0.22, 0.1] }, { x: -0.72, y: 1.0, z: 2.16, s: [0.5, 0.22, 0.1] }],
    tail: [{ x: 0.78, y: 1.06, z: -2.16, s: [0.45, 0.2, 0.1] }, { x: -0.78, y: 1.06, z: -2.16, s: [0.45, 0.2, 0.1] }],
    cargo: null,
  },
  truck: {
    hull: [{ y: 1.15, z: 0, s: [2.7, 0.9, 7.4] }, { y: 2.1, z: 2.4, s: [2.5, 1.3, 2.2] }],
    glass: [{ y: 2.3, z: 3.45, s: [2.2, 0.8, 0.1], tilt: -0.18 },
      { y: 2.2, z: 2.4, s: [2.56, 0.7, 1.6], tilt: 0 },
      { y: 0, z: 0, s: [0, 0, 0], tilt: 0 }],
    wheel: [[1.25, 2.5], [-1.25, 2.5], [1.25, -2.0], [-1.25, -2.0]],
    wheelSize: [0.5, 0.32],
    head: [{ x: 0.95, y: 1.35, z: 3.6, s: [0.55, 0.26, 0.1] }, { x: -0.95, y: 1.35, z: 3.6, s: [0.55, 0.26, 0.1] }],
    tail: [{ x: 1.1, y: 1.3, z: -3.66, s: [0.5, 0.24, 0.1] }, { x: -1.1, y: 1.3, z: -3.66, s: [0.5, 0.24, 0.1] }],
    cargo: { y: 2.45, z: -0.9, s: [2.8, 2.7, 4.5] },
  },
});

/** 유리 기울기의 sin, cos 을 한 번만 구해 둔다. 매 프레임 차마다 삼각함수를 다시 부르지 않는다. */
const GLASS_TILT = Object.freeze(Object.fromEntries(Object.entries(CAR_PARTS).map(([kind, spec]) =>
  [kind, spec.glass.map((part) => [Math.sin(part.tilt), Math.cos(part.tilt)])])));

const CAR_COLORS = ['#eee8d8', '#bb785f', '#7298a0', '#d4b768', '#65747d'];

/** 이 높이를 넘으면 AI 차량을 그리지 않는다. 300m 상공에서 차 한 대는 두세 픽셀이다. */
const CAR_SKY_LIMIT = 240;

/** 인스턴스 행렬 한 칸을 바로 쓴다. 자리 (x, y, z), 방위 yaw 의 (sin, cos), 차체 기준 앞뒤 기울기(ts, tc),
 * 크기 (sx, sy, sz) 다. 행렬은 T * Ry(yaw) * Rx(tilt) * S 이고 three 의 열 우선 배열이다.
 * 기울기를 방위 뒤에 곱해야 어느 쪽을 달리든 유리가 차체 기준으로 눕는다. */
function place(te, slot, x, y, z, sin, cos, sx, sy, sz, ts = 0, tc = 1) {
  const o = slot * 16;
  te[o] = cos * sx; te[o + 1] = 0; te[o + 2] = -sin * sx; te[o + 3] = 0;
  te[o + 4] = sin * ts * sy; te[o + 5] = tc * sy; te[o + 6] = cos * ts * sy; te[o + 7] = 0;
  te[o + 8] = sin * tc * sz; te[o + 9] = -ts * sz; te[o + 10] = cos * tc * sz; te[o + 11] = 0;
  te[o + 12] = x; te[o + 13] = y; te[o + 14] = z; te[o + 15] = 1;
}

/** 바퀴는 원기둥 축(로컬 Y) 을 차의 좌우로 눕힌다. T * Ry(yaw) * Rz(PI/2) * S(r, w, r) 다. */
function placeWheel(te, slot, x, y, z, sin, cos, radius, width) {
  const o = slot * 16;
  te[o] = 0; te[o + 1] = radius; te[o + 2] = 0; te[o + 3] = 0;
  te[o + 4] = -cos * width; te[o + 5] = 0; te[o + 6] = sin * width; te[o + 7] = 0;
  te[o + 8] = sin * radius; te[o + 9] = 0; te[o + 10] = cos * radius; te[o + 11] = 0;
  te[o + 12] = x; te[o + 13] = y; te[o + 14] = z; te[o + 15] = 1;
}

/** 이번 프레임에 쓴 앞쪽 칸만 GPU 로 올린다. 0 칸일 때 범위를 넣으면 WebGL2 bufferSubData 가
 * 길이 0 을 끝까지로 읽어 버퍼 전체를 올리므로 그때는 올리지 않는다. */
function upload(attribute, used, size) {
  if (!attribute || !used) return;
  attribute.clearUpdateRanges();
  attribute.addUpdateRange(0, used * size);
  attribute.needsUpdate = true;
}

/** 매 프레임 앞쪽 칸만 고쳐 올리므로 동적 버퍼로 둔다. 인스턴스 색은 첫 렌더 전에 만들어 두어
 * 첫 차가 보이는 순간 셰이더가 인스턴스 색 판으로 다시 컴파일되지 않게 한다. 품질이 바뀌면
 * instancedMesh 가 새로 만들어지므로 객체마다 한 번 한다. */
function prepare(mesh, withColor) {
  if (!mesh || mesh.userData.trafficReady) return;
  mesh.userData.trafficReady = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  if (!withColor || mesh.instanceColor) return;
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count * 3).fill(1), 3);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
}

function open(mesh, used) {
  if (!mesh) return;
  mesh.count = used;
  upload(mesh.instanceMatrix, used, 16);
  upload(mesh.instanceColor, used, 3);
}

/** 차량마다 조각이 여럿이라 같은 재질끼리 instancedMesh 하나로 묶는다. 낮은 품질은
 * 바퀴와 전조등을 빼 draw call 을 넷으로 줄인다. 반경 밖 차량은 한 번만 접고 다시 쓰지 않는다. */
export default function TrafficCars({ resources, extent, quality, hiddenRef, night }) {
  const hull = useRef(), glass = useRef(), wheel = useRef(), tail = useRef(), head = useRef(), cargo = useRef();
  const count = QUALITY[quality].cars, detail = quality !== 'low';
  const colors = useMemo(() => CAR_COLORS.map((color) => new THREE.Color(color)), []);
  // 등화는 밤에 밝아진다. 재질은 공유 객체라 값만 고친다.
  useLayoutEffect(() => {
    resources.materials.tail.setValues({ emissiveIntensity: night ? 1.6 : 0.15 });
    resources.materials.head.setValues({ emissiveIntensity: night ? 2.4 : 0.1 });
  }, [resources, night]);
  // 도시별 차선 표는 처음 부를 때 30ms 쯤 걸린다. 비행하다 지상으로 처음 내려오는 순간 멈추지 않게
  // 한가할 때 미리 만든다. 조감 시점은 차를 계산하지 않으므로 이때가 아니면 첫 탑승에서 만든다.
  useEffect(() => {
    const idle = window.requestIdleCallback || ((work) => setTimeout(work, 300));
    const cancel = window.cancelIdleCallback || clearTimeout;
    const handle = idle(() => trafficFrame(count, 0, extent));
    return () => cancel(handle);
  }, [count, extent]);
  const radius = QUALITY[quality].carRadius;
  useFrame(({ clock, camera }) => {
    const hullMesh = hull.current, glassMesh = glass.current, cargoMesh = cargo.current, tailMesh = tail.current;
    if (!hullMesh || !glassMesh || !cargoMesh || !tailMesh) return;
    const wheelMesh = detail ? wheel.current : null, headMesh = detail ? head.current : null;
    prepare(hullMesh, true); prepare(tailMesh, true); prepare(glassMesh, false); prepare(cargoMesh, false);
    prepare(wheelMesh, false); prepare(headMesh, false);
    // 보이는 차만 앞쪽 슬롯에 몰아 담고 instancedMesh.count 를 거기까지만 연다.
    let live = 0, boxes = 0;
    // 상공에서는 차 한 대가 몇 픽셀도 안 된다. 비행 중에는 통째로 끄고 위치도 계산하지 않는다.
    if (camera.position.y < CAR_SKY_LIMIT) {
      // 위치는 traffic.js 가 한 프레임에 한 번 계산한다. 도보, 주행, 비행 판정이 같은 시각으로 같은 표를 읽는다.
      const frame = trafficFrame(count, clock.elapsedTime, extent);
      const hullAt = hullMesh.instanceMatrix.array, glassAt = glassMesh.instanceMatrix.array;
      const cargoAt = cargoMesh.instanceMatrix.array, tailAt = tailMesh.instanceMatrix.array;
      const wheelAt = wheelMesh?.instanceMatrix.array, headAt = headMesh?.instanceMatrix.array;
      const paintAt = hullMesh.instanceColor.array, litAt = tailMesh.instanceColor.array;
      const cx = camera.position.x, cz = camera.position.z, reach = radius * radius;
      // 부서진 차 목록은 ref 다. state 로 두면 한 대 부술 때마다 도시 전체가 다시 조정된다.
      const hidden = hiddenRef?.current;
      for (let i = 0; i < frame.count; i++) {
        if (hidden?.has(i)) continue;
        const x = frame.x[i], z = frame.z[i], dx = x - cx, dz = z - cz;
        if (dx * dx + dz * dz > reach) continue;
        const slot = live++;
        const angle = frame.angle[i], sin = Math.sin(angle), cos = Math.cos(angle);
        const truck = frame.truck[i] === 1, spec = truck ? CAR_PARTS.truck : CAR_PARTS.car;
        // 로컬 +Z 가 진행 방향이다. 로컬 (lx, lz) 는 월드 (x + cos*lx + sin*lz, z - sin*lx + cos*lz) 로 간다.
        const paint = colors[i % colors.length];
        for (let p = 0; p < 2; p++) {
          const part = spec.hull[p], at = slot * 2 + p;
          place(hullAt, at, x + sin * part.z, part.y, z + cos * part.z, sin, cos, part.s[0], part.s[1], part.s[2]);
          // 슬롯이 매 프레임 바뀌므로 차체 색도 여기서 같이 쓴다.
          paintAt[at * 3] = paint.r; paintAt[at * 3 + 1] = paint.g; paintAt[at * 3 + 2] = paint.b;
        }
        const tilts = truck ? GLASS_TILT.truck : GLASS_TILT.car;
        for (let p = 0; p < 3; p++) {
          const part = spec.glass[p];
          place(glassAt, slot * 3 + p, x + sin * part.z, part.y, z + cos * part.z, sin, cos, part.s[0], part.s[1], part.s[2], tilts[p][0], tilts[p][1]);
        }
        const boot = spec.cargo;
        if (boot) place(cargoAt, boxes++, x + sin * boot.z, boot.y, z + cos * boot.z, sin, cos, boot.s[0], boot.s[1], boot.s[2]);
        // 브레이크등은 밟으면 커지고 밝아진다. 인스턴스 색은 확산색만 바꾸므로 크기도 함께 키운다.
        const braking = frame.braking[i], lit = 0.45 + braking * 0.55, grow = 1 + braking * 0.35;
        for (let p = 0; p < 2; p++) {
          const part = spec.tail[p], at = slot * 2 + p;
          place(tailAt, at, x + cos * part.x + sin * part.z, part.y, z - sin * part.x + cos * part.z, sin, cos, part.s[0] * grow, part.s[1] * grow, part.s[2]);
          litAt[at * 3] = lit; litAt[at * 3 + 1] = lit; litAt[at * 3 + 2] = lit;
        }
        if (!wheelAt || !headAt) continue;
        const radiusOf = spec.wheelSize[0], widthOf = spec.wheelSize[1];
        for (let p = 0; p < 4; p++) {
          const lx = spec.wheel[p][0], lz = spec.wheel[p][1];
          placeWheel(wheelAt, slot * 4 + p, x + cos * lx + sin * lz, 0.31 + radiusOf, z - sin * lx + cos * lz, sin, cos, radiusOf, widthOf);
        }
        for (let p = 0; p < 2; p++) {
          const part = spec.head[p];
          place(headAt, slot * 2 + p, x + cos * part.x + sin * part.z, part.y, z - sin * part.x + cos * part.z, sin, cos, part.s[0], part.s[1], part.s[2]);
        }
      }
    }
    open(hullMesh, live * 2); open(glassMesh, live * 3); open(cargoMesh, boxes); open(tailMesh, live * 2);
    if (wheelMesh && headMesh) { open(wheelMesh, live * 4); open(headMesh, live * 2); }
  });
  return <>
    <instancedMesh ref={hull} args={[resources.geometries.box, resources.materials.car, count * 2]} frustumCulled={false} dispose={null} />
    <instancedMesh ref={glass} args={[resources.geometries.box, resources.materials.glass, count * 3]} frustumCulled={false} dispose={null} />
    <instancedMesh ref={cargo} args={[resources.geometries.box, resources.materials.sand, count]} frustumCulled={false} dispose={null} />
    <instancedMesh ref={tail} args={[resources.geometries.box, resources.materials.tail, count * 2]} frustumCulled={false} dispose={null} />
    {detail && <instancedMesh ref={wheel} args={[resources.geometries.cylinder, resources.materials.dark, count * 4]} frustumCulled={false} dispose={null} />}
    {detail && <instancedMesh ref={head} args={[resources.geometries.box, resources.materials.head, count * 2]} frustumCulled={false} dispose={null} />}
  </>;
}
