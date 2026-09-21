/** 도심 1개와 부도심 6개로 이루어진 다핵 도시의 핵, 산, 대역 정의다.
 * urbanPlan.js 와 worldLayout.js 가 이 좌표를 읽어 일곱 지구 대신 핵 중심 배치로 갈아 끼운다.
 * three, react, 브라우저 API 에 기대지 않는 순수 모듈이라 node 단위 테스트가 그대로 돈다.
 */
import { LOT, LOT_CHAMPION, LOT_LARGE } from './lots.js';

/** 시안 좌표다. x, z, r 은 extent 1500 을 기준으로 나눈 비율이고 rot 은 라디안이라 늘어나지 않는다.
 * 도심 반경은 시안 대비 1.44배, 부도심 반경은 1.55배, 부도심 위치는 1.33배로 밀었다. 도시는
 * 정사각형인데 핵은 원이라 시안 값 그대로면 격자 자리의 절반 넘게 어느 핵에도 속하지 않아
 * 배치가 도시를 필요 이상으로 키웠다.
 *
 * 도심 반경은 일부러 크게 잡지 않았다. 첨탑 대역을 필요 이상으로 넓히면 브론즈, 실버가
 * home, trade 대역을 다 못 채웠을 때 예비 경로가 남는 첨탑 자리부터 집어삼킨다
 * (layout.test.mjs 의 "브론즈, 실버가 첨탑에 서면 안 된다" 검사). 부도심 위치 배율(1.33)도
 * 추측이 아니라 실측으로 고정했다. 표본이 14명뿐인 극소 인구 테스트(layout.test.mjs 의
 * height-multiplier 검사)는 MIN_EXTENT 부근에서 도로와 산이 도심의 첨탑 부지 세 곳을 모두
 * 막아 챔피언이 부도심으로 새는데, 부도심을 이 배율만큼 밀어야 도심이 살짝 자란 extent(1045)
 * 에서 막힌 부지를 벗어나 다시 도심에 정착한다. 배율이 이보다 작으면 도심에 못 서고, 크면
 * 반대로 브론즈, 실버가 첨탑을 침범한다.
 *
 * 세 값 모두 어느 두 핵도 서로의 반경 안에 중심을 두지 않는 선(city-nodes.test.mjs) 안에서
 * 고른 것이라 겹침 검사는 여전히 넉넉히 통과한다(가장 빠듯한 mokdong-yeoui 가 1.518배). */
export const NODE_TEMPLATES = Object.freeze([
  { id: 'central', ko: '도심', x: 0, z: 0, r: 0.500, rot: 0, primary: true },
  { id: 'gangnam', ko: '남부 부도심', x: 0.382, z: 0.674, r: 0.445, rot: 0.41, primary: false },
  { id: 'yeoui', ko: '서부 부도심', x: -0.781, z: 0.186, r: 0.414, rot: -0.22, primary: false },
  { id: 'jongno', ko: '북부 부도심', x: -0.230, z: -0.728, r: 0.383, rot: 0.28, primary: false },
  { id: 'seongsu', ko: '동부 부도심', x: 0.825, z: -0.142, r: 0.403, rot: -0.35, primary: false },
  { id: 'mokdong', ko: '남서 부도심', x: -0.638, z: 0.798, r: 0.352, rot: 0.12, primary: false },
  { id: 'nowon', ko: '북동 부도심', x: 0.568, z: -0.851, r: 0.341, rot: -0.41, primary: false },
]);

/** 건축 금지 구역인 산 세 곳이다. 좌표 비율 규약은 NODE_TEMPLATES 와 같다.
 * 강 북쪽 안쪽에만 둔다. 예전에는 강 위와 간선 위에 걸쳐 있어서 산 덩어리가 강을 막고
 * 도로를 삼켰다. 세 자리 모두 강변 여유 밖이고 지상 도로에서 180 이상 떨어져 있다.
 * urban-plan 테스트가 그 두 조건을 검사한다.
 */
export const HILL_TEMPLATES = Object.freeze([
  { x: 0.15, z: -0.58, r: 0.105 },
  { x: 0.80, z: -0.81, r: 0.095 },
  { x: -0.45, z: -0.63, r: 0.090 },
]);

/** urbanPlan.js 의 planCache 와 같은 방식이다. 차량, 배치 코드가 매 프레임 불러도
 * 같은 extent 면 새 배열을 만들지 않는다. */
const CACHE_MAX = 4;
const nodeCache = new Map();
const hillCache = new Map();

function cached(cache, extent, build) {
  const hit = cache.get(extent);
  if (hit) return hit;
  const built = build();
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(extent, built);
  return built;
}

/** rot 은 비율이 아니라 각도라 extent 를 곱하지 않는다. */
function scaleTemplates(templates, extent) {
  return Object.freeze(templates.map((t) => Object.freeze({ ...t, x: t.x * extent, z: t.z * extent, r: t.r * extent })));
}

/** 핵 일곱 개를 실제 extent 좌표로 편다. 같은 extent 는 같은 배열 참조를 돌려준다. */
export function cityNodes(extent) {
  return cached(nodeCache, extent, () => scaleTemplates(NODE_TEMPLATES, extent));
}

/** 산 세 개를 실제 extent 좌표로 편다. */
export function cityHills(extent) {
  return cached(hillCache, extent, () => scaleTemplates(HILL_TEMPLATES, extent));
}

/** 점이 속한 핵을 고른다. 반경 대비 거리(d)가 가장 작은 핵을 골라 1.02 를 넘으면 버린다. */
export function nodeAt(nodes, x, z) {
  let best = null, bestD = Infinity;
  for (const node of nodes) {
    const d = Math.hypot(x - node.x, z - node.z) / node.r;
    if (d < bestD) { bestD = d; best = node; }
  }
  return best && bestD <= 1.02 ? { node: best, d: bestD } : null;
}

/** 대역 표다. to 는 핵 반경 대비 거리 상한이고 lot 은 shared/lots.js 상수다.
 * 관청가와 첨탑은 도심(primary)에만 서고, 부도심(sub)은 핵 자체가 상업지라 그 둘이 없다. */
export const BANDS = Object.freeze({
  primary: Object.freeze([
    Object.freeze({ key: 'civic', to: 0.22, lot: 0, ko: '관청가' }),
    Object.freeze({ key: 'champ', to: 0.46, lot: LOT_CHAMPION, ko: '첨탑' }),
    Object.freeze({ key: 'master', to: 0.72, lot: LOT_LARGE, ko: '상급' }),
    Object.freeze({ key: 'trade', to: 0.90, lot: LOT, ko: '상가' }),
    Object.freeze({ key: 'home', to: 1.00, lot: LOT, ko: '주거' }),
  ]),
  sub: Object.freeze([
    Object.freeze({ key: 'trade', to: 0.20, lot: LOT_LARGE, ko: '부도심 핵' }),
    Object.freeze({ key: 'trade', to: 0.44, lot: LOT, ko: '상가' }),
    Object.freeze({ key: 'home', to: 1.00, lot: LOT, ko: '주거' }),
  ]),
});

/** d 가 속하는 대역을 고른다. 표 끝(1.00) 을 넘어 nodeAt 이 허용하는 1.02 까지는 마지막 대역으로 묶는다. */
export function bandAt(node, d) {
  const bands = node.primary ? BANDS.primary : BANDS.sub;
  return bands.find((band) => d <= band.to) ?? bands[bands.length - 1];
}

/** 제작자 티어 키에서 대역 키로 가는 표다. src/design/tiers.js 의 CREATOR_TIERS 여덟 개를 모두 덮는다. */
export const TIER_BAND = Object.freeze({
  bronze: 'home',
  silver: 'home',
  gold: 'trade',
  platinum: 'trade',
  diamond: 'master',
  master: 'master',
  grandmaster: 'champ',
  champion: 'champ',
});

/** 점이 건축 금지 산 안에 있는지 본다. */
export function inHill(hills, x, z) {
  return hills.some((hill) => Math.hypot(x - hill.x, z - hill.z) <= hill.r);
}
