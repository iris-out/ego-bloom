/** 도시 네 모서리를 비워 두는 자연지대와 연못의 단일 출처다. 도로 그래프, 블록 격자,
 * 배치, 렌더가 모두 이 파일을 읽는다. three, react, 브라우저 API 에 기대지 않는 순수
 * 모듈이라 node 단위 테스트가 그대로 돈다.
 *
 * 좌표는 extent 비율이다. 도시가 커지거나 작아져도 같은 모양이 나온다. */

/** 모서리 점은 지구 사각형의 바깥 꼭짓점(COLUMNS, ROWS 의 0.97) 과 같다. 반경은 그
 * 점을 중심으로 한 사분원이라 도시 넓이의 13% 를 먹는다. */
export const NATURE_CORNER = 0.97;
export const NATURE_RADIUS = 0.40;
/** 외곽 순환로가 도는 호의 반경이다. 자연지대 경계보다 한 뼘 바깥이라 순환로가
 * 지형을 파고들지 않는다. */
export const NATURE_ARC_RADIUS = 0.41;

/** 모서리마다 성격이 다르다. 북동은 산악, 북서는 골짜기, 남서는 해안 사구,
 * 남동은 호수 공원이다. 북쪽이 -z 다. */
const CORNERS = Object.freeze([
  Object.freeze({ key: 'ne', sx: 1, sz: -1, theme: 'mountain' }),
  Object.freeze({ key: 'nw', sx: -1, sz: -1, theme: 'valley' }),
  Object.freeze({ key: 'sw', sx: -1, sz: 1, theme: 'dune' }),
  Object.freeze({ key: 'se', sx: 1, sz: 1, theme: 'lake' }),
]);

const finite = (value, fallback) => (Number.isFinite(value) ? value : fallback);
const span = (extent) => Math.max(1, finite(extent, 1766));

/** urbanPlan.js 의 planCache 와 같은 방식이다. 같은 extent 면 같은 배열 참조를 돌려준다. */
const CACHE_MAX = 4;
const cornerCache = new Map();
const pondCache = new Map();

function cached(cache, extent, build) {
  const hit = cache.get(extent);
  if (hit) return hit;
  const built = build();
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(extent, built);
  return built;
}

/** 네 모서리 자연지대다. x, z 는 모서리 점이고 r 은 그 점을 중심으로 한 반경이다. */
export function natureCorners(extent) {
  const e = span(extent);
  return cached(cornerCache, e, () => Object.freeze(CORNERS.map((corner) => Object.freeze({
    key: corner.key,
    x: corner.sx * NATURE_CORNER * e,
    z: corner.sz * NATURE_CORNER * e,
    r: NATURE_RADIUS * e,
    theme: corner.theme,
  }))));
}

/** 점이 네 모서리 자연지대 안인지 본다. 건물도 NPC 도 여기 서지 않는다. */
export function inNature(extent, x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  for (const corner of natureCorners(extent)) {
    if (Math.hypot(x - corner.x, z - corner.z) <= corner.r) return true;
  }
  return false;
}

/** 자연지대가 품는 물이다. 남동 호수 하나와 북서 골짜기 못 둘이다. 좌표는
 * 모서리 점에서 도시 안쪽으로 반경 비율만큼 들어온 자리다. */
const VALLEY_PONDS = Object.freeze([
  Object.freeze({ key: 'nw-a', inX: 0.40, inZ: 0.30, rx: 0.03 }),
  Object.freeze({ key: 'nw-b', inX: 0.62, inZ: 0.55, rx: 0.03 }),
]);

export function naturePonds(extent) {
  const e = span(extent);
  return cached(pondCache, e, () => {
    const byKey = new Map(natureCorners(e).map((corner) => [corner.key, corner]));
    const lake = byKey.get('se');
    const valley = byKey.get('nw');
    const ponds = [Object.freeze({
      key: 'se-lake',
      x: lake.x - Math.sign(lake.x) * 0.45 * lake.r,
      z: lake.z - Math.sign(lake.z) * 0.45 * lake.r,
      rx: 0.10 * e, rz: 0.08 * e, kind: 'lake',
    })];
    for (const pond of VALLEY_PONDS) {
      ponds.push(Object.freeze({
        key: pond.key,
        x: valley.x - Math.sign(valley.x) * pond.inX * valley.r,
        z: valley.z - Math.sign(valley.z) * pond.inZ * valley.r,
        rx: pond.rx * e, rz: pond.rx * 0.8 * e, kind: 'pond',
      }));
    }
    return Object.freeze(ponds);
  });
}

/** 점이 연못 안인지 본다. 타원 판정이라 rx 와 rz 가 다른 못도 맞는다.
 * plan.ponds 는 자연지대 물에 공원 연못과 남안 습지까지 더한 목록이다. */
export function inPond(plan, x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
  for (const pond of plan?.ponds || []) {
    const dx = (x - pond.x) / (pond.rx || 1), dz = (z - pond.z) / (pond.rz || 1);
    if (dx * dx + dz * dz < 1) return true;
  }
  return false;
}
