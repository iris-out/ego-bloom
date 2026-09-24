import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoot, _roots } from '@react-three/fiber';
import { discardUnconfiguredRoot } from '../../src/world/rendererFailure.js';

test('failed renderer drops its actual unconfigured R3F registry entry', async () => {
  const canvas = {}, before = _roots.size;
  const root = createRoot(canvas);
  void root.configure({ gl: () => {
    assert.equal(discardUnconfiguredRoot(canvas), true);
    return new Promise(() => {});
  } });
  assert.equal(_roots.has(canvas), false);
  root.unmount();
  await new Promise(resolve => setTimeout(resolve, 550));
  assert.equal(_roots.size, before);
});

test('active or initialized R3F roots are retained', () => {
  const canvas = {}; createRoot(canvas);
  const store = _roots.get(canvas).store;
  try {
    store.getState().internal.active = true;
    assert.equal(discardUnconfiguredRoot(canvas), false);
    store.getState().internal.active = false;
    store.getState().gl = {};
    assert.equal(discardUnconfiguredRoot(canvas), false);
    store.getState().gl = null; store.getState().scene = {};
    assert.equal(discardUnconfiguredRoot(canvas), false);
    store.getState().scene = null;
    assert.equal(discardUnconfiguredRoot(canvas), true);
  } finally { _roots.delete(canvas); }
});
