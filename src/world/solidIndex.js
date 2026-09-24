import { MASS_LOT_RATIO } from './cityModels.js';

/** 건물과 구조물 충돌의 단일 출처다. 순수 함수이며 Three, React 에 의존하지 않는다.
 * 도보, 차량, 비행, 포탄, 조준 미리보기가 모두 같은 상자 판정을 쓴다.
 * 매 호출마다 1000여 채를 전부 훑지 않도록 배열마다 격자를 한 번 만들어 둔다. */

/** 격자 한 칸의 폭이다. 필지 두어 개가 들어가는 크기라 한 칸에 건물이 몇 채만 담긴다. */
const CELL = 48;
/** 이보다 적으면 격자를 만들지 않고 그냥 훑는다. 격자를 만드는 비용이 더 크다. */
const LINEAR_BELOW = 24;

/** 건물 둘레에 더하는 기본 여유다. 벽에 코를 박기 전에 막아 몸통이 화면을 뚫지 않게 한다.
 * 가드레일처럼 얇은 구조물은 margin 을 따로 줘야 도로 위에 보이지 않는 벽이 생기지 않는다. */
const MARGIN = 3;
/** 비행체는 화면에 보이는 상자 바깥의 추가 여유 없이 건물 충돌체를 검사한다.
 * 각 장애물이 지정한 margin/roofMargin 은 그대로 적용한다. */
export const FLIGHT_CLEARANCE = Object.freeze({ margin: 0, roofMargin: 0 });

const marginOf = (building, fallback = MARGIN) => (Number.isFinite(building.margin) ? building.margin : fallback);
const roofMarginOf = (building, fallback = 4) => (Number.isFinite(building.roofMargin) ? Math.max(0, building.roofMargin) : fallback);

/** 건물 몸통의 반폭이다. buildWorld 는 width, depth 를 주지 않고 lot 만 준다.
 * 화면에 그려지는 몸통이 lot * MASS_LOT_RATIO 이므로 그 값을 쓴다.
 * rotation 이 있으면 이 값은 돌아간 상자의 로컬 축 기준이다. */
export function buildingHalf(building, axis, fallbackMargin = MARGIN) {
  const given = axis === 'x' ? building.width : building.depth;
  if (Number.isFinite(given) && given > 0) return given / 2 + marginOf(building, fallbackMargin);
  // lot 이 없는 장애물은 공항 건물처럼 손으로 적은 것이다. 예전 기본값을 그대로 쓴다.
  const lot = Number.isFinite(building.lot) && building.lot > 0 ? building.lot * MASS_LOT_RATIO : 20;
  return lot / 2 + marginOf(building, fallbackMargin);
}

/** 돌아간 상자를 축에 맞춘 상자로 감쌌을 때의 반폭이다. 격자에 넣을 때만 쓴다. */
function coverHalf(building, axis) {
  const turn = Number.isFinite(building.rotation) ? building.rotation : 0;
  const halfX = buildingHalf(building, 'x'), halfZ = buildingHalf(building, 'z');
  if (!turn) return axis === 'x' ? halfX : halfZ;
  const cos = Math.abs(Math.cos(turn)), sin = Math.abs(Math.sin(turn));
  return axis === 'x' ? cos * halfX + sin * halfZ : sin * halfX + cos * halfZ;
}

/** 선분 한 축의 slab 교차다. [enter, leave] 를 좁혀 돌려주고 빗나가면 null 이다. */
function slab(from, to, min, max, span) {
  const direction = to - from;
  if (Math.abs(direction) < 1e-9) return from < min || from > max ? null : span;
  const a = (min - from) / direction, b = (max - from) / direction;
  span[0] = Math.max(span[0], Math.min(a, b));
  span[1] = Math.min(span[1], Math.max(a, b));
  return span[0] > span[1] ? null : span;
}

const SPAN = [0, 1];

/** 선분 from-to 가 건물 상자를 지나는지 본다. 상자는 바닥 -2 부터 지붕 위 여유까지다.
 * 기본 지붕 여유는 4 이고, 상판 바로 아래 교각처럼 보이는 높이가 정확한 구조물은
 * roofMargin:0 을 명시해 차가 상판 위에서 보이지 않는 충돌에 걸리지 않게 한다.
 * 점이 아니라 선분으로 보므로 빠르게 움직여도 벽을 뚫고 지나가지 않는다.
 * rotation 이 있으면 선분을 상자의 축으로 돌려서 본다. 돌아간 가드레일을 감싸는
 * 축 정렬 상자로 보면 호 안쪽 차선까지 막힌다. */
export function hitsBuilding(from, to, building, clearance = {}) {
  const margin = Number.isFinite(clearance.margin) ? clearance.margin : MARGIN;
  const roofMargin = Number.isFinite(clearance.roofMargin) ? clearance.roofMargin : 4;
  const radius = Number.isFinite(clearance.radius) ? Math.max(0, clearance.radius) : 0;
  const halfX = buildingHalf(building, 'x', margin) + radius, halfZ = buildingHalf(building, 'z', margin) + radius;
  const turn = Number.isFinite(building.rotation) ? building.rotation : 0;
  let fromX = from.x - building.x, fromZ = from.z - building.z;
  let toX = to.x - building.x, toZ = to.z - building.z;
  if (turn) {
    const cos = Math.cos(turn), sin = Math.sin(turn);
    const fx = cos * fromX - sin * fromZ, tx = cos * toX - sin * toZ;
    fromZ = sin * fromX + cos * fromZ; toZ = sin * toX + cos * toZ;
    fromX = fx; toX = tx;
  }
  SPAN[0] = 0; SPAN[1] = 1;
  return slab(fromX, toX, -halfX, halfX, SPAN) !== null
    && slab(from.y, to.y, -2 - radius, building.height + roofMarginOf(building, roofMargin) + radius, SPAN) !== null
    && slab(fromZ, toZ, -halfZ, halfZ, SPAN) !== null;
}

const cellKey = (cx, cz) => cx * 65536 + cz;

function buildGrid(buildings) {
  const cells = new Map(), loose = [];
  buildings.forEach((building, index) => {
    const halfX = coverHalf(building, 'x'), halfZ = coverHalf(building, 'z');
    if (![building?.x, building?.z, halfX, halfZ].every(Number.isFinite)) { loose.push(index); return; }
    const x0 = Math.floor((building.x - halfX) / CELL), x1 = Math.floor((building.x + halfX) / CELL);
    const z0 = Math.floor((building.z - halfZ) / CELL), z1 = Math.floor((building.z + halfZ) / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      const key = cellKey(cx, cz);
      const list = cells.get(key);
      if (list) list.push(index); else cells.set(key, [index]);
    }
  });
  return { cells, loose, length: buildings.length, seen: new Uint32Array(buildings.length), stamp: 0 };
}

const GRIDS = new WeakMap();

/** 같은 배열이면 격자를 다시 만들지 않는다. 길이가 바뀌었으면 누가 배열을 고친 것이라 새로 만든다. */
function gridOf(buildings) {
  let grid = GRIDS.get(buildings);
  if (!grid || grid.length !== buildings.length) { grid = buildGrid(buildings); GRIDS.set(buildings, grid); }
  return grid;
}

/** 선분이 배열의 어느 건물이든 지나면 true 다. buildings.some(hitsBuilding) 과 결과가 같다.
 * except 로 준 건물 하나는 보지 않는다. clearance 는 개별 여유 값이 없는 상자에 쓸 기본값이다. */
export function hitsAnyBuilding(from, to, buildings, except = null, clearance = null) {
  if (!buildings?.length) return false;
  const finite = Number.isFinite(from.x) && Number.isFinite(from.z) && Number.isFinite(to.x) && Number.isFinite(to.z);
  const hit = (building) => hitsBuilding(from, to, building, clearance || undefined);
  const linear = () => buildings.some((building) => building !== except && hit(building));
  if (buildings.length < LINEAR_BELOW || !finite) return linear();
  // Expanding both local box axes reaches sqrt(2) times farther when rotated.
  const padding = (Math.max(0, clearance?.radius || 0) + Math.max(0, (clearance?.margin || 0) - MARGIN)) * Math.SQRT2;
  const x0 = Math.floor((Math.min(from.x, to.x) - padding) / CELL), x1 = Math.floor((Math.max(from.x, to.x) + padding) / CELL);
  const z0 = Math.floor((Math.min(from.z, to.z) - padding) / CELL), z1 = Math.floor((Math.max(from.z, to.z) + padding) / CELL);
  // 도시를 가로지르는 긴 선분은 칸을 도는 비용이 전부 훑는 것보다 크다.
  if ((x1 - x0 + 1) * (z1 - z0 + 1) > buildings.length / 2) return linear();
  const grid = gridOf(buildings);
  for (const index of grid.loose) if (buildings[index] !== except && hit(buildings[index])) return true;
  // 한 건물이 여러 칸에 걸쳐 있으므로 이번 질의에서 이미 본 건물은 건너뛴다.
  grid.stamp = grid.stamp === 0xffffffff ? 1 : grid.stamp + 1;
  if (grid.stamp === 1) grid.seen.fill(0);
  for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
    const list = grid.cells.get(cellKey(cx, cz));
    if (!list) continue;
    for (let i = 0; i < list.length; i++) {
      const index = list[i];
      if (grid.seen[index] === grid.stamp) continue;
      grid.seen[index] = grid.stamp;
      if (buildings[index] !== except && hit(buildings[index])) return true;
    }
  }
  return false;
}
