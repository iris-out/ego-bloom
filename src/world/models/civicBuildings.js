/** NPC civic buildings, each built around an origin (ox, oz) inside `size`
 * (width, depth). Same `add()` contract as createBatches: world position,
 * primitive scale, owner null. Placement and reservations belong to worldLayout.
 */
const OCT = Math.PI / 8;
const RED = '#d0473c', COPPER = '#7fa3a0', WHITE = '#f4f2ec', TRACK = '#c9705a', TRAIN = '#4a7cc4';

// Plans are authored at half scale: positions and masses wider than PROP_LIMIT double,
// props (cars, trees, posts, pane heights) keep their size.
const K = 2, PROP_LIMIT = 3.2;
function tools(add, ox, oz, quality) {
  const rich = quality !== 'low';
  const emit = (mat, x, y, z, w, hgt, d, kind, rotation, color) => {
    const keep = mat === 'car' || kind === 'tree' || kind === 'trunk';
    add(mat, [ox + x * K, y, oz + z * K], [keep || w < PROP_LIMIT ? w : w * K, hgt, keep || d < PROP_LIMIT ? d : d * K], null, kind, rotation, color);
  };
  const box = (mat, x, z, base, w, hgt, d, color, rotation = 0) => emit(mat, x, base + hgt / 2, z, w, hgt, d, 'box', rotation, color);
  const cyl = (mat, x, z, base, r, hgt, color) => emit(mat, x, base + hgt / 2, z, r, hgt, r, 'cylinder', 0, color);
  const oct = (mat, x, z, base, r, hgt, color) => emit(mat, x, base + hgt / 2, z, r, hgt, r, 'octagon', OCT, color);
  const shape = (mat, x, z, base, w, hgt, d, kind, rotation = 0, color) => emit(mat, x, base + hgt / 2, z, w, hgt, d, kind, rotation, color);
  const pane = (mat, x, z, y, w, hgt, rotation = 0) => emit(mat, x, y, z, w, hgt, 1, 'pane', rotation);
  const rows = (x, z, base, w, hgt, d, floors, sides = 'fb', inset = 3) => {
    for (let f = 0; f < floors; f++) {
      const y = base + (f + 0.5) * hgt / floors;
      if (sides.includes('f')) pane('glass', x, z + d / 2 + 0.03, y, w - inset, 1.3);
      if (sides.includes('b')) pane('glass', x, z - d / 2 - 0.03, y, w - inset, 1.3, Math.PI);
      if (sides.includes('r')) pane('glass', x + w / 2 + 0.03, z, y, d - inset, 1.3, Math.PI / 2);
      if (sides.includes('l')) pane('glass', x - w / 2 - 0.03, z, y, d - inset, 1.3, -Math.PI / 2);
    }
  };
  const door = (x, z, base, w = 3, hgt = 3, rotation = 0) => box('dark', x, z, base, w, hgt, 0.9, undefined, rotation);
  const tree = (x, z, size = 1) => { shape('wood', x, z, 0.4, 0.7, 4, 0.7, 'trunk'); shape('leaf', x, z, 3.8, 3.8 * size, 5 * size, 3.8 * size, 'tree'); };
  const lamp = (x, z) => { box('dark', x, z, 0.4, 0.22, 5.4, 0.22); box('lamp', x, z, 5.8, 1, 0.6, 1); };
  const bench = (x, z, rotation = 0) => { box('wood', x, z, 0.9, 3, 0.3, 1.2, undefined, rotation); box('wood', x, z - Math.cos(rotation) * 0.55, 1.3, 3, 0.9, 0.2, undefined, rotation); };
  const flag = (x, z, hgt = 9) => { box('dark', x, z, 0.4, 0.22, hgt, 0.22); box('accent', x + 1.1, z, hgt - 1.2, 2, 1.2, 0.08, RED); };
  const car = (x, z, color, rotation = 0) => { box('car', x, z, 0.5, 2.6, 1.3, 5, color, rotation); box('tint', x, z, 1.8, 2.2, 0.8, 2.8, undefined, rotation); };
  const plate = (w, d, mat = 'pavement', color) => box(mat, 0, 0, 0, w, 0.4, d, color);
  const hedge = (x, z, w, d) => box('green', x, z, 0.4, w, 0.9, d);
  return { rich, box, cyl, oct, shape, pane, rows, door, tree, lamp, bench, flag, car, plate, hedge };
}

export const CIVIC_BUILDINGS = {
  fire: {
    name: '소방서', size: [104, 88],
    build(add, ox, oz, quality) {
      const t = tools(add, ox, oz, quality);
      t.plate(52, 44);
      t.box('stone', -6, -4, 0.4, 30, 9, 22, WHITE);
      for (const x of [-15, -6, 3]) { t.box('accent', x, 7.1, 0.4, 6.5, 6.5, 0.2, RED); if (t.rich) for (let i = 1; i < 4; i++) t.box('dark', x, 7.22, 0.4 + i * 1.6, 6.5, 0.12, 0.1); }
      t.box('accent', -6, -4, 8.4, 31, 1, 23, RED);
      t.box('stone', -6, -4, 9.4, 30.4, 0.5, 22.4);
      t.box('sand', 16, -6, 0.4, 14, 8, 16);
      t.rows(16, -6, 0.6, 14, 7.6, 16, 2, 'fr');
      t.box('accent', 16, -6, 8.4, 14.6, 0.6, 16.6, RED);
      t.box('brick', -20, -13, 0.4, 5, 21, 5);
      t.box('accent', -20, -13, 21.4, 5.8, 0.8, 5.8, RED);
      t.box('lamp', -20, -13, 22.2, 1, 1, 1);
      t.box('accent', -6, 9, 10.4, 8, 2.2, 0.3, RED);
      t.flag(22, 6);
      t.box('sand', 4, 13, 0.4, 42, 0.15, 14);
      t.box('car', 0, 13, 0.5, 3.4, 2.2, 9, RED);
      t.box('tint', 0, 16.6, 1.6, 3, 1.2, 1.6);
      t.box('steel', 0, 12, 2.7, 0.6, 0.3, 3.1);
      t.box('lamp', 0, 17.5, 2.75, 2.2, 0.35, 0.4);
      if (t.rich) { t.car(9, 13, WHITE); t.box('accent', 20, 18, 0.4, 0.6, 1.1, 0.6, RED); t.tree(-22, 16); t.tree(23, -14, 0.9); t.lamp(-20, 6); }
    },
  },
  hospital: {
    name: '병원', size: [112, 96],
    build(add, ox, oz, quality) {
      const t = tools(add, ox, oz, quality);
      t.plate(56, 48);
      t.box('stone', 0, -6, 0.4, 34, 18, 20, WHITE);
      t.rows(0, -6, 0.4, 34, 18, 20, t.rich ? 5 : 3, 'fbrl', 4);
      t.box('accent', 0, -6, 18.4, 34.6, 0.6, 20.6, WHITE);
      t.box('accent', 0, 4.2, 14.5, 1.3, 5, 0.3, RED); t.box('accent', 0, 4.2, 16.35, 5, 1.3, 0.3, RED);
      t.cyl('dark', 6, -8, 19, 5.5, 0.3); t.cyl('accent', 6, -8, 19.3, 4.5, 0.08, WHITE); t.cyl('dark', 6, -8, 19.32, 3.6, 0.08);
      for (const x of [-1.2, 1.2]) t.box('accent', 6 + x, -8, 19.4, 0.6, 0.06, 3.4, WHITE); t.box('accent', 6, -8, 19.4, 2.4, 0.06, 0.6, WHITE);
      t.box('stone', -8, -8, 19, 5, 2.6, 4, WHITE); t.box('dark', -12, -12, 19, 0.3, 4, 0.3);
      t.box('stone', -16, 8, 0.4, 20, 9, 16, WHITE);
      t.rows(-16, 8, 0.4, 20, 9, 16, 2, 'fl', 3);
      t.box('accent', -16, 8, 9.4, 20.6, 0.6, 16.6, WHITE);
      t.box('accent', -16, 18, 5.6, 14, 0.5, 6, RED);
      for (const x of [-22, -10]) for (const z of [15.5, 20.5]) t.cyl('stone', x, z, 0.4, 0.4, 5.2);
      t.door(-16, 16.1, 0.4, 4, 3.6);
      t.pane('glass', 0, 4.05, 2.6, 16, 3.8); t.door(0, 4.1, 0.4, 3.6, 3.4);
      t.box('accent', 0, 6.5, 4.6, 12, 0.4, 5, WHITE);
      t.box('sand', 14, 14, 0.4, 24, 0.15, 14);
      t.box('car', 12, 14, 0.5, 2.6, 2.2, 6, WHITE); t.box('accent', 12, 14, 1.6, 2.7, 0.5, 6.1, RED); t.box('tint', 12, 17.2, 1.8, 2.2, 1, 1.4);
      if (t.rich) { t.car(19, 14, '#c7d2d8'); t.car(24, 14, '#6b7f8a'); t.tree(-24, -18); t.tree(24, -18, 0.9); t.tree(24, 5); t.lamp(-6, 20); t.lamp(6, 20); t.hedge(-6, -18, 40, 1.2); }
    },
  },
  school: {
    name: '학교', size: [128, 100],
    build(add, ox, oz, quality) {
      const t = tools(add, ox, oz, quality);
      t.plate(64, 50);
      t.box('sand', 0, -16, 0.4, 42, 11, 12);
      t.rows(0, -16, 0.4, 42, 11, 12, 3, 'fb', 4);
      if (t.rich) for (const x of [-14, -7, 0, 7, 14]) t.box('stone', x, -9.9, 0.4, 0.7, 11, 0.4);
      t.box('accent', 0, -16, 11.4, 42.6, 0.6, 12.6, '#8b9ea6');
      t.box('stone', -17, -16, 0.4, 5, 17, 5);
      t.pane('lamp', -17, -13.45, 14.5, 3, 3); t.shape('roof', -17, -16, 17.4, 5.8, 2.4, 5.8, 'pyramid');
      t.box('accent', 0, -9, 3.8, 8, 0.4, 3, '#8b9ea6'); t.door(0, -9.9, 0.4, 3, 3.2);
      t.box('stone', 22, 4, 0.4, 18, 8, 16); t.shape('roof', 22, 4, 8.4, 19, 3, 17, 'gable');
      t.pane('glass', 22, 12.05, 5.5, 14, 2);
      t.box('sand', -10, 10, 0.4, 36, 0.15, 26);
      t.oct('accent', -10, 10, 0.55, 13, 0.12, TRACK); t.oct('green', -10, 10, 0.67, 10, 0.1);
      for (const x of [-19, -1]) { t.box('dark', x, 10, 0.75, 0.2, 2.4, 3.2); t.box('dark', x, 10, 3.1, 0.2, 0.2, 3.2); }
      t.flag(8, -6);
      if (t.rich) { t.tree(-29, -22); t.tree(-29, 20); t.tree(29, 20, 0.9); t.bench(8, 20); t.bench(14, 20); t.lamp(-30, 0); t.lamp(30, -10); }
    },
  },
  cityhall: {
    name: '시청', size: [300, 260],
    build(add, ox, oz, quality) {
      const t = tools(add, ox, oz, quality);
      const GOLD = '#c9ad5e';
      t.plate(150, 130);
      // 기단.
      t.box('stone', 0, -25, 0.4, 95, 20, 65, WHITE);
      t.rows(0, -25, 0.4, 95, 20, 65, 4, 'fbrl', 6);
      t.box('stone', 0, -25, 20.4, 97, 1, 67, WHITE);
      // 열주와 박공. 기단 앞쪽(양의 z) 에 선다.
      for (const x of [-36, -28, -20, -12, -4, 4, 12, 20, 28, 36]) t.cyl('stone', x, 11, 0.4, 1, 34);
      t.box('stone', 0, 11, 34.4, 80, 2, 6, WHITE);
      t.shape('sand', 0, 11, 36.4, 84, 9, 10, 'gable');
      t.box('stone', 0, 12, 0.4, 60, 0.6, 10, WHITE); t.box('stone', 0, 14.5, 0.4, 64, 0.3, 6, WHITE);
      t.door(0, 7.6, 0.4, 6, 8);
      // 상부 몸통. 기단 위로 솟아 옥상 파라펫을 이룬다.
      t.box('stone', 0, -25, 21.4, 45, 39, 35, WHITE);
      t.rows(0, -25, 21.4, 45, 39, 35, 6, 'fbrl', 5);
      t.box('stone', 0, -25, 60.4, 46, 1, 36, WHITE);
      // 돔과 첨탑. 몸통 중앙에서 최고점까지 이어진다.
      t.cyl('stone', 0, -25, 61.4, 7, 8, WHITE);
      t.cyl('glass', 0, -25, 69.2, 7.1, 1.6);
      t.shape('accent', 0, -25, 69.4, 8, 16, 8, 'dome', 0, COPPER);
      t.cyl('accent', 0, -25, 85.4, 1.2, 10, COPPER);
      t.box('lamp', 0, -25, 95.4, 0.8, 1.6, 0.8);
      // 돔 테두리를 두른 첨탑 관. 옥상 위 디테일을 더한다.
      for (let j = 0; j < 16; j++) {
        const a = (j / 16) * Math.PI * 2;
        t.shape('accent', Math.sin(a) * 8, -25 + Math.cos(a) * 8, 87, 1, 6, 1, 'spire', 0, COPPER);
      }
      // ZETA 글자. 파라펫 앞쪽(z=-8) 에 세운다. add 의 rotation 은 Y 축뿐이라 세워 둔 글자
      // 평면 안에서 획을 기울일 수 없다. 대각선은 짧은 박스를 계단으로 쌓아 만든다.
      // 대각선 없는 Z 는 Z 로 읽히지 않으므로 획 수를 늘리더라도 계단을 쓴다.
      const LETTER_BASE = 61.4, LETTER_W = 13, STROKE = 3.5, DEPTH = 3.2, ADVANCE = 17;
      const DIAGONAL_STEPS = 7;
      const diagonal = (x0, y0, x1, y1) => {
        const rects = [];
        for (let step = 0; step < DIAGONAL_STEPS; step++) {
          const t0 = step / DIAGONAL_STEPS, t1 = (step + 1) / DIAGONAL_STEPS;
          const cx = x0 + (x1 - x0) * (t0 + t1) / 2;
          // 계단 칸이 서로 닿도록 세로를 한 칸 높이만큼 잡고 가로는 획 두께를 유지한다.
          rects.push([cx - STROKE / 2, cx + STROKE / 2, y0 + (y1 - y0) * t0, y0 + (y1 - y0) * t1]);
        }
        return rects;
      };
      const GLYPHS = {
        Z: [[0, LETTER_W, 28, 34], [0, LETTER_W, 0, 6], ...diagonal(STROKE / 2, 6, LETTER_W - STROKE / 2, 28)],
        E: [[0, STROKE, 0, 34], [0, LETTER_W, 28, 34], [0, LETTER_W - STROKE, 14, 20], [0, LETTER_W, 0, 6]],
        T: [[0, LETTER_W, 28, 34], [(LETTER_W - STROKE) / 2, (LETTER_W + STROKE) / 2, 0, 28]],
        A: [...diagonal(STROKE / 2, 0, LETTER_W / 2 - STROKE / 4, 34),
          ...diagonal(LETTER_W - STROKE / 2, 0, LETTER_W / 2 + STROKE / 4, 34),
          [STROKE / 2, LETTER_W - STROKE / 2, 12, 18]],
      };
      ['Z', 'E', 'T', 'A'].forEach((letter, i) => {
        const startX = (i - 1.5) * ADVANCE - LETTER_W / 2;
        for (const [x0, x1, y0, y1] of GLYPHS[letter]) {
          t.box('sign', startX + (x0 + x1) / 2, -8, LETTER_BASE + y0, x1 - x0, y1 - y0, DEPTH, GOLD);
        }
      });
      // 간판 뒤 벽면에 빛 웅덩이를 겹쳐 야간에 외벽으로 번지는 느낌을 낸다.
      // 가로등 바닥 웅덩이와 같은 glow 재질, 같은 additive 처리를 그대로 쓴다.
      t.pane('glow', 0, -7.55, LETTER_BASE + 17, 74, 38, Math.PI);
      // 장식은 넓어진 부지 바깥으로 옮긴다.
      for (const x of [-40, 40]) t.flag(x, 15, 15);
      t.box('sand', 0, 45, 0.4, 44, 0.15, 14);
      t.oct('stone', 0, 45, 0.55, 10, 1.5); t.oct('water', 0, 45, 2.05, 9, 0.2); t.oct('stone', 0, 45, 2, 2, 4); t.oct('sand', 0, 45, 6, 4, 0.5);
      for (const x of [-60, 60]) for (const z of [-45, 35]) t.tree(x, z, 0.9);
      if (t.rich) { for (const x of [-20, 20]) { t.lamp(x, 40); t.bench(x, 34); } t.hedge(0, -60.5, 80, 1.2); }
    },
  },
  library: {
    name: '도서관', size: [100, 88],
    build(add, ox, oz, quality) {
      const t = tools(add, ox, oz, quality);
      t.plate(50, 44);
      t.box('stone', 0, 0, 0.4, 28, 5, 24);
      t.pane('glass', 0, 12.05, 2.9, 22, 3.6); t.door(0, 12.1, 0.4, 3.4, 3.4);
      t.box('tint', 3, -2, 5.4, 30, 9, 20);
      t.box('steel', 3, -2, 5.2, 30.4, 0.3, 20.4); t.box('steel', 3, -2, 14.4, 30.4, 0.4, 20.4);
      if (t.rich) for (let x = -9; x <= 15; x += 3) t.box('stone', x, 8.25, 5.4, 0.5, 9, 0.5);
      t.box('sand', -15, -8, 0.4, 10, 16, 10);
      for (const [y, color] of [[4, '#e2574c'], [8, '#3d7cc9'], [12, '#f0c34c']]) t.box('accent', -15, -8, y, 10.4, 0.7, 10.4, color);
      t.box('accent', -15, -8, 16.4, 10.6, 0.6, 10.6, '#8b9ea6');
      t.box('green', -6, 6, 5.4, 12, 0.5, 8); t.hedge(-6, 9.6, 12, 0.7);
      if (t.rich) { t.bench(-8, 5); t.bench(-3, 5); t.tree(-5, 3, 0.6); }
      t.box('sand', 2, 15, 0.4, 3, 6, 0.6, undefined, 0.42); t.box('sand', 2, 15, 0.4, 3, 6, 0.6, undefined, -0.42);
      t.box('stone', 2, 15, 0.4, 4.4, 0.7, 2.8);
      if (t.rich) { for (let i = 0; i < 4; i++) t.box('dark', 16 + i * 1.4, 15, 0.4, 0.15, 1, 1.6); t.tree(-21, 16); t.tree(21, 16, 0.9); t.tree(21, -16); t.lamp(-10, 18); t.lamp(12, 18); }
    },
  },
  station: {
    name: '역', size: [140, 96],
    build(add, ox, oz, quality) {
      const t = tools(add, ox, oz, quality);
      t.plate(70, 48);
      t.box('stone', -14, -4, 0.4, 26, 10, 18);
      t.pane('glass', -14, 5.05, 5.4, 22, 6);
      t.rows(-14, -4, 1, 26, 8, 18, 1, 'rl', 4);
      t.door(-14, 5.1, 0.4, 5, 4);
      t.shape('steel', -14, -4, 10.4, 28, 4, 20, 'gable');
      t.pane('lamp', -14, 5.1, 8.4, 2.6, 2.6);
      t.box('accent', -14, 5.4, 7.2, 3, 0.2, 3, WHITE);
      t.box('sand', 6, 12, 0.4, 56, 0.8, 8);
      for (let x = -18; x <= 30; x += 8) t.box('dark', x, 12, 1.2, 0.4, 5, 0.4);
      t.box('steel', 6, 12, 6.2, 56, 0.5, 10);
      t.box('accent', 6, 12, 6.7, 56.4, 0.3, 10.4, '#8b9ea6');
      for (const z of [18.2, 20.8]) t.box('dark', 0, z, 0.4, 62, 0.2, 0.35);
      if (t.rich) for (let x = -29; x <= 29; x += 3) t.box('wood', x, 19.5, 0.4, 0.6, 0.12, 3.4);
      [-12, 2, 16].forEach((x, i) => { t.box('accent', x, 19.5, 0.9, 12, 3.2, 3, TRAIN); t.box('tint', x, 21.05, 2.1, 10, 1, 0.2); t.box('tint', x, 17.95, 2.1, 10, 1, 0.2); t.box('steel', x, 19.5, 4.1, 12, 0.3, 2.6); if (i === 0) t.box('accent', -18.2, 19.5, 1.2, 0.5, 2.6, 2.6, '#e2574c'); });
      t.box('steel', -26, 10, 0.4, 0.3, 3.4, 0.3); t.box('steel', -26, 10, 3.8, 3, 0.2, 2.6); t.box('accent', -26, 10, 2.6, 3, 0.8, 0.2, TRAIN);
      if (t.rich) { t.car(-30, 2, '#f0c34c'); t.car(-30, -6, '#f0c34c'); t.tree(30, -14); t.tree(-30, -18, 0.9); t.lamp(-2, -4); t.lamp(10, -4); }
    },
  },
  stadium: {
    name: '경기장', size: [140, 140],
    build(add, ox, oz, quality) {
      const t = tools(add, ox, oz, quality);
      t.plate(70, 70);
      // Rings are eight rotated slabs so the bowl stays open above the pitch.
      const ring = (mat, r, thick, base, hgt, color) => { for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4; t.box(mat, Math.sin(a) * r, Math.cos(a) * r, base, 2 * r * Math.tan(Math.PI / 8) + thick * 0.4, hgt, thick, color, a); } };
      ring('stone', 31.5, 3.2, 0.4, 9);
      ring('accent', 31.6, 3.4, 9.4, 0.6, '#8b9ea6');
      ring('accent', 27.2, 5.6, 1.4, 5, '#c96f63');
      ring('accent', 23, 3.6, 1.2, 2.6, '#e0a48e');
      if (t.rich) ring('steel', 29.5, 7, 10.2, 0.5);
      t.oct('green', 0, 0, 0.4, 20.5, 1.2);
      t.oct('accent', 0, 0, 1.6, 3, 0.06, WHITE); t.oct('green', 0, 0, 1.62, 2.6, 0.06);
      for (const z of [-15, 15]) t.box('accent', 0, z, 1.6, 26, 0.06, 0.3, WHITE);
      for (const x of [-13, 13]) t.box('accent', x, 0, 1.6, 0.3, 0.06, 30, WHITE);
      for (const z of [-14, 14]) { t.box('dark', 0, z, 1.6, 4, 1.6, 0.15); t.box('dark', 0, z, 1.6, 0.15, 1.6, 1.2); }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { t.box('dark', sx * 27, sz * 27, 0.4, 0.7, 24, 0.7); t.box('lamp', sx * 27, sz * 27, 24.4, 4.5, 2.2, 0.5); }
      for (const [x, z, rot] of [[0, 33.5, 0], [33.5, 0, Math.PI / 2]]) t.box('accent', x, z, 0.4, 9, 6, 1.6, '#e2574c', rot);
      for (const x of [-4, 4]) t.box('dark', x, -32, 9.4, 0.4, 7, 0.4); t.box('lamp', 0, -32, 16.4, 10, 5, 0.5);
      if (t.rich) { for (const a of [0.4, 1.2, 2.0, 2.8, 3.6, 4.4, 5.2, 6.0]) t.lamp(Math.sin(a) * 34, Math.cos(a) * 34); }
    },
  },
  park: {
    name: '소공원', size: [68, 68],
    build(add, ox, oz, quality) {
      const t = tools(add, ox, oz, quality);
      t.plate(34, 34, 'green', '#c4d6a6');
      t.box('sand', 0, 0, 0.4, 30, 0.12, 3); t.box('sand', 0, 0, 0.4, 3, 0.12, 30);
      t.oct('stone', -8, -8, 0.4, 5.5, 0.6); t.oct('water', -8, -8, 1, 5, 0.15);
      t.oct('stone', 8, -8, 0.4, 3.8, 0.4);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) t.box('wood', 8 + sx * 2.6, -8 + sz * 2.6, 0.8, 0.3, 3, 0.3);
      t.shape('roof', 8, -8, 3.8, 8, 2.6, 8, 'pyramid');
      t.box('sand', 8, 8, 0.4, 8, 0.25, 8);
      t.box('dark', 6, 8, 0.65, 0.2, 2.4, 0.2); t.box('dark', 10, 8, 0.65, 0.2, 2.4, 0.2); t.box('wood', 8, 8, 3.05, 4.4, 0.2, 0.2);
      for (const x of [7, 9]) { t.box('wood', x, 8, 1.4, 0.7, 0.12, 0.4); t.box('dark', x, 8, 1.5, 0.08, 1.5, 0.08); }
      t.box('accent', 11, 6, 0.65, 1.4, 2.2, 1.4, '#f0c34c'); t.box('accent', 12.4, 6, 0.65, 1.2, 0.3, 4.4, '#f0c34c');
      const trees = [[-12.5, 12.5], [-6, 13], [-12.5, 5], [12.5, -12.5], [12.5, 12.5], [-12.5, -12.5], [4, -13], [-4, 6]];
      trees.forEach(([x, z], i) => { if (t.rich || i % 2 === 0) t.tree(x, z, 0.75 + (i % 3) * 0.15); });
      t.bench(-8, 4); t.bench(-8, -2.5, Math.PI);
      if (t.rich) { t.bench(8, -2.5, Math.PI); for (const [x, z] of [[-15, 0], [15, 0], [0, 15], [0, -15]]) t.lamp(x, z); for (const [x, z, c] of [[-3, -3, '#e2574c'], [3, -3, '#f0c34c'], [-3, 3, '#c58cff'], [3, 3, '#f08a3c']]) t.box('accent', x, z, 0.4, 2, 0.5, 2, c); }
    },
  },
  bank: {
    name: '은행', size: [104, 84],
    build(add, ox, oz, quality) {
      const t = tools(add, ox, oz, quality);
      const GOLD = '#c9ad5e';
      t.plate(52, 42);
      t.box('stone', 0, -6, 0.4, 30, 12, 20, WHITE);
      t.rows(0, -6, 0.4, 30, 12, 20, t.rich ? 3 : 2, 'rl', 4);
      t.box('accent', 0, -6, 12.4, 30.6, 0.6, 20.6, WHITE);
      for (const x of [-11, -6.5, -2, 2, 6.5, 11]) t.cyl('stone', x, 5.5, 0.4, 0.8, 10.6);
      t.box('stone', 0, 5.5, 11, 26, 0.8, 4);
      t.shape('sand', 0, 5.5, 11.8, 28, 3.4, 5.4, 'gable');
      for (let i = 0; i < 3; i++) t.box('stone', 0, 8.4 - i * 0.7, 0.4, 24 - i * 3, 0.5 * (3 - i), 3.2 - i * 0.8, WHITE);
      t.door(0, 4.6, 0.4, 4, 5.4);
      t.box('accent', 0, 4.7, 5.6, 12, 0.5, 5.8, GOLD);
      t.cyl('accent', -20, -14, 0.4, 0.6, 8, GOLD); t.box('lamp', -20, -14, 8.4, 1, 1, 1);
      t.flag(20, -14, 10);
      t.box('sand', 4, 14, 0.4, 34, 0.15, 12);
      t.box('car', 0, 14, 0.5, 3, 2.2, 7, '#8f97a1');
      if (t.rich) { t.car(9, 14, WHITE); t.tree(-24, 10); t.tree(24, 10, 0.9); t.lamp(-16, 16); t.lamp(16, 16); t.hedge(0, -16, 30, 1.2); }
    },
  },
  police: {
    name: '경찰서', size: [108, 88],
    build(add, ox, oz, quality) {
      const t = tools(add, ox, oz, quality);
      const BLUE = '#557ba0', SIREN_RED = '#c94b3e';
      t.plate(54, 44);
      t.box('stone', 0, -6, 0.4, 34, 9, 22, WHITE);
      t.rows(0, -6, 0.4, 34, 9, 22, t.rich ? 2 : 1, 'fbrl', 4);
      t.box('accent', 0, -6, 9.4, 34.6, 0.6, 22.6, WHITE);
      t.box('accent', 0, -6, 9.5, 34.8, 0.3, 1.6, BLUE);
      t.door(0, 4.9, 0.4, 4, 3.6);
      t.box('accent', 0, 5, 4.4, 8, 0.4, 5, BLUE);
      t.box('dark', 0, 9, 9.4, 0.3, 1.4, 0.3);
      t.box('accent', -1, 9, 10.6, 0.7, 0.4, 0.7, SIREN_RED); t.box('accent', 1, 9, 10.6, 0.7, 0.4, 0.7, BLUE);
      t.flag(-17, -15, 9);
      t.box('sand', 4, 14, 0.4, 40, 0.15, 12);
      t.car(-2, 14, WHITE); t.box('accent', -2, 14, 2.62, 3, 0.12, 4.4, BLUE);
      if (t.rich) { t.car(6, 14, WHITE); t.box('accent', 6, 14, 2.62, 3, 0.12, 4.4, BLUE); t.tree(-22, -18); t.tree(22, -18, 0.9); t.lamp(-18, 17); t.lamp(18, 17); }
    },
  },
};
