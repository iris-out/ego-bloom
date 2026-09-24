import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUDGET, COCKPIT_PARTS, COCKPIT_TRIANGLES, DIAL_TICKS, PART, QUALITY_PARTS, TRI,
  cockpitTriangles, dialTicks, withinBudget, budgetFor,
} from '../../src/world/cockpits/triangles.js';
import { COCKPIT_FRAME } from '../../src/world/cockpits/aircraftDetail.js';
import { loadModelFixture, modelTriangles } from './model-mount-fixture.mjs';
import { QUALITY_ORDER, detailLevel } from '../../src/world/cockpits/detail.js';
import { PLANE_KEYS, VEHICLE_KEYS } from '../../src/world/identity.js';

test('등급별 상한이 정의돼 있다', () => {
  assert.deepEqual(BUDGET, { low: 1800, medium: 4500, high: 9000 });
  assert.ok(BUDGET.low < BUDGET.medium && BUDGET.medium < BUDGET.high);
});

test('full four and five seat cabins have measured scoped allowances while older cars retain global ceilings', () => {
  assert.equal(budgetFor('convertible', 'low'), 3300);
  assert.equal(budgetFor('coupe', 'low'), 4800);
  assert.equal(budgetFor('coupe', 'medium'), 7000);
  for (const key of ['sedan','suv','formula','electric','supercar']) {
    for (const quality of ['low','medium','high']) assert.equal(budgetFor(key, quality), BUDGET[quality]);
  }
});

test('아홉 종 모두 콕핏 구성이 있다', () => {
  for (const key of [...PLANE_KEYS, ...VEHICLE_KEYS]) {
    assert.ok(COCKPIT_PARTS[key], `${key} 콕핏 구성이 없다`);
    assert.ok(Number.isInteger(COCKPIT_TRIANGLES[key]) && COCKPIT_TRIANGLES[key] > 0,
      `${key} 삼각형 수가 ${COCKPIT_TRIANGLES[key]} 다`);
  }
});

test('모든 콕핏이 각 기종의 가장 낮은 등급 예산 안에 든다', () => {
  for (const [key, count] of Object.entries(COCKPIT_TRIANGLES)) {
    assert.ok(count <= budgetFor(key, 'low'), `${key} 가 ${count} 로 low 예산 ${budgetFor(key, 'low')} 을 넘는다`);
    assert.equal(withinBudget(key, 'low'), true);
    assert.equal(withinBudget(key, 'medium'), true);
  }
});

test('없는 기종은 예산을 통과하지 않는다', () => {
  assert.equal(withinBudget('ufo'), false);
  assert.equal(withinBudget(undefined), false);
});

test('조각을 더하면 삼각형 수가 늘어난다', () => {
  // Curved sedan surfaces cost more than the simple jet; bomber adds aircraft controls.
  assert.ok(COCKPIT_TRIANGLES.sedan > COCKPIT_TRIANGLES.jet);
  assert.ok(COCKPIT_TRIANGLES.bomber > COCKPIT_TRIANGLES.jet);
});

test('legacy aircraft reserve structure for a layered dash, canopy, and seat tub', () => {
  // 계기판 한 장만 크게 늘려 놓지 않는다. 캐노피, 글레어실드, 중앙 터널, 양쪽 콘솔과
  // 좌석 볼스터가 각각 남아 있어야 1인칭에서 검은 판 하나로 보이지 않는다.
  for (const key of Object.keys(COCKPIT_FRAME)) {
    assert.ok(COCKPIT_PARTS[key].panel >= 14, `${key} structural trim is too sparse`);
  }
});

test('계기 화면과 HUD 도 삼각형 수에 들어 있다', () => {
  // 화면은 베젤 박스 하나와 평면 하나, HUD 는 평면 하나다. 글자는 텍스처라 공짜다.
  assert.equal(PART.display, 14);
  assert.equal(PART.hud, 2);
  assert.equal(cockpitTriangles('fighter'), PART.panel * 20 + PART.dial + PART.stick + PART.lever + PART.display * 2 + PART.hud + PART.placard);
});

test('포뮬러 콕핏은 헤일로와 디지털 휠 화면과 거울 예산을 예약한다', () => {
  const parts = COCKPIT_PARTS.formula;
  assert.ok(parts.panel >= 12, '콕핏 욕조와 헤일로 구조가 있어야 한다');
  assert.equal(parts.yoke, 1);
  assert.equal(parts.display, 1);
  assert.equal(parts.mirror, 2);
  assert.ok(COCKPIT_TRIANGLES.formula <= BUDGET.low);
});

test('계기 눈금이 삼각형 수에 들어 있다', () => {
  assert.equal(DIAL_TICKS, 12);
  assert.equal(PART.tick, 2);
  assert.equal(PART.dial, PART.dialBody + DIAL_TICKS * PART.tick);
  // Digital sedan has no mesh dial ticks; analog truck still has them.
  assert.equal(cockpitTriangles('sedan'), 1504);
  assert.equal(cockpitTriangles('sedan', 12), cockpitTriangles('sedan', 2));
  assert.ok(cockpitTriangles('truck', 12) > cockpitTriangles('truck', 2));
});

test('기종별 눈금 수를 기본값으로 쓴다', () => {
  for (const key of Object.keys(COCKPIT_PARTS)) {
    assert.ok(dialTicks(key) >= 2, `${key} 눈금 수가 ${dialTicks(key)} 다`);
    assert.equal(COCKPIT_TRIANGLES[key], cockpitTriangles(key, dialTicks(key)));
  }
});

test('눈금을 줄여도 예산 안에 든다', () => {
  // 호출 쪽이 ticks 를 8 로 줄일 수 있어야 한다. 줄인 쪽이 더 작아야 한다.
  for (const key of Object.keys(COCKPIT_PARTS)) {
    const reduced = cockpitTriangles(key, 8);
    assert.ok(reduced <= COCKPIT_TRIANGLES[key], `${key} 눈금을 줄였는데 ${reduced} 로 늘었다`);
    assert.equal(withinBudget(key, 'low', 8), true);
  }
});

test('폭격기는 기존 low 예산 안에 있고 모든 콕핏은 해당 low 예산 안에 든다', () => {
  // 기본 눈금 12 를 고른 근거다. 박스 눈금이면 계기가 많은 기종이 예산을 넘는다.
  assert.equal(COCKPIT_TRIANGLES.bomber, 1526);
  assert.ok(COCKPIT_TRIANGLES.bomber <= BUDGET.low);
  assert.ok(Object.entries(COCKPIT_TRIANGLES).every(([key, count]) => count <= budgetFor(key, 'low')));
});

test('열다섯 기종 모두 등급별 추가분 칸을 갖는다', () => {
  for (const key of Object.keys(COCKPIT_PARTS)) {
    assert.ok(QUALITY_PARTS[key], `${key} 추가분 칸이 없다`);
    assert.equal(typeof QUALITY_PARTS[key].medium, 'object');
    assert.equal(typeof QUALITY_PARTS[key].high, 'object');
  }
  assert.equal(Object.keys(QUALITY_PARTS).length, Object.keys(COCKPIT_PARTS).length);
});

test('등급을 올려도 그 등급 예산 안에 든다', () => {
  for (const key of Object.keys(COCKPIT_PARTS)) {
    for (const quality of QUALITY_ORDER) {
      const count = cockpitTriangles(key, dialTicks(key), quality);
      assert.ok(Number.isInteger(count) && count > 0, `${key} ${quality} 삼각형 수가 ${count} 다`);
      assert.ok(count <= budgetFor(key, quality), `${key} 가 ${quality} 에서 ${count} 로 ${budgetFor(key, quality)} 을 넘는다`);
      assert.equal(withinBudget(key, quality), true);
    }
  }
});

test('등급이 올라가면 조각 수가 줄지 않는다', () => {
  for (const key of Object.keys(COCKPIT_PARTS)) {
    const ticks = dialTicks(key);
    const low = cockpitTriangles(key, ticks, 'low');
    const medium = cockpitTriangles(key, ticks, 'medium');
    const high = cockpitTriangles(key, ticks, 'high');
    assert.ok(medium >= low, `${key} medium 이 low 보다 작다`);
    assert.ok(high >= medium, `${key} high 가 medium 보다 작다`);
  }
  // 등급을 주지 않으면 low 구성이다. COCKPIT_TRIANGLES 가 그 값이다.
  assert.equal(cockpitTriangles('bomber'), COCKPIT_TRIANGLES.bomber);
});

test('detailLevel 이 등급을 두 불리언으로 준다', () => {
  assert.deepEqual(detailLevel('low'), { mid: false, high: false });
  assert.deepEqual(detailLevel('medium'), { mid: true, high: false });
  assert.deepEqual(detailLevel('high'), { mid: true, high: true });
  // 알 수 없는 값은 medium 으로 본다. low 만 명시적으로 걷어낸다.
  assert.deepEqual(detailLevel(undefined), { mid: true, high: false });
  assert.deepEqual(QUALITY_ORDER, ['low', 'medium', 'high']);
});

test('새 공용 조각 값이 parts.jsx 의 geometry 와 맞는다', () => {
  // 뚜껑 없는 원기둥은 옆면뿐이다. mid 계기 한 벌은 바깥 금속 링(20분할, 40), 위만 덮는
  // 반원통 챙(10분할, 20), 덮개 유리 원판(20) 셋이다.
  assert.equal(TRI.cylinderOpen(20), 40);
  assert.equal(PART.dialHood, 80);
  assert.equal(PART.knob, 44, '8분할 원통에 지시 박스 하나다');
  assert.equal(PART.toggle, 24);
  assert.equal(PART.button, 24);
  assert.equal(PART.seat, 60, '방석, 등받이, 머리받침, 볼스터 둘이다');
  assert.equal(PART.hands, 120, '손 하나가 손등, 손가락, 엄지, 손목, 소매 다섯 상자다');
  assert.equal(PART.stickHand, PART.hands / 2);
  assert.equal(PART.pedal, 24);
  assert.equal(PART.quadrant, 24);
  assert.equal(PART.gearLever, 36);
  assert.equal(PART.attitudeBall, 408, '구 192, 베젤 192, 기준 날개 24 다');
  assert.equal(PART.glass, 2);
  assert.equal(PART.canopyArc, 144);
  assert.equal(PART.canopyShell, 24);
  assert.equal(PART.shade, 2);
  assert.equal(PART.wipers, 48);
  assert.equal(PART.bolt, 24);
  assert.equal(PART.grabHandle, 36);
});

// Count the actual shared gondola geometry; its surfaces do not use the legacy part inventory.
test('airship budget equals mounted cabin geometry at every quality', async () => {
  const { default: AirshipCabin } = await loadModelFixture('src/world/cockpits/AirshipCabin.jsx');
  for (const quality of QUALITY_ORDER) {
    const mounted = modelTriangles(AirshipCabin({ quality }));
    // The headless fixture has no canvas; the browser adds one two-triangle display plane.
    assert.equal(cockpitTriangles('airship', undefined, quality), mounted + 2);
    assert.ok(mounted + 2 <= budgetFor('airship', quality));
  }
});
