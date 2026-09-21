/** 지하철 세 노선, 고속도로 순환선과 방사선, IC/JC, 교량 좌표를 만드는 순수 모듈이다.
 * Three, React, 브라우저 API 에 의존하지 않는다. 렌더는 다른 단계에서 이 좌표를 읽는다. */
import { cityNodes } from './cityNodes.js';
import { quadratic, arcCorner } from './curves.js';

/** 문자열을 32비트 정수로 접는 해시다. Math.random 대신 방향, 순서를 정할 때 쓴다. */
const hash = (text) => {
  let value = 2166136261;
  for (const char of String(text)) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  value ^= value >>> 16;
  return value >>> 0;
};

export const SUBWAY_LINES = Object.freeze([
  { id: 'L1', ko: '1호선', color: '#0032a0', via: ['jongno', 'central', 'gangnam'] },
  { id: 'L2', ko: '2호선', color: '#00a84d', via: ['yeoui', 'central', 'seongsu', 'nowon'] },
  { id: 'L3', ko: '3호선', color: '#ef7c1c', via: ['mokdong', 'yeoui', 'jongno', 'nowon'] },
]);

/** 두 핵을 2차 베지어로 잇는다. 직선을 피하려고 중점을 수직 방향으로 밀어낸다.
 * 미는 방향은 두 핵 id 의 해시로 정해 항상 같은 결과를 낸다. */
function curveBetween(a, b, seed) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len, nz = dx / len;
  const sign = hash(seed) % 2 === 0 ? 1 : -1;
  const bow = Math.min(len * 0.18, (a.r + b.r) * 0.3);
  const control = [(a.x + b.x) / 2 + nx * bow * sign, (a.z + b.z) / 2 + nz * bow * sign];
  return quadratic([a.x, a.z], control, [b.x, b.z], 3);
}

/** nodes 는 cityNodes(extent) 의 결과다. line.via 순서대로 major 역과 중간역 둘을 둔다. */
export function subwayStations(nodes, line) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const via = line.via.map((id) => byId.get(id));
  const stations = [];
  via.forEach((node, index) => {
    stations.push({ x: node.x, z: node.z, major: true, ko: node.ko });
    if (index >= via.length - 1) return;
    const next = via[index + 1];
    const curve = curveBetween(node, next, `${line.id}-${node.id}-${next.id}`);
    // curve 는 [핵, 중간1, 중간2, 핵] 네 점이다. 양 끝은 이미 major 역이므로 가운데 둘만 쓴다.
    for (let i = 1; i < curve.length - 1; i++) {
      stations.push({ x: curve[i][0], z: curve[i][1], major: false, ko: `${node.ko}-${next.ko} 사이` });
    }
  });
  return stations;
}

export function subwayNetwork(extent) {
  const nodes = cityNodes(extent);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const lines = SUBWAY_LINES.map((line) => {
    const via = line.via.map((id) => byId.get(id));
    const points = [[via[0].x, via[0].z]];
    for (let i = 0; i < via.length - 1; i++) {
      const curve = curveBetween(via[i], via[i + 1], `${line.id}-${via[i].id}-${via[i + 1].id}`);
      points.push(...curve.slice(1));
    }
    return { id: line.id, ko: line.ko, color: line.color, points, stations: subwayStations(nodes, line) };
  });
  return { lines };
}

/** 순환선 사각형의 반폭 비율이다. 모서리를 둥글여도 extent 안쪽에 남도록 잡았다. */
export const LOOP_HALF_RATIO = 0.75;
/** 모서리 호의 반경 비율이다. highwayLoop 의 기본 radius 와 같은 값을 쓴다. */
export const LOOP_CORNER_RATIO = 0.173;
const HALF_PI = Math.PI / 2;

/** 순환선 한 변에서 모서리 호가 시작하기 전까지의 반길이다. 나들목 램프가 상판
 * 가장자리를 따라갈 수 있는 구간이라 urbanPlan 이 램프 길이를 여기에 맞춘다. */
export function highwayStraightHalf(extent, radius = extent * LOOP_CORNER_RATIO) {
  const hx = extent * LOOP_HALF_RATIO;
  return hx - Math.min(radius, hx * 0.5);
}

/** 모서리를 둥글린 사각 순환선이다. radius 는 arcCorner 에 넘기는 모서리 반경이다.
 * arcCorner 의 from, to 는 좌표가 아니라 각도(라디안, atan2(dx,dz) 규약)다. 각 모서리는
 * 중심에서 반경만큼 떨어진 두 접점을 잇는 사분원이라 어느 모서리든 시작과 끝의 각도 차가 -PI/2 다. */
export function highwayLoop(extent, radius = extent * LOOP_CORNER_RATIO) {
  const hx = extent * LOOP_HALF_RATIO;
  const r = Math.min(radius, hx * 0.5);
  const corners = [
    { cx: hx - r, cz: hx - r, from: HALF_PI, to: 0, point: [hx, hx - r] },
    { cx: -(hx - r), cz: hx - r, from: 0, to: -HALF_PI, point: [-(hx - r), hx] },
    { cx: -(hx - r), cz: -(hx - r), from: -HALF_PI, to: -Math.PI, point: [-hx, -(hx - r)] },
    { cx: hx - r, cz: -(hx - r), from: Math.PI, to: HALF_PI, point: [hx - r, -hx] },
  ];
  const points = [];
  for (const corner of corners) {
    points.push(corner.point);
    // steps 를 1(모서리 하나에 현 하나)로 줄였다. 사분원이라도 현 하나만으로 시각적으로
    // 크게 어색하지 않고, 순환선 네 모서리 전체 세그먼트가 28개에서 8개로 줄어든다.
    const arc = arcCorner([corner.cx, corner.cz], r, corner.from, corner.to, 5);
    points.push(...arc.slice(1));
  }
  points.push(corners[0].point);
  return points;
}

/** 도심을 지나는 남북 고속도로 방사선이다. 동서 방사선은 지상 간선과 같은 축을
 * 달려 상판이 교량과 간선을 덮어 없앴다. */
export function highwayRadials(extent) {
  const reach = extent * 0.94;
  return [
    { id: 'radial-ns', ko: '남북 방사선', points: [[0, -reach], [0, 0], [0, reach]] },
  ];
}

/** 나들목과 분기점은 좌표를 박지 않고 교차에서 파생한다. axes.ns 는 순환선을 넘는
 * 남북 간선의 x, axes.ew 는 동서 간선의 z, axes.jc 는 순환선을 넘는 고속도로 방사선의
 * x 다. 순환선 직선 구간을 넘는 자리만 받으므로 결과는 항상 상판 위다. */
export function interchanges(extent, axes = {}) {
  const half = extent * LOOP_HALF_RATIO;
  const out = [];
  let ic = 0, jc = 0;
  for (const x of axes.ns || []) {
    for (const side of [-1, 1]) out.push({ x, z: side * half, kind: 'IC', axis: 'ns', ko: `나들목 ${++ic}` });
  }
  for (const z of axes.ew || []) {
    for (const side of [-1, 1]) out.push({ x: side * half, z, kind: 'IC', axis: 'ew', ko: `나들목 ${++ic}` });
  }
  for (const x of axes.jc || []) {
    for (const side of [-1, 1]) out.push({ x, z: side * half, kind: 'JC', axis: 'ns', ko: `분기점 ${++jc}` });
  }
  return out;
}

/** 강 중심선의 z 다. Math.min(420, extent*0.56) 을 기준선으로 삼고 사인 두 개로 흔든다.
 * 두 사인 모두 x 의 홀함수라 x 를 원점 대칭으로 훑으면 평균이 정확히 기준선으로 되돌아온다. */
export function riverAt(extent, x) {
  const base = Math.min(420, extent * 0.56);
  const t = x / extent;
  const wobble = Math.sin(t * Math.PI * 2) * extent * 0.03 + Math.sin(t * Math.PI * 6) * extent * 0.012;
  return base + wobble;
}

const BRIDGE_FRACTIONS = [-0.72, -0.36, 0, 0.36, 0.72];
const BRIDGE_NAMES = ['서쪽대교', '서부대교', '중앙대교', '동부대교', '동쪽대교'];
const BRIDGE_BIG_INDEXES = new Set([1, 3]);

/** 강을 건너는 다섯 다리다. 두 곳(index 1, 3)은 사장교라 폭이 넓다. */
export function riverBridges(extent, riverAt) {
  return BRIDGE_FRACTIONS.map((fraction, index) => {
    const x = extent * fraction;
    const big = BRIDGE_BIG_INDEXES.has(index);
    return { x, z: riverAt(extent, x), big, ko: BRIDGE_NAMES[index], width: big ? 40 : 24 };
  });
}
