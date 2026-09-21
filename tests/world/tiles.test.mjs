import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateDrawCalls, fitTileSize, tileBatches, tileCells, TILE_DRAW_BUDGET } from '../../src/world/cityTiles.js';
import { buildArchitecture, buildLodArchitecture } from '../../src/world/cityModels.js';
import { buildUrbanScenery } from '../../src/world/UrbanScenery.js';
import { countInstances } from '../../src/world/shapes.js';

const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'champion'];
const EXTENT = 2150;
// 1000명을 도시 폭에 고르게 흩는다. 실제 배치보다 넓게 퍼지므로 타일 수는 보수적으로 나온다.
const crowd = () => Array.from({ length: 1000 }, (_, i) => {
  const angle = i * 2.399, radius = EXTENT * 0.9 * Math.sqrt((i % 100) / 100);
  return { id: `c${i}`, x: Math.round(Math.cos(angle) * radius), z: Math.round(Math.sin(angle) * radius),
    height: 20 + (i % 11) * 20, tier_name: TIERS[i % TIERS.length] };
});

test('tiling keeps every part and puts it inside its own tile', () => {
  const batches = buildArchitecture(crowd().slice(0, 60), 'medium');
  const tiles = tileBatches(batches, 200);
  assert.equal(countInstances(tiles), countInstances(batches));
  for (const tile of tiles) {
    assert.ok(tile.parts.length > 0);
    for (const part of tile.parts) {
      assert.equal(Math.floor(part.position[0] / 200), tile.tx);
      assert.equal(Math.floor(part.position[2] / 200), tile.tz);
      assert.ok(Math.abs(part.position[0] - tile.x) <= 100);
      assert.ok(Math.abs(part.position[2] - tile.z) <= 100);
    }
  }
});

test('tiling is deterministic and a bigger tile never makes more meshes', () => {
  const batches = buildArchitecture(crowd().slice(0, 200), 'medium');
  assert.deepEqual(tileBatches(batches, 300), tileBatches(batches, 300));
  assert.ok(tileBatches(batches, 600).length <= tileBatches(batches, 300).length);
  assert.equal(tileBatches(batches, 0).length, tileBatches(batches, 1).length);
});

const levelsOf = (rows, size) => ['near', 'mid', 'far']
  .map((level) => tileBatches(buildLodArchitecture(rows, 'medium', level), size));

test('every cell carries all three detail levels so exactly one can stay visible', () => {
  const rows = crowd().slice(0, 300);
  const cells = tileCells(levelsOf(rows, 400));
  assert.ok(cells.length > 1, 'the city must span more than one tile');
  for (const cell of cells) {
    assert.equal(cell.levels.length, 3);
    // 먼 단계는 가까운 단계의 부분집합이라 상세가 없는 셀은 생기지 않아야 한다.
    assert.ok(cell.levels[0].length > 0, `cell ${cell.key} has a reduced level without any detail`);
    assert.ok(cell.levels[2].length <= cell.levels[0].length, 'far must never need more draw calls than near');
    assert.ok(cell.radius > 0);
    for (const tile of cell.levels.flat()) { assert.equal(tile.tx, cell.tx); assert.equal(tile.tz, cell.tz); }
  }
});

test('one thousand creators at medium stay inside the tile draw budget', () => {
  const rows = crowd();
  const near = buildArchitecture(rows, 'medium');
  const landscape = buildUrbanScenery(rows, EXTENT, 'medium', false).batches;
  const reserve = Object.keys(landscape).length + 1;
  const lod = 460;
  const far = buildLodArchitecture(rows, 'medium', 'far');
  const size = fitTileSize(near, EXTENT, lod, TILE_DRAW_BUDGET - reserve, far);
  assert.ok(size > 0 && Number.isFinite(size));
  assert.ok(estimateDrawCalls(near, size, lod, far) + reserve <= TILE_DRAW_BUDGET, `draw budget exceeded at tile ${size}`);
  const cells = tileCells(levelsOf(rows, size));
  // 최악의 시점을 직접 센다. 반경 안 타일은 상세, 나머지는 윤곽이다.
  let worst = 0;
  for (const camera of [[0, 12, 0], [EXTENT / 2, 12, EXTENT / 2], [220, 260, 300], [0, 1400, 1600]]) {
    let calls = reserve;
    for (const cell of cells) {
      const distance = Math.hypot(camera[0] - cell.x, camera[1], camera[2] - cell.z) - cell.radius;
      calls += cell.levels[distance <= lod ? 0 : distance <= lod * 2.4 ? 1 : 2].length;
    }
    worst = Math.max(worst, calls);
  }
  assert.ok(worst <= TILE_DRAW_BUDGET, `worst-case draw calls ${worst}`);
});

test('a tile size that busts the budget grows instead of staying fine', () => {
  const near = buildArchitecture(crowd(), 'medium');
  const fine = EXTENT / 8;
  assert.ok(estimateDrawCalls(near, fine, 460) > TILE_DRAW_BUDGET);
  assert.ok(fitTileSize(near, EXTENT, 460) > fine);
});
