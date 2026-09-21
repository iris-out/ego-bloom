import test from 'node:test';
import assert from 'node:assert/strict';
import { buildArchitecture, buildLodArchitecture, buildSilhouetteArchitecture, lotSizeOf, QUALITY } from '../../src/world/cityModels.js';
import { lotOf, PLAN_SCALE } from '../../src/world/models/tierBuildings.js';

test('landmark geometry honors incoming heights above the former 70-unit limit', () => {
  for (const tier of ['champion', 'master']) {
    const batches = buildArchitecture([{ id: tier, x: 32, z: 32, height: 240, tier_name: tier }]);
    const parts = Object.values(batches).flatMap((batch) => batch.parts);
    const top = Math.max(...parts.map((part) => part.position[1] + part.scale[1] / 2));
    assert.ok(top >= 230 && top < 262, `${tier} roof height ${top}`);
    assert.ok(parts.every((part) => [...part.position, ...part.scale].every(Number.isFinite)));
  }
});

const TIERS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster', 'champion'];
// 이 shape 들이 티어 실루엣을 만든다. near 에 있었다면 far 에도 남아야 상자로 뭉개지지 않은 것이다.
const SILHOUETTE = ['gable', 'octagon', 'spire', 'cone', 'pyramid', 'dome'];
const flat = (batches) => Object.values(batches).flatMap((batch) => batch.parts.map((part) => ({ ...part, shape: batch.shape })));
// 가로수, 가로등 기둥, 울타리 살처럼 가느다란 것은 먼 거리에서 한 픽셀도 안 되므로 실루엣 비교에서 뺀다.
// 기준은 도면이 필지에 맞춰 줄어든 만큼 같이 줄인다. 안 그러면 축소된 도시에서 기둥이 통째로 빠진다.
const THIN = 1.2 * PLAN_SCALE;
const mass = (part) => part.shape !== 'tree' && part.shape !== 'trunk'
  && Math.min(Math.abs(part.scale[0]), Math.abs(part.scale[2])) >= THIN;
const box = (parts) => {
  const span = (i) => parts.reduce((max, part) => Math.max(max, Math.abs(part.position[i]) + Math.abs(part.scale[i]) / 2), 0);
  return { width: span(0), depth: span(2), top: Math.max(...parts.map((part) => part.position[1] + part.scale[1] / 2)) };
};

/** 먼 단계가 지우는 파트는 중간 치수가 farDrop 미만이다. 그런 조각으로 이뤄진 돌출부는
 * 실루엣을 한쪽에서 그만큼만 밀어낸다. 비율 허용치에 이 절대 허용치를 더해 판정한다.
 */
const SLACK = QUALITY.medium.farDrop * 2;

test('every tier and variant keeps its silhouette at the far detail level', () => {
  for (const tier of TIERS) for (let variant = 0; variant < 5; variant += 1) {
    const source = [{ id: `${tier}-${variant}`, x: 0, z: 0, height: 180, tier_name: tier, model_variant: variant }];
    const near = flat(buildLodArchitecture(source, 'medium', 'near'));
    const far = flat(buildLodArchitecture(source, 'medium', 'far'));
    const label = `${tier}/${variant}`;
    const a = box(near.filter(mass)), b = box(far.filter(mass));
    assert.ok(Math.abs(a.top - b.top) <= a.top * 0.05 + SLACK, `${label} roof height ${a.top} -> ${b.top}`);
    assert.ok(Math.abs(a.width - b.width) <= a.width * 0.05 + SLACK, `${label} width ${a.width} -> ${b.width}`);
    assert.ok(Math.abs(a.depth - b.depth) <= a.depth * 0.05 + SLACK, `${label} depth ${a.depth} -> ${b.depth}`);
    assert.ok(far.length >= 8 && far.length >= near.length * 0.12, `${label} far kept only ${far.length} of ${near.length}`);
    for (const shape of SILHOUETTE) if (near.some((part) => part.shape === shape)) {
      assert.ok(far.some((part) => part.shape === shape), `${label} lost every ${shape}`);
    }
    // 높이를 열 구간으로 나눠 구간별 최대 반폭을 비교한다. 계단식이나 쌍둥이 타워가 뭉개지면 여기서 잡힌다.
    const profile = (all) => Array.from({ length: 10 }, (_, band) => {
      const parts = all.filter(mass);
      const low = a.top * band / 10, high = a.top * (band + 1) / 10;
      return parts.filter((part) => part.position[1] + part.scale[1] / 2 > low && part.position[1] - part.scale[1] / 2 < high)
        .reduce((max, part) => Math.max(max, Math.abs(part.position[0]) + Math.abs(part.scale[0]) / 2), 0);
    });
    const near10 = profile(near), far10 = profile(far);
    for (let band = 0; band < 10; band += 1) {
      assert.ok(Math.abs(near10[band] - far10[band]) <= Math.max(near10[band], 1) * 0.15 + SLACK,
        `${label} band ${band} half-width ${near10[band]} -> ${far10[band]}`);
    }
  }
});

test('far detail drops the parts that cannot be seen and keeps the owner', () => {
  const source = [{ id: 'silver', x: -60, z: 24, height: 180, tier_name: 'silver' }];
  const near = flat(buildLodArchitecture(source, 'medium', 'near'));
  const mid = flat(buildLodArchitecture(source, 'medium', 'mid'));
  const far = flat(buildLodArchitecture(source, 'medium', 'far'));
  // 크기 기반 축소는 작은 파트를 걷어내는 방식이라, 파트가 전부 굵은 모델에서는
  // mid 와 far 가 같아질 수 있다. 그래도 far 가 mid 보다 비싸지면 안 된다.
  assert.ok(near.length > mid.length, `near ${near.length} mid ${mid.length}`);
  assert.ok(far.length <= mid.length, `far ${far.length} mid ${mid.length}`);
  assert.ok(far.every((part) => part.owner === 'silver'));
  assert.ok(far.every((part) => [...part.position, ...part.scale].every(Number.isFinite)));
  assert.deepEqual(far, flat(buildLodArchitecture(source, 'medium', 'far')));
  // 실제로 화면이 먼 거리에 쓰는 것은 티어 실루엣이다. 크기 축소가 못 줄이는 덩치까지 줄인다.
  const silhouette = flat(buildSilhouetteArchitecture(source));
  assert.ok(silhouette.length < far.length, `실루엣 ${silhouette.length} far ${far.length}`);
  assert.ok(silhouette.every((part) => part.owner === 'silver'));
});

test('lot size prefers the layout field and falls back to the tier default', () => {
  assert.equal(lotSizeOf({ tier_name: 'CHAMPION' }), lotOf('champion'));
  assert.equal(lotSizeOf({ tier_name: 'bronze' }), lotOf('bronze'));
  assert.equal(lotSizeOf({ tier_name: 'bronze', lot: 96 }), 96);
  assert.equal(lotSizeOf({ tier_name: 'bronze', lot: 0 }), lotOf('bronze'));
  assert.equal(lotSizeOf(undefined), lotOf('bronze'));
});
