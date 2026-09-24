import test from 'node:test';
import assert from 'node:assert/strict';
import { displaySize, drawInstrument } from '../../src/world/cockpits/instruments.js';

function record(mode, status) {
  const state = { strokeStyle: '', fillStyle: '' };
  const text = [], arcs = [], strokes = [];
  let path = [];
  const ctx = new Proxy(state, {
    set(target, key, value) { target[key] = value; return true; },
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'fillText') return value => text.push(String(value));
      if (key === 'arc') return (...args) => {
        for (const n of args) assert.ok(Number.isFinite(n));
        arcs.push(args);
      };
      if (key === 'beginPath') return () => { path = []; };
      if (key === 'moveTo' || key === 'lineTo') return (...args) => {
        for (const n of args) assert.ok(Number.isFinite(n));
        path.push([key, ...args]);
      };
      if (key === 'stroke') return () => strokes.push({ color: target.strokeStyle, path: [...path] });
      return () => {};
    },
  });
  drawInstrument(ctx, mode, status);
  return { text, arcs, strokes };
}

test('three driver clusters have distinct layouts and match physical panel proportions', () => {
  assert.deepEqual(displaySize('coupeClassic'), { width: 512, height: 218 });
  assert.deepEqual(displaySize('teslaDriver'), { width: 512, height: 202 });
  assert.deepEqual(displaySize('ferrariTach'), { width: 512, height: 229 });
  const status = { speed: 98, gear: 3, rpm: 4200, power: -.38, heading: 271, top: 80 };
  const coupe = record('coupeClassic', status);
  const tesla = record('teslaDriver', status);
  const ferrari = record('ferrariTach', status);
  assert.ok(coupe.arcs.length >= 6, 'coupe has two circular silver-ring dials');
  assert.equal(tesla.arcs.length, 0, 'Tesla display uses a minimal digital layout');
  assert.ok(ferrari.arcs.length >= 3, 'Ferrari has a central analogue dial');
  assert.ok(coupe.text.includes('HDG') && coupe.text.includes('271'));
  assert.ok(tesla.text.includes('REGEN 38%') && tesla.text.includes('DRIVE'));
  assert.ok(!tesla.text.some(value => /RPM|AUTOPILOT|BATTERY|FUEL/.test(value)));
  assert.ok(ferrari.text.includes('RPM') && ferrari.text.includes('SPEED'));
  assert.ok(ferrari.text.includes('3'), 'gear appears inside the tachometer');
});

test('Ferrari red needle follows actual RPM from zero to the configured maximum', () => {
  const tip = rpm => record('ferrariTach', { rpm }).strokes.find(stroke => stroke.color === '#d21d23')?.path.at(-1);
  const idle = tip(0), high = tip(8500);
  assert.ok(idle && high, 'real RPM creates a red analogue needle');
  assert.notDeepEqual(idle, high);
  assert.ok(record('ferrariTach', { rpm: 8500, gear: 8 }).text.includes('10'));
  const endpoint = high.slice(1);
  const endAngle = Math.PI * .78 + .85 * Math.PI * 1.44;
  assert.ok(Math.abs(endpoint[0] - (256 + Math.cos(endAngle) * 79)) < 1e-8);
  assert.ok(Math.abs(endpoint[1] - (117 + Math.sin(endAngle) * 79)) < 1e-8);
  assert.deepEqual(tip(17000), high, 'needle clamps to the engine limit below the 10000 RPM dial maximum');
  assert.equal(tip(null), undefined, 'missing RPM does not invent a zero needle');
});

test('missing cluster telemetry remains unknown and Tesla power direction is real', () => {
  for (const mode of ['coupeClassic', 'teslaDriver', 'ferrariTach']) {
    const { text } = record(mode, {});
    assert.ok(text.includes('—'), `${mode} shows missing data`);
    assert.ok(!text.some(value => /NaN|undefined|Infinity/.test(value)));
  }
  assert.ok(record('teslaDriver', { power: .6, gear: 'D' }).text.includes('POWER 60%'));
  assert.ok(record('teslaDriver', { power: -.6, gear: 'R' }).text.includes('REGEN 60%'));
});
