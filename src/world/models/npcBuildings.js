import { addStoreSign } from './storefronts.js';
/** 배경용 NPC 건물과 열린 공간의 순수 데이터 빌더다. 제작자 소유가 아니므로
 * owner 는 항상 null 이고, 어디에 놓을지는 2차 배선 담당이 정한다. 좌표계는
 * X/Z 평면, 위쪽 +Y, 지면 상단 Y=0이다. Three, React, 네트워크에 의존하지 않는다.
 */

// 결정적 정수 해시다. Math.random 대신 seed 하나로 항상 같은 값을 낸다.
function hashInt(n) {
  let x = (Math.trunc(n) || 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (x ^ (x >>> 16)) >>> 0;
}
const pickOf = (seed, salt, list) => list[hashInt(seed * 131 + salt) % list.length];

/** 몸통이 없어 차가 그대로 들어가는 종류다. 주차장과 공터, 작은 공원은 바닥판뿐이고
 * 주유소는 진입 마당이 대부분이라 막지 않는다. */
export const NPC_OPEN = Object.freeze(new Set(['parking', 'pocketPark', 'playground', 'yard', 'gas']));

export const NPC_KINDS = [
  'rowhouse', 'house', 'shop', 'office', 'apartment', 'warehouse',
  'market', 'parking', 'gas', 'pocketPark', 'playground', 'yard',
  // 근린생활시설(1층 상가, 위층 주거) 두 종류와 상업지 전용 두 종류다.
  'cornerShop', 'streetShop', 'complexShop', 'signBuilding',
];

// 종류별 권장 부지 한 변 길이. 제작자 부지(LOT=68)보다 작게 잡아 사이 공간을 채운다.
export const NPC_LOT = {
  rowhouse: 64, house: 42, shop: 36, office: 54, apartment: 62, warehouse: 58,
  market: 54, parking: 48, gas: 40, pocketPark: 34, playground: 32, yard: 38,
  cornerShop: 30, streetShop: 48, complexShop: 50, signBuilding: 34,
  parkShop: 14,
};

/** 각 종류가 실제로 그리는 평면의 한 변이다. NPC_LOT 은 자리 크기이고 이 값은 그 안에
 * 실제로 채워지는 폭이라 서로 다르다. 예전에는 둘을 같은 값으로 보고 배율을 걸어서
 * 건물이 제 자리의 3분의 1도 못 덮었고 위에서 보면 빈 포장만 보였다.
 * 값은 addNpcBuilding 을 실제로 돌려 잰 것이며 모델을 고치면 다시 재야 한다. 나무처럼
 * 원형 파트는 scale 을 반지름으로 세고 파트 자체의 회전까지 반영해 잰다. 테스트의
 * 부지 경계 검사와 같은 규약이어야 배율을 걸어도 필지를 안 넘는다.
 */
export const NPC_PLAN = {
  rowhouse: 48, house: 32, shop: 16, office: 20, apartment: 25, warehouse: 35,
  market: 33, parking: 31, gas: 29, pocketPark: 25, playground: 23, yard: 27,
  cornerShop: 14, streetShop: 23, complexShop: 22, signBuilding: 15,
  parkShop: 14,
};

/** 자리를 채우려고 도면을 늘릴 수 있는 최대 배율이다. 이보다 키우면 높이는 그대로인데
 * 평면만 넓어져 납작한 덩어리가 된다. 남는 여백은 종류 선택으로 메운다.
 * 충돌 상자를 만드는 쪽도 같은 값을 읽어야 보이는 폭과 막히는 폭이 같다. */
export const MAX_FILL = 1.45;

// urbanPlan 의 district.density 와 같은 어휘다. 값이 클수록 그 종류가 자주 뽑힌다.
// cornerShop, streetShop 은 근린생활시설이라 주거 지구(open, mixed)에도 섞이고,
// complexShop, signBuilding 은 상업 색이 짙어 tower, dense 쪽 비중이 더 크다.
const DENSITY_WEIGHTS = {
  tower: {
    office: 5, apartment: 5, shop: 2, complexShop: 2, signBuilding: 1, parking: 3, market: 1,
    warehouse: 1, rowhouse: 1, gas: 1, pocketPark: 1, playground: 1, house: 0, yard: 0,
    cornerShop: 0, streetShop: 0,
  },
  // 남안 아파트 단지다. 판상형 아파트가 줄지어 서고 단지 안에 상가동 하나와
  // 놀이터, 주차장이 들어간다. 서울 강변 단지가 그렇게 생겼다.
  apartment: {
    apartment: 8, rowhouse: 2, parking: 3, playground: 2, pocketPark: 2, streetShop: 2,
    cornerShop: 1, shop: 1, market: 1, yard: 1, house: 0, office: 0, warehouse: 0,
    gas: 0, complexShop: 0, signBuilding: 0,
  },
  // 시청 둘레 관청가다. 관공서와 광장, 가로수가 들어간다. 상가와 주거는 안 짓는다.
  // 예전에는 이 대역을 배치에서 통째로 빼서 시청 앞이 빈 포장이었다.
  civic: {
    office: 7, pocketPark: 4, playground: 2, parking: 3, market: 1, yard: 1,
    house: 0, rowhouse: 0, apartment: 0, shop: 0, cornerShop: 0, streetShop: 0,
    complexShop: 0, signBuilding: 0, warehouse: 0, gas: 0,
  },
  // 구시가지다. 상가 비중을 네 밀도 중 가장 높게 잡는다.
  dense: {
    shop: 4, cornerShop: 3, streetShop: 3, complexShop: 2, signBuilding: 2, market: 3,
    rowhouse: 3, apartment: 2, office: 2, parking: 2, gas: 1, warehouse: 1, house: 1,
    pocketPark: 1, playground: 1, yard: 0,
  },
  // 주거와 상가가 섞이되 주거(house, rowhouse, apartment)가 여전히 주인공이다.
  mixed: {
    house: 3, rowhouse: 2, apartment: 2, cornerShop: 2, streetShop: 2, shop: 2,
    office: 1, market: 1, complexShop: 1, signBuilding: 1, warehouse: 1, parking: 1,
    gas: 1, pocketPark: 1, playground: 1, yard: 1,
  },
  // 외곽 주거다. house 가 가장 큰 비중을 지키되 근린상가를 눈에 띄게 섞는다.
  open: {
    house: 5, pocketPark: 3, yard: 3, playground: 2, cornerShop: 2, rowhouse: 1,
    streetShop: 1, shop: 1, warehouse: 1, parking: 1, gas: 1, market: 0, office: 0,
    apartment: 0, complexShop: 0, signBuilding: 0,
  },
  // 고가 상판 아래다. 상판 밑면이 LEVELS.HIGHWAY_DECK 이므로 가장 높은 종류가 5 를 넘지
  // 않는 것만 고른다. 실제 도시가 고가 밑에 두는 주차장, 야적장, 노점이다.
  deck: {
    parking: 5, yard: 4, market: 3, gas: 2, playground: 2, pocketPark: 2, house: 0, shop: 0,
    rowhouse: 0, office: 0, apartment: 0, warehouse: 0, cornerShop: 0, streetShop: 0,
    complexShop: 0, signBuilding: 0,
  },
};

// 이 구간 안에서는 같은 종류가 이웃해 나오지 않게 가방을 하나 채워 순서대로 뽑는다.
// seed 가 좌표와 index 를 함께 담고 있으므로, 구간이 같으면 실제로 붙어 있는 필지일
// 확률이 높다. 값을 키우면 비율은 정확해지지만 경계를 넘는 이웃까지는 보장하지 못한다.
const BAG_SPAN = 16;
const DENSITY_SALT = { tower: 0, dense: 1, mixed: 2, open: 3, deck: 4 };

/** weights 를 BAG_SPAN 칸에 정수로 배분한 뒤, 남은 수가 가장 많은 종류를 직전과
 * 다를 때만 놓는다(작업 스케줄러의 냉각시간 문제와 같은 방식). 몫을 다 쓰면 처음
 * 배분으로 되돌려 계속 채우므로 가방은 항상 BAG_SPAN 칸을 다 채우고, 그 안에서는
 * 같은 종류가 연달아 나오지 않는다. bucket 으로 시작 위치를 돌려 구간 경계도 매번
 * 같은 순서로 읽히지 않게 한다.
 */
function buildKindBag(bucket, weights) {
  const entries = NPC_KINDS.map((kind) => [kind, weights[kind] ?? 0]).filter(([, w]) => w > 0);
  const total = entries.reduce((sum, [, w]) => sum + w, 0) || 1;
  const initial = entries.map(([kind, w]) => ({ kind, count: Math.max(1, Math.round((w / total) * BAG_SPAN)) }));
  let counts = initial.map((c) => ({ ...c, left: c.count }));
  const bag = [];
  while (bag.length < BAG_SPAN) {
    if (!counts.some((c) => c.left > 0)) counts = initial.map((c) => ({ ...c, left: c.count }));
    counts.sort((a, b) => b.left - a.left || a.kind.localeCompare(b.kind));
    const next = counts.find((c) => c.left > 0 && c.kind !== bag[bag.length - 1]) || counts.find((c) => c.left > 0);
    bag.push(next.kind);
    next.left -= 1;
  }
  const rot = hashInt(bucket) % bag.length;
  return bag.slice(rot).concat(bag.slice(0, rot));
}

/** density 별 가중치에서 seed 로 결정적으로 하나를 고른다. 알 수 없는 density 는 mixed 로 떨어진다.
 * 같은 seed 구간(BAG_SPAN) 안에서는 buildKindBag 이 만든 가방을 순서대로 소비하므로
 * 이웃한 필지끼리 같은 종류가 반복되지 않는다.
 */
export function pickNpcKind(seed, options = {}) {
  const density = DENSITY_WEIGHTS[options.density] ? options.density : 'mixed';
  const weights = DENSITY_WEIGHTS[density];
  const span = Math.floor(seed / BAG_SPAN);
  const bucket = span * 5 + (DENSITY_SALT[density] ?? 2);
  let bag = buildKindBag(bucket, weights);
  // 자리가 크면 그 자리를 채울 수 있는 종류만 남긴다. 52 짜리 자리에 폭 15 짜리
  // 잡거빌딩이 서면 나머지가 빈 포장으로 남는다. 배율 한계 안에서 채울 수 있어야 한다.
  const lot = Number(options.lot);
  if (Number.isFinite(lot) && lot > 0) {
    // 자리의 절반도 못 채우는 종류만 뺀다. 작은 상가는 한 자리에 여러 채를 놓아 채우므로
    // 여기서 빼면 주거지에서 상가가 사라진다.
    const fits = bag.filter((kind) => (NPC_PLAN[kind] ?? 30) * MAX_FILL * 2 >= lot * 0.78);
    if (fits.length) bag = fits;
  }
  const pos = ((seed % BAG_SPAN) + BAG_SPAN) % BAG_SPAN;
  return bag[pos % bag.length] ?? NPC_KINDS[0];
}

function normalizeQuality(quality) {
  return quality === 'low' || quality === 'high' ? quality : 'medium';
}

// 이 크기 밑은 소품(창문, 표지판, 나무, 차)으로 보고 부지 배율을 적용하지 않는다.
const PROP_LIMIT = 3;

/** x, z 에 rotation(라디안)을 적용한 지역 좌표계 도구를 만든다. lot 이 NPC_LOT
 * 권장값과 다르면 k 배율만큼 덩어리를 늘이거나 줄이되, 소품은 실제 크기를 지킨다.
 */
function tools(add, x, z, rotation, k) {
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  const emit = (mat, dx, y, dz, w, hgt, d, shape = 'box', partRotation = 0, color) => {
    const keep = mat === 'car' || shape === 'tree' || shape === 'trunk';
    const sx = dx * k, sz = dz * k;
    const sw = keep || w < PROP_LIMIT ? w : w * k, sd = keep || d < PROP_LIMIT ? d : d * k;
    add(mat, [x + cos * sx + sin * sz, y, z - sin * sx + cos * sz], [sw, hgt, sd], null, shape, rotation + partRotation, color);
  };
  const box = (mat, dx, dz, base, w, hgt, d, color, partRotation = 0) => emit(mat, dx, base + hgt / 2, dz, w, hgt, d, 'box', partRotation, color);
  const cyl = (mat, dx, dz, base, r, hgt, color) => emit(mat, dx, base + hgt / 2, dz, r, hgt, r, 'cylinder', 0, color);
  const cone = (mat, dx, dz, base, r, hgt, shape = 'cone', color) => emit(mat, dx, base + hgt / 2, dz, r, hgt, r, shape, 0, color);
  const shape = (mat, dx, dz, base, w, hgt, d, kind, partRotation = 0, color) => emit(mat, dx, base + hgt / 2, dz, w, hgt, d, kind, partRotation, color);
  const pane = (mat, dx, dz, y, w, hgt, partRotation = 0) => emit(mat, dx, y, dz, w, hgt, 1, 'pane', partRotation);
  const door = (dx, dz, base, w = 2.2, hgt = 2.4, partRotation = 0) => box('dark', dx, dz, base, w, hgt, 0.3, undefined, partRotation);
  const sign = (dx, dz, y, w, hgt, color, partRotation = 0) => addStoreSign(emit, dx, dz, y, w, hgt, color, partRotation);
  // 색은 재질이 아니라 인스턴스 색으로 실린다. 재질 자리에 색을 넣으면 렌더가 그 키를 못 찾는다.
  const canopy = (dx, dz, y, w, d, color) => box('accent', dx, dz, y, w, 0.3, d, color);
  const tree = (dx, dz, size = 1) => { emit('wood', dx, 0.8, dz, 0.32, 1.6, 0.32, 'trunk'); emit('leaf', dx, 1.6 + 1.1 * size, dz, 1.7 * size, 2.2 * size, 1.7 * size, 'tree'); };
  const hedge = (dx, dz, w, d) => box('green', dx, dz, 0.4, w, 0.8, d);
  const car = (dx, dz, color, partRotation = 0) => { box('car', dx, dz, 0.45, 1.9, 1.1, 3.9, color, partRotation); box('tint', dx, dz, 1.5, 1.6, 0.6, 2.1, undefined, partRotation); };
  const lampPost = (dx, dz) => { box('dark', dx, dz, 0, 0.18, 4.2, 0.18); box('lamp', dx, dz, 4.2, 0.6, 0.4, 0.6); };
  const bench = (dx, dz, partRotation = 0) => { box('wood', dx, dz, 0.35, 2.4, 0.25, 1, undefined, partRotation); box('wood', dx, dz, 0.6, 2.4, 0.7, 0.16, undefined, partRotation); };
  const fence = (dx, dz, w, d) => box('dark', dx, dz, 0, w, 1.1, d);
  const tank = (dx, dz, base) => { box('dark', dx, dz, base, 1.6, 0.6, 1.6); cyl('steel', dx, dz, base + 0.6, 1, 1.6); };
  return { box, cyl, cone, shape, pane, door, sign, canopy, tree, hedge, car, lampPost, bench, fence, tank, emit };
}

// 배경 색조는 티어 강조색(TIER_COLORS)과 헷갈리지 않게 채도를 낮춘다.
const PALETTES = {
  rowhouse: ['#d8cdb8', '#c7b9a0', '#b9ab8e'],
  house: ['#e2ded1', '#d3cdbb', '#c9c2ad'],
  shop: ['#a8574f', '#4f6f8a', '#5c7a52'],
  apartment: ['#d9d5c8', '#cdc9bb'],
  warehouse: ['#8b9199', '#7d838a'],
  market: ['#8a5a4a', '#6f7a4a', '#7a5a6f'],
  gas: ['#c97b52', '#4f6f8a'],
  car: ['#c7cdd1', '#8f97a1', '#6b7278', '#9a8f7c'],
  bin: ['#8f8577', '#707a6e'],
  cornerShop: ['#c98b6e', '#b98f6a', '#a9765c'],
  streetShop: ['#c7a56a', '#b98f52', '#a97c4a'],
  signBuilding: ['#9a9488', '#8f8577', '#7d7568'],
};

/** 옥상을 채운다. 서울 저층 주거지의 인상은 물탱크, 실외기, 난간, 옥탑방이 만든다.
 * 품질에 따라 개수를 줄이되 물탱크 하나는 남긴다. 층수가 오른 만큼 옥상이 눈에 들어온다.
 */
function roofClutter(t, ctx, h, half, seed) {
  const rich = ctx.quality !== 'low', full = ctx.quality === 'high';
  const pick = hashInt(ctx.seed * seed);
  // 파란 물탱크는 세 채 중 두 채꼴로 올린다. 모든 지붕에 올리면 반복으로 읽힌다.
  if (pick % 3 !== 0) t.box('tint', half * 0.42, half * 0.4, h + 0.9, 2.2, 1.8, 2.2, '#5f8fa8');
  if (!rich) return;
  t.box('steel', -half * 0.45, half * 0.35, h + 0.5, 1.6, 1, 1.6);
  if (!full) return;
  // 옥탑방이다. 네 채 중 한 채에만 올려 스카이라인에 높낮이를 준다.
  if (pick % 4 === 1) t.box('brick', -half * 0.2, -half * 0.25, h + 1.4, half * 0.7, 2.8, half * 0.6, '#d3cdbb');
  t.box('steel', half * 0.2, -half * 0.4, h + 0.5, 1.2, 0.9, 1.2);
}

/** 층 창을 몇 개 그릴지 정한다. 층수가 오른 만큼 파트가 늘어나므로 품질로 묶는다.
 * 낮은 품질은 벽면만 남고 보통은 두 줄, 높은 품질에서만 층마다 그린다. */
function windowBands(quality, floors, medium = 2) {
  if (quality === 'low') return 0;
  if (quality === 'high') return floors;
  return Math.min(medium, floors);
}

/** rowhouse: 연립 3채가 한 줄로 붙는다. 지붕선과 현관이 반복된다. */
function buildRowhouse(t, ctx) {
  const rich = ctx.quality !== 'low', full = ctx.quality === 'high';
  const units = [-14, 0, 14];
  for (const [i, ux] of units.entries()) {
    // 다세대 주택은 4층에서 6층이다. 예전 6~8.8 은 단층집 높이라 위에서 보면 도시가 비었다.
    const floors = 4 + (hashInt(ctx.seed * 31 + i * 7) % 3);
    const h = floors * 3.2;
    const wall = pickOf(ctx.seed, i, PALETTES.rowhouse);
    t.box('brick', ux, 0, 0, 12, h, 15, wall);
    // 평지붕에 난간을 두른다. 박공지붕은 층수가 오르면 어색하다.
    t.box('stone', ux, 0, h, 12.6, 0.6, 15.6, '#cfcabb');
    // 한 동에 세 채라 층마다 창을 다 그리면 파트가 셋씩 곱해진다. 높은 품질에서도 세 줄로 묶는다.
    const bands = ctx.quality === 'high' ? Math.min(3, floors) : windowBands(ctx.quality, floors, 1);
    if (rich) {
      t.door(ux, 7.4, 0);
      for (let f = 0; f < bands; f++) t.pane('glass', ux, 7.55, (f + 0.55) * h / bands, 8, 1.5);
    }
    if (full) {
      t.pane('glass', ux, -7.55, h * 0.55, 8, 1.3, Math.PI);
      if (i === 0) t.tree(-22, 10); if (i === units.length - 1) t.tree(22, 10, 0.9);
    }
    if (i === 1) roofClutter(t, ctx, h, 6, 31);
  }
}

/** house: 단독 주택 하나에 마당, 담장, 나무. */
function buildHouse(t, ctx) {
  const rich = ctx.quality !== 'low', full = ctx.quality === 'high';
  // 단독이 아니라 다가구다. 3층에서 4층 사이이고 층마다 창이 반복된다.
  const floors = 3 + (hashInt(ctx.seed * 17) % 2);
  const h = floors * 3.1;
  const wall = pickOf(ctx.seed, 1, PALETTES.house);
  t.box('sand', 0, -2, 0, 15, h, 11, wall);
  t.box('stone', 0, -2, h, 15.6, 0.6, 11.6, '#cfcabb');
  if (rich) {
    t.door(0, 3.4, 0);
    const bands = windowBands(ctx.quality, floors);
    for (let f = 0; f < bands; f++) t.pane('glass', -4.2, 3.55, (f + 0.55) * h / bands, 4, 1.4);
    if (full) for (let f = 1; f < bands; f++) t.pane('glass', 4.2, 3.55, (f + 0.55) * h / bands, 4, 1.4);
    t.tree(9, 10, 0.85);
  }
  roofClutter(t, ctx, h, 5.5, 17);
  if (full) { t.fence(0, 15, 18, 0.3); t.fence(-9, 8, 0.3, 15); t.car(6, 9, pickOf(ctx.seed, 2, PALETTES.car)); t.tree(-9, -10, 0.7); }
}

/** shop: 저층 상가. 1층 유리면, 차양, 간판, 위층 창문. */
function buildShop(t, ctx) {
  const rich = ctx.quality !== 'low', full = ctx.quality === 'high';
  // 1층 상가에 위층은 주거인 상가주택이다. 4층에서 5층이라 길가에 벽면이 선다.
  const floors = 4 + (hashInt(ctx.seed * 41) % 2);
  const h = floors * 3.3;
  t.box('stone', 0, 0, 0, 14, h, 12, pickOf(ctx.seed, 3, PALETTES.house));
  t.box('accent', 0, 0, h, 14.6, 0.5, 12.6, '#8b9ea6');
  if (rich) {
    t.pane('glass', 0, 6.05, 2.6, 11, 3.6);
    t.door(4.6, 6.1, 0, 2, 3);
    t.canopy(0, 6.3, 3.2, 12, 1.8);
    t.sign(0, 6.4, 4.4, 9, 1, pickOf(ctx.seed, 4, PALETTES.shop));
    const bands = windowBands(ctx.quality, floors);
    for (let f = 1; f < bands; f++) t.pane('glass', 0, 6.05, (f + 0.5) * h / bands, 10, 1.5);
  }
  if (full) {
    for (let f = 1; f < floors; f++) t.pane('glass', -7.05, 0, (f + 0.5) * h / floors, 10, 1.3, -Math.PI / 2);
    t.tree(6.5, -5.5, 0.7);
  }
  roofClutter(t, ctx, h, 6, 41);
}

/** office: 소형 오피스. 층별 창문 띠, 옥상 설비. */
function buildOffice(t, ctx) {
  const rich = ctx.quality !== 'low', full = ctx.quality === 'high';
  const h = 16 + (hashInt(ctx.seed * 53) % 4) * 3;
  const floors = Math.min(4, Math.max(2, Math.floor(h / 4.4)));
  t.box('tint', 0, 0, 0, 18, h, 15);
  t.box('accent', 0, 0, h, 18.5, 0.5, 15.5, '#8b9ea6');
  if (rich) {
    for (let f = 0; f < floors; f++) t.pane('glass', 0, 7.55, (f + 0.6) * h / floors, 15, 1.5);
    t.door(0, 7.6, 0, 3, 3);
    t.box('steel', 0, -5, h - 0.6, 2, 1, 2);
  }
  if (full) {
    for (let f = 0; f < floors; f++) t.pane('glass', -9.05, 0, (f + 0.6) * h / floors, 12, 1.4, -Math.PI / 2);
    t.box('dark', 6, 0, h, 0.3, 3.6, 0.3);
    t.box('steel', 4, -5, h - 0.6, 2, 1, 2);
  }
}

/** apartment: 소형 아파트 동. 발코니 반복, 옥상 물탱크. */
function buildApartment(t, ctx) {
  const rich = ctx.quality !== 'low', full = ctx.quality === 'high';
  const h = 18 + (hashInt(ctx.seed * 61) % 4) * 4;
  t.box('stone', 0, 0, 0, 20, h, 13, pickOf(ctx.seed, 5, PALETTES.apartment));
  t.box('accent', 0, 0, h, 20.5, 0.5, 13.5, '#8b9ea6');
  if (rich) {
    const floors = Math.min(5, Math.max(2, Math.floor(h / 3.6)));
    for (let f = 0; f < floors; f++) {
      const y = (f + 0.55) * h / floors;
      t.pane('glass', 0, 6.55, y, 17, 1.4);
      t.box('steel', 0, 6.8, y - 0.75, 17.4, 0.14, 0.5);
    }
    t.door(0, 6.6, 0, 2.6, 3);
    t.tank(-7, 0, h);
  }
  if (full) {
    const floors = Math.min(5, Math.max(2, Math.floor(h / 3.6)));
    for (let f = 0; f < floors; f++) t.pane('glass', 0, -6.55, (f + 0.55) * h / floors, 17, 1.3, Math.PI);
    t.tree(11, 8, 0.8); t.tree(-11, 8, 0.75);
  }
}

/** warehouse: 낮고 긴 창고. 셔터 문, 지붕 채광창, 야적 팔레트. */
function buildWarehouse(t, ctx) {
  const rich = ctx.quality !== 'low', full = ctx.quality === 'high';
  const h = 8 + (hashInt(ctx.seed * 71) % 2) * 1.6;
  t.box('sand', 0, 0, 0, 34, h, 18, pickOf(ctx.seed, 6, PALETTES.warehouse));
  t.box('accent', 0, 0, h, 34.5, 0.4, 18.5, '#8b9ea6');
  if (rich) {
    t.box('dark', -8, 9, 0, 8, h - 1.4, 0.3);
    t.box('stone', 12, -9, 0, 10, 3.4, 6);
    t.box('accent', -8, 9, h, 8.4, 0.05, 0.6, '#c9ced3');
  }
  if (full) { t.box('dark', 6, 9, 0, 8, h - 1.4, 0.3); t.box('steel', -14, 0, h, 1.6, 0.8, 1.6); t.box('steel', 14, 0, h, 1.6, 0.8, 1.6); t.fence(0, -9.6, 30, 0.3); }
}

/** market: 재래시장 아케이드. 차양 열, 좌판, 기둥. */
function buildMarket(t, ctx) {
  const rich = ctx.quality !== 'low', full = ctx.quality === 'high';
  t.box('sand', 0, 0, 0, 30, 1, 12, '#d9d3bd');
  t.box('roof', 0, 3.6, 0, 32, 0.4, 13);
  if (rich) {
    for (const cx of [-12, -4, 4, 12]) t.cyl('stone', cx, -5.5, 0, 0.4, 3.4);
    t.box('accent', 0, 3.7, 0, 32.4, 0.3, 13.4, pickOf(ctx.seed, 7, PALETTES.market));
    for (const cx of [-9, -3, 3, 9]) t.box('wood', cx, 4, 1, 5, 0.7, 4, pickOf(ctx.seed, cx, PALETTES.market));
  }
  if (full) { for (const cx of [-9, -3, 3, 9]) t.box('accent', cx, 4, 1.4, 4.6, 0.4, 3.6, pickOf(ctx.seed, cx + 1, PALETTES.market)); t.tank(13, 5, 0); }
}

/** parking: 주차장. 구획선과 주차된 차, 가로등. */
function buildParking(t, ctx) {
  const rich = ctx.quality !== 'low', full = ctx.quality === 'high';
  t.box('pavement', 0, 0, 0, 30, 0.4, 24, '#c9c6b8');
  t.box('dark', -12, -10, 0.4, 4, 2, 3);
  if (rich) {
    for (let i = 0; i < 3; i++) t.box('marking', -8 + i * 8, 0, 0.42, 0.2, 0.05, 8);
    t.car(-8, -2, pickOf(ctx.seed, 8, PALETTES.car));
    t.car(0, -2, pickOf(ctx.seed, 9, PALETTES.car));
  }
  if (full) { t.car(8, -2, pickOf(ctx.seed, 10, PALETTES.car)); t.car(-8, 6, pickOf(ctx.seed, 11, PALETTES.car)); t.lampPost(11, 9); t.box('dark', -12, 8, 0.4, 3, 0.9, 0.3); }
}

/** gas: 주유소. 캐노피, 주유기, 작은 사무동. */
function buildGas(t, ctx) {
  const rich = ctx.quality !== 'low', full = ctx.quality === 'high';
  t.box('stone', -10, -6, 0, 8, 4.4, 7, pickOf(ctx.seed, 12, PALETTES.house));
  t.canopy(6, 0, 4.6, 16, 12, pickOf(ctx.seed, 13, PALETTES.gas));
  if (rich) {
    t.box('dark', 6, 0, 4.6, 0.35, 0.35, 0.35);
    t.box('dark', 0, -4, 0, 0.7, 1.6, 0.7); t.box('dark', 0, 4, 0, 0.7, 1.6, 0.7);
    t.box('accent', 12, 0, 4.6, 0.35, 0.35, 0.35);
  }
  if (full) { t.box('steel', 0, -4, 1.6, 0.9, 0.7, 0.4); t.box('steel', 0, 4, 1.6, 0.9, 0.7, 0.4); t.car(6, -3.6, pickOf(ctx.seed, 14, PALETTES.car)); }
}

/** pocketPark: 쌈지 공원. 잔디, 나무, 벤치, 산책로. */
function buildPocketPark(t, ctx) {
  const rich = ctx.quality !== 'low', full = ctx.quality === 'high';
  t.box('green', 0, 0, 0, 24, 0.3, 24, '#9ab383');
  t.box('sand', 0, 0, 0.3, 4, 0.1, 20);
  if (rich) { t.tree(-7, -7, 0.9); t.tree(7, -7, 0.85); t.bench(-4, 4); }
  if (full) { t.tree(-7, 7, 0.8); t.tree(7, 7, 0.9); t.bench(4, 4, Math.PI); t.hedge(0, -10.5, 20, 0.8); }
}

/** playground: 놀이터. 모래밭, 미끄럼틀, 그네 틀, 울타리. */
function buildPlayground(t, ctx) {
  const rich = ctx.quality !== 'low', full = ctx.quality === 'high';
  t.box('sand', 0, 0, 0, 22, 0.3, 22, '#dccf9e');
  t.box('dark', 0, 0, 0.3, 22.4, 0.15, 0.3);
  if (rich) {
    t.box('accent', -5, -5, 0.3, 1.6, 2, 1.6, '#a8574f'); t.box('accent', -5, -1, 0.3, 1.6, 0.9, 3.2, '#a8574f');
    t.box('dark', 5, -5, 0.3, 0.16, 2.2, 0.16); t.box('dark', 5, -1, 0.3, 0.16, 2.2, 0.16); t.box('wood', 5, -3, 2.1, 3, 0.16, 0.5);
  }
  if (full) { t.box('dark', 8, 6, 0.3, 3, 0.16, 0.5); t.fence(0, 11, 22, 0.3); t.fence(0, -11, 22, 0.3); t.tree(-8, 7, 0.7); }
}

/** yard: 공터 또는 자재 야적장. 낮은 더미, 컨테이너, 울타리. */
function buildYard(t, ctx) {
  const rich = ctx.quality !== 'low', full = ctx.quality === 'high';
  t.box('ground', 0, 0, 0, 26, 0.2, 26, '#a89c86');
  t.box('dark', -6, -6, 0.2, 6, 1.4, 4, pickOf(ctx.seed, 15, PALETTES.bin));
  if (rich) { t.box('dark', 4, 4, 0.2, 5, 1.1, 3.4, pickOf(ctx.seed, 16, PALETTES.bin)); t.fence(0, 13, 26, 0.3); }
  if (full) { t.box('dark', -4, 6, 0.2, 4, 1.6, 2.4, pickOf(ctx.seed, 17, PALETTES.bin)); t.fence(13, 0, 0.3, 26); t.hedge(-10, -9, 5, 1); }
}

/** cornerShop: 골목 모퉁이 근린상가. 두 면 모두 유리 정면과 문을 내 코너 상가로 읽히게 한다.
 * 위층은 살림집 창문이라 근린생활시설(1층 상가, 위층 주거) 형태다.
 */
function buildCornerShop(t, ctx) {
  const rich = ctx.quality !== 'low', full = ctx.quality === 'high';
  // 모퉁이 근린상가도 4층 안팎이다.
  const floors = 3 + (hashInt(ctx.seed * 83) % 2);
  const h = floors * 3.2;
  const wall = pickOf(ctx.seed, 20, PALETTES.cornerShop);
  t.box('brick', 0, 0, 0, 12, h, 12, wall);
  t.box('accent', 0, 0, h, 12.5, 0.4, 12.5, '#8b9ea6');
  if (rich) {
    t.pane('glass', 0, 6.05, 2.4, 8, 3);
    t.pane('glass', 6.05, 0, 2.4, 8, 3, Math.PI / 2);
    t.door(3.4, 6.1, 0, 1.8, 2.6);
    t.sign(0, 6.2, 3.6, 6, 0.9, pickOf(ctx.seed, 21, PALETTES.shop));
  }
  if (full) {
    t.pane('glass', 0, -6.05, h * 0.62, 6, 1.4, Math.PI);
    t.pane('glass', -6.05, 0, h * 0.62, 6, 1.4, -Math.PI / 2);
    t.box('steel', -4, -4, h - 0.4, 1.4, 0.9, 1.4);
  }
  roofClutter(t, ctx, h, 6, 83);
}

/** parkShop: 공원 산책로 가장자리의 작은 카페·편의점. 간판과 유리 정면은 모든 품질에서 남긴다. */
function buildParkShop(t, ctx) {
  const wall = pickOf(ctx.seed, 32, PALETTES.cornerShop);
  const sign = pickOf(ctx.seed, 33, PALETTES.shop);
  t.box('stone', 0, 0, 0, 12, 7.2, 9, wall);
  t.box('roof', 0, 0, 7.2, 13, 0.45, 10, '#8b9ea6');
  t.pane('glass', -1.5, 4.56, 2.55, 7.5, 3.5);
  t.door(4.3, 4.6, 0, 1.9, 2.8);
  t.canopy(0, 5.1, 3.65, 12, 1.8, sign);
  t.sign(0, 4.72, 5.15, 9, 1.05, sign);
  if (ctx.quality !== 'low') {
    t.pane('glass', 0, 4.56, 6.25, 8, 1.15);
    t.pane('glass', 6.06, 0, 2.55, 5.8, 3, Math.PI / 2);
  }
  if (ctx.quality === 'high') t.box('steel', -3.8, -2.5, 7.65, 1.4, .85, 1.2);
}

/** streetShop: 도로변 근린상가. 한 동에 상점 두세 칸이 늘어서고 위층은 반복되는 주거 창이다. */
function buildStreetShop(t, ctx) {
  const rich = ctx.quality !== 'low', full = ctx.quality === 'high';
  // 도로변 근린상가는 상가주택과 같은 4~5층이다.
  const floors = 4 + (hashInt(ctx.seed * 97) % 2);
  const h = floors * 3.2;
  const wall = pickOf(ctx.seed, 22, PALETTES.streetShop);
  t.box('stone', 0, 0, 0, 22, h, 12, wall);
  t.box('accent', 0, 0, h, 22.5, 0.4, 12.5, '#8b9ea6');
  if (rich) {
    t.pane('glass', 0, 6.05, 2.6, 19, 3.4);
    t.door(-6.5, 6.1, 0, 1.8, 2.6);
    t.door(6.5, 6.1, 0, 1.8, 2.6);
    t.sign(-6.5, 6.2, 4, 6, 0.9, pickOf(ctx.seed, 23, PALETTES.shop));
    t.sign(6.5, 6.2, 4, 6, 0.9, pickOf(ctx.seed, 24, PALETTES.shop));
  }
  if (full) {
    for (let f = 0; f < 2; f++) t.pane('glass', -6 + f * 12, 6.05, h * 0.7, 4.4, 1.4);
    t.canopy(0, 6.5, 3.6, 20, 1.4);
    for (let f = 1; f < floors; f++) t.pane('glass', 0, -6.05, (f + 0.5) * h / floors, 16, 1.2, Math.PI);

  }
  roofClutter(t, ctx, h, 6, 97);
}

/** complexShop: 여러 층 상가 건물. 층마다 다른 간판 띠와 통유리를 둬 백화점형 파사드를 낸다. */
function buildComplexShop(t, ctx) {
  const rich = ctx.quality !== 'low', full = ctx.quality === 'high';
  const h = 13 + (hashInt(ctx.seed * 103) % 3) * 3.2;
  const floors = Math.min(4, Math.max(2, Math.floor(h / 4)));
  t.box('tint', 0, 0, 0, 20, h, 16);
  t.box('accent', 0, 0, h, 20.5, 0.4, 16.5, '#8b9ea6');
  if (rich) {
    for (let f = 0; f < floors; f++) {
      const y = (f + 0.5) * h / floors;
      t.pane('glass', 0, 8.05, y, 17, h / floors - 0.6);
      t.sign(0, 8.15, y - h / floors / 2 + 0.4, 17.4, 0.6, pickOf(ctx.seed, 25 + f, PALETTES.shop));
    }
    t.door(0, 8.1, 0, 3, 3);
  }
  if (full) {
    for (let f = 0; f < floors; f++) t.pane('glass', -10.05, 0, (f + 0.5) * h / floors, 14, h / floors - 0.8, -Math.PI / 2);
    t.box('steel', 7, 5, h, 1.8, 1, 1.8);
  }
}

/** signBuilding: 모텔, 노래방 같은 간판이 겹겹이 붙는 잡거빌딩. sign 재질은 야간에
 * 발광해 서울 상업지 특유의 간판 인상을 낸다.
 */
function buildSignBuilding(t, ctx) {
  const rich = ctx.quality !== 'low', full = ctx.quality === 'high';
  const h = 12 + (hashInt(ctx.seed * 113) % 3) * 2.8;
  t.box('stone', 0, 0, 0, 14, h, 13, pickOf(ctx.seed, 26, PALETTES.signBuilding));
  t.box('accent', 0, 0, h, 14.5, 0.4, 13.5, '#8b9ea6');
  if (rich) {
    t.pane('glass', 0, 6.55, 4, 11, h - 6);
    t.sign(7.2, 3, h * 0.5, 0.5, h - 3, pickOf(ctx.seed, 27, PALETTES.shop));
    t.sign(0, 6.7, h + 1.6, 8, 2.4, pickOf(ctx.seed, 28, PALETTES.shop));
  }
  if (full) {
    t.sign(-7.2, 1, h * 0.4, 0.5, h * 0.7, pickOf(ctx.seed, 29, PALETTES.shop));
    t.sign(0, 6.8, h * 0.3, 9, 1.4, pickOf(ctx.seed, 30, PALETTES.shop));
    t.door(0, 6.6, 0, 2.4, 3);
  }
}

const BUILDERS = {
  rowhouse: buildRowhouse, house: buildHouse, shop: buildShop, office: buildOffice,
  apartment: buildApartment, warehouse: buildWarehouse, market: buildMarket,
  parking: buildParking, gas: buildGas, pocketPark: buildPocketPark,
  playground: buildPlayground, yard: buildYard,
  cornerShop: buildCornerShop, streetShop: buildStreetShop,
  complexShop: buildComplexShop, signBuilding: buildSignBuilding, parkShop: buildParkShop,
};

// 먼 거리용 윤곽. 종류마다 상자 한두 개로 덩어리만 낸다.
const SILHOUETTES = {
  rowhouse: (t) => { t.box('brick', 0, 0, 0, 40, 7.5, 15, '#c7b9a0'); t.shape('roof', 0, 0, 7.5, 40, 2.4, 15, 'gable'); },
  house: (t) => { t.box('sand', 0, -2, 0, 15, 6, 11, '#d3cdbb'); t.shape('roof', 0, -2, 6, 16, 2.6, 12, 'gable'); },
  shop: (t) => { t.box('stone', 0, 0, 0, 14, 8, 12, '#c9c2ad'); t.box('accent', 0, 0, 8, 14.6, 0.5, 12.6, '#8b9ea6'); },
  office: (t) => { t.box('tint', 0, 0, 0, 18, 22, 15); t.box('accent', 0, 0, 22, 18.5, 0.5, 15.5, '#8b9ea6'); },
  apartment: (t) => { t.box('stone', 0, 0, 0, 20, 26, 13, '#d9d5c8'); t.box('accent', 0, 0, 26, 20.5, 0.5, 13.5, '#8b9ea6'); },
  warehouse: (t) => { t.box('sand', 0, 0, 0, 34, 9, 18, '#8b9199'); t.box('accent', 0, 0, 9, 34.5, 0.4, 18.5, '#8b9ea6'); },
  market: (t) => { t.box('sand', 0, 0, 0, 30, 1, 12, '#d9d3bd'); t.box('roof', 0, 3.6, 0, 32, 0.4, 13); },
  parking: (t) => { t.box('pavement', 0, 0, 0, 30, 0.4, 24, '#c9c6b8'); },
  gas: (t) => { t.box('stone', -10, -6, 0, 8, 4.4, 7, '#d3cdbb'); t.canopy(6, 0, 4.6, 16, 12, '#c97b52'); },
  pocketPark: (t) => { t.box('green', 0, 0, 0, 24, 0.3, 24, '#9ab383'); },
  playground: (t) => { t.box('sand', 0, 0, 0, 22, 0.3, 22, '#dccf9e'); },
  yard: (t) => { t.box('ground', 0, 0, 0, 26, 0.2, 26, '#a89c86'); },
  cornerShop: (t) => { t.box('brick', 0, 0, 0, 12, 9, 12, '#b98f6a'); t.box('accent', 0, 0, 9, 12.5, 0.4, 12.5, '#8b9ea6'); },
  streetShop: (t) => { t.box('stone', 0, 0, 0, 22, 10, 12, '#b98f52'); t.box('accent', 0, 0, 10, 22.5, 0.4, 12.5, '#8b9ea6'); },
  complexShop: (t) => { t.box('tint', 0, 0, 0, 20, 16, 16); t.box('accent', 0, 0, 16, 20.5, 0.4, 16.5, '#8b9ea6'); },
  signBuilding: (t) => { t.box('stone', 0, 0, 0, 14, 15, 13, '#8f8577'); t.box('accent', 0, 0, 15, 14.5, 0.4, 13.5, '#8b9ea6'); },
  parkShop: (t) => { t.box('stone', 0, 0, 0, 12, 7.2, 9, '#b98f6a'); t.box('roof', 0, 0, 7.2, 13, .45, 10); },
};

/** kind 건물 하나를 (x, z) 부지 중심에 세운다. options: {lot, rotation, quality, seed, color}. */
export function addNpcBuilding(add, kind, x, z, options = {}) {
  const build = BUILDERS[kind];
  if (!build) return;
  const lot = options.lot ?? NPC_LOT[kind] ?? 40;
  const rotation = options.rotation ?? 0;
  const quality = normalizeQuality(options.quality);
  const seed = Number.isFinite(options.seed) ? options.seed : 0;
  // 도면 폭을 자리에 맞춘다. 배율 상한을 둬 평면만 넓은 납작한 덩어리가 되지 않게 한다.
  const k = Math.min(MAX_FILL, lot / (NPC_PLAN[kind] ?? NPC_LOT[kind] ?? 40));
  const t = tools(add, x, z, rotation, k);
  build(t, { quality, seed, color: options.color });
}

/** 먼 타일용 윤곽. 상세 배치와 같은 lot/rotation 계약을 쓰되 부재는 한두 개다. */
export function addNpcSilhouette(add, kind, x, z, options = {}) {
  const build = SILHOUETTES[kind];
  if (!build) return;
  const lot = options.lot ?? NPC_LOT[kind] ?? 40;
  const rotation = options.rotation ?? 0;
  const k = lot / (NPC_LOT[kind] ?? 40);
  const t = tools(add, x, z, rotation, k);
  build(t);
}
