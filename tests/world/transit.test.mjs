import test from 'node:test';
import assert from 'node:assert/strict';
import { cityNodes } from '../../shared/cityNodes.js';
import {
  SUBWAY_LINES,
  subwayStations,
  subwayNetwork,
  highwayLoop,
  highwayRadials,
  interchanges,
  riverAt,
  riverBridges,
} from '../../shared/transit.js';

const EXTENT = 1500;

/** 이 테스트에서 쓰는 도시 경계 정의다. 좌표가 extent 정사각형 안에 있는지만 본다. */
const inCity = (extent, x, z) => Math.abs(x) <= extent && Math.abs(z) <= extent;
const dist = (x1, z1, x2, z2) => Math.hypot(x1 - x2, z1 - z2);

test('세 노선이 모두 있고 via 의 핵 id 가 전부 cityNodes 에 있다', () => {
  assert.equal(SUBWAY_LINES.length, 3);
  const ids = new Set(cityNodes(EXTENT).map((node) => node.id));
  for (const line of SUBWAY_LINES) {
    assert.ok(line.via.length >= 2, `${line.id} via 가 너무 짧다`);
    for (const id of line.via) assert.ok(ids.has(id), `${line.id} 이 모르는 핵 ${id} 을 지난다`);
  }
});

test('역 수가 노선마다 핵 수 + (핵 수 - 1) * 2 다', () => {
  const nodes = cityNodes(EXTENT);
  for (const line of SUBWAY_LINES) {
    const stations = subwayStations(nodes, line);
    const expected = line.via.length + (line.via.length - 1) * 2;
    assert.equal(stations.length, expected, `${line.id}`);
  }
});

test('모든 역이 도시 경계 안이다', () => {
  const nodes = cityNodes(EXTENT);
  for (const line of SUBWAY_LINES) {
    for (const station of subwayStations(nodes, line)) {
      assert.ok(inCity(EXTENT, station.x, station.z), `${line.id} 의 역이 경계 밖이다`);
    }
  }
});

test('도심 central 에 노선 둘 이상이 지난다', () => {
  const throughCentral = SUBWAY_LINES.filter((line) => line.via.includes('central'));
  assert.ok(throughCentral.length >= 2, '환승역이 있어야 지하철망이다');
});

test('subwayNetwork 가 노선마다 points 와 stations 를 함께 낸다', () => {
  const network = subwayNetwork(EXTENT);
  assert.equal(network.lines.length, 3);
  for (const line of network.lines) {
    assert.ok(line.points.length >= 2);
    assert.ok(line.stations.length >= 2);
  }
});

test('highwayLoop 이 닫힌 고리다', () => {
  const loop = highwayLoop(EXTENT);
  const first = loop[0], last = loop[loop.length - 1];
  assert.equal(first[0], last[0]);
  assert.equal(first[1], last[1]);
});

test('순환선의 모든 점이 도시 경계 안이고 원점에서 extent 의 0.6 보다 멀다', () => {
  const loop = highwayLoop(EXTENT);
  for (const [x, z] of loop) {
    assert.ok(inCity(EXTENT, x, z), '순환선이 경계 밖으로 나갔다');
    assert.ok(Math.hypot(x, z) > EXTENT * 0.6, '순환선이 도심에 너무 가깝다');
  }
});

/** 나들목은 교차에서 파생한다. 여백 간선 x 둘, 동서 간선 z 하나, 방사선 x 하나를 넘긴다. */
const AXES = { ns: [-0.33 * EXTENT, 0.33 * EXTENT], ew: [-0.40 * EXTENT], jc: [0] };

test('IC 가 6, JC 가 2 다', () => {
  const nodes = interchanges(EXTENT, AXES);
  assert.equal(nodes.filter((n) => n.kind === 'IC').length, 6);
  assert.equal(nodes.filter((n) => n.kind === 'JC').length, 2);
});

test('축을 주지 않으면 나들목이 없다', () => {
  assert.deepEqual(interchanges(EXTENT), []);
});

test('모든 IC 와 JC 가 순환선 위에 있다', () => {
  const loop = highwayLoop(EXTENT);
  // 순환선 직선 구간 위에 있으므로 꼭짓점이 아니라 선분까지의 거리로 본다.
  const toSegment = (px, pz, [ax, az], [bx, bz]) => {
    const dx = bx - ax, dz = bz - az, len = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len));
    return dist(px, pz, ax + dx * t, az + dz * t);
  };
  for (const node of interchanges(EXTENT, AXES)) {
    const nearest = Math.min(...loop.slice(1).map((point, i) => toSegment(node.x, node.z, loop[i], point)));
    assert.ok(nearest < 30, `${node.ko} 이 순환선에서 ${nearest.toFixed(1)} 만큼 떨어졌다`);
  }
});

test('riverBridges 가 다섯이고 그중 big 이 둘이다', () => {
  const bridges = riverBridges(EXTENT, riverAt);
  assert.equal(bridges.length, 5);
  assert.equal(bridges.filter((b) => b.big).length, 2);
});

test('모든 교량의 z 가 그 x 에서의 riverAt 과 같다', () => {
  const bridges = riverBridges(EXTENT, riverAt);
  for (const bridge of bridges) assert.equal(bridge.z, riverAt(EXTENT, bridge.x));
});

test('riverAt 의 평균은 기존 강 기준선(Math.min(420, extent*0.56)) 과 같다', () => {
  const base = Math.min(420, EXTENT * 0.56);
  let sum = 0, count = 0;
  for (let x = -EXTENT; x <= EXTENT; x += EXTENT / 50) {
    sum += riverAt(EXTENT, x);
    count += 1;
  }
  assert.ok(Math.abs(sum / count - base) < 1, `평균이 기준선(${base})에서 벗어났다`);
});

test('extent 를 바꾸면 좌표가 따라 움직이고 도시 밖으로 나가지 않는다', () => {
  const bigExtent = EXTENT * 2;
  const loopSmall = highwayLoop(EXTENT), loopBig = highwayLoop(bigExtent);
  assert.equal(loopSmall.length, loopBig.length);
  for (let i = 0; i < loopSmall.length; i++) {
    assert.ok(Math.abs(loopSmall[i][0] * 2 - loopBig[i][0]) < 1e-6, `순환선 x 가 배로 늘지 않았다 (${i})`);
    assert.ok(Math.abs(loopSmall[i][1] * 2 - loopBig[i][1]) < 1e-6, `순환선 z 가 배로 늘지 않았다 (${i})`);
  }
  for (const [x, z] of loopBig) assert.ok(inCity(bigExtent, x, z));

  const scaled = { ns: AXES.ns.map((v) => v * 2), ew: AXES.ew.map((v) => v * 2), jc: [0] };
  const icSmall = interchanges(EXTENT, AXES), icBig = interchanges(bigExtent, scaled);
  for (let i = 0; i < icSmall.length; i++) {
    assert.ok(Math.abs(icSmall[i].x * 2 - icBig[i].x) < 1e-6);
    assert.ok(Math.abs(icSmall[i].z * 2 - icBig[i].z) < 1e-6);
  }

  const bridgesSmall = riverBridges(EXTENT, riverAt), bridgesBig = riverBridges(bigExtent, riverAt);
  for (let i = 0; i < bridgesSmall.length; i++) {
    assert.ok(Math.abs(bridgesSmall[i].x * 2 - bridgesBig[i].x) < 1e-6);
  }
});

test('highwayRadials 가 남북 한 줄이다. 동서 방사선은 교량과 간선을 덮어 없앴다', () => {
  const radials = highwayRadials(EXTENT);
  assert.equal(radials.length, 1);
  assert.equal(radials[0].id, 'radial-ns');
  for (const radial of radials) {
    assert.ok(radial.points.length >= 2);
    for (const [x, z] of radial.points) assert.ok(inCity(EXTENT, x, z));
  }
});
