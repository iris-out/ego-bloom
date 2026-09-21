import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NPC_KINDS,
  NPC_LOT,
  pickNpcKind,
  addNpcBuilding,
  addNpcSilhouette,
} from '../../src/world/models/npcBuildings.js';
import { CIVIC_BUILDINGS } from '../../src/world/models/civicBuildings.js';
import { createBatches } from '../../src/world/cityModels.js';

// WorldScene.useResources() 가 실제로 등록한 shape/material 전부다. 새 키를 추가하면 렌더가 터진다.
const ALLOWED_SHAPES = ['gable', 'box', 'pane', 'octagon', 'spire', 'tree', 'trunk', 'hill', 'cylinder', 'cone', 'pyramid', 'dome'];
const ALLOWED_MATERIALS = ['stone', 'brick', 'sand', 'violet', 'roof', 'dark', 'pavement', 'road', 'marking', 'water', 'bank', 'ground', 'green', 'leaf', 'wood', 'accent', 'glass', 'blueglass', 'lamp', 'car', 'pick', 'tint', 'steel', 'glow', 'sign', 'shopfront'];
const RADIAL = ['cylinder', 'cone', 'octagon', 'spire', 'trunk', 'tree', 'dome', 'hill'];
const PART_LIMITS = { low: 7, medium: 16, high: 28 };
const DENSITIES = ['tower', 'dense', 'mixed', 'open'];

function collect(run) {
  const parts = [];
  const add = (material, position, scale, owner = null, shape = 'box', rotation = 0, color) => {
    parts.push({ material, position, scale, owner, shape, rotation, color });
  };
  run(add);
  return parts;
}

// 회전 적용 뒤 월드 좌표계에서의 반폭. RADIAL 은 단위 반지름이라 scale 을 그대로 쓴다.
function extents(part) {
  if (RADIAL.includes(part.shape)) return [part.scale[0], part.scale[2]];
  const w = part.scale[0] / 2, d = part.scale[2] / 2;
  const c = Math.abs(Math.cos(part.rotation)), s = Math.abs(Math.sin(part.rotation));
  return [c * w + s * d, s * w + c * d];
}

test('NPC_KINDS 의 모든 종류가 addNpcBuilding 과 addNpcSilhouette 에서 파트를 하나 이상 낸다', () => {
  for (const kind of NPC_KINDS) {
    const built = collect((add) => addNpcBuilding(add, kind, 0, 0, { seed: 1 }));
    assert.ok(built.length > 0, `${kind} building`);
    const silhouette = collect((add) => addNpcSilhouette(add, kind, 0, 0, { seed: 1 }));
    assert.ok(silhouette.length > 0, `${kind} silhouette`);
  }
});

test('모든 파트의 shape 과 material 은 허용 목록 안에 있다', () => {
  for (const kind of NPC_KINDS) {
    for (const quality of ['low', 'medium', 'high']) {
      const parts = collect((add) => addNpcBuilding(add, kind, 0, 0, { quality, seed: 3 }));
      for (const part of parts) {
        assert.ok(ALLOWED_SHAPES.includes(part.shape), `${kind} ${quality}: unknown shape ${part.shape}`);
        assert.ok(ALLOWED_MATERIALS.includes(part.material), `${kind} ${quality}: unknown material ${part.material}`);
      }
    }
    const silhouette = collect((add) => addNpcSilhouette(add, kind, 0, 0, { seed: 3 }));
    for (const part of silhouette) {
      assert.ok(ALLOWED_SHAPES.includes(part.shape), `${kind} silhouette: unknown shape ${part.shape}`);
      assert.ok(ALLOWED_MATERIALS.includes(part.material), `${kind} silhouette: unknown material ${part.material}`);
    }
  }
});

test('모든 position 과 scale 이 유한한 숫자이고 owner 는 null 이다', () => {
  for (const kind of NPC_KINDS) {
    const parts = collect((add) => addNpcBuilding(add, kind, 12, -34, { seed: 5, rotation: 0.7 }));
    for (const part of parts) {
      assert.ok([...part.position, ...part.scale, part.rotation].every(Number.isFinite), kind);
      assert.ok(part.scale.every((n) => n > 0), kind);
      assert.equal(part.owner, null, kind);
    }
  }
});

test('결정성: 같은 인자로 두 번 부르면 같은 파트 배열이 나오고, seed 가 다르면 달라지는 종류가 있다', () => {
  let anyDifferent = false;
  for (const kind of NPC_KINDS) {
    const first = collect((add) => addNpcBuilding(add, kind, 0, 0, { seed: 7 }));
    const second = collect((add) => addNpcBuilding(add, kind, 0, 0, { seed: 7 }));
    assert.deepEqual(first, second, kind);
    const other = collect((add) => addNpcBuilding(add, kind, 0, 0, { seed: 8 }));
    if (JSON.stringify(other) !== JSON.stringify(first)) anyDifferent = true;
  }
  assert.ok(anyDifferent, 'at least one kind should vary with seed');
});

test('부지 경계: 세 회전에서 모든 파트가 lot/2 안에 머문다', () => {
  const cx = 40, cz = -20;
  for (const kind of NPC_KINDS) {
    const lot = NPC_LOT[kind];
    for (const rotation of [0, 0.4, -1.1]) {
      for (const seed of [1, 2, 3]) {
        const parts = collect((add) => addNpcBuilding(add, kind, cx, cz, { lot, rotation, seed, quality: 'high' }));
        // 필지는 건물과 같이 돈다. 축정렬 상자로 재면 회전한 정사각형의 대각선이 튀어나와
        // 실제로는 이웃을 침범하지 않는데도 넘친 것으로 잡힌다. 필지 좌표계로 되돌려 잰다.
        // tools() 의 지역에서 월드로 가는 변환은 (cos, sin; -sin, cos) 다. 그 역변환을 쓴다.
        const cos = Math.cos(rotation), sin = Math.sin(rotation);
        for (const part of parts) {
          const dx = part.position[0] - cx, dz = part.position[2] - cz;
          const lx = dx * cos - dz * sin, lz = dx * sin + dz * cos;
          const [ex, ez] = extents({ ...part, rotation: (part.rotation || 0) - rotation });
          assert.ok(Math.abs(lx) + ex <= lot / 2 + 0.05, `${kind} rot ${rotation} seed ${seed} x overflow`);
          assert.ok(Math.abs(lz) + ez <= lot / 2 + 0.05, `${kind} rot ${rotation} seed ${seed} z overflow`);
        }
      }
    }
  }
});

test('quality 예산: addNpcBuilding 은 low<=7, medium<=16, high<=28 이고 low<=medium<=high 다', () => {
  for (const kind of NPC_KINDS) {
    const counts = ['low', 'medium', 'high'].map((quality) =>
      collect((add) => addNpcBuilding(add, kind, 0, 0, { quality, seed: 2 })).length);
    const [low, medium, high] = counts;
    assert.ok(low <= PART_LIMITS.low, `${kind} low uses ${low}`);
    assert.ok(medium <= PART_LIMITS.medium, `${kind} medium uses ${medium}`);
    assert.ok(high <= PART_LIMITS.high, `${kind} high uses ${high}`);
    assert.ok(low <= medium && medium <= high, `${kind}: ${low}/${medium}/${high}`);
  }
});

test('addNpcSilhouette 은 quality 와 무관하게 파트 두 개를 넘지 않는다', () => {
  for (const kind of NPC_KINDS) {
    for (const quality of ['low', 'medium', 'high']) {
      const parts = collect((add) => addNpcSilhouette(add, kind, 0, 0, { quality, seed: 4 }));
      assert.ok(parts.length <= 2, `${kind} ${quality} uses ${parts.length}`);
    }
  }
});

test('pickNpcKind 는 결정적이고 density 네 값 모두 유효한 키를 돌려준다', () => {
  for (const density of DENSITIES) {
    for (const seed of [0, 1, 2, 10, 999]) {
      const first = pickNpcKind(seed, { density });
      const second = pickNpcKind(seed, { density });
      assert.equal(first, second, `${density} seed ${seed}`);
      assert.ok(NPC_KINDS.includes(first), `${density} seed ${seed} -> ${first}`);
    }
  }
});

test('pickNpcKind 는 seed 에 따라 다른 종류를 낼 수 있다', () => {
  for (const density of DENSITIES) {
    const seen = new Set();
    for (let seed = 0; seed < 40; seed++) seen.add(pickNpcKind(seed, { density }));
    assert.ok(seen.size > 1, `${density} only produced ${[...seen]}`);
  }
});

test('civicBuildings 의 bank 와 police 가 존재하고 파트를 내며 허용 목록을 지킨다', () => {
  for (const key of ['bank', 'police']) {
    const civic = CIVIC_BUILDINGS[key];
    assert.ok(civic, `${key} missing from CIVIC_BUILDINGS`);
    assert.ok(typeof civic.name === 'string' && civic.name.length > 0, key);
    assert.ok(Array.isArray(civic.size) && civic.size.length === 2, key);
    for (const quality of ['low', 'high']) {
      const { batches, add } = createBatches();
      civic.build(add, 100, -50, quality);
      const parts = Object.values(batches).flatMap((batch) => batch.parts.map((part) => ({ ...part, shape: batch.shape, material: batch.material })));
      assert.ok(parts.length > 8, `${key} ${quality}`);
      for (const part of parts) {
        assert.equal(part.owner, null, key);
        assert.ok(ALLOWED_SHAPES.includes(part.shape), `${key}: unknown shape ${part.shape}`);
        assert.ok(ALLOWED_MATERIALS.includes(part.material), `${key}: unknown material ${part.material}`);
        assert.ok([...part.position, ...part.scale].every(Number.isFinite), key);
      }
    }
  }
});

// Task 8: ZETA 시청. 부지 300x260, 최고 96 짜리 도심 상징물로 키운다.
function buildCityhall(quality) {
  const { batches, add } = createBatches();
  CIVIC_BUILDINGS.cityhall.build(add, 0, 0, quality);
  return Object.values(batches).flatMap((batch) => batch.parts.map((part) => ({ ...part, shape: batch.shape, material: batch.material })));
}

test('cityhall 의 부지가 300x260 이다', () => {
  assert.deepEqual(CIVIC_BUILDINGS.cityhall.size, [300, 260]);
});

test('cityhall 은 low 와 high 품질 모두 파트를 100개 넘게 낸다', () => {
  for (const quality of ['low', 'high']) {
    const parts = buildCityhall(quality);
    assert.ok(parts.length > 100, `${quality}: ${parts.length}`);
  }
});

test('cityhall 의 모든 파트가 shape, material 허용 목록 안에 있다', () => {
  for (const quality of ['low', 'high']) {
    for (const part of buildCityhall(quality)) {
      assert.ok(ALLOWED_SHAPES.includes(part.shape), `unknown shape ${part.shape}`);
      assert.ok(ALLOWED_MATERIALS.includes(part.material), `unknown material ${part.material}`);
    }
  }
});

test('cityhall 의 최고점이 94 와 98 사이다', () => {
  for (const quality of ['low', 'high']) {
    const top = Math.max(...buildCityhall(quality).map((part) => part.position[1] + part.scale[1] / 2));
    assert.ok(top > 94 && top < 98, `${quality}: ${top}`);
  }
});

test('ZETA 글자가 옥상 높이 위에 있고 y 가 88 을 넘는 파트가 20개 이상이다', () => {
  for (const quality of ['low', 'high']) {
    const parts = buildCityhall(quality);
    const ROOF_Y = 60; // 상부 몸통 파라펫 높이. 글자와 왕관 장식이 이 위에 선다.
    const highParts = parts.filter((part) => part.position[1] > 88);
    assert.ok(highParts.length >= 20, `${quality}: ${highParts.length}`);
    // 글자는 sign 재질 box 로만 짓는다. 옥상 높이 위에서 sign box 를 세지 못하면 글자가 없는 것이다.
    const letterLike = parts.filter((part) => part.material === 'sign' && part.shape === 'box' && part.position[1] > ROOF_Y);
    assert.ok(letterLike.length >= 8, `${quality}: ${letterLike.length}`);
  }
});

test('cityhall 은 같은 인자로 두 번 부르면 같은 파트 배열이 나온다', () => {
  assert.deepEqual(buildCityhall('high'), buildCityhall('high'));
  assert.deepEqual(buildCityhall('low'), buildCityhall('low'));
});
