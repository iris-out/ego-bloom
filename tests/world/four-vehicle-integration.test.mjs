import test from 'node:test';
import assert from 'node:assert/strict';
import { VEHICLE_KEYS, validVehicle, loadIdentity, saveIdentity } from '../../src/world/identity.js';
import { FOUR_VEHICLE_LAYOUT } from '../../src/world/models/fourVehicleLayout.js';
import { EYE_POINTS, cockpitFov } from '../../src/world/eyePoints.js';
import { VEHICLES, carStatus, createCarState, stepCar, vehicleBox } from '../../src/world/carPhysics.js';
import { HULL_HEIGHT } from '../../src/world/groundWeapons.js';
import { engineSpec, engineTargets } from '../../src/world/engineSound.js';
import { hasMirrors, mirrorCameraPosition } from '../../src/world/cockpits/mirrorLayout.js';
import { COCKPIT_PARTS, QUALITY_PARTS, cockpitTriangles } from '../../src/world/cockpits/triangles.js';
import { drawInstrument } from '../../src/world/cockpits/instruments.js';
import { validPose } from '../../src/world/multiplayer.js';
import { loadModelFixture, modelTriangles } from './model-mount-fixture.mjs';

const expectations = {
  convertible: [7.32,70,.95,1.6], coupe: [6.93,68,1,1.4],
  supercar: [13.53,80,1.04,1.65], electric: [9.15,72,1.02,1.45],
};

test('all four vehicles resolve through identity, physical dimensions, eye, hull, mirror and cockpit tables', () => {
  for (const [key, [accel, top, grip, steerRate]] of Object.entries(expectations)) {
    const layout = FOUR_VEHICLE_LAYOUT[key];
    const spec = VEHICLES[key];
    assert.ok(VEHICLE_KEYS.includes(key));
    assert.equal(validVehicle(key), key);
    assert.equal(spec.width, layout.width);
    assert.equal(spec.depth, layout.depth);
    assert.deepEqual([spec.accel,spec.top,spec.grip,spec.steerRate], [accel,top,grip,steerRate]);
    assert.deepEqual(EYE_POINTS[key], layout.eye);
    assert.equal(cockpitFov(key), layout.fov);
    assert.ok(Math.abs(HULL_HEIGHT[key] - layout.height) < .02);
    assert.ok(hasMirrors(key));
    assert.ok(mirrorCameraPosition(key,'left')[0] < -layout.width * .3);
    assert.ok(COCKPIT_PARTS[key] && QUALITY_PARTS[key]);
    assert.ok(engineSpec(key));
    const box = vehicleBox({x:0,z:0,heading:0},key);
    assert.equal(box.width,layout.width);
    assert.equal(box.depth,layout.depth);
  }
});

test('electric car reports single speed D/R and measured drive/regen with zero rpm', () => {
  const spec = VEHICLES.electric;
  assert.equal(spec.powertrain, 'electric');
  assert.deepEqual(spec.gears, [1]);
  assert.deepEqual([createCarState(180, 'electric').gear, createCarState(180, 'electric').rpm], ['D', 0]);
  let state = createCarState();
  state = stepCar(state, {throttle:1}, .05, 180, [], 'electric');
  assert.equal(state.gear,'D');
  assert.equal(state.rpm,0);
  assert.ok(state.power > 0 && state.power <= 1);
  const drive = carStatus(state,'electric');
  assert.equal(drive.redline,false);
  assert.equal(drive.powertrain,'electric');
  assert.equal(drive.power,state.power);
  state = stepCar(state, {brake:true}, .05, 180, [], 'electric');
  assert.ok(state.power < 0);
  state = stepCar({...state,speed:0}, {reverse:1}, .05, 180, [], 'electric');
  assert.equal(state.gear,'R');
  assert.equal(state.rpm,0);
  assert.ok(state.power > 0, 'reverse acceleration draws drive power');
  assert.equal(engineSpec('electric').kind,'electric');
  assert.equal(engineTargets('electric',{speed:0,power:0}).gain,0);
  assert.ok(engineTargets('electric',{speed:20,power:.5}).gain > 0);
  const coasting = stepCar({...createCarState(180, 'electric'),speed:20}, {}, .05, 180, [], 'electric');
  const modeledDrag = (20 * 20 * .0022 + 20 * .12 + .8) / spec.brake;
  assert.ok(Math.abs(coasting.power + modeledDrag) < .01, 'coasting regen follows modeled slowing force');
  const stopped = stepCar({...state,phase:'crashed',power:.8,crashElapsed:0}, {}, .05, 180, [], 'electric');
  assert.equal(stopped.power,0, 'crashed EV cannot retain traction telemetry');
});

test('electric wall stops and water entry clear raw propulsion state', () => {
  const home = createCarState(300, 'electric');
  const wall = { x: home.x, z: home.z - .1, width: 50, depth: 1, height: 30 };
  const blocked = stepCar({ ...home, speed: 10 }, {}, .05, 300, [wall], 'electric');
  assert.equal(blocked.message, '막혔다');
  assert.equal(blocked.speed, 0);
  assert.deepEqual([blocked.gear, blocked.rpm, blocked.power], ['D', 0, 0]);
  const rearWall = { ...wall, z: home.z + .1 };
  const reverseBlocked = stepCar({ ...home, speed: -10, gear: 'R' }, { reverse: 1 }, .05, 300, [rearWall], 'electric');
  assert.equal(reverseBlocked.message, '막혔다');
  assert.deepEqual([reverseBlocked.gear, reverseBlocked.rpm, reverseBlocked.power], ['R', 0, 0]);
  const water = stepCar({ ...home, z: -330, speed: 60 }, { throttle: 1 }, .05, 300, [], 'electric');
  assert.equal(water.phase, 'sinking');
  assert.deepEqual([water.gear, water.rpm, water.power], ['D', 0, 0]);
  for (const state of [blocked, reverseBlocked, water]) {
    assert.ok(Number.isFinite(state.rpm));
    assert.ok(Number.isFinite(state.power));
  }
});

test('combustion road cars retain idle and automatic gears', () => {
  const state = stepCar(createCarState(), {}, .05, 180, [], 'sedan');
  assert.equal(state.gear,1);
  assert.ok(state.rpm >= 800);
  assert.equal(engineSpec('sedan').kind,'piston');
});

test('new choices persist and survive remote ride normalization', () => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key,value) } });
  try {
    for (const key of Object.keys(expectations)) {
      saveIdentity({ name: 'Driver', plane: 'fighter', vehicle: key });
      assert.equal(loadIdentity().vehicle, key);
      const pose = validPose({ kind: 'car', key, phase: 'drive', x: 1, y: 1, z: 2, heading: 0, pitch: 0, roll: 0, speed: 10 });
      assert.equal(pose?.key, key);
    }
  } finally {
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else delete globalThis.localStorage;
  }
});

test('electric instrument shows D/R and measured power without combustion or invented battery data', () => {
  const text = [];
  const ctx = new Proxy({}, { get: (_, key) => key === 'fillText' ? value => text.push(String(value)) : () => {}, set: () => true });
  drawInstrument(ctx, 'electricCluster', { speed: 86, gear: 'D', power: -.38, rpm: 0 }, '#b7efff');
  assert.ok(text.includes('86'));
  assert.ok(text.includes('D'));
  assert.ok(text.includes('REGEN'));
  assert.ok(text.includes('38'));
  assert.ok(!text.some(value => /RPM|BATT|CHARGE/i.test(value)));
});

test('cockpit triangle entries track mounted geometry plus live screens and mirror reserve', async () => {
  for (const [key, name, screens] of [
    ['convertible','Convertible',2], ['coupe','Coupe',2],
    ['supercar','Supercar',2], ['electric','Electric',3],
  ]) {
    const { default: Cabin } = await loadModelFixture(new URL(`../../src/world/cockpits/${name}Cabin.jsx`, import.meta.url).pathname);
    for (const quality of ['low','medium','high']) {
      const mounted = modelTriangles(Cabin({ quality, exterior: false }));
      // SSR omits live canvas screen planes (2 triangles each); the named mirror
      // reservation is 42 while currently mounted mirrors are 12 triangles.
      assert.equal(cockpitTriangles(key, undefined, quality), mounted + screens * 2 + 30, `${key} ${quality}`);
    }
  }
});
