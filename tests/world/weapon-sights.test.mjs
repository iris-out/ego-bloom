import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADS_DEPTH, ADS_SCALE, ANCHOR, HIP_REST, HIP_SCALE, SIGHT_POINT,
  adsRest, sightScreenPoint, usesRedDot,
} from '../../src/world/weaponSights.js';

const GUNS = ['pistol', 'smg', 'sniper', 'shotgun'];

test('정조준하면 가늠쇠가 화면 정중앙에 온다', () => {
  for (const weapon of GUNS) {
    const rest = adsRest(weapon);
    const [x, y] = sightScreenPoint(weapon, rest, ADS_SCALE[weapon]);
    assert.ok(Math.abs(x) < 1e-9, `${weapon} 좌우 ${x}`);
    assert.ok(Math.abs(y) < 1e-9, `${weapon} 위아래 ${y}`);
  }
});

test('허리 자세에서는 총이 화면 오른쪽 아래에 있다', () => {
  assert.ok(HIP_REST[0] > 0, '오른쪽');
  assert.ok(HIP_REST[1] < 0, '아래');
  for (const weapon of GUNS) {
    const [x, y] = sightScreenPoint(weapon, HIP_REST, HIP_SCALE[weapon]);
    assert.ok(x > 0, `${weapon} 허리 자세는 중앙이 아니다`);
    assert.ok(Number.isFinite(y));
  }
});

test('총이 눈에서 너무 멀리 뜨지 않는다', () => {
  // z 가 음수이고 절대값이 클수록 눈에서 멀다. 0.6 을 넘으면 1인칭인데도 장난감처럼 작아 보인다.
  assert.ok(HIP_REST[2] < 0 && Math.abs(HIP_REST[2]) <= 0.45, `허리 깊이 ${HIP_REST[2]}`);
  assert.ok(ADS_DEPTH < 0 && Math.abs(ADS_DEPTH) < Math.abs(HIP_REST[2]), '겨누면 더 가까이 당긴다');
});

test('총마다 조준기 자리가 다르고 표가 빠짐없다', () => {
  for (const weapon of GUNS) {
    assert.ok(ANCHOR[weapon], `${weapon} 앵커`);
    assert.ok(SIGHT_POINT[weapon], `${weapon} 조준기`);
    assert.ok(HIP_SCALE[weapon] > 0 && ADS_SCALE[weapon] > 0, `${weapon} 배율`);
    // 조준기는 총 위에 있고 총구 쪽(-Z) 이다.
    assert.ok(SIGHT_POINT[weapon][1] > 0, `${weapon} 조준기는 총 위다`);
  }
  // 조준기 높이가 다르므로 정조준 자세도 총마다 달라야 한다.
  const heights = new Set(GUNS.map((weapon) => adsRest(weapon)[1].toFixed(5)));
  assert.ok(heights.size > 1, '총마다 정조준 높이가 다르다');
});

test('모르는 무기는 중앙에 두고 넘어간다', () => {
  assert.deepEqual(adsRest('fist'), [0, 0, ADS_DEPTH]);
  assert.equal(sightScreenPoint('fist', HIP_REST, 1), null);
});

test('도트 사이트는 기관단총만 쓴다', () => {
  assert.equal(usesRedDot('smg'), true);
  for (const weapon of ['pistol', 'sniper', 'fist', 'shotgun']) assert.equal(usesRedDot(weapon), false, weapon);
});
