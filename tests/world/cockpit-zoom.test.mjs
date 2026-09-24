import test from 'node:test';
import assert from 'node:assert/strict';
import { wheelFovOffset, cockpitZoomFov, approachFov } from '../../src/world/cockpitZoom.js';

test('wheel zoom normalizes mouse/trackpad units and stays within a modest cockpit range', () => {
  assert.equal(wheelFovOffset(0, -100), -2);
  assert.equal(wheelFovOffset(0, 100), 2);
  assert.equal(wheelFovOffset(0, -100 / 16, 1), -2);
  assert.equal(wheelFovOffset(0, -100 / 800, 2), -2);
  let offset=0;
  for(let i=0;i<100;i++)offset=wheelFovOffset(offset,-100);
  assert.equal(cockpitZoomFov(72,offset),60);
  for(let i=0;i<100;i++)offset=wheelFovOffset(offset,100);
  assert.equal(cockpitZoomFov(72,offset),80);
  assert.equal(wheelFovOffset(2,NaN),2);
});
test('zoom approaches its target smoothly and consistently at different frame rates',()=>{
  const run=fps=>{let fov=72;for(let i=0;i<fps/2;i++)fov=approachFov(fov,60,1/fps);return fov;};
  assert.ok(approachFov(72,60,1/60)>60 && approachFov(72,60,1/60)<72);
  assert.ok(Math.abs(run(30)-run(120))<.01);
  assert.ok(Math.abs(run(60)-60)<.1);
});
