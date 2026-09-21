import test from 'node:test';
import assert from 'node:assert/strict';
import { DISPLAY, displaySize, instrumentReadings, hudLadder, drawInstrument, drawFlightHud } from '../../src/world/cockpits/instruments.js';
import { DIAL_FACE, DIAL_SWEEP, dialAngle, dialFaceNumbers, dialFacePoint, dialNumberSize, dialNumberStride } from '../../src/world/cockpits/dialScale.js';

test('instruments preserve real values, wrap north, and do not invent missing telemetry', () => {
  const read = instrumentReadings({ speed: 42.4, heading: 359.8, throttle: .75, gear: 'R', aim: { yaw: Math.PI / 2, pitch: -.1 } });
  assert.equal(read.speed, '42');
  assert.equal(read.heading, '000');
  assert.equal(read.throttle, '75');
  assert.equal(read.gear, 'R');
  assert.equal(read.azimuth, '90.0');
  assert.equal(read.elevation, '-5.7');
  assert.equal(read.range, '—');
  assert.equal(instrumentReadings({ cannonAmmo: 0 }).gun, '0');
  for (const value of Object.values(instrumentReadings({ speed: NaN, heading: Infinity }))) assert.ok(!/NaN|Infinity|undefined/.test(value));
});

test('HUD horizon moves down when pitching up and banks with the outside horizon', () => {
  const level = hudLadder(0, 0).find(mark => mark.degrees === 0);
  assert.ok(Math.abs(level.left.y - 256) < 1e-8);
  const climb = hudLadder(.1, 0).find(mark => mark.degrees === 0);
  assert.ok(climb.left.y > level.left.y);
  const bank = hudLadder(0, .3).find(mark => mark.degrees === 0);
  assert.ok(bank.left.y < bank.right.y);
  for (const pitch of [-1.15, 1.15]) for (const mark of hudLadder(pitch, .6)) {
    assert.ok([mark.left.x, mark.left.y, mark.right.x, mark.right.y].every(Number.isFinite));
  }
});

// Canvas call recorder: runs production drawing functions, catches invalid geometry
// and verifies the displayed text against hand-selected telemetry.
function canvasRecorder() {
  const text = [];
  const ctx = new Proxy({}, { get: (_, key) => key === 'fillText'
    ? value => text.push(String(value))
    : (...args) => { for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value), `${String(key)} received ${value}`); }, set: () => true });
  return { ctx, text };
}

test('all instrument layouts draw named readings and remain finite with missing data', () => {
  for (const mode of ['sixpack', 'flight', 'nav', 'stores', 'car', 'bike', 'ground', 'cluster', 'mfd', 'fcs', 'bay']) {
    const { ctx, text } = canvasRecorder();
    drawInstrument(ctx, mode, { speed: 42, altitude: 350, heading: 90, gear: 'R', cannonAmmo: 0 }, '#83eda0');
    assert.ok(text.length >= 3, mode);
    assert.ok(!text.some(value => /NaN|undefined|Infinity/.test(value)));
    drawInstrument(ctx, mode, {}, '#83eda0');
  }
});

test('bomber stores show the real bomb and bay state instead of fighter weapons', () => {
  const { ctx, text } = canvasRecorder();
  drawInstrument(ctx, 'bombs', { bombAmmo: 7, bayOpen: true, range: 384, hull: 1 }, '#ffc98a');
  assert.ok(text.includes('BOMB'));
  assert.ok(text.includes('7'));
  assert.ok(text.includes('BAY'));
  assert.ok(text.includes('OPEN'));
  assert.ok(!text.includes('GUN'));
  assert.ok(!text.includes('MSL'));
});

test('missing fuel remains unknown rather than a false zero', () => {
  assert.equal(instrumentReadings({ fuel: null }).fuel, '—');
  const { ctx, text } = canvasRecorder();
  drawInstrument(ctx, 'flight', { fuel: null, roll: 12 }, '#9fe8ff');
  assert.ok(text.includes('ROLL'));
  assert.ok(!text.includes('FUEL %'));
});

test('fighter HUD converts raw pose units once and shows empty ammunition honestly', () => {
  const { ctx, text } = canvasRecorder();
  drawFlightHud(ctx, { speed: 100, y: 352.1, pitch: .1, roll: 0, heading: 0, throttle: .8, climb: 4 }, { cannonAmmo: 0, missileAmmo: 2 });
  assert.ok(text.includes('360'));
  assert.ok(text.includes('350'));
  assert.ok(text.includes('GUN 0'));
  assert.ok(text.includes('MSL 2'));
  assert.ok(text.includes('000'));
});

test('gun-only HUD never labels an unavailable missile rack', () => {
  const { ctx, text } = canvasRecorder();
  drawFlightHud(ctx, { speed: 100, y: 352.1, heading: 0 }, { cannonAmmo: 360, missileAmmo: 6 }, 'guns');
  assert.ok(text.includes('GUN 360'));
  assert.ok(!text.some((value) => value.startsWith('MSL ')));
});

test('새 배치 네 개가 없는 값을 지어내지 않는다', () => {
  for (const mode of ['cluster', 'mfd', 'fcs', 'bay']) {
    const { ctx, text } = canvasRecorder();
    drawInstrument(ctx, mode, {}, '#83eda0');
    assert.ok(text.includes('—'), `${mode} 가 모르는 값을 빈 표시로 적지 않는다`);
    assert.ok(!text.some((value) => /NaN|undefined|Infinity|^0$/.test(value)), mode);
  }
});

test('승용차 계기판은 실제 속도, 기어, 회전수만 적고 주행 거리 칸을 만들지 않는다', () => {
  const { ctx, text } = canvasRecorder();
  drawInstrument(ctx, 'cluster', { speed: 88, gear: 3, rpm: 4200, top: 200 }, '#83eda0');
  assert.ok(text.includes('88'));
  assert.ok(text.includes('GEAR') && text.includes('3'));
  assert.ok(text.includes('RPM') && text.includes('4200'));
  assert.ok(!text.includes('ODO'));
});

test('MFD 는 정사각이고 제목이 페이지를 고른다', () => {
  assert.deepEqual(displaySize('mfd'), { width: 256, height: 256 });
  assert.deepEqual(displaySize('flight'), { width: 512, height: 256 });
  assert.equal(DISPLAY.square.width, DISPLAY.square.height);
  const stores = canvasRecorder();
  drawInstrument(stores.ctx, 'mfd', { cannonAmmo: 120, missileAmmo: 2 }, '#83eda0', 'STORES');
  assert.ok(stores.text.includes('STORES'));
  assert.ok(stores.text.includes('MSL') && stores.text.includes('2'));
  const flight = canvasRecorder();
  drawInstrument(flight.ctx, 'mfd', { speed: 400, altitude: 620 }, '#83eda0', 'FLT');
  assert.ok(flight.text.includes('FLT') && flight.text.includes('SPD'));
  assert.ok(!flight.text.includes('MSL'));
});

test('사격 통제 테이프는 실제 포탑 방위만 적는다', () => {
  const aimed = canvasRecorder();
  drawInstrument(aimed.ctx, 'fcs', { aim: { yaw: Math.PI / 2, pitch: 0.1 }, range: 820, hull: 0.6 }, '#ffb46b');
  assert.ok(aimed.text.includes('AZ DEG') && aimed.text.includes('90.0'));
  assert.ok(aimed.text.includes('090'), '가운데 눈금이 지금 방위를 가리킨다');
  const blind = canvasRecorder();
  drawInstrument(blind.ctx, 'fcs', {}, '#ffb46b');
  assert.ok(!blind.text.some((value) => /^\d{3}$/.test(value)), '방위를 모르면 테이프에 숫자가 없다');
});

test('폭탄창 화면은 실제로 남은 폭탄만 보여준다', () => {
  const { ctx, text } = canvasRecorder();
  drawInstrument(ctx, 'bay', { bombAmmo: 5, bayOpen: false, range: 300 }, '#ffc98a');
  assert.ok(text.includes('BOMB') && text.includes('5'));
  assert.ok(text.includes('BAY') && text.includes('CLOSED'));
  assert.ok(!text.includes('GUN'));
  assert.ok(!text.includes('MSL'));
});

test('기존 car 와 ground 배치는 새 배치로 바뀌지 않는다', () => {
  const car = canvasRecorder();
  drawInstrument(car.ctx, 'car', { speed: 60, gear: 2, rpm: 3000 }, '#83eda0');
  assert.ok(car.text.includes('GEAR') && car.text.includes('KM/H'));
  const ground = canvasRecorder();
  drawInstrument(ground.ctx, 'ground', { speed: 20, hull: 1 }, '#83eda0');
  assert.ok(ground.text.includes('SPD'), 'ground 는 속도 칸을 그대로 둔다');
  const fcs = canvasRecorder();
  drawInstrument(fcs.ctx, 'fcs', { speed: 20, hull: 1 }, '#83eda0');
  assert.ok(!fcs.text.includes('SPD'), 'fcs 는 속도 대신 거리와 내구도를 쓴다');
});

test('눈금판 좌표가 바늘 각과 같은 식을 쓴다', () => {
  // 바늘은 mesh 라 방향이 (-sin A, cos A) 고 캔버스는 y 가 아래로 커진다.
  // 두 식이 같은 점을 가리켜야 숫자와 바늘이 어긋나지 않는다.
  for (const ratio of [0, 0.25, 0.5, 0.75, 1]) {
    const angle = dialAngle(ratio);
    const [x, y] = dialFacePoint(ratio, DIAL_FACE.number);
    assert.ok(Math.abs(x - (DIAL_FACE.centre - Math.sin(angle) * DIAL_FACE.number)) < 1e-9, `ratio ${ratio} x`);
    assert.ok(Math.abs(y - (DIAL_FACE.centre - Math.cos(angle) * DIAL_FACE.number)) < 1e-9, `ratio ${ratio} y`);
  }
  const [midX, midY] = dialFacePoint(0.5, 78);
  assert.ok(Math.abs(midX - DIAL_FACE.centre) < 1e-9, '가운데 값은 바로 위다');
  assert.ok(midY < DIAL_FACE.centre);
  const [lowX, lowY] = dialFacePoint(0, 78);
  const [topX, topY] = dialFacePoint(1, 78);
  assert.ok(lowX < DIAL_FACE.centre && lowY > DIAL_FACE.centre, '0 은 7시다');
  assert.ok(topX > DIAL_FACE.centre && topY > DIAL_FACE.centre, '최대값은 5시다');
  assert.ok(Math.abs((DIAL_FACE.centre - lowX) - (topX - DIAL_FACE.centre)) < 1e-9, '양 끝이 좌우 대칭이다');
  assert.ok(DIAL_SWEEP > Math.PI && DIAL_SWEEP < Math.PI * 1.5);
});

test('눈금판 숫자는 최대값까지 고르게 나뉘고 칸이 좁으면 글자가 줄어든다', () => {
  assert.deepEqual(dialFaceNumbers(7, 240), [0, 40, 80, 120, 160, 200, 240]);
  assert.deepEqual(dialFaceNumbers(9, 8), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(dialFaceNumbers([0, 2, 4], 9), [0, 2, 4]);
  // 세 자리 숫자 열셋은 한 자리 아홉보다 작은 글자를 쓴다. 둘 다 16px 아래로는 내려가지 않는다.
  const crowded = dialNumberSize(13, 3);
  const roomy = dialNumberSize(9, 1);
  assert.ok(crowded < roomy);
  assert.ok(crowded >= 16 && roomy <= 38);
});

test('칸이 아홉을 넘으면 숫자를 한 칸 걸러 적고 글자를 키운다', () => {
  // 홀수 칸만 건너뛴다. 짝수 칸을 건너뛰면 마지막 숫자(최대값) 가 빠진다.
  assert.equal(dialNumberStride(7), 1);
  assert.equal(dialNumberStride(9), 1);
  assert.equal(dialNumberStride(13), 2);
  assert.equal(dialNumberStride(12), 1);
  assert.ok(dialNumberSize(13, 3, DIAL_SWEEP, 2) > dialNumberSize(13, 3, DIAL_SWEEP, 1));
});
