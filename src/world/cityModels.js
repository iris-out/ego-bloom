import { modelVariant } from './modelVariant.js';
import { addTierBuilding, addTierSilhouette, lotOf } from './models/tierBuildings.js';
import { FAR_MATERIAL, PALETTE } from './shapes.js';
/** Model source: seven miniature-city silhouettes. Read README.md before edits.
 * Pure data builder: placement/ELO height arrive from shared/worldLayout.js.
 * Shape/material keys must match WorldScene.useResources; retain owner IDs.
 */
// All city parts become instances of a small set of shared, lit geometries.
export const TIER_COLORS = {
  bronze: '#C98B5E', silver: '#B8C0CC', gold: '#E8C04A', platinum: '#6FD3C8',
  diamond: '#6AA8FF', master: '#C58CFF', grandmaster: '#F472B6', champion: '#FF6B5B',
};

/** midDrop, farDrop 은 그 단계에서 지우는 파트의 최소 표시 크기(월드 단위)다.
 * 필지를 줄이면 모델 평면도 같은 비율로 줄어드니 이 기준도 같이 줄여야 한다.
 * 안 그러면 축소 단계가 위층 장식을 통째로 먹어 실루엣이 무너진다.
 * 세 단계 모두 같은 모델을 쓴다. 덩어리, 지붕, 첨탑처럼 실루엣을 만드는 파트는 어느 단계에서도 남는다.
 * silhouetteAt 은 제작자 건물이 티어 실루엣으로 바뀌는 거리다. 실루엣은 파트를 지우는 게 아니라
 * 모양을 갈아 끼우므로 픽셀 기준이 없다. 화질이 높을수록 멀리 둔다.
 * carRadius 는 차량 행렬을 매 프레임 갱신하는 카메라 반경이다.
 * aircraft 는 상공을 도는 AI 항공기 수다. 한 대마다 모델 하나라 차량보다 훨씬 적게 잡는다.
 */
export const QUALITY = {
  low: { dpr: 1, floors: 3, trees: 0.25, shadows: false, particles: 100, cars: 200, aircraft: 14, midDrop: 1.4, farDrop: 3.4, silhouetteAt: 1000, carRadius: 380, streetlights: 4 },
  medium: { dpr: 1.5, floors: 6, trees: 0.55, shadows: true, particles: 240, cars: 500, aircraft: 25, midDrop: 1.15, farDrop: 3.1, silhouetteAt: 1400, carRadius: 560, streetlights: 6 },
  high: { dpr: 2, floors: 10, trees: 1, shadows: true, particles: 450, cars: 900, aircraft: 39, midDrop: 0.85, farDrop: 2.5, silhouetteAt: 1900, carRadius: 900, streetlights: 10 },
};

/** 846px 높이, fov 38도 화면에서 월드 1단위가 1픽셀로 줄어드는 거리다. 세 픽셀을 바닥으로 잡는다.
 * near 경계는 mid 가 지울 파트가 딱 세 픽셀이 되는 거리다. mid 경계는 실루엣으로 바뀌는 거리라
 * silhouetteAt 을 쓰되, far 가 지울 파트가 세 픽셀보다 크게 보이는 거리보다 앞당기지 않는다.
 * 맵이 작아지면 extent 가 먼저 묶는다.
 */
const UNIT_TO_PIXEL = 1229, LOD_PIXEL_FLOOR = 3;
export function lodBands(quality, extent) {
  const budget = QUALITY[quality] || QUALITY.medium;
  const span = Math.max(1, Number(extent) || 0);
  const reach = (drop) => (drop * UNIT_TO_PIXEL) / LOD_PIXEL_FLOOR;
  return { near: Math.min(reach(budget.midDrop), span * 0.45),
    mid: Math.min(Math.max(budget.silhouetteAt, reach(budget.farDrop)), span * 1.1) };
}

/** 실제 부지 크기. 레이아웃이 채운 lot 이 있으면 그것을 쓰고 없으면 티어 기본값을 쓴다. */
export function lotSizeOf(building) {
  const lot = Number(building?.lot);
  if (Number.isFinite(lot) && lot > 0) return lot;
  return lotOf(String(building?.tier_name || 'bronze').toLowerCase());
}

// 건물 덩어리가 부지에서 차지하는 비율. picking box 와 선택 링, 벽면 카드가 함께 쓴다.
export const MASS_LOT_RATIO = 0.42;

/** Batch parts: world-space center, primitive XYZ scale, Y rotation in radians or
 * [pitch, yaw, roll] for sloped structures.
 * `owner` identifies the creator; null denotes scenery. Only box/pane are unit
 * width: radial primitives use unit radius. Renderer owns all GPU resources.
 */
export function createBatches() {
  const batches = {};
  return {
    batches,
    add(material, position, scale, owner = null, shape = 'box', rotation = 0, color) {
      const key = `${shape}-${material}`;
      (batches[key] ||= { shape, material, parts: [] }).parts.push({ position, scale, owner, rotation, color });
    },
  };
}

export function buildArchitecture(buildings, quality = 'medium') {
  const { batches, add } = createBatches();
  const budget = QUALITY[quality] || QUALITY.medium;
  for (const building of buildings) {
    const { x, z, id } = building;
    // height already contains tier/ELO multipliers. 260 is only a defensive cap.
    const h = Number.isFinite(building.height) && building.height > 0 ? Math.min(260, building.height) : 12;
    const tier = String(building.tier_name || 'bronze').toLowerCase();
    const accent = TIER_COLORS[tier] || TIER_COLORS.bronze;
    let hash = 2166136261;
    for (const char of String(id)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    hash >>>= 0;
    const widthScale = 1, depthScale = 1;
    const turn = hash % 7 === 0 ? Math.PI / 2 : 0;
    const part = (mat, dx, y, dz, w, height, d, shape = 'box', rotation = 0, color) => {
      const px = dx * widthScale, pz = dz * depthScale;
      add(mat, [x + Math.cos(turn) * px + Math.sin(turn) * pz, y + 0.5, z - Math.sin(turn) * px + Math.cos(turn) * pz],
        [w * widthScale, height, d * depthScale], id, shape, rotation + turn, color ?? (mat === 'accent' ? accent : undefined));
    };
    const variant = modelVariant(building);
    if (!addTierBuilding(tier, variant, h, part, budget)) addTierBuilding('bronze', 0, h, part, budget);
  }
  return batches;
}

// 원기둥 계열은 단위 반지름이라 크기를 잴 때 지름으로 환산한다.
const RADIAL_SHAPES = new Set(['octagon', 'spire', 'trunk', 'cylinder', 'cone', 'pyramid', 'dome', 'tree', 'hill']);
// 가로수는 크기 필터만 쓰면 잎만 남고 줄기가 사라진다. 짝을 함께 지운다.
// trunk 는 냉각탑에도 쓰이므로 이 크기 아래일 때만 조경으로 본다.
const PROP_SHAPES = new Set(['tree', 'trunk']);
const PROP_MATERIALS = new Set(['leaf']);
const PROP_LIMIT = 8;
// 실루엣을 만드는 형상. 지붕, 첨탑, 왕관은 가늘어도 지우지 않는다.
const SILHOUETTE_SHAPES = new Set(['gable', 'spire', 'cone', 'pyramid', 'dome']);
// 꼭대기 이 비율 안에 드는 파트는 가늘어도 남긴다. 마스트와 안테나가 실루엣을 만든다.
const CROWN_BAND = 0.12;
// 파트를 지우는 문턱은 건물 자체 높이에도 묶인다. 낮은 건물일수록 덜 지운다.
const RELATIVE_DROP = 0.05, RELATIVE_FLOOR = 0.6;

/** 파트의 평면 크기다. 원기둥 계열은 scale 이 반지름이라 지름으로 바꾼다.
 * 충돌 상자를 파트에서 만들 때 이 값을 쓴다. */
export function partFootprint(shape, scale) {
  const radial = RADIAL_SHAPES.has(shape) ? 2 : 1;
  return [Math.abs(scale[0]) * radial, Math.abs(scale[2]) * radial];
}

/** 파트가 화면에서 차지하는 크기의 대용값.
 * 평면은 짧은 변, 나머지는 세 축의 중간값이다. 최대값은 길고 얇은 간판을 살리고
 * 최소값은 넓적한 옥상 판을 지운다.
 */
export function partSize(shape, scale) {
  const radial = RADIAL_SHAPES.has(shape) ? 2 : 1;
  const w = Math.abs(scale[0]) * radial, h = Math.abs(scale[1]), d = Math.abs(scale[2]) * radial;
  if (shape === 'pane') return Math.min(w, h);
  return [w, h, d].sort((a, b) => a - b)[1];
}

/** 층마다 깔린 창문을 면당 한 장으로 합친다. 같은 owner, 같은 면, 같은 폭이면 y 만 다르다.
 * 인스턴스가 층수만큼 줄고 야간 유리 발광은 띠 하나로 이어진다.
 */
function mergePanes(parts) {
  const groups = new Map(), merged = [];
  for (const part of parts) {
    if (part.owner == null) { merged.push(part); continue; }
    const key = `${part.owner}|${part.rotation.toFixed(3)}|${part.position[0].toFixed(2)}|${part.position[2].toFixed(2)}|${part.scale[0].toFixed(2)}|${part.color ?? ''}`;
    const found = groups.get(key);
    if (!found) { groups.set(key, { part, index: merged.length, low: part.position[1] - part.scale[1] / 2, high: part.position[1] + part.scale[1] / 2 }); merged.push(part); continue; }
    found.low = Math.min(found.low, part.position[1] - part.scale[1] / 2);
    found.high = Math.max(found.high, part.position[1] + part.scale[1] / 2);
    merged[found.index] = { ...found.part, position: [found.part.position[0], (found.low + found.high) / 2, found.part.position[2]],
      scale: [found.part.scale[0], found.high - found.low, found.part.scale[2]] };
  }
  return merged;
}

/** 거리에 따라 원본 모델에서 화면에 안 보일 파트만 걷어낸다. 실루엣은 손으로 다시 만들지 않는다.
 * collapse 를 켜면 재질까지 대표 재질로 합쳐 타일당 draw call 을 줄인다. 색은 인스턴스가 그대로 싣는다.
 * 순수 함수이며 같은 입력이면 같은 결과를 준다.
 */
export function reduceArchitecture(batches, minSize, collapse = false) {
  if (!(minSize > 0)) return batches;
  const tops = new Map();
  for (const batch of Object.values(batches)) for (const part of batch.parts) {
    if (part.owner == null) continue;
    const top = part.position[1] + part.scale[1] / 2;
    if (!(tops.get(part.owner) >= top)) tops.set(part.owner, top);
  }
  const reduced = {};
  for (const batch of Object.values(batches)) {
    const prop = PROP_SHAPES.has(batch.shape) || PROP_MATERIALS.has(batch.material);
    const source = batch.shape === 'pane' && batch.material !== 'shopfront' ? mergePanes(batch.parts) : batch.parts;
    const parts = source.filter((part) => {
      const top = tops.get(part.owner) ?? 0;
      // 저층 주택가는 건물 전체가 작은 조각으로 이뤄져 있다. 절대 크기로 자르면 동네가 통째로 사라진다.
      const limit = Math.min(minSize, Math.max(RELATIVE_FLOOR, top * RELATIVE_DROP));
      const size = partSize(batch.shape, part.scale);
      if (prop && size < PROP_LIMIT) return false;
      return SILHOUETTE_SHAPES.has(batch.shape) || size >= limit
        || part.position[1] + part.scale[1] / 2 >= top * (1 - CROWN_BAND);
    });
    if (!parts.length) continue;
    const material = collapse ? (FAR_MATERIAL[batch.material] || batch.material) : batch.material;
    const key = `${batch.shape}-${material}`;
    const tinted = material === batch.material ? parts
      : parts.map((part) => (part.color ? part : { ...part, color: PALETTE[batch.material] }));
    const found = reduced[key];
    if (found) found.parts = found.parts.concat(tinted);
    else reduced[key] = { shape: batch.shape, material, parts: tinted };
  }
  return reduced;
}

/** 단계별 건물 배치. near 는 품질 예산 그대로이고 mid, far 는 같은 모델에서 작은 파트만 뺀다. */
export function buildLodArchitecture(buildings, quality = 'medium', level = 'near') {
  const near = buildArchitecture(buildings, quality);
  if (level === 'near') return near;
  const budget = QUALITY[quality] || QUALITY.medium;
  return level === 'far' ? reduceArchitecture(near, budget.farDrop, true) : reduceArchitecture(near, budget.midDrop);
}

/** NPC 배경 건물의 addNpcSilhouette 와 같은 발상을 제작자 건물에 적용한다. 원본 모델에서
 * 작은 파트를 걷어내는 reduceArchitecture 와 달리, 건물 하나를 몸통과 상부 표식 한둘로
 * 처음부터 다시 짓는다. 덩치(몸통 박스류) 자체가 삼각형 대부분을 차지해 크기 필터로는
 * 못 줄었던 원거리 비용을 없앤다. quality 나 variant 에 관계없이 티어 하나당 모양 하나라
 * 변형이 모두 같아 보이므로 WorldScene 은 far 단계에서만 쓴다. mid 는 원본에서 작은 파트만 뺀다.
 */
export function buildSilhouetteArchitecture(buildings) {
  const { batches, add } = createBatches();
  for (const building of buildings) {
    const { x, z, id } = building;
    // height already contains tier/ELO multipliers. 260 is only a defensive cap.
    const h = Number.isFinite(building.height) && building.height > 0 ? Math.min(260, building.height) : 12;
    const tier = String(building.tier_name || 'bronze').toLowerCase();
    const accent = TIER_COLORS[tier] || TIER_COLORS.bronze;
    let hash = 2166136261;
    for (const char of String(id)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    hash >>>= 0;
    // near 모델과 같은 회전을 써서 LOD 전환 때 건물이 갑자기 돌아 보이지 않게 한다.
    const turn = hash % 7 === 0 ? Math.PI / 2 : 0;
    const part = (mat, dx, y, dz, w, height, d, shape = 'box', rotation = 0, color) => {
      add(mat, [x + Math.cos(turn) * dx + Math.sin(turn) * dz, y + 0.5, z - Math.sin(turn) * dx + Math.cos(turn) * dz],
        [w, height, d], id, shape, rotation + turn, color ?? (mat === 'accent' ? accent : undefined));
    };
    if (!addTierSilhouette(tier, h, part)) addTierSilhouette('bronze', h, part);
  }
  return batches;
}
