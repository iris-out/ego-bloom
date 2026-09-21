import test from 'node:test';
import assert from 'node:assert/strict';
import { clearanceBetween, LAYERS, LEVELS, overlaps, spanOf } from '../../shared/elevation.js';

test('LEVELS 의 모든 값이 유한한 숫자다', () => {
  for (const [name, value] of Object.entries(LEVELS)) {
    assert.equal(typeof value, 'number', name);
    assert.ok(Number.isFinite(value), name);
  }
});

test('물이 지면보다 낮다', () => {
  assert.ok(LEVELS.WATER < LEVELS.GROUND);
});

test('노면이 보도보다 높고 둘 다 지면 위다', () => {
  assert.ok(LEVELS.ROAD_TOP > LEVELS.PAVEMENT_TOP);
  assert.ok(LEVELS.ROAD_TOP > LEVELS.GROUND);
  assert.ok(LEVELS.PAVEMENT_TOP > LEVELS.GROUND);
});

test('차량 접지가 노면 위다', () => {
  assert.ok(LEVELS.CAR_GROUND > LEVELS.ROAD_TOP);
});

test('고가 순환로 상판 아래 여유가 육교 통과 높이보다 크다', () => {
  assert.ok(LEVELS.HIGHWAY_DECK - LEVELS.DECK_THICKNESS > LEVELS.OVERPASS_CLEARANCE);
});

test('어느 두 층도 겹치지 않는다', () => {
  for (let i = 0; i < LAYERS.length; i++) {
    for (let j = i + 1; j < LAYERS.length; j++) {
      assert.equal(overlaps(LAYERS[i], LAYERS[j]), false, `${LAYERS[i].key} x ${LAYERS[j].key}`);
    }
  }
});

test('인접한 두 층의 clearanceBetween 이 0 이상이다', () => {
  for (let i = 0; i < LAYERS.length - 1; i++) {
    const clearance = clearanceBetween(LAYERS[i], LAYERS[i + 1]);
    assert.ok(clearance >= 0, `${LAYERS[i].key} -> ${LAYERS[i + 1].key} = ${clearance}`);
  }
});

test('층이 bottom 오름차순으로 정렬돼 있다', () => {
  for (let i = 0; i < LAYERS.length - 1; i++) {
    assert.ok(LAYERS[i].bottom <= LAYERS[i + 1].bottom, `${LAYERS[i].key} -> ${LAYERS[i + 1].key}`);
  }
});

test('spanOf 가 없는 키에 null 을 돌려준다', () => {
  assert.equal(spanOf('no-such-layer'), null);
  const span = spanOf(LAYERS[0].key);
  assert.deepEqual(span, { bottom: LAYERS[0].bottom, top: LAYERS[0].top });
});
