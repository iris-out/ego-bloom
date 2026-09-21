import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addBeach, addParasol, addPier, addResort,
} from '../../src/world/models/coastModels.js';
import {
  beachStrips, parasols, piers, resortPlots,
} from '../../shared/coast.js';
import { LEVELS } from '../../shared/elevation.js';

const E = 1500;
const QUALITIES = ['low', 'medium', 'high'];

// WorldScene.useResources() 가 등록한 shape/material 전부다. 새 키를 쓰면 렌더가 터진다.
const ALLOWED_SHAPES = ['gable', 'box', 'pane', 'octagon', 'spire', 'tree', 'trunk', 'hill', 'cylinder', 'cone', 'pyramid', 'dome'];
const ALLOWED_MATERIALS = ['stone', 'brick', 'sand', 'violet', 'roof', 'dark', 'pavement', 'road', 'marking', 'water', 'bank', 'ground', 'green', 'leaf', 'wood', 'accent', 'glass', 'blueglass', 'lamp', 'car', 'pick', 'tint', 'steel'];

function collect(run) {
  const parts = [];
  const add = (material, position, scale, owner = null, shape = 'box', rotation = 0, color) => {
    parts.push({ material, position, scale, owner, shape, rotation, color });
  };
  run(add);
  return parts;
}

const strips = beachStrips(E);
const spots = parasols(E, 'high');
const piersList = piers(E);
const plots = resortPlots(E);

const SAMPLES = [
  { name: 'addBeach', fn: addBeach, arg: strips[0] },
  { name: 'addParasol', fn: addParasol, arg: spots.find((spot) => spot.parasol) ?? spots[0] },
  { name: 'addPier', fn: addPier, arg: piersList[0] },
  { name: 'addResort', fn: addResort, arg: plots[0] },
];

test('네 함수 모두 파트를 하나 이상 낸다', () => {
  for (const { name, fn, arg } of SAMPLES) {
    const parts = collect((add) => fn(add, arg, 'high'));
    assert.ok(parts.length > 0, `${name} 이 파트를 안 냈다`);
  }
});

test('모든 shape 과 material 이 허용 목록 안이다', () => {
  for (const { name, fn, arg } of SAMPLES) {
    for (const quality of QUALITIES) {
      const parts = collect((add) => fn(add, arg, quality));
      for (const part of parts) {
        assert.ok(ALLOWED_SHAPES.includes(part.shape), `${name} ${quality}: 모르는 shape ${part.shape}`);
        assert.ok(ALLOWED_MATERIALS.includes(part.material), `${name} ${quality}: 모르는 material ${part.material}`);
      }
    }
  }
});

test('모든 position 과 scale 이 유한하고 owner 가 null 이다', () => {
  for (const { name, fn, arg } of SAMPLES) {
    const parts = collect((add) => fn(add, arg, 'high'));
    for (const part of parts) {
      assert.equal(part.owner, null, `${name}: owner 가 null 이 아니다`);
      for (const value of [...part.position, ...part.scale]) {
        assert.ok(Number.isFinite(value), `${name}: position/scale 에 유한하지 않은 값이 있다`);
      }
    }
  }
});

test('같은 인자로 두 번 부르면 같은 결과가 나온다', () => {
  for (const { name, fn, arg } of SAMPLES) {
    for (const quality of QUALITIES) {
      const first = collect((add) => fn(add, arg, quality));
      const second = collect((add) => fn(add, arg, quality));
      assert.deepEqual(second, first, `${name} ${quality} 가 결정적이지 않다`);
    }
  }
});

test('low 파트 수가 high 보다 적거나 같다', () => {
  for (const { name, fn, arg } of SAMPLES) {
    const low = collect((add) => fn(add, arg, 'low')).length;
    const high = collect((add) => fn(add, arg, 'high')).length;
    assert.ok(low <= high, `${name}: low(${low}) 이 high(${high}) 보다 많다`);
  }
});

test('파라솔 하나가 파트 여섯을 넘지 않는다', () => {
  for (const quality of QUALITIES) {
    for (const spot of spots) {
      const parts = collect((add) => addParasol(add, spot, quality));
      assert.ok(parts.length <= 6, `파라솔이 파트 ${parts.length}개다 (${quality})`);
    }
  }
});

test('잔교 말뚝이 물 아래로 내려간다', () => {
  for (const pier of piersList) {
    const parts = collect((add) => addPier(add, pier, 'high'));
    const piles = parts.filter((part) => part.shape === 'cylinder');
    assert.ok(piles.length > 0, `${pier.id}: 말뚝이 없다`);
    for (const pile of piles) {
      const bottom = pile.position[1] - pile.scale[1] / 2;
      assert.ok(bottom < LEVELS.WATER, `${pier.id}: 말뚝 바닥(${bottom})이 물(${LEVELS.WATER}) 위에 있다`);
    }
  }
});

test('잔교 데크는 지면 높이에서 물 위로 뻗는다', () => {
  for (const pier of piersList) {
    const parts = collect((add) => addPier(add, pier, 'high'));
    const deck = parts.find((part) => part.shape === 'box' && part.material === 'wood');
    assert.ok(deck, `${pier.id}: 데크가 없다`);
    const top = deck.position[1] + deck.scale[1] / 2;
    assert.ok(Math.abs(top - pier.deck) < 1e-6, `${pier.id}: 데크 상단이 pier.deck 이 아니다`);
  }
});
