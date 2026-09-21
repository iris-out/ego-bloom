import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AIRPORT_CLEAR, BEACH_WIDTH, BOAT_Y, COAST_EDGES, FISH_CLEAR,
  beachStrips, boatPose, boatRoutes, onBeach, parasols, piers, resortPlots,
} from '../../shared/coast.js';
import { LEVELS } from '../../shared/elevation.js';

const E = 1500;
const fishRadius = (extent) => extent * Math.SQRT2 + 230;
const airport = (extent) => ({ x: extent + 110, z: 0 });

test('해변은 해변 변에만 있고 방파제와 항구에는 없다', () => {
  const strips = beachStrips(E);
  const beaches = COAST_EDGES.filter((edge) => edge.kind === 'beach');
  assert.equal(strips.length, beaches.length);
  const edges = strips.map((strip) => strip.edge).sort();
  assert.deepEqual(edges, beaches.map((edge) => edge.edge).sort());
  assert.ok(!edges.includes('east'), '공항이 있는 동쪽은 방파제다');
  assert.ok(!edges.includes('north'), '북쪽은 항구다');
});

test('해변 띠는 전부 육지 안이다', () => {
  for (const strip of beachStrips(E)) {
    const halfAlong = strip.length / 2, halfAcross = strip.width / 2;
    const spanX = strip.angle === 0 ? halfAlong : halfAcross;
    const spanZ = strip.angle === 0 ? halfAcross : halfAlong;
    assert.ok(Math.abs(strip.x) + spanX <= E + 1e-9, `${strip.edge} x 가 섬 밖이다`);
    assert.ok(Math.abs(strip.z) + spanZ <= E + 1e-9, `${strip.edge} z 가 섬 밖이다`);
    assert.equal(strip.top, LEVELS.GROUND, '모래 상단은 지면과 같다');
  }
});

test('파라솔은 전부 해변 띠 안이다', () => {
  const strips = beachStrips(E);
  const spots = parasols(E, 'high');
  assert.ok(spots.length >= 100, `파라솔이 ${spots.length}개뿐이다`);
  for (const spot of spots) {
    const strip = strips.find((item) => item.edge === spot.edge);
    assert.ok(strip, `${spot.edge} 띠가 없다`);
    assert.ok(onBeach(strip, spot.x, spot.z), `파라솔이 띠 밖이다 ${spot.x} ${spot.z}`);
    assert.equal(spot.y, LEVELS.GROUND);
  }
});

test('파라솔 배치는 결정적이고 품질에 따라 개수가 다르다', () => {
  assert.deepEqual(parasols(E, 'high'), parasols(E, 'high'));
  assert.ok(parasols(E, 'low').length < parasols(E, 'high').length);
});

test('잔교는 육지에서 시작해 바다로 나간다', () => {
  const list = piers(E);
  assert.equal(list.length, 3);
  for (const pier of list) {
    assert.ok(Math.max(Math.abs(pier.from.x), Math.abs(pier.from.z)) < E, `${pier.id} 시작점이 육지 밖이다`);
    assert.ok(Math.max(Math.abs(pier.to.x), Math.abs(pier.to.z)) > E, `${pier.id} 끝점이 육지 안이다`);
    assert.equal(pier.deck, LEVELS.GROUND);
  }
});

test('항로 여섯의 반경이 전부 다르다', () => {
  const routes = boatRoutes(E);
  assert.equal(routes.length, 6);
  const radii = routes.map((route) => route.radius);
  assert.equal(new Set(radii).size, 6);
  assert.ok(radii.every((radius) => Number.isFinite(radius) && radius > 0));
});

test('항로는 물고기 궤도에서 떨어져 있다', () => {
  const fish = fishRadius(E);
  for (const route of boatRoutes(E)) {
    const gap = Math.abs(route.radius - fish);
    assert.ok(gap >= FISH_CLEAR, `${route.id} 가 물고기 궤도와 ${gap.toFixed(1)} 밖에 안 떨어졌다`);
  }
});

test('항로는 공항을 피한다', () => {
  const centre = airport(E);
  for (const route of boatRoutes(E)) {
    // 원 항로가 공항 중심에 가장 가까워지는 지점까지의 거리다.
    const centreDistance = Math.hypot(centre.x, centre.z);
    const closest = Math.abs(centreDistance - route.radius);
    assert.ok(closest >= AIRPORT_CLEAR,
      `${route.id} 가 공항에 ${closest.toFixed(1)} 까지 붙는다`);
  }
});

test('boatPose 는 상태가 없고 같은 시각에 같은 값을 낸다', () => {
  const route = boatRoutes(E)[0];
  assert.deepEqual(boatPose(route, 12.5), boatPose(route, 12.5));
  assert.notDeepEqual(boatPose(route, 0), boatPose(route, 400));
});

test('boatPose 의 각도가 진행 방향과 맞는다', () => {
  for (const route of boatRoutes(E)) {
    const now = boatPose(route, 100), next = boatPose(route, 100.5);
    const moved = Math.atan2(next.x - now.x, next.z - now.z);
    const delta = Math.atan2(Math.sin(moved - now.angle), Math.cos(moved - now.angle));
    assert.ok(Math.abs(delta) < 0.1, `${route.id} 방위가 ${delta.toFixed(3)} 만큼 어긋난다`);
  }
});

test('배는 물 위에 뜨고 물고기보다 위다', () => {
  assert.equal(BOAT_Y, LEVELS.WATER + 0.2);
  assert.ok(BOAT_Y > -2.62, '물고기 높이보다 위여야 한다');
  for (const route of boatRoutes(E)) assert.equal(boatPose(route, 7).y, BOAT_Y);
});

test('리조트 부지 넷이 서로 겹치지 않고 육지 안이다', () => {
  const plots = resortPlots(E);
  assert.equal(plots.length, 4);
  for (const plot of plots) {
    const half = plot.size / 2;
    assert.ok(Math.abs(plot.x) + half <= E, `${plot.id} 가 섬 밖이다`);
    assert.ok(Math.abs(plot.z) + half <= E, `${plot.id} 가 섬 밖이다`);
  }
  for (let i = 0; i < plots.length; i++) {
    for (let j = i + 1; j < plots.length; j++) {
      const need = (plots[i].size + plots[j].size) / 2;
      const apart = Math.abs(plots[i].x - plots[j].x) >= need || Math.abs(plots[i].z - plots[j].z) >= need;
      assert.ok(apart, `${plots[i].id} 와 ${plots[j].id} 가 겹친다`);
    }
  }
});

test('리조트는 모래를 밟지 않는다', () => {
  const strips = beachStrips(E);
  for (const plot of resortPlots(E)) {
    const half = plot.size / 2;
    for (const strip of strips) {
      const overlapX = Math.abs(plot.x - strip.x) < half + (strip.angle === 0 ? strip.length : strip.width) / 2;
      const overlapZ = Math.abs(plot.z - strip.z) < half + (strip.angle === 0 ? strip.width : strip.length) / 2;
      assert.ok(!(overlapX && overlapZ), `${plot.id} 가 ${strip.edge} 모래를 침범한다`);
    }
  }
});

test('extent 를 바꿔도 규칙이 유지된다', () => {
  for (const extent of [1000, 2453, 3600]) {
    const fish = fishRadius(extent), centreDistance = extent + 110;
    for (const strip of beachStrips(extent)) {
      assert.equal(strip.width, BEACH_WIDTH);
      assert.ok(strip.length > 0);
    }
    for (const route of boatRoutes(extent)) {
      assert.ok(Math.abs(route.radius - fish) >= FISH_CLEAR, `extent ${extent} ${route.id} 물고기`);
      assert.ok(Math.abs(centreDistance - route.radius) >= AIRPORT_CLEAR, `extent ${extent} ${route.id} 공항`);
    }
    for (const pier of piers(extent)) {
      assert.ok(Math.max(Math.abs(pier.to.x), Math.abs(pier.to.z)) > extent);
    }
  }
});
