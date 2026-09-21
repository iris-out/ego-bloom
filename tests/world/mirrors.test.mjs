import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CROP, MIRROR_DEPTH, MIRROR_LAYOUT, MIRROR_LAYOUTS, MIRROR_PASS, REAR_CAMERA, cropAspect, hasMirrors,
} from '../../src/world/cockpits/mirrorLayout.js';
import { NEAR_COCKPIT } from '../../src/world/eyePoints.js';
import { VEHICLES } from '../../src/world/carPhysics.js';
import { isCombatVehicle } from '../../src/world/groundWeapons.js';
import { COCKPIT_PARTS } from '../../src/world/cockpits/triangles.js';

test('거울은 전투 차량에는 없다. 승용차는 셋, 오토바이는 좌우 둘이다', () => {
  for (const key of Object.keys(VEHICLES)) {
    const combat = isCombatVehicle(key);
    assert.equal(hasMirrors(key), !combat, `${key} 거울 여부`);
    const expectedCount = combat ? 0 : (key === 'motorcycle' ? 2 : 3);
    assert.equal(COCKPIT_PARTS[key]?.mirror || 0, expectedCount, `${key} 콕핏 예산의 거울 수`);
  }
});

test('오토바이 거울 자리 표는 좌우뿐이고 승용차 표는 기존 것을 그대로 쓴다', () => {
  assert.equal(MIRROR_LAYOUTS.car, MIRROR_LAYOUT, '승용차 표는 기존 MIRROR_LAYOUT 그대로다');
  const bike = MIRROR_LAYOUTS.motorcycle;
  assert.deepEqual(Object.keys(bike).sort(), ['left', 'right'], '오토바이는 룸미러가 없다');
  assert.ok(bike.left.x < -0.5 && bike.right.x > 0.5, '좌우 바깥쪽에 있어야 한다');
  for (const spec of Object.values(bike)) {
    assert.ok(spec.y > 0 && spec.y < 0.95, `화면 위쪽에 있어야 한다: ${spec.y}`);
    assert.ok(spec.height > 0.05 && spec.height < 0.25, `화면 높이의 5~25퍼센트다: ${spec.height}`);
    assert.equal('yaw' in spec, false, '가상 거울은 기울이지 않는다');
  }
});

test('뒤 카메라는 차체 안에서 뒤쪽을 본다', () => {
  for (const [key, [x, y, z]] of Object.entries(REAR_CAMERA)) {
    const spec = VEHICLES[key];
    assert.equal(x, 0, `${key} 뒤 카메라가 가운데가 아니다`);
    assert.ok(y > 0 && y < 2.3, `${key} 뒤 카메라 높이 ${y}`);
    assert.ok(Math.abs(z) <= spec.depth / 2, `${key} 뒤 카메라가 차체 밖 ${z} 에 있다`);
  }
});

test('거울 셋은 한 텍스처의 서로 다른 영역을 자르고 좌우가 겹치지 않는다', () => {
  // 옆거울은 룸미러보다 바깥을 보고 서로 겹치지 않는다. 룸미러는 가운데다.
  const [, leftEnd] = CROP.left, [rightStart] = CROP.right, [rearStart, rearEnd] = CROP.rear;
  assert.ok(leftEnd <= rightStart, '왼쪽과 오른쪽이 겹친다');
  assert.ok(Math.abs((rearStart + rearEnd) / 2 - 0.5) < 1e-9, '룸미러가 가운데가 아니다');
  for (const [u0, u1, v0, v1] of Object.values(CROP)) {
    assert.ok(u0 >= 0 && u1 <= 1 && v0 >= 0 && v1 <= 1 && u0 < u1 && v0 < v1);
  }
  // 거울면 가로는 잘라 쓰는 영역의 비율에서 나온다. 룸미러는 넓고 옆거울은 그보다 좁다.
  assert.ok(cropAspect('rear') > 2.5 && cropAspect('left') < 2 && cropAspect('left') > 1);
  assert.ok(Math.abs(cropAspect('left') - cropAspect('right')) < 1e-9);
});

test('낮은 품질일수록 작게 드물게 그린다', () => {
  assert.ok(MIRROR_PASS.low.width < MIRROR_PASS.medium.width && MIRROR_PASS.medium.width < MIRROR_PASS.high.width);
  assert.ok(MIRROR_PASS.low.every > MIRROR_PASS.medium.every && MIRROR_PASS.medium.every >= MIRROR_PASS.high.every);
  // 가장 큰 패스도 1280x720 의 12퍼센트를 넘지 않는다.
  assert.ok(MIRROR_PASS.high.width * MIRROR_PASS.high.height < 1280 * 720 * 0.12);
});

test('거울은 기울기 없이 화면 위쪽 양 구석과 가운데에 평평하게 뜬다', () => {
  assert.ok(MIRROR_LAYOUT.left.x < -0.6 && MIRROR_LAYOUT.right.x > 0.6 && MIRROR_LAYOUT.rear.x === 0);
  for (const spec of Object.values(MIRROR_LAYOUT)) {
    assert.ok(spec.y > 0.6 && spec.y < 0.95, `화면 위쪽에 있어야 한다: ${spec.y}`);
    assert.ok(spec.height > 0.05 && spec.height < 0.25, `화면 높이의 5~25퍼센트다: ${spec.height}`);
    assert.equal('yaw' in spec, false, '가상 거울은 기울이지 않는다');
  }
  assert.ok(MIRROR_DEPTH > NEAR_COCKPIT, '거울 평면이 근접면 안쪽이면 잘린다');
});
