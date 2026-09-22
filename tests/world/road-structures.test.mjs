import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROAD_STRUCTURE_DEFAULTS,
  addElevatedRoad,
  addTunnel,
  addRamp,
  addOverpass,
  addRoadFurniture,
} from '../../src/world/models/roadStructures.js';
import { hitsBuilding } from '../../src/world/solidIndex.js';

// WorldScene.useResources() 가 실제로 등록한 shape/material 전부다. 새 키를 추가하면 렌더가 터진다.
const ALLOWED_SHAPES = ['gable', 'box', 'pane', 'octagon', 'spire', 'tree', 'trunk', 'hill', 'cylinder', 'cone', 'pyramid', 'dome'];
const ALLOWED_MATERIALS = ['stone', 'brick', 'sand', 'violet', 'roof', 'dark', 'pavement', 'road', 'marking', 'centerline', 'water', 'bank', 'ground', 'green', 'leaf', 'wood', 'accent', 'glass', 'blueglass', 'lamp', 'car', 'pick', 'tint', 'steel'];
const RADIAL = ['cylinder', 'cone', 'octagon', 'spire', 'trunk', 'tree', 'dome', 'hill'];

function collect(run) {
  const parts = [];
  const add = (material, position, scale, owner = null, shape = 'box', rotation = 0, color) => {
    parts.push({ material, position, scale, owner, shape, rotation, color });
  };
  run(add);
  return parts;
}

const arterial = { x1: -100, z1: 0, x2: 100, z2: 0, kind: 'arterial', angle: 0, length: 200 };
const diagonal = { x1: -40, z1: -30, x2: 60, z2: 50, kind: 'collector', angle: Math.atan2(80, 100), length: Math.hypot(100, 80) };
const rampFrom = { x: 0, z: 0, y: 0 };
const rampTo = { x: 40, z: 40, y: ROAD_STRUCTURE_DEFAULTS.deckHeight };

const BUILDERS = {
  elevatedRoad: (add, quality) => addElevatedRoad(add, arterial, { quality }),
  tunnel: (add, quality) => addTunnel(add, diagonal, { quality }),
  ramp: (add, quality) => addRamp(add, rampFrom, rampTo, { quality }),
  overpass: (add, quality) => addOverpass(add, arterial, { quality }),
  furniture: (add, quality) => addRoadFurniture(add, arterial, { quality, median: true, soundWall: true }),
};

test('모든 빌더는 파트를 하나 이상 낸다', () => {
  for (const [name, run] of Object.entries(BUILDERS)) {
    const parts = collect((add) => run(add, 'medium'));
    assert.ok(parts.length > 0, name);
  }
});

test('모든 파트의 shape 과 material 은 허용 목록 안에 있다', () => {
  for (const run of Object.values(BUILDERS)) {
    const parts = collect((add) => run(add, 'high'));
    for (const part of parts) {
      assert.ok(ALLOWED_SHAPES.includes(part.shape), `unknown shape ${part.shape}`);
      assert.ok(ALLOWED_MATERIALS.includes(part.material), `unknown material ${part.material}`);
    }
  }
});

test('모든 position 과 scale 은 유한한 숫자이고 owner 는 null 이다', () => {
  for (const run of Object.values(BUILDERS)) {
    const parts = collect((add) => run(add, 'medium'));
    for (const part of parts) {
      const rotations=Array.isArray(part.rotation)?part.rotation:[part.rotation];
      assert.ok([...part.position, ...part.scale, ...rotations].every(Number.isFinite));
      assert.ok(part.scale.every((n) => n > 0));
      assert.equal(part.owner, null);
    }
  }
});

test('같은 인자로 두 번 부르면 같은 파트 배열이 나온다', () => {
  for (const run of Object.values(BUILDERS)) {
    const first = collect((add) => run(add, 'medium'));
    const second = collect((add) => run(add, 'medium'));
    assert.deepEqual(first, second);
  }
});

test('램프 상판과 난간은 한 장의 연속 경사로 기울어진다', () => {
  const parts = collect((add) => addRamp(add, rampFrom, rampTo, { quality: 'medium' }));
  const deck = parts.find((p) => p.material === 'road');
  assert.ok(deck);
  assert.ok(Array.isArray(deck.rotation), '경사로 회전은 pitch/yaw/roll 이어야 한다');
  assert.ok(Math.abs(deck.rotation[0]) > 0.01, '상판에 경사가 없다');
  assert.equal(parts.filter((p) => p.material === 'road').length, 1, '계단식 상판이면 안 된다');
});

test('가감속 차로는 본선 합류 쪽 난간을 열어 둔다', () => {
  const parts = collect((add) => addRamp(add, rampFrom, rampTo, {
    quality: 'medium', accelLane: true, mergeTo: { x: 100, z: 40 },
  }));
  const mergeDeck = parts.filter((p) => p.material === 'road').at(-1);
  assert.ok(mergeDeck);
  const mergeRails = parts.filter((p) => p.material === 'steel' && Math.abs(p.position[0] - 70) < 31 && p.position[1] > rampTo.y);
  assert.equal(mergeRails.length, 0, '합류 테이퍼 양옆을 난간으로 막으면 안 된다');
});

test('고가 본선 난간은 지정한 합류 구간을 비운다', () => {
  const parts = collect((add) => addElevatedRoad(add, {
    ...arterial, railOpenings: [{ side: 1, from: 0.35, to: 0.65 }],
  }, { quality: 'low' }));
  const rails = parts.filter((p) => p.material === 'steel' && p.scale[1] === ROAD_STRUCTURE_DEFAULTS.guardHeight);
  const positive = rails.filter((p) => p.position[2] > 0);
  const negative = rails.filter((p) => p.position[2] < 0);
  assert.equal(positive.length, 2, '합류 쪽 난간은 빈 구간 앞뒤로 갈라져야 한다');
  assert.equal(negative.length, 1, '반대쪽 난간은 이어져야 한다');
});

test('quality 예산: low <= medium <= high 이고 정한 상한을 넘지 않는다', () => {
  const counts = {};
  for (const [name, run] of Object.entries(BUILDERS)) {
    counts[name] = ['low', 'medium', 'high'].map((quality) => collect((add) => run(add, quality)).length);
    const [low, medium, high] = counts[name];
    assert.ok(low <= medium && medium <= high, `${name}: ${low}/${medium}/${high}`);
  }
  // 고가도로 100 단위 길이당 medium 60, low 30 을 넘기지 않는다. arterial 은 길이 200 이다.
  const perHundred = (count) => count / (arterial.length / 100);
  assert.ok(perHundred(counts.elevatedRoad[0]) <= 30, `low ${counts.elevatedRoad[0]}`);
  assert.ok(perHundred(counts.elevatedRoad[1]) <= 60, `medium ${counts.elevatedRoad[1]}`);
  // 터널 하나는 medium 에서 80 개를 넘기지 않는다.
  assert.ok(counts.tunnel[1] <= 80, `tunnel medium ${counts.tunnel[1]}`);
});

test('고가도로 상판은 지정한 높이에 있고 교각은 지면부터 상판까지 닿는다', () => {
  const height = 20;
  const parts = collect((add) => addElevatedRoad(add, arterial, { quality: 'medium', height }));
  const deck = parts.find((p) => p.material === 'road' && p.shape === 'box');
  assert.ok(deck);
  assert.ok(Math.abs(deck.position[1] - height) < 0.5);

  const piers = parts.filter((p) => p.material === 'stone' && p.shape === 'cylinder');
  assert.ok(piers.length > 0);
  for (const pier of piers) {
    const bottom = pier.position[1] - pier.scale[1] / 2;
    const top = pier.position[1] + pier.scale[1] / 2;
    assert.ok(bottom <= 0.2, `pier bottom ${bottom} should reach ground`);
    assert.ok(top >= height * 0.6, `pier top ${top} should reach near deck ${height}`);
  }
});

test('고가 교각 충돌 상자는 자기 상판 위 차량을 막지 않는다', () => {
  const piers = [];
  const height = ROAD_STRUCTURE_DEFAULTS.deckHeight;
  collect((add) => addElevatedRoad(add, arterial, {
    quality: 'medium', height, onPier: (pier) => piers.push(pier),
  }));
  assert.ok(piers.length > 0);
  for (const pier of piers) {
    assert.equal(pier.roofMargin, 0, '교각에 건물용 지붕 여유를 더하면 안 된다');
    const onDeck = { x: pier.x, y: height + 1.48, z: pier.z };
    assert.equal(hitsBuilding(onDeck, onDeck, pier), false, '교각이 상판 위 차량까지 막는다');
  }
});

test('터널 상판, 복개는 도로 폭보다 넓다', () => {
  const width = ROAD_STRUCTURE_DEFAULTS.width;
  const parts = collect((add) => addTunnel(add, diagonal, { quality: 'medium', width }));
  const boxes = parts.filter((p) => p.shape === 'box');
  const widest = Math.max(...boxes.map((p) => p.scale[0]));
  assert.ok(widest > width, `widest box ${widest} should exceed road width ${width}`);
  const mounds = parts.filter((p) => p.shape === 'hill');
  assert.ok(mounds.length > 0);
  assert.ok(mounds.every((p) => p.scale[0] > width));
});

test('터널은 안쪽이 열려 있다 (진입 가능한 벽 폭)', () => {
  const width = ROAD_STRUCTURE_DEFAULTS.width;
  const parts = collect((add) => addTunnel(add, diagonal, { quality: 'medium', width }));
  const walls = parts.filter((p) => p.material === 'stone' && p.shape === 'box' && p.scale[0] < 1);
  assert.ok(walls.length === 2, `expected two side walls, got ${walls.length}`);
  const clear = Math.hypot(walls[0].position[0] - walls[1].position[0], walls[0].position[2] - walls[1].position[2]);
  assert.ok(clear > width, `clear width ${clear} should exceed road width ${width}`);
});
