import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, overlaps, clearanceBetween } from '../../shared/elevation.js';
import {
  TRANSIT_MODEL_DEFAULTS,
  addSubwayEntrance,
  addCrosswalk,
  addInterchange,
  addBridge,
} from '../../src/world/models/transitModels.js';

// WorldScene.useResources() 가 등록한 shape/material 전부다. 새 키를 추가하면 렌더가 터진다.
const ALLOWED_SHAPES = ['gable', 'box', 'pane', 'octagon', 'spire', 'tree', 'trunk', 'hill', 'cylinder', 'cone', 'pyramid', 'dome'];
const ALLOWED_MATERIALS = ['stone', 'brick', 'sand', 'violet', 'roof', 'dark', 'pavement', 'road', 'marking', 'centerline', 'water', 'bank', 'ground', 'green', 'leaf', 'wood', 'accent', 'glass', 'blueglass', 'lamp', 'car', 'pick', 'tint', 'steel'];

function collect(run) {
  const parts = [];
  const add = (material, position, scale, owner = null, shape = 'box', rotation = 0, color) => {
    parts.push({ material, position, scale, owner, shape, rotation, color });
  };
  run(add);
  return parts;
}

const majorStation = { x: 40, z: -120, major: true, ko: '테스트 환승역' };
const minorStation = { x: -300, z: 260, major: false, ko: '테스트-사이 역', color: '#00a84d' };
const crossing = { x: 12, z: 340, rotation: Math.atan2(1, 1), width: 22 };
// 다이아몬드 램프 넷은 urbanPlan 이 파생하는 모양 그대로다. 고속도로가 동서로 달리는 남북 간선 나들목이다.
const icNode = { x: 900, z: -450, kind: 'IC', axis: 'ns', ko: '나들목 1', ramps: [-1, 1].flatMap((d) => [-1, 1].map((s) => ({
  from: { x: 900 + d * 18.7, z: -450 + s * 65, y: 0 }, to: { x: 900 + d * 173.7, z: -450 + s * 21.7, y: 14 },
  merge: { x: 900 + d * 233.7, z: -450 + s * 21.7 }, width: 15.4, kind: 'ic' }))) };
const jcNode = { x: -820, z: 830, kind: 'JC', ko: '분기점 1' };
const smallBridge = { x: -200, z: 410, big: false, ko: '테스트대교', width: 24 };
const bigBridge = { x: 540, z: 388, big: true, ko: '테스트사장교', width: 40 };

const BUILDERS = {
  subwayMajor: (add, quality) => addSubwayEntrance(add, majorStation, quality),
  subwayMinor: (add, quality) => addSubwayEntrance(add, minorStation, quality),
  crosswalk: (add, quality) => addCrosswalk(add, crossing, quality),
  interchangeIC: (add, quality) => addInterchange(add, icNode, quality),
  interchangeJC: (add, quality) => addInterchange(add, jcNode, quality),
  bridge: (add, quality) => addBridge(add, smallBridge, quality),
  bridgeBig: (add, quality) => addBridge(add, bigBridge, quality),
};

test('네 함수 모두 파트를 하나 이상 낸다', () => {
  for (const [name, run] of Object.entries(BUILDERS)) {
    const parts = collect((add) => run(add, 'medium'));
    if(name==='interchangeJC')continue;
    assert.ok(parts.length > 0, name);
  }
});

test('모든 파트의 shape 과 material 은 허용 목록 안에 있다', () => {
  for (const [name, run] of Object.entries(BUILDERS)) {
    for (const quality of ['low', 'medium', 'high']) {
      const parts = collect((add) => run(add, quality));
      for (const part of parts) {
        assert.ok(ALLOWED_SHAPES.includes(part.shape), `${name}/${quality}: unknown shape ${part.shape}`);
        assert.ok(ALLOWED_MATERIALS.includes(part.material), `${name}/${quality}: unknown material ${part.material}`);
      }
    }
  }
});

test('모든 position 과 scale 이 유한하고 owner 는 null 이다', () => {
  for (const [name, run] of Object.entries(BUILDERS)) {
    const parts = collect((add) => run(add, 'medium'));
    for (const part of parts) {
      const rotations=Array.isArray(part.rotation)?part.rotation:[part.rotation];
      assert.ok([...part.position, ...part.scale, ...rotations].every(Number.isFinite), name);
      assert.ok(part.scale.every((n) => n > 0), name);
      assert.equal(part.owner, null, name);
    }
  }
});

test('같은 인자로 두 번 부르면 같은 파트 배열이 나온다 (결정적)', () => {
  for (const run of Object.values(BUILDERS)) {
    const first = collect((add) => run(add, 'medium'));
    const second = collect((add) => run(add, 'medium'));
    assert.deepEqual(first, second);
  }
});

test('quality 예산: low 가 high 보다 파트가 적거나 같다', () => {
  for (const [name, run] of Object.entries(BUILDERS)) {
    const low = collect((add) => run(add, 'low')).length;
    const medium = collect((add) => run(add, 'medium')).length;
    const high = collect((add) => run(add, 'high')).length;
    assert.ok(low <= medium && medium <= high, `${name}: ${low}/${medium}/${high}`);
  }
});

test('지하철 출입구 low 품질은 계단과 캐노피만 남긴다', () => {
  for (const station of [majorStation, minorStation]) {
    const parts = collect((add) => addSubwayEntrance(add, station, 'low'));
    assert.ok(parts.every((p) => p.material !== 'accent'), '노선 색 기둥은 low 에서 빠져야 한다');
    assert.ok(parts.every((p) => p.material !== 'lamp'), '조명은 low 에서 빠져야 한다');
    const materials = new Set(parts.map((p) => p.material));
    for (const m of materials) assert.ok(['stone', 'roof', 'steel'].includes(m), `low 에 허용 안 된 재질 ${m}`);
  }
  const rich = collect((add) => addSubwayEntrance(add, majorStation, 'medium'));
  assert.ok(rich.some((p) => p.material === 'accent'), 'medium 이상은 노선 색 기둥이 있어야 한다');
});

test('노선 색 기둥은 station.color 를 그대로 쓴다', () => {
  const parts = collect((add) => addSubwayEntrance(add, minorStation, 'high'));
  const pillar = parts.find((p) => p.material === 'accent');
  assert.ok(pillar);
  assert.equal(pillar.color, minorStation.color);
});

test('IC 는 램프를 그리고 JC 는 기존 본선 위에 중복 상판을 만들지 않는다', () => {
  const icParts = collect((add) => addInterchange(add, icNode, 'medium'));
  const jcParts = collect((add) => addInterchange(add, jcNode, 'medium'));
  assert.ok(icParts.length > 0);
  const decks = jcParts.filter((p) => p.material === 'road' && p.shape === 'box');
  assert.equal(decks.length, 0, 'JC 본선 상판은 urbanPlan 도로가 이미 그린다');
});

test('JC 모델은 coplanar 상판이나 난간을 다시 그리지 않는다', () => {
  const parts = collect((add) => addInterchange(add, jcNode, 'medium'));
  assert.equal(parts.length, 0);
});

test('사장교(big)에만 주탑이 있고 일반 교량에는 없다', () => {
  const tallSteelBoxes = (bridge) => {
    const parts = collect((add) => addBridge(add, bridge, 'medium'));
    return parts.filter((p) => p.material === 'steel' && p.shape === 'box' && p.scale[1] > 10);
  };
  assert.equal(tallSteelBoxes(smallBridge).length, 0, '일반 교량에 주탑이 있으면 안 된다');
  assert.equal(tallSteelBoxes(bigBridge).length, 4, '사장교는 두 문형 주탑의 다리 네 개가 있어야 한다');
});

test('사장교 주탑은 차로 바깥에 서서 상판을 막지 않는다', () => {
  const parts = collect((add) => addBridge(add, bigBridge, 'medium'));
  const pylons = parts.filter((p) => p.material === 'steel' && p.shape === 'box' && p.scale[1] > 10);
  assert.ok(pylons.every((p) => Math.abs(p.position[0] - bigBridge.x) >= bigBridge.width / 2), '주탑이 차로 안을 막는다');
});

test('교량 상판은 지면 높이에 있다', () => {
  const parts = collect((add) => addBridge(add, smallBridge, 'medium'));
  const deck = parts.find((p) => p.material === 'road' && p.shape === 'box');
  assert.ok(deck);
  assert.ok(Math.abs(deck.position[1] - LEVELS.GROUND) < 2, `상판 높이 ${deck.position[1]} 가 지면에서 너무 멀다`);
});

test('횡단보도는 정지선과 줄무늬를 함께 낸다', () => {
  const parts = collect((add) => addCrosswalk(add, crossing, 'medium'));
  const markings = parts.filter((p) => p.material === 'marking');
  assert.ok(markings.length >= 2, '줄무늬와 정지선이 모두 있어야 한다');
  const stopLines = markings.filter((p) => p.scale[2] < 1);
  const stripes = markings.filter((p) => p.scale[2] >= 1);
  assert.ok(stopLines.length > 0, '정지선이 있어야 한다');
  assert.ok(stripes.length > 0, '줄무늬가 있어야 한다');
});

test('TRANSIT_MODEL_DEFAULTS 가 얼려 있다', () => {
  assert.ok(Object.isFrozen(TRANSIT_MODEL_DEFAULTS));
});
