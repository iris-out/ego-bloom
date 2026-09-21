import test from 'node:test';
import assert from 'node:assert/strict';
import { PLANE_KEYS } from '../../src/world/identity.js';
import { cockpitFov, eyePoint } from '../../src/world/eyePoints.js';
import {
  AIRCRAFT_PLACARDS, BOARD_OUT, BOARD_THICK, COCKPIT_FRAME, GUN_ONLY_PLANES, HUD_COMBINER,
  INSTRUMENT_OUT, PLACARD, SIX_PACK_DIALS, SPECIAL_DIALS, aircraftGaugeRig, panelFoot, panelPlace,
  placardToggles, visibleSlots,
} from '../../src/world/cockpits/aircraftDetail.js';
import { gaugeFaults } from '../../src/world/cockpits/gaugeClearance.js';

const DEG = 180 / Math.PI;

/** 외장 캐노피 구다. models/*.jsx 의 좌표를 눈 기준으로 옮겨 적었다.
 * 전투기는 group scale 1.12 를 곱한 바깥 좌표다. 실내 유리는 이 안에 있어야 한다. */
const EXTERIOR_CANOPY = {
  jet: { centre: [0, -0.28, -0.10], half: [0.82, 0.60, 1.85] },
  bomber: { centre: [0.46, -0.03, 0], half: [1.10, 0.62, 2.40] },
  prop: { centre: [0, 0, 0.10], half: [0.60, 0.52, 1.30] },
  fighter: { centre: [0, -0.32, -0.796], half: [0.784, 0.784, 2.128] },
  interceptor: { centre: [0, -0.24, 0.50], half: [0.44, 0.40, 1.10] },
  helicopter: { centre: [-0.38, -0.32, -0.30], half: [1.15, 0.95, 1.60] },
};

test('each aircraft has a compact labeled systems placard', () => {
  for (const key of PLANE_KEYS) {
    const placard = AIRCRAFT_PLACARDS[key];
    assert.ok(placard, `${key} has no placard`);
    assert.equal(typeof placard.title, 'string');
    assert.equal(placard.labels.length, 4);
    assert.ok(placard.labels.every((label) => /^[A-Z/ ]+$/.test(label)), `${key} has an unreadable label`);
  }
});

test('six-pack dials have short captions, units, and real scale limits', () => {
  assert.equal(SIX_PACK_DIALS.length, 6);
  for (const dial of SIX_PACK_DIALS) {
    assert.match(dial.label, /^[A-Z/ ]+$/);
    assert.ok(Number.isFinite(dial.max) && dial.max > 0);
    assert.equal(typeof dial.unit, 'string');
  }
});

test('prop fighter and interceptor use gun-only instrument pages', () => {
  assert.deepEqual(GUN_ONLY_PLANES, ['prop', 'interceptor']);
});

test('눈금 숫자가 바늘과 같은 자리를 가리킨다', () => {
  // dialFace 는 숫자를 스윕 전체에 고르게 뿌리고 바늘은 value/max 로 돈다. 그래서 숫자는
  // -offset 에서 시작해 max-offset 에서 끝나는 등차수열이어야 눈금이 거짓말을 하지 않는다.
  for (const dial of [...SIX_PACK_DIALS, ...Object.values(SPECIAL_DIALS)]) {
    const numbers = dial.numbers;
    assert.ok(Array.isArray(numbers) && numbers.length >= 5, `${dial.label} 숫자가 없다`);
    const offset = dial.offset || 0;
    assert.ok(Math.abs(numbers[0] + offset) < 1e-9, `${dial.label} 시작 숫자`);
    assert.ok(Math.abs(numbers[numbers.length - 1] - (dial.max - offset)) < 1e-9, `${dial.label} 끝 숫자`);
    const step = (dial.max) / (numbers.length - 1);
    numbers.forEach((value, index) => {
      assert.ok(Math.abs(value - (-offset + step * index)) < 1e-9, `${dial.label} 의 ${index} 번째 숫자가 등간격이 아니다`);
    });
  }
});

test('계기판이 눈에서 0.70~0.90 앞, 0.30~0.45 아래에 선다', () => {
  for (const key of PLANE_KEYS) {
    const frame = COCKPIT_FRAME[key];
    assert.ok(frame, `${key} 실내 뼈대가 없다`);
    assert.ok(eyePoint(key), `${key} 눈 좌표가 없다`);
    assert.ok(frame.panel.z <= -0.70 && frame.panel.z >= -0.90, `${key} 계기판 z 가 ${frame.panel.z} 다`);
    assert.ok(frame.panel.y <= -0.30 && frame.panel.y >= -0.45, `${key} 계기판 y 가 ${frame.panel.y} 다`);
  }
});

test('계기 아랫줄이 세로 화각 안에 다 들어온다', () => {
  for (const key of PLANE_KEYS) {
    const { panel } = COCKPIT_FRAME[key];
    const half = cockpitFov(key) / 2;
    for (const slot of visibleSlots(key)) {
      // 계기의 가장 아래 모서리다. 판을 눕혔으므로 아래로 갈수록 눈 쪽으로 다가와 각이 커진다.
      const [, y, z] = panelPlace(panel, slot.x, slot.up - slot.halfHeight, INSTRUMENT_OUT);
      const angle = Math.atan2(-y, -z) * DEG;
      assert.ok(angle < half - 1.5, `${key} ${slot.id} 아랫줄이 ${angle.toFixed(1)}도로 화각 절반 ${half}도를 위협한다`);
      // 계기가 판 밖으로 나가면 받침 없이 허공에 뜬다.
      assert.ok(Math.abs(slot.x) + slot.halfWidth <= panel.halfWidth + 1e-9, `${key} ${slot.id} 가 판 좌우로 넘친다`);
      assert.ok(Math.abs(slot.up) + slot.halfHeight <= panel.halfHeight + 1e-9, `${key} ${slot.id} 가 판 위아래로 넘친다`);
    }
  }
});

test('받침 판이 계기 원판보다 먼 z 에 있다', () => {
  // 받침이 계기보다 눈 쪽에 있으면 아랫줄 계기와 화면 아랫단을 가린다. 예전 배치의 결함이다.
  assert.ok(BOARD_OUT + BOARD_THICK / 2 <= 0, '받침 앞면이 판 면을 넘었다');
  assert.ok(INSTRUMENT_OUT > BOARD_OUT + BOARD_THICK / 2, '계기가 받침보다 앞에 있어야 한다');
});

test('HUD 사다리 평면이 combiner 유리를 넘지 않는다', () => {
  for (const [key, hud] of Object.entries(HUD_COMBINER)) {
    assert.ok(hud.plane[0] <= hud.glass[0], `${key} HUD 평면 폭 ${hud.plane[0]} 이 유리 ${hud.glass[0]} 보다 크다`);
    assert.ok(hud.plane[1] <= hud.glass[1], `${key} HUD 평면 높이 ${hud.plane[1]} 이 유리 ${hud.glass[1]} 보다 크다`);
    // 유리는 눈앞 근접면(0.05) 밖, 계기판보다 가까운 자리에 있어야 시선과 사다리가 겹친다.
    const distance = -hud.position[2];
    assert.ok(distance > 0.3 && distance < -COCKPIT_FRAME[key].panel.z, `${key} combiner 거리 ${distance} 가 이상하다`);
  }
});

test('HUD 유리 아래가 계기판 윗줄보다 위에 있다', () => {
  // combiner 가 계기판 위로 내려오면 윗줄 계기를 덮는다. 유리 아래 모서리 각이 계기판 윗변보다 작아야 한다.
  for (const [key, hud] of Object.entries(HUD_COMBINER)) {
    const { panel } = COCKPIT_FRAME[key];
    const glassBottom = Math.atan2(-(hud.position[1] - hud.glass[1] / 2), -hud.position[2]) * DEG;
    const [, topY, topZ] = panelPlace(panel, 0, panel.halfHeight, INSTRUMENT_OUT);
    const panelTop = Math.atan2(-topY, -topZ) * DEG;
    assert.ok(glassBottom <= panelTop + 1, `${key} 유리 아래 ${glassBottom.toFixed(1)}도가 계기판 위 ${panelTop.toFixed(1)}도보다 낮다`);
  }
});

test('실내 캐노피 유리가 외장 캐노피 구 안에 있다', () => {
  for (const key of PLANE_KEYS) {
    const { canopy } = COCKPIT_FRAME[key];
    const outside = EXTERIOR_CANOPY[key];
    const dx = Math.abs(canopy.x - outside.centre[0]), dy = Math.abs(canopy.y - outside.centre[1]);
    assert.ok(canopy.radius + dx <= outside.half[0] + 1e-9, `${key} 캐노피가 좌우로 삐져나온다`);
    if (canopy.flat) {
      // 평면 지붕은 가장 넓은 자리(가장자리) 에서 구의 윗면 아래여야 한다. 반원통과 달리
      // 높이가 반지름에 묶이지 않는다. 앞뒤 모서리는 구 밖으로 나가지만 구 자체가 1인칭에서 숨는다.
      const edge = Math.abs(canopy.radius + dx) / outside.half[0];
      const roof = outside.centre[1] + outside.half[1] * Math.sqrt(Math.max(0, 1 - edge * edge));
      assert.ok(canopy.y <= roof + 1e-9, `${key} 평면 지붕 ${canopy.y} 이 구 윗면 ${roof.toFixed(3)} 위다`);
    } else {
      assert.ok(canopy.radius + dy <= outside.half[1] + 1e-9, `${key} 캐노피 반원통이 위로 삐져나온다`);
    }
    const front = canopy.z - canopy.length / 2, back = canopy.z + canopy.length / 2;
    assert.ok(front >= outside.centre[2] - outside.half[2] - 1e-9, `${key} 캐노피가 앞으로 넘친다`);
    assert.ok(back <= outside.centre[2] + outside.half[2] + 1e-9, `${key} 캐노피가 뒤로 넘친다`);
    // 활 프레임은 유리 안에 선다.
    for (const arc of canopy.arcs) {
      assert.ok(arc >= front - 1e-9 && arc <= back + 1e-9, `${key} 활 프레임 ${arc} 이 유리 밖이다`);
    }
  }
});

test('좌석과 바닥이 눈 아래 사람 앉은 비례를 지킨다', () => {
  for (const key of PLANE_KEYS) {
    const { seat, tub } = COCKPIT_FRAME[key];
    // 앉은 사람의 눈은 방석에서 0.62~0.78 위다. 더 낮으면 좌석이 가슴에 붙고 더 높으면 공중에 뜬다.
    assert.ok(-seat.y >= 0.62 && -seat.y <= 0.78, `${key} 방석이 눈에서 ${-seat.y} 떨어져 있다`);
    assert.ok(tub.floor < seat.y, `${key} 바닥이 방석보다 높다`);
  }
});

test('명판 토글 네 개가 명판 안에 선다', () => {
  const toggles = placardToggles();
  assert.equal(toggles.length, 4);
  for (const [x, z] of toggles) {
    assert.ok(Math.abs(x) < PLACARD.width / 2, '토글이 명판 좌우를 넘는다');
    assert.ok(Math.abs(z) < PLACARD.height / 2, '토글이 명판 앞뒤를 넘는다');
  }
  // 왼쪽 칸이 왼쪽에, 윗줄이 앞(-z) 에 온다. 명판을 눕혔으므로 캔버스 위쪽이 앞이다.
  assert.ok(toggles[0][0] < toggles[1][0]);
  assert.ok(toggles[0][1] < toggles[2][1]);
});

test('옆 벽과 바닥이 캐노피 유리 앞 끝까지 간다', () => {
  // 계기판에서 끊으면 유리 밑선 아래 앞쪽이 뚫려 옆을 볼 때 잔디가 보이고 사이드 콘솔이
  // 허공에 뜬 것처럼 읽힌다. Tub 이 쓰는 식을 그대로 다시 계산한다.
  for (const key of PLANE_KEYS) {
    const { canopy, panel } = COCKPIT_FRAME[key];
    const canopyFront = canopy.z - canopy.length / 2;
    const wallFront = Math.min(canopyFront + 0.04, panel.z + 0.03);
    assert.ok(wallFront <= Math.min(canopyFront, panel.z) + 0.05,
      `${key} 옆 벽 앞 끝 ${wallFront.toFixed(2)} 이 유리 앞 ${canopyFront.toFixed(2)} 에 못 미친다`);
  }
});

test('사이드 콘솔이 조종석 벽 안에 붙는다', () => {
  for (const key of PLANE_KEYS) {
    const { side, tub } = COCKPIT_FRAME[key];
    const centre = tub.x || 0, inner = tub.halfWidth - 0.025;
    for (const sign of [-1, 1]) {
      const near = sign * side.x - centre;
      assert.ok(Math.abs(near) + side.width / 2 <= inner + 1e-9,
        `${key} 콘솔이 벽을 ${(Math.abs(near) + side.width / 2 - inner).toFixed(3)} 뚫는다`);
    }
  }
});

test('프로펠러기 조준기 유리가 눈높이에 있고 하우징이 그 아래에 앉는다', () => {
  // 조준 유리는 눈높이(0도) 에 있어야 조준선과 탄착 표식이 한자리에 온다. 불투명한 하우징은
  // 유리 바로 아래에 붙어 카울이 보이는 띠를 조금만 먹는다.
  const { sight, compass, panel } = COCKPIT_FRAME.prop;
  assert.ok(Math.abs(Math.atan2(-sight.y, -sight.z) * DEG) <= 1, '유리 중심이 눈높이를 벗어났다');
  assert.ok(sight.width <= 0.10 && sight.height <= 0.10, '조준기 유리가 너무 크다');
  const mount = sight.y - sight.height / 2 - sight.housing[1] / 2;
  assert.ok(Math.abs((mount + sight.housing[1] / 2) - (sight.y - sight.height / 2)) < 1e-9,
    '하우징 윗면이 유리 밑변과 어긋난다');
  const band = Math.atan2(-(mount - sight.housing[1] / 2), -(sight.z + 0.03 + sight.housing[2] / 2)) * DEG
    - Math.atan2(-(mount + sight.housing[1] / 2), -(sight.z + 0.03 - sight.housing[2] / 2)) * DEG;
  assert.ok(band <= 10, `하우징이 눈 아래 ${band.toFixed(1)}도를 덮는다`);
  const [cx, cy, cz] = panelPlace(panel, compass.x, compass.up + compass.radius, compass.out);
  const down = Math.atan2(-cy, -cz) * DEG, across = Math.atan2(Math.abs(cx), -cz) * DEG;
  assert.ok(down >= 8 || across >= 8, `나침반이 정면 ${down.toFixed(1)}도, ${across.toFixed(1)}도로 가운데에 있다`);
  assert.ok(compass.radius <= 0.035, '나침반이 너무 크다');
});

test('요격기 조준기 마운트가 계기 윗줄보다 위에서 끝난다', () => {
  // 예전 하우징은 0.19 x 0.07 이라 눈 아래 5~15도를 덮어 계기판이 하나도 보이지 않았다.
  const { sight, panel } = COCKPIT_FRAME.interceptor;
  const bottom = -(sight.y - sight.housing[1] / 2);
  const near = -(sight.z + sight.housing[2] / 2);
  const mount = Math.atan2(bottom, near) * DEG;
  const instruments = visibleSlots('interceptor').map((slot) => {
    const [, y, z] = panelPlace(panel, slot.x, slot.up + slot.halfHeight, INSTRUMENT_OUT);
    return Math.atan2(-y, -z) * DEG;
  });
  assert.ok(mount < Math.min(...instruments),
    `마운트 아랫변 ${mount.toFixed(1)}도가 계기 윗변 ${Math.min(...instruments).toFixed(1)}도를 덮는다`);
  assert.ok(sight.housing[0] <= 0.12 && sight.housing[1] <= 0.04, '마운트가 너무 크다');
});

test('폭격기 오버헤드가 유리 지붕 밑에 매달리고 프레임 사이에 있다', () => {
  const { overhead, canopy } = COCKPIT_FRAME.bomber;
  for (const edge of [-1, 1]) {
    const offset = Math.abs(overhead.x + edge * overhead.width / 2 - canopy.x);
    const roof = canopy.flat ? canopy.y : canopy.y + Math.sqrt(Math.max(0, canopy.radius ** 2 - offset ** 2));
    assert.ok(offset <= canopy.radius, '오버헤드가 지붕보다 넓다');
    assert.ok(overhead.y + 0.02 <= roof, `오버헤드 윗면이 지붕(${roof.toFixed(2)}) 위로 솟는다`);
  }
  const front = overhead.z - overhead.depth / 2, back = overhead.z + overhead.depth / 2;
  assert.ok(front >= canopy.arcs[1] && back <= canopy.arcs[2], '오버헤드가 프레임 사이를 벗어난다');
  assert.ok(overhead.y >= 0.10, '오버헤드가 머리에 닿는다');
});

test('폭격기 요크가 눈에서 0.45 아래, 0.45 앞에 있다', () => {
  // 요크가 가까우면 Hands 의 전완(0.082 두께) 이 눈앞 0.20 까지 와 화면 오른쪽 아래를 덮는다.
  const { yoke } = COCKPIT_FRAME.bomber;
  assert.ok(-yoke.y >= 0.45, `요크가 눈 아래 ${-yoke.y} 다`);
  assert.ok(-yoke.z >= 0.45, `요크가 눈 앞 ${-yoke.z} 다`);
});

test('폭격기 옆 창이 벽 윗단과 지붕 밑선을 잇는다', () => {
  const { window: pane, tub, canopy } = COCKPIT_FRAME.bomber;
  assert.ok(Math.abs((pane.y - pane.height / 2) - tub.wallTop) < 1e-9, '창 아랫변이 벽 윗단과 어긋난다');
  assert.ok(Math.abs((pane.y + pane.height / 2) - canopy.y) < 1e-9, '창 윗변이 지붕 밑선과 어긋난다');
});

test('기수 덮개와 조준기 마운트가 계기 윗줄 위에서 끝난다', () => {
  // 덮개는 눈보다 아래 띠로만 보여야 한다. 앞 모서리가 계기 윗변까지 내려오면 속도, 고도,
  // 연료 계기와 화면이 통째로 가린다. 요격기는 그 여유가 1도뿐이라 덮개를 아예 뺐다.
  for (const key of PLANE_KEYS) {
    const frame = COCKPIT_FRAME[key];
    const tops = visibleSlots(key).map((slot) => {
      const [, y, z] = panelPlace(frame.panel, slot.x, slot.up + slot.halfHeight, INSTRUMENT_OUT);
      return Math.atan2(-y, -z) * DEG;
    });
    const instrument = Math.min(...tops);
    if (frame.deck) {
      const near = -(frame.deck.z + frame.deck.depth / 2), bottom = -(frame.deck.y - 0.025);
      const edge = Math.atan2(bottom, near) * DEG;
      assert.ok(edge <= instrument - 1.2,
        `${key} 덮개 앞 모서리 ${edge.toFixed(1)}도가 계기 윗변 ${instrument.toFixed(1)}도에 붙는다`);
    }
    const sight = frame.sight;
    if (sight?.housing) {
      const bottom = -(sight.y - sight.height / 2 - sight.housing[1] / 2 - sight.housing[1] / 2);
      const mountBottom = sight.height ? bottom : -(sight.y - sight.housing[1] / 2);
      const edge = Math.atan2(mountBottom, -(sight.z + sight.housing[2] / 2)) * DEG;
      assert.ok(edge <= instrument - 0.5,
        `${key} 조준기 마운트 ${edge.toFixed(1)}도가 계기 윗변 ${instrument.toFixed(1)}도를 덮는다`);
    }
  }
});

test('항공기 여섯 종 계기가 화각과 코 덮개, 요크 림, 조준기를 피한다', () => {
  // aircraftGaugeRig 가 visibleSlots 와 COCKPIT_FRAME 에서 그대로 뽑은 좌표다. 계기 지름이나
  // 계기판 자리를 바꾸면 여기가 먼저 깨진다. 같은 검사를 지상 아홉 종과 함께
  // vehicle-interior-layout.test.mjs 가 15종 전부에 한 번 더 건다.
  for (const key of PLANE_KEYS) {
    const rig = aircraftGaugeRig(key);
    assert.equal(rig.gauges.length, visibleSlots(key).length, `${key} 계기 수가 slot 수와 다르다`);
    const faults = gaugeFaults(rig);
    assert.deepEqual(faults, [], `${key} 계기가 잘린다: ${JSON.stringify(faults)}`);
  }
});

test('계기 아랫변이 계기판 받침 밑선 안에 든다', () => {
  // 받침보다 아래로 내려간 계기는 배경에 떠 보인다. panelFoot 이 받침 아랫변이다.
  for (const key of PLANE_KEYS) {
    const [, footY, footZ] = panelFoot(key);
    const foot = Math.atan2(-footY, -footZ) * DEG;
    for (const gauge of aircraftGaugeRig(key).gauges) {
      const angle = Math.atan2(-gauge.y - gauge.halfHeight, -gauge.z) * DEG;
      assert.ok(angle <= foot, `${key} ${gauge.id} 아랫변 ${angle.toFixed(1)}도가 받침 ${foot.toFixed(1)}도를 넘는다`);
    }
  }
});
