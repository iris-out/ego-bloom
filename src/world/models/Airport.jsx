import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import PlaneModel from './PlaneModel';
import StaticBatch from '../StaticBatch';
import { freezeStatic } from '../cityTiles.js';
import { AIRPORT_GROUND, AIRPORT_ROAD, FACILITIES } from './airportLayout.js';

/** Visual airport, translated to world X=extent+110. Runway is 28 x 540.
 * 시설 좌표와 충돌 상자는 airportLayout.js 가 낸다. 여기서는 그 좌표에 모양만 입힌다.
 * 활주로 중심선 기준 로컬 x -20 보다 서쪽에 터미널 단지가 서고 그 사이 x -25 에 유도로가 있다.
 * 헬리패드는 충돌 상자를 두지 않는다. 주차 기체는 조종사가 고른 모델을 다시 쓰고
 * 조종 중에는 숨긴다. 탑승동 게이트의 제트 두 대는 항상 같은 기종이다.
 *
 * 상자는 조각마다 mesh 를 두지 않고 정점 색을 가진 geometry 둘로 합친다. 그림자를 던지는 상자와
 * 받기만 하는 상자(구획선, 멀리언, 울타리)다. 색은 거칠기 0.8 인 재질의 색과 같은 값이다.
 * 공항 하나는 상자 둘, 유도등 셋, 나머지 시설과 게이트 제트를 합친 mesh 를 더해 draw 20여 개다.
 */

/** 활주로 가장자리, 착륙대, 진입등이다. 가로등 전구와 같은 색으로, 밤에만 밝게 켠다. */
function RunwayLights({ parts, color, night }) {
  const ref = useRef(), material = useRef();
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    parts.forEach(([position, scale], index) => {
      dummy.position.fromArray(position); dummy.scale.fromArray(scale); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
      ref.current.setMatrixAt(index, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [parts]);
  useLayoutEffect(() => { material.current.emissiveIntensity = night ? 3.4 : 0.15; }, [night]);
  return <instancedMesh ref={ref} args={[undefined, undefined, parts.length]}>
    <sphereGeometry args={[1, 6, 6]} />
    <meshStandardMaterial ref={material} color={color} emissive={color} emissiveIntensity={0.15} toneMapped={false} />
  </instancedMesh>;
}

const GLASS_DEEP = '#6b939e';
const GLASS_PALE = '#88b5cd';
const FRAME = '#64777b';
const IVORY = '#e8e3d6';
const ASPHALT = '#68777b';
const APRON = '#a1aaa6';
const GRASS = '#a8bc9a';
const HANGAR = '#b9c2bf';
const HANGAR_ROOF = '#8d9a99';
const CARGO = '#c9c4b3';
const RED = '#c9443a';
const STEEL = '#9aa5a8';

const at = (key) => FACILITIES.find((facility) => facility.key === key);

/** 공항의 상자 조각이다. 로컬 좌표이고 extent 와 무관하다. solid 는 그림자를 던지고 받는 상자,
 * flat 은 받기만 하는 반복 조각이다. 조각은 [position, scale, color, rotation] 이다. */
function airportBoxes() {
  const terminal = at('terminal'), pier = at('pier'), tower = at('tower'), canopy = at('canopy'), helipad = at('helipad');
  const taxiway = at('taxiway'), cargo = at('cargo'), fire = at('fire-station'), radar = at('radar'), parking = at('parking');
  const gate = at('gate'), windsock = at('windsock');
  const hangars = FACILITIES.filter((facility) => facility.key.startsWith('hangar'));
  const tanks = FACILITIES.filter((facility) => facility.kind === 'tank');
  const solid = [], flat = [];
  const block = (position, scale, color) => solid.push([position, scale, color]);
  const repeat = (parts, color) => { for (const [position, scale, rotation] of parts) flat.push([position, scale, color, rotation]); };

  const groundWidth = AIRPORT_GROUND.west + AIRPORT_GROUND.east, groundCenter = (AIRPORT_GROUND.east - AIRPORT_GROUND.west) / 2;
  block([groundCenter, -1.1, 0], [groundWidth, 2.2, AIRPORT_GROUND.halfDepth * 2], GRASS);
  block([0, 0.15, 0], [28, 0.3, 540], ASPHALT);
  // 유도로와 활주로 연결로 세 곳
  block([taxiway.x, 0.14, 0], [taxiway.w, 0.28, taxiway.d], ASPHALT);
  for (const z of [-240, 0, 240]) block([-19, 0.14, z], [12, 0.28, 10], ASPHALT);
  // 계류장과 공항로. 공항로는 관문에서 유도로 앞까지 z=30 을 곧게 지난다
  block([terminal.x + 13, 0.12, 45], [42, 0.24, 135], APRON);
  const roadX = (AIRPORT_ROAD.localX0 + AIRPORT_ROAD.localX1) / 2, roadLength = AIRPORT_ROAD.localX1 - AIRPORT_ROAD.localX0;
  block([roadX, 0.18, AIRPORT_ROAD.z], [roadLength, 0.2, 15], '#7b898d');
  block([roadX, 0.3, AIRPORT_ROAD.z], [roadLength, 0.04, 0.35], '#e2c65a');
  // 터미널 앞 순환로. 주차장을 돌아 공항로로 돌아온다
  block([parking.x + parking.w / 2 + 6, 0.18, -10], [10, 0.2, 80], '#7b898d');
  block([parking.x - parking.w / 2 - 6, 0.18, -10], [10, 0.2, 80], '#7b898d');
  block([parking.x, 0.18, -50], [parking.w + 22, 0.2, 10], '#7b898d');
  block([parking.x, 0.12, parking.z], [parking.w, 0.24, parking.d], APRON);
  // 주차장 구획선과 세워 둔 차, 버스 정류장 기둥.
  const parkingBays = [];
  for (let i = 0; i <= 8; i++) parkingBays.push([[parking.x - parking.w / 2 + 3 + i * (parking.w - 6) / 8, 0.36, parking.z], [0.3, 0.03, parking.d - 8]]);
  for (const dz of [-parking.d / 4, parking.d / 4]) parkingBays.push([[parking.x, 0.36, parking.z + dz], [parking.w - 6, 0.03, 0.3]]);
  repeat(parkingBays, '#f0e9d4');
  repeat([-14, -6, 2, 10].map((dx, i) => [[parking.x + dx, 0.9, parking.z - 14 + (i % 2) * 28], [2.1, 1.2, 4.2]]), '#7298a0');
  block([parking.x + parking.w / 2 + 3, 2.4, -50], [6, 0.4, 3], FRAME);
  for (const dx of [-2, 2]) block([parking.x + parking.w / 2 + 3 + dx, 1.2, -49], [0.3, 2.4, 0.3], FRAME);

  // 여객터미널: 상아색 몸체에 유리 커튼월과 옥상 설비를 얹는다
  const glassX = terminal.x + terminal.w / 2 + 1.3;
  block([terminal.x, 8, terminal.z], [terminal.w, 16, terminal.d], IVORY);
  block([terminal.x, 16.6, terminal.z], [terminal.w + 1, 1.2, terminal.d + 4], FRAME);
  block([glassX, 8, terminal.z], [0.5, 15, 148], GLASS_PALE);
  block([terminal.x, 8, terminal.z - terminal.d / 2 + 0.4], [24, 14, 0.5], GLASS_DEEP);
  // 터미널 커튼월. 세로 멀리언은 유리판을 촘촘히 나누고 가로 멀리언은 층 경계를 표시한다.
  const terminalMullions = [];
  for (let z = terminal.z - 74; z <= terminal.z + 74; z += 4) terminalMullions.push([[glassX, 8, z], [0.35, 15, 0.3]]);
  for (const y of [2, 6, 10, 14]) terminalMullions.push([[glassX, y, terminal.z], [0.35, 0.3, 148]]);
  repeat(terminalMullions, FRAME);
  repeat([
    [[-7, 17.7, -60], [3, 1, 2.2]], [[7, 17.7, -40], [2.4, 0.8, 2.4]], [[-5, 17.7, 15], [3.2, 1.2, 2]],
    [[5, 17.7, 50], [2.2, 0.8, 3]], [[-11, 17.7, 60], [2.6, 1, 2.2]], [[11, 17.7, -50], [2, 0.8, 2]],
  ].map(([[dx, y, dz], scale]) => [[terminal.x + dx, y, terminal.z + dz], scale]), '#7b898d');

  // 출입구 캐노피: 남쪽 진입로 위로 돌출한다
  block([canopy.x, 13.6, canopy.z], [canopy.w, 0.8, canopy.d], FRAME);
  repeat([-11, -5, 5, 11].map((dx) => [[canopy.x + dx, 6.5, canopy.z - 6], [0.6, 13, 0.6]]), FRAME);

  // 연결 통로: 터미널과 탑승동을 잇는다
  const bridgeX = (terminal.x + terminal.w / 2 + pier.x - pier.w / 2) / 2, bridgeLength = pier.x - pier.w / 2 - terminal.x - terminal.w / 2;
  block([bridgeX, 4, 80], [bridgeLength, 6, 40], IVORY);
  block([bridgeX, 7.2, 80], [bridgeLength + 0.4, 0.4, 42], FRAME);

  // 탑승동: 게이트마다 보딩 브리지를 붙인다. 고정 제트 두 대는 Airport 가 따로 세운다.
  const pierGlassX = pier.x + pier.w / 2 + 0.25;
  block([pier.x, 4, pier.z], [pier.w, 8, pier.d], IVORY);
  block([pier.x, 8.3, pier.z], [pier.w + 0.4, 0.5, pier.d + 4], FRAME);
  block([pierGlassX, 4, pier.z], [0.5, 7.5, 138], GLASS_PALE);
  const pierMullions = [];
  for (let z = pier.z - 66; z <= pier.z + 66; z += 4) pierMullions.push([[pierGlassX, 4, z], [0.3, 8, 0.25]]);
  for (const y of [1.5, 5]) pierMullions.push([[pierGlassX, y, pier.z], [0.3, 0.25, 140]]);
  repeat(pierMullions, FRAME);
  for (const z of [60, 95, 130]) block([pier.x + pier.w / 2 + 0.3, 3, z], [1, 2.6, 3], FRAME);

  // 관제탑: 가늘어지는 기둥, 바깥으로 기운 유리 캡, 레이더와 항공 장애등
  block([tower.x, 10, tower.z], [5, 20, 5], IVORY);
  block([tower.x, 25, tower.z], [3.6, 10, 3.6], IVORY);
  block([tower.x, 32, tower.z], [2.8, 4, 2.8], IVORY);
  block([tower.x, 37.5, tower.z], [9, 7, 9], GLASS_DEEP);
  block([tower.x, 41.3, tower.z], [10, 0.6, 10], FRAME);
  const railing = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    railing.push([[tower.x + Math.cos(a) * 5, 41.9, tower.z + Math.sin(a) * 5], [0.25, 1, 0.25]]);
  }
  repeat(railing, '#3f4a4c');
  block([tower.x, 42.9, tower.z], [0.18, 1.6, 0.18], '#59696c');

  // 헬리패드 반복 요소. H 표식, 가장자리 표식, 바닥 조명이다.
  repeat([
    [[helipad.x - 3, 0.33, helipad.z], [0.9, 0.02, 6]], [[helipad.x + 3, 0.33, helipad.z], [0.9, 0.02, 6]], [[helipad.x, 0.33, helipad.z], [4, 0.02, 0.9]],
  ], '#f0e9d4');
  repeat(Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return [[helipad.x + Math.cos(a) * 10.5, 0.33, helipad.z + Math.sin(a) * 10.5], [0.8, 0.02, 0.8]];
  }), '#e8b23d');
  repeat(Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    return [[helipad.x + Math.cos(a) * 9.2, 0.32, helipad.z + Math.sin(a) * 9.2], [0.5, 0.03, 0.5]];
  }), '#ffe6a0');

  // 격납고 둘: 박공 지붕과 정면 대형 문, 지붕 보
  for (const hangar of hangars) {
    block([hangar.x, hangar.h / 2, hangar.z], [hangar.w, hangar.h, hangar.d], HANGAR);
    block([hangar.x, hangar.h + 1.6, hangar.z], [hangar.w + 2, 3.2, hangar.d + 2], HANGAR_ROOF);
    block([hangar.x + hangar.w / 2 + 0.3, hangar.h * 0.42, hangar.z], [0.5, hangar.h * 0.84, hangar.d - 6], '#5b6a6e');
    block([hangar.x + hangar.w / 2 + 0.6, hangar.h * 0.42, hangar.z], [0.3, hangar.h * 0.84, 0.6], STEEL);
  }
  repeat(hangars.flatMap((hangar) => [-12, -4, 4, 12].map((dz) => [[hangar.x, hangar.h + 0.6, hangar.z + dz], [hangar.w + 1, 0.5, 0.6]])), STEEL);

  // 화물 터미널: 트럭 도크와 컨테이너 야드
  block([cargo.x, cargo.h / 2, cargo.z], [cargo.w, cargo.h, cargo.d], CARGO);
  block([cargo.x, cargo.h + 0.4, cargo.z], [cargo.w + 1, 0.8, cargo.d + 1], FRAME);
  block([cargo.x - cargo.w / 2 - 8, 0.12, cargo.z], [22, 0.24, cargo.d], APRON);
  repeat([0, 1, 2, 3].map((i) => [[cargo.x + cargo.w / 2 + 0.3, 2.2, cargo.z - 30 + i * 20], [0.6, 4, 7]]), '#5b6a6e');
  const containers = [];
  for (let i = 0; i < 6; i++) containers.push([[cargo.x - cargo.w / 2 - 8 - (i % 2) * 5, 1.3, cargo.z - 24 + Math.floor(i / 2) * 12], [2.4, 2.6, 6]]);
  repeat(containers, '#c26a3d');

  // 연료 저장소의 방류벽. 탱크 자체는 원기둥이라 Airport 가 그린다.
  block([tanks[1].x, 0.6, tanks[1].z], [tanks[0].r * 2 + 8, 1.2, 60], '#8c9791');

  // 소방대: 붉은 문 셋
  block([fire.x, fire.h / 2, fire.z], [fire.w, fire.h, fire.d], IVORY);
  block([fire.x, fire.h + 0.3, fire.z], [fire.w + 1, 0.6, fire.d + 1], FRAME);
  for (const dx of [-7, 0, 7]) block([fire.x + dx, 2.6, fire.z + fire.d / 2 + 0.3], [5.5, 5.2, 0.4], RED);
  block([fire.x - fire.w / 2 + 2, fire.h + 3, fire.z - fire.d / 2 + 2], [2.4, 6, 2.4], RED);

  // 레이더 받침
  block([radar.x, radar.h * 0.35, radar.z], [radar.w * 0.4, radar.h * 0.7, radar.w * 0.4], IVORY);

  // 공항로 관문과 울타리, 바람자루 기둥
  for (const dz of [-6, 6]) block([gate.x, 2, AIRPORT_ROAD.z + dz + (dz > 0 ? 3 : -3)], [1.2, 4, 1.2], IVORY);
  block([gate.x, 4.4, AIRPORT_ROAD.z], [1.6, 0.8, 22], FRAME);
  block([gate.x, 1.1, AIRPORT_ROAD.z - 4], [0.25, 0.25, 8], RED);
  const fence = [];
  const west = -AIRPORT_GROUND.west + 4, east = AIRPORT_GROUND.east - 4;
  for (const x of [west, east]) {
    for (let z = -285; z <= 285; z += 10) fence.push([[x, 1.1, z], [0.3, 2.2, 0.3]]);
    fence.push([[x, 1.4, 0], [0.15, 0.15, 570]]);
  }
  // 서쪽 울타리는 공항로 관문에서 끊긴다.
  for (const z of [-285, 285]) fence.push([[(west + east) / 2, 1.4, z], [east - west, 0.15, 0.15]]);
  repeat(fence, '#778779');
  block([windsock.x, 3, windsock.z], [0.2, 6, 0.2], STEEL);

  // 활주로 표시. 중심선, 가장자리선, 접지대, 숫자 윤곽, 유도로 중심선, 정지선이다.
  const marks = [];
  for (let z = -195; z <= 195; z += 20) marks.push([[0, 0.35, z], [0.65, 0.04, 9]]);
  for (const side of [-1, 1]) {
    marks.push([[side * 12.5, 0.35, 0], [0.35, 0.04, 522]]);
    for (const end of [-1, 1]) for (let i = 0; i < 4; i++) marks.push([[side * (2.5 + i * 2.3), 0.35, end * 244], [1.2, 0.04, 12]]);
    for (const end of [-1, 1]) {
      // Paired outlined threshold numerals echo a miniature runway's 18/36 signage.
      for (const x of [-2.5, 2.5]) {
        marks.push([[x - 1, 0.35, end * 220], [0.5, 0.04, 5]]);
        marks.push([[x + 1, 0.35, end * 220], [0.5, 0.04, 5]]);
        marks.push([[x, 0.35, end * 220 + side * 2.5], [2.5, 0.04, 0.5]]);
      }
    }
  }
  for (let z = -240; z <= 240; z += 12) marks.push([[taxiway.x, 0.35, z], [0.3, 0.04, 5]]);
  for (const z of [-240, 0, 240]) marks.push([[-17.5, 0.35, z], [4, 0.04, 0.8]]);
  repeat(marks, '#f0e9d4');
  return { solid, flat };
}

const BOX = new THREE.BoxGeometry(1, 1, 1);

/** 상자 조각들을 정점 색을 가진 geometry 하나로 합친다. 색은 THREE.Color 가 선형 공간으로
 * 바꾼 값이라 재질 color 로 칠한 것과 같다. */
function boxBatch(parts) {
  const template = BOX.attributes, index = BOX.index.array;
  const corners = template.position.count, faces = index.length;
  const position = new Float32Array(parts.length * corners * 3);
  const normal = new Float32Array(parts.length * corners * 3);
  const color = new Float32Array(parts.length * corners * 3);
  const indices = new Uint32Array(parts.length * faces);
  const matrix = new THREE.Matrix4(), normalMatrix = new THREE.Matrix3(), vector = new THREE.Vector3();
  const quaternion = new THREE.Quaternion(), euler = new THREE.Euler(), tint = new THREE.Color();
  const p = new THREE.Vector3(), s = new THREE.Vector3();
  parts.forEach(([at, size, hex, rotation], part) => {
    quaternion.setFromEuler(euler.set(...(rotation || [0, 0, 0])));
    matrix.compose(p.fromArray(at), quaternion, s.fromArray(size));
    normalMatrix.getNormalMatrix(matrix);
    tint.set(hex);
    const base = part * corners;
    for (let i = 0; i < corners; i++) {
      const o = (base + i) * 3;
      vector.fromBufferAttribute(template.position, i).applyMatrix4(matrix).toArray(position, o);
      vector.fromBufferAttribute(template.normal, i).applyMatrix3(normalMatrix).normalize().toArray(normal, o);
      color[o] = tint.r; color[o + 1] = tint.g; color[o + 2] = tint.b;
    }
    for (let i = 0; i < faces; i++) indices[part * faces + i] = base + index[i];
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/** mirrored 면 extent 기준 반대편에 180도 돌려 세운다. 서쪽 공항이다. */
function Airport({ extent, parked = true, plane, night = false, mirrored = false }) {
  const root = useRef();
  const tower = at('tower'), helipad = at('helipad'), radar = at('radar'), windsock = at('windsock'), pier = at('pier');
  const tanks = FACILITIES.filter((facility) => facility.kind === 'tank');
  const boxes = useMemo(() => {
    const { solid, flat } = airportBoxes();
    return { solid: boxBatch(solid), flat: boxBatch(flat) };
  }, []);
  useEffect(() => () => { boxes.solid.dispose(); boxes.flat.dispose(); }, [boxes]);
  // 활주로 유도등. 가장자리는 흰 점, 접지대(threshold) 는 초록 점으로 끝을 알린다.
  const edgeLights = useMemo(() => {
    const parts = [];
    for (const side of [-1, 1]) for (let z = -256; z <= 256; z += 16) parts.push([[side * 14.6, 0.5, z], [0.5, 0.5, 0.5]]);
    return parts;
  }, []);
  const thresholdLights = useMemo(() => {
    const parts = [];
    for (const end of [-1, 1]) for (let x = -13; x <= 13; x += 3.7) parts.push([[x, 0.5, end * 262], [0.5, 0.5, 0.5]]);
    return parts;
  }, []);
  // 진입등. 활주로 양끝 너머 물 위 선반에 가로 막대 다섯 개와 중심선 점을 놓는다.
  const approachLights = useMemo(() => {
    const parts = [];
    for (const end of [-1, 1]) for (let i = 0; i < 6; i++) {
      const z = end * (280 + i * 8);
      parts.push([[0, 0.6, z], [0.45, 0.45, 0.45]]);
      if (i % 2 === 1) for (const x of [-6, -3, 3, 6]) parts.push([[x, 0.6, z], [0.45, 0.45, 0.45]]);
    }
    return parts;
  }, []);
  // 공항은 움직이지 않는다. 주기 기체만 dynamic 으로 남기고 행렬을 고정한다.
  useLayoutEffect(() => { freezeStatic(root.current); }, [extent, mirrored]);

  return <group ref={root} rotation={[0, mirrored ? Math.PI : 0, 0]}><group position={[extent + 110, 0, 0]}>
    <mesh geometry={boxes.solid} castShadow receiveShadow dispose={null}><meshStandardMaterial vertexColors roughness={0.8} /></mesh>
    <mesh geometry={boxes.flat} receiveShadow dispose={null}><meshStandardMaterial vertexColors roughness={0.8} /></mesh>
    {/* 상자가 아닌 시설과 게이트 제트는 재질이 같은 것끼리 합친다. */}
    <StaticBatch>
      {[60, 130].map((z) => <group key={z} position={[pier.x + 12, 2.1, z]} rotation={[0, Math.PI / 2, 0]}><PlaneModel plane="jet" /></group>)}
      <mesh position={[tower.x, 42.3, tower.z]} rotation={[0.45, 0, 0]} castShadow><cylinderGeometry args={[2.2, 2.2, 0.25, 14]} /><meshStandardMaterial color="#cfceb8" metalness={0.25} roughness={0.4} /></mesh>
      <mesh position={[tower.x, 43.7, tower.z]} castShadow><sphereGeometry args={[0.22, 8, 8]} /><meshStandardMaterial color="#d94f3d" /></mesh>
      {/* 헬리패드: 표면 높이 0.35 이하, 솟은 구조물 없음 */}
      <mesh position={[helipad.x, 0.15, helipad.z]} receiveShadow><cylinderGeometry args={[11, 11, 0.3, 32]} /><meshStandardMaterial color="#55605e" roughness={0.9} /></mesh>
      <mesh position={[helipad.x, 0.31, helipad.z]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[9.6, 10.3, 48]} /><meshStandardMaterial color="#f0e9d4" roughness={0.7} /></mesh>
      {/* 연료 저장소 셋 */}
      {tanks.map((tank) => <group key={tank.key}>
        <mesh position={[tank.x, tank.h / 2, tank.z]} castShadow receiveShadow><cylinderGeometry args={[tank.r, tank.r, tank.h, 18]} /><meshStandardMaterial color="#dfe3e0" roughness={0.55} metalness={0.2} /></mesh>
        <mesh position={[tank.x, tank.h + 0.9, tank.z]} castShadow><cylinderGeometry args={[tank.r * 0.35, tank.r, 1.8, 18]} /><meshStandardMaterial color="#c5cbc8" roughness={0.6} /></mesh>
      </group>)}
      {/* 레이더 돔과 바람자루 */}
      <mesh position={[radar.x, radar.h * 0.7 + radar.w * 0.28, radar.z]} castShadow><sphereGeometry args={[radar.w * 0.3, 14, 10]} /><meshStandardMaterial color="#f2f1e9" roughness={0.5} /></mesh>
      <mesh position={[windsock.x + 1.6, 5.8, windsock.z]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.5, 3.2, 8]} /><meshStandardMaterial color="#e5762f" /></mesh>
    </StaticBatch>
    <RunwayLights parts={edgeLights} color="#ffdb92" night={night} />
    <RunwayLights parts={thresholdLights} color="#5fd97a" night={night} />
    <RunwayLights parts={approachLights} color="#fff3c8" night={night} />
    {parked && <group position={[0, 2.1, 140]} userData={{ dynamic: true }}><PlaneModel plane={plane} /></group>}
  </group></group>;
}

export default memo(Airport);
