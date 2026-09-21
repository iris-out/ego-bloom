/** 섬 가장자리의 해변, 리조트, 잔교와 바다의 배다. 좌표만 만든다. 렌더는 하지 않는다.
 * 도시는 반폭 extent 의 정사각형 섬이고 그 바깥이 바다다. 물고기와 상어는
 * Ocean.jsx 에서 extent * SQRT2 + 230 반경을 돌고 공항은 X = extent + 110 에 있다.
 * 배 항로는 둘 다 피한다. */
import { LOT_CHAMPION } from './lots.js';
import { LEVELS } from './elevation.js';

/** 해변 폭이다. 육지 안쪽으로만 들어간다. 물 위로 나가지 않는다. */
// 외곽 순환·지구 순환도로가 해변보다 안쪽으로 지나도록, 보행 가능한 폭만 남긴다.
// 이전 90 단위 띠는 도심으로 너무 깊게 들어와 항공 시점에서 도로를 덮는 긴 모래 판으로 보였다.
export const BEACH_WIDTH = 30;
/** 배가 뜨는 높이다. 물고기가 -2.62 에 있으니 그 위다. */
export const BOAT_Y = LEVELS.WATER + 0.2;
/** 공항 중심에서 이만큼 안에는 항로를 두지 않는다. 배가 활주로를 가로지르면 안 된다. */
export const AIRPORT_CLEAR = 300;
/** 물고기 궤도에서 이만큼은 떨어진다. */
export const FISH_CLEAR = 24;

/** 섬 네 변의 성격이다. 공항이 있는 동쪽은 방파제, 북쪽은 항구, 나머지가 해변이다. */
export const COAST_EDGES = Object.freeze([
  { edge: 'south', axis: 'z', sign: 1, kind: 'beach', ko: '남쪽 해변' },
  { edge: 'west', axis: 'x', sign: -1, kind: 'beach', ko: '서쪽 해변' },
  { edge: 'north', axis: 'z', sign: -1, kind: 'harbour', ko: '북쪽 항구' },
  { edge: 'east', axis: 'x', sign: 1, kind: 'seawall', ko: '동쪽 방파제' },
]);

const finite = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback);
/** 인덱스 기반 결정적 해시다. 같은 extent 면 언제나 같은 배치가 나온다. */
function hash(seed) {
  let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** 해변 띠다. 변마다 하나이고 모래는 육지 안쪽 BEACH_WIDTH 만 쓴다.
 * 모래 상단은 지면과 같아 차량이 턱 없이 올라간다. */
export function beachStrips(extent) {
  const e = finite(extent, 1500);
  // 모서리에서 물러나 두 변의 띠가 겹치지 않게 한다.
  const inset = BEACH_WIDTH;
  return COAST_EDGES.filter((edge) => edge.kind === 'beach').map((edge) => {
    const centre = edge.sign * (e - BEACH_WIDTH / 2);
    const length = (e - inset) * 2;
    return edge.axis === 'z'
      ? { edge: edge.edge, ko: edge.ko, x: 0, z: centre, length, width: BEACH_WIDTH, angle: 0, top: LEVELS.GROUND }
      : { edge: edge.edge, ko: edge.ko, x: centre, z: 0, length, width: BEACH_WIDTH, angle: Math.PI / 2, top: LEVELS.GROUND };
  });
}

/** 점이 해변 띠 안에 있는지 본다. 파라솔 배치가 이걸로 자기 자리를 검사한다. */
export function onBeach(strip, x, z) {
  const along = strip.angle === 0 ? x - strip.x : z - strip.z;
  const across = strip.angle === 0 ? z - strip.z : x - strip.x;
  return Math.abs(along) <= strip.length / 2 && Math.abs(across) <= strip.width / 2;
}

/** 리조트 부지 넷이다. 해변 뒤편 육지에 앉고 한 변은 챔피언 필지와 같다. */
export function resortPlots(extent) {
  const e = finite(extent, 1500);
  const side = LOT_CHAMPION;
  // 해변 띠 안쪽 경계에서 부지 절반만큼 더 들어간다. 모래를 밟지 않는다.
  const back = e - BEACH_WIDTH - side / 2 - 12;
  const spread = e * 0.42;
  return [
    { id: 'south-west', x: -spread, z: back, size: side, ko: '남서 리조트' },
    { id: 'south-east', x: spread, z: back, size: side, ko: '남동 리조트' },
    { id: 'west-north', x: -back, z: -spread, size: side, ko: '서북 리조트' },
    { id: 'west-south', x: -back, z: spread, size: side, ko: '서남 리조트' },
  ];
}

/** 파라솔과 선베드다. 해변 띠 위에 결정적으로 흩는다. */
export function parasols(extent, quality = 'high') {
  const strips = beachStrips(extent);
  const total = { low: 40, medium: 80, high: 140 }[quality] ?? 140;
  const each = Math.floor(total / strips.length);
  const out = [];
  strips.forEach((strip, stripIndex) => {
    for (let i = 0; i < each; i++) {
      const seed = stripIndex * 977 + i;
      // 물가 쪽 60% 에만 둔다. 안쪽은 진입로와 샤워장 자리로 비운다.
      const along = (hash(seed) - 0.5) * strip.length * 0.94;
      const across = (hash(seed + 1) - 0.5) * strip.width * 0.6 - strip.width * 0.16;
      const world = strip.angle === 0
        ? { x: strip.x + along, z: strip.z + across }
        : { x: strip.x + across, z: strip.z + along };
      out.push({
        ...world, edge: strip.edge, y: LEVELS.GROUND,
        // 파라솔 하나에 선베드 둘이 붙는다. 3할은 선베드만 있는 자리다.
        parasol: hash(seed + 2) > 0.3,
        rotation: hash(seed + 3) * Math.PI * 2,
      });
    }
  });
  return out;
}

/** 잔교 셋이다. 해변에서 바다로 뻗는다. 끝은 육지 밖이다. */
export function piers(extent) {
  const e = finite(extent, 1500);
  const plan = [
    { id: 'south-pier', edge: 'south', along: -e * 0.34, length: 96 },
    { id: 'south-marina', edge: 'south', along: e * 0.28, length: 110 },
    { id: 'west-pier', edge: 'west', along: e * 0.12, length: 68 },
  ];
  return plan.map((item) => {
    const south = item.edge === 'south';
    // 시작점은 모래 안쪽, 끝점은 섬 밖이다.
    const from = south ? { x: item.along, z: e - BEACH_WIDTH * 0.7 } : { x: -(e - BEACH_WIDTH * 0.7), z: item.along };
    const to = south ? { x: item.along, z: e + item.length } : { x: -(e + item.length), z: item.along };
    return { ...item, from, to, width: 12, deck: LEVELS.GROUND };
  });
}

const BOAT_KINDS = ['sail', 'sail', 'ferry', 'cargo', 'ferry', 'sail'];

/** 배 항로 여섯이다. 섬을 도는 원이고 반경이 서로 다르다.
 * 물고기 궤도와 공항을 둘 다 피한다. */
export function boatRoutes(extent) {
  const e = finite(extent, 1500);
  const fish = e * Math.SQRT2 + 230;
  return BOAT_KINDS.map((kind, index) => {
    // 안쪽 셋은 물고기 궤도 아래, 바깥 셋은 위다. 사이를 FISH_CLEAR 이상 띄운다.
    const inner = index < 3;
    const step = index % 3;
    const radius = inner
      ? fish - FISH_CLEAR - 40 - step * 46
      : fish + FISH_CLEAR + 40 + step * 52;
    return {
      id: `boat-${index}`, kind, radius,
      // 화물선이 가장 느리고 요트가 빠르다. 방향은 번갈아 돈다.
      speed: (kind === 'cargo' ? 0.5 : kind === 'ferry' ? 0.8 : 1.15) * (index % 2 ? -1 : 1),
      phase: index * 0.7853981633974483,
    };
  });
}

/** 시각을 받아 배 하나의 자세를 낸다. trafficPose 와 같은 규약이다. 상태를 들지 않는다. */
export function boatPose(route, time) {
  const angle = route.phase + finite(time) * route.speed * 0.004;
  const x = Math.cos(angle) * route.radius, z = Math.sin(angle) * route.radius;
  // 원 위 접선이 진행 방향이다. 위치를 각도로 미분하면 (-sin, cos) 이고
  // 반대로 도는 배는 부호가 뒤집힌다. 방위 규약은 atan2(dx, dz) 다.
  const way = route.speed >= 0 ? 1 : -1;
  return {
    x, y: BOAT_Y, z, kind: route.kind,
    angle: Math.atan2(-Math.sin(angle) * way, Math.cos(angle) * way),
  };
}
