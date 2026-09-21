import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldRebuildCasters, shouldRenderMirror, worldFrame } from '../../src/world/mirrorSchedule.js';
import { MIRROR_PASS } from '../../src/world/cockpits/mirrorLayout.js';

test('거울은 품질이 정한 주기마다 한 번 그린다', () => {
  for (const [quality, pass] of Object.entries(MIRROR_PASS)) {
    let drawn = 0;
    for (let i = 0; i < 600; i += 1) if (shouldRenderMirror(i, pass)) drawn += 1;
    assert.equal(drawn, 600 / pass.every, quality);
  }
});

test('caster 재구성은 어떤 품질의 거울 프레임과도 겹치지 않는다', () => {
  for (let i = 0; i < 2000; i += 1) {
    if (!shouldRebuildCasters(i)) continue;
    for (const [quality, pass] of Object.entries(MIRROR_PASS)) {
      assert.equal(shouldRenderMirror(i, pass), false, `${quality} 프레임 ${i} 가 겹친다`);
    }
  }
});

test('caster 재구성 자리는 너무 드물지 않다', () => {
  let free = 0;
  for (let i = 0; i < 600; i += 1) if (shouldRebuildCasters(i)) free += 1;
  assert.ok(free >= 120, `600 프레임에 ${free} 자리`);
});

test('음수 프레임 번호에도 판정이 깨지지 않는다', () => {
  assert.equal(shouldRenderMirror(-4, { every: 4 }), true);
  assert.equal(shouldRenderMirror(-3, { every: 4 }), false);
  assert.equal(typeof shouldRebuildCasters(-7), 'boolean');
});

test('프레임 번호는 시각이 바뀔 때만 오른다', () => {
  const first = worldFrame(11.5);
  assert.equal(worldFrame(11.5), first);
  assert.equal(worldFrame(11.5), first);
  assert.equal(worldFrame(11.52), first + 1);
});
