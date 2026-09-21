import test from 'node:test';
import assert from 'node:assert/strict';
import { BANDS, TIER_BAND, bandAt, cityHills, cityNodes, inHill, nodeAt } from '../../shared/cityNodes.js';
import { CREATOR_TIERS } from '../../src/design/tiers.js';

const EXTENT = 1500;

test('cityNodes 는 7개를 내고 central 이 원점이다', () => {
  const nodes = cityNodes(EXTENT);
  assert.equal(nodes.length, 7);
  const central = nodes.find((n) => n.id === 'central');
  assert.ok(central, 'central 핵이 있어야 한다');
  assert.equal(central.x, 0);
  assert.equal(central.z, 0);
});

test('같은 extent 로 두 번 부르면 같은 배열 참조가 나온다', () => {
  assert.equal(cityNodes(EXTENT), cityNodes(EXTENT));
  assert.equal(cityHills(EXTENT), cityHills(EXTENT));
});

test('어느 두 핵도 서로의 반경 안에 중심을 두지 않는다', () => {
  const nodes = cityNodes(EXTENT);
  for (const a of nodes) {
    for (const b of nodes) {
      if (a === b) continue;
      const dist = Math.hypot(a.x - b.x, a.z - b.z);
      assert.ok(dist > b.r, `${a.id} 중심이 ${b.id} 반경 안에 있다 (dist=${dist.toFixed(1)}, r=${b.r.toFixed(1)})`);
    }
  }
});

test('nodeAt 이 각 핵의 중심에서 그 핵을 돌려주고 d 가 0 에 가깝다', () => {
  const nodes = cityNodes(EXTENT);
  for (const node of nodes) {
    const hit = nodeAt(nodes, node.x, node.z);
    assert.ok(hit, `${node.id} 중심에서 핵을 찾아야 한다`);
    assert.equal(hit.node.id, node.id);
    assert.ok(hit.d < 0.001, `d=${hit.d}`);
  }
});

test('도시 네 모서리 밖에서는 null 이다', () => {
  const nodes = cityNodes(EXTENT);
  const far = EXTENT * 1.4;
  for (const [x, z] of [[far, far], [-far, far], [far, -far], [-far, -far]]) {
    assert.equal(nodeAt(nodes, x, z), null);
  }
});

test('bandAt(central, 0) 이 civic, bandAt(central, 0.99) 가 home 이다', () => {
  const central = cityNodes(EXTENT).find((n) => n.id === 'central');
  assert.equal(bandAt(central, 0).key, 'civic');
  assert.equal(bandAt(central, 0.99).key, 'home');
});

test('부도심에는 civic 과 champ 대역이 없다', () => {
  const subNodes = cityNodes(EXTENT).filter((n) => !n.primary);
  for (const node of subNodes) {
    for (let d = 0; d <= 1; d += 0.05) {
      const band = bandAt(node, d);
      assert.notEqual(band.key, 'civic');
      assert.notEqual(band.key, 'champ');
    }
  }
});

test('TIER_BAND 가 여덟 티어를 모두 덮고 값이 전부 대역 키다', () => {
  const bandKeys = new Set([...BANDS.primary, ...BANDS.sub].map((b) => b.key));
  assert.equal(Object.keys(TIER_BAND).length, 8);
  for (const tier of CREATOR_TIERS) {
    assert.ok(tier.key in TIER_BAND, `${tier.key} 티어가 빠졌다`);
    assert.ok(bandKeys.has(TIER_BAND[tier.key]), `${TIER_BAND[tier.key]} 는 대역 키가 아니다`);
  }
});

test('inHill 이 산 중심에서 true, 산 밖에서 false 다', () => {
  const hills = cityHills(EXTENT);
  for (const hill of hills) assert.equal(inHill(hills, hill.x, hill.z), true);
  assert.equal(inHill(hills, EXTENT * 5, EXTENT * 5), false);
});

test('extent 를 2배로 하면 모든 좌표와 반경이 2배가 된다', () => {
  const a = cityNodes(EXTENT), b = cityNodes(EXTENT * 2);
  for (let i = 0; i < a.length; i++) {
    assert.ok(Math.abs(b[i].x - a[i].x * 2) < 1e-9, `${a[i].id} x`);
    assert.ok(Math.abs(b[i].z - a[i].z * 2) < 1e-9, `${a[i].id} z`);
    assert.ok(Math.abs(b[i].r - a[i].r * 2) < 1e-9, `${a[i].id} r`);
  }
  const ha = cityHills(EXTENT), hb = cityHills(EXTENT * 2);
  for (let i = 0; i < ha.length; i++) {
    assert.ok(Math.abs(hb[i].x - ha[i].x * 2) < 1e-9);
    assert.ok(Math.abs(hb[i].z - ha[i].z * 2) < 1e-9);
    assert.ok(Math.abs(hb[i].r - ha[i].r * 2) < 1e-9);
  }
});
