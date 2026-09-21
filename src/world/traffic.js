import { nextYieldLag, yieldBrake, YIELD_REACH } from './trafficYield.js';
import { ROAD_TOP } from './carPhysics.js';
import { createUrbanPlan, pointOnRoute, ROAD_WIDTH } from '../../shared/urbanPlan.js';

/** 도시를 도는 AI 차량의 위치 계산. 순수 함수이며 렌더와 충돌 판정이 같은 식을 쓴다.
 * 위치는 (차 번호, 시간, 도시 크기) 만으로 정해진다. 차 수와 품질에 기대지 않으므로
 * 차가 적은 브라우저는 같은 자리의 같은 차 가운데 앞 번호만 본다.
 *
 * 열린 경로는 끝에서 반원으로 유턴해 반대 차선으로 돌아오는 한 바퀴(회로) 가 되고, 닫힌
 * 순환로는 방향마다 한 바퀴다. 회로의 차선 하나(띠) 는 속도 프로파일 하나를 갖고, 띠 안의
 * 차는 모두 그 프로파일을 시간만 어긋나게 탄다. 시간 차가 고정이라 앞차를 뚫고 지나가지
 * 않고, 경로 끝에서 처음으로 순간이동하지도 않는다. */
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const wrapAngle = (value) => { let diff = (value + Math.PI) % (Math.PI * 2); if (diff < 0) diff += Math.PI * 2; return diff - Math.PI; };
const blendAngle = (from, to, t) => from + wrapAngle(to - from) * t;

/** 차선 표의 간격이다. 곧은 길은 선형 보간이 정확하고, 이음매 방위 섞기(앞뒤 14) 는 열네 칸에 걸친다. */
const STEP = 2;
/** 유턴 반원의 간격이다. 안쪽 차선 반지름 2.5 에서도 반원이 여덟 칸이다. */
const TURN_STEP = 1;
/** urbanPlan.pointOnRoute 가 이음매 방위를 섞는 거리와 같다. 닫힌 경로의 시작 이음매는
 * pointOnRoute 가 섞지 않아 방위가 튀므로 여기서 같은 거리로 섞는다. */
const BLEND_REACH = 14;
/** 도로 종류별 자유 주행 속도(월드 단위/초) 다. 2차선 도로의 바깥 차선은 OUTER_LANE 배이고
 * 띠마다 SPREAD 폭 안에서 결정적으로 흔든다. */
export const TRAFFIC_SPEED = Object.freeze({ highway: 13, arterial: 11, collector: 9, lane: 6.5 });
const OUTER_LANE = 0.88, SPREAD = 0.1;
export const TRAFFIC_TOP_SPEED = Math.max(...Object.values(TRAFFIC_SPEED)) * (1 + SPREAD / 2);
/** 횡가속, 가속, 감속 한계다. 실측이 아니라 화면에서 맞춘 설계 값이다. */
const LATERAL = 2.4, ACCEL = 2.2, DECEL = 3.5;
/** 속도 바닥(v0 배수) 이다. 0 에 가까우면 시간 표를 뒤집을 수 없고, 띠 안 차 간격이 이 값에 비례한다. */
const FLOOR = 0.35;
/** 유턴과 교차로 앞뒤 CROSS_REACH 안에서 누르는 속도(v0 배수) 다. 신호가 없어 서로 비키지는 않는다. */
const TURN_SPEED = 0.5, CROSS_SPEED = 0.6, CROSS_REACH = 10;
/** 경로 끝에서 이만큼 앞에서 유턴한다. 끝이 닿는 순환로(반폭 7.5) 나 간선(반폭 11) 의 차선을 침범하지 않는다. */
const END_CLEAR = 11;
/** 한 띠 안의 차 중심 사이 최소 거리(차선을 따라 잰 값) 다. 트럭 길이 7.4 보다 넉넉하다. */
export const TRAFFIC_GAP = 10.5;
/** 차 번호를 도시 전체 차선 길이에 뿌리는 저불일치 수열의 간격이다. 앞 번호 몇 개만 봐도 고르게 퍼진다. */
const GOLDEN = 0.6180339887498949;

const hash01 = (text) => {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0) / 4294967296;
};

/** 경로 하나의 길이 표, 도로 폭, 차선 수다. 누적 길이는 pointOnRoute 와 같은 순서로 더해 s/total 이 어긋나지 않는다. */
function shapeOf(plan, route) {
  const points = route.points, count = points.length;
  const offsets = new Float64Array(count);
  for (let i = 1; i < count; i += 1) offsets[i] = offsets[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  const total = offsets[count - 1] || 1;
  const road = plan.roads.find((segment) => segment.path === route.id);
  const half = (ROAD_WIDTH[road?.kind] || ROAD_WIDTH.lane) / 2, lanes = half >= 10 ? 2 : 1;
  const [fx, fz] = points[0], [lx, lz] = points[count - 1];
  const first = Math.atan2(points[1][0] - fx, points[1][1] - fz);
  const last = Math.atan2(lx - points[count - 2][0], lz - points[count - 2][1]);
  return {
    route, offsets, total, half, lanes, laneWidth: half / lanes,
    speed: TRAFFIC_SPEED[road?.kind] || TRAFFIC_SPEED.lane,
    closed: count > 3 && Math.hypot(fx - lx, fz - lz) < 1,
    first, last, joint: last + wrapAngle(first - last) / 2,
    headReach: Math.min(BLEND_REACH, offsets[1] / 2), tailReach: Math.min(BLEND_REACH, (total - offsets[count - 2]) / 2),
  };
}

function centreAt(shape, s) {
  const pose = pointOnRoute(shape.route, s / shape.total);
  if (!shape.closed) return pose;
  const { total, headReach, tailReach } = shape;
  if (s < headReach) return { x: pose.x, z: pose.z, angle: blendAngle(shape.joint, shape.first, s / headReach) };
  if (s > total - tailReach) return { x: pose.x, z: pose.z, angle: blendAngle(shape.last, shape.joint, (s - (total - tailReach)) / tailReach) };
  return pose;
}

function nearestOn(shape, x, z) {
  const points = shape.route.points;
  let gap = Infinity, along = 0;
  for (let i = 1; i < points.length; i += 1) {
    const [ax, az] = points[i - 1], dx = points[i][0] - ax, dz = points[i][1] - az, len2 = dx * dx + dz * dz;
    const t = len2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2)) : 0;
    const ex = x - ax - dx * t, ez = z - az - dz * t, away = Math.sqrt(ex * ex + ez * ez);
    if (away < gap) { gap = away; along = shape.offsets[i - 1] + (shape.offsets[i] - shape.offsets[i - 1]) * t; }
  }
  return { gap, along };
}

/** 다른 경로와 만나는 자리(중심선 거리) 다. urbanPlan 이 교차점을 양쪽 경로에 꼭짓점으로 끼워 두므로
 * 내 꼭짓점이 남의 길 위에 있는지 본다. T 자 끝은 꼭짓점이 없어 남의 끝점을 내 길에 대 본다. */
function crossingsOf(shapes, own) {
  const out = [];
  for (const other of shapes) {
    if (other === own) continue;
    own.route.points.forEach(([x, z], i) => { if (nearestOn(other, x, z).gap <= other.half + 2) out.push(own.offsets[i]); });
    if (other.closed) continue;
    for (const [x, z] of [other.route.points[0], other.route.points[other.route.points.length - 1]]) {
      const hit = nearestOn(own, x, z);
      if (hit.gap <= own.half + 2) out.push(hit.along);
    }
  }
  // 양쪽 판정이 같은 교차로를 두 번 넣으므로 가까운 것은 하나로 합친다.
  return out.sort((a, b) => a - b).filter((at, i, list) => !i || at - list[i - 1] > 1);
}

/** 경로 하나의 회로들이다. 조각은 중심선 구간(from, to) 이나 유턴(at) 이다. */
function circuitsOf(shape) {
  const { total, closed, lanes, laneWidth } = shape;
  if (closed) return [[{ from: 0, to: total, dir: 1 }], [{ from: total, to: 0, dir: -1 }]];
  // 차선이 둘이면 두 유턴을 같은 중심에 두어 반원끼리 닿지 않게 한다.
  const reach = laneWidth * (lanes - 0.5) + END_CLEAR;
  const a = Math.min(reach, total / 2), b = Math.max(total - reach, total / 2);
  return [[{ from: a, to: b, dir: 1 }, { at: b, dir: 1 }, { from: b, to: a, dir: -1 }, { at: a, dir: -1 }]];
}

/** 중심선 구간 [lo, hi] 의 표본이다. 경로의 차선과 방향이 모두 같은 점을 쓰므로 경로마다 한 번만 잰다.
 * 반대 방향은 같은 표를 거꾸로 읽는다. */
function passSamples(shape, lo, hi) {
  if (shape.pass?.lo === lo && shape.pass.hi === hi) return shape.pass;
  const steps = hi - lo > 1e-6 ? Math.max(1, Math.ceil((hi - lo) / STEP)) : 0;
  const s = new Float64Array(steps + 1), x = new Float64Array(steps + 1), z = new Float64Array(steps + 1), angle = new Float64Array(steps + 1);
  for (let j = 0; j <= steps; j += 1) {
    s[j] = steps ? lo + (hi - lo) * j / steps : lo;
    const centre = centreAt(shape, s[j]);
    x[j] = centre.x; z[j] = centre.z; angle[j] = centre.angle;
  }
  shape.pass = { lo, hi, steps, s, x, z, angle };
  return shape.pass;
}

function traceBand(shape, circuit, offset) {
  const turnSteps = Math.max(6, Math.ceil(Math.PI * offset / TURN_STEP));
  const passOf = (piece) => passSamples(shape, Math.min(piece.from, piece.to), Math.max(piece.from, piece.to));
  const n = circuit.reduce((sum, piece) => sum + (piece.at === undefined ? passOf(piece).steps : turnSteps), 0);
  const xs = new Float64Array(n), zs = new Float64Array(n), heads = new Float64Array(n), along = new Float64Array(n);
  let k = 0;
  const put = (x, z, heading, s) => { xs[k] = x; zs[k] = z; heads[k] = heading; along[k] = s; k += 1; };
  for (const piece of circuit) {
    if (piece.at === undefined) {
      const pass = passOf(piece), reverse = piece.from > piece.to;
      for (let j = 0; j < pass.steps; j += 1) {
        const at = reverse ? pass.steps - j : j;
        const heading = piece.dir > 0 ? pass.angle[at] : pass.angle[at] + Math.PI;
        // 우측통행이다. 진행 방향 앞이 (sin, cos) 이므로 오른쪽은 (-cos, sin) 이다.
        // 기수 0 이 -Z 를 볼 때 +X 가 오른쪽인 carPhysics 와 같다.
        put(pass.x[at] - Math.cos(heading) * offset, pass.z[at] + Math.sin(heading) * offset, heading, pass.s[at]);
      }
      continue;
    }
    // 왼쪽으로 반원을 그려 반대 차선에 들어간다. 반지름이 차선 오프셋이라 중심선을 가로지른다.
    const centre = centreAt(shape, piece.at), base = piece.dir > 0 ? centre.angle : centre.angle + Math.PI;
    const rx = -Math.cos(base), rz = Math.sin(base), fx = Math.sin(base), fz = Math.cos(base);
    const steps = Math.max(6, Math.ceil(Math.PI * offset / TURN_STEP));
    for (let j = 0; j < steps; j += 1) {
      const phi = Math.PI * j / steps, c = Math.cos(phi), s = Math.sin(phi);
      put(centre.x + offset * (rx * c + fx * s), centre.z + offset * (rz * c + fz * s), base + phi, -1);
    }
  }
  return { xs, zs, heads, along };
}

function nearCrossing(shape, crossings, s) {
  for (const at of crossings) {
    const d = Math.abs(s - at);
    if ((shape.closed ? Math.min(d, shape.total - d) : d) < CROSS_REACH) return true;
  }
  return false;
}

/** 띠 하나의 속도 프로파일과 누적 시간 표다. 표는 n+1 칸이고 마지막 칸이 첫 칸으로 되돌아온다.
 * 구간 안은 등가속이라 v^2 이 거리에 선형이다. 시간은 2ds/(v0+v1) 로 정확히 쌓인다. */
function profileBand(raw, shape, crossings, v0) {
  const n = raw.xs.length;
  const X = new Float64Array(n + 1), Z = new Float64Array(n + 1), A = new Float64Array(n + 1);
  const DS = new Float64Array(n + 1), V = new Float64Array(n + 1), T = new Float64Array(n + 1);
  const ACC = new Float64Array(n + 1), S = new Float64Array(n + 1), TURN = new Uint8Array(n + 1);
  for (let k = 0; k < n; k += 1) {
    X[k] = raw.xs[k]; Z[k] = raw.zs[k]; TURN[k] = raw.along[k] < 0 ? 1 : 0;
    // 방위를 이어 붙여 둔다. 보간이 PI 경계에서 반대로 돌지 않는다.
    A[k] = k ? A[k - 1] + wrapAngle(raw.heads[k] - raw.heads[k - 1]) : raw.heads[0];
  }
  X[n] = X[0]; Z[n] = Z[0]; A[n] = A[n - 1] + wrapAngle(raw.heads[0] - raw.heads[n - 1]);
  for (let k = 0; k < n; k += 1) { const dx = X[k + 1] - X[k], dz = Z[k + 1] - Z[k]; DS[k] = Math.sqrt(dx * dx + dz * dz); }
  const floor = FLOOR * v0;
  let slowest = 0;
  for (let k = 0; k < n; k += 1) {
    const prev = (k + n - 1) % n, reach = DS[prev] + DS[k];
    const kappa = reach > 1e-9 ? Math.abs(A[k + 1] - A[prev]) / reach : 0;
    let v = kappa > 1e-9 ? Math.min(v0, Math.sqrt(LATERAL / kappa)) : v0;
    if (TURN[k]) v = Math.min(v, TURN_SPEED * v0);
    else if (nearCrossing(shape, crossings, raw.along[k])) v = Math.min(v, CROSS_SPEED * v0);
    V[k] = Math.max(floor, v);
    if (V[k] < V[slowest]) slowest = k;
  }
  // 가장 느린 칸에서 출발해 한 바퀴씩 뒤로(감속 한계), 앞으로(가속 한계) 훑는다.
  // 가장 느린 칸은 어느 한계로도 더 느려지지 않으므로 고리가 한 번에 닫힌다.
  for (let step = 1; step < n; step += 1) {
    const k = (slowest - step + n) % n, next = (k + 1) % n;
    V[k] = Math.min(V[k], Math.sqrt(V[next] * V[next] + 2 * DECEL * DS[k]));
  }
  for (let step = 1; step < n; step += 1) {
    const k = (slowest + step) % n, prev = (k + n - 1) % n;
    V[k] = Math.min(V[k], Math.sqrt(V[prev] * V[prev] + 2 * ACCEL * DS[prev]));
  }
  V[n] = V[0];
  let vmin = Infinity;
  for (let k = 0; k < n; k += 1) {
    const ds = DS[k], sum = V[k] + V[k + 1];
    T[k + 1] = T[k] + (ds > 1e-9 ? 2 * ds / sum : 0);
    ACC[k] = ds > 1e-9 ? (V[k + 1] * V[k + 1] - V[k] * V[k]) / (2 * ds) : 0;
    S[k + 1] = S[k] + ds;
    vmin = Math.min(vmin, V[k]);
  }
  return { n, X, Z, A, DS, V, T, ACC, S, TURN, lap: T[n], length: S[n], vmin };
}

function buildTables(plan) {
  const shapes = plan.routes.map((route) => shapeOf(plan, route));
  const bands = [];
  for (const shape of shapes) {
    const crossings = crossingsOf(shapes, shape);
    circuitsOf(shape).forEach((circuit, index) => {
      for (let lane = 0; lane < shape.lanes; lane += 1) {
        const key = `${shape.route.id}:${index}:${lane}`, outer = lane === shape.lanes - 1;
        const v0 = shape.speed * (shape.lanes > 1 && outer ? OUTER_LANE : 1) * (1 - SPREAD / 2 + SPREAD * hash01(key));
        const band = profileBand(traceBand(shape, circuit, shape.laneWidth * (lane + 0.5)), shape, crossings, v0);
        if (band.n < 2 || !(band.lap > 0)) continue;
        // 슬롯 시간 간격이 TRAFFIC_GAP / vmin 이상이면 가장 느린 곳에서도 앞차와 그만큼 떨어진다.
        const slots = Math.max(1, Math.floor(band.lap * band.vmin / TRAFFIC_GAP));
        bands.push({ ...band, key, route: shape.route.id, lane, lanes: shape.lanes, outer, v0, slots, phase: hash01(`${key}:phase`) });
      }
    });
  }
  const cumulative = new Float64Array(bands.length + 1);
  bands.forEach((band, b) => { cumulative[b + 1] = cumulative[b] + band.length; });
  return {
    bands, cumulative, capacity: bands.reduce((sum, band) => sum + band.slots, 0),
    taken: bands.map((band) => new Uint8Array(band.slots)),
    assigned: 0, band: new Int32Array(0), slot: new Int32Array(0), offset: new Float64Array(0), truck: new Uint8Array(0),
  };
}

/** 도시 그래프는 extent 마다 한 번 만들어지므로 그 객체에 표를 붙여 둔다. */
const tableCache = new WeakMap();
function tablesFor(extent) {
  const plan = createUrbanPlan(Math.max(1, finite(extent, 180)));
  let tables = tableCache.get(plan);
  if (!tables) { tables = buildTables(plan); tableCache.set(plan, tables); }
  return tables;
}

function grow(array, size) { const next = new array.constructor(size); next.set(array); return next; }

/** 차 번호를 앞에서부터 차례로 띠와 슬롯에 앉힌다. 번호 i 의 자리는 i 보다 앞 번호만 보고 정해지므로
 * 차 수가 달라도 같은 번호는 같은 자리다. 황금비 수열이 차선 길이 비례로 띠를 고르고, 자리가
 * 차 있으면 다음 슬롯, 띠가 다 차면 다음 띠로 넘어간다. */
function assignCars(tables, count) {
  if (count <= tables.assigned || !tables.bands.length) return;
  if (count > tables.band.length) {
    const size = Math.max(count, tables.band.length * 2, 64);
    tables.band = grow(tables.band, size); tables.slot = grow(tables.slot, size);
    tables.offset = grow(tables.offset, size); tables.truck = grow(tables.truck, size);
  }
  const { bands, cumulative, taken, capacity } = tables, total = cumulative[bands.length];
  for (let i = tables.assigned; i < count; i += 1) {
    if (i >= capacity) {
      // 슬롯보다 차가 많으면 앞 번호의 자리를 다시 쓴다. 품질 표의 차 수는 슬롯 수보다 훨씬 적다.
      const same = i % capacity;
      tables.band[i] = tables.band[same]; tables.slot[i] = tables.slot[same];
      tables.offset[i] = tables.offset[same]; tables.truck[i] = tables.truck[same];
      continue;
    }
    const target = ((0.5 + i * GOLDEN) % 1) * total;
    let low = 0, high = bands.length - 1;
    while (low < high) { const mid = (low + high + 1) >> 1; if (cumulative[mid] <= target) low = mid; else high = mid - 1; }
    let b = low, slot = Math.min(bands[b].slots - 1, Math.floor((target - cumulative[b]) / bands[b].length * bands[b].slots));
    for (let tries = 0; ; tries += 1) {
      if (!taken[b][slot]) break;
      if (tries + 1 >= bands[b].slots) { b = (b + 1) % bands.length; slot = 0; tries = -1; continue; }
      slot = (slot + 1) % bands[b].slots;
    }
    const band = bands[b];
    taken[b][slot] = 1;
    tables.band[i] = b; tables.slot[i] = slot;
    tables.offset[i] = (slot + band.phase) * band.lap / band.slots;
    // 트럭은 바깥 차선에만 선다.
    tables.truck[i] = band.outer && i % 4 === 0 ? 1 : 0;
  }
  tables.assigned = count;
}

/** 띠 안에서 시각 t 가 드는 칸이다. 누적 시간 표에서 이진 탐색한다. */
function locate(band, t) {
  const T = band.T;
  let low = 0, high = band.n - 1;
  while (low < high) { const mid = (low + high + 1) >> 1; if (T[mid] <= t) low = mid; else high = mid - 1; }
  return low;
}

function localTime(tables, id, time) {
  const lap = tables.bands[tables.band[id]].lap;
  const t = (time + tables.offset[id]) % lap;
  return t < 0 ? t + lap : t;
}

/** 차 한 대의 자세를 out 의 slot 칸에 쓴다. trafficPose 와 trafficFrame 이 같은 식을 거쳐 값이 똑같다. */
function solve(tables, id, time, out, slot) {
  const band = tables.bands[tables.band[id]], t = localTime(tables, id, time), k = locate(band, t);
  const u = t - band.T[k], v = band.V[k], acc = band.ACC[k], ds = band.DS[k];
  const f = ds > 1e-9 ? Math.max(0, Math.min(1, (v * u + 0.5 * acc * u * u) / ds)) : 0;
  out.x[slot] = band.X[k] + (band.X[k + 1] - band.X[k]) * f;
  out.z[slot] = band.Z[k] + (band.Z[k + 1] - band.Z[k]) * f;
  out.angle[slot] = band.A[k] + (band.A[k + 1] - band.A[k]) * f;
  out.speed[slot] = Math.max(0, v + acc * u);
  // 브레이크등은 프로파일의 실제 감속으로 켠다. 감속 한계에서 1 이다.
  out.braking[slot] = acc < 0 ? Math.min(1, -acc / DECEL) : 0;
  out.truck[slot] = tables.truck[id];
}

const carId = (index) => Math.max(0, Math.floor(finite(index)));

/** AI 차량 충돌 상자의 세로 범위다. 바닥은 도로 상판이고 높이는 TrafficCars.jsx 의 CAR_PARTS
 * 지붕(승용차 유리 윗면 1.91) 과 적재함 윗면(트럭 3.81) 에서 잰 값이다. 조각을 키우면 같이 키운다.
 * 세로를 보지 않으면 차 위 수백 미터를 지나는 탄이 차를 부순다. */
export const TRAFFIC_BODY = Object.freeze({ base: ROAD_TOP, car: 1.6, truck: 3.5 });

function poseInto(box, index, out, slot) {
  const angle = out.angle[slot], truck = out.truck[slot] === 1;
  const long = truck ? 7.4 : 4.3, wide = truck ? 2.7 : 2.2;
  const sideways = Math.abs(Math.sin(angle)) > 0.7;
  box.index = index; box.x = out.x[slot]; box.z = out.z[slot]; box.angle = angle;
  box.truck = truck; box.braking = out.braking[slot]; box.speed = out.speed[slot];
  box.width = sideways ? long : wide; box.depth = sideways ? wide : long;
  box.y = TRAFFIC_BODY.base; box.height = truck ? TRAFFIC_BODY.truck : TRAFFIC_BODY.car;
  return box;
}

const poseOf = (index, out, slot) => poseInto({}, index, out, slot);

const single = { x: new Float64Array(1), z: new Float64Array(1), angle: new Float64Array(1), braking: new Float64Array(1),
  speed: new Float64Array(1), truck: new Uint8Array(1) };

export function trafficPose(index, time, extent) {
  // 인덱스는 충돌한 차량을 화면에서 숨길 때 쓰므로 안정적으로 유지한다.
  const tables = tablesFor(extent), id = carId(index);
  if (!tables.bands.length) return { index, x: 0, z: 0, angle: 0, truck: false, braking: 0, speed: 0, width: 2.2, depth: 4.3,
    y: TRAFFIC_BODY.base, height: TRAFFIC_BODY.car };
  assignCars(tables, id + 1);
  solve(tables, id, finite(time) - lagOf(id), single, 0);
  applyYield(single, 0, id);
  return poseOf(index, single, 0);
}

/** 한 시각의 차량 전체다. 렌더러와 도보, 주행, 비행 판정이 같은 프레임에 같은 시각으로 부르므로
 * 마지막 (시각, 도시) 하나만 들고 있다가 차 수가 늘면 모자란 뒤 번호만 더 계산한다.
 * 돌려주는 객체와 배열은 다음 호출이 덮어쓴다. 받은 자리에서 바로 읽는다. */
/** 차마다의 늦춤(초) 이다. 주인공 차 뒤에 붙은 차만 0 보다 크다. 도시가 바뀌면 지운다. */
let lags = new Float32Array(0), brakes = new Float32Array(0), lagTables = null;

function lagOf(id) {
  return id < lags.length ? lags[id] : 0;
}

/** 늦추는 동안은 계기 속도와 브레이크등도 함께 줄인다. 자세는 늦췄는데 바퀴만 굴러가면
 * 서 있는 차가 달리는 것처럼 보인다. */
function applyYield(out, slot, id) {
  const hold = id < brakes.length ? brakes[id] : 0;
  if (hold <= 0) return;
  out.speed[slot] *= Math.max(0, 1 - hold);
  out.braking[slot] = Math.max(out.braking[slot], hold);
}

/** 주인공 차 뒤를 따라오는 차들의 늦춤을 한 걸음 옮긴다. 지난 프레임의 자리로 본다.
 * 주행 루프가 자리 계산 전에 부른다. 한 프레임 늦게 보지만 눈에 띄지 않는다. */
export function updateTrafficYield(player, dt) {
  if (!player || !frame.count) return;
  if (frameTables !== lagTables) { lags = new Float32Array(0); lagTables = frameTables; }
  if (frame.count > lags.length) {
    const size = Math.max(frame.count, lags.length * 2);
    const grownLags = new Float32Array(size); grownLags.set(lags); lags = grownLags;
    const grownBrakes = new Float32Array(size); grownBrakes.set(brakes); brakes = grownBrakes;
  }
  for (let i = 0; i < frame.count; i += 1) {
    const lag = lags[i];
    // 멀리 있는 차는 볼 필요가 없다. 늦춰 둔 차는 풀어 줘야 하므로 계속 본다.
    if (!lag && Math.abs(frame.x[i] - player.x) > YIELD_REACH && Math.abs(frame.z[i] - player.z) > YIELD_REACH) continue;
    const pose = poseInto(yieldBox, i, frame, i);
    const next = nextYieldLag(lag, pose, player, dt);
    brakes[i] = yieldBrake(pose, player);
    if (next !== lag) { lags[i] = next; lagsMoved = true; }
  }
}

/** 차에서 내리면 부른다. 남은 늦춤을 풀어 다음 탑승에서 차가 굳어 있지 않게 한다. */
export function clearTrafficYield() {
  lags = new Float32Array(0);
  brakes = new Float32Array(0);
  lagTables = null;
}

const yieldBox = {};

const frame = { count: 0, time: NaN, x: new Float64Array(0), z: new Float64Array(0), angle: new Float64Array(0),
  braking: new Float64Array(0), speed: new Float64Array(0), truck: new Uint8Array(0) };
let frameTables = null, frameReady = 0, lagsMoved = false;

export function trafficFrame(count, time, extent) {
  const tables = tablesFor(extent), t = finite(time), n = tables.bands.length ? Math.max(0, Math.ceil(finite(count))) : 0;
  if (tables !== frameTables || t !== frame.time || lagsMoved) { frameTables = tables; frame.time = t; frameReady = 0; lagsMoved = false; }
  if (n > frame.x.length) {
    const size = Math.max(n, frame.x.length * 2);
    for (const key of ['x', 'z', 'angle', 'braking', 'speed', 'truck']) frame[key] = grow(frame[key], size);
  }
  if (n > frameReady) {
    assignCars(tables, n);
    for (let i = frameReady; i < n; i += 1) { solve(tables, i, t - lagOf(i), frame, i); applyYield(frame, i, i); }
    frameReady = n;
  }
  frame.count = n;
  return frame;
}

/** 주인공 차 주변의 AI 차량만 추린다. 위치는 trafficFrame 이 한 번 계산한 것을 읽는다. */
export function trafficBoxes(count, time, extent, near, radius = 40) {
  const data = trafficFrame(count, time, extent), boxes = [];
  for (let i = 0; i < data.count; i++) {
    if (near && Math.abs(data.x[i] - near.x) > radius) continue;
    if (near && Math.abs(data.z[i] - near.z) > radius) continue;
    boxes.push(poseOf(i, data, i));
  }
  return boxes;
}

/** trafficBoxes 와 같은 값을 주되 차 객체와 배열을 다시 쓴다. 주행은 매 프레임 부르므로
 * 500개를 새로 만들면 그만큼 GC 가 돌아 프레임이 튄다. 돌려준 목록과 그 안의 객체는
 * 다음 호출이 덮어쓰므로 받은 자리에서 그 프레임 안에 읽는다. */
export function createTrafficPool() { return { list: [], store: [] }; }

export function fillTrafficNear(pool, count, time, extent, near, radius = 40, skip = null) {
  const data = trafficFrame(count, time, extent), list = pool.list, store = pool.store;
  list.length = 0;
  for (let i = 0; i < data.count; i++) {
    if (near && Math.abs(data.x[i] - near.x) > radius) continue;
    if (near && Math.abs(data.z[i] - near.z) > radius) continue;
    if (skip && skip.has(i)) continue;
    const slot = list.length;
    if (!store[slot]) store[slot] = {};
    list.push(poseInto(store[slot], i, data, i));
  }
  return list;
}

/** 이미 추린 목록에서 더 좁은 반경만 다시 고른다. 차 객체는 그대로 두고 목록만 다시 쓴다. */
export function narrowTraffic(pool, boxes, near, radius) {
  const list = pool.list;
  list.length = 0;
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    if (Math.abs(box.x - near.x) > radius || Math.abs(box.z - near.z) > radius) continue;
    list.push(box);
  }
  return list;
}

/** 시험과 디버깅용이다. 차가 탄 띠와 슬롯, 띠를 따라 잰 위치를 준다. */
export function trafficTrack(index, time, extent) {
  const tables = tablesFor(extent), id = carId(index);
  if (!tables.bands.length) return null;
  assignCars(tables, id + 1);
  const band = tables.bands[tables.band[id]], t = localTime(tables, id, finite(time)), k = locate(band, t);
  const u = t - band.T[k], ds = band.DS[k];
  const f = ds > 1e-9 ? Math.max(0, Math.min(1, (band.V[k] * u + 0.5 * band.ACC[k] * u * u) / ds)) : 0;
  return { band: band.key, route: band.route, lane: band.lane, lanes: band.lanes, outer: band.outer, slot: tables.slot[id],
    along: band.S[k] + ds * f, length: band.length, turning: band.TURN[k] === 1, v0: band.v0 };
}
