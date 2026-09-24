import test from 'node:test';
import assert from 'node:assert/strict';
import { FOUR_VEHICLE_LAYOUT } from '../../src/world/models/fourVehicleLayout.js';

const keys = ['convertible', 'coupe', 'supercar', 'electric'];

test('four road layouts keep wheels grounded and seats within their passenger cells', () => {
  assert.deepEqual(Object.keys(FOUR_VEHICLE_LAYOUT), keys);
  for (const key of keys) {
    const { width, depth, height, eye, wheels, cabin, windshield } = FOUR_VEHICLE_LAYOUT[key];
    assert.ok(Math.abs(wheels.y - wheels.radius + .9) < 1e-9, `${key} wheel contact`);
    assert.ok(wheels.track + .12 <= width / 2 + .12, `${key} track within body`);
    assert.ok(Math.abs(wheels.frontZ) < depth / 2 && wheels.rearZ < depth / 2);
    assert.ok(eye[0] > -cabin.innerWidth / 2 && eye[0] < cabin.innerWidth / 2);
    assert.ok(eye[1] > cabin.floorY && eye[1] < -.9 + height);
    assert.ok(eye[2] > cabin.frontZ && eye[2] < cabin.rearZ);
    assert.ok(cabin.frontSeats.every(([x,y,z]) => Math.abs(x) < cabin.innerWidth / 2 && y > cabin.floorY && z > cabin.frontZ));
    assert.ok(cabin.rearSeats.every(([x,y,z]) => Math.abs(x) < cabin.innerWidth / 2 && y > cabin.floorY && z < cabin.rearZ));
    assert.equal(windshield.length, 4);
    assert.ok(windshield.flat().every(Number.isFinite));
  }
  assert.deepEqual(keys.map(k => FOUR_VEHICLE_LAYOUT[k].cabin.frontSeats.length + FOUR_VEHICLE_LAYOUT[k].cabin.rearSeats.length), [4,5,2,5]);
  assert.equal(FOUR_VEHICLE_LAYOUT.convertible.cabin.roofY, null);
  assert.ok(Object.isFrozen(FOUR_VEHICLE_LAYOUT));
});
