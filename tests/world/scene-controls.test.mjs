import test from 'node:test';
import assert from 'node:assert/strict';
import { buildArchitecture, buildLodArchitecture } from '../../src/world/cityModels.js';
import { countTriangles } from '../../src/world/shapes.js';
import { damping, boundedTarget, CAMERA_REACH, safeDelta, altitudeInput, focusPose } from '../../src/world/controls.js';

test('camera interpolation is independent of frame frequency', () => {
  let thirty = 0, sixty = 0;
  for (let i = 0; i < 30; i++) thirty += (100 - thirty) * damping(1 / 30);
  for (let i = 0; i < 60; i++) sixty += (100 - sixty) * damping(1 / 60);
  assert.ok(Math.abs(thirty - sixty) < 1e-9);
  assert.ok(thirty > 99 && thirty < 100);
});

test('resuming a background tab caps travel and invalid frame time cannot move camera', () => {
  assert.equal(safeDelta(60), 0.05);
  assert.equal(safeDelta(-1), 0);
  assert.equal(safeDelta(NaN), 0);
});

test('camera cannot leave actual city bounds or go underground', () => {
  // 경계는 extent 에 CAMERA_REACH 를 더한 값이다. 공항이 도시 밖에 있어 그만큼 따라간다.
  assert.deepEqual(boundedTarget({ x: 999, y: -5, z: -999 }, 150), { x: 150 + CAMERA_REACH, y: 2, z: -(150 + CAMERA_REACH) });
  assert.deepEqual(boundedTarget({ x: 25, y: 900, z: 40 }, 150), { x: 25, y: 140, z: 40 });
});

test('invalid focus coordinates and extent always resolve to a finite home target', () => {
  assert.deepEqual(boundedTarget({ x: NaN, y: Infinity, z: undefined }, 150), { x: 0, y: 4, z: 0 });
  assert.deepEqual(boundedTarget({ x: 999, y: 5, z: -999 }, NaN), { x: 180 + CAMERA_REACH, y: 5, z: -(180 + CAMERA_REACH) });
  assert.deepEqual(boundedTarget(null, 150), { x: 0, y: 4, z: 0 });
});

test('focus frames a tall landmark farther away and honors its elevated focus point', () => {
  const low = focusPose({ x: 32, z: 32, height: 20, y: 7 }, 500);
  const tall = focusPose({ x: 32, z: 32, height: 182, y: 63.7 }, 500);
  assert.equal(tall.target.y, 63.7);
  assert.ok(tall.position.z - tall.target.z > (low.position.z - low.target.z) * 2);
  assert.deepEqual(focusPose({ x: 0, z: 0 }, 500).position, { x: 220, y: 260, z: 300 });
});

test('altitude aliases agree without doubling speed and opposing keys cancel', () => {
  for (const code of ['KeyE', 'Space', 'ShiftLeft', 'ShiftRight']) assert.equal(altitudeInput(new Set([code])), 1);
  for (const code of ['KeyQ', 'ControlLeft', 'ControlRight']) assert.equal(altitudeInput(new Set([code])), -1);
  assert.equal(altitudeInput(new Set(['Space', 'ShiftLeft', 'KeyE'])), 1);
  assert.equal(altitudeInput(new Set(['Space', 'ControlLeft'])), 0);
});

test('low quality limits geometry cost for one thousand windowed buildings',()=>{
  const rows=Array.from({length:1000},(_,i)=>({id:String(i),x:i%40*32,z:Math.floor(i/40)*32,height:80,tier_name:'Silver'}));
  const triangles=countTriangles(buildArchitecture(rows,'low'));
  // shapes.js 의 실제 삼각형 수로 센다. 예전 계산은 tree 80, cylinder 40 을 12 로 세어 절반 넘게 빠졌다.
  // 현재 값은 약 525k 이고 5% 여유만 둔다. 세그먼트를 올리면 이 줄이 먼저 깨진다.
  assert.ok(triangles<560000,`triangle budget exceeded: ${triangles}`);
});

test('far detail costs a fraction of the near model while keeping its shapes',()=>{
  const rows=Array.from({length:1000},(_,i)=>({id:String(i),x:i%40*32,z:Math.floor(i/40)*32,height:80,tier_name:'Silver'}));
  const near=buildLodArchitecture(rows,'medium','near'),far=buildLodArchitecture(rows,'medium','far');
  const shapes=(b)=>new Set(Object.values(b).map((batch)=>batch.shape));
  // 실루엣을 만드는 shape 이 살아 있어야 한다. 상자만 남으면 먼 도시가 블록 더미로 보인다.
  // pane 창문과 가로수는 먼 거리에서 사라지는 것이 맞다.
  const dropped=new Set(['pane','tree','trunk']);
  for(const shape of shapes(near))if(!dropped.has(shape))assert.ok(shapes(far).has(shape),`far lost ${shape}`);
  assert.ok(countTriangles(far)<countTriangles(near)*0.6,'far must cut most of the invisible geometry');
  assert.ok(countTriangles(far)>countTriangles(near)/12,'far must not collapse into a box outline');
});
