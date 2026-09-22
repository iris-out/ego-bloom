import { ROAD_WIDTH } from './urbanPlan.js';
import { bridgeSegment } from './bridgeGeometry.js';
import { roadRibbon } from './roadRibbon.js';

const CELL = 64;
const LEVEL_EPSILON = 2.5;
const GEOMETRY_EPSILON = 1e-5;
const cache = new WeakMap();

const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));

function segmentOf(value) {
  if (!value) return null;
  if ([value.x1, value.z1, value.x2, value.z2].every(Number.isFinite)) return value;
  if (!Number.isFinite(value.x) || !Number.isFinite(value.z) || !Number.isFinite(value.length)) return null;
  const half = value.length / 2;
  if (value.axis === 'x') return { ...value, x1: value.x - half, z1: value.z, x2: value.x + half, z2: value.z };
  if (value.axis === 'z') return { ...value, x1: value.x, z1: value.z - half, x2: value.x, z2: value.z + half };
  const rotation = Number.isFinite(value.rotation) ? value.rotation : 0;
  const ux = Math.sin(rotation), uz = Math.cos(rotation);
  return { ...value, x1: value.x - ux * half, z1: value.z - uz * half,
    x2: value.x + ux * half, z2: value.z + uz * half };
}

function endpointHeight(segment, end, fallback = 0) {
  const direct = end ? segment.y2 : segment.y1;
  if (Number.isFinite(direct)) return direct;
  if (Number.isFinite(segment.deckY)) return segment.deckY;
  if (Number.isFinite(segment.y)) return segment.y;
  if (segment.elevated && Number.isFinite(segment.height)) return segment.height;
  return fallback;
}

function obstacle(source, segment, width, y0, y1, type) {
  const dx = segment.x2 - segment.x1, dz = segment.z2 - segment.z1;
  const length = Math.hypot(dx, dz);
  if (!(length > GEOMETRY_EPSILON) || !(width > 0)) return null;
  return {
    source, segment, type, width, halfWidth: width / 2,
    x1: segment.x1, z1: segment.z1, x2: segment.x2, z2: segment.z2,
    dx, dz, length, length2: length * length, ux: dx / length, uz: dz / length,
    y0, y1,
    minX: Math.min(segment.x1, segment.x2) - width / 2,
    maxX: Math.max(segment.x1, segment.x2) + width / 2,
    minZ: Math.min(segment.z1, segment.z2) - width / 2,
    maxZ: Math.max(segment.z1, segment.z2) + width / 2,
  };
}

function collectObstacles(plan) {
  const out = [];
  for (const road of plan.roads || []) {
    const segment = segmentOf(road);
    if (!segment || road.tunnel) continue;
    const width = road.width ?? ROAD_WIDTH[road.kind] ?? 8;
    const fallback = road.elevated ? (plan.highwayDeck ?? 14) : 0;
    const item = obstacle(road, segment, width,
      endpointHeight(road, 0, fallback), endpointHeight(road, 1, fallback), 'road');
    if (item) out.push(item);
  }
  for (const ramp of plan.ramps || []) {
    const points = ramp.points || [];
    // A miter reaches farther than half-width at a bend. Keep the existing
    // conservative capsule index, but make it contain the actual ribbon corners.
    const ribbon = roadRibbon(points.map(point => Array.isArray(point)
      ? point : [point.x, point.z, point.y, point.width]), { width: ramp.width ?? 8 });
    const radii = ribbon.sections.map(({ center, left, right }) => Math.max(
      Math.hypot(left[0] - center[0], left[2] - center[2]),
      Math.hypot(right[0] - center[0], right[2] - center[2])));
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1], b = points[i];
      const ax = Array.isArray(a) ? a[0] : a.x, az = Array.isArray(a) ? a[1] : a.z;
      const bx = Array.isArray(b) ? b[0] : b.x, bz = Array.isArray(b) ? b[1] : b.z;
      const ay = Array.isArray(a) ? a[2] : a.y, by = Array.isArray(b) ? b[2] : b.y;
      const aw = Array.isArray(a) ? a[3] : a.width, bw = Array.isArray(b) ? b[3] : b.width;
      const segment = { ...ramp, x1: ax, z1: az, x2: bx, z2: bz };
      const item = obstacle(ramp, segment, Math.max(aw || 0, bw || 0, ramp.width || 0, 8,
        2 * radii[i - 1], 2 * radii[i]),
        Number.isFinite(ay) ? ay : 0, Number.isFinite(by) ? by : 0, 'ramp');
      if (item) out.push(item);
    }
    if (points.length >= 2) continue;
    const from = ramp.from, to = ramp.to;
    if (!from || !to) continue;
    const segment = { ...ramp, x1: from.x, z1: from.z, x2: to.x, z2: to.z };
    const item = obstacle(ramp, segment, ramp.width ?? 8, from.y ?? 0, to.y ?? 0, 'ramp');
    if (item) out.push(item);
  }
  for (const bridge of plan.bridges || []) {
    const segment = bridgeSegment(bridge);
    if (!segment) continue;
    const y = bridge.deckY ?? bridge.y ?? 0;
    const item = obstacle(bridge, segment, bridge.width ?? 15,
      endpointHeight(bridge, 0, y), endpointHeight(bridge, 1, y), 'bridge');
    if (item) out.push(item);
  }
  return out;
}

function buildIndex(obstacles) {
  const cells = new Map();
  const put = (x, z, item) => {
    const key = `${x}:${z}`;
    const bucket = cells.get(key);
    if (bucket) bucket.push(item); else cells.set(key, [item]);
  };
  for (const item of obstacles) {
    const x0 = Math.floor(item.minX / CELL), x1 = Math.floor(item.maxX / CELL);
    const z0 = Math.floor(item.minZ / CELL), z1 = Math.floor(item.maxZ / CELL);
    for (let x = x0; x <= x1; x += 1) for (let z = z0; z <= z1; z += 1) put(x, z, item);
  }
  return (minX, minZ, maxX, maxZ) => {
    const found = new Set();
    const x0 = Math.floor(minX / CELL), x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL), z1 = Math.floor(maxZ / CELL);
    for (let x = x0; x <= x1; x += 1) for (let z = z0; z <= z1; z += 1) {
      for (const item of cells.get(`${x}:${z}`) || []) found.add(item);
    }
    return found;
  };
}

function sameLogicalRoad(source, item) {
  if (source === item.source || source === item.segment) return true;
  if (source?.sourceRoad && (source.sourceRoad === item.source || source.sourceRoad === item.segment)) return true;
  // id/path 하나는 여러 곡선 조각이 공유한다. 이름만 같다고 빼면 굽은 이웃 조각의
  // 차도를 난간이 침범하므로, 복제/분할 중심선이 실제로 겹칠 때만 자기 도로다.
  const candidate = segmentOf(source);
  if (!candidate) return false;
  const ax = candidate.x2 - candidate.x1, az = candidate.z2 - candidate.z1;
  const aLength = Math.hypot(ax, az);
  if (!(aLength > GEOMETRY_EPSILON)) return false;
  const parallel = Math.abs(ax * item.dz - az * item.dx) / (aLength * item.length);
  if (parallel > 1e-5) return false;
  const lineDistance = Math.abs((item.x1 - candidate.x1) * az - (item.z1 - candidate.z1) * ax) / aLength;
  if (lineDistance > 0.05) return false;
  const projection = (x, z) => ((x - candidate.x1) * ax + (z - candidate.z1) * az) / (aLength * aLength);
  const low = Math.min(projection(item.x1, item.z1), projection(item.x2, item.z2));
  const high = Math.max(projection(item.x1, item.z1), projection(item.x2, item.z2));
  return high >= -GEOMETRY_EPSILON && low <= 1 + GEOMETRY_EPSILON;
}

function slabInterval(origin, delta, low, high) {
  if (Math.abs(delta) < GEOMETRY_EPSILON) return origin >= low && origin <= high ? [0, 1] : null;
  const a = (low - origin) / delta, b = (high - origin) / delta;
  return [Math.max(0, Math.min(a, b)), Math.min(1, Math.max(a, b))];
}

function rectangleInterval(a, d, item, radius) {
  const au = (a.x - item.x1) * item.ux + (a.z - item.z1) * item.uz;
  const av = -(a.x - item.x1) * item.uz + (a.z - item.z1) * item.ux;
  const du = d.x * item.ux + d.z * item.uz;
  const dv = -d.x * item.uz + d.z * item.ux;
  const along = slabInterval(au, du, 0, item.length);
  const across = slabInterval(av, dv, -radius, radius);
  if (!along || !across) return null;
  const from = Math.max(along[0], across[0]), to = Math.min(along[1], across[1]);
  return to >= from ? [from, to] : null;
}

function circleInterval(a, d, x, z, radius) {
  const ox = a.x - x, oz = a.z - z;
  const qa = d.x * d.x + d.z * d.z;
  if (qa < GEOMETRY_EPSILON) return ox * ox + oz * oz <= radius * radius ? [0, 1] : null;
  const qb = 2 * (ox * d.x + oz * d.z);
  const qc = ox * ox + oz * oz - radius * radius;
  const discriminant = qb * qb - 4 * qa * qc;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const from = Math.max(0, (-qb - root) / (2 * qa));
  const to = Math.min(1, (-qb + root) / (2 * qa));
  return to >= from ? [from, to] : null;
}

function footprintInterval(a, b, item, margin) {
  const d = { x: b.x - a.x, z: b.z - a.z };
  const radius = item.halfWidth + margin;
  const intervals = [
    rectangleInterval(a, d, item, radius),
    circleInterval(a, d, item.x1, item.z1, radius),
    circleInterval(a, d, item.x2, item.z2, radius),
  ].filter(Boolean);
  if (!intervals.length) return null;
  return [Math.min(...intervals.map((span) => span[0])), Math.max(...intervals.map((span) => span[1]))];
}

function bandInterval(from, to, intercept, slope, reach) {
  if (Math.abs(slope) < GEOMETRY_EPSILON) return Math.abs(intercept) <= reach ? [from, to] : null;
  const a = (-reach - intercept) / slope, b = (reach - intercept) / slope;
  const low = Math.max(from, Math.min(a, b)), high = Math.min(to, Math.max(a, b));
  return high >= low ? [low, high] : null;
}

function heightIntervals(interval, a, b, sy0, sy1, item) {
  const qdx = b.x - a.x, qdz = b.z - a.z;
  const alpha = ((a.x - item.x1) * item.dx + (a.z - item.z1) * item.dz) / item.length2;
  const beta = (qdx * item.dx + qdz * item.dz) / item.length2;
  const cuts = [interval[0], interval[1]];
  if (Math.abs(beta) > GEOMETRY_EPSILON) {
    for (const edge of [0, 1]) {
      const t = (edge - alpha) / beta;
      if (t > interval[0] && t < interval[1]) cuts.push(t);
    }
  }
  cuts.sort((x, y) => x - y);
  const sourceSlope = sy1 - sy0, roadSlope = item.y1 - item.y0;
  const out = [];
  for (let i = 1; i < cuts.length; i += 1) {
    const from = cuts[i - 1], to = cuts[i], middle = (from + to) / 2;
    const projected = alpha + beta * middle;
    let roadIntercept, roadRate;
    if (projected <= 0) {
      roadIntercept = item.y0; roadRate = 0;
    } else if (projected >= 1) {
      roadIntercept = item.y1; roadRate = 0;
    } else {
      roadIntercept = item.y0 + roadSlope * alpha;
      roadRate = roadSlope * beta;
    }
    const clipped = bandInterval(from, to, sy0 - roadIntercept, sourceSlope - roadRate, LEVEL_EPSILON);
    if (clipped) out.push(clipped);
  }
  return out;
}

function mergeIntervals(intervals) {
  const sorted = intervals
    .map(([from, to]) => [clamp(from), clamp(to)])
    .filter(([from, to]) => to - from > GEOMETRY_EPSILON)
    .sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const span of sorted) {
    const last = merged.at(-1);
    if (!last || span[0] > last[1] + GEOMETRY_EPSILON) merged.push([...span]);
    else last[1] = Math.max(last[1], span[1]);
  }
  return merged;
}

function complement(intervals) {
  const out = [];
  let cursor = 0;
  for (const [from, to] of mergeIntervals(intervals)) {
    if (from > cursor + GEOMETRY_EPSILON) out.push([cursor, from]);
    cursor = Math.max(cursor, to);
  }
  if (cursor < 1 - GEOMETRY_EPSILON) out.push([cursor, 1]);
  return out;
}

/**
 * 공통 도로 점유 검사다. clearSpans 는 source 의 진행방향 정규화 구간을 반환하며,
 * source 자체(동일 객체 또는 겹치는 복제 중심선)는 장애물에서 제외한다.
 */
export function roadClearance(plan = {}) {
  if (plan && typeof plan === 'object' && cache.has(plan)) return cache.get(plan);
  const obstacles = collectObstacles(plan);
  const near = buildIndex(obstacles);

  // 기둥의 바닥만 검사하면 낮은 램프를 뚫고 올라간다. 전체 수직 구간과
  // 노면의 차량 여유를 비교한다. 자기 상판 위 난간등은 지지 도로만 제외한다.
  const columnClear = (x, z, radius = 0, bottom = 0, top = bottom, source = null) => {
    if (![x, z, radius, bottom, top].every(Number.isFinite) || top < bottom) return false;
    const reach = Math.max(0, radius);
    for (const item of near(x - reach - 32, z - reach - 32, x + reach + 32, z + reach + 32)) {
      const t = clamp(((x - item.x1) * item.dx + (z - item.z1) * item.dz) / item.length2);
      const px = item.x1 + item.dx * t, pz = item.z1 + item.dz * t;
      const roadY = item.y0 + (item.y1 - item.y0) * t;
      if (source) {
        if (source === item.source || source.sourceRoad === item.source) continue;
        // 같은 평면 중심선이라도 위층 도로라면 다른 도로다.
        const own = segmentOf(source);
        if (own && sameLogicalRoad(source, item)) {
          const dx = own.x2 - own.x1, dz = own.z2 - own.z1;
          const along = clamp(((x - own.x1) * dx + (z - own.z1) * dz) / (dx * dx + dz * dz || 1));
          const y0 = endpointHeight(own, 0), y1 = endpointHeight(own, 1);
          if (Math.abs(y0 + (y1 - y0) * along - roadY) < GEOMETRY_EPSILON) continue;
        }
      }
      if (bottom <= roadY + LEVEL_EPSILON && top >= roadY - LEVEL_EPSILON
        && Math.hypot(x - px, z - pz) <= item.halfWidth + reach + GEOMETRY_EPSILON) return false;
    }
    return true;
  };
  const pointClear = (x, z, radius = 0, y = 0) => columnClear(x, z, radius, y, y);

  const clearSpans = (source, offset = 0, margin = 0) => {
    const segment = segmentOf(source);
    if (!segment || ![offset, margin].every(Number.isFinite)) return [];
    const dx = segment.x2 - segment.x1, dz = segment.z2 - segment.z1;
    const length = Math.hypot(dx, dz);
    if (!(length > GEOMETRY_EPSILON)) return [];
    const px = -dz / length, pz = dx / length;
    const a = { x: segment.x1 + px * offset, z: segment.z1 + pz * offset };
    const b = { x: segment.x2 + px * offset, z: segment.z2 + pz * offset };
    const sy0 = endpointHeight(segment, 0, segment.elevated ? (plan.highwayDeck ?? 14) : 0);
    const sy1 = endpointHeight(segment, 1, segment.elevated ? (plan.highwayDeck ?? 14) : 0);
    const pad = Math.max(0, margin) + 32;
    const candidates = near(Math.min(a.x, b.x) - pad, Math.min(a.z, b.z) - pad,
      Math.max(a.x, b.x) + pad, Math.max(a.z, b.z) + pad);
    const blocked = [];
    for (const item of candidates) {
      if (sameLogicalRoad(source, item)) continue;
      const interval = footprintInterval(a, b, item, Math.max(0, margin));
      if (!interval) continue;
      blocked.push(...heightIntervals(interval, a, b, sy0, sy1, item));
    }
    return complement(blocked);
  };

  const api = Object.freeze({ pointClear, columnClear, clearSpans });
  if (plan && typeof plan === 'object') cache.set(plan, api);
  return api;
}
