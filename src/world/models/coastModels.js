/** shared/coast.js 가 낸 해안 좌표(해변 띠, 파라솔, 잔교, 리조트 부지)를 배치
 * 데이터로 바꾸는 순수 모듈이다. add() 계약은 civicBuildings.js 와 같다:
 * add(material, [x,y,z], [w,hgt,d], owner, shape, rotation, color). owner 는
 * 언제나 null 이다. 장면에 연결하는 배선은 이 모듈이 맡지 않는다.
 */
import { LEVELS } from '../../../shared/elevation.js';

// 해변 두 변의 물가 방향이다. across 부호가 이 값과 같으면 물 쪽이다.
const WATER_SIGN = { south: 1, west: -1 };
const SAND_THICKNESS = 0.3;
// 육지에서 물가로 갈수록 옅어지는 모래색이다.
const SAND_BANDS = ['#c9a86a', '#ddc48c', '#f0e2bd'];
const PARASOL_COLORS = ['#d9534f', '#f0ad4e', '#4a90d9', '#5cb85c'];
const PALM_COUNT = { low: 2, medium: 3, high: 4 };
const PILE_STEP = 24;
const PILE_DROP = 3.4; // 말뚝이 물 아래로 더 내려가는 여유
const DECK_THICKNESS = 0.3;

// 좌표 기반 결정적 해시다. Math.random 대신 x, z 로 언제나 같은 값을 낸다.
function hash(seedX, seedZ) {
  let h = Math.imul(Math.trunc(seedX * 131 + seedZ * 977) ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 해변 띠 하나를 물가 쪽으로 옅어지는 두세 단 모래로 바꾼다. low 는 두 단이다. */
export function addBeach(add, strip, quality = 'high') {
  const bands = quality === 'low' ? 2 : 3;
  const colors = bands === 2 ? [SAND_BANDS[0], SAND_BANDS[2]] : SAND_BANDS;
  const sign = WATER_SIGN[strip.edge] ?? 1;
  const landAcross = -sign * (strip.width / 2);
  const waterAcross = sign * (strip.width / 2);
  const step = (waterAcross - landAcross) / bands;
  for (let i = 0; i < bands; i++) {
    const across = landAcross + step * (i + 0.5);
    const along = strip.angle === 0;
    const w = along ? strip.length : Math.abs(step);
    const d = along ? Math.abs(step) : strip.length;
    const x = along ? strip.x : strip.x + across;
    const z = along ? strip.z + across : strip.z;
    add('sand', [x, strip.top - SAND_THICKNESS / 2, z], [w, SAND_THICKNESS, d], null, 'box', 0, colors[i]);
  }
}

/** 파라솔과 선베드 둘이다. spot.parasol 이 거짓이면 선베드만 둔다.
 * low 에서는 우산(기둥, 캐노피)을 빼 잔장식을 줄인다. */
export function addParasol(add, spot, quality = 'high') {
  const rich = quality !== 'low';
  const { x, z, y } = spot;
  if (spot.parasol && rich) {
    const color = PARASOL_COLORS[Math.floor(hash(x, z) * PARASOL_COLORS.length)];
    add('wood', [x, y + 1.1, z], [0.16, 2.2, 0.16], null, 'cylinder', 0, '#8a6a45');
    add('accent', [x, y + 2.3, z], [1.8, 0.9, 1.8], null, 'cone', 0, color);
  }
  const rotation = spot.rotation ?? 0;
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  for (const side of [-1, 1]) {
    const bx = x + cos * side * 1.3;
    const bz = z + sin * side * 1.3;
    add('accent', [bx, y + 0.25, bz], [0.8, 0.4, 2.2], null, 'box', rotation, '#f4f2ec');
  }
}

/** 잔교 하나다. 데크는 지면 높이로 물 위까지 뻗고 말뚝은 물 아래로 내려간다.
 * low 는 말뚝 간격을 늘리고 옆줄을 빼며 난간을 없앤다. */
export function addPier(add, pier, quality = 'high') {
  const rich = quality !== 'low';
  const { from, to, width, deck } = pier;
  const dx = to.x - from.x, dz = to.z - from.z;
  const length = Math.hypot(dx, dz) || 1;
  const alongX = Math.abs(dx) >= Math.abs(dz);
  const midX = (from.x + to.x) / 2, midZ = (from.z + to.z) / 2;

  const w = alongX ? length : width;
  const d = alongX ? width : length;
  add('wood', [midX, deck - DECK_THICKNESS / 2, midZ], [w, DECK_THICKNESS, d], null, 'box', 0, '#8a6a45');

  const pileTop = deck - DECK_THICKNESS;
  const pileBottom = LEVELS.WATER - PILE_DROP;
  const pileHeight = pileTop - pileBottom;
  const stations = Math.max(2, Math.round(length / (rich ? PILE_STEP : PILE_STEP * 1.6)));
  const half = width / 2 - 0.6;
  const offsets = rich ? [-half, half] : [0];
  for (let i = 0; i < stations; i++) {
    const t = stations === 1 ? 0.5 : i / (stations - 1);
    const px = from.x + dx * t, pz = from.z + dz * t;
    for (const off of offsets) {
      const ox = alongX ? px : px + off;
      const oz = alongX ? pz + off : pz;
      add('wood', [ox, pileBottom + pileHeight / 2, oz], [0.5, pileHeight, 0.5], null, 'cylinder', 0, '#5b4632');
    }
  }

  if (rich) {
    const railHeight = 0.9;
    for (const off of [-width / 2 + 0.2, width / 2 - 0.2]) {
      const rx = alongX ? midX : midX + off;
      const rz = alongX ? midZ + off : midZ;
      const rw = alongX ? w : 0.15;
      const rd = alongX ? 0.15 : d;
      add('steel', [rx, deck + railHeight / 2, rz], [rw, railHeight, rd], null, 'box', 0, '#c9d1d6');
    }
  }
}

/** 리조트 부지 하나다. 본관, 수영장, 야자수로 채운다.
 * low 는 창을 빼고 야자수를 줄인다. */
export function addResort(add, plot, quality = 'high') {
  const rich = quality !== 'low';
  const { x, z, size } = plot;
  const half = size / 2;

  // 본관은 부지 남쪽(음의 z), 수영장은 북쪽(양의 z)에 둔다. 회전은 없다.
  const buildingWidth = size * 0.62, buildingDepth = size * 0.42;
  const bx = x, bz = z - half + buildingDepth / 2 + 6;
  add('stone', [bx, 6, bz], [buildingWidth, 12, buildingDepth], null, 'box', 0, '#e8e0cf');
  add('roof', [bx, 12.3, bz], [buildingWidth + 2, 0.6, buildingDepth + 2], null, 'box', 0, '#9c6b4a');
  if (rich) {
    for (let f = 0; f < 2; f++) {
      const y = 3 + f * 6;
      add('glass', [bx, y, bz + buildingDepth / 2 + 0.05], [buildingWidth - 8, 2.4, 0.2], null, 'pane', 0, undefined);
    }
  }

  const poolWidth = size * 0.5, poolDepth = size * 0.34;
  const pz = z + half - poolDepth / 2 - 8;
  add('bank', [x, 0.02, pz], [poolWidth + 3, 0.2, poolDepth + 3], null, 'box', 0, '#d8d2c2');
  add('water', [x, -0.4, pz], [poolWidth, 0.8, poolDepth], null, 'box', 0, undefined);

  const palmCount = PALM_COUNT[quality] ?? PALM_COUNT.high;
  for (let i = 0; i < palmCount; i++) {
    const angle = (i / palmCount) * Math.PI * 2;
    const r = half * 0.78;
    const px = x + Math.cos(angle) * r, pzz = z + Math.sin(angle) * r;
    add('wood', [px, 3, pzz], [0.9, 6, 0.9], null, 'trunk', 0, undefined);
    add('leaf', [px, 6.6, pzz], [4.2, 3.4, 4.2], null, 'tree', 0, undefined);
  }
}
