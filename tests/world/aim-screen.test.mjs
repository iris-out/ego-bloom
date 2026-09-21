import test from 'node:test';
import assert from 'node:assert/strict';
import { Matrix4, PerspectiveCamera } from 'three';
import { AIM_MARGIN, projectAim } from '../../src/world/aimScreen.js';
import { aimNow, clearAimScreen, getAimScreen, setAimScreen } from '../../src/world/aimScreenStore.js';

const VIEW = { width: 800, height: 600, left: 0, top: 0 };

/** 행렬 두 개짜리 가짜 카메라다. projectAim 이 이것 말고는 아무것도 읽지 않는다는 뜻이기도 하다.
 * 회전이 없으므로 -Z 를 본다. */
function fakeCamera(eye = [0, 0, 0]) {
  const lens = new PerspectiveCamera(62, VIEW.width / VIEW.height, 0.1, 4000);
  lens.updateProjectionMatrix();
  return {
    matrixWorldInverse: new Matrix4().makeTranslation(-eye[0], -eye[1], -eye[2]),
    projectionMatrix: lens.projectionMatrix,
  };
}

test('정면을 겨누면 조준선이 화면 중앙에 온다', () => {
  const aim = projectAim(fakeCamera(), { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, 300, VIEW);
  assert.ok(Math.abs(aim.x - 400) < 0.5, `x=${aim.x}`);
  assert.ok(Math.abs(aim.y - 300) < 0.5, `y=${aim.y}`);
  assert.equal(aim.behind, false);
  assert.equal(aim.clamped, false);
});

test('포구가 오른쪽 위를 보면 조준선도 오른쪽 위로 간다', () => {
  const origin = { x: 0, y: 0, z: 0 };
  const right = projectAim(fakeCamera(), origin, { x: 0.2, y: 0, z: -1 }, 300, VIEW);
  const up = projectAim(fakeCamera(), origin, { x: 0, y: 0.2, z: -1 }, 300, VIEW);
  assert.ok(right.x > 400, `오른쪽으로 가지 않았다: ${right.x}`);
  assert.ok(Math.abs(right.y - 300) < 0.5, `위아래가 흔들렸다: ${right.y}`);
  // 화면 y 는 아래로 증가한다. 기수를 들면 값이 작아져야 한다.
  assert.ok(up.y < 300, `위로 가지 않았다: ${up.y}`);
});

test('시차 보정은 거리에 따라 달라진다', () => {
  // 카메라가 포구 오른쪽에 있으면 가까운 목표일수록 조준선이 화면 왼쪽으로 치우친다.
  const camera = fakeCamera([2, 0, 0]);
  const origin = { x: 0, y: 0, z: 0 }, forward = { x: 0, y: 0, z: -1 };
  const near = projectAim(camera, origin, forward, 50, VIEW);
  const far = projectAim(camera, origin, forward, 800, VIEW);
  assert.ok(near.x < far.x, `${near.x} < ${far.x}`);
  assert.ok(far.x < 400, '먼 목표도 카메라 중심보다는 왼쪽이다');
});

test('카메라 뒤를 겨누면 behind 다', () => {
  const back = projectAim(fakeCamera(), { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, 300, VIEW);
  assert.equal(back.behind, true);
  const front = projectAim(fakeCamera(), { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, 300, VIEW);
  assert.equal(front.behind, false);
});

test('화면 밖 조준점은 여백 안으로 붙잡힌다', () => {
  const aim = projectAim(fakeCamera(), { x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: -1 }, 300, VIEW);
  assert.equal(aim.clamped, true);
  assert.equal(aim.x, VIEW.width - AIM_MARGIN);
  assert.ok(aim.x < VIEW.width && aim.x > 0);
});

test('캔버스가 화면 위쪽에서 떨어져 있으면 그만큼 내려 그린다', () => {
  const stage = { width: 800, height: 600, left: 0, top: 78 };
  const aim = projectAim(fakeCamera(), { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, 300, stage);
  assert.ok(Math.abs(aim.y - 378) < 0.5, `y=${aim.y}`);
});

test('카메라가 없으면 화면 중앙을 준다', () => {
  const aim = projectAim(null, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, 300, VIEW);
  assert.deepEqual(aim, { x: 400, y: 300, behind: false, clamped: false });
});

test('store 는 쓴 값을 그대로 돌려주고 비우면 묵은 값이 된다', () => {
  const written = setAimScreen({ x: 120, y: 240, behind: false, clamped: true });
  assert.equal(written, getAimScreen(), '같은 객체를 덮어쓴다');
  assert.equal(getAimScreen().x, 120);
  assert.equal(getAimScreen().y, 240);
  assert.equal(getAimScreen().clamped, true);
  assert.ok(getAimScreen().at > 0 && getAimScreen().at <= aimNow());
  clearAimScreen();
  assert.equal(getAimScreen().at, 0);
  assert.equal(getAimScreen().behind, true);
});
