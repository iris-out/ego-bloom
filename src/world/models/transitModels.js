/** 지하철 출입구, 횡단보도, 고속도로 IC/JC, 교량의 순수 데이터 빌더다. Three, React,
 * 네트워크에 의존하지 않는다. shared/transit.js 의 좌표(subway 역, interchange 노드,
 * bridge 정보)를 받아 배치 데이터로 바꾼다. add() 계약은 civicBuildings.js 의
 * tools() 와 같다: add(material, [x,y,z], [w,h,d], null, shape, rotation, color).
 * owner 는 항상 null 이다. 화면 연결은 이 파일이 맡지 않는다.
 */
import { LEVELS } from '../../../shared/elevation.js';
import { ROAD_WIDTH } from '../../../shared/urbanPlan.js';
import { bridgeSegment } from '../../../shared/bridgeGeometry.js';
import { addRamp, MARKING } from './roadStructures.js';

export const TRANSIT_MODEL_DEFAULTS = Object.freeze({
  // 지하철 출입구: 계단 단수, 캐노피 치수, 기둥 높이다.
  entranceStairSteps: { low: 3, medium: 4, high: 5 },
  entranceStepDrop: 0.5,
  entranceStepDepth: 1.4,
  entranceCanopyWidth: 6,
  entranceCanopyDepth: 4.4,
  entranceCanopyThickness: 0.4,
  entrancePostHeight: 3.1,
  entrancePillarHeight: 3.6,
  entranceLineColor: '#8a97a6', // station.color 가 없을 때 쓰는 중립 회색
  // 횡단보도: 줄무늬 개수와 치수, 정지선 세트백이다.
  crosswalkStripes: { low: 3, medium: 5, high: 7 },
  crosswalkStopLines: { low: 1, medium: 2, high: 2 },
  crosswalkStripeWidth: 1.2,
  crosswalkStripeLength: 5,
  crosswalkSetback: 2.6,
  // JC 두 축은 같은 높이에서 만나 차량이 실제로 갈아탈 수 있다.
  jcSpan: 90,
  jcLowerHeight: LEVELS.HIGHWAY_DECK,
  jcUpperHeight: LEVELS.HIGHWAY_DECK,
  // 교량: 상판은 지면 높이, 교각은 강바닥까지 내려간다. 사장교는 주탑과 케이블이 더 있다.
  bridgeSpan: 80,
  bridgeDeckThickness: 1.1,
  bridgePierStations: { low: 2, medium: 3, high: 5 },
  bridgePierFoundation: 1.2,
  bridgePylonPosition: [0.32, 0.68],
  bridgePylonHeight: 40,
  bridgeCableCount: { low: 0, medium: 3, high: 5 },
});

function normalizeQuality(quality) {
  return quality === 'low' || quality === 'high' ? quality : 'medium';
}

/** 지하철 지상 출입구다. 계단과 캐노피는 모든 품질에서 나오고, medium 이상만
 * 노선 색 기둥과 손잡이가, high 는 조명이 더 붙는다. station 은
 * shared/transit.js subwayStations 의 항목({x,z,major,ko})이고 color 를
 * 더해 넘기면 그 노선 색을 기둥에 쓴다. */
export function addSubwayEntrance(add, station, quality) {
  const q = normalizeQuality(quality);
  const D = TRANSIT_MODEL_DEFAULTS;
  const { x, z } = station;
  const scale = station.major ? 1.3 : 1;
  const steps = D.entranceStairSteps[q];

  for (let i = 0; i < steps; i += 1) {
    const stepZ = z + (i - (steps - 1) / 2) * D.entranceStepDepth * scale;
    const stepY = -0.3 - i * D.entranceStepDrop;
    add('stone', [x, stepY, stepZ], [4.2 * scale, 0.3, D.entranceStepDepth * scale], null, 'box');
  }

  const canopyY = D.entrancePostHeight + D.entranceCanopyThickness / 2;
  add('roof', [x, canopyY, z], [D.entranceCanopyWidth * scale, D.entranceCanopyThickness, D.entranceCanopyDepth * scale], null, 'box');
  for (const side of [-1, 1]) {
    const px = x + (D.entranceCanopyWidth / 2 - 0.4) * scale * side;
    add('steel', [px, D.entrancePostHeight / 2, z], [0.24, D.entrancePostHeight, 0.24], null, 'box');
  }
  if (q === 'low') return;

  const pillarZ = z + D.entranceCanopyDepth * 0.55 * scale;
  add('accent', [x, D.entrancePillarHeight / 2, pillarZ], [0.6, D.entrancePillarHeight, 0.6], null, 'cylinder', 0, station.color ?? D.entranceLineColor);
  for (const side of [-1, 1]) {
    const rx = x + 2.1 * scale * side;
    add('steel', [rx, 0.5, z], [0.12, 0.9, steps * D.entranceStepDepth * scale], null, 'box');
  }
  if (q !== 'high') return;

  for (const side of [-1, 1]) {
    const lx = x + (D.entranceCanopyWidth / 2 - 0.4) * scale * side;
    add('lamp', [lx, D.entrancePostHeight + 0.3, z], [0.5, 0.2, 0.5], null, 'octagon');
  }
}

/** 횡단보도다. road 는 {x, z, rotation, width}: rotation 은 자동차 진행 방향
 * (atan2(dx,dz)), width 는 그 도로 폭이다. 줄무늬는 진행 방향과 나란히 놓고
 * 도로 폭을 가로질러 늘어놓는다. 정지선은 진행 방향과 수직으로 폭 전체를
 * 덮는 굵은 줄이다. */
export function addCrosswalk(add, road, quality) {
  const q = normalizeQuality(quality);
  const D = TRANSIT_MODEL_DEFAULTS;
  const width = road.width;
  const rotation = road.rotation ?? 0;
  const ux = Math.sin(rotation), uz = Math.cos(rotation), px = -uz, pz = ux;

  const stripeCount = D.crosswalkStripes[q];
  const barWidth = D.crosswalkStripeWidth, barLength = D.crosswalkStripeLength;
  const span = Math.max(0, width - barWidth);
  const step = stripeCount > 1 ? span / (stripeCount - 1) : 0;
  for (let i = 0; i < stripeCount; i += 1) {
    const across = stripeCount > 1 ? -span / 2 + step * i : 0;
    const x = road.x + px * across, z = road.z + pz * across;
    add('marking', [x, MARKING.y, z], [barWidth, MARKING.thickness, barLength], null, 'box', rotation);
  }

  const stopLineCount = D.crosswalkStopLines[q];
  const sides = stopLineCount >= 2 ? [-1, 1] : [1];
  for (const side of sides) {
    const sx = road.x + ux * D.crosswalkSetback * side, sz = road.z + uz * D.crosswalkSetback * side;
    add('marking', [sx, MARKING.y, sz], [width * 0.94, MARKING.thickness, 0.5], null, 'box', rotation);
  }
}

/** IC 다이아몬드 나들목이다. 램프 네 개(node.ramps)의 폴리라인을 그대로 addRamp 에
 * 넘긴다. 좌표는 urbanPlan.rampAlignment 한 곳에서만 나온다. 진출입 표지판은
 * high 품질에서만 세운다. */
function addDiamond(add, node, q, options = {}) {
  for (const ramp of node.ramps || []) {
    addRamp(add, ramp.from, ramp.to, {
      points: ramp.points, width: ramp.width ?? ROAD_WIDTH.arterial * 0.7, quality: q,
      accelLane: true, mergeTo: ramp.merge, inward: ramp.inward,
      pierClear: options.pierClear, onPier: options.onPier,
      clearance: options.clearance, sourceRoad: ramp, addRoadTriangle: options.addRoadTriangle,
    });
  }
  if (q === 'high') {
    add('dark', [node.x, 4.2, node.z], [0.4, 8, 0.4], null, 'box');
    add('accent', [node.x, 8.4, node.z], [3.4, 1.6, 0.2], null, 'box', 0, '#2f6f4f');
  }
}

/** JC 상판이다. 서로 직교하는 두 고가도로를 같은 높이에 그려 실제 교차면을 만든다. */
function addJunction() {}

/** 고속도로 IC/JC 다. node 는 shared/urbanPlan.js interchanges 의 항목
 * ({x, z, kind, ko, ramps})이고 kind 로 IC 다이아몬드와 JC 2층 상판을 나눈다. */
export function addInterchange(add, node, quality, options = {}) {
  const q = normalizeQuality(quality);
  if (node.kind === 'JC') addJunction(add, node, q);
  else addDiamond(add, node, q, options);
}

/** 강을 건너는 교량이다. bridge 는 shared/transit.js riverBridges() 의 항목
 * ({x, z, big, ko, width})이고, 강이 대략 X 축을 따라 흐른다고 보고 다리는
 * Z 축 방향으로 건넌다고 둔다. 상판은 지면 높이에 두고 교각은 강바닥
 * 아래까지 내려 세운다. big 이면 주탑 둘과 사장 케이블을 더한다. */
export function addBridge(add, bridge, quality, options = {}) {
  const q = normalizeQuality(quality);
  const D = TRANSIT_MODEL_DEFAULTS;
  // endpoint 교량과 예전 axis 교량 모두 같은 정규화된 선분을 사용한다. 렌더, 수면
  // 제외와 지도에서 이 방향을 다시 추측하면 비스듬한 횡단부가 서로 어긋난다.
  const segment = bridgeSegment({ length: D.bridgeSpan, ...bridge });
  const span = segment.length, half = span / 2;
  const deckThickness = D.bridgeDeckThickness;
  // 상판 윗면을 도로 포장 윗면에 맞춘다. 어긋나면 다리 진입에서 턱이 진다.
  const deckY = LEVELS.ROAD_TOP - deckThickness / 2;
  const { cx, cz, rotation, ux, uz, px, pz } = segment;
  const along = (offset) => [cx + ux * offset, cz + uz * offset];

  add('road', [cx, deckY, cz], [segment.width, deckThickness, span], null, 'box', rotation);
  add('marking', [cx, deckY + deckThickness / 2 + 0.02, cz], [0.34, 0.05, span], null, 'box', rotation);
  const railOffset = segment.width / 2 - 0.4;
  for (const side of [-1, 1]) {
    const offset = railOffset * side;
    const ranges = options.clearance?.clearSpans?.(segment, offset, 0.08) ?? [[0, 1]];
    for (const range of ranges) {
      const from = Math.max(0, Math.min(1, Number(range?.[0])));
      const to = Math.max(from, Math.min(1, Number(range?.[1])));
      const length = (to - from) * span;
      if (!(length > 1e-6)) continue;
      const middle = (from + to) / 2;
      const rx = segment.x1 + (segment.x2 - segment.x1) * middle + px * offset;
      const rz = segment.z1 + (segment.z2 - segment.z1) * middle + pz * offset;
      add('steel', [rx, deckY + deckThickness / 2 + 0.55, rz], [0.16, 1.1, length], null, 'box', rotation);
    }
  }

  const stations = D.bridgePierStations[q];
  const deckBottom = deckY - deckThickness / 2;
  const pierBottom = LEVELS.WATER - D.bridgePierFoundation;
  const pierHeight = Math.max(1.5, deckBottom - pierBottom);
  for (let i = 0; i < stations; i += 1) {
    const [px, pz] = along(-half + span * ((i + 0.5) / stations));
    add('stone', [px, (deckBottom + pierBottom) / 2, pz], [1.8, pierHeight, 1.8], null, 'cylinder');
  }

  if (!bridge.big) return;

  const pylonHeight = D.bridgePylonHeight;
  const pylonBase = deckY + deckThickness / 2;
  const cableCount = D.bridgeCableCount[q];
  for (const station of D.bridgePylonPosition) {
    // 접속 도로가 주탑 아래를 통과하면 양쪽 탑을 함께 이웃 경간으로 옮긴다.
    // 충돌 상자 여유까지 포함하고, 케이블도 옮긴 탑 자리에서 다시 파생한다.
    const t = [0,-.04,.04,-.08,.08,-.12,.12].map(shift=>station+shift)
      .filter(candidate=>candidate>.05&&candidate<.95)
      .find(candidate=>!options.clearance?.columnClear || [-1,1].every(side=>{
        const [x,z]=along(-half+span*candidate);
        return options.clearance.columnClear(x+px*(segment.width/2+.8)*side,
          z+pz*(segment.width/2+.8)*side,Math.SQRT2*(.8+3),pylonBase,pylonBase+pylonHeight,bridge);
      }));
    if(t===undefined)continue;
    const offset=-half+span*t;
    for(const side of [-1,1]){
      const [alongX,alongZ]=along(offset);
      const pylonX=alongX+px*(segment.width/2+.8)*side,pylonZ=alongZ+pz*(segment.width/2+.8)*side;
      add('steel', [pylonX, pylonBase + pylonHeight / 2, pylonZ], [1.6, pylonHeight, 1.6], null, 'box');
      // 주탑은 차도 바깥 난간 뒤에 선다.
      options.onPylon?.({ x: pylonX, z: pylonZ, width: 1.6, depth: 1.6,
        height: pylonBase + pylonHeight, roofMargin: 0 });
      for (let i = 1; i <= cableCount; i += 1) {
        const reach = (span * Math.min(t, 1 - t)) * (i / (cableCount + 1));
        const towardCenter = t < 0.5 ? 1 : -1;
        const [cableX,cableZ]=along(offset+reach*towardCenter);
        const topY = pylonBase + pylonHeight * (.94 - i * .025);
        const footY = pylonBase + .08;
        const footX = cableX+px*(segment.width/2+.8)*side, footZ = cableZ+pz*(segment.width/2+.8)*side;
        const dx = pylonX - footX, dz = pylonZ - footZ, dy = topY - footY;
        const length = Math.hypot(dx,dy,dz);
        // Cylinder's +Y axis must meet the tower, not hang vertically in free space.
        const pitch = Math.atan2(Math.hypot(dx,dz),dy), yaw = Math.atan2(dx,dz);
        add('steel', [(footX+pylonX)/2, (footY+topY)/2, (footZ+pylonZ)/2],
          [0.1, length, 0.1], null, 'cylinder', [pitch,yaw,0]);
      }
    }
  }
}
