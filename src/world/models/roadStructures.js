/** 고가도로, 터널, 진입로, 육교, 도로 부속물의 순수 데이터 빌더다. Three, React,
 * 네트워크에 의존하지 않는다. 좌표계는 X/Z 평면에 위쪽 +Y, 기본 지면은 Y=0이다.
 * segment 는 shared/urbanPlan.js 모양({x1,z1,x2,z2,...})을 그대로 받는다. 배선은
 * cityModels.js 의 createBatches().add(material, position, scale, owner, shape,
 * rotation, color) 콜백을 그대로 넘기면 된다. owner 는 항상 null 이다.
 */

export const ROAD_STRUCTURE_DEFAULTS = Object.freeze({
  width: 22,
  deckHeight: 14,
  deckThickness: 1.2,
  pierSpacing: { low: 40, medium: 24, high: 16 },
  pierRadius: 1.6,
  pierBaseHeight: 1.4,
  guardHeight: 1.1,
  lampSpacing: { low: 0, medium: 48, high: 24 },
  tunnelWallHeight: 6,
  tunnelCoverHeight: 9,
  tunnelPortalDepth: 4,
  tunnelClearWidth: 1.15,
  tunnelLampSpacing: { low: 0, medium: 18, high: 10 },
  overpassClearance: 7,
  overpassAbutmentDepth: 6,
  // 램프 폴리라인을 그릴 때 쓰는 조각 수 상한이다. low 도 곡선을 따라갈 만큼은 남겨야
  // 메시가 노면 표본과 어긋나지 않는다.
  rampSteps: { low: 10, medium: 16, high: 24 },
  // 램프 교각을 세우는 최소 상판 높이다. 이보다 낮으면 땅에 붙어 보이지 않는다.
  rampPierMin: 3,
  // 램프 난간을 세우는 최소 상판 높이다. 노면에 붙어 달리는 구간은 난간 없이 둔다.
  rampRailMin: 1,
  // 진입로 상판이 끝난 뒤 본선에 합류하기 전 속도를 맞추는 가감속 차로 길이다.
  rampAccelLength: 60,
  furnitureSpacing: { low: 0, medium: 20, high: 10 },
  wallHeight: 4.2,
});

function normalizeQuality(quality) {
  return quality === 'low' || quality === 'high' ? quality : 'medium';
}

// 회전은 UrbanScenery.addSegment 와 같은 공식(atan2(dx,dz))을 쓴다. 박스의 길이축이 Z이기 때문이다.
function segmentGeometry(segment) {
  const dx = segment.x2 - segment.x1, dz = segment.z2 - segment.z1;
  const length = Math.hypot(dx, dz) || 1;
  const ux = dx / length, uz = dz / length;
  return {
    length, ux, uz, px: -uz, pz: ux,
    rotation: Math.atan2(dx, dz),
    cx: (segment.x1 + segment.x2) / 2, cz: (segment.z1 + segment.z2) / 2,
  };
}

function pointAt(segment, geo, t) {
  return { x: segment.x1 + geo.ux * geo.length * t, z: segment.z1 + geo.uz * geo.length * t };
}

/** 교각 한 짝이 설 자리를 고른다. 원래 자리가 지상 도로 위면 경간 절반까지 앞뒤로
 * 옮겨 보고, 그래도 비는 자리가 없으면 null 을 줘 그 경간을 건너뛴다.
 * 옮기는 폭을 경간 절반으로 묶어야 이웃 교각과 자리가 뒤집히지 않는다. */
const PIER_SHIFT_TRIES = 6;

function pierStation(segment, geo, base, stations, sides, offset, clearAt) {
  if (!clearAt) return base;
  const reach = 0.5 / stations;
  for (let step = 0; step <= PIER_SHIFT_TRIES; step += 1) {
    // 원래 자리부터 보고 점점 멀리, 앞뒤를 번갈아 본다.
    for (const way of step === 0 ? [0] : [-1, 1]) {
      const t = base + way * reach * (step / PIER_SHIFT_TRIES);
      if (t < 0 || t > 1) continue;
      const { x, z } = pointAt(segment, geo, t);
      const free = sides.every((side) => clearAt(x + geo.px * offset * side, z + geo.pz * offset * side));
      if (free) return t;
    }
  }
  return null;
}

/** 고가도로: 상판, 등간격 교각, 밑면 보, 양쪽 난간, quality 에 따른 조명. */
export function addElevatedRoad(add, segment, options = {}) {
  const quality = normalizeQuality(options.quality);
  const D = ROAD_STRUCTURE_DEFAULTS;
  const width = options.width ?? D.width;
  const deckThickness = options.deckThickness ?? D.deckThickness;
  const deckY = options.height ?? D.deckHeight;
  const color = options.color;
  const geo = segmentGeometry(segment);
  const beamY = deckY - deckThickness / 2 - 0.55;
  const railHalf = width / 2 - 0.4;

  add('road', [geo.cx, deckY, geo.cz], [width, deckThickness, geo.length], null, 'box', geo.rotation, color);
  add('marking', [geo.cx, deckY + deckThickness / 2 + 0.02, geo.cz], [0.34, 0.05, geo.length], null, 'box', geo.rotation);
  add('steel', [geo.cx, beamY, geo.cz], [width * 0.86, 1.1, geo.length], null, 'box', geo.rotation);
  for (const side of [-1, 1]) {
    const blocked=(options.railOpenings??segment.railOpenings??[]).filter(item=>item.side===side)
      .map(item=>[Math.max(0,item.from),Math.min(1,item.to)]).filter(([from,to])=>to>from).sort((a,b)=>a[0]-b[0]);
    const spans=[];let cursor=0;
    for(const [from,to] of blocked){if(from>cursor)spans.push([cursor,from]);cursor=Math.max(cursor,to);}
    if(cursor<1)spans.push([cursor,1]);
    for(const [from,to] of spans){
      const t=(from+to)/2,{x,z}=pointAt(segment,geo,t),spanLength=geo.length*(to-from);
      const rx = x + geo.px * railHalf * side, rz = z + geo.pz * railHalf * side;
      add('steel', [rx, deckY + deckThickness / 2 + D.guardHeight / 2, rz], [0.18, D.guardHeight, spanLength], null, 'box', geo.rotation);
    }
  }

  const spacing = options.pierSpacing ?? D.pierSpacing[quality];
  const stations = Math.max(1, Math.round(geo.length / spacing));
  const pierHeight = Math.max(1.5, deckY - deckThickness / 2);
  const twinPiers = quality !== 'low';
  const pierOffset = width * 0.32;
  const lampSpacing = D.lampSpacing[quality];
  const lampEvery = lampSpacing ? Math.max(1, Math.round(lampSpacing / spacing)) : 0;
  // 교각이 설 수 있는 자리를 호출자가 정한다. 주지 않으면 예전처럼 등간격으로 세운다.
  const clearAt = typeof options.pierClear === 'function' ? options.pierClear : null;

  for (let i = 0; i < stations; i += 1) {
    const sides = twinPiers ? [-1, 1] : [0];
    const t = pierStation(segment, geo, (i + 0.5) / stations, stations, sides, pierOffset, clearAt);
    // 교차로 밑은 한 경간을 통으로 건너뛴다. 상판은 이어져 있으므로 보이는 데 문제가 없다.
    if (t === null) continue;
    const { x: sx, z: sz } = pointAt(segment, geo, t);
    for (const side of sides) {
      const px = sx + geo.px * pierOffset * side, pz = sz + geo.pz * pierOffset * side;
      add('stone', [px, pierHeight / 2, pz], [D.pierRadius, pierHeight, D.pierRadius], null, 'cylinder');
      add('dark', [px, D.pierBaseHeight / 2, pz], [D.pierRadius * 1.4, D.pierBaseHeight, D.pierRadius * 1.4], null, 'cylinder');
      // 교각은 차가 부딪히면 멈추는 구조물이다. 자리를 여기서만 정하므로 여기서 알린다.
      options.onPier?.({ x: px, z: pz, width: D.pierRadius * 1.4, depth: D.pierRadius * 1.4, height: pierHeight });
    }
    if (lampEvery && i % lampEvery === 0) {
      for (const side of [-1, 1]) {
        const lx = sx + geo.px * railHalf * side, lz = sz + geo.pz * railHalf * side;
        add('dark', [lx, deckY + deckThickness / 2 + 2.6, lz], [0.16, 5.2, 0.16], null, 'box', geo.rotation);
        add('lamp', [lx, deckY + deckThickness / 2 + 5.3, lz], [0.7, 0.32, 0.7], null, 'octagon');
      }
    }
  }
}

/** 터널: 진입 포탈 두 개, 복개(언덕형 mound), 안쪽 벽, 등간격 터널등. 내부는 막지 않는다. */
export function addTunnel(add, segment, options = {}) {
  const quality = normalizeQuality(options.quality);
  const D = ROAD_STRUCTURE_DEFAULTS;
  const width = options.width ?? D.width;
  const wallHeight = options.wallHeight ?? D.tunnelWallHeight;
  const coverHeight = options.coverHeight ?? D.tunnelCoverHeight;
  const portalDepth = options.portalDepth ?? D.tunnelPortalDepth;
  const color = options.color;
  const clearWidth = width * D.tunnelClearWidth;
  const geo = segmentGeometry(segment);
  const ceilingY = wallHeight + 0.6;

  for (const side of [-1, 1]) {
    const wx = geo.cx + geo.px * (clearWidth / 2) * side, wz = geo.cz + geo.pz * (clearWidth / 2) * side;
    add('stone', [wx, wallHeight / 2, wz], [0.6, wallHeight, geo.length], null, 'box', geo.rotation, color);
  }
  add('dark', [geo.cx, ceilingY, geo.cz], [clearWidth * 1.05, 1.2, geo.length], null, 'box', geo.rotation);

  // 복개 위 언덕은 sphere 를 눌러 펴 mound 몇 덩이로 대체한다. 인스턴스 하나가 구간 하나를 덮는다.
  const moundCount = quality === 'low' ? 2 : quality === 'high' ? 4 : 3;
  const chunk = geo.length / moundCount;
  for (let i = 0; i < moundCount; i += 1) {
    const { x: mx, z: mz } = pointAt(segment, geo, (i + 0.5) / moundCount);
    add('ground', [mx, ceilingY + coverHeight * 0.32, mz], [clearWidth * 1.5, coverHeight, chunk * 1.15], null, 'hill', geo.rotation);
  }

  for (const end of [0, 1]) {
    const ex = end ? segment.x2 : segment.x1, ez = end ? segment.z2 : segment.z1;
    const inward = end ? -1 : 1;
    const fx = ex + geo.ux * portalDepth * 0.5 * inward, fz = ez + geo.uz * portalDepth * 0.5 * inward;
    add('stone', [fx, ceilingY, fz], [clearWidth * 1.2, 1.4, portalDepth], null, 'box', geo.rotation, color);
    for (const side of [-1, 1]) {
      const jx = fx + geo.px * (clearWidth / 2) * side, jz = fz + geo.pz * (clearWidth / 2) * side;
      add('stone', [jx, wallHeight / 2, jz], [1.1, wallHeight, portalDepth], null, 'box', geo.rotation, color);
    }
  }

  const lampSpacing = D.tunnelLampSpacing[quality];
  if (lampSpacing) {
    const count = Math.max(0, Math.floor(geo.length / lampSpacing));
    for (let i = 0; i < count; i += 1) {
      const { x: lx, z: lz } = pointAt(segment, geo, (i + 0.5) / count);
      for (const side of [-1, 1]) {
        const px = lx + geo.px * (clearWidth / 2 - 0.3) * side, pz = lz + geo.pz * (clearWidth / 2 - 0.3) * side;
        if (quality === 'high') add('dark', [px, wallHeight - 0.4, pz], [0.5, 0.18, 0.5], null, 'box', geo.rotation);
        add('lamp', [px, wallHeight - 0.15, pz], [0.5, 0.14, 0.5], null, 'box', geo.rotation);
      }
    }
  }
}

/** 폴리라인을 품질에 맞게 솎는다. 양 끝 점과 폭이 바뀌는 점(합류 테이퍼)은 반드시
 * 남긴다. 테이퍼를 솎으면 낮은 품질에서 상판 가장자리와의 사이가 벌어진다. */
function decimate(points, limit) {
  const spans = points.length - 1;
  if (spans <= limit) return points;
  const stride = Math.ceil(spans / limit), out = [];
  for (let i = 0; i < points.length; i += 1) {
    const last = i === points.length - 1;
    const shaped = (i > 0 && points[i][3] !== points[i - 1][3]) || (!last && points[i][3] !== points[i + 1][3]);
    if (i % stride === 0 || shaped || last) out.push(points[i]);
  }
  return out;
}

/** 폴리라인 램프다. 점은 [x, z, y, width] 이고 조각마다 상판 한 장을 눕힌다.
 * 꺾이는 자리에서는 조각을 바깥쪽 결각만큼 겹쳐 늘려 V 자 틈을 메운다. 마지막
 * 조각은 폭이 tip 까지 좁아져 본선에 스며들므로 잘린 단면이 남지 않는다. */
function addRampRibbon(add, points, options) {
  const quality = normalizeQuality(options.quality);
  const D = ROAD_STRUCTURE_DEFAULTS;
  const color = options.color;
  const thickness = options.deckThickness ?? D.deckThickness;
  const line = decimate(points, D.rampSteps[quality]);
  const spans = line.map((point, index) => {
    if (!index) return null;
    const a = line[index - 1], b = point;
    const dx = b[0] - a[0], dz = b[1] - a[1], dy = b[2] - a[2];
    const run = Math.hypot(dx, dz) || 1e-6;
    return {
      a, b, run, ux: dx / run, uz: dz / run,
      rotation: Math.atan2(dx, dz), pitch: -Math.atan2(dy, run),
      slope: Math.hypot(run, dy), width: (a[3] + b[3]) / 2,
    };
  }).slice(1);
  if (!spans.length) return;

  const bend = (left, right) => {
    if (!left || !right) return 0;
    let diff = (right.rotation - left.rotation) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff);
  };
  // 이음매 겹침이다. 바깥쪽 결각 깊이는 반폭 * tan(꺾임/2) 이라 그만큼 늘려 덮는다.
  const overlapAt = (left, right) => {
    const angle = bend(left, right);
    if (angle < 1e-4) return 0;
    const half = Math.max(left ? left.width : 0, right ? right.width : 0) / 2;
    return Math.min(half * Math.tan(Math.min(angle, 1.2) / 2), 6);
  };

  // 난간은 조각 몇 개에 한 줄이다. 한 줄이 곧은 상자라 꺾임이 큰 low 에서 더 자주 끊는다.
  const railStride = quality === 'low' ? 3 : quality === 'medium' ? 3 : 2;
  const openMerge = options.openMerge !== false;
  for (let i = 0; i < spans.length; i += 1) {
    const span = spans[i];
    const back = overlapAt(spans[i - 1], span), front = overlapAt(span, spans[i + 1]);
    const length = span.slope + back + front, shift = (front - back) / 2;
    const cx = (span.a[0] + span.b[0]) / 2 + span.ux * shift;
    const cz = (span.a[1] + span.b[1]) / 2 + span.uz * shift;
    const cy = (span.a[2] + span.b[2]) / 2;
    const rotation = [span.pitch, span.rotation, 0];
    add('road', [cx, cy, cz], [span.width, thickness, length], null, 'box', rotation, color);
    // 난간은 몇 조각에 한 줄이다. 폭이 좁아지는 테이퍼와 본선 쪽은 비워 차가 합류한다.
    // 노면 높이로 달리는 밑동 구간에도 세우지 않는다. 지상 도로 노면을 가로지른다.
    if (i % railStride || span.width < D.width * 0.4 || span.a[2] < D.rampRailMin) continue;
    const rail = spans.slice(i, i + railStride);
    const last = rail[rail.length - 1];
    const railLength = rail.reduce((sum, item) => sum + item.slope, 0);
    const rx = (span.a[0] + last.b[0]) / 2, rz = (span.a[1] + last.b[1]) / 2;
    const ry = (span.a[2] + last.b[2]) / 2 + thickness / 2 + D.guardHeight / 2;
    const px = -span.uz, pz = span.ux;
    const inward = options.inward;
    for (const side of [-1, 1]) {
      // 마지막 조각에서 본선 쪽 난간을 비운다. inward 는 상판을 가리키는 단위 벡터다.
      if (openMerge && inward && i + railStride >= spans.length && (px * inward[0] + pz * inward[1]) * side > 0) continue;
      add('steel', [rx + px * (span.width / 2 - 0.3) * side, ry, rz + pz * (span.width / 2 - 0.3) * side],
        [0.14, D.guardHeight, railLength], null, 'box', [span.pitch, span.rotation, 0]);
    }
  }

  // 교각이다. 상판이 지면에서 충분히 뜬 자리에만 세운다. 지상 도로 위는 건너뛴다.
  if (quality === 'low') return;
  const clearAt = typeof options.pierClear === 'function' ? options.pierClear : null;
  const spacing = options.pierSpacing ?? D.pierSpacing[quality] * 1.6;
  let since = spacing;
  for (const span of spans) {
    since += span.run;
    if (since < spacing) continue;
    const y = span.b[2], height = y - thickness / 2;
    if (height < D.rampPierMin) continue;
    if (clearAt && !clearAt(span.b[0], span.b[1])) continue;
    since = 0;
    add('stone', [span.b[0], height / 2, span.b[1]], [D.pierRadius, height, D.pierRadius], null, 'cylinder');
    add('dark', [span.b[0], D.pierBaseHeight / 2, span.b[1]], [D.pierRadius * 1.4, D.pierBaseHeight, D.pierRadius * 1.4], null, 'cylinder');
    // 충돌 상자 모양은 addElevatedRoad 의 교각과 같은 키를 쓴다. solidIndex 가 같은 판정을 한다.
    options.onPier?.({ x: span.b[0], z: span.b[1], width: D.pierRadius * 1.4, depth: D.pierRadius * 1.4, height });
  }
}

/** 진입로다. options.points 가 있으면 그 폴리라인을 리본으로 잇고, 없으면 예전처럼
 * from 과 to 를 한 장의 기울어진 상판으로 잇는다(고속도로 포탈 경사로). */
export function addRamp(add, from, to, options = {}) {
  if (Array.isArray(options.points) && options.points.length >= 2) {
    addRampRibbon(add, options.points, options);
    return;
  }
  const quality = normalizeQuality(options.quality);
  const D = ROAD_STRUCTURE_DEFAULTS;
  const width = options.width ?? D.width * 0.7;
  const color = options.color;
  const dx = to.x - from.x, dz = to.z - from.z;
  const length = Math.hypot(dx, dz) || 1;
  const ux = dx / length, uz = dz / length, px = -uz, pz = ux;
  const rotation = Math.atan2(dx, dz);
  const thickness = D.deckThickness, rise = to.y - from.y;
  const slopeLength = Math.hypot(length, rise), pitch = -Math.atan2(rise, length);
  const cx = (from.x + to.x) / 2, cz = (from.z + to.z) / 2, y = (from.y + to.y) / 2;
  const slopeRotation = [pitch, rotation, 0];
  add('road', [cx, y, cz], [width, thickness, slopeLength], null, 'box', slopeRotation, color);
  for (const side of [-1, 1]) {
    const rx = cx + px * (width / 2 - 0.3) * side, rz = cz + pz * (width / 2 - 0.3) * side;
    add('steel', [rx, y + thickness / 2 + D.guardHeight / 2, rz], [0.14, D.guardHeight, slopeLength], null, 'box', slopeRotation);
  }
  if (quality !== 'low') {
    const midY = from.y + (to.y - from.y) * 0.5;
    const mx = from.x + ux * length * 0.5, mz = from.z + uz * length * 0.5;
    add('stone', [mx, midY / 2, mz], [D.pierRadius, Math.max(1.5, midY), D.pierRadius], null, 'cylinder');
  }

  // 가감속 차로: 상판 높이(to.y)에서 진입 방향으로 더 이어지는 짧은 구간이다.
  // IC 다이아몬드 램프가 상판에 바로 합류하지 않고 속도를 맞출 여유를 준다.
  // 램프는 간선에서 상판 옆까지 비스듬히 오르므로 가감속 차로는 램프 방향이 아니라
  // 본선과 나란해야 한다. mergeTo 가 있으면 그 점까지, 없으면 램프 방향으로 잇는다.
  if (options.accelLane) {
    const end = options.mergeTo ?? { x: to.x + ux * (options.accelLength ?? D.rampAccelLength), z: to.z + uz * (options.accelLength ?? D.rampAccelLength) };
    const mdx = end.x - to.x, mdz = end.z - to.z, accelLength = Math.hypot(mdx, mdz) || 1;
    const mux = mdx / accelLength, muz = mdz / accelLength, mrot = Math.atan2(mdx, mdz);
    const ax = to.x + mux * accelLength / 2, az = to.z + muz * accelLength / 2;
    add('road', [ax, to.y, az], [width, thickness, accelLength], null, 'box', mrot, color);
    // 합류 테이퍼는 차가 본선으로 횡이동하는 구간이므로 양쪽 난간을 열어 둔다.
  }
}

/** 육교식 교차로: 상판과 양쪽 교대, 아래를 지나는 통로 여유 높이는 위치로만 확보한다. */
export function addOverpass(add, segment, options = {}) {
  const quality = normalizeQuality(options.quality);
  const D = ROAD_STRUCTURE_DEFAULTS;
  const width = options.width ?? D.width;
  const thickness = options.deckThickness ?? D.deckThickness;
  const clearance = options.clearance ?? D.overpassClearance;
  const abutmentDepth = D.overpassAbutmentDepth;
  const color = options.color;
  const geo = segmentGeometry(segment);
  const deckY = clearance + thickness / 2;

  add('road', [geo.cx, deckY, geo.cz], [width, thickness, geo.length], null, 'box', geo.rotation, color);
  add('marking', [geo.cx, deckY + thickness / 2 + 0.02, geo.cz], [0.34, 0.05, geo.length], null, 'box', geo.rotation);
  for (const side of [-1, 1]) {
    const rx = geo.cx + geo.px * (width / 2 - 0.4) * side, rz = geo.cz + geo.pz * (width / 2 - 0.4) * side;
    add('steel', [rx, deckY + thickness / 2 + D.guardHeight / 2, rz], [0.18, D.guardHeight, geo.length], null, 'box', geo.rotation);
  }
  for (const end of [0, 1]) {
    const ex = end ? segment.x2 : segment.x1, ez = end ? segment.z2 : segment.z1;
    const inward = end ? -1 : 1;
    const ax = ex + geo.ux * abutmentDepth * 0.5 * inward, az = ez + geo.uz * abutmentDepth * 0.5 * inward;
    add('stone', [ax, deckY / 2, az], [width * 0.94, deckY, abutmentDepth], null, 'box', geo.rotation, color);
    add('dark', [ax, deckY - 0.3, az], [width, 0.6, abutmentDepth], null, 'box', geo.rotation);
  }
  if (quality !== 'low' && geo.length > D.pierSpacing[quality]) {
    add('stone', [geo.cx, (deckY - thickness / 2) / 2, geo.cz], [D.pierRadius, deckY - thickness / 2, D.pierRadius], null, 'cylinder');
  }
}

/** 가드레일, 방음벽, 중앙분리대, 표지, 조명 같은 도로 부속물이다. 대로와 지선 둘 다 쓴다. */
export function addRoadFurniture(add, segment, options = {}) {
  const quality = normalizeQuality(options.quality);
  const D = ROAD_STRUCTURE_DEFAULTS;
  const width = options.width ?? D.width;
  const geo = segmentGeometry(segment);

  if (options.median) {
    add('marking', [geo.cx, 0.3, geo.cz], [1.1, 0.5, geo.length], null, 'box', geo.rotation);
    if (quality !== 'low') add('green', [geo.cx, 0.55, geo.cz], [0.8, 0.5, geo.length * 0.94], null, 'box', geo.rotation);
  }
  if (options.soundWall) {
    for (const side of [-1, 1]) {
      const wx = geo.cx + geo.px * (width / 2 + 1.2) * side, wz = geo.cz + geo.pz * (width / 2 + 1.2) * side;
      add('violet', [wx, D.wallHeight / 2, wz], [0.4, D.wallHeight, geo.length], null, 'box', geo.rotation);
    }
  }

  const spacing = D.furnitureSpacing[quality];
  if (!spacing) return;
  const count = Math.max(0, Math.floor(geo.length / spacing));
  for (let i = 0; i < count; i += 1) {
    const { x, z } = pointAt(segment, geo, (i + 0.5) / count);
    const side = i % 2 === 0 ? -1 : 1;
    const px = x + geo.px * (width / 2 + 0.3) * side, pz = z + geo.pz * (width / 2 + 0.3) * side;
    add('dark', [px, 0.9, pz], [0.14, 1.8, 0.14], null, 'box', geo.rotation);
    add('steel', [px, 1.85, pz], [0.9, 0.08, 0.9], null, 'box', geo.rotation);
    if (quality === 'high' && i % 3 === 0) {
      add('dark', [px, 3.4, pz], [0.1, 3, 0.1]);
      add('lamp', [px, 6.3, pz], [0.7, 0.3, 0.7], null, 'octagon');
    }
  }
}

/** 도로 종류별 차선 수와 도색표다. center 는 중앙선 줄 수, dividers 는 한쪽 차선
 * 구분선 수, edge 는 양 끝 가장자리선이다. 우측통행이라 중앙선은 항상 도로 중심이다. */
export const LANE_PLAN = Object.freeze({
  highway: { lanes: 4, center: 2, dividers: 1, edge: true, dashedCenter: false },
  arterial: { lanes: 4, center: 1, dividers: 1, edge: false, dashedCenter: false },
  collector: { lanes: 2, center: 1, dividers: 0, edge: false, dashedCenter: false },
  // 이면도로다. 큰길과 달리 중앙선이 없어야 골목과 함께 한눈에 작은 길로 읽힌다.
  lane: { lanes: 2, center: 0, dividers: 0, edge: false, dashedCenter: false },
  alley: { lanes: 1, center: 0, dividers: 0, edge: false, dashedCenter: false },
});

export const MARKING = Object.freeze({
  y: 0.35, thickness: 0.04, lineWidth: 0.34, centerGap: 1.1, edgeInset: 0.7,
  // 점선 한 조각의 길이와 주기다. low 는 점선을 실선 하나로 대체한다.
  dash: { low: null, medium: { length: 4, period: 10 }, high: { length: 4, period: 8 } },
  crosswalk: { bars: 5, barWidth: 1.2, barLength: 5, clearance: 5 },
});

/** 교차로를 비울 여백이다. 경로 내부의 완만한 이음매(joinIn/joinOut 이 작은 곳)는
 * 비우지 않아 곡선 간선의 도색이 끊기지 않는다. */
function markingClear(join, width) {
  if (join === null || join === undefined) return width / 2 + 1;
  return join > 0.35 ? width / 2 + 1 : 0;
}

function linePieces(segment, geo, options) {
  const { offset, from, to, material, dash, lineWidth } = options;
  const span = to - from;
  if (span <= 1) return [];
  const center = (from + to) / 2;
  const place = (along, length) => {
    const x = segment.x1 + geo.ux * along + geo.px * offset;
    const z = segment.z1 + geo.uz * along + geo.pz * offset;
    return { material, position: [x, MARKING.y, z], scale: [lineWidth, MARKING.thickness, length],
      rotation: geo.rotation, color: undefined };
  };
  if (!dash) return [place(center, span)];
  const count = Math.floor(span / dash.period);
  if (count < 1) return [place(center, span)];
  const begin = center - (count * dash.period) / 2;
  return Array.from({ length: count }, (_, i) => place(begin + dash.period * (i + 0.5), dash.length));
}

/** 도로 선분 하나의 차선 도색 조각이다. 순수 함수라 테스트가 조각 수를 바로 센다.
 * 중앙선은 centerline(노랑) 실선, 차선 구분선과 가장자리선은 marking(흰) 점선이다. */
export function roadMarkings(segment, options = {}) {
  const quality = normalizeQuality(options.quality);
  const plan = LANE_PLAN[segment.kind];
  if (!plan || !plan.center) return [];
  const width = options.width ?? ROAD_STRUCTURE_DEFAULTS.width;
  const geo = segmentGeometry(segment);
  const from = markingClear(segment.joinIn, width);
  const to = geo.length - markingClear(segment.joinOut, width);
  if (to - from <= 1) return [];
  const dash = MARKING.dash[quality];
  const line = (offset, material, dashed) => linePieces(segment, geo, {
    offset, from, to, material, lineWidth: MARKING.lineWidth, dash: dashed ? dash : null });

  const parts = [];
  const centers = plan.center === 1 ? [0] : [-MARKING.centerGap / 2, MARKING.centerGap / 2];
  for (const offset of centers) parts.push(...line(offset, 'centerline', plan.dashedCenter));
  if (quality === 'low') return parts;
  for (let i = 0; i < plan.dividers; i += 1) {
    const step = (width / 2) * ((i + 1) / (plan.dividers + 1));
    for (const side of [-1, 1]) parts.push(...line(step * side, 'marking', true));
  }
  if (plan.edge) for (const side of [-1, 1]) parts.push(...line((width / 2 - MARKING.edgeInset) * side, 'marking', false));
  return parts;
}

/** 횡단보도다. 진행 방향과 나란한 흰 막대를 도로 폭에 걸쳐 늘어놓는다. angle 은
 * addSegment 와 같은 atan2(dx, dz) 회전이고 offset 은 교차로 중심에서의 거리다. */
export function crosswalkMarkings(point, options = {}) {
  const width = options.width ?? ROAD_STRUCTURE_DEFAULTS.width;
  const rotation = options.rotation ?? 0;
  const C = MARKING.crosswalk;
  const ux = Math.sin(rotation), uz = Math.cos(rotation), px = -uz, pz = ux;
  const offset = options.offset ?? 0;
  const cx = point.x + ux * offset, cz = point.z + uz * offset;
  const step = (width - C.barWidth) / (C.bars - 1);
  return Array.from({ length: C.bars }, (_, i) => {
    const across = -(width - C.barWidth) / 2 + step * i;
    return { material: 'marking', position: [cx + px * across, MARKING.y, cz + pz * across],
      scale: [C.barWidth, MARKING.thickness, C.barLength], rotation, color: undefined };
  });
}
