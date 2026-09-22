/** 고가도로, 터널, 진입로, 육교, 도로 부속물의 순수 데이터 빌더다. Three, React,
 * 네트워크에 의존하지 않는다. 좌표계는 X/Z 평면에 위쪽 +Y, 기본 지면은 Y=0이다.
 * segment 는 shared/urbanPlan.js 모양({x1,z1,x2,z2,...})을 그대로 받는다. 배선은
 * cityModels.js 의 createBatches().add(material, position, scale, owner, shape,
 * rotation, color) 콜백을 그대로 넘기면 된다. owner 는 항상 null 이다. 폴리라인
 * 램프 상판은 인스턴스 파트가 아니므로 options.addRoadTriangle 콜백도 반드시 넘긴다.
 */
import { roadClearance } from '../../../shared/roadClearance.js';
import { roadRibbon } from '../../../shared/roadRibbon.js';

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

// 교각 콜백의 축 정렬 충돌 상자는 기본 margin 3 이 더해진다. 사각형 전체를
// 감싸는 반경으로 비워야 사선 도로의 바깥 차선도 교각에 막히지 않는다.
const pierClearanceRadius = () => Math.SQRT2 * (ROAD_STRUCTURE_DEFAULTS.pierRadius * 0.7 + 3);

function clearanceOf(options) {
  return options.clearance && typeof options.clearance.clearSpans === 'function'
    ? options.clearance : (options.plan ? roadClearance(options.plan) : null);
}

function intersectSpans(left, right) {
  const out = [];
  for (const [a0, a1] of left) for (const [b0, b1] of right) {
    const from = Math.max(a0, b0), to = Math.min(a1, b1);
    if (to - from > 1e-6) out.push([from, to]);
  }
  return out;
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
  const clearance = clearanceOf(options);
  const levelSegment = { ...segment, y: deckY, deckY, sourceRoad: options.sourceRoad };
  const capStart = Math.max(0, segment.capStart || 0), capEnd = Math.max(0, segment.capEnd || 0);
  const deckLength = geo.length + capStart + capEnd, shift = (capEnd - capStart) / 2;
  const deckX = geo.cx + geo.ux * shift, deckZ = geo.cz + geo.uz * shift;
  add('road', [deckX, deckY, deckZ], [width, deckThickness, deckLength], null, 'box', geo.rotation, color);
  for (const mark of roadMarkings(levelSegment, { width, quality, clearance,
    y: deckY + deckThickness / 2 + 0.02 })) {
    add(mark.material, mark.position, mark.scale, null, 'box', mark.rotation, mark.color);
  }
  add('steel', [deckX, beamY, deckZ], [width * 0.86, 1.1, deckLength], null, 'box', geo.rotation);
  for (const side of [-1, 1]) {
    const blocked=(options.railOpenings??segment.railOpenings??[]).filter(item=>item.side===side)
      .map(item=>[Math.max(0,item.from),Math.min(1,item.to)]).filter(([from,to])=>to>from).sort((a,b)=>a[0]-b[0]);
    const spans=[];let cursor=0;
    for(const [from,to] of blocked){if(from>cursor)spans.push([cursor,from]);cursor=Math.max(cursor,to);}
    if(cursor<1)spans.push([cursor,1]);
    const clear = clearance ? clearance.clearSpans(levelSegment, railHalf * side, 0.09) : [[0, 1]];
    for(const [from,to] of intersectSpans(spans, clear)){
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
  const clearAt = typeof options.pierClear === 'function' ? options.pierClear
    : clearance ? (x, z) => clearance.pointClear(x, z, pierClearanceRadius(), 0) : null;

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
      options.onPier?.({ x: px, z: pz, width: D.pierRadius * 1.4, depth: D.pierRadius * 1.4,
        height: pierHeight, roofMargin: 0 });
    }
    if (lampEvery && i % lampEvery === 0) {
      for (const side of [-1, 1]) {
        const lx = sx + geo.px * railHalf * side, lz = sz + geo.pz * railHalf * side;
        if (clearance && !clearance.columnClear(lx, lz, 0.1,
          deckY + deckThickness / 2, deckY + deckThickness / 2 + 5.5, levelSegment)) continue;
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

/** 폴리라인 램프다. 점은 [x, z, y, width, optionalLeftTransverse] 이다.
 * 공통 리본의 마이터 횡단면과 테이퍼 삼각형을 그대로 그리고 난간도 같은 모서리를 따른다. */
function addRampRibbon(add, points, options) {
  const quality = normalizeQuality(options.quality);
  const D = ROAD_STRUCTURE_DEFAULTS;
  const color = options.color;
  const thickness = options.deckThickness ?? D.deckThickness;
  // 노면과 물리가 같은 canonical points 를 쓴다. 품질별 솎기는 장식에만 허용한다.
  const width = options.width ?? D.width * 0.7;
  const deck = roadRibbon(points, { width, offsetY: thickness / 2 });
  const underside = roadRibbon(points, { width, offsetY: -thickness / 2 });
  const railRibbon = roadRibbon(points, { width, inset: 0.3 });
  const clearance = clearanceOf(options);
  if (!deck.spans.length) return;

  const emit = options.addRoadTriangle;
  if (typeof emit === 'function') {
    for (const triangle of deck.triangles) emit(triangle, { face: 'top', color });
    for (const triangle of underside.triangles) emit([triangle[0], triangle[2], triangle[1]],
      { face: 'bottom', color });
    const wall = (a, b, c, d) => {
      const group = {};
      emit([a, b, c], { face: 'wall', group, color });
      emit([c, b, d], { face: 'wall', group, color });
    };
    for (let i = 0; i < deck.spans.length; i += 1) {
      const top = deck.spans[i], bottom = underside.spans[i];
      wall(top.leftA, bottom.leftA, top.leftB, bottom.leftB);
      wall(top.rightA, top.rightB, bottom.rightA, bottom.rightB);
    }
    const topStart = deck.sections[0], bottomStart = underside.sections[0];
    wall(topStart.left, topStart.right, bottomStart.left, bottomStart.right);
    const topEnd = deck.sections.at(-1), bottomEnd = underside.sections.at(-1);
    wall(topEnd.left, bottomEnd.left, topEnd.right, bottomEnd.right);
  }
  const openMerge = options.openMerge !== false;
  const sourcePoint = (center) => points.find((point) =>
    Math.abs(point[0] - center[0]) < 1e-7 && Math.abs(point[1] - center[2]) < 1e-7
    && Math.abs(point[2] - center[1]) < 1e-7);
  for (let i = 0; i < railRibbon.spans.length; i += 1) {
    const span = railRibbon.spans[i];
    const dx = span.b[0] - span.a[0], dz = span.b[2] - span.a[2];
    const run = Math.hypot(dx, dz) || 1e-6, px = -dz / run, pz = dx / run;
    const pointA = sourcePoint(span.a), pointB = sourcePoint(span.b);
    const widthA = Number.isFinite(pointA?.[3]) ? pointA[3] : width;
    const widthB = Number.isFinite(pointB?.[3]) ? pointB[3] : width;
    // 난간은 inset 리본의 실제 3D 모서리를 모든 조각에서 잇는다. 낮은 밑동에는 세우지 않는다.
    if ((widthA + widthB) / 2 < D.width * 0.4 || span.a[1] < D.rampRailMin) continue;
    const flatMerge = Math.abs(span.b[1] - span.a[1]) < 1e-7
      && (widthB < widthA - 1e-7 || Array.isArray(pointA?.[4]) || Array.isArray(pointB?.[4]));
    const edges = [
      { side: -1, a: span.rightA, b: span.rightB },
      { side: 1, a: span.leftA, b: span.leftB },
    ];
    for (const edge of edges) {
      // 평평한 합류 테이퍼는 안쪽 전체를 열고 바깥 난간만 남긴다.
      const inward = options.inward && (px * options.inward[0] + pz * options.inward[1]) * edge.side > 0;
      if (openMerge && inward && (flatMerge || i === railRibbon.spans.length - 1)) continue;
      const railSource = { x1: edge.a[0], y1: edge.a[1], z1: edge.a[2],
        x2: edge.b[0], y2: edge.b[1], z2: edge.b[2], sourceRoad: options.sourceRoad };
      const clear = clearance ? clearance.clearSpans(railSource, 0, 0.07) : [[0, 1]];
      for (const [from, to] of clear) {
        const ax = edge.a[0] + (edge.b[0] - edge.a[0]) * from;
        const ay = edge.a[1] + (edge.b[1] - edge.a[1]) * from;
        const az = edge.a[2] + (edge.b[2] - edge.a[2]) * from;
        const bx = edge.a[0] + (edge.b[0] - edge.a[0]) * to;
        const by = edge.a[1] + (edge.b[1] - edge.a[1]) * to;
        const bz = edge.a[2] + (edge.b[2] - edge.a[2]) * to;
        const railDx = bx - ax, railDy = by - ay, railDz = bz - az;
        const railRun = Math.hypot(railDx, railDz), length = Math.hypot(railRun, railDy);
        if (length <= 1e-6) continue;
        add('steel', [(ax + bx) / 2, (ay + by) / 2 + thickness / 2 + D.guardHeight / 2, (az + bz) / 2],
          [0.14, D.guardHeight, length], null, 'box',
          [-Math.atan2(railDy, railRun), Math.atan2(railDx, railDz), 0]);
      }
    }
  }

  // 교각이다. 상판이 지면에서 충분히 뜬 자리에만 세운다. 지상 도로 위는 건너뛴다.
  if (quality === 'low') return;
  const clearAt = typeof options.pierClear === 'function' ? options.pierClear
    : clearance ? (x, z) => clearance.pointClear(x, z, pierClearanceRadius(), 0) : null;
  const spacing = options.pierSpacing ?? D.pierSpacing[quality] * 1.6;
  let since = spacing;
  for (const span of railRibbon.spans) {
    since += Math.hypot(span.b[0] - span.a[0], span.b[2] - span.a[2]);
    if (since < spacing) continue;
    const y = span.b[1], height = y - thickness / 2;
    if (height < D.rampPierMin) continue;
    if (clearAt && !clearAt(span.b[0], span.b[2])) continue;
    since = 0;
    add('stone', [span.b[0], height / 2, span.b[2]], [D.pierRadius, height, D.pierRadius], null, 'cylinder');
    add('dark', [span.b[0], D.pierBaseHeight / 2, span.b[2]], [D.pierRadius * 1.4, D.pierBaseHeight, D.pierRadius * 1.4], null, 'cylinder');
    // 충돌 상자 모양은 addElevatedRoad 의 교각과 같은 키를 쓴다. solidIndex 가 같은 판정을 한다.
    options.onPier?.({ x: span.b[0], z: span.b[2], width: D.pierRadius * 1.4, depth: D.pierRadius * 1.4,
      height, roofMargin: 0 });
  }
}

/** 진입로다. options.points 가 있으면 그 폴리라인을 리본으로 잇고, 상판 삼각형은
 * options.addRoadTriangle 에 보낸다. 없으면 예전처럼 from 과 to 를 한 장의 기울어진
 * 상판으로 잇는다(고속도로 포탈 경사로). */
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
  const clearance = clearanceOf(options);
  add('road', [cx, y, cz], [width, thickness, slopeLength], null, 'box', slopeRotation, color);
  for (const side of [-1, 1]) {
    const offset = (width / 2 - 0.3) * side;
    const source = { x1: from.x, z1: from.z, y1: from.y, x2: to.x, z2: to.z, y2: to.y,
      sourceRoad: options.sourceRoad };
    const clear = clearance ? clearance.clearSpans(source, offset, 0.07) : [[0, 1]];
    for (const [begin, end] of clear) {
      const t = (begin + end) / 2;
      const rx = from.x + dx * t + px * offset, rz = from.z + dz * t + pz * offset;
      const ry = from.y + rise * t + thickness / 2 + D.guardHeight / 2;
      add('steel', [rx, ry, rz], [0.14, D.guardHeight, slopeLength * (end - begin)], null, 'box', slopeRotation);
    }
  }
  const midY = from.y + (to.y - from.y) * 0.5;
  const mx = from.x + ux * length * 0.5, mz = from.z + uz * length * 0.5;
  if (quality !== 'low' && (!clearance || clearance.pointClear(mx, mz, pierClearanceRadius(), 0))) {
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
  const clearance = Number.isFinite(options.clearance)
    ? options.clearance : (options.overpassClearance ?? D.overpassClearance);
  const abutmentDepth = D.overpassAbutmentDepth;
  const color = options.color;
  const geo = segmentGeometry(segment);
  const deckY = clearance + thickness / 2;
  const roadSpace = clearanceOf(options);
  const levelSegment = { ...segment, y: deckY, deckY, sourceRoad: options.sourceRoad };

  add('road', [geo.cx, deckY, geo.cz], [width, thickness, geo.length], null, 'box', geo.rotation, color);
  for (const mark of roadMarkings(levelSegment, { width, quality, clearance: roadSpace,
    y: deckY + thickness / 2 + 0.02 })) {
    add(mark.material, mark.position, mark.scale, null, 'box', mark.rotation, mark.color);
  }
  for (const side of [-1, 1]) {
    const offset = (width / 2 - 0.4) * side;
    const clear = roadSpace ? roadSpace.clearSpans(levelSegment, offset, 0.09) : [[0, 1]];
    for (const [from, to] of clear) {
      const point = pointAt(segment, geo, (from + to) / 2);
      const rx = point.x + geo.px * offset, rz = point.z + geo.pz * offset;
      add('steel', [rx, deckY + thickness / 2 + D.guardHeight / 2, rz],
        [0.18, D.guardHeight, geo.length * (to - from)], null, 'box', geo.rotation);
    }
  }
  for (const end of [0, 1]) {
    const ex = end ? segment.x2 : segment.x1, ez = end ? segment.z2 : segment.z1;
    const inward = end ? -1 : 1;
    const ax = ex + geo.ux * abutmentDepth * 0.5 * inward, az = ez + geo.uz * abutmentDepth * 0.5 * inward;
    if (!roadSpace || roadSpace.pointClear(ax, az, Math.min(width, abutmentDepth) / 2, 0)) {
      add('stone', [ax, deckY / 2, az], [width * 0.94, deckY, abutmentDepth], null, 'box', geo.rotation, color);
      add('dark', [ax, deckY - 0.3, az], [width, 0.6, abutmentDepth], null, 'box', geo.rotation);
    }
  }
  if (quality !== 'low' && geo.length > D.pierSpacing[quality]
    && (!roadSpace || roadSpace.pointClear(geo.cx, geo.cz, D.pierRadius * 0.7, 0))) {
    add('stone', [geo.cx, (deckY - thickness / 2) / 2, geo.cz], [D.pierRadius, deckY - thickness / 2, D.pierRadius], null, 'cylinder');
  }
}

/** 가드레일, 방음벽, 중앙분리대, 표지, 조명 같은 도로 부속물이다. 대로와 지선 둘 다 쓴다. */
export function addRoadFurniture(add, segment, options = {}) {
  const quality = normalizeQuality(options.quality);
  const D = ROAD_STRUCTURE_DEFAULTS;
  const width = options.width ?? D.width;
  const geo = segmentGeometry(segment);
  const clearance = clearanceOf(options);

  if (options.median) {
    const spans = clearance ? clearance.clearSpans(segment, 0, 0.55) : [[0, 1]];
    for (const [from, to] of spans) {
      const point = pointAt(segment, geo, (from + to) / 2), length = geo.length * (to - from);
      add('marking', [point.x, 0.3, point.z], [1.1, 0.5, length], null, 'box', geo.rotation);
      if (quality !== 'low') add('green', [point.x, 0.55, point.z], [0.8, 0.5, length * 0.94], null, 'box', geo.rotation);
    }
  }
  if (options.soundWall) {
    for (const side of [-1, 1]) {
      const offset = (width / 2 + 1.2) * side;
      const spans = clearance ? clearance.clearSpans(segment, offset, 0.2) : [[0, 1]];
      for (const [from, to] of spans) {
        const point = pointAt(segment, geo, (from + to) / 2);
        const wx = point.x + geo.px * offset, wz = point.z + geo.pz * offset;
        add('violet', [wx, D.wallHeight / 2, wz], [0.4, D.wallHeight, geo.length * (to - from)], null, 'box', geo.rotation);
      }
    }
  }

  const spacing = D.furnitureSpacing[quality];
  if (!spacing) return;
  const count = Math.max(0, Math.floor(geo.length / spacing));
  for (let i = 0; i < count; i += 1) {
    const { x, z } = pointAt(segment, geo, (i + 0.5) / count);
    const side = i % 2 === 0 ? -1 : 1;
    const px = x + geo.px * (width / 2 + 0.3) * side, pz = z + geo.pz * (width / 2 + 0.3) * side;
    if (clearance && !clearance.pointClear(px, pz, 0.08, 0)) continue;
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
  const { offset, from, to, material, dash, lineWidth, y } = options;
  const span = to - from;
  if (span <= 1) return [];
  const center = (from + to) / 2;
  const place = (along, length) => {
    const x = segment.x1 + geo.ux * along + geo.px * offset;
    const z = segment.z1 + geo.uz * along + geo.pz * offset;
    return { material, position: [x, y, z], scale: [lineWidth, MARKING.thickness, length],
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
  const clearance = clearanceOf(options);
  const y = options.y ?? MARKING.y;
  const line = (offset, material, dashed) => {
    const allowed = clearance ? clearance.clearSpans(segment, offset, MARKING.lineWidth / 2) : [[0, 1]];
    const bounds = [from / geo.length, to / geo.length];
    return intersectSpans(allowed, [bounds]).flatMap(([start, end]) => linePieces(segment, geo, {
      offset, from: start * geo.length, to: end * geo.length, material, y,
      lineWidth: MARKING.lineWidth, dash: dashed ? dash : null,
    }));
  };

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
