/** 가로등, 가로수, 가드레일의 순수 배치 데이터 빌더다. Three, React 에 의존하지 않는다.
 * plan 은 shared/urbanPlan.js createUrbanPlan() 의 반환값 모양이면 되고, 아직 만들어지지
 * 않은 필드(nature, ponds 등)는 옵셔널 체이닝으로 비워 둔다. 각 함수는
 * cityModels.js 의 createBatches().add(material, position, scale, owner, shape, rotation,
 * color) 인자 순서와 같은 튜플 배열을 낸다. owner 는 항상 null 이다.
 */
import { clearOfRoads, ROAD_WIDTH, surfaceRoadIndex } from '../../shared/urbanPlan.js';
import { inWaterBody } from '../../shared/river.js';

/** 간격표다. 09 가로 시설 절의 값을 그대로 옮긴다. low 는 모두 두 배로 벌린다. */
export const FURNITURE_SPACING = Object.freeze({
  lamp: { arterial: 36, collector: 48, lane: 72 },
  tree: { arterial: 18, collector: 24 },
});

function normalizeQuality(quality) {
  return quality === 'low' || quality === 'high' ? quality : 'medium';
}

// roadStructures.segmentGeometry 와 같은 공식이다. 두 모듈이 서로 import 하지 않도록
// 여기서도 짧게 다시 둔다(도로 폭·회전 계산은 도로 하나에 한정된 순수 산수라 중복 비용이 적다).
function segmentGeometry(road) {
  const dx = road.x2 - road.x1, dz = road.z2 - road.z1;
  const length = Math.hypot(dx, dz) || 1;
  const ux = dx / length, uz = dz / length;
  return { length, ux, uz, px: -uz, pz: ux, rotation: Math.atan2(dx, dz) };
}

function pointAt(road, geo, t) {
  return { x: road.x1 + geo.ux * geo.length * t, z: road.z1 + geo.uz * geo.length * t };
}

/** 다리 상판 위에는 가로 시설을 세우지 않는다. addBridge 의 상판 치수를 여유 있게 본다. */
function onBridgeDeck(plan, x, z) {
  return (plan.bridges || []).some((bridge) => {
    const halfWidth = (bridge.width ?? 15) / 2 + 3, halfSpan = (bridge.length ?? 80) / 2 + 3;
    return Math.abs(x - bridge.x) <= halfWidth && Math.abs(z - bridge.z) <= halfSpan;
  });
}

function skip(plan, x, z) {
  return inWaterBody(plan.extent, x, z) || onBridgeDeck(plan, x, z);
}

/** 경로 길이를 spacing 간격으로 나눈 t(0~1) 목록이다. phase 는 시작점을 spacing 의
 * 비율만큼 밀어 두 줄을 어긋나게(지그재그) 놓을 때 쓴다. */
function spacedT(length, spacing, phase = 0) {
  if (!spacing || spacing <= 0) return [];
  const points = [];
  for (let d = spacing * (0.5 + phase); d < length; d += spacing) points.push(d / length);
  return points;
}

/** 가로등이다. 큰길일수록 촘촘하고 양쪽에 서며, 골목은 경로 양 끝에만 선다. 고가는
 * roadStructures.addElevatedRoad 가 이미 난간등을 낸다. spots 는 StreetLamps 가 카메라
 * 근접 몇 개만 골라 실제 광원을 켜는 데 쓰는 좌표다. */
export function lampSpots(plan, quality) {
  const q = normalizeQuality(quality);
  const factor = q === 'low' ? 2 : 1;
  const parts = [];
  const spots = [];
  const place = (x, z, rotation) => {
    if (skip(plan, x, z)) return;
    parts.push(['dark', [x, 2.6, z], [0.22, 5.2, 0.22], null, 'box', rotation]);
    parts.push(['dark', [x, 5.3, z], [1.5, 0.16, 0.22], null, 'box', rotation]);
    parts.push(['lamp', [x, 5.05, z], [1.1, 0.34, 0.5], null, 'box', rotation]);
    parts.push(['glow', [x, 0.36, z], [9, 0.02, 9], null, 'octagon']);
    spots.push({ x, z, y: 5.05 });
  };

  for (const road of plan.roads || []) {
    if (road.kind === 'highway' || road.elevated) continue;
    const geo = segmentGeometry(road);
    if (road.kind === 'alley') {
      for (const end of [0, 1]) {
        const point = end ? { x: road.x2, z: road.z2 } : { x: road.x1, z: road.z1 };
        place(point.x, point.z, geo.rotation);
      }
      continue;
    }
    const spacing = FURNITURE_SPACING.lamp[road.kind];
    if (!spacing) continue;
    const width = ROAD_WIDTH[road.kind] ?? 10;
    const offset = width / 2 + 1.6;
    if (road.kind === 'arterial') {
      // 양측을 절반 간격만큼 어긋나게 세워 지그재그로 읽히게 한다.
      for (const [side, phase] of [[-1, 0], [1, 0.5]]) {
        for (const t of spacedT(geo.length, spacing * factor, phase)) {
          const { x, z } = pointAt(road, geo, t);
          place(x + geo.px * offset * side, z + geo.pz * offset * side, geo.rotation);
        }
      }
    } else {
      // collector, lane 은 한쪽에만 선다.
      for (const t of spacedT(geo.length, spacing * factor)) {
        const { x, z } = pointAt(road, geo, t);
        place(x + geo.px * offset, z + geo.pz * offset, geo.rotation);
      }
    }
  }
  return { parts, spots };
}

/** 가로수다. 대로와 집산로 보도 바깥에 심고, 강변 집산로는 강 쪽에 한 줄을 더 둬
 * 두 열이 되게 한다. 고속도로와 골목, 지선에는 두지 않는다. */
export function streetTrees(plan, quality) {
  const q = normalizeQuality(quality);
  const factor = q === 'low' ? 2 : 1;
  const parts = [];
  const place = (x, z, seed) => {
    if (skip(plan, x, z)) return;
    parts.push(['wood', [x, 1.5, z], [0.42, 3, 0.42], null, 'trunk']);
    // season.js 팔레트로 갈아탈 세 수종 교대다. 여기서는 결정적 색 인덱스만 낸다.
    const kinds = [undefined, '#a6bd7c', '#8fae6a'];
    parts.push(['leaf', [x, 4.7, z], [2.1, 3.2, 2.1], null, 'tree', seed * 0.17, kinds[seed % kinds.length]]);
  };

  let seed = 0;
  for (const road of plan.roads || []) {
    if (road.kind === 'highway' || road.kind === 'alley' || road.kind === 'lane' || road.elevated) continue;
    if (road.kind === 'collector' && q === 'low') continue; // low 는 간선만 남긴다
    const geo = segmentGeometry(road);
    const width = ROAD_WIDTH[road.kind] ?? 15;
    const isRiverside = road.kind === 'collector' && (road.id || road.path || '').startsWith('river-');
    const spacing = FURNITURE_SPACING.tree[road.kind];
    if (!spacing) continue;
    const rows = road.kind === 'arterial' ? [width / 2 + 6] : isRiverside ? [width / 2 + 6, width / 2 + 14] : [width / 2 + 6];
    const sides = road.kind === 'arterial' ? [-1, 1] : [1];
    for (const t of spacedT(geo.length, spacing * factor)) {
      const { x, z } = pointAt(road, geo, t);
      for (const side of sides) for (const offset of rows) {
        place(x + geo.px * offset * side, z + geo.pz * offset * side, seed);
        seed += 1;
      }
    }
  }
  return parts;
}

const KERB_POINTS = 10;

/** 가드레일 한 조각의 길이다. 짧을수록 교차로에서 끊기는 자리가 정확하고 조각 수는 는다. */
const RAIL_PIECE = 10;
/** 다른 도로 가장자리에서 이만큼 떨어진 조각만 남긴다. 자기 도로는 가장자리에서 0.4 떨어져
 * 있으므로 그보다 작아야 자기 레일까지 지우지 않는다. */
const RAIL_CLEAR = 0.3;
/** 레일 충돌 상자의 여유다. 건물 기본값(3) 을 쓰면 차선 안쪽까지 보이지 않는 벽이 된다. */
const RAIL_MARGIN = 0.3;

/** 가드레일이다. 강변 집산로의 강 쪽, 외곽 순환로 모서리 호의 바깥쪽, 공항로 양측,
 * 로터리 연석만 다룬다. 대로 중앙분리대는 UrbanScenery 가 roadStructures.addRoadFurniture
 * 로 이미 그린다(그쪽 표는 medium 부터 켜는 것으로 바뀌었다).
 * 레일 한 줄을 통짜 상자로 놓으면 교차로를 그대로 가로질러 옆길을 막는다. 조각으로 끊고
 * 다른 도로 노면에 걸치는 조각은 버린다. */
export function guardrails(plan, quality) {
  const q = normalizeQuality(quality);
  const parts = [];
  // 차가 부딪히면 막히는 레일 상자다. 연석은 낮아 타고 넘으므로 넣지 않는다.
  const solids = [];
  const index = surfaceRoadIndex(plan);
  const open = (x, z) => !skip(plan, x, z) && clearOfRoads(index, x, z, RAIL_CLEAR);
  const rail = (x, z, length, geo) => {
    const count = Math.max(1, Math.round(length / RAIL_PIECE));
    const piece = length / count;
    for (let i = 0; i < count; i += 1) {
      const from = (i + 0.5) * piece - length / 2;
      const px = x + geo.ux * from, pz = z + geo.uz * from, half = piece / 2;
      // 조각의 가운데와 양 끝을 모두 본다. 가운데만 보면 조각이 교차로를 반쯤 물고 남는다.
      if (!open(px, pz) || !open(px - geo.ux * half, pz - geo.uz * half) || !open(px + geo.ux * half, pz + geo.uz * half)) continue;
      parts.push(['steel', [px, 0.9, pz], [0.16, 1.1, piece], null, 'box', geo.rotation]);
      solids.push({ x: px, z: pz, height: 1.1, width: 0.16, depth: piece, rotation: geo.rotation, margin: RAIL_MARGIN });
    }
  };

  for (const road of plan.roads || []) {
    const id = road.id || road.path || '';
    const geo = segmentGeometry(road);
    const width = ROAD_WIDTH[road.kind] ?? 15;
    if (id.startsWith('river-')) {
      // river-north 는 강이 +z 쪽, river-south 는 -z 쪽에 있다.
      const side = id === 'river-north' ? 1 : -1;
      const { x, z } = pointAt(road, geo, 0.5);
      rail(x + geo.px * (width / 2 + 0.4) * side, z + geo.pz * (width / 2 + 0.4) * side, geo.length, geo);
    } else if (id.startsWith('airport-road')) {
      for (const side of [-1, 1]) {
        const { x, z } = pointAt(road, geo, 0.5);
        rail(x + geo.px * (width / 2 + 0.4) * side, z + geo.pz * (width / 2 + 0.4) * side, geo.length, geo);
      }
    } else if (id === 'ring' && road.arc) {
      // 모서리 호 구간만 바깥쪽에 세운다. 세그먼트 중심이 원점에서 먼 쪽이 바깥이다.
      const { x, z } = pointAt(road, geo, 0.5);
      const outward = Math.hypot(x, z) > Math.hypot(road.x1, road.z1) ? 1 : -1;
      rail(x + geo.px * (width / 2 + 0.4) * outward, z + geo.pz * (width / 2 + 0.4) * outward, geo.length, geo);
    }
  }

  if (q !== 'low') for (const circle of plan.roundabouts || []) {
    for (let i = 0; i < KERB_POINTS; i += 1) {
      const a = (i / KERB_POINTS) * Math.PI * 2;
      const x = circle.x + Math.cos(a) * circle.r * 0.86, z = circle.z + Math.sin(a) * circle.r * 0.86;
      parts.push(['steel', [x, 0.25, z], [1.4, 0.3, 1.4], null, 'box', a]);
    }
  }
  return { parts, solids };
}
