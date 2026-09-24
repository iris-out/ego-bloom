import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BEAMS, BEAM_CONE, SEDAN_FRONT_LIGHTS, SEDAN_REAR_LIGHTS, SUV_FRONT_LIGHTS, SUV_REAR_LIGHTS,
  beamCone, beamLabel, defaultBeam, isBeamOn,
  nextBeam, rearLampIntensity, reverseLampIntensity,
} from '../../src/world/headlights.js';

test('H 는 꺼짐, 하향등, 상향등, 둘 다를 차례로 돌고 처음으로 돌아온다', () => {
  assert.deepEqual(BEAMS, ['off', 'low', 'high', 'both']);
  let beam = 'off';
  const seen = [];
  for (let i = 0; i < BEAMS.length; i += 1) { beam = nextBeam(beam); seen.push(beam); }
  assert.deepEqual(seen, ['low', 'high', 'both', 'off']);
});

test('모르는 값에서 눌러도 첫 상태로 들어온다', () => {
  assert.equal(nextBeam(undefined), 'off');
  assert.equal(nextBeam('xenon'), 'off');
});

test('꺼짐만 빛이 없다', () => {
  assert.equal(isBeamOn('off'), false);
  assert.equal(isBeamOn('xenon'), false);
  assert.equal(BEAM_CONE.off.intensity, 0);
  for (const beam of BEAMS.filter((key) => key !== 'off')) {
    assert.equal(isBeamOn(beam), true);
    assert.ok(beamCone(beam).intensity > 0, beam);
    assert.ok(beamCone(beam).distance > 0, beam);
  }
});

test('상향등은 하향등보다 멀리 좁게 곧게 나간다', () => {
  const low = beamCone('low'), high = beamCone('high');
  assert.ok(high.distance > low.distance);
  assert.ok(high.angle < low.angle);
  assert.ok(high.reach > low.reach);
  // drop 이 작을수록 덜 내리깔린다
  assert.ok(high.drop < low.drop);
});

test('둘 다는 하향의 폭과 상향의 사거리를 같이 쓰고 가장 밝다', () => {
  const low = beamCone('low'), high = beamCone('high'), both = beamCone('both');
  assert.equal(both.angle, low.angle);
  assert.equal(both.distance, high.distance);
  assert.ok(both.intensity > high.intensity);
  assert.ok(both.lamp > high.lamp);
});

test('램프 발광은 켤수록 밝아진다', () => {
  const lamps = BEAMS.map((beam) => beamCone(beam).lamp);
  for (let i = 1; i < lamps.length; i += 1) assert.ok(lamps[i] > lamps[i - 1], BEAMS[i]);
});

test('밤에는 하향등으로 시작하고 낮에는 꺼진 채로 시작한다', () => {
  assert.equal(defaultBeam(true), 'low');
  assert.equal(defaultBeam(false), 'off');
});

test('모든 상태에 한국어 이름이 있다', () => {
  for (const beam of BEAMS) assert.ok(beamLabel(beam).length > 0, beam);
  assert.equal(beamLabel('xenon'), beamLabel('off'));
});

test('세단 후미등은 중앙 연결 없이 좌우 각각 뾰족한 세 줄과 측면 랩을 갖는다', () => {
  assert.ok(SEDAN_REAR_LIGHTS.housingZ > 2.53, 'dark housing is buried in the rear fascia');
  assert.ok(SEDAN_REAR_LIGHTS.housingZ < SEDAN_REAR_LIGHTS.rowZ, 'dark housing must remain behind LEDs');
  assert.equal(SEDAN_REAR_LIGHTS.rows.length, 6);
  const left = SEDAN_REAR_LIGHTS.rows.filter(row => row.side < 0);
  const right = SEDAN_REAR_LIGHTS.rows.filter(row => row.side > 0);
  assert.equal(left.length, 3);
  assert.equal(right.length, 3);
  for (const row of SEDAN_REAR_LIGHTS.rows) {
    const innerEdge = Math.min(...row.rear.map(([x]) => Math.abs(x)));
    assert.ok(innerEdge >= 0.34, `tail row crosses central plate inset: ${innerEdge}`);
    const height = Math.max(...row.rear.map(([, y]) => y)) - Math.min(...row.rear.map(([, y]) => y));
    assert.ok(height <= 0.018, 'tail row is not slim');
    assert.equal(row.wrap.length, 4, 'tail row does not continue around the rear corner');
  }
  assert.equal(new Set(left.map(row => row.centerY)).size, 3);
  assert.equal(SEDAN_REAR_LIGHTS.reverse.length, 2);
});

test('세단 브레이크와 후진등은 실제 상태에 따라 기존 밝기 단계로 바뀐다', () => {
  assert.equal(rearLampIntensity(false, false), 0.1);
  assert.equal(rearLampIntensity(false, true), 1.1);
  assert.equal(rearLampIntensity(true, false), 3.4);
  assert.equal(reverseLampIntensity(false), 0);
  assert.equal(reverseLampIntensity(true), 2.8);
});

test('세단 전조등은 중앙 lightbar 없이 좌우 housing, 네 projector와 두 쌍의 L-DRL을 쓴다', () => {
  assert.equal(SEDAN_FRONT_LIGHTS.housings.length, 2);
  assert.equal(SEDAN_FRONT_LIGHTS.projectors.length, 4);
  assert.equal(SEDAN_FRONT_LIGHTS.drlSegments.length, 8);
  assert.equal(SEDAN_FRONT_LIGHTS.accents.length, 2);
  for (const part of [...SEDAN_FRONT_LIGHTS.projectors, ...SEDAN_FRONT_LIGHTS.drlSegments]) {
    assert.ok(Math.abs(part.position[0]) >= 0.56, 'sedan headlight segment crosses the center gap');
    assert.ok(part.position[2] >= -2.56, 'sedan headlight exceeds the front envelope');
  }
});

test('G45 SUV has paired upright hooked DRLs and independent rear light rows', () => {
  assert.equal(SUV_FRONT_LIGHTS.housings.length, 2);
  assert.equal(SUV_FRONT_LIGHTS.rows.length, 4);
  assert.equal(SUV_REAR_LIGHTS.housings.length, 2);
  assert.equal(SUV_REAR_LIGHTS.rows.length, 4);
  assert.equal(SUV_REAR_LIGHTS.reverse.length, 2);
  for (const row of SUV_FRONT_LIGHTS.rows) {
    const inner = Math.min(...row.rear.map(([x]) => Math.abs(x)));
    const height = Math.max(...row.rear.map(([, y]) => y)) - Math.min(...row.rear.map(([, y]) => y));
    assert.ok(inner >= 0.60, 'front row crosses the twin-grille gap');
    assert.ok(height >= 0.14 && height <= 0.17, 'G45 upright DRL height changed');
    const stemWidth=Math.abs(row.rear[0][0]-row.rear[1][0]);
    assert.ok(stemWidth<=0.03,'upright stem is too thick');
    assert.equal(row.rear.length,8,'DRL needs a closed hooked outline');
  }
  assert.ok(SUV_FRONT_LIGHTS.runtimeRowZ <= SUV_FRONT_LIGHTS.rowZ - 0.006,
    'runtime front rows are coplanar with static lenses');
  for (const row of SUV_REAR_LIGHTS.rows) {
    const inner = Math.min(...row.rear.map(([x]) => Math.abs(x)));
    assert.ok(inner >= 0.40, 'rear row forms a center light bar');
    assert.ok(row.rear.length >= 4, 'rear row lacks the angular outer hook');
  }
  assert.ok(SUV_REAR_LIGHTS.runtimeRowZ >= SUV_REAR_LIGHTS.rowZ + 0.006,
    'runtime rear rows are coplanar with static lenses');
  for (const housing of SUV_REAR_LIGHTS.housings) {
    assert.ok(Math.max(...housing.rear.map(([, y]) => y)) <= 0.36,
      'rear housing rises above the joined body shoulder');
  }
});
