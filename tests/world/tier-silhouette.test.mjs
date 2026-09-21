import test from 'node:test';
import assert from 'node:assert/strict';
import { addTierSilhouette } from '../../src/world/models/tierBuildings.js';
import { buildArchitecture, buildSilhouetteArchitecture, lodBands, TIER_COLORS, createBatches } from '../../src/world/cityModels.js';
import { lotOf } from '../../shared/lots.js';
import { countTriangles } from '../../src/world/shapes.js';

// WorldScene.useResources() 가 실제로 등록한 shape/material 전부다. 새 키를 추가하면 렌더가 터진다.
const ALLOWED_SHAPES = ['gable', 'box', 'pane', 'octagon', 'spire', 'tree', 'trunk', 'hill', 'cylinder', 'cone', 'pyramid', 'dome'];
const ALLOWED_MATERIALS = ['stone', 'brick', 'sand', 'violet', 'roof', 'dark', 'pavement', 'road', 'marking', 'water', 'bank', 'ground', 'green', 'leaf', 'wood', 'accent', 'glass', 'blueglass', 'lamp', 'car', 'pick', 'tint', 'steel'];

const TIERS = Object.keys(TIER_COLORS);

function collect(tier, h) {
  const { batches, add } = createBatches();
  const part = (mat, dx, y, dz, w, height, d, shape = 'box', rotation = 0, color) =>
    add(mat, [dx, y + 0.5, dz], [w, height, d], 'owner', shape, rotation, color);
  const built = addTierSilhouette(tier, h, part);
  return { built, parts: Object.values(batches).flatMap((batch) => batch.parts.map((part) => ({ ...part, shape: batch.shape, material: batch.material }))) };
}

test('모든 티어가 축약형에서 파트를 하나 이상 낸다', () => {
  for (const tier of TIERS) {
    const { built, parts } = collect(tier, 60);
    assert.ok(built, tier);
    assert.ok(parts.length > 0, tier);
  }
});

test('알 수 없는 티어는 실루엣도 거부한다', () => {
  assert.equal(addTierSilhouette('platinum-plus', 60, () => {}), false);
});

test('축약형은 몸통과 상부 표식 정도로 그친다 (파트 8개 이하)', () => {
  for (const tier of TIERS) {
    const { parts } = collect(tier, 120);
    assert.ok(parts.length <= 8, `${tier} uses ${parts.length} parts`);
  }
});

test('축약형의 모든 shape 과 material 은 허용 목록 안에 있다', () => {
  for (const tier of TIERS) for (const h of [12, 120, 230]) {
    const { parts } = collect(tier, h);
    for (const part of parts) {
      assert.ok(ALLOWED_SHAPES.includes(part.shape), `${tier} ${h}: unknown shape ${part.shape}`);
      assert.ok(ALLOWED_MATERIALS.includes(part.material), `${tier} ${h}: unknown material ${part.material}`);
    }
  }
});

test('축약형은 결정적이고, 모든 값이 유한하며 최고점이 h 부근이다', () => {
  for (const tier of TIERS) for (const h of [12, 60, 230]) {
    const first = collect(tier, h).parts, second = collect(tier, h).parts;
    assert.deepEqual(first, second, tier);
    for (const part of first) assert.ok([...part.position, ...part.scale, part.rotation].every(Number.isFinite), tier);
    const top = Math.max(...first.map((part) => part.position[1] + part.scale[1] / 2 - 0.5));
    assert.ok(top >= h * 0.9 && top <= h * 1.05, `${tier} h ${h} top ${top}`);
  }
});

test('grandmaster 는 master 의 실루엣 모양을 그대로 물려받는다', () => {
  const master = collect('master', 90).parts.map(({ material, shape, ...rest }) => ({ shape, ...rest }));
  const grandmaster = collect('grandmaster', 90).parts.map(({ material, shape, ...rest }) => ({ shape, ...rest }));
  assert.deepEqual(master, grandmaster);
});

test('accent 재질 파트는 buildSilhouetteArchitecture 를 거치면 티어 강조색을 싣는다', () => {
  for (const tier of TIERS) {
    const batches = buildSilhouetteArchitecture([{ id: tier, x: 0, z: 0, height: 90, tier_name: tier }]);
    const accentParts = Object.values(batches).flatMap((batch) => batch.material === 'accent' ? batch.parts : []);
    assert.ok(accentParts.length > 0, `${tier} has no accent part`);
    assert.ok(accentParts.every((part) => part.color === TIER_COLORS[tier]), `${tier} accent color mismatch`);
  }
});

test('buildSilhouetteArchitecture 는 owner 를 building id 로 유지한다', () => {
  const batches = buildSilhouetteArchitecture([{ id: 'abc-1', x: 10, z: -20, height: 90, tier_name: 'diamond' }]);
  const parts = Object.values(batches).flatMap((batch) => batch.parts);
  assert.ok(parts.length > 0);
  assert.ok(parts.every((part) => part.owner === 'abc-1'));
});

test('축약형은 원본 모델보다 삼각형을 극적으로 줄인다', () => {
  const rows = Array.from({ length: 1000 }, (_, i) => ({ id: String(i), x: (i % 40) * 32, z: Math.floor(i / 40) * 32, height: 20 + (i % 11) * 20, tier_name: TIERS[i % TIERS.length] }));
  const near = countTriangles(buildArchitecture(rows, 'low'));
  const silhouette = countTriangles(buildSilhouetteArchitecture(rows));
  assert.ok(silhouette < near * 0.15, `silhouette ${silhouette} not far below near ${near}`);
  // 몸통과 표식 한둘만 남기지만 그래도 상자 하나로 뭉개지지 않을 만큼은 남는다.
  assert.ok(silhouette > rows.length * 8, `silhouette ${silhouette} collapsed into almost nothing`);
});

test('축약형 평면은 제 부지 안에 든다', () => {
  // 원기둥 계열은 단위 반지름이라 scale 이 반지름이다. 지름으로 적으면 이웃 필지까지 먹는다.
  const RADIAL = new Set(['octagon', 'spire', 'trunk', 'cylinder', 'cone', 'pyramid', 'dome', 'tree', 'hill']);
  for (const tier of TIERS) {
    const lot = lotOf(tier);
    for (const part of collect(tier, 120).parts) {
      const k = RADIAL.has(part.shape) ? 1 : 0.5;
      const reachX = Math.abs(part.position[0]) + part.scale[0] * k, reachZ = Math.abs(part.position[2]) + part.scale[2] * k;
      assert.ok(reachX <= lot / 2 + 1e-6 && reachZ <= lot / 2 + 1e-6, `${tier} ${part.shape} 가 부지 ${lot} 밖으로 나간다`);
    }
  }
});

test('화질이 높을수록 실루엣으로 바뀌는 거리가 멀다', () => {
  for (const extent of [1400, 2164, 3000]) {
    const [low, medium, high] = ['low', 'medium', 'high'].map((quality) => lodBands(quality, extent).mid);
    assert.ok(low <= medium && medium <= high, `extent ${extent}: ${low} ${medium} ${high}`);
  }
});
