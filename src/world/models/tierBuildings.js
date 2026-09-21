import { addStoreSign } from './storefronts.js';
/** Second-generation creator buildings: tier-specific sets of models, wider lots and
 * rooftop/street detail. Pure data: emits parts through the caller's `part()`
 * (local X/Z, Y up, front = +Z, ground = 0). Shape/material keys must exist in
 * WorldScene.useResources; `EXTRA_SHAPES`/`EXTRA_MATERIALS` list the additions
 * over the first generation. h already includes tier/ELO multipliers.
 * Bronze, silver and gold carry eight models each (more Seoul residential variety at
 * the tiers with the most buildings on screen); the rest carry six. `variantCountOf`
 * is the single source for the per-tier count.
 * Diamond through grandmaster use the 84-unit lot, champion 132 (tower plus campus), the rest 68. Tower models are
 * authored at half scale: `tools()` doubles plan positions and masses wider than
 * PROP_LIMIT while props (posts, lamps, trees, cars, pane heights) keep their size.
 */
import { LARGE_TIERS, LOT, LOT_CHAMPION, LOT_LARGE, lotOf } from '../../../shared/lots.js';

// 부지 크기는 배치 격자와 공유한다. 여기서 다시 정의하면 두 값이 어긋난다.
export { LARGE_TIERS, LOT, LOT_CHAMPION, LOT_LARGE, lotOf };

const PROP_LIMIT = 2.5;
// 티어별 모델 배열이 없을 때(알 수 없는 티어)만 쓰는 대체값이다. 실제 개수는 variantCountOf 가 잰다.
export const MODELS_PER_TIER = 5;
// Champion tower plan centre inside the 132 lot; the campus occupies the east and south strips.
const CHAMPION_TOWER = [-22, -20];
/** 모델 도면을 그릴 때 기준으로 삼은 필지 폭이다. lots.js 의 값이 이보다 작아지면
 * 평면 좌표와 가로세로를 그 비율로 줄여 필지 밖으로 나가지 않게 한다. 높이는 ELO 가
 * 정하므로 줄이지 않는다. 등급별 도면 기준은 예전 LOT, LOT_LARGE, LOT_CHAMPION 이다. */
const PLAN_LOT = Object.freeze({ normal: 68, large: 84, champion: 132 });
const planLotOf = (tier) => (tier === 'champion' ? PLAN_LOT.champion
  : LARGE_TIERS.includes(tier) ? PLAN_LOT.large : PLAN_LOT.normal);
/** 일반 등급 도면의 축소 비율이다. 굵기 기준을 절대값으로 둔 곳이 같이 줄어들도록 내보낸다. */
export const PLAN_SCALE = LOT / PLAN_LOT.normal;
/** part() 인자 중 평면에 해당하는 x, z, w, d 만 k 배 한다. */
const planScaler = (part, k) => (k === 1 ? part
  : (mat, x, y, z, w, hgt, d, shape, rotation, color) => part(mat, x * k, y, z * k, w * k, hgt, d * k, shape, rotation, color));
// Neighborhood models fill the lot with low houses and ignore the ELO height.
export const LOW_RISE = { bronze: [0, 1, 2, 3, 4, 5, 6, 7], silver: [2, 3, 4, 5, 6], gold: [5, 6] };
// Complexes authored at full lot scale (no plan doubling): many small elements on one lot.
export const FULL_PLAN = { bronze: [0, 1, 2, 3, 4, 5, 6, 7], silver: [2, 3, 4, 5, 6], gold: [3, 5, 6], platinum: [4], diamond: [0, 1], master: [2], grandmaster: [2] };
export const EXTRA_SHAPES = ['cylinder', 'cone', 'pyramid', 'dome'];
export const EXTRA_MATERIALS = ['tint', 'steel'];
export const TIER_HEIGHT_RANGE = {
  bronze: [12, 30], silver: [18, 42], gold: [26, 56], platinum: [36, 76],
  diamond: [50, 100], master: [70, 150], grandmaster: [90, 190], champion: [110, 230],
};
export const BUILDING_NAMES = {
  bronze: ['상가 거리', '간판 상가 골목', '교외 주택가', '모텔과 주유소', '소형 창고 단지', '다세대 빌라 골목', '언덕길 계단 주택', '동네 목욕탕 골목'],
  silver: ['그리드 오피스', '발코니 레지던스', '타운하우스 거리', '빌라 단지', '쇼핑몰', '옥탑방 다가구 주택', '상가주택 거리', '학원 상가 빌딩'],
  gold: ['스텝 오피스', '부티크 호텔', '아케이드 타워', '컨벤션 센터', '백화점', '재래시장 아케이드', '필로티 빌라 스트리트', '오피스텔 타워'],
  platinum: ['그린 테라스 타워', '코트야드 타워', '캔틸레버 가든', '트윈 레지던스', '미술관과 전망탑', '스카이 라운지 타워'],
  diamond: ['대형 아파트 단지', '리조트 호텔', '크리스털 스파이어', '커튼월 오피스', '쇼핑 콤플렉스 타워', '천문대 타워'],
  master: ['스카이브리지 트윈', '그랜드 호텔', '카지노 리조트', '그랜드 게이트', '방송 타워', '컨벤션 트윈 타워'],
  grandmaster: ['그랜드 스카이브리지', '메트로폴리탄 호텔', '로열 카지노 리조트', '그랜드 아치', '미디어 타워', '로열 컨벤션 트윈'],
  champion: ['크라운 팰리스 HQ', '로열 비콘 팩토리', '글로벌 HQ 캠퍼스', '발전소', '링 캠퍼스', '우주센터 캠퍼스'],
};
const SIGN_COLORS = ['#e2574c', '#3d7cc9', '#f0c34c', '#4fae7a', '#f08a3c'];
const CHAMPION_ACCENT = '#FF6B5B';
const OCT = Math.PI / 8;

function tools(emit, budget, K = 1) {
  const rich = budget.floors > 3;
  const part = K === 1 ? emit : (mat, x, y, z, w, hgt, d, shape = 'box', rotation = 0, color) => {
    const keep = mat === 'car' || shape === 'tree' || shape === 'trunk';
    emit(mat, x * K, y, z * K, keep || w < PROP_LIMIT ? w : w * K, hgt, keep || d < PROP_LIMIT ? d : d * K, shape, rotation, color);
  };
  const box = (mat, x, z, base, w, hgt, d, color) => part(mat, x, base + hgt / 2, z, w, hgt, d, 'box', 0, color);
  const cyl = (mat, x, z, base, r, hgt, color) => part(mat, x, base + hgt / 2, z, r, hgt, r, 'cylinder', 0, color);
  const oct = (mat, x, z, base, r, hgt, rotation = OCT, color) => part(mat, x, base + hgt / 2, z, r, hgt, r, 'octagon', rotation, color);
  const cone = (mat, x, z, base, r, hgt, shape = 'cone', rotation = OCT, color) => part(mat, x, base + hgt / 2, z, r, hgt, r, shape, rotation, color);
  const cap = (x, z, y, w, d, t = 0.6) => box('accent', x, z, y, w, t, d);
  const floorsOf = (hgt, pitch = 3.3) => Math.min(budget.floors, Math.max(1, Math.floor(hgt / pitch)));
  const windows = (x, z, base, w, hgt, d, opts = {}) => {
    const { sides = 'fbrl', pane = 1.15, inset = 1.6, mat = 'glass', pitch = 3.3 } = opts;
    const floors = floorsOf(hgt, pitch);
    const ph = Math.min(pane, hgt / floors * 0.6);
    for (let f = 0; f < floors; f++) {
      const y = base + (f + 0.5) * hgt / floors;
      if (sides.includes('f')) part(mat, x, y, z + d / 2 + 0.03, Math.max(1, w - inset), ph, 1, 'pane', 0);
      if (sides.includes('b')) part(mat, x, y, z - d / 2 - 0.03, Math.max(1, w - inset), ph, 1, 'pane', Math.PI);
      if (sides.includes('r')) part(mat, x + w / 2 + 0.03, y, z, Math.max(1, d - inset), ph, 1, 'pane', Math.PI / 2);
      if (sides.includes('l')) part(mat, x - w / 2 - 0.03, y, z, Math.max(1, d - inset), ph, 1, 'pane', -Math.PI / 2);
    }
    return floors;
  };
  // Dark glass box with steel spandrel lines: the cheap skyscraper skin.
  const curtain = (x, z, base, w, hgt, d, mat = 'tint', pitch = 3.6) => {
    box(mat, x, z, base, w, hgt, d);
    const floors = floorsOf(hgt, pitch);
    for (let f = 1; f < floors; f++) box('steel', x, z, base + f * hgt / floors - 0.14, w + 0.2, 0.28, d + 0.2);
  };
  const pane = (mat, x, z, y, w, hgt, rotation = 0) => part(mat, x, y, z, w, hgt, 1, 'pane', rotation);
  const door = (x, z, base, w = 3, hgt = 3, rotation = 0) => part('dark', x, base + hgt / 2, z, w, hgt, K === 1 ? 0.16 : 0.9, 'box', rotation);
  const canopy = (x, z, y, w, d, mat = 'accent') => {
    box(mat, x, z, y, w, 0.35, d);
    for (const sx of [-1, 1]) box('dark', x + sx * (w / 2 - 0.4), z + d / 2 - 0.4, 0.6, 0.28, y - 0.6, 0.28);
  };
  const columns = (x, z, base, hgt, count, span, axis = 'x', r = 0.55) => {
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * span;
      cyl('stone', axis === 'x' ? x + offset : x, axis === 'x' ? z : z + offset, base, r, hgt);
    }
  };
  const tank = (x, z, base) => { box('dark', x, z, base, 2.2, 0.9, 2.2); cyl('steel', x, z, base + 0.9, 1.4, 2.2); cone('steel', x, z, base + 3.1, 1.45, 0.6); };
  // 날개 한 장은 폭 0.1 이라 옥상 높이에서 화소 하나에 못 미친다. 도시 전체에서 수백 개가 나온다.
  const ac = (x, z, base) => {
    box('steel', x, z, base, 1.6, 1.1, 1.6);
    box('dark', x, z, base + 1.1, 1.15, .06, 1.15);
  };
  const mast = (x, z, base, hgt) => { box('dark', x, z, base, 0.3, hgt, 0.3); box('lamp', x, z, base + hgt, 0.7, 0.7, 0.7); };
  const penthouse = (x, z, base, w, hgt, d) => { box('stone', x, z, base, w, hgt, d); box('dark', x, z + d / 2 + 0.04, base + hgt * 0.3, w * 0.55, hgt * 0.45, 0.1); };
  const helipad = (x, z, base, r) => { cyl('dark', x, z, base, r, 0.3); cyl('accent', x, z, base + 0.3, r * 0.82, 0.08); cyl('dark', x, z, base + 0.32, r * 0.62, 0.08); box('accent', x, z, base + 0.4, r * 0.7, 0.06, r * 0.2); };
  const sign = (x, z, y, w, hgt, color, rotation = 0) => addStoreSign(part, x, z, y, w, hgt, color, rotation);
  const hedge = (x, z, base, w, d) => box('green', x, z, base, w, 0.9, d);
  const tree = (x, z, base, size = 1) => { part('wood', x, base + 0.8, z, 0.35, 1.6, 0.35, 'trunk'); part('leaf', x, base + 1.6 + 1.2 * size, z, 1.9 * size, 2.5 * size, 1.9 * size, 'tree'); };
  const flag = (x, z, base, hgt = 6) => { box('dark', x, z, base, 0.2, hgt, 0.2); box('accent', x + 0.9, z, base + hgt - 1.2, 1.6, 1, 0.08); };
  const steps = (x, z, base, w, d, count = 3) => { for (let i = 0; i < count; i++) box('stone', x, z + i * d / count / 2, base, w - i * 1.2, 0.5 * (count - i), d - i * d / count); };
  const bench = (x, z) => { box('wood', x, z, 0.9, 3, 0.3, 1.2); box('wood', x, z - 0.55, 1.3, 3, 0.9, 0.2); };
  const lampPost = (x, z) => { box('dark', x, z, 0.5, 0.2, 4.6, 0.2); box('lamp', x, z, 5.1, 0.9, 0.5, 0.9); };
  const pergola = (x, z, base, w, d) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) box('wood', x + sx * (w / 2 - 0.3), z + sz * (d / 2 - 0.3), base, 0.3, 2.6, 0.3); box('wood', x, z, base + 2.6, w, 0.25, d); };
  const roofGarden = (x, z, base, w, d) => { box('green', x, z, base, w, 0.5, d); hedge(x, z - d / 2 + 0.5, base + 0.5, w, 0.8); if (rich) { tree(x - w / 4, z, base + 0.5, 0.7); tree(x + w / 4, z + d / 6, base + 0.5, 0.6); } };
  return { rich, budget, part, bench, box, cyl, oct, cone, cap, floorsOf, windows, curtain, pane, door, canopy, columns, tank, ac, mast, penthouse, helipad, sign, hedge, tree, flag, steps, lampPost, pergola, roofGarden };
}

const MODELS = {
  bronze: [
    (h, t) => { // Shopping street: two rows of small shops of varied width facing a street, alleys behind.
      const lift = h * 0.1, full = t.budget.floors >= 10;
      const perRow = full ? 9 : t.rich ? 7 : 6, widths = full ? [8, 6, 9, 6, 8, 7, 6, 9, 7] : t.rich ? [10, 8, 11, 9, 10, 9, 10] : [12, 10, 13, 11, 12, 10];
      t.box('pavement', 0, 0, 0, 68, 0.45, 15);
      t.box('road', 0, 0, 0.1, 68, 0.42, 8);
      for (let x = -30; x <= 30; x += 12) t.box('marking', x, 0, 0.52, 3.4, 0.04, 0.3);
      for (const [row, facing] of [[13.5, -1], [-13.5, 1]]) {
        let x = -33;
        for (let i = 0; i < perRow; i++) {
          const w = widths[i], cx = x + w / 2, index = (row > 0 ? 0 : perRow) + i, tall = 5.5 + (index % 3) * 2.2 + lift, front = row + facing * 6;
          x += w;
          const wall = ['#efe6d6', '#d9c5a3', '#c8d1c8', '#e3cfc2', '#ad7760', '#dcd6cf'][index % 6];
          t.box(index % 6 === 4 ? 'brick' : 'stone', cx, row, 0.6, w, tall, 12, index % 6 === 4 ? undefined : wall);
          t.pane('glass', cx, front + facing * 0.04, 1.9, w - 1.6, 2.2, facing < 0 ? Math.PI : 0);
          t.door(cx + w / 2 - 1.4, front + facing * 0.03, 0.6, 1.3, 2.6, facing < 0 ? Math.PI : 0);
          // 간판은 이 거리의 얼굴이라 낮은 품질에서도 남긴다. 차양과 층 창, 물탱크는 묶는다.
          t.sign(cx, front + facing * 0.18, 4.6, w - 1, 1.1, SIGN_COLORS[index % SIGN_COLORS.length], facing < 0 ? Math.PI : 0);
          if (t.rich) {
            t.box('accent', cx, front + facing * 0.9, 3.4, w - 0.6, 0.22, 1.8, SIGN_COLORS[(index + 1) % SIGN_COLORS.length]);
            const floors = Math.min(t.budget.floors, Math.max(1, Math.floor((tall - 5) / 2.8)));
            for (let f = 0; f < floors; f++) t.pane('glass', cx, front + facing * 0.04, 5.6 + (f + 0.5) * (tall - 5.6) / floors, w - 2.2, 1.1, facing < 0 ? Math.PI : 0);
          }
          t.cap(cx, row, 0.6 + tall, w + 0.15, 12.3, 0.45);
          if (t.rich && index % 3 === 0) t.tank(cx - w / 4, row - facing * 3, 1.05 + tall);
          else if (full && index % 2 === 1) t.ac(cx + w / 4, row - facing * 2, 1.05 + tall);
          if (full && index % 4 === 1) t.sign(cx + w / 2 + 0.2, front - facing * 2.5, tall * 0.55, 0.3, tall * 0.5, SIGN_COLORS[(index + 2) % SIGN_COLORS.length]);
        }
        const back = row - facing * 14;
        t.box('pavement', 0, back, 0, 66, 0.45, 8);
        if (full) for (const dx of [-16, 16]) t.box('dark', dx, back - facing * 2.5, 0.65, 2.2, 1.4, 1.4);
        if (full) for (const dx of [-16, 16]) { t.box('car', dx, back + facing * 1.2, 0.5, 2.1, 1.2, 4.2, dx < 0 ? '#bb785f' : '#65747d'); t.box('tint', dx, back + facing * 1.2, 1.7, 1.8, 0.7, 2.2); }
      }
      for (const [x, z, color] of t.rich ? [[-22, 2.6, '#7298a0'], [16, 2.6, '#bb785f']] : [[-16, 2.6, '#7298a0']]) { t.box('car', x, z, 0.5, 2.1, 1.2, 4.2, color); t.box('tint', x, z, 1.7, 1.8, 0.7, 2.2); }
      for (const x of t.rich ? [-28, 10] : [-20]) t.lampPost(x, (x / 9) % 2 ? 6 : -6);
      if (t.rich) for (const [x, z] of [[-31, 31], [31, 31], [-31, -31], [31, -31]]) t.tree(x, z, 0.6, 0.9);
    },
    (h, t) => { // Sign alley: four dense blocks of small mixed buildings around an alley cross, market plaza in one.
      const lift = h * 0.12, full = t.budget.floors >= 10;
      t.box('pavement', 0, 0, 0, 68, 0.45, 68, '#d3d2c8');
      t.box('road', 0, 0, 0.1, 6, 0.42, 68); t.box('road', 0, 0, 0.1, 68, 0.42, 6);
      const lots = [[-18, -18], [18, -18], [18, 18]];
      lots.forEach(([bx, bz], li) => {
        const plan = t.rich ? [[-7, -7, 14, 14], [8, -7, 12, 14], [0, 8, 26, 12]] : [[-7, 0, 14, 28], [8, 0, 12, 28]];
        plan.forEach(([dx, dz, w, d], i) => {
          const index = li * 4 + i, tall = 6 + (index % 4) * 2.4 + lift, x = bx + dx, z = bz + dz;
          const wall = ['#efe6d6', '#d9c5a3', '#c8d1c8', '#e3cfc2', '#dcd6cf'][index % 5];
          t.box(index % 5 === 3 ? 'brick' : 'stone', x, z, 0.6, w, tall, d, index % 5 === 3 ? undefined : wall);
          const face = bz < 0 ? z + d / 2 : z - d / 2, facing = bz < 0 ? 1 : -1, side = bx < 0 ? x + w / 2 : x - w / 2, sideRot = bx < 0 ? Math.PI / 2 : -Math.PI / 2;
          t.pane('glass', x, face + facing * 0.04, 1.9, w - 1.4, 2.2, facing < 0 ? Math.PI : 0);
          t.door(x - w / 2 + 1.3, face + facing * 0.03, 0.6, 1.3, 2.6, facing < 0 ? Math.PI : 0);
          const floors = Math.min(3, Math.max(1, Math.floor((tall - 4) / 2.6)));
          for (let f = 0; f < floors; f++) {
            const y = 4.4 + (f + 0.5) * (tall - 4.4) / floors;
            t.sign(x, face + facing * 0.18, y - 0.75, w - 1.2, 0.9, SIGN_COLORS[(index + f) % SIGN_COLORS.length], facing < 0 ? Math.PI : 0);
            t.pane('glass', x, face + facing * 0.04, y + 0.4, w - 2, 0.9, facing < 0 ? Math.PI : 0);
            if (full) t.sign(side + (bx < 0 ? 0.18 : -0.18), z, y - 0.75, d - 1.2, 0.9, SIGN_COLORS[(index + f + 2) % SIGN_COLORS.length], sideRot);
          }
          t.cap(x, z, 0.6 + tall, w + 0.15, d + 0.15, 0.45);
          if (index % 2 === 0 && full) t.tank(x + w / 4, z - d / 4, 1.05 + tall); else { t.box('stone', x - w / 4, z + d / 4, 1.05 + tall, 3, 2.4, 3); if (full) t.ac(x + w / 4, z + d / 4, 1.05 + tall); }
          if (full && index % 3 === 0) { for (const sx of [-1, 1]) t.box('dark', x + sx * 3, z, 1.05 + tall, 0.25, 3.2, 0.25); t.sign(x, z, 3.6 + tall, 7, 2, SIGN_COLORS[index % SIGN_COLORS.length]); }
        });
      });
      // Market plaza: canvas stalls, kiosk, benches.
      t.box('sand', -18, 18, 0.55, 28, 0.12, 28);
      const stalls = full ? [[-28, 10], [-20, 10], [-12, 10], [-28, 20], [-20, 20], [-12, 20], [-28, 28], [-20, 28]] : t.rich ? [[-26, 12], [-14, 12], [-20, 24]] : [[-22, 12], [-22, 26]];
      stalls.forEach(([x, z], i) => { for (const sx of [-1, 1]) t.box('wood', x + sx * 2.4, z, 0.6, 0.2, 3, 0.2); t.box('accent', x, z, 3.6, 5.8, 0.3, 3.4, SIGN_COLORS[i % SIGN_COLORS.length]); t.box('wood', x, z, 0.6, 5, 1, 2); });
      t.box('stone', -8, 30, 0.6, 5, 3.2, 4, '#e3cfc2'); t.sign(-8, 32.2, 3.9, 5, 0.9, SIGN_COLORS[3]);
      if (t.rich) { t.tree(-30, 31, 0.6, 1); t.tree(-6, 8, 0.6, 0.8); }
      for (const [x, z] of t.rich ? [[-4, 4], [4, -4], [4, 30], [-30, -4]] : [[4, -4], [-4, 30]]) t.lampPost(x, z);
      for (const [x, z, color] of t.rich ? [[8, 31, '#bb785f'], [-31, -8, '#7298a0'], [31, 8, '#d4b768']] : [[31, 8, '#d4b768']]) { t.box('car', x, z, 0.5, 2.1, 1.2, 4.2, color); t.box('tint', x, z, 1.7, 1.8, 0.7, 2.2); }
    },
    (h, t) => { // Suburb block: a residential street with detached houses on both sides, yards behind.
      const houseH = 5 + h * 0.06, walls = ['#f1e7d5', '#d9c9a8', '#c9d3c4', '#e6d3c6', '#d5dbe4', '#efe0b8', '#e9cfc0', '#cfd8cc'];
      // 낮은 품질에서는 굴뚝, 차양, 위층 창을 빼고 그만큼 집을 더 세운다. 멀리서 보면
      // 집 한 채의 장식보다 집이 몇 채 서 있는지가 도시를 채워 보이게 한다.
      const perSide = t.budget.floors >= 10 ? 6 : t.budget.floors >= 6 ? 6 : 6, step = 60 / perSide;
      t.box('pavement', 0, 0, 0, 68, 0.45, 14);
      t.box('road', 0, 0, 0.1, 68, 0.42, 8);
      for (let x = -30; x <= 30; x += 15) t.box('marking', x, 0, 0.52, 3.4, 0.04, 0.3);
      const full = t.budget.floors >= 10;
      for (const [row, facing] of [[13.5, -1], [-13.5, 1]]) for (let i = 0; i < perSide; i++) {
        const x = -30 + step * (i + 0.5), index = (row > 0 ? 0 : perSide) + i, wall = walls[index % walls.length];
        const front = row + facing * 5, roofTall = index % 2 ? 3 : 3.6;
        t.box('green', x, row + facing * 0.5, 0.4, step - 0.6, 0.25, 13);
        t.box('stone', x, row, 0.6, 8 * 3 / perSide, houseH, 9, wall);
        t.part('roof', x, 0.6 + houseH + roofTall / 2, row, 9 * 3 / perSide, roofTall, 10, 'gable', 0, index % 3 === 0 ? '#8a6a5c' : undefined);
        t.door(x - step * 0.18, front + facing * 0.02, 0.6, 1.6, 2.6, facing < 0 ? Math.PI : 0);
        if (t.rich) {
          if (index % 2 === 0) t.box('brick', x + step * 0.26, row - facing * 2, 0.6 + houseH, 1, roofTall + 0.8, 1);
          t.pane('glass', x + step * 0.18, front + facing * 0.04, 2.6, 2.4, 1.6, facing < 0 ? Math.PI : 0);
          if (full && houseH > 6.4) t.pane('glass', x, front + facing * 0.04, houseH - 1.4, step * 0.55, 1.3, facing < 0 ? Math.PI : 0);
          t.box('accent', x - step * 0.18, front + facing * 1.4, 3.4, step * 0.44, 0.3, 2.6, '#f7f3ea');
        }
        if (full) for (const sx of [-1, 1]) t.box('wood', x - 1.8 + sx * 1.9, front + facing * 2.5, 0.65, 0.25, 2.75, 0.25);
        t.box('sand', x + 3.6, row + facing * 2.5, 0.62, 2.8, 0.08, 7.4);
        if (t.rich) {
          if (index % 2 === 0) { t.box('stone', x + step * 0.54, row - facing * 1.5, 0.6, 2.8, 3.2, 5, wall); t.box('dark', x + step * 0.54, row - facing * 1.5 + facing * 2.52, 0.6, 2.2, 2.2, 0.1); }
          t.tree(x - step * 0.4, row - facing * 5, 0.65, 0.55 + (index % 3) * 0.15);
        }
        if (full) t.box('accent', x - 2.5, front + facing * 6.2, 0.65, step - 5, 0.8, 0.15, '#f7f3ea');
        if (full) t.box('dark', x + 5.2, front + facing * 6.4, 0.65, 0.3, 1.1, 0.3);
      }
      for (const s of [-1, 1]) { t.box('green', 0, s * 27, 0.4, 66, 0.25, 12); t.box('accent', 0, s * 21, 0.65, 66, 0.7, 0.15, '#f7f3ea'); }
      // 집을 두 배로 늘린 만큼 뒤뜰 잔 장식을 줄인다. 멀리서는 집 수가 먼저 보인다.
      const backTrees = full ? [[-27, 28], [11, 29], [-3, -28], [29, -27]] : t.rich ? [[-20, 29], [-3, -28]] : [[-20, 29]];
      for (const [i, [x, z]] of backTrees.entries()) t.tree(x, z, 0.65, 0.8 + (i % 3) * 0.2);
      if (full) { t.box('wood', 6, 30, 0.6, 3, 2.4, 2.4); t.box('roof', 6, 30, 3, 3.6, 1.2, 3, undefined); t.box('water', -20, -29, 0.6, 7, 0.2, 4); t.box('stone', -20, -29, 0.4, 8, 0.3, 5); }
      for (const [x, z, color] of full ? [[-20, 2.6, '#bb785f'], [24, 2.6, '#d4b768']] : [[-20, 2.6, '#bb785f']]) { t.box('car', x, z, 0.5, 2.1, 1.2, 4.2, color); t.box('tint', x, z, 1.7, 1.8, 0.7, 2.2); }
      t.lampPost(-33, 5.3); if (t.rich) t.lampPost(33, 5.3);
      if (t.rich) { t.box('accent', -32.6, -5.4, 0.6, 0.8, 1.6, 0.5, '#3d7cc9'); t.box('dark', 31.5, -5.6, 0.6, 1.6, 1.4, 1); }
    },
    (h, t) => { // Motel and gas station: roadside strip with a canopy forecourt, L-shaped motel, diner and pool.
      const lift = h * 0.08, full = t.budget.floors >= 10;
      t.box('pavement', 0, 28, 0, 68, 0.45, 12); t.box('road', 0, 29, 0.1, 68, 0.42, 7);
      for (let x = -30; x <= 30; x += 15) t.box('marking', x, 29, 0.52, 3.4, 0.04, 0.3);
      // Gas station.
      t.box('sand', -18, 8, 0.4, 30, 0.15, 24, '#cfcbc0');
      t.box('steel', -18, 10, 6.2, 24, 0.6, 14); t.box('accent', -18, 10, 6.8, 24.4, 0.5, 14.4, SIGN_COLORS[0]);
      for (const x of [-28, -8]) for (const z of [4, 16]) t.box('dark', x, z, 0.5, 0.4, 5.7, 0.4);
      for (const x of [-24, -18, -12]) { t.box('accent', x, 10, 0.55, 1.1, 1.9, 0.6, '#f4f2ec'); t.box('accent', x, 10, 2.45, 1.2, 0.3, 0.7, SIGN_COLORS[0]); }
      t.box('stone', -18, -6, 0.4, 12, 4.2, 8, '#efe6d6'); t.pane('glass', -18, -1.95, 2.2, 10, 2.4); t.door(-14, -1.95, 0.4, 1.4, 2.6);
      t.box('dark', -32, 22, 0.4, 0.5, 8, 0.5); t.box('lamp', -32, 22, 8.4, 4, 3, 0.4);
      // Motel wings with an outdoor walkway.
      const rooms = full ? 6 : t.rich ? 4 : 3, wingW = 36;
      t.box('stone', 10, -18, 0.4, wingW, 7 + lift, 10, '#e3cfc2');
      t.box('accent', 10, -12.2, 3.8 + lift / 2, wingW, 0.3, 2.4, '#f7f3ea'); t.box('dark', 10, -11.1, 4.2 + lift / 2, wingW, 0.9, 0.1);
      for (let i = 0; i < rooms; i++) { const x = 10 - wingW / 2 + (i + 0.5) * wingW / rooms; for (const y of [0.4, 4.1 + lift / 2]) { t.door(x - 1.6, -12.95, y, 1.2, 2.4); t.pane('glass', x + 1.4, -12.95, y + 1.6, 2, 1.2); } }
      t.cap(10, -18, 7.4 + lift, wingW + 0.2, 10.2, 0.4);
      t.box('stone', 28.5, 0, 0.4, 10, 7 + lift, 26, '#e3cfc2'); t.cap(28.5, 0, 7.4 + lift, 10.2, 26.2, 0.4);
      if (t.rich) for (let i = 0; i < 3; i++) for (const y of [0.4, 4.1 + lift / 2]) { t.door(23.45, -8 + i * 8, y, 1.2, 2.4, -Math.PI / 2); t.pane('glass', 23.45, -5 + i * 8, y + 1.6, 2, 1.2, -Math.PI / 2); }
      t.box('stone', -8, -18, 0.4, 8, 4.4, 10, '#efe6d6'); t.box('accent', -8, -12, 4.2, 9, 0.4, 3, SIGN_COLORS[2]); t.pane('glass', -8, -12.95, 2.2, 6, 2.2);
      t.box('dark', -2, -30, 0.4, 0.5, 9, 0.5); t.box('lamp', -2, -30, 9.4, 6, 2.6, 0.4);
      t.box('stone', 12, 6, 0.4, 12, 0.5, 8, '#ece4d3'); t.box('water', 12, 6, 0.9, 10, 0.2, 6);
      if (t.rich) { t.box('steel', 12, 10.5, 0.6, 14, 1.2, 0.15); for (const x of [8, 16]) t.box('accent', x, 2, 0.9, 1.6, 0.5, 3.2, '#f7f3ea'); }
      t.box('sand', 6, 16, 0.4, 44, 0.15, 10, '#cfcbc0');
      const cars = full ? [[-10, 16], [-2, 16], [6, 16], [14, 16], [22, 16]] : t.rich ? [[-6, 16], [6, 16], [18, 16]] : [[6, 16]];
      cars.forEach(([x, z], i) => { t.box('car', x, z, 0.5, 2.1, 1.2, 4.2, ['#eee8d8', '#bb785f', '#7298a0', '#d4b768', '#65747d'][i]); t.box('tint', x, z, 1.7, 1.8, 0.7, 2.2); });
      // Diner.
      t.box('stone', -22, -26, 0.4, 16, 4.6, 8, '#f4f2ec'); t.box('accent', -22, -26, 5, 16.4, 0.8, 8.4, SIGN_COLORS[0]); t.pane('glass', -22, -21.95, 2.4, 14, 2.4); t.box('lamp', -22, -21.8, 5.6, 8, 1, 0.3);
      for (const [x, z] of t.rich ? [[-33, -2], [-33, 26], [33, 26], [-2, 24]] : [[-33, 26], [33, 26]]) t.lampPost(x, z);
      if (t.rich) for (const [x, z] of [[31.5, -30], [22, -30], [-31.5, -31.5]]) t.tree(x, z, 0.4, 0.9);
    },
    (h, t) => { // Small warehouse estate: five sheds with roller doors, a container yard, trucks and a fence.
      const lift = h * 0.06, full = t.budget.floors >= 10;
      t.box('sand', 0, 0, 0.4, 68, 0.15, 68, '#cfcbc0');
      const sheds = [[-20, -18, 24, 16], [8, -18, 24, 16], [-22, 14, 20, 18], [2, 14, 22, 18], [24, 0, 14, 40]];
      sheds.forEach(([x, z, w, d], i) => {
        const tall = 6 + (i % 2) * 1.2 + lift, along = w >= d;
        t.box('stone', x, z, 0.4, w, tall, d, ['#dcdad3', '#cfd3d6', '#e0d6c8'][i % 3]);
        t.part('roof', x, 0.4 + tall + 1.2, z, along ? w + 0.4 : d + 0.4, 2.4, along ? d + 0.4 : w + 0.4, 'gable', along ? 0 : Math.PI / 2, '#8f9ea4');
        t.box('accent', x, z, tall - 0.6, w + 0.2, 1, d + 0.2, SIGN_COLORS[(i + 1) % SIGN_COLORS.length]);
        const face = along ? z + d / 2 : z - d / 2;
        if (along) for (const dx of [-w / 4, w / 4]) t.box('dark', x + dx, face + 0.05, 0.4, 5, 4.4, 0.4, '#8a9096'); else for (const dz of [-d / 4, d / 4]) t.box('dark', x - w / 2 - 0.05, z + dz, 0.4, 0.4, 4.4, 5, '#8a9096');
        if (t.rich) t.pane('glass', x + (along ? w / 2 - 3 : 0), along ? face + 0.06 : z + d / 2 + 0.06, 2.6, 3.6, 1.2);
        if (full) t.box('steel', x - w / 4, z - d / 4, 0.4 + tall + 1.2, 1.4, 1, 1.4);
      });
      const boxes = full ? [[-32, 0], [-28, 0], [-32, 4], [-28, 4], [-32, 8], [-24, 0]] : t.rich ? [[-32, 0], [-28, 0], [-32, 4]] : [[-32, 0]];
      boxes.forEach(([x, z], i) => t.box('accent', x, z, 0.55 + (i === 2 || i === 3 ? 2.5 : 0), 2.4, 2.5, 6, ['#d0473c', '#3d7cc9', '#4fae7a', '#f0c34c'][i % 4]));
      for (const [x, z, c] of t.rich ? [[-6, 0, '#eee8d8'], [12, 0, '#7298a0']] : [[-6, 0, '#eee8d8']]) { t.box('car', x, z, 0.5, 2.7, 1.7, 7.4, c); t.box('tint', x, z + 2.4, 1.6, 2.4, 1.1, 1.4); t.box('sand', x, z - 1, 0.5, 2.8, 2.7, 4.6); }
      t.box('stone', -30, 28, 0.4, 8, 4, 6, '#e0d6c8'); t.pane('glass', -30, 31.05, 2.2, 6, 1.6);
      t.cyl('steel', 30, 28, 0.4, 2.2, 5); t.part('steel', 30, 5.4, 28, 2.2, 1, 2.2, 'dome');
      for (const s of [-1, 1]) { t.box('steel', 0, s * 33.5, 0.4, 67, 1.4, 0.15); t.box('steel', s * 33.5, 0, 0.4, 0.15, 1.4, 67); }
      t.box('dark', -18, 33, 0.4, 0.3, 1.3, 0.3); t.box('accent', -22, 33, 1.6, 7, 0.25, 0.25, '#d0473c');
      for (const [x, z] of t.rich ? [[-12, 30], [20, 30], [-8, -30], [30, -30]] : [[-12, 30], [30, -30]]) t.lampPost(x, z);
    },
    (h, t) => { // Villa alley: attached low multi-family houses along a narrow pedestrian lane, flat roofs, gas meters, rooftop tanks.
      const lift = h * 0.08, full = t.budget.floors >= 10;
      const walls = ['#e6dcc9', '#cbb99a', '#d8c6b0', '#b9a488', '#e0d2ba', '#c7cfc4'];
      const perSide = full ? 8 : t.rich ? 7 : 6, step = 60 / perSide;
      t.box('pavement', 0, 0, 0, 68, 0.45, 8, '#cfc9b6');
      t.box('sand', 0, 0, 0.46, 68, 0.08, 2.4, '#b9b19a');
      for (const [row, facing] of [[8.5, -1], [-8.5, 1]]) {
        let x = -30;
        for (let i = 0; i < perSide; i++) {
          const w = step - 0.8, cx = x + w / 2, index = (row > 0 ? 0 : perSide) + i, tall = 6.4 + (index % 3) * 1.6 + lift;
          x += step;
          const wall = walls[index % walls.length], front = row + facing * 3.6;
          t.box('stone', cx, row, 0.6, w, tall, 8, wall);
          t.cap(cx, row, 0.6 + tall, w + 0.15, 8.3, 0.3);
          t.door(cx - w / 2 + 1.3, front + facing * 0.02, 0.6, 1.3, 2.4, facing < 0 ? Math.PI : 0);
          // 집 수를 늘린 만큼 층 창과 가스계량기는 품질로 묶는다.
          if (t.rich) {
            t.pane('glass', cx + w * 0.12, front + facing * 0.04, 2.6, w * 0.4, 1.4, facing < 0 ? Math.PI : 0);
            const floors = t.floorsOf(tall - 3.2, 2.7);
            for (let f = 0; f < floors; f++) t.pane('glass', cx, front + facing * 0.04, 3.4 + (f + 0.5) * (tall - 3.4) / floors, w - 1.6, 1.1, facing < 0 ? Math.PI : 0);
            t.box('dark', cx - w / 2 + 0.5, front + facing * 0.03, 1.2, 0.5, 0.7, 0.2);
          }
          if (index % 3 === 0) t.tank(cx, row - facing * 3.2, 0.6 + tall);
          else if (t.rich) t.box('dark', cx, row - facing * 3, 0.6 + tall, 1.6, 0.4, 1.6);
        }
      }
      for (const x of full ? [-24, -8, 8, 24] : [-16, 16]) t.tree(x, (x / 8) % 2 ? 12 : -12, 0.6, 0.6);
      for (const [x, z] of t.rich ? [[-6, 0], [6, 0]] : [[0, 0]]) t.box('dark', x, z, 0.5, 0.7, 1, 1.8);
      t.lampPost(-30, 5); if (t.rich) t.lampPost(30, -5);
    },
    (h, t) => { // Hillside steps: houses climb a stepped alley on rising ground, with retaining walls and rooftop tanks.
      const lift = h * 0.05, full = t.budget.floors >= 10;
      const rows = full ? 7 : t.rich ? 5 : 4, step = 60 / rows;
      const walls = ['#e2d6c2', '#c9b89a', '#d3c4ab', '#b7a487'];
      t.box('pavement', 0, 0, 0, 68, 0.45, 68, '#d0c9b6');
      for (let i = 0; i < rows; i++) {
        const z = -28 + step * (i + 0.5), base = 0.6 + i * (0.8 + lift * 0.15);
        t.box('stone', 0, z, 0, 8, base + 0.3, step - 1, '#c3bba5');
        t.box('stone', 0, z, base + 0.3, 4.4, 0.3, step - 1.4, '#dcd6c6');
        for (const side of [-1, 1]) {
          const x = side * (12 + (i % 2) * 2), tall = 6 + (i % 3) * 1.2 + lift, wall = walls[i % walls.length];
          t.box('stone', x, z, base + 0.3, 9, tall, step - 1.6, wall);
          t.cap(x, z, base + 0.3 + tall, 9.3, step - 1.3, 0.3);
          t.door(x - side * 2.8, z + side * (step / 2 - 1.4), base + 0.3, 1.3, 2.3, side < 0 ? -Math.PI / 2 : Math.PI / 2);
          t.pane('glass', x + side * 1.6, z, base + 0.3 + tall * 0.6, 4.4, 1.3, side < 0 ? -Math.PI / 2 : Math.PI / 2);
          if (i % 2 === 0) t.tank(x, z + (step / 2 - 2), base + 0.3 + tall);
          else if (t.rich) t.box('dark', x, z - 1, base + 0.3 + tall, 0.15, 1.1, 3);
        }
      }
      for (const x of full ? [-30, 30] : [-30]) t.tree(x, -30, 0.6, 0.7);
      t.lampPost(0, -32); if (t.rich) t.lampPost(0, 32);
    },
    (h, t) => { // Bathhouse alley: a brick public bath with a tall chimney, a laundry and stationery row, a corner store and a kiosk around a T-alley.
      const lift = Math.min(3, h * 0.08), full = t.budget.floors >= 10;
      t.box('pavement', 0, 0, 0, 68, 0.45, 68, '#d3d2c8');
      t.box('road', 0, 4, 0.1, 68, 0.42, 6); t.box('road', -10, -16, 0.1, 6, 0.42, 34);
      // 굴뚝이 이 골목에서 제일 높다. 저층 상한(24) 아래에 묶는다.
      t.box('brick', 12, -16, 0.6, 30, 7 + lift, 22);
      t.part('roof', 12, 0.6 + 7 + lift + 1.6, -16, 31, 3.2, 23.5, 'gable', 0, '#7f6355');
      t.pane('glass', 12, -4.95, 3, 14, 1.2); t.door(2, -4.95, 0.6, 1.6, 2.6);
      t.sign(12, -4.8, 5.6, 12, 1.4, SIGN_COLORS[1]);
      t.cyl('brick', 22, -24, 0.6, 1.5, 19.4 + lift); t.cyl('dark', 22, -24, 20 + lift, 1.7, 0.6);
      if (t.rich) { t.box('dark', 4, -24, 7.6 + lift, 6, 1.6, 4); t.box('steel', 20, -12, 7.6 + lift, 3, 1.2, 3); }
      t.tank(-1, -20, 7.6 + lift);
      if (full) for (let i = 0; i < 3; i++) t.box('dark', 27.5, -24 + i * 6, 0.6, 0.6, 3.4, 0.6);
      for (const [z, sign, wall] of [[-22, 2, '#e3cfc2'], [-8, 4, '#efe6d6']]) {
        t.box('stone', -22, z, 0.6, 16, 5.6, 11, wall);
        t.cap(-22, z, 6.2, 16.3, 11.3, 0.4);
        t.pane('glass', -13.95, z, 1.9, 8, 2.2, Math.PI / 2); t.door(-13.95, z + 3.8, 0.6, 1.3, 2.6, Math.PI / 2);
        t.sign(-13.8, z, 4.3, 9, 1, SIGN_COLORS[sign], Math.PI / 2);
        if (t.rich) t.pane('glass', -13.95, z, 4.9, 8, 0.9, Math.PI / 2);
        if (full) t.ac(-26, z + 3, 6.6);
      }
      if (t.rich) for (let i = 0; i < 3; i++) t.box('accent', -28 + i * 2.2, -13.6, 0.6, 1.4, 1.2, 0.2, ['#f7f3ea', '#3d7cc9', '#f0c34c'][i]);
      t.box('stone', -18, 18, 0.6, 24, 6.4 + lift * 0.5, 18, '#d9c5a3');
      t.cap(-18, 18, 7 + lift * 0.5, 24.3, 18.3, 0.4);
      t.pane('glass', -18, 8.95, 2, 16, 2.4, Math.PI); t.door(-9, 8.95, 0.6, 1.5, 2.6, Math.PI);
      t.sign(-18, 8.8, 4.8, 14, 1.2, SIGN_COLORS[0], Math.PI);
      if (t.rich) { t.box('accent', -18, 7.6, 3.6, 18, 0.22, 2.2, SIGN_COLORS[3]); t.box('stone', -26, 22, 7.2 + lift * 0.5, 4, 2.4, 4, '#d9c5a3'); }
      t.box('stone', 14, 16, 0.6, 20, 5.2, 14, '#c8d1c8');
      t.cap(14, 16, 5.8, 20.3, 14.3, 0.4);
      t.pane('glass', 14, 8.95, 1.9, 12, 2, Math.PI); t.door(21, 8.95, 0.6, 1.3, 2.6, Math.PI);
      t.sign(14, 8.8, 4.2, 10, 1, SIGN_COLORS[4], Math.PI);
      if (t.rich) t.tank(10, 20, 5.8);
      t.box('sand', 14, 29, 0.55, 22, 0.12, 8);
      for (const [x, color] of full ? [[6, '#bb785f'], [14, '#eee8d8'], [22, '#7298a0']] : t.rich ? [[10, '#bb785f'], [20, '#7298a0']] : [[14, '#bb785f']]) { t.box('car', x, 29, 0.5, 2.1, 1.2, 4.2, color); t.box('tint', x, 29, 1.7, 1.8, 0.7, 2.2); }
      for (const [x, z] of t.rich ? [[-31, 31], [31, 31], [-31, -31]] : [[-31, 31]]) t.tree(x, z, 0.6, 0.8);
      t.lampPost(-30, 8); if (t.rich) { t.lampPost(30, 0); t.bench(-2, 30); }
    },
  ],
  silver: [
    (h, t) => { // Grid office: concrete frame, slab lines, mullions, mechanical roof.
      const bodyH = h - 1.6;
      t.box('stone', 0, 0, 0, 24, 0.6, 24);
      t.box('stone', 0, 0, 0.6, 20, bodyH, 20);
      t.pane('glass', 0, 10.05, 2.9, 16, 4); t.door(0, 10.1, 0.6, 3.4, 3.4);
      t.canopy(0, 11.9, 5, 12, 3.6);
      const floors = t.windows(0, 0, 5.6, 20, Math.max(2, bodyH - 5.6), 20, { inset: 1.2, pane: 1.5 });
      if (t.rich) {
        for (let f = 0; f <= floors; f++) t.box('stone', 0, 0, 5.6 + f * (bodyH - 5.6) / floors - 0.15, 20.5, 0.3, 20.5);
        for (const p of [-5, 0, 5]) { t.box('stone', p, 10.2, 5.6, 0.5, bodyH - 5.6, 0.3); t.box('stone', p, -10.2, 5.6, 0.5, bodyH - 5.6, 0.3); t.box('stone', 10.2, p, 5.6, 0.3, bodyH - 5.6, 0.5); t.box('stone', -10.2, p, 5.6, 0.3, bodyH - 5.6, 0.5); }
      }
      t.box('accent', 10.1, 10.1, 0.6, 0.7, bodyH + 0.3, 0.7);
      t.cap(0, 0, h - 1, 20.6, 20.6, 0.5);
      t.penthouse(-3, -3, h - 0.5, 8, 3.2, 6);
      t.mast(6, 5, h - 0.5, 4.5);
      t.tank(6, -6, h - 0.5);
      if (t.rich) { t.ac(-7, 6, h - 0.5); t.ac(-4.5, 6, h - 0.5); t.ac(-2, 6, h - 0.5); }
    },
    (h, t) => { // Balcony residence: long slab, balconies with dividers, roof garden.
      const bodyH = h - 1.6;
      t.box('stone', 0, 0, 0, 28, 0.6, 16);
      t.box('stone', 0, 0, 0.6, 26, bodyH, 12);
      for (const x of [-13.8, 13.8]) { t.box('stone', x, 0, 0.6, 3, bodyH + 0.6, 4); t.pane('glass', x, 2.05, bodyH / 2, 1.4, Math.max(1, bodyH - 3)); }
      const floors = t.windows(0, 0, 0.6, 26, bodyH, 12, { sides: 'fb', inset: 2, pane: 1.5 });
      for (let f = 0; f < floors; f++) {
        const y = 0.6 + (f + 0.5) * bodyH / floors;
        t.box('accent', 0, 7.1, y - 0.95, 26, 0.35, 2.2);
        t.box('dark', 0, 8.15, y - 0.6, 26, 0.8, 0.1);
        t.box('accent', 0, -6.6, y - 0.95, 26, 0.3, 1.2);
        if (t.rich) for (const x of [-9.75, -3.25, 3.25, 9.75]) t.box('stone', x, 7.1, y - 0.6, 0.25, 2.2, 2.2);
      }
      t.canopy(0, 7.6, 3.6, 8, 3); t.door(0, 6.05, 0.6, 3, 3);
      for (const x of [-8, 8]) t.hedge(x, 8.4, 0.6, 8, 1.2);
      t.cap(0, 0, h - 1, 26.6, 12.6, 0.5);
      t.box('stone', 4, -2, h - 0.5, 5, 3, 5);
      t.tank(-6, -3, h - 0.5);
      t.box('green', -4, 3, h - 0.5, 12, 0.6, 5); t.hedge(-4, 5.2, h + 0.1, 12, 0.7);
      if (t.rich) t.pergola(8, 3, h - 0.5, 6, 4);
    },
    (h, t) => { // Townhouse street: two rows of attached brownstones facing a shared street, garages behind.
      const rowH = 8 + h * 0.12, walls = ['#b9705c', '#d8c4a4', '#8f6a58', '#e2d6c2', '#a67b64', '#c4a98a', '#7f5a4b'];
      const perRow = t.budget.floors >= 10 ? 6 : t.budget.floors >= 6 ? 5 : 5, w = 62 / perRow, full = t.budget.floors >= 10;
      t.box('pavement', 0, 0, 0, 68, 0.45, 14);
      t.box('road', 0, 0, 0.1, 68, 0.42, 8);
      for (let x = -30; x <= 30; x += 15) t.box('marking', x, 0, 0.52, 3.4, 0.04, 0.3);
      for (const [row, facing] of [[13, -1], [-13, 1]]) {
        const front = row + facing * 6, back = row - facing * 6;
        t.box('green', 0, row - facing * 14.5, 0.4, 66, 0.25, 13);
        t.box('sand', 0, row - facing * 12, 0.55, 66, 0.12, 3);
        for (let i = 0; i < perRow; i++) {
          const x = -31 + w * (i + 0.5), index = (row > 0 ? 0 : perRow) + i, wall = walls[index % walls.length], tall = rowH + (index % 2 ? 0 : 1.2);
          t.box('stone', x, row, 0.6, w, tall, 12, wall);
          t.cap(x, row, 0.6 + tall, w + 0.2, 12.4, 0.5);
          if (full) { if (index % 2 === 0) t.box('stone', x, row, 1.1 + tall, w + 0.2, 0.9, 12.4, wall); else t.box('brick', x + w * 0.3, back + facing * 2, 1.1 + tall, 0.9, 2, 0.9); }
          if (t.rich && index % 2 === 0) t.box('stone', x + w * 0.2, front + facing * 1.05, 0.6, w * 0.42, tall * 0.45, 2.1, wall);
          if (full) t.pane('glass', x + w * 0.2, front + facing * 2.12, 0.6 + tall * 0.24, w * 0.34, 1.6, facing < 0 ? Math.PI : 0);
          // 연립을 늘린 만큼 현관 계단과 층 창을 품질로 묶는다. 문은 남겨야 집으로 읽힌다.
          if (t.rich) { t.box('stone', x - w * 0.26, front + facing * 0.6, 0.6, 2, 1.2, 1.6); t.box('stone', x - w * 0.26, front + facing * 1.3, 0.6, 2, 0.7, 1); }
          t.door(x - w * 0.26, front + facing * 0.02, t.rich ? 1.8 : 0.6, 1.5, 2.6, facing < 0 ? Math.PI : 0);
          const floors = t.rich ? t.floorsOf(tall - 4, 3.4) : 1;
          for (let f = 0; f < floors; f++) t.pane('glass', x, front + facing * 0.05, 4.6 + (f + 0.5) * (tall - 4.6) / floors, w - 1.8, 1.3, facing < 0 ? Math.PI : 0);
          if (t.rich) t.box('accent', x, front + facing * 1.05, 3.2 + tall * 0.45, w * 0.48, 0.3, 2.4, '#f7f3ea');
          if (full) { t.box('accent', x + w / 2, row - facing * 14, 0.65, 0.15, 0.9, 12, '#f7f3ea'); t.box('wood', x - 1.5, row - facing * 14.5, 0.6, 3, 0.4, 2); }
          if (i % 2 === 0 && (t.rich || i % 4 === 0)) { t.box('stone', x, row - facing * 19.4, 0.6, Math.min(5.6, w - 1), 3, 3, '#e8e3d6'); t.box('dark', x, row - facing * 19.4 + facing * 1.54, 0.6, Math.min(4.4, w - 2), 2.2, 0.1); }
        }
      }
      for (const [x, z, color] of t.rich ? [[-24, 2.6, '#d4b768'], [-6, -2.6, '#eee8d8'], [10, 2.6, '#65747d'], [26, -2.6, '#bb785f']] : [[-24, 2.6, '#d4b768'], [10, 2.6, '#65747d']]) { t.box('car', x, z, 0.5, 2, 1.2, 4.2, color); t.box('tint', x, z, 1.7, 1.7, 0.7, 2.2); }
      for (const x of full ? [-30, -18, -6, 6, 18, 30] : t.rich ? [-24, 0, 24] : [-24, 24]) t.tree(x, (x / 6) % 2 ? 5.6 : -5.6, 0.65, 0.7);
      t.lampPost(-12, 5.6); if (t.rich) { t.lampPost(12, -5.6); t.box('accent', 33, 5.6, 0.6, 0.8, 1.6, 0.5, '#3d7cc9'); t.box('dark', -33, -5.6, 0.6, 1.4, 1.5, 1.2); }
    },
    (h, t) => { // Villa estate: six pilotis villas in two rows with balconies, a playground and hedges.
      const villaH = 11 + h * 0.12, full = t.budget.floors >= 10;
      t.box('green', 0, 0, 0.4, 68, 0.25, 68, '#b9c9a4');
      t.box('sand', 0, 0, 0.6, 68, 0.12, 6); t.box('sand', 0, 0, 0.6, 6, 0.12, 68);
      const villas = t.rich ? [[-22, -18], [0, -18], [22, -18], [-22, 18], [0, 18], [22, 18]] : [[-22, -18], [22, -18], [-22, 18], [22, 18]];
      villas.forEach(([x, z], i) => {
        const wall = ['#efe9df', '#e4dfd6', '#dcd3c4'][i % 3], facing = z < 0 ? 1 : -1, front = z + facing * 5.5;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.box('stone', x + sx * 5, z + sz * 4.2, 0.6, 0.7, 3, 0.7);
        t.box('stone', x, z, 3.6, 13, villaH, 11, wall);
        t.box('stone', x + 4, z - facing * 3, 0.6, 3, 3, 3, wall);
        const floors = Math.min(full ? 4 : t.rich ? 3 : 2, Math.max(1, Math.floor(villaH / 3.2)));
        for (let f = 0; f < floors; f++) {
          const y = 3.6 + (f + 0.5) * villaH / floors;
          t.pane('glass', x, front + facing * 0.04, y, 10, 1.3, facing < 0 ? Math.PI : 0);
          t.box('accent', x, front + facing * 0.9, y - 0.95, 13, 0.3, 1.8);
          if (full) t.box('dark', x, front + facing * 1.75, y - 0.55, 13, 0.8, 0.1);
        }
        t.cap(x, z, 3.6 + villaH, 13.4, 11.4, 0.6);
        t.box('stone', x - 3, z - facing * 2, 4.2 + villaH, 4, 2.4, 4, wall);
        if (full) t.tank(x + 3.5, z + facing * 2, 4.2 + villaH);
        for (const [dx, c] of full ? [[-3, '#bb785f'], [1.5, '#eee8d8']] : [[-1, '#bb785f']]) { t.box('car', x + dx, z - facing * 1, 0.6, 2, 1.2, 4.2, c); t.box('tint', x + dx, z - facing * 1, 1.8, 1.7, 0.7, 2.2); }
        t.hedge(x, front + facing * 4.2, 0.6, 13, 0.9);
      });
      t.box('sand', 0, 0, 0.62, 16, 0.12, 12);
      t.box('dark', -4, 0, 0.7, 0.2, 2.6, 0.2); t.box('dark', 0, 0, 0.7, 0.2, 2.6, 0.2); t.box('wood', -2, 0, 3.3, 4.6, 0.2, 0.2);
      t.box('accent', 4.5, -2, 0.7, 1.4, 2.4, 1.4, '#f0c34c'); t.box('accent', 4.5, 1.5, 0.7, 1.2, 0.3, 5, '#f0c34c');
      if (t.rich) { t.bench(-11, 4); t.bench(11, -4); }
      for (const [x, z] of t.rich ? [[-32, -32], [32, -32], [-32, 32], [32, 32], [-11, -32], [11, 32]] : [[-32, -32], [32, 32]]) t.tree(x, z, 0.65, 1);
      for (const [x, z] of t.rich ? [[-12, -5], [12, 5], [-32, 5], [32, -5]] : [[12, 5]]) t.lampPost(x, z);
      for (const s of [-1, 1]) { t.box('steel', 0, s * 33.5, 0.4, 67, 1.2, 0.15); t.box('steel', s * 33.5, 0, 0.4, 0.15, 1.2, 67); }
    },
    (h, t) => { // Shopping mall: a wide low box with a glass entrance, sign pylon, roof plant and a big parking lot.
      const mallH = 9 + h * 0.08, full = t.budget.floors >= 10;
      t.box('sand', 0, 0, 0.4, 68, 0.15, 68, '#cfcbc0');
      t.box('stone', -6, -16, 0.6, 52, mallH, 30, '#e6e2da');
      t.box('accent', -6, -16, mallH - 1.6, 52.4, 2, 30.4);
      t.cap(-6, -16, 0.6 + mallH, 52.6, 30.6, 0.6);
      t.pane('glass', -6, -0.95, 3.6, 16, 6.4); t.door(-6, -0.9, 0.6, 5, 4.4);
      t.box('accent', -6, 2.4, 7.4, 20, 0.5, 7); for (const x of [-15, 3]) t.box('dark', x, 5.4, 0.6, 0.4, 6.8, 0.4);
      t.box('lamp', -6, -0.7, mallH - 1.6, 12, 1.4, 0.3);
      for (const x of full ? [-28, -18, 6, 14] : [-24, 10]) t.sign(x, -0.85, mallH * 0.45, 6, mallH * 0.5, SIGN_COLORS[(x + 30) % SIGN_COLORS.length | 0]);
      if (t.rich) for (let i = 0; i < (full ? 6 : 3); i++) t.box('steel', -26 + i * 8, -22, 1.2 + mallH, 3, 1.6, 3);
      t.box('dark', -27, -1.5, 0.6, 10, 3.4, 0.3, '#8a9096');
      t.box('dark', 30, 12, 0.4, 0.6, 12, 0.6); t.box('lamp', 30, 12, 12.4, 6, 4, 0.5); t.box('accent', 30, 12, 16.4, 6.4, 0.5, 0.9, SIGN_COLORS[0]);
      const rows = full ? 3 : t.rich ? 2 : 1;
      for (let r = 0; r < rows; r++) { const z = 10 + r * 9; if (t.rich) for (let x = -30; x <= 26; x += 4) t.box('marking', x, z, 0.56, 0.25, 0.04, 6); }
      const cars = full ? 12 : t.rich ? 6 : 3;
      for (let i = 0; i < cars; i++) { const x = -28 + (i % 6) * 10 + (Math.floor(i / 6) % 2) * 5, z = 10 + Math.floor(i / 6) * 9; t.box('car', x, z, 0.5, 2.1, 1.2, 4.2, ['#eee8d8', '#bb785f', '#7298a0', '#d4b768', '#65747d'][i % 5]); t.box('tint', x, z, 1.7, 1.8, 0.7, 2.2); }
      if (t.rich) for (const x of [-12, 4]) t.box('steel', x, 28, 0.6, 0.15, 1, 5);
      for (const [x, z] of t.rich ? [[-32, 8], [-32, 26], [0, 30], [24, 30]] : [[-32, 8], [24, 30]]) t.lampPost(x, z);
      if (t.rich) for (const [x, z] of [[-31.5, -31.5], [31.5, -31.5], [31.5, 0], [-31.5, 31.5]]) t.tree(x, z, 0.4, 1);
    },
    (h, t) => { // Multi-household houses: rooftop utility room and water tank crown each house, meter banks below.
      const houseH = 8 + h * 0.12, full = t.budget.floors >= 10;
      const walls = ['#e7ddca', '#cfc2a4', '#d8ccb6', '#b9ac8e', '#e2d8c3'];
      const perSide = full ? 6 : t.rich ? 5 : 3, step = 60 / perSide;
      t.box('pavement', 0, 0, 0, 68, 0.45, 16);
      t.box('road', 0, 0, 0.1, 68, 0.42, 7);
      for (let x = -30; x <= 30; x += 15) t.box('marking', x, 0, 0.52, 3, 0.04, 0.3);
      for (const [row, facing] of [[14, -1], [-14, 1]]) {
        let x = -30;
        for (let i = 0; i < perSide; i++) {
          const w = step - 2, cx = x + w / 2, index = (row > 0 ? 0 : perSide) + i, wall = walls[index % walls.length];
          x += step;
          const front = row + facing * 6;
          t.box('stone', cx, row, 0.6, w, houseH, 10, wall);
          t.cap(cx, row, 0.6 + houseH, w + 0.2, 10.3, 0.3);
          const floors = t.floorsOf(houseH - 2, 2.9);
          for (let f = 0; f < floors; f++) t.pane('glass', cx, front + facing * 0.04, 2 + (f + 0.5) * (houseH - 2) / floors, w - 1.6, 1.2, facing < 0 ? Math.PI : 0);
          t.door(cx - w / 2 + 1.2, front + facing * 0.02, 0.6, 1.3, 2.4, facing < 0 ? Math.PI : 0);
          t.box('dark', cx + w / 2 - 0.7, front + facing * 0.03, 1, 0.9, 1.4, 0.2);
          t.box('stone', cx - w * 0.2, row, 0.6 + houseH, w * 0.4, 2.4, 6, wall);
          // 물탱크는 삼각형이 비싸다(원기둥+원뿔). 세 채마다 하나만 세우고 나머지는 옥탑방만 남긴다.
          if (index % 3 === 0) t.tank(cx + w * 0.2, row - facing * 2, 0.6 + houseH + 2.4);
          if (t.rich) t.box('steel', cx, row - facing * 4.9, 0.6 + houseH, w - 0.6, 0.9, 0.15);
        }
      }
      for (const x of full ? [-30, -10, 10, 30] : t.rich ? [-20, 20] : [-15]) t.tree(x, (x / 10) % 2 ? 8 : -8, 0.65, 0.6);
      const cars = full ? [[-20, 3, '#bb785f'], [0, -3, '#eee8d8'], [20, 3, '#7298a0']] : t.rich ? [[-14, 3, '#bb785f']] : [];
      for (const [x, z, color] of cars) { t.box('car', x, z, 0.5, 2, 1.2, 4, color); t.box('tint', x, z, 1.7, 1.7, 0.7, 2.1); }
      t.lampPost(-33, 5.5); if (t.rich) t.lampPost(33, -5.5);
    },
    (h, t) => { // Shophouse street: tidy row of ground-floor shops with balconied apartments above, planter hedges.
      const bodyH = 7 + h * 0.11, full = t.budget.floors >= 10;
      const units = full ? 6 : t.rich ? 5 : 4, w = 60 / units;
      t.box('pavement', 0, 0, 0, 68, 0.45, 16);
      t.box('road', 0, 0, 0.1, 68, 0.42, 7);
      for (let x = -30; x <= 30; x += 15) t.box('marking', x, 0, 0.52, 3, 0.04, 0.3);
      for (const [row, facing] of [[13, -1], [-13, 1]]) {
        let x = -30;
        for (let i = 0; i < units; i++) {
          const cx = x + w / 2, index = (row > 0 ? 0 : units) + i, front = row + facing * 5;
          x += w;
          t.box('stone', cx, row, 0.6, w - 1, bodyH, 10, index % 2 ? '#e6e0d2' : '#dcd5c4');
          t.pane('glass', cx, front + facing * 0.04, 2.3, w - 2.4, 2.6, facing < 0 ? Math.PI : 0);
          t.door(cx + w / 2 - 2, front + facing * 0.03, 0.6, 1.4, 2.6, facing < 0 ? Math.PI : 0);
          t.box('accent', cx, front + facing * 1.2, 3.85, w - 1.6, 0.3, 1.4, SIGN_COLORS[index % SIGN_COLORS.length]);
          const floors = t.floorsOf(bodyH - 3.7, 2.8);
          for (let f = 0; f < floors; f++) {
            const y = 3.7 + (f + 0.5) * (bodyH - 3.7) / floors;
            t.pane('glass', cx, front + facing * 0.04, y, w - 2.8, 1.2, facing < 0 ? Math.PI : 0);
            if (t.rich) t.box('accent', cx, front + facing * 0.9, y - 0.85, w - 1.4, 0.25, 1.4, '#f7f3ea');
          }
          t.cap(cx, row, 0.6 + bodyH, w - 0.7, 10.3, 0.3);
          if (t.rich) t.hedge(cx - w / 3, front + facing * 1.7, 0.65, 1.4, 1.4);
        }
      }
      for (const [x, z, color] of full ? [[-18, 2.6, '#7298a0'], [4, -2.6, '#d4b768'], [22, 2.6, '#bb785f']] : t.rich ? [[-10, 2.6, '#7298a0']] : []) { t.box('car', x, z, 0.5, 2, 1.2, 4, color); t.box('tint', x, z, 1.7, 1.7, 0.7, 2.1); }
      t.lampPost(-30, 5.5); if (t.rich) t.lampPost(30, -5.5);
    },
    (h, t) => { // Cram-school building: a commercial block with a different academy sign on every floor, balconies at the back and a roof garden.
      const bodyH = h - 1.6, full = t.budget.floors >= 10;
      t.box('stone', 0, 0, 0, 26, 0.6, 22);
      t.box('stone', 0, -1, 0.6, 22, bodyH, 16, '#e6e0d2');
      t.pane('glass', 0, 7.05, 2.6, 18, 3.2); t.door(6, 7.1, 0.6, 2.6, 3.2);
      t.sign(0, 7.2, 4.9, 20, 1.2, SIGN_COLORS[2]);
      t.canopy(-4, 8.6, 4.2, 10, 3);
      const floors = t.windows(0, -1, 5.6, 22, Math.max(2, bodyH - 5.6), 16, { sides: 'f', inset: 3, pane: 1.4, pitch: 3.4 });
      // 층마다 다른 학원 간판이 이 건물의 얼굴이라 낮은 품질에서도 남긴다.
      for (let f = 0; f < floors; f++) {
        const y = 5.6 + (f + 0.5) * (bodyH - 5.6) / floors;
        t.sign(-5.5, 7.2, y - 1.2, 9, 1.1, SIGN_COLORS[f % SIGN_COLORS.length]);
        if (t.rich) t.sign(5.5, 7.2, y - 1.2, 9, 1.1, SIGN_COLORS[(f + 2) % SIGN_COLORS.length]);
      }
      if (t.rich) t.sign(11.2, -1, bodyH * 0.45 + 0.6, 0.3, bodyH * 0.6, SIGN_COLORS[0], Math.PI / 2);
      const backFloors = t.windows(0, -1, 5.6, 22, Math.max(2, bodyH - 5.6), 16, { sides: 'b', inset: 6, pane: 1.3, pitch: 3.4 });
      for (let f = 0; f < backFloors; f++) {
        const y = 5.6 + (f + 0.5) * (bodyH - 5.6) / backFloors;
        t.box('accent', 0, -9.9, y - 0.95, 22, 0.35, 1.8);
        if (full) t.box('dark', 0, -10.75, y - 0.6, 22, 0.8, 0.1);
      }
      t.box('accent', 11.1, -1, 0.6, 0.7, bodyH + 0.3, 0.7);
      t.cap(0, -1, h - 1, 22.6, 16.6, 0.5);
      t.box('green', -4, 1, h - 0.5, 12, 0.6, 8); t.hedge(-4, 4.6, h + 0.1, 12, 0.7);
      t.box('stone', 7, -4, h - 0.5, 6, 3, 5, '#e6e0d2');
      t.tank(-8, -5, h - 0.5);
      if (t.rich) { t.pergola(-4, 1, h + 0.1, 6, 4); t.ac(8, 1, h - 0.5); }
      t.mast(9, -6, h + 2.5, 3.5);
      for (const x of [-10, 10]) t.lampPost(x, 9.6);
      if (t.rich) t.tree(-12, 9, 0.6, 0.7);
    },
  ],
  gold: [
    (h, t) => { // Stepped office: three setbacks with cornices and a colonnaded entry.
      t.box('stone', 0, 0, 0, 28, 0.6, 24);
      const stepsDef = [[0, 26, 22, 0.4], [0.4, 20, 17, 0.32], [0.72, 14, 12, 0.28]];
      for (const [from, w, d, share] of stepsDef) {
        const base = 0.6 + from * (h - 1), hgt = share * (h - 1);
        t.box('sand', 0, 0, base, w, hgt, d);
        t.windows(0, 0, base + (from === 0 ? 5.6 : 0), w, Math.max(2, hgt - (from === 0 ? 5.6 : 0)), d, { inset: 2.4 });
        t.cap(0, 0, base + hgt, w + 1, d + 1, 0.7);
        if (t.rich) for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.box('stone', sx * (w / 2 - 0.3), sz * (d / 2 - 0.3), base, 0.8, hgt, 0.8);
      }
      t.columns(0, 12.2, 0.6, 5, t.rich ? 9 : 5, t.rich ? 2 : 4, 'x', 0.6);
      t.box('stone', 0, 12.2, 5.6, 20, 0.8, 2.6);
      t.pane('glass', 0, 11.05, 3, 18, 4.2); t.door(0, 11.1, 0.6, 3.4, 3.4);
      t.oct('sand', 0, 0, h, 3, 2.4); t.cap(0, 0, h + 2.4, 3.4, 3.4, 0.4); t.cone('accent', 0, 0, h + 2.8, 2.6, 2.6);
      t.flag(-6, -5, h);
      if (t.rich) t.tank(5, 4, h);
    },
    (h, t) => { // Boutique hotel: porte-cochère, balcony ledges, rooftop pool and glowing sign.
      const bodyH = h - 1.6;
      t.box('stone', 0, 0, 0, 30, 0.6, 22);
      t.box('sand', 0, -1, 0.6, 28, bodyH, 14);
      const floors = t.windows(0, -1, 5, 28, Math.max(2, bodyH - 5), 14, { inset: 2.2, pane: 1.4 });
      for (let f = 0; f < floors; f++) {
        const y = 5 + (f + 0.5) * (bodyH - 5) / floors;
        t.box('accent', 0, 6.6, y - 0.9, 28, 0.25, 1.3);
        if (t.rich) t.box('dark', 0, 7.2, y - 0.5, 28, 0.7, 0.1);
      }
      t.pane('glass', 0, 6.05, 2.6, 20, 3.6); t.door(0, 6.1, 0.6, 3.6, 3.6);
      t.box('accent', 0, 10.5, 5.2, 16, 0.5, 9);
      for (const x of [-6, 6]) for (const z of [7.5, 13.5]) t.cyl('stone', x, z, 0.6, 0.45, 4.6);
      t.box('sand', 0, 11.5, 0.6, 22, 0.15, 10);
      t.cap(0, -1, h - 1, 28.6, 14.6);
      for (const x of [-5, 5]) t.box('dark', x, -5, h - 0.4, 0.3, 3.6, 0.3);
      t.box('lamp', 0, -5, h + 1.8, 12, 2.4, 0.35);
      t.box('stone', 6, 1, h - 0.4, 9, 0.8, 5); t.box('water', 6, 1, h + 0.4, 8, 0.2, 4);
      if (t.rich) for (const x of [-4, -7.5]) { t.box('dark', x, 1.5, h - 0.4, 0.15, 2.4, 0.15); t.cone('accent', x, 1.5, h + 1.8, 1.2, 0.6, 'spire', 0); }
      t.hedge(-6, -4, h - 0.4, 10, 1);
      t.penthouse(-9, -3, h - 0.4, 6, 3, 5);
      if (t.rich) t.tank(11, -4, h - 0.4);
    },
    (h, t) => { // Arcade tower: colonnaded podium, finned shaft, lantern crown.
      t.box('stone', 0, 0, 0, 30, 0.6, 26);
      t.box('sand', 0, 0, 0.6, 28, 6, 24);
      t.pane('glass', 0, 11.9, 3.1, 26, 3.2);
      t.columns(0, 12.6, 0.6, 5.2, t.rich ? 13 : 7, t.rich ? 1.5 : 3, 'x', 0.6);
      t.box('stone', 0, 12.6, 5.8, 28, 0.9, 3);
      t.cap(0, 0, 6.6, 29, 25, 0.7);
      const shaftH = h - 7.3;
      t.box('sand', 0, 0, 7.3, 16, shaftH, 16);
      t.windows(0, 0, 7.3, 16, shaftH, 16, { inset: 2.6 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.box('accent', sx * 8, sz * 8, 7.3, 0.7, shaftH + 0.4, 0.7);
      if (t.rich) for (const p of [-2.7, 2.7]) { t.box('stone', p, 8.15, 7.3, 0.5, shaftH - 0.5, 0.5); t.box('stone', p, -8.15, 7.3, 0.5, shaftH - 0.5, 0.5); t.box('stone', 8.15, p, 7.3, 0.5, shaftH - 0.5, 0.5); t.box('stone', -8.15, p, 7.3, 0.5, shaftH - 0.5, 0.5); }
      t.cap(0, 0, h, 17, 17, 1); t.cap(0, 0, h + 1, 13, 13, 1.2);
      t.oct('sand', 0, 0, h + 2.2, 4, 2.6);
      t.pane('lamp', 0, 4.05, h + 3.5, 2.4, 2.4);
      t.cone('accent', 0, 0, h + 4.8, 3.2, 3);
      if (t.rich) { t.tree(-12, 10, 0.6, 0.8); t.tree(12, 10, 0.6, 0.8); }
    },
    (h, t) => { // Convention centre and tower: a long vaulted hall with a glass front, flag row, and a hotel tower.
      const full = t.budget.floors >= 10;
      t.box('stone', 0, 0, 0, 68, 0.6, 68, '#dcdad3');
      t.box('stone', -8, -8, 0.6, 46, 14, 34, '#eeeae1');
      t.part('steel', -8, 15.6, -8, 47, 5, 35, 'gable');
      t.pane('glass', -8, 9.05, 7.4, 42, 12);
      t.door(-8, 9.1, 0.6, 6, 5);
      t.box('accent', -8, 12, 6.8, 30, 0.5, 6); for (const x of [-22, -8, 6]) t.box('dark', x, 14.6, 0.6, 0.4, 6.2, 0.4);
      if (t.rich) for (let i = 0; i < 8; i++) t.flag(-30 + i * 6.3, 20, 0.6, 8);
      t.box('lamp', -8, 9.2, 13.4, 24, 1.4, 0.3);
      const towerH = h - 0.6;
      t.box('stone', 24, -18, 0.6, 16, towerH, 16, '#e4dfd6');
      t.windows(24, -18, 0.6, 16, towerH, 16, { inset: 3, pane: 1.3 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.box('accent', 24 + sx * 8, -18 + sz * 8, 0.6, 0.6, towerH, 0.6);
      t.cap(24, -18, h, 16.6, 16.6, 0.7); t.mast(24, -18, h + 0.7, 3);
      if (t.rich) t.penthouse(20, -22, h + 0.7, 5, 2.6, 4);
      t.box('sand', 0, 26, 0.6, 60, 0.12, 14, '#cfcbc0');
      const cars = full ? 6 : t.rich ? 4 : 2;
      for (let i = 0; i < cars; i++) { const x = -26 + i * 10.4; t.box('car', x, 27, 0.5, 2.1, 1.2, 4.2, ['#eee8d8', '#bb785f', '#7298a0', '#d4b768', '#65747d', '#eee8d8'][i]); t.box('tint', x, 27, 1.7, 1.8, 0.7, 2.2); }
      t.oct('stone', 24, 8, 0.6, 5, 0.8); t.oct('water', 24, 8, 1.4, 4.4, 0.15);
      for (const [x, z] of t.rich ? [[-32, 32], [32, 32], [-32, -32], [32, 4]] : [[-32, 32], [32, 32]]) t.tree(x, z, 0.6, 1);
      for (const [x, z] of t.rich ? [[-32, 18], [32, 18], [-8, 33], [10, 33]] : [[-32, 18], [10, 33]]) t.lampPost(x, z);
    },
    (h, t) => { // Department store: a solid sand block with neon sign strips, ribbon bands and rooftop parking.
      const bodyH = h * 0.86;
      t.box('stone', 0, 0, 0, 34, 0.6, 34);
      t.box('sand', 0, -2, 0.6, 30, bodyH, 26);
      t.pane('glass', 0, 11.05, 3, 24, 4.4); t.door(0, 11.1, 0.6, 4, 4);
      t.box('accent', 0, 12.8, 5.4, 30, 0.4, 4);
      const floors = t.floorsOf(bodyH - 6, 4.2);
      for (let f = 0; f < floors; f++) t.box('accent', 0, -2, 6.6 + (f + 0.5) * (bodyH - 6) / floors, 30.4, 0.5, 26.4);
      for (const x of [-9, 9]) t.box('lamp', x, 11.2, 6.6, 1.4, bodyH - 8, 0.3);
      t.box('lamp', 0, 11.25, bodyH - 3.5, 14, 2.6, 0.3);
      if (t.rich) for (const z of [-6, 2]) t.pane('glass', 15.05, z, bodyH * 0.5, 6, bodyH - 8, Math.PI / 2);
      t.cap(0, -2, 0.6 + bodyH, 30.6, 26.6, 0.8);
      t.box('sand', -4, -4, 1.4 + bodyH, 20, 0.15, 18, '#cfcbc0');
      if (t.rich) for (const [x, z] of [[-10, -9], [-4, -9], [2, -9]]) { t.box('car', x, z, 1.5 + bodyH, 2.1, 1.2, 4.2, '#eee8d8'); t.box('tint', x, z, 2.7 + bodyH, 1.8, 0.7, 2.2); }
      t.box('stone', 9, 2, 1.4 + bodyH, 6, 3.2, 6); t.box('dark', 9, 5.05, 1.4 + bodyH, 3, 2.6, 0.2);
      t.roofGarden(-4, 6, 1.4 + bodyH, 16, 6);
      for (const x of [-6, 6]) t.box('dark', x, -13, 1.4 + bodyH, 0.3, 4, 0.3); t.box('lamp', 0, -13, 4.4 + bodyH, 14, 3, 0.35);
      t.box('dark', -15.2, -8, 0.6, 0.4, 3.6, 6, '#8a9096');
      if (t.rich) { t.tree(-14, 14, 0.6, 0.9); t.tree(14, 14, 0.6, 0.9); }
      for (const x of [-11, 11]) t.lampPost(x, 15.5);
    },
    (h, t) => { // Market arcade: two rows of small stalls along a covered aisle, under steel trusses and a glass roof.
      const lift = h * 0.08, full = t.budget.floors >= 10;
      const bays = full ? 7 : t.rich ? 6 : 4, span = 56 / bays;
      t.box('pavement', 0, 0, 0, 68, 0.45, 68, '#d6d0c0');
      t.box('sand', 0, 0, 0.46, 13, 0.1, 60, '#c7c0ab');
      for (const [row, facing] of [[11, -1], [-11, 1]]) {
        let z = -28;
        for (let i = 0; i < bays; i++) {
          const w = span - 1, cz = z + span / 2, index = (row > 0 ? 0 : bays) + i, tall = 4.6 + (index % 2) + lift * 0.4, px = row + facing * 4.55;
          z += span;
          t.box('stone', row, cz, 0.6, 9, tall, w, index % 2 ? '#e8e2d4' : '#d9d0bb');
          t.pane('glass', px, cz, tall * 0.5 + 0.6, w - 1, tall * 0.7, facing < 0 ? -Math.PI / 2 : Math.PI / 2);
          t.box('accent', row + facing * 4.7, cz, 0.6 + tall, 9.4, 0.3, w + 0.2, SIGN_COLORS[index % SIGN_COLORS.length]);
        }
      }
      for (let z = -21; z <= 21; z += 14) t.box('steel', 0, z, 8.2, 12.4, 0.5, 0.4);
      t.box('glass', 0, 0, 12.4, 12, 0.35, 58, '#a9c7d1');
      t.box('accent', 0, 0, 12.7, 12.4, 0.2, 58.4);
      for (const [x, z] of t.rich ? [[-32, -32], [32, 32], [-32, 32]] : [[-32, -32]]) t.tree(x, z, 0.6, 0.8);
      for (const z of t.rich ? [-20, 20] : [0]) t.lampPost(-14, z);
    },
    (h, t) => { // Piloti villa row: modern low-rise blocks lifted on piloti columns over open parking, balcony trim bands.
      const bodyH = 9 + h * 0.1, full = t.budget.floors >= 10;
      const units = full ? 5 : t.rich ? 4 : 3, w = 58 / units;
      t.box('pavement', 0, 0, 0, 68, 0.45, 16);
      t.box('road', 0, 0, 0.1, 68, 0.42, 7);
      for (let x = -30; x <= 30; x += 15) t.box('marking', x, 0, 0.52, 3, 0.04, 0.3);
      for (const [row, facing] of [[13, -1], [-13, 1]]) {
        let x = -29;
        for (let i = 0; i < units; i++) {
          const bw = w - 1.5, cx = x + bw / 2, index = (row > 0 ? 0 : units) + i, front = row + facing * 5;
          const pilotiH = 2.6, blockH = bodyH - pilotiH;
          x += w;
          for (const sx of [-1, 1]) t.box('stone', cx + sx * (bw / 2 - 1), row - facing * 4, 0.6, 0.8, pilotiH, 0.8, '#c9c4b6');
          t.box('stone', cx, row, 0.6 + pilotiH, bw, blockH, 9, index % 2 ? '#efe9df' : '#e2ddd0');
          const floors = t.floorsOf(blockH, 2.9);
          for (let f = 0; f < floors; f++) {
            const y = 0.6 + pilotiH + (f + 0.5) * blockH / floors;
            t.pane('glass', cx, front + facing * 0.04, y, bw - 1.6, 1.3, facing < 0 ? Math.PI : 0);
            if (t.rich) t.box('accent', cx, front + facing * 0.9, y - 0.9, bw, 0.25, 1.6, SIGN_COLORS[(index + f) % SIGN_COLORS.length]);
          }
          t.cap(cx, row, 0.6 + bodyH, bw + 0.2, 9.3, 0.3);
          if (t.rich) { t.box('car', cx, row, 0.5, 2, 1.2, 4, ['#eee8d8', '#bb785f'][index % 2]); t.box('tint', cx, row, 1.7, 1.7, 0.7, 2.1); }
        }
      }
      for (const x of full ? [-32, -10, 10, 32] : [-20, 20]) t.tree(x, (x / 10) % 2 ? 8 : -8, 0.65, 0.6);
      t.lampPost(-33, 5.5); if (t.rich) t.lampPost(33, -5.5);
    },
    (h, t) => { // Officetel tower: a shop podium with signs, then three narrowing residential steps with balcony ledges and tanks on the roof.
      t.box('stone', 0, 0, 0, 30, 0.6, 26);
      t.box('sand', 0, 0, 0.6, 28, 6, 22, '#e6e0d2');
      t.pane('glass', 0, 11.05, 2.4, 24, 2.8); t.door(8, 11.1, 0.6, 2.8, 3.2);
      for (const x of [-9, -1, 7]) t.sign(x, 11.2, 4.6, 7, 1.2, SIGN_COLORS[(x + 9) / 8 | 0]);
      if (t.rich) { t.sign(14.2, 0, 3.6, 10, 1.1, SIGN_COLORS[1], Math.PI / 2); t.box('accent', 0, 12.4, 3.4, 26, 0.25, 2.4, '#f7f3ea'); }
      t.cap(0, 0, 6.6, 29, 23, 0.7);
      let base = 6.6;
      for (const [w, d, share] of [[22, 18, 0.4], [17, 14, 0.32], [12, 10, 0.24]]) {
        const hgt = share * (h - 7.3);
        t.box('stone', 0, -1, base, w, hgt, d, '#efe9df');
        const floors = t.windows(0, -1, base, w, hgt, d, { sides: 'fb', inset: 2.2, pane: 1.3, pitch: 3.2 });
        for (let f = 0; f < floors; f++) t.box('accent', 0, -1 + d / 2 + 0.7, base + (f + 0.5) * hgt / floors - 0.9, w, 0.3, 1.4);
        if (t.rich) for (const sx of [-1, 1]) t.box('tint', sx * (w / 2 - 1.4), -1, base, 2, hgt, d + 0.3);
        t.cap(0, -1, base + hgt, w + 0.8, d + 0.8, 0.7);
        base += hgt + 0.7;
      }
      t.tank(-3, -3, base); t.box('stone', 3, 1, base, 4, 2.6, 3.5, '#efe9df');
      if (t.rich) { t.ac(-2, 2, base); t.ac(4, -3, base); }
      t.mast(0, -1, base + 2.6, Math.max(3, h * 0.05));
      for (const x of [-12, 12]) t.lampPost(x, 12.5);
      if (t.rich) { t.tree(-13, -11, 0.6, 0.8); t.tree(13, -11, 0.6, 0.8); }
    },
  ],
  platinum: [
    (h, t) => { // Terrace tower: four setbacks with planted terraces on the sunny side.
      t.box('stone', 0, 0, 0, 30, 0.6, 26);
      const levelH = (h - 1) / 4;
      const widths = [26, 21, 16, 11], depths = [22, 18, 14, 10];
      for (let level = 0; level < 4; level++) {
        const w = widths[level], d = depths[level], x = -(26 - w) / 2, z = -(22 - d) / 2, base = 0.6 + level * levelH;
        t.box('stone', x, z, base, w, levelH, d);
        t.windows(x, z, base + (level === 0 ? 5 : 0), w, Math.max(2, levelH - (level === 0 ? 5 : 0)), d, { inset: 2, sides: level === 0 || t.rich ? 'fbrl' : 'fr' });
        t.cap(x, z, base + levelH, w + 0.8, d + 0.8);
        if (level > 0) {
          const pw = widths[level - 1], pd = depths[level - 1];
          t.box('green', x + w / 2 + (pw - w) / 4, z, base + 0.15, (pw - w) / 2 - 0.6, 0.5, pd - 0.6);
          t.box('green', x, z + d / 2 + (pd - d) / 4, base + 0.15, w, 0.5, (pd - d) / 2 - 0.6);
          if (t.rich) { t.tree(x + w / 2 + (pw - w) / 4, z - pd / 4, base + 0.6, 0.7); t.tree(x, z + d / 2 + (pd - d) / 4, base + 0.6, 0.6); t.box('steel', x + pw / 2 - w / 2 + w / 2 - 0.15, z, base + 0.6, 0.12, 0.9, pd); }
        }
      }
      t.pane('glass', 0, 11.05, 2.9, 18, 4); t.door(0, 11.1, 0.6, 3.4, 3.4);
      t.canopy(0, 12.8, 5, 12, 3.6, 'steel');
      t.pergola(-7.5, -6, h - 0.4, 7, 6);
      t.mast(-5, -8, h - 0.4, 4);
      if (t.rich) t.penthouse(-9.5, -3, h - 0.4, 4, 2.4, 4);
    },
    (h, t) => { // Courtyard tower: U-shaped podium around a pond, tower with helipad.
      t.box('stone', 0, 0, 0, 32, 0.6, 30);
      t.box('stone', 0, -9, 0.6, 30, 9, 9);
      for (const x of [-11, 11]) { t.box('stone', x, 5.5, 0.6, 8, 9, 20); t.windows(x, 5.5, 0.6, 8, 9, 20, { sides: x < 0 ? 'fl' : 'fr', inset: 2 }); t.cap(x, 5.5, 9.6, 8.6, 20.6); }
      t.windows(0, -9, 0.6, 30, 9, 9, { sides: 'fb', inset: 6 });
      t.cap(0, -9, 9.6, 30.6, 9.6);
      t.box('sand', 0, 5, 0.6, 14, 0.15, 18);
      t.oct('stone', 0, 6, 0.75, 4, 0.6); t.oct('water', 0, 6, 1.35, 3.5, 0.15);
      const trees = t.rich ? [[-5, 1], [5, 1], [-5, 11], [5, 11]] : [[-5, 1], [5, 11]];
      for (const [x, z] of trees) t.tree(x, z, 0.75, 0.8);
      for (const x of [-6, 6]) t.box('dark', x, 15, 0.6, 0.4, 7, 0.4);
      t.box('accent', 0, 15, 7.6, 13, 0.8, 1);
      t.door(0, -4.45, 0.6, 3.4, 3.4);
      const towerH = h - 10;
      t.box('stone', 0, -9, 9.6, 15, towerH, 14);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.box('tint', sx * 6.6, -9 + sz * 6.1, 9.6, 2.2, towerH, 2.2);
      t.windows(0, -9, 9.6, 15, towerH, 14, { inset: 5.5, pane: 1.4 });
      t.cap(0, -9, h - 0.4, 15.8, 14.8);
      t.helipad(0, -9, h + 0.2, 4.5);
      t.penthouse(-5.5, -13, h + 0.2, 3, 2.4, 3);
      t.mast(6, -13, h + 0.2, 4);
    },
    (h, t) => { // Cantilever garden: slim core with two projecting glass blocks and sky garden.
      t.box('stone', 0, 0, 0, 30, 0.6, 26);
      const coreH = h - 1;
      t.box('stone', 0, 0, 0.6, 14, coreH, 14);
      t.windows(0, 0, 5.6, 14, Math.max(2, coreH - 5.6), 14, { inset: 3 });
      t.box('tint', 0, 7.15, 0.6, 4, Math.max(1, coreH - 2.4), 0.4);
      const aBase = 0.6 + h * 0.58, aH = h * 0.13;
      t.box('tint', 4, 0, aBase, 24, aH, 12);
      t.cap(4, 0, aBase - 0.5, 24.6, 12.6, 0.5); t.cap(4, 0, aBase + aH, 24.6, 12.6, 0.5);
      t.roofGarden(11, 0, aBase + aH + 0.5, 8, 10);
      for (const z of [-4, 4]) t.box('steel', 14.8, z, 0.6, 0.8, aBase - 0.6, 0.8);
      const bBase = 0.6 + h * 0.32, bH = h * 0.11;
      t.box('stone', -3, 4, bBase, 20, bH, 10);
      t.cap(-3, 4, bBase - 0.5, 20.6, 10.6, 0.5); t.cap(-3, 4, bBase + bH, 20.6, 10.6, 0.5);
      t.box('green', -10, 4, bBase + bH + 0.5, 5, 0.5, 9);
      t.windows(-3, 4, bBase, 20, bH, 10, { sides: 'f', inset: 2, pitch: 2.8 });
      t.cap(-2.5, 0, h - 0.4, 20, 14, 0.8);
      t.pergola(-8, 0, h + 0.4, 7, 8);
      t.hedge(3, 6, h + 0.4, 10, 0.8);
      if (t.rich) { t.tree(-9, -4, h + 0.4, 0.6); t.tree(3, -4, h + 0.4, 0.7); }
      t.mast(6, -5, h + 0.4, 4);
      t.pane('glass', 0, 7.05, 2.9, 10, 4); t.door(0, 7.1, 0.6, 3.2, 3.2);
      t.canopy(0, 8.8, 5, 10, 3.6, 'steel');
    },
    (h, t) => { // Twin residences: two slim balcony towers joined by a sky garden, over a podium park.
      t.box('stone', 0, 0, 0, 34, 0.6, 30);
      t.box('green', 0, 4, 0.6, 30, 0.3, 20, '#b9c9a4');
      const towerH = h - 1.4;
      for (const x of [-7, 7]) {
        t.box('stone', x, -4, 0.6, 9, towerH, 10, '#e9e4dc');
        t.box('tint', x, 1.15, 0.6, 3, towerH, 0.4);
        const floors = t.windows(x, -4, 0.6, 9, towerH, 10, { sides: x < 0 ? 'bl' : 'br', inset: 2.4, pane: 1.3 });
        for (let f = 0; f < floors; f++) t.box('accent', x, 1.6, 0.6 + (f + 0.5) * towerH / floors - 0.9, 9.4, 0.3, 1.4);
        t.cap(x, -4, 0.6 + towerH, 9.6, 10.6, 0.8);
      }
      const bridge = 0.6 + h * 0.6;
      t.box('green', 0, -4, bridge, 6, 0.5, 8); t.box('tint', 0, -4, bridge - 2.6, 6, 2.6, 8); t.cap(0, -4, bridge - 3.1, 6.4, 8.4, 0.5);
      if (t.rich) { t.tree(-1, -4, bridge + 0.5, 0.6); t.tree(1.5, -2, bridge + 0.5, 0.5); }
      t.helipad(-7, -4, h - 0.6, 3.6); t.mast(7, -4, h - 0.6, 3);
      t.oct('stone', 0, 8, 0.9, 3, 0.6); t.oct('water', 0, 8, 1.5, 2.6, 0.15);
      for (const [x, z] of t.rich ? [[-12, 10], [12, 10], [-4, 12], [4, 12]] : [[-12, 10], [12, 10]]) t.tree(x, z, 0.9, 0.8);
      t.canopy(0, 12.6, 4.4, 8, 3, 'steel'); t.door(0, 1.4, 0.6, 3, 3.4);
      t.box('sand', 0, 12.5, 0.9, 6, 0.12, 8);
      for (const x of [-13, 13]) t.lampPost(x, 13);
    },
    (h, t) => { // Museum and observation tower: white gallery volumes, a cantilevered box, reflecting pool and a slim tower.
      const full = t.budget.floors >= 10;
      t.box('stone', 0, 0, 0, 68, 0.6, 68, '#dcdad3');
      t.box('stone', -12, 6, 0.6, 30, 8, 24, '#f4f2ec');
      t.box('stone', -22, -10, 0.6, 14, 12, 14, '#f4f2ec');
      t.box('tint', 2, -6, 8.6, 22, 6, 12); t.cap(2, -6, 8.1, 22.6, 12.6, 0.5); t.cap(2, -6, 14.6, 22.6, 12.6, 0.5);
      t.box('stone', -4, -6, 0.6, 6, 8, 6, '#f4f2ec');
      t.pane('glass', -12, 18.05, 3, 20, 4); t.door(-12, 18.1, 0.6, 3.6, 3.6);
      t.box('accent', -12, 20, 5.2, 14, 0.4, 4);
      t.box('lamp', -12, 18.1, 7, 10, 1.2, 0.3);
      t.box('stone', -10, 26, 0.6, 30, 0.4, 10, '#ece4d3'); t.box('water', -10, 26, 1, 28, 0.2, 8);
      t.part('accent', 12, 3.4, 20, 4, 5.6, 4, 'dome', 0, '#c96f63'); t.cone('accent', 20, 22, 0.6, 2.2, 7, 'cone', OCT, '#3d7cc9'); t.box('accent', 16, 14, 0.6, 3, 4, 1, '#f0c34c', 0.6);
      const towerH = h * 0.86;
      t.cyl('stone', 22, -18, 0.6, 3.6, towerH, '#e9e4dc');
      t.cyl('glass', 22, -18, towerH - 3, 9, 4.4); t.cyl('accent', 22, -18, towerH - 3.5, 9.4, 0.5); t.cyl('accent', 22, -18, towerH + 1.4, 9.4, 0.5);
      if (t.rich) for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4; t.box('lamp', 22 + Math.sin(a) * 9.2, -18 + Math.cos(a) * 9.2, towerH + 1.9, 0.5, 0.5, 0.5); }
      t.cyl('stone', 22, -18, towerH + 1.9, 2.4, 2, '#e9e4dc'); t.mast(22, -18, towerH + 3.9, h * 0.09);
      t.box('stone', 22, -18, 0.6, 12, 4, 12, '#f4f2ec'); t.pane('glass', 22, -11.95, 2.4, 10, 2.4);
      const trees = full ? [[-30, -30], [-30, 31], [31, 31], [31, 6], [-2, 31], [10, -30]] : t.rich ? [[-30, -30], [31, 31], [31, 6]] : [[-30, 31]];
      for (const [x, z] of trees) t.tree(x, z, 0.6, 1);
      if (t.rich) { t.bench(-24, 32); t.bench(4, 32); }
      for (const [x, z] of t.rich ? [[-32, 18], [-2, 18], [32, -30], [8, 30]] : [[-2, 18], [32, -30]]) t.lampPost(x, z);
    },
    (h, t) => { // Sky lounge tower: a slab pushed to one side, cantilevered terraces stepping up the sunny side and a round glass lounge on the roof.
      t.box('stone', 0, 0, 0, 30, 0.6, 26);
      const bodyH = h - 4.6, bx = -5;
      t.box('stone', bx, 0, 0.6, 20, bodyH, 22, '#e9e4dc');
      t.box('tint', bx, 11.15, 0.6, 6, bodyH, 0.4);
      t.windows(bx, 0, 5.6, 20, Math.max(2, bodyH - 5.6), 22, { sides: 'fbl', inset: 2.4, pane: 1.4 });
      t.pane('glass', bx, 11.05, 2.9, 16, 4); t.door(bx, 11.1, 0.6, 3.4, 3.4);
      t.canopy(bx, 12.8, 5, 12, 3.6, 'steel');
      // 테라스는 +x 쪽으로 세 단 내민다. 위로 갈수록 짧아지고 녹화 단이 단마다 붙는다.
      [[0.28, 10], [0.5, 8], [0.72, 6]].forEach(([share, reach], i) => {
        const y = 0.6 + bodyH * share, x = 5 + reach / 2;
        t.box('tint', x, 0, y - 3, reach, 3, 16); t.cap(x, 0, y - 3.5, reach + 0.6, 16.6, 0.5); t.cap(x, 0, y, reach + 0.6, 16.6, 0.5);
        t.box('green', x + 1, 0, y + 0.5, reach - 3, 0.5, 13);
        t.hedge(x + reach / 2 - 0.9, 0, y + 1, 0.9, 13);
        if (t.rich) { t.tree(x, -4, y + 1, 0.7 - i * 0.1); t.tree(x - 1, 4, y + 1, 0.6); for (const z of [-6, 6]) t.box('steel', x + reach / 2 - 0.4, z, 0.6, 0.6, y - 3.6, 0.6); }
      });
      t.cap(bx, 0, 0.6 + bodyH, 20.8, 22.8, 0.8);
      const loungeY = 1.4 + bodyH;
      t.cyl('accent', bx, 0, loungeY, 8.6, 0.5); t.cyl('glass', bx, 0, loungeY + 0.5, 8.2, 3.2); t.cyl('accent', bx, 0, loungeY + 3.7, 9, 0.6);
      if (t.rich) for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4; t.box('lamp', bx + Math.sin(a) * 8.6, Math.cos(a) * 8.6, loungeY + 4.3, 0.5, 0.5, 0.5); }
      t.box('green', bx, -9, loungeY, 12, 0.5, 3); t.hedge(bx, -10.2, loungeY + 0.5, 12, 0.6);
      t.mast(bx + 8, 8, loungeY, Math.max(2.5, h * 0.04));
      if (t.rich) t.pergola(bx - 6, 7, loungeY, 5, 4);
      for (const x of [-14, 12]) t.lampPost(x, 13.5);
      if (t.rich) { t.tree(14, 11, 0.6, 0.9); t.tree(-15, -12, 0.6, 0.8); }
    },
  ],
  diamond: [
    (h, t) => { // Apartment complex: four tall residential slabs around a playground, parking and a gated entrance.
      const towerH = h * 0.9, full = t.budget.floors >= 10;
      t.box('green', 0, 0, 0.4, 80, 0.25, 80, '#b9c9a4');
      t.box('sand', 0, 0, 0.6, 6, 0.12, 80); t.box('sand', 0, 0, 0.6, 80, 0.12, 6);
      const towers = [[-22, -20, 0], [20, -22, Math.PI / 2], [-20, 18, 0], [22, 20, Math.PI / 2]];
      towers.forEach(([x, z, rot], i) => {
        const w = 26, d = 11, wall = i % 2 ? '#e4dfd6' : '#efe9df';
        t.part('stone', x, 0.6 + towerH / 2, z, w, towerH, d, 'box', rot, wall);
        const floors = Math.min(full ? 7 : t.rich ? 5 : 3, Math.max(2, Math.floor(towerH / 4)));
        const fx = Math.sin(rot), fz = Math.cos(rot);
        for (let f = 0; f < floors; f++) {
          const y = 0.6 + (f + 0.5) * towerH / floors;
          t.part('glass', x + fx * (d / 2 + 0.03), y, z + fz * (d / 2 + 0.03), w - 3, 1.3, 1, 'pane', rot);
          t.part('glass', x - fx * (d / 2 + 0.03), y, z - fz * (d / 2 + 0.03), w - 3, 1.3, 1, 'pane', rot + Math.PI);
          t.part('accent', x + fx * (d / 2 + 0.9), y - 0.95, z + fz * (d / 2 + 0.9), w, 0.3, 1.8, 'box', rot);
          if (t.rich && f % 2 === 0) t.part('dark', x + fx * (d / 2 + 1.75), y - 0.55, z + fz * (d / 2 + 1.75), w, 0.8, 0.1, 'box', rot);
        }
        t.part('accent', x, 0.6 + towerH + 0.4, z, w + 0.4, 0.8, d + 0.4, 'box', rot);
        t.part('lamp', x + fx * (d / 2 + 0.06), towerH - 2.6, z + fz * (d / 2 + 0.06), 5, 2.2, 0.3, 'box', rot);
        t.part('stone', x - fx * 1 + fz * (w / 4), 1.4 + towerH + 1.6, z - fz * 1 + fx * (w / 4), 4, 3.2, 4, 'box', rot);
        if (t.rich) t.tank(x - fz * w / 4, z - fx * w / 4, 1.4 + towerH);
        if (full) t.mast(x + fz * w / 3, z + fx * w / 3, 1.4 + towerH, 4);
        t.part('dark', x + fx * (d / 2 + 0.02), 2.4, z + fz * (d / 2 + 0.02), 3, 3.6, 0.9, 'box', rot);
      });
      // Central playground and pocket park.
      t.box('sand', 0, 0, 0.62, 18, 0.12, 14);
      t.box('dark', -4, 0, 0.7, 0.2, 2.6, 0.2); t.box('dark', 0, 0, 0.7, 0.2, 2.6, 0.2); t.box('wood', -2, 0, 3.3, 4.6, 0.2, 0.2);
      t.box('accent', 4.5, -2, 0.7, 1.4, 2.4, 1.4, '#f0c34c'); t.box('accent', 4.5, 1.5, 0.7, 1.2, 0.3, 5, '#f0c34c');
      for (const [x, z] of t.rich ? [[-12, -9], [12, -9], [-12, 9], [12, 9]] : [[-12, -9], [12, 9]]) t.bench(x, z);
      const trees = full ? [[-6, -34], [6, -34], [-34, -6], [-34, 6], [34, -6], [34, 6], [-6, 34], [6, 34], [-30, 30], [30, -30]] : t.rich ? [[-6, -34], [34, 6], [-34, 6], [6, 34]] : [[-6, -34], [6, 34]];
      for (const [x, z] of trees) t.tree(x, z, 0.65, 1);
      // Parking strips and the gate.
      for (const s of [-1, 1]) { t.box('sand', s * 36, 0, 0.6, 7, 0.15, 60, '#cfcbc0'); if (full) for (let i = 0; i < 4; i++) { t.box('car', s * 36, -24 + i * 16, 0.5, 2.1, 1.2, 4.2, ['#eee8d8', '#bb785f', '#7298a0', '#d4b768'][i]); t.box('tint', s * 36, -24 + i * 16, 1.7, 1.8, 0.7, 2.2); } }
      t.box('stone', -6, 38, 0.6, 4, 3.2, 3.2); t.box('accent', -6, 38, 3.8, 4.6, 0.4, 3.8);
      t.box('dark', 0, 38, 0.6, 0.3, 4.4, 0.3); t.box('dark', 6, 38, 0.6, 0.3, 4.4, 0.3); t.box('lamp', 3, 38, 5, 6.4, 1.4, 0.4);
      for (const s of [-1, 1]) { t.box('steel', 0, s * 41, 0.4, 82, 1.4, 0.15); t.box('steel', s * 41, 0, 0.4, 0.15, 1.4, 82); }
      for (const [x, z] of t.rich ? [[-12, -34], [12, 34], [34, -14], [-34, 14]] : [[12, 34]]) t.lampPost(x, z);
    },
    (h, t) => { // Resort hotel: round balcony tower on a lobby podium with pool deck, cabanas, palms and a court.
      const towerH = h * 0.92, cx = -16, cz = -12, full = t.budget.floors >= 10;
      t.box('sand', 0, 0, 0.4, 80, 0.2, 80, '#e8dcc0');
      t.box('stone', cx, cz + 4, 0.6, 46, 6, 34, '#f3eee4');
      t.pane('glass', cx, cz + 21.05, 3.4, 38, 4); t.door(cx, cz + 21.1, 0.6, 4.4, 4.4);
      t.box('accent', cx, cz + 25, 5.6, 22, 0.5, 8); for (const x of [-8, 8]) for (const z of [22.5, 27.5]) t.cyl('stone', cx + x, cz + z, 0.6, 0.5, 5);
      t.cap(cx, cz + 4, 6.6, 47, 35, 0.7);
      t.oct('stone', cx, cz, 7.3, 15, towerH - 7.3, OCT, '#f3eee4');
      const floors = Math.min(t.budget.floors, Math.max(2, Math.floor((towerH - 7.3) / 4)));
      for (let f = 0; f < floors; f++) {
        const y = 7.3 + (f + 0.5) * (towerH - 7.3) / floors;
        t.oct('glass', cx, cz, y - 0.6, 15.1, 1.4);
        t.oct('accent', cx, cz, y - 1.6, 15.9, 0.35);
        if (t.rich && f % 2) t.oct('dark', cx, cz, y - 1.25, 16.1, 0.7, OCT);
      }
      t.oct('accent', cx, cz, towerH, 16.2, 0.9);
      t.oct('stone', cx, cz, towerH + 0.9, 8, 3, OCT, '#f3eee4'); t.oct('water', cx + 9, cz, towerH + 0.95, 4.2, 0.15);
      for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4 + OCT; t.box('lamp', cx + Math.sin(a) * 15.6, cz + Math.cos(a) * 15.6, towerH + 0.9, 0.7, 0.7, 0.7); }
      t.mast(cx, cz, towerH + 3.9, h * 0.05);
      // Pool deck with a lagoon pool, swim-up bar, cabanas and loungers.
      t.box('stone', 18, 14, 0.6, 44, 0.3, 50, '#ece4d3');
      t.oct('stone', 16, 8, 0.9, 13, 0.5); t.oct('water', 16, 8, 1.4, 12, 0.2); t.oct('stone', 26, 20, 0.9, 8, 0.5); t.oct('water', 26, 20, 1.4, 7.2, 0.2);
      t.oct('wood', 16, 8, 1.6, 2.4, 1.2); t.cone('accent', 16, 8, 2.8, 3, 1.6, 'cone', OCT, '#c9a25d');
      const cabanas = full ? [[2, 30], [10, 34], [18, 36], [34, 34]] : t.rich ? [[6, 32], [30, 34]] : [[18, 34]];
      for (const [x, z] of cabanas) { for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.box('wood', x + sx * 1.8, z + sz * 1.4, 0.9, 0.2, 2.8, 0.2); t.box('accent', x, z, 3.7, 4.6, 0.3, 3.6, '#f7f3ea'); }
      if (t.rich) for (let i = 0; i < (full ? 8 : 4); i++) t.box('accent', 2 + i * 4.4, -8, 0.9, 1.6, 0.5, 3.2, i % 2 ? '#f7f3ea' : '#4fae7a');
      const palms = full ? [[-2, -2], [4, 18], [30, 2], [36, 10], [8, -12], [34, -12], [38, 30], [-8, 36], [-36, 30], [-38, -30], [30, -30], [-8, -36]] : t.rich ? [[-2, -2], [30, 2], [36, 30], [-36, 30], [-38, -30], [30, -30]] : [[30, 2], [-36, 30], [30, -30]];
      for (const [x, z] of palms) { t.part('wood', x, 3.6, z, 0.5, 6.4, 0.5, 'trunk'); t.part('leaf', x, 7.2, z, 3.6, 1.6, 3.6, 'tree', 0, '#6f9d5a'); }
      // Tennis court and parking.
      t.box('green', -22, 26, 0.6, 22, 0.15, 12, '#7fa367'); t.box('accent', -22, 26, 0.75, 0.2, 0.9, 11, '#e9e2c5'); if (t.rich) { t.box('accent', -32, 26, 0.7, 0.3, 0.08, 12, '#e9e2c5'); t.box('accent', -12, 26, 0.7, 0.3, 0.08, 12, '#e9e2c5'); }
      t.box('sand', -24, -32, 0.6, 30, 0.15, 10, '#cfcbc0');
      if (t.rich) for (let i = 0; i < 4; i++) { t.box('car', -34 + i * 7, -32, 0.5, 2.1, 1.2, 4.2, ['#eee8d8', '#bb785f', '#7298a0', '#d4b768'][i]); t.box('tint', -34 + i * 7, -32, 1.7, 1.8, 0.7, 2.2); }
      for (const [x, z] of t.rich ? [[-38, 12], [38, -16], [0, 38], [-4, -30]] : [[38, -16], [0, 38]]) t.lampPost(x, z);
    },
    (h, t) => { // Crystal spire: wide octagonal glass shaft, corner pavilions, spire ring, needle.
      const shaftBase = 6.6, shaftH = h * 0.74;
      t.oct('stone', 0, 0, 0, 20, 0.6);
      t.oct('stone', 0, 0, 0.6, 16.5, 6);
      t.oct('glass', 0, 0, 1.9, 16.6, 3.2);
      t.oct('accent', 0, 0, 6.6, 17, 0.6);
      for (let j = 0; j < 4; j++) { const a = j * Math.PI / 2 + Math.PI / 4; const px = Math.sin(a) * 14.5, pz = Math.cos(a) * 14.5; t.oct('stone', px, pz, 7.2, 3, 4); t.cone('accent', px, pz, 11.2, 3.2, 3); if (t.rich) t.box('lamp', px, pz, 14.2, 0.6, 0.6, 0.6); }
      t.oct('blueglass', 0, 0, shaftBase, 13, shaftH);
      for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4 + OCT; t.box('accent', Math.sin(a) * 13.05, Math.cos(a) * 13.05, shaftBase, 0.45, shaftH, 0.45); if (t.rich) t.box('steel', Math.sin(a + Math.PI / 8) * 13.02, Math.cos(a + Math.PI / 8) * 13.02, shaftBase, 0.25, shaftH, 0.25); }
      const step = t.rich ? 4.2 : 9;
      for (let y = shaftBase + step; y < shaftBase + shaftH - 1; y += step) t.oct('glass', 0, 0, y, 13.18, 0.4);
      for (const share of [0.25, 0.5, 0.75]) t.oct('accent', 0, 0, shaftBase + shaftH * share, 13.5, 0.7);
      const crown = shaftBase + shaftH;
      t.oct('accent', 0, 0, crown, 13.8, 1);
      for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4 + OCT; t.cone('accent', Math.sin(a) * 11.5, Math.cos(a) * 11.5, crown + 1, 1.6, h * 0.08, 'spire', 0); if (t.rich) t.box('lamp', Math.sin(a) * 11.5, Math.cos(a) * 11.5, crown + 1 + h * 0.08, 0.5, 0.5, 0.5); }
      t.cone('blueglass', 0, 0, crown + 1, 12, h * 0.17);
      t.box('dark', 0, 0, crown + 1 + h * 0.17, 0.4, h * 0.08, 0.4);
      t.box('lamp', 0, 0, crown + 1 + h * 0.25, 1, 1, 1);
      t.canopy(0, 18.2, 4.8, 12, 4.4, 'steel'); t.door(0, 16.55, 0.6, 3.6, 3.6);
      for (const x of [-11, 11]) t.lampPost(x, 19.5);
      if (t.rich) for (const [x, z] of [[-17, 17], [17, 17], [-17, -17], [17, -17]]) t.tree(x, z, 0.6, 0.9);
    },
    (h, t) => { // Curtain wall office: dark glass slab with steel fins, sky lobby bands and crown screens.
      t.box('stone', 0, 0, 0, 40, 0.6, 34);
      t.box('stone', 0, 0, 0.6, 36, 6, 30);
      t.pane('glass', 0, 15.05, 3.6, 30, 4); t.pane('glass', 18.05, 0, 3.6, 24, 4, Math.PI / 2); t.pane('glass', -18.05, 0, 3.6, 24, 4, -Math.PI / 2);
      t.columns(0, 16.4, 0.6, 6, t.rich ? 15 : 7, t.rich ? 2.2 : 4.4, 'x', 0.45);
      t.cap(0, 0, 6.6, 37, 31, 0.8);
      const towerH = h - 7;
      t.curtain(0, -2, 6.6, 24, towerH, 20);
      if (t.rich) { for (const x of [-9, -6, -3, 0, 3, 6, 9]) { t.box('steel', x, 8.15, 6.6, 0.3, towerH, 0.3); t.box('steel', x, -12.15, 6.6, 0.3, towerH, 0.3); } for (const z of [-8, -4.5, -1, 2.5, 6]) { t.box('steel', 12.15, z, 6.6, 0.3, towerH, 0.3); t.box('steel', -12.15, z, 6.6, 0.3, towerH, 0.3); } }
      t.box('stone', -8, -13.2, 6.6, 6, towerH + 3, 2.4);
      for (const share of [0.3, 0.6]) t.box('accent', 0, -2, 6.6 + towerH * share, 24.5, 1.4, 20.5);
      const screenH = h * 0.1;
      for (const x of [-12, 12]) t.box('steel', x, -2, h - 0.4, 0.5, screenH, 20.4);
      for (const z of [-12, 8]) t.box('steel', 0, z, h - 0.4, 24.4, screenH, 0.5);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.box('lamp', sx * 11.6, -2 + sz * 9.6, h - 0.4 + screenH, 0.8, 0.8, 0.8);
      t.mast(-8, -13.2, h + 2.6, h * 0.05);
      t.canopy(0, 17.8, 5.2, 16, 4, 'steel'); t.door(0, 15.1, 0.6, 4, 4);
      if (t.rich) { t.tree(-17, 12, 0.6, 0.9); t.tree(17, 12, 0.6, 0.9); }
      for (const x of [-10, 10]) t.lampPost(x, 18.5);
    },
    (h, t) => { // Shopping complex tower: mall podium with neon signs and a cinema box, office tower rising behind.
      t.box('stone', 0, 0, 0, 40, 0.6, 40);
      t.box('sand', 0, 2, 0.6, 38, 10, 34);
      t.box('accent', 0, 2, 9.4, 38.4, 1.4, 34.4);
      t.pane('glass', 0, 19.05, 3.4, 30, 5); t.door(0, 19.1, 0.6, 5, 4.6);
      t.box('accent', 0, 18.6, 6.4, 24, 0.5, 4); for (const x of [-11, 11]) t.box('dark', x, 20.3, 0.6, 0.4, 5.8, 0.4);
      for (const x of [-15, -8, 8, 15]) t.sign(x, 19.2, 7.5, 5, 3, SIGN_COLORS[(x + 15) % SIGN_COLORS.length | 0]);
      if (t.rich) for (const z of [-10, 0, 10]) t.sign(19.2, z, 5.5, 7, 2.4, SIGN_COLORS[(z + 10) / 10 | 0], Math.PI / 2);
      t.cap(0, 2, 10.8, 38.6, 34.6, 0.6);
      const towerH = h - 11.4;
      t.box('stone', -4, -8, 11.4, 16, towerH, 16, '#e4dfd6');
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.box('tint', -4 + sx * 7, -8 + sz * 7, 11.4, 2.4, towerH, 2.4);
      t.windows(-4, -8, 11.4, 16, towerH, 16, { inset: 5.5, pane: 1.4 });
      for (const share of [0.5]) t.box('accent', -4, -8, 11.4 + towerH * share, 16.5, 1.4, 16.5);
      t.cap(-4, -8, h, 16.8, 16.8, 0.8); t.mast(-4, -8, h + 0.8, h * 0.05);
      t.box('dark', 11, 4, 11.4, 12, 6, 10); t.box('lamp', 11, 9.25, 15, 9, 2, 0.3); t.cap(11, 4, 17.4, 12.4, 10.4, 0.4);
      t.roofGarden(9, -10, 11.4, 12, 8);
      if (t.rich) t.pergola(11, -2, 11.4, 6, 5);
      for (const [x, z] of t.rich ? [[-17, 17], [17, 17], [-17, -17], [17, -17]] : [[-17, 17], [17, 17]]) t.tree(x, z, 0.6, 0.9);
      for (const x of [-14, 14]) t.lampPost(x, 19.5);
    },
    (h, t) => { // Observatory tower: an octagonal blue-glass shaft on a stone podium, a silver dome with a slit and a needle spire above it.
      const podiumH = 6, shaftBase = 0.6 + podiumH, shaftH = h * 0.64;
      t.oct('stone', 0, 0, 0, 20, 0.6);
      t.oct('stone', 0, 0, 0.6, 17, podiumH, OCT, '#e9e4dc');
      t.oct('glass', 0, 0, 2, 17.1, 2.8);
      t.oct('accent', 0, 0, shaftBase, 17.6, 0.6);
      t.canopy(0, 17.6, 4.6, 12, 4, 'steel'); t.door(0, 16.05, 0.6, 3.6, 3.6);
      for (let j = 0; j < 4; j++) { const a = j * Math.PI / 2 + Math.PI / 4, px = Math.sin(a) * 14.5, pz = Math.cos(a) * 14.5; t.cyl('stone', px, pz, shaftBase + 0.6, 2.6, 2.4, '#e9e4dc'); t.part('accent', px, shaftBase + 3, pz, 2.7, 1.6, 2.7, 'dome'); }
      t.oct('blueglass', 0, 0, shaftBase, 12, shaftH);
      for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4 + OCT; t.box('steel', Math.sin(a) * 12.05, Math.cos(a) * 12.05, shaftBase, 0.4, shaftH, 0.4); }
      const bands = t.rich ? 5 : 2;
      for (let i = 1; i <= bands; i++) t.oct('accent', 0, 0, shaftBase + shaftH * i / (bands + 1), 12.5, 0.6);
      const drumBase = shaftBase + shaftH;
      t.oct('accent', 0, 0, drumBase, 13.2, 1);
      t.cyl('stone', 0, 0, drumBase + 1, 10, h * 0.06, '#e9e4dc');
      if (t.rich) for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4; t.box('lamp', Math.sin(a) * 10.2, Math.cos(a) * 10.2, drumBase + 1, 0.5, 0.5, 0.5); }
      const domeBase = drumBase + 1 + h * 0.06, domeH = h * 0.1;
      t.part('steel', 0, domeBase, 0, 10, domeH, 10, 'dome');
      t.box('dark', 0, 5, domeBase + domeH * 0.35, 2, domeH * 0.6, 5.2);
      t.cone('accent', 0, 0, domeBase + domeH, 3, h * 0.13, 'spire', 0);
      t.box('dark', 0, 0, domeBase + domeH + h * 0.13, 0.35, h * 0.05, 0.35); t.box('lamp', 0, 0, domeBase + domeH + h * 0.18, 1, 1, 1);
      for (const x of [-12, 12]) t.lampPost(x, 19);
      if (t.rich) for (const [x, z] of [[-18, 16], [18, 16], [-18, -16], [18, -16]]) t.tree(x, z, 0.6, 0.9);
    },
  ],
  master: [
    (h, t) => { // Skybridge twins: two broad violet towers, three glass bridges, helipad and mast.
      t.box('stone', 0, 0, 0, 40, 0.6, 36);
      t.box('stone', 0, 0, 0.6, 38, 8, 30);
      t.pane('glass', 0, 15.05, 4, 34, 5); t.pane('glass', 19.05, 0, 4, 26, 5, Math.PI / 2); t.pane('glass', -19.05, 0, 4, 26, 5, -Math.PI / 2);
      t.columns(0, 16.4, 0.6, 8, t.rich ? 17 : 5, t.rich ? 2 : 8, 'x', 0.45);
      t.cap(0, 0, 8.6, 39, 31, 0.8);
      const heights = { '-11': h * 0.9 - 8, '11': h - 8.6 };
      for (const x of [-11, 11]) {
        const hgt = heights[String(x)];
        t.box('violet', x, 0, 8.6, 14, hgt, 20);
        for (const z of [10.2, -10.2]) t.box('tint', x, z, 8.6, 6, hgt, 0.4);
        t.box('tint', x + (x < 0 ? -7.2 : 7.2), 0, 8.6, 0.4, hgt, 8);
        t.windows(x, 0, 8.6, 14, hgt, 20, { sides: x < 0 ? 'fbl' : 'fbr', inset: 8.5 });
        if (t.rich) for (const sz of [-1, 1]) t.box('accent', x + (x < 0 ? -7.1 : 7.1), sz * 9.9, 8.6, 0.5, hgt, 0.5);
        if (t.rich) for (const share of [0.33, 0.66]) t.box('accent', x, 0, 8.6 + hgt * share, 14.4, 1.2, 20.4);
        t.cap(x, 0, 8.6 + hgt, 14.8, 20.8, 0.8);
      }
      for (const [share, hgt, d] of [[0.7, 3.4, 9], [0.48, 3.4, 9]]) { t.box('tint', 0, 0, 0.6 + h * share, 8.2, hgt, d); t.cap(0, 0, 0.6 + h * share - 0.5, 8.6, d + 0.4, 0.5); t.cap(0, 0, 0.6 + h * share + hgt, 8.6, d + 0.4, 0.5); }
      t.box('accent', 0, 0, 0.6 + h * 0.26, 8.2, 2.6, 6); t.pane('tint', 0, 3.05, 0.6 + h * 0.26 + 1.3, 7.6, 1.8);
      t.helipad(-11, 0, h * 0.9 + 1.4, 5.5);
      t.mast(11, 0, h + 0.8, h * 0.09);
      if (t.rich) { t.penthouse(11, -6, h + 0.8, 6, 2.8, 5); for (const sx of [-1, 1]) t.box('lamp', 11 + sx * 6.4, 9.4, h + 0.8, 0.7, 0.7, 0.7); }
      for (const x of [-16.5, 16.5]) { t.box('green', x, 0, 9.4, 4, 0.5, 26); t.hedge(x, -10, 9.9, 4, 0.8); if (t.rich) t.tree(x, 6, 9.9, 0.7); }
      t.box('accent', 0, 17.8, 7.4, 20, 0.6, 5.2);
      for (const x of [-8.5, 8.5]) for (const z of [15.6, 20]) t.cyl('stone', x, z, 0.6, 0.5, 6.8);
      t.door(0, 15.1, 0.6, 4.4, 4.4);
      for (const x of [-16, 16]) { t.oct('stone', x, 16, 0.6, 2.6, 0.8); t.oct('water', x, 16, 1.4, 2.2, 0.15); }
      if (t.rich) { t.flag(-16, -16, 0.6, 8); t.flag(16, -16, 0.6, 8); }
    },
    (h, t) => { // Grand hotel: wide centre block with pyramid roof and turrets, tall wings, twin pools.
      t.box('stone', 0, 0, 0, 40, 0.6, 36);
      const centerH = h - 4.6, wingH = h * 0.74;
      t.box('violet', 0, -4, 0.6, 20, centerH, 22);
      t.box('tint', 0, 7.2, 0.6, 6, Math.max(1, centerH - 6), 0.4);
      const floors = t.windows(0, -4, 7, 20, Math.max(2, centerH - 7), 22, { sides: 'fb', inset: 9, pane: 1.4 });
      if (t.rich) for (let f = 1; f < floors; f++) t.box('accent', 0, -4, 7 + f * (centerH - 7) / floors, 20.3, 0.25, 22.3);
      t.cone('roof', 0, -4, h - 4, 21.5, 7.5, 'pyramid', 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { t.cyl('violet', sx * 9.5, -4 + sz * 10.5, h - 4.6, 1.3, 3.2); t.cone('accent', sx * 9.5, -4 + sz * 10.5, h - 1.4, 1.5, 2.4); }
      t.oct('accent', 0, -4, h + 0.2, 2.4, 2.4); t.cone('accent', 0, -4, h + 2.6, 2, 2); t.mast(0, -4, h + 4.6, 1.6);
      for (const x of [-15, 15]) {
        t.box('violet', x, -4, 0.6, 10, wingH, 20);
        const wf = t.windows(x, -4, 0.6, 10, wingH, 20, { sides: x < 0 ? 'fl' : 'fr', inset: 3 });
        for (let f = 0; f < wf; f += 2) t.box('accent', x, 6.6, 0.6 + (f + 0.5) * wingH / wf - 0.9, 10, 0.25, 1.2);
        for (const sz of [-1, 1]) t.box('accent', x + (x < 0 ? -5.1 : 5.1), -4 + sz * 9.9, 0.6, 0.5, wingH, 0.5);
        t.cap(x, -4, wingH + 0.6, 10.8, 20.8, 0.8);
        t.box('stone', x, -4, wingH + 1.4, 8, 0.7, 12); t.box('water', x, -4, wingH + 2.1, 7, 0.2, 11);
        if (t.rich) { t.hedge(x, 4.5, wingH + 1.4, 8, 0.8); t.box('dark', x, -11, wingH + 1.4, 0.15, 2.4, 0.15); t.cone('accent', x, -11, wingH + 3.6, 1.3, 0.6, 'spire', 0); }
      }
      for (const x of [-15, 15]) t.box('dark', x, -13.5, wingH + 1.4, 0.3, 3.6, 0.3);
      t.box('lamp', -15, -13.5, wingH + 3.4, 9, 2.2, 0.35); t.box('lamp', 15, -13.5, wingH + 3.4, 9, 2.2, 0.35);
      t.box('accent', 0, 13, 6.4, 26, 0.7, 10);
      for (const x of [-11, -3.7, 3.7, 11]) for (const z of [9.5, 16.5]) if (t.rich || z === 16.5) t.cyl('stone', x, z, 0.6, 0.5, 5.8);
      t.box('sand', 0, 13.5, 0.6, 34, 0.15, 11);
      t.box('stone', 0, 7.8, 0.6, 16, 0.5, 2.2);
      t.door(0, 7.05, 0.6, 6, 5);
      for (const x of [-7, 7]) t.pane('glass', x, 7.05, 3.2, 5, 4.4);
      for (const x of [-13, 13]) t.hedge(x, 19, 0.6, 12, 0.9);
      t.oct('stone', 0, 18, 0.6, 2.4, 0.8); t.oct('water', 0, 18, 1.4, 2, 0.15);
      if (t.rich) { t.flag(-19, 15, 0.6, 8); t.flag(19, 15, 0.6, 8); t.tree(-19, -14, 0.6, 0.9); t.tree(19, -14, 0.6, 0.9); }
    },
    (h, t) => { // Casino resort: marquee-lit podium with a golden dome, neon-striped hotel tower, sign tower and fountain.
      const gold = '#d8b45c', full = t.budget.floors >= 10;
      t.box('sand', 0, 0, 0.4, 80, 0.2, 80, '#dfd6c5');
      t.box('stone', 0, 6, 0.6, 72, 12, 44, '#e6dccd');
      for (const s of [-1, 1]) { t.box('lamp', 0, 6 + s * 22.2, 11.4, 72.4, 0.6, 0.6); t.box('lamp', s * 36.2, 6, 11.4, 0.6, 0.6, 44.4); }
      t.box('accent', 0, 6, 12.6, 73, 0.8, 45, gold);
      t.box('lamp', 0, 28.35, 7, 40, 2.4, 0.4);
      t.box('accent', 0, 31, 8.6, 30, 0.6, 9, gold); t.box('lamp', 0, 31, 8.2, 28, 0.25, 7.5);
      for (const x of [-12, -4, 4, 12]) for (const z of [28.5, 34.5]) t.cyl('stone', x, z, 0.6, 0.6, 8, '#f3eee4');
      t.door(0, 28.05, 0.6, 6, 5); for (const x of [-12, 12]) t.pane('glass', x, 28.05, 3.6, 10, 5);
      t.oct('stone', -22, 4, 12.6, 10, 2.4, OCT, '#f3eee4'); t.part('accent', -22, 15, 4, 10, 8, 10, 'dome', 0, gold); t.box('lamp', -22, 4, 23, 1, 1, 1);
      // Hotel tower with neon stripes and a lit crown.
      const towerH = h - 13, tx = 12, tz = -2;
      t.box('tint', tx, tz, 13.4, 34, towerH, 18);
      const floors = Math.min(t.budget.floors, Math.max(2, Math.floor(towerH / 4)));
      for (let f = 1; f < floors; f++) t.box('steel', tx, tz, 13.4 + f * towerH / floors - 0.14, 34.3, 0.28, 18.3);
      for (const x of [-11, 0, 11]) { t.box('lamp', tx + x, tz + 9.2, 13.4, 1.2, towerH, 0.3); t.box('lamp', tx + x, tz - 9.2, 13.4, 1.2, towerH, 0.3); }
      if (t.rich) for (const share of [0.35, 0.7]) t.box('accent', tx, tz, 13.4 + towerH * share, 34.6, 1.4, 18.6, gold);
      t.cap(tx, tz, 13.4 + towerH, 34.8, 18.8, 0.9);
      t.box('lamp', tx, tz + 9.45, h - 4.5, 24, 5, 0.4); t.box('lamp', tx, tz - 9.45, h - 4.5, 24, 5, 0.4);
      for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4; t.box('lamp', tx + Math.sin(a) * 14, tz + Math.cos(a) * 6.5, h + 0.3, 0.8, 0.8, 0.8); }
      t.helipad(tx - 8, tz, h + 0.3, 4);
      t.mast(tx + 12, tz, h + 0.3, h * 0.05);
      // Sign tower at the street corner.
      t.box('dark', 32, 32, 0.6, 5, h * 0.45, 2);
      for (let i = 0; i < (t.rich ? 5 : 2); i++) t.box('lamp', 32, 33.1, 4 + i * (h * 0.42 / (t.rich ? 5 : 2)), 4.4, 3, 0.3);
      t.box('accent', 32, 32, 0.6 + h * 0.45, 5.6, 0.6, 2.6, gold);
      // Fountain plaza, palms and the parking garage.
      t.oct('stone', 0, 35.5, 0.6, 5.5, 0.8); t.oct('water', 0, 35.5, 1.4, 5, 0.15); t.cyl('stone', 0, 35.5, 1.4, 0.8, 3.4); t.oct('sand', 0, 35.5, 4.8, 2, 0.4);
      if (t.rich) for (let j = 0; j < 6; j++) { const a = j * Math.PI / 3; t.box('lamp', Math.sin(a) * 4.2, 35.5 + Math.cos(a) * 4.2, 1.5, 0.5, 0.5, 0.5); }
      const palms = full ? [[-30, 34], [-20, 36], [20, 36], [30, 36], [-36, 22], [36, 20], [-36, -14], [-36, -30]] : t.rich ? [[-30, 34], [30, 36], [-36, -14], [36, 20]] : [[-30, 34], [30, 36]];
      for (const [x, z] of palms) { t.part('wood', x, 3.6, z, 0.5, 6.4, 0.5, 'trunk'); t.part('leaf', x, 7.2, z, 3.6, 1.6, 3.6, 'tree', 0, '#6f9d5a'); }
      t.box('stone', -26, -30, 0.6, 26, 9, 20, '#d9d3c8');
      for (let f = 0; f < 3; f++) { t.pane('tint', -26, -19.95, 2 + f * 3, 24, 1.6); if (t.rich) t.pane('tint', -12.95, -30, 2 + f * 3, 18, 1.6, Math.PI / 2); }
      t.cap(-26, -30, 9.6, 26.4, 20.4, 0.5);
      t.box('water', 24, -30, 0.6, 18, 0.2, 12); t.box('stone', 24, -30, 0.4, 20, 0.3, 14, '#ece4d3');
      if (t.rich) for (let i = 0; i < 4; i++) t.box('accent', 16 + i * 5, -38.5, 0.8, 1.6, 0.5, 3.2, '#f7f3ea');
      for (const [x, z] of t.rich ? [[-38, 36], [38, -38], [-38, -4], [38, 4]] : [[-38, 36], [38, -38]]) t.lampPost(x, z);
    },
    (h, t) => { // Grand gate: two broad legs carrying a full-width top block, twin bridges, roof garden.
      t.box('stone', 0, 0, 0, 40, 0.6, 34);
      t.box('stone', 0, 0, 0.6, 38, 6, 28);
      t.pane('glass', 0, 14.05, 3.2, 12, 5.5); t.door(0, 14.1, 0.6, 4, 4);
      t.columns(0, 15.4, 0.6, 6, t.rich ? 16 : 4, t.rich ? 2.2 : 8.8, 'x', 0.45);
      t.cap(0, 0, 6.6, 39, 29, 0.8);
      const legH = h * 0.84 - 6.6;
      for (const x of [-13.5, 13.5]) {
        t.box('violet', x, 0, 6.6, 12, legH, 18);
        for (const z of [9.2, -9.2]) t.box('tint', x, z, 6.6, 5, legH, 0.4);
        t.windows(x, 0, 6.6, 12, legH, 18, { inset: 6.5, pane: 1.3, sides: x < 0 ? 'fbl' : 'fbr' });
        if (t.rich) for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.box('accent', x + sx * 5.9, sz * 8.9, 6.6, 0.5, legH, 0.5);
        if (t.rich) for (const share of [0.35, 0.7]) t.box('accent', x, 0, 6.6 + legH * share, 12.4, 1.1, 18.4);
      }
      for (const share of t.rich ? [0.3, 0.55] : [0.55]) { t.box('tint', 0, 0, 0.6 + h * share, 15.4, 3, 8); t.cap(0, 0, 0.6 + h * share - 0.5, 15.8, 8.4, 0.5); t.cap(0, 0, 0.6 + h * share + 3, 15.8, 8.4, 0.5); }
      const slabH = h * 0.16;
      t.box('violet', 0, 0, h * 0.84, 39, slabH, 18);
      t.windows(0, 0, h * 0.84, 39, slabH, 18, { sides: 'fb', inset: 4, pane: 1.4, pitch: 4.5 });
      t.cap(0, 0, h * 0.84 - 0.4, 39.6, 18.6, 0.6);
      t.box('lamp', 0, 0, h * 0.84 - 0.9, 12, 0.4, 1.5);
      t.cap(0, 0, h, 39.6, 18.6, 0.8);
      t.helipad(0, 0, h + 0.8, 5.5);
      for (const x of [-16, 16]) t.mast(x, -6, h + 0.8, h * 0.08);
      t.box('green', 10, 4, h + 0.8, 12, 0.5, 6); t.hedge(10, 6.6, h + 1.3, 12, 0.8);
      if (t.rich) { t.pergola(-10, 4, h + 0.8, 8, 5); t.tree(13, 3, h + 1.3, 0.6); for (const sx of [-1, 1]) t.box('lamp', sx * 19, 8.7, h + 0.8, 0.7, 0.7, 0.7); }
      if (t.rich) for (const x of [-17.5, 17.5]) { t.box('green', x, -2, 7.4, 3.4, 0.5, 22); t.hedge(x, -12, 7.9, 3.4, 0.8); }
      t.canopy(0, 17, 5.4, 18, 4.4, 'steel');
      if (t.rich) { t.tree(-17.5, 15, 0.6, 0.9); t.tree(17.5, 15, 0.6, 0.9); t.flag(-8, 15.5, 0.6, 7); t.flag(8, 15.5, 0.6, 7); }
    },
    (h, t) => { // Broadcast tower and studios: a concrete shaft with an observation pod and a lattice mast over studio blocks.
      t.box('stone', 0, 0, 0, 40, 0.6, 40);
      t.box('stone', -7, 8, 0.6, 26, 12, 22, '#e4dfd6');
      t.windows(-7, 8, 0.6, 26, 12, 22, { inset: 6, pane: 1.4 });
      t.cap(-7, 8, 12.6, 26.6, 22.6, 0.7);
      t.box('lamp', -7, 19.2, 10, 14, 2, 0.3);
      for (const [x, z] of t.rich ? [[-16, 2], [-8, 0], [0, 2]] : [[-8, 0]]) { t.box('dark', x, z, 13.3, 0.4, 2.4, 0.4); t.part('accent', x, 16.4, z, 2.6, 1, 2.6, 'dome', 0, '#f4f2ec'); }
      t.box('stone', 12, 12, 0.6, 12, 7, 14, '#dcdad3'); t.box('dark', 12, 19.05, 0.6, 5, 4.4, 0.4, '#8a9096');
      const shaftH = h * 0.66, cx = 8, cz = -8;
      t.cyl('stone', cx, cz, 0.6, 3.6, shaftH, '#e9e4dc');
      t.box('stone', cx, cz, 0.6, 12, 5, 12, '#e4dfd6'); t.pane('glass', cx, cz + 6.05, 3, 10, 3);
      t.cyl('accent', cx, cz, shaftH - 4, 8.6, 0.6); t.cyl('glass', cx, cz, shaftH - 3.4, 8.2, 4.4); t.cyl('accent', cx, cz, shaftH + 1, 8.6, 0.6);
      if (t.rich) for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4; t.box('lamp', cx + Math.sin(a) * 8.5, cz + Math.cos(a) * 8.5, shaftH + 1.6, 0.5, 0.5, 0.5); }
      t.cyl('stone', cx, cz, shaftH + 1.6, 2.4, 3, '#e9e4dc');
      const mastH = h - shaftH - 4.6 - 1.4;
      t.box('steel', cx, cz, shaftH + 4.6, 1.2, mastH, 1.2);
      for (const share of [0.25, 0.5, 0.75]) t.box('accent', cx, cz, shaftH + 4.6 + mastH * share, 2.4, 0.5, 2.4, '#d0473c');
      if (t.rich) for (const share of [0.3, 0.6]) for (const sx of [-1, 1]) t.box('steel', cx + sx * 1.4, cz, shaftH + 4.6 + mastH * share, 1.6, 0.25, 0.25);
      t.box('lamp', cx, cz, h - 1.4, 1.2, 1.2, 1.2);
      t.box('sand', -4, -14, 0.6, 24, 0.15, 8, '#cfcbc0');
      if (t.rich) for (const [x, c] of [[-12, '#eee8d8'], [-6, '#f4f2ec'], [0, '#65747d']]) { t.box('car', x, -14, 0.5, 2.3, 1.6, 5, c); t.box('tint', x, -12, 1.9, 2, 0.8, 1.2); }
      for (const [x, z] of t.rich ? [[-17, 17], [17, 17], [-17, -17], [17, -17]] : [[-17, 17], [17, -17]]) t.tree(x, z, 0.6, 0.9);
      for (const x of [-14, 14]) t.lampPost(x, 19.5);
    },
    (h, t) => { // Convention twin towers: a glass exhibition hall with a barrel roof under two violet towers of unequal height, joined by a sky garden.
      t.box('stone', 0, 0, 0, 42, 0.6, 38);
      const hallH = 11;
      t.box('stone', 0, 6, 0.6, 40, hallH, 24, '#e4dfd6');
      t.pane('glass', 0, 18.05, 5.6, 34, 8); t.door(0, 18.1, 0.6, 6, 5);
      t.columns(0, 19.4, 0.6, hallH, t.rich ? 11 : 5, t.rich ? 3.4 : 8, 'x', 0.45);
      t.box('accent', 0, 19.4, hallH + 0.6, 38, 0.8, 3);
      t.part('steel', 0, hallH + 1.2, 6, 20, 5, 12, 'dome');
      t.cap(0, 6, hallH + 0.6, 41, 25, 0.8);
      t.box('lamp', 0, 18.2, hallH - 2.2, 16, 1.6, 0.3);
      const heights = { '-10.5': h * 0.82 - hallH - 0.6, '10.5': h - hallH - 1.4 };
      for (const x of [-10.5, 10.5]) {
        const hgt = heights[String(x)];
        t.box('violet', x, -6, hallH + 0.6, 13, hgt, 18);
        t.box('tint', x + (x < 0 ? -6.7 : 6.7), -6, hallH + 0.6, 0.4, hgt, 8);
        t.windows(x, -6, hallH + 0.6, 13, hgt, 18, { sides: x < 0 ? 'fbl' : 'fbr', inset: 5, pane: 1.4 });
        if (t.rich) for (const share of [0.3, 0.6]) t.box('accent', x, -6, hallH + 0.6 + hgt * share, 13.4, 1.2, 18.4);
        t.cap(x, -6, hallH + 0.6 + hgt, 13.8, 18.8, 0.8);
      }
      const bridge = 0.6 + h * 0.5;
      t.box('tint', 0, -6, bridge - 3, 8.2, 3, 10); t.cap(0, -6, bridge - 3.5, 8.6, 10.4, 0.5); t.cap(0, -6, bridge, 8.6, 10.4, 0.5);
      t.box('green', 0, -6, bridge + 0.5, 7, 0.5, 8); t.hedge(0, -10, bridge + 1, 7, 0.6);
      if (t.rich) { t.tree(-1.5, -5, bridge + 1, 0.6); t.tree(2, -8, bridge + 1, 0.5); }
      t.helipad(-10.5, -6, h * 0.82 + 0.8, 5);
      t.mast(10.5, -6, h + 0.8, h * 0.08);
      if (t.rich) { t.penthouse(13, -12, h + 0.8, 5, 2.6, 4); for (const sx of [-1, 1]) t.box('lamp', 10.5 + sx * 6.2, 2.4, h + 0.8, 0.7, 0.7, 0.7); }
      for (const x of [-16, 16]) { t.oct('stone', x, 17, 0.6, 2.4, 0.8); t.oct('water', x, 17, 1.4, 2, 0.15); }
      if (t.rich) { t.flag(-8, 19.5, 0.6, 8); t.flag(8, 19.5, 0.6, 8); t.tree(-19, 0, 0.6, 0.9); t.tree(19, 0, 0.6, 0.9); }
      for (const x of [-14, 14]) t.lampPost(x, 19.5);
    },
  ],
  champion: [
    (h, t, c) => { // Crown palace HQ: spired headquarters tower with annex, parking, plant hall and yard.
      const podiumH = h * 0.09, podiumTop = 0.6 + podiumH;
      t.box('stone', 0, 0, 0, 40, 0.6, 38);
      t.box('sand', 0, 0, 0.6, 38, podiumH, 32);
      t.columns(0, 16.8, 0.6, Math.max(1, podiumH - 1), t.rich ? 17 : 5, t.rich ? 1.8 : 7.2, 'x', 0.55);
      if (t.rich) for (const x of [-19.8, 19.8]) t.columns(x, 0, 0.6, Math.max(1, podiumH - 1), 9, 3, 'z', 0.5);
      t.box('sand', 0, 16.8, podiumTop - 1, 32, 1, 2.4);
      t.cap(0, 0, podiumTop, 39, 33, 0.9);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const px = sx * 16.5, pz = sz * 13.5; t.oct('sand', px, pz, podiumTop + 0.9, 2.6, 3.4); t.cone('accent', px, pz, podiumTop + 4.3, 2.8, 3.2); if (t.rich) t.box('lamp', px, pz, podiumTop + 7.5, 0.6, 0.6, 0.6); }
      t.door(0, 16.05, 0.6, 5, 5); t.steps(0, 18, 0, 18, 3);
      const shaftH = h * 0.66, shaftTop = podiumTop + shaftH;
      t.box('stone', 0, 0, podiumTop, 22, shaftH, 22);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.box('tint', sx * 9.6, sz * 9.6, podiumTop, 3, shaftH, 3);
      for (const side of [-1, 1]) { t.box('tint', 0, side * 11.15, podiumTop, 5, shaftH, 0.4); t.box('tint', side * 11.15, 0, podiumTop, 0.4, shaftH, 5); }
      const floors = t.windows(0, 0, podiumTop, 22, shaftH, 22, { inset: 9, pane: 1.4 });
      if (t.rich) for (let f = 2; f < floors; f += 2) t.box('accent', 0, 0, podiumTop + f * shaftH / floors, 22.4, 0.25, 22.4);
      for (const share of [0.33, 0.66]) t.box('accent', 0, 0, podiumTop + shaftH * share, 22.8, 1.8, 22.8);
      for (const x of [-6, 6]) { t.box('accent', x, 11.2, podiumTop, 0.5, shaftH, 0.5); t.box('accent', x, -11.2, podiumTop, 0.5, shaftH, 0.5); }
      t.oct('accent', 0, 0, shaftTop, 14.5, h * 0.03);
      const crownBase = shaftTop + h * 0.03;
      for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4 + OCT; const sx = Math.sin(a) * 10.5, sz = Math.cos(a) * 10.5; t.cone('accent', sx, sz, crownBase, 2.6, h * 0.18, 'spire', 0); if (t.rich) t.box('lamp', sx, sz, crownBase + h * 0.18, 0.6, 0.6, 0.6); }
      t.oct('sand', 0, 0, crownBase, 5.5, h * 0.06); t.cone('sand', 0, 0, crownBase + h * 0.06, 5, h * 0.2);
      t.box('dark', 0, 0, crownBase + h * 0.26, 0.35, h * 0.05, 0.35); t.box('lamp', 0, 0, crownBase + h * 0.31, 1, 1, 1);
      t.oct('stone', 0, 18, 0.6, 2.6, 0.8); t.oct('water', 0, 18, 1.4, 2.2, 0.15);
      if (t.rich) { t.flag(-18, 18, 0.6, 8); t.flag(18, 18, 0.6, 8); for (const x of [-13, 13]) t.tree(x, 18.5, 0.6, 0.9); }
      c.parking(44, -32, 40, 56, t.rich ? 8 : 3);
      c.annex(44, 14, 36, 22, 12);
      c.lawnSign(44, 48, 40, 24);
      c.factoryHall(-26, 44, 60, 28, t.rich ? 5 : 3);
      c.stack(-62, 34, 34); c.tanks(6, 62, 2, 3.6);
      c.trucks(-46, 60, t.rich ? 3 : 1);
      c.fenceAndGate(60, 62);
    },
    (h, t, c) => { // Royal beacon factory: glass needle beside sawtooth halls, stacks, cooling tower and tank farm.
      t.box('stone', 0, 0, 0, 40, 0.6, 40);
      t.box('stone', 0, 0, 0.6, 36, 5, 36);
      t.pane('glass', 0, 18.05, 3.2, 30, 3.4); t.pane('glass', 18.05, 0, 3.2, 30, 3.4, Math.PI / 2); t.pane('glass', -18.05, 0, 3.2, 30, 3.4, -Math.PI / 2);
      t.columns(0, 19.4, 0.6, 5, t.rich ? 17 : 5, t.rich ? 2 : 8, 'x', 0.45);
      t.cap(0, 0, 5.6, 37, 37, 0.8);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { t.oct('stone', sx * 15.5, sz * 15.5, 6.4, 2.4, 2.4); t.cone('accent', sx * 15.5, sz * 15.5, 8.8, 2.6, h * 0.05); }
      const sections = [[26, 0.26], [20, 0.25], [15, 0.19], [10, 0.12]];
      let base = 5.6;
      sections.forEach(([w, share], i) => {
        const hgt = h * share;
        t.curtain(0, 0, base, w, hgt, w, 'tint', 4.2);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.box('steel', sx * (w / 2 - 0.2), sz * (w / 2 - 0.2), base, 0.6, hgt, 0.6);
        if (t.rich && i < 2) for (const sx of [-1, 1]) { t.box('accent', 0, sx * (w / 2 + 0.05), base, 3, hgt, 0.35); t.box('accent', sx * (w / 2 + 0.05), 0, base, 0.35, hgt, 3); }
        t.cap(0, 0, base + hgt, w + 0.8, w + 0.8, 0.7);
        base += hgt + 0.7;
        if (i === 1 || i === 2) {
          const r = i === 1 ? 12.5 : 9;
          t.cyl('glass', 0, 0, base, r, 3); t.cyl('accent', 0, 0, base - 0.5, r + 0.4, 0.5); t.cyl('accent', 0, 0, base + 3, r + 0.4, 0.5);
          if (t.rich) for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4; t.box('lamp', Math.sin(a) * (r + 0.2), Math.cos(a) * (r + 0.2), base + 3.5, 0.5, 0.5, 0.5); }
          base += 3.5;
        }
      });
      t.cone('accent', 0, 0, base, 5, h * 0.1);
      t.box('dark', 0, 0, base + h * 0.1, 0.35, h * 0.07, 0.35); t.box('lamp', 0, 0, base + h * 0.17, 1, 1, 1);
      t.canopy(0, 19.2, 4.8, 18, 3.6, 'steel'); t.door(0, 18.1, 0.6, 4, 4);
      for (const x of [-12, 12]) t.lampPost(x, 19.5);
      if (t.rich) { for (const [x, z] of [[-18.5, 18.5], [18.5, 18.5], [-18.5, -18.5], [18.5, -18.5]]) t.tree(x, z, 0.6, 0.8); t.flag(-16, 19, 0.6, 7); t.flag(16, 19, 0.6, 7); }
      c.factoryHall(44, -38, 40, 26, t.rich ? 5 : 3); c.factoryHall(44, -8, 40, 26, t.rich ? 5 : 3);
      c.coolingTower(44, 30, 12, 26);
      c.stack(34, 54, 44); c.stack(46, 58, 52); c.stack(58, 50, 38);
      c.tanks(-56, 34, 4, 4.2);
      if (c.rich) c.pipeRack(-60, 44, 70);
      c.truckYard(-28, 56, 60, 18, c.rich ? 3 : 1);
      c.fenceAndGate(-60, 62);
    },
    (h, t, c) => { // Global HQ campus: wide curtain-wall slab with sky deck, data hall, solar field and research wing.
      t.box('stone', 0, 0, 0, 40, 0.6, 40);
      t.box('stone', 0, 0, 0.6, 36, 6, 30);
      t.pane('glass', 0, 15.05, 3.6, 30, 4); t.pane('glass', 18.05, 0, 3.6, 24, 4, Math.PI / 2); t.pane('glass', -18.05, 0, 3.6, 24, 4, -Math.PI / 2);
      t.columns(0, 16.4, 0.6, 6, t.rich ? 17 : 9, t.rich ? 2 : 4, 'x', 0.45);
      t.cap(0, 0, 6.6, 37, 31, 0.8);
      const slabH = h - 7.4;
      t.curtain(0, -2, 6.6, 30, slabH, 16, 'tint', 4);
      t.box('stone', -16.5, -2, 6.6, 5, slabH + 4, 16);
      if (t.rich) for (let x = -12; x <= 12; x += 3) { t.box('steel', x, 6.15, 6.6, 0.35, slabH, 0.35); t.box('steel', x, -10.15, 6.6, 0.35, slabH, 0.35); }
      for (const share of [0.25, 0.5, 0.75]) t.box('accent', 0, -2, 6.6 + slabH * share, 30.4, 1.6, 16.4);
      const deck = 6.6 + slabH * 0.8;
      t.box('tint', 3, -2, deck, 34, 3.4, 18); t.cap(3, -2, deck - 0.5, 34.6, 18.6, 0.5); t.cap(3, -2, deck + 3.4, 34.6, 18.6, 0.5);
      for (const x of [-15, 15]) t.box('steel', x, -2, h - 0.4, 0.5, h * 0.06, 16.4);
      t.box('lamp', 0, 6.35, h - 5, 14, 4, 0.5); t.box('lamp', 0, -10.35, h - 5, 14, 4, 0.5);
      t.helipad(6, -2, h - 0.4, 4.5);
      t.mast(-16.5, -2, h + 3.6, h * 0.06);
      t.box('glass', 0, 12, 0.6, 24, 8, 8); t.cap(0, 12, 8.6, 24.6, 8.6, 0.5);
      t.canopy(0, 17.4, 5.2, 16, 3.6, 'steel'); t.door(0, 16.05, 0.6, 4.4, 4.4);
      if (t.rich) { t.tree(-17, 17, 0.6, 0.9); t.tree(17, 17, 0.6, 0.9); t.flag(-8, 18.5, 0.6, 7); t.flag(8, 18.5, 0.6, 7); }
      c.dataHall(44, -30, 40, 50);
      c.solarField(44, 24, 40, 26);
      c.parking(44, 52, 40, 20, c.rich ? 5 : 2);
      c.annex(-20, 40, 44, 24, 9, true);
      c.pond(-52, 50, 7);
      c.lawnSign(4, 56, 28, 18);
      c.fenceAndGate(60, 62);
    },
    (h, t, c) => { // Power plant: turbine hall, two cooling towers, four stacks, substation and coal yard.
      c.box('sand', 0, 0, 0.4, 130, 0.2, 130, '#cfcbc0');
      c.factoryHall(-20, -22, 76, 34, c.rich ? 6 : 3);
      c.coolingTower(-38, 30, 24, 56); c.coolingTower(12, 30, 24, 56);
      [[36, -44, h], [46, -44, h * 0.9], [56, -44, h * 0.8], [46, -28, h * 0.7]].forEach(([x, z, hgt]) => c.stack(x, z, hgt));
      c.box('stone', 46, -6, 0.4, 28, 10, 20, '#dcdad3');
      c.box('accent', 46, -6, 10.4, 28.4, 0.6, 20.4, CHAMPION_ACCENT);
      if (c.rich) for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { c.box('steel', 34 + i * 8, 20 + j * 12, 0.4, 0.5, 7, 0.5); c.box('steel', 34 + i * 8, 20 + j * 12, 7.4, 4, 0.5, 0.5); c.box('dark', 34 + i * 8, 26 + j * 12, 0.4, 2.4, 2.6, 2.4); }
      c.box('steel', 50, 26, 0.4, 0.5, 9, 0.5); c.box('steel', 50, 26, 5, 0.5, 0.5, 30);
      c.part('dark', -40, 4, -52, 24, 8, 12, 'hill', 0, '#3b3b3b'); c.box('steel', -20, -46, 3.4, 40, 0.8, 1.2); if (c.rich) for (let i = 0; i < 4; i++) c.box('dark', -34 + i * 10, -46, 0.4, 0.4, 3, 0.4);
      c.tanks(-56, 58, 3, 4);
      c.parking(20, 58, 40, 12, c.rich ? 5 : 2);
      c.fenceAndGate(60, 62);
    },
    (h, t, c) => { // Ring campus: a glass ring of eight wings around a central tower, park inside, solar and parking outside.
      const ringH = 12, r = 46, w = 2 * r * Math.tan(Math.PI / 8) - 2;
      c.box('green', 0, 0, 0.4, 130, 0.25, 130, '#b9c9a4');
      for (let j = 0; j < 8; j++) {
        const a = j * Math.PI / 4, x = Math.sin(a) * r, z = Math.cos(a) * r;
        c.part('tint', x, 0.4 + ringH / 2, z, w, ringH, 14, 'box', a);
        c.part('steel', x, 0.4 + ringH * 0.5, z, w + 0.2, 0.3, 14.2, 'box', a);
        c.part('accent', x, 0.9 + ringH, z, w + 0.4, 0.6, 14.4, 'box', a, CHAMPION_ACCENT);
        c.part('green', x, 1.5 + ringH, z, w - 2, 0.4, 11, 'box', a);
        if (c.rich) c.part('steel', x, 0.4, z, w + 0.2, 0.3, 14.2, 'box', a);
      }
      const towerH = h - 1;
      c.box('tint', 0, 0, 0.6, 22, towerH, 22);
      const floors = Math.min(c.budget.floors, Math.max(2, Math.floor(towerH / 5)));
      for (let f = 1; f < floors; f++) c.box('steel', 0, 0, 0.6 + f * towerH / floors - 0.14, 22.3, 0.28, 22.3);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.box('steel', sx * 10.7, sz * 10.7, 0.6, 0.7, towerH, 0.7);
      for (const share of [0.33, 0.66]) c.box('accent', 0, 0, 0.6 + towerH * share, 22.6, 1.6, 22.6, CHAMPION_ACCENT);
      c.cap(0, 0, 0.6 + towerH, 22.8, 22.8, 0.8); c.box('lamp', 0, 11.2, h - 5, 12, 3.4, 0.4); c.helipad(0, 0, h + 0.4, 5); c.mast(-8, -8, h + 0.4, h * 0.05);
      c.oct('stone', 22, 0, 0.6, 7, 0.8); c.oct('water', 22, 0, 1.4, 6.2, 0.15);
      const trees = c.rich ? [[-24, 0], [-18, 16], [-18, -16], [16, 20], [16, -20], [0, 26], [0, -26], [26, 14]] : [[-24, 0], [0, 26], [0, -26]];
      for (const [x, z] of trees) c.tree(x, z, 0.65, 1.2);
      c.solarField(-50, 58, 28, 12); c.solarField(50, 58, 28, 12);
      c.parking(0, 60, 44, 10, c.rich ? 6 : 2);
      c.parking(-58, 0, 12, 40, c.rich ? 4 : 1); c.parking(58, 0, 12, 40, c.rich ? 4 : 1);
      c.lawnSign(0, -60, 40, 10);
      c.fenceAndGate(30, 63);
    },
    (h, t, c) => { // Space centre campus: a crowned mission-control tower, assembly hall, launch gantry with a rocket, fuel tanks and a solar field.
      t.box('stone', 0, 0, 0, 40, 0.6, 38);
      t.box('sand', 0, 0, 0.6, 36, 6, 32);
      t.pane('glass', 0, 16.05, 3.4, 30, 4); t.door(0, 16.1, 0.6, 5, 4.6);
      t.columns(0, 17.4, 0.6, 6, t.rich ? 15 : 5, t.rich ? 2.2 : 6.6, 'x', 0.5);
      t.cap(0, 0, 6.6, 37, 33, 0.9);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { t.cyl('stone', sx * 15, sz * 13, 6.6, 2.4, 3, '#e9e4dc'); t.part('accent', sx * 15, 9.6, sz * 13, 2.5, 1.4, 2.5, 'dome'); }
      const shaftH = h * 0.64, shaftTop = 6.6 + shaftH;
      t.box('stone', 0, 0, 6.6, 20, shaftH, 20, '#e9e4dc');
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.box('tint', sx * 8.8, sz * 8.8, 6.6, 2.4, shaftH, 2.4);
      const floors = t.windows(0, 0, 6.6, 20, shaftH, 20, { inset: 7.5, pane: 1.4, pitch: 3.8 });
      if (t.rich) for (let f = 2; f < floors; f += 2) t.box('accent', 0, 0, 6.6 + f * shaftH / floors, 20.4, 0.25, 20.4);
      for (const share of [0.3, 0.6]) t.box('accent', 0, 0, 6.6 + shaftH * share, 20.8, 1.8, 20.8);
      t.box('lamp', 0, 10.2, shaftTop - 4, 12, 3, 0.3); t.box('lamp', 0, -10.2, shaftTop - 4, 12, 3, 0.3);
      t.oct('accent', 0, 0, shaftTop, 13.5, h * 0.03);
      const crownBase = shaftTop + h * 0.03;
      for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4 + OCT, sx = Math.sin(a) * 10, sz = Math.cos(a) * 10; t.cone('accent', sx, sz, crownBase, 2.4, h * 0.16, 'spire', 0); if (t.rich) t.box('lamp', sx, sz, crownBase + h * 0.16, 0.6, 0.6, 0.6); }
      // 중앙 첨탑은 발사 대기 중인 로켓 형태다. 흰 동체에 강조색 띠와 뾰족한 코를 둔다.
      t.cyl('stone', 0, 0, crownBase, 4.2, h * 0.14, '#f3eee4'); t.cyl('accent', 0, 0, crownBase + h * 0.05, 4.3, 1.6, '#d0473c');
      t.cone('accent', 0, 0, crownBase + h * 0.14, 4.2, h * 0.1, 'cone', OCT, '#f3eee4');
      t.box('dark', 0, 0, crownBase + h * 0.24, 0.35, h * 0.04, 0.35); t.box('lamp', 0, 0, crownBase + h * 0.28, 1, 1, 1);
      t.oct('stone', 0, 18, 0.6, 2.6, 0.8); t.oct('water', 0, 18, 1.4, 2.2, 0.15);
      if (t.rich) { t.flag(-17, 17, 0.6, 8); t.flag(17, 17, 0.6, 8); for (const x of [-12, 12]) t.tree(x, 18, 0.6, 0.9); }
      c.factoryHall(44, -38, 40, 26, c.rich ? 5 : 3);
      // 발사대는 동쪽 띠다. 강철 격자탑 옆에 로켓이 서고, 연료 탱크와 배관은 남서쪽에 둔다.
      c.box('sand', 44, 4, 0.4, 40, 0.15, 40, '#cfcbc0');
      c.box('steel', 38, 4, 0.4, 3, 42, 3); for (const y of [12, 24, 36]) c.box('steel', 43, 4, y, 8, 0.6, 0.6);
      if (c.rich) for (const y of [6, 18, 30]) c.box('dark', 38, 4, y, 4.6, 0.4, 4.6);
      c.cyl('stone', 50, 4, 0.4, 3.2, 30, '#f3eee4'); c.cyl('accent', 50, 4, 12, 3.3, 1.6, '#d0473c'); c.cone('accent', 50, 4, 30.4, 3.2, 8, 'cone', OCT, '#f3eee4');
      for (const [dx, dz] of [[-4.5, 0], [4.5, 0], [0, -4.5], [0, 4.5]]) c.box('dark', 50 + dx, 4 + dz, 0.4, dz ? 1 : 3, 4, dz ? 3 : 1);
      c.box('dark', 50, 4, 0.4, 12, 1.6, 12); if (c.rich) c.box('lamp', 38, 4, 42.4, 1, 1, 1);
      c.solarField(44, 44, 40, 22);
      c.tanks(-56, 50, 3, 4.2);
      if (c.rich) c.pipeRack(-58, 58, 44);
      c.parking(-4, 56, 44, 12, c.rich ? 5 : 2);
      c.lawnSign(30, 58, 24, 10);
      c.fenceAndGate(60, 62);
    },
  ],
};

// 그랜드마스터는 마스터의 검증된 실루엣을 전용 색상과 높이로 확장한다.
MODELS.grandmaster = MODELS.master;

/** Campus facilities for the champion lot, authored in full-scale coordinates. */
function campusTools(c, accent) {
  const rich = c.rich;
  const factoryHall = (x, z, w, d, bays) => {
    c.box('stone', x, z, 0.4, w, 9, d, '#e2ded4');
    c.box('accent', x, z, 6.2, w + 0.2, 1.4, d + 0.2, accent);
    const bw = w / bays;
    for (let i = 0; i < bays; i++) c.part('roof', x - w / 2 + bw * (i + 0.5), 9.4 + 1.8, z, bw, 3.6, d, 'gable', 0, '#8f9ea4');
    for (const dx of [-w / 4, w / 4]) c.box('dark', x + dx, z + d / 2 + 0.03, 0.4, 7, 5.5, 0.6);
    if (rich) for (let i = 0; i < 3; i++) c.box('steel', x - w / 3 + i * w / 3, z - d / 4, 13, 1.6, 1.8, 1.6);
  };
  const stack = (x, z, hgt) => { c.cyl('stone', x, z, 0.4, 2.2, hgt, '#c9c2b8'); c.cyl('accent', x, z, hgt - 3, 2.3, 2, '#d0473c'); c.box('lamp', x, z, hgt + 0.4, 0.9, 0.9, 0.9); };
  const coolingTower = (x, z, r, hgt) => { c.part('stone', x, 0.4 + hgt / 2, z, r, hgt, r, 'trunk', 0, '#d9d4cb'); c.cyl('dark', x, z, hgt - 0.2, r * 0.62, 0.6); };
  const tanks = (x, z, count, r) => { for (let i = 0; i < count; i++) { const tx = x + i * (r * 2 + 2.5); c.cyl('steel', tx, z, 0.4, r, 7); c.part('steel', tx, 7.4, z, r, 1.4, r, 'dome'); } };
  const pipeRack = (x, z, len) => { for (let i = 0; i < 3; i++) c.box('steel', x + len / 2, z + i * 0.9, 3.2, len, 0.5, 0.5); for (let p = 0; p <= len; p += len / 4) c.box('dark', x + p, z + 0.9, 0.4, 0.4, 3.2, 2.4); };
  const car = (x, z, color, rotation = 0) => { c.box('car', x, z, 0.5, 2.1, 1.2, 4.2, color, rotation); c.box('tint', x, z, 1.7, 1.8, 0.7, 2.2, undefined, rotation); };
  const COLORS = ['#eee8d8', '#bb785f', '#7298a0', '#d4b768', '#65747d'];
  const parking = (x, z, w, d, count) => {
    c.box('sand', x, z, 0.4, w, 0.15, d, '#cfcbc0');
    if (rich) for (let i = 0; i <= 6; i++) c.box('marking', x - w / 2 + 3 + i * (w - 6) / 6, z, 0.56, 0.3, 0.04, d - 6);
    for (let i = 0; i < count; i++) car(x - w / 2 + 4.5 + i * (w - 9) / Math.max(1, count - 1), z + (i % 2 ? d / 4 : -d / 4), COLORS[i % COLORS.length]);
    for (const sx of [-1, 1]) c.lampPost(x + sx * (w / 2 - 2), z);
  };
  const truck = (x, z, color) => { c.box('car', x, z, 0.5, 2.7, 1.7, 7.4, color); c.box('tint', x, z + 2.4, 1.6, 2.4, 1.1, 1.4); c.box('sand', x, z - 1, 0.5, 2.8, 2.7, 4.6); };
  const trucks = (x, z, count) => { for (let i = 0; i < count; i++) truck(x + i * 5, z, COLORS[(i + 1) % COLORS.length]); };
  const truckYard = (x, z, w, d, count) => { c.box('sand', x, z, 0.4, w, 0.15, d, '#cfcbc0'); for (let i = 0; i < count; i++) truck(x - w / 2 + 8 + i * 9, z, COLORS[(i + 2) % COLORS.length]); c.lampPost(x + w / 2 - 2, z); };
  const solarField = (x, z, w, d) => {
    c.box('green', x, z, 0.4, w, 0.25, d);
    const rows = rich ? 5 : 2;
    for (let i = 0; i < rows; i++) { const pz = z - d / 2 + (i + 0.5) * d / rows; c.box('tint', x, pz, 1.4, w - 4, 0.3, 3.2); c.box('dark', x, pz, 0.6, w - 4, 0.8, 0.3); }
  };
  const annex = (x, z, w, d, hgt, greenRoof = false) => {
    c.box('stone', x, z, 0.4, w, hgt, d);
    c.cap(x, z, 0.4 + hgt, w + 0.4, d + 0.4, 0.5);
    const floors = Math.min(c.budget.floors, Math.max(1, Math.floor(hgt / 3.4)));
    for (let f = 0; f < floors; f++) { const y = 0.4 + (f + 0.5) * hgt / floors; c.pane('glass', x, z + d / 2 + 0.03, y, w - 4, 1.4); c.pane('glass', x, z - d / 2 - 0.03, y, w - 4, 1.4, Math.PI); }
    if (greenRoof) { c.box('green', x, z, 0.9 + hgt, w - 4, 0.5, d - 4); if (rich) c.helipad(x + w / 4, z, 1.4 + hgt, 4); }
    else if (rich) for (let i = 0; i < 3; i++) c.box('steel', x - w / 3 + i * w / 3, z - d / 4, 0.9 + hgt, 1.6, 1.2, 1.6);
    c.door(x, z + d / 2 + 0.02, 0.4, 3.4, 3.4);
  };
  const dataHall = (x, z, w, d) => {
    c.box('stone', x, z, 0.4, w, 8, d, '#dcdad3');
    c.box('accent', x, z, 8.4, w + 0.4, 0.5, d + 0.4, accent);
    c.box('lamp', x, z + d / 2 + 0.05, 5.2, w - 8, 0.6, 0.3);
    if (rich) for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) c.box('steel', x - w / 2 + 6 + i * (w - 12) / 3, z - d / 2 + 8 + j * (d - 16) / 2, 8.9, 3, 1.8, 3);
    for (const dz of [-d / 3, d / 3]) c.box('dark', x + w / 2 + 0.03, z + dz, 0.4, 0.6, 4.4, 5);
  };
  const lawnSign = (x, z, w, d) => {
    c.box('green', x, z, 0.4, w, 0.3, d);
    c.box('accent', x, z, 0.7, w * 0.45, 5, 1, accent);
    c.box('lamp', x, z + 0.55, 2.4, w * 0.3, 2.2, 0.3);
    c.hedge(x, z - d / 2 + 1, 0.7, w - 2, 1);
    for (const sx of [-1, 1]) c.tree(x + sx * (w / 2 - 4), z + d / 4, 0.7, 1.1);
  };
  const pond = (x, z, r) => { c.oct('stone', x, z, 0.4, r + 0.8, 0.8); c.oct('water', x, z, 1.2, r, 0.15); for (let j = 0; j < (rich ? 4 : 2); j++) { const a = j * Math.PI / 2 + Math.PI / 4; c.tree(x + Math.sin(a) * (r + 4), z + Math.cos(a) * (r + 4), 0.4, 0.9 + (j % 2) * 0.3); } };
  const fenceAndGate = (gx, gz) => {
    for (const s of [-1, 1]) { c.box('steel', 0, s * 65, 0.4, 130, 1.4, 0.15); c.box('steel', s * 65, 0, 0.4, 0.15, 1.4, 130); }
    c.box('stone', gx, gz, 0.4, 5, 3.2, 4); c.box('accent', gx, gz, 3.6, 5.6, 0.4, 4.6, accent);
    const dir = gx > 0 ? -1 : 1;
    c.box('dark', gx + dir * 5, gz, 0.4, 0.3, 1.3, 0.3); c.box('accent', gx + dir * 8.5, gz, 1.6, 7, 0.25, 0.25, '#d0473c');
  };
  return { ...c, factoryHall, stack, coolingTower, tanks, pipeRack, parking, trucks, truckYard, solarField, annex, dataHall, lawnSign, pond, fenceAndGate };
}

/** 티어별 실제 모델 개수다. 티어마다 변형 수가 달라질 수 있어 modelVariant.js 가
 * 해시 분산과 model_variant 유효성 검사에 이 값을 쓴다. */
export function variantCountOf(tier) {
  const models = MODELS[String(tier || 'bronze').toLowerCase()];
  return models ? models.length : MODELS_PER_TIER;
}

export function addTierBuilding(tier, variant, h, part, budget) {
  const models = MODELS[tier];
  if (!models || !models[variant]) return false;
  const lot = lotOf(tier);
  part('pavement', 0, -0.05, 0, lot, 0.4, lot);
  const scaled = planScaler(part, lot / planLotOf(tier));
  if (tier === 'champion') {
    // The tower keeps its half-scale plan, shifted to the north-west; the campus fills the rest of the lot.
    const shifted = (mat, x, y, z, w, hgt, d, shape, rotation, color) => scaled(mat, x + CHAMPION_TOWER[0], y, z + CHAMPION_TOWER[1], w, hgt, d, shape, rotation, color);
    const t = tools(shifted, budget, 2), c = tools(scaled, budget, 1);
    models[variant](h, t, campusTools(c, CHAMPION_ACCENT));
    return true;
  }
  const t = tools(scaled, budget, FULL_PLAN[tier]?.includes(variant) ? 1 : 2);
  models[variant](h, t);
  return true;
}

/** 실루엣 전용 도구. base 는 바닥 높이고 part() 는 중심 높이를 받으므로 hgt/2 를 더한다.
 * cap 은 accent 재질을 쓰고 색을 넘기지 않는다. 호출부(cityModels.buildArchitecture)가
 * accent 재질일 때 TIER_COLORS 를 자동으로 실어 준다.
 */
function siloTools(part) {
  const box = (mat, x, z, base, w, hgt, d, shape = 'box', rotation = 0) => part(mat, x, base + hgt / 2, z, w, hgt, d, shape, rotation);
  const cap = (x, z, base, w, hgt, d, shape = 'box', rotation = 0) => part('accent', x, base + hgt / 2, z, w, hgt, d, shape, rotation);
  return { box, cap };
}

/** 먼 타일용 티어별 축약형. 몸통 하나와 상부 표식 한둘로 README 의 실루엣을 남긴다.
 * h 는 이미 ELO 와 티어 배율이 적용된 값이라 다시 곱하지 않는다. 변형(variant)에 관계없이
 * 티어 하나당 모양 하나다. 평면 치수는 각 티어 부지(lotOf)의 70~80% 를 덮는 값이라 필지 사이
 * 골목(ALLEY)에 닿지 않는다. octagon, spire 는 단위 반지름 도형이라 scale 이 지름이 아니라 반지름이다.
 */
const SILHOUETTES = {
  // 벽돌 몸체와 박공지붕, 강조색 굴뚝.
  bronze: (h, part) => {
    const { box, cap } = siloTools(part);
    const roofH = Math.min(4, h * 0.16), bodyH = h - roofH, chimneyH = Math.min(3, h * 0.12);
    box('brick', 0, 0, 0, 39, bodyH, 27);
    box('roof', 0, 0, bodyH, 40.5, roofH, 28.5, 'gable');
    cap(12, 7.5, h - chimneyH, 3, chimneyH, 3);
  },
  // 발코니 타워 몸체와 옥상 정원 자리의 강조색 띠.
  silver: (h, part) => {
    const { box, cap } = siloTools(part);
    const capH = Math.min(2.4, h * 0.08), bodyH = h - capH;
    box('stone', 0, 0, 0, 39.6, bodyH, 27);
    cap(0, 0, bodyH, 34.2, capH, 21.6);
  },
  // 위로 갈수록 좁아지는 3단.
  gold: (h, part) => {
    const { box, cap } = siloTools(part);
    const capH = Math.min(3, h * 0.12), midH = h * 0.32, baseH = Math.max(1, h - midH - capH);
    box('stone', 0, 0, 0, 40, baseH, 33.3);
    box('sand', 0, 0, baseH, 28.3, midH, 23.3);
    cap(0, 0, baseH + midH, 15, capH, 13.3);
  },
  // 본체를 한쪽으로 밀어 비대칭을 만들고 반대쪽에 녹화 단을 붙인다.
  platinum: (h, part) => {
    const { box, cap } = siloTools(part);
    const capH = Math.min(2.4, h * 0.1), bodyH = h - capH, terraceH = Math.max(1.5, h * 0.07);
    box('stone', -5.1, 0, 0, 34, bodyH, 28.9);
    box('green', 10.2, 5.1, bodyH * 0.45, 15.3, terraceH, 11.9);
    cap(-5.1, 0, bodyH, 22.1, capH, 17);
  },
  // 팔각 유리 몸체와 뾰족한 첨탑.
  diamond: (h, part) => {
    const { box, cap } = siloTools(part);
    const spireH = Math.min(10, h * 0.2), bodyH = h - spireH;
    box('glass', 0, 0, 0, 24, bodyH, 24, 'octagon', OCT);
    cap(0, 0, bodyH, 6, spireH, 6, 'spire');
  },
  // 높이가 다른 두 몸체와 그 사이를 잇는 강조색 연결부.
  master: (h, part) => {
    const { box, cap } = siloTools(part);
    const towerAH = h * 0.72, bridgeY = towerAH * 0.62;
    box('stone', -15, 0, 0, 21, towerAH, 21);
    box('stone', 15, 0, 0, 18, h, 18);
    cap(0, 0, bridgeY, 18, 2.2, 9);
  },
  // 중앙 타워 하나와 모서리 네 곳의 왕관 첨탑.
  champion: (h, part) => {
    const { box, cap } = siloTools(part);
    const plateH = Math.min(1.6, h * 0.03), crownH = Math.min(14, h * 0.14), bodyH = Math.max(1, h - plateH - crownH);
    const spireBase = bodyH + plateH;
    box('tint', 0, 0, 0, 80, bodyH, 80);
    cap(0, 0, bodyH, 73.3, plateH, 73.3);
    for (const [dx, dz] of [[-26.7, -26.7], [26.7, -26.7], [-26.7, 26.7], [26.7, 26.7]]) cap(dx, dz, spireBase, 8, crownH, 8, 'spire');
  },
};
// 그랜드마스터는 마스터의 실루엣을 그대로 쓰고 accent 색만 자기 티어 색으로 자동 교체된다.
SILHOUETTES.grandmaster = SILHOUETTES.master;

/** 부지 포장. addTierBuilding 과 같은 크기지만 pane(평면) 은 Y축 회전만 받는 배치
 * 파이프라인에서 바닥에 눕힐 수 없어 box 를 쓴다. */
export function addTierSilhouette(tier, h, part) {
  const build = SILHOUETTES[tier];
  if (!build) return false;
  const lot = lotOf(tier);
  part('pavement', 0, -0.05, 0, lot, 0.4, lot);
  build(h, part);
  return true;
}
