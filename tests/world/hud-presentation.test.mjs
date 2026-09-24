import test from 'node:test';
import assert from 'node:assert/strict';
import { hudPresentation } from '../../src/world/ui/hudPresentation.js';
import { DEFAULT_HUD_PREFERENCES, normalizeHudPreferences, readHudPreferences, writeHudPreferences } from '../../src/world/ui/hudPreferences.js';

test('ordinary car shows its bump durability without combat ammo or range', () => {
  const display = hudPresentation('car', 'sedan', 'third', { speed: 80, hull: 0.2, range: 90 });
  assert.equal(display.showCarGauges, true);
  assert.equal(display.showHull, true);
  assert.equal(display.showRange, false);
  assert.equal(display.showCannon, false);
});

test('armed vehicle shows real hull and range only when reported', () => {
  const withStatus = hudPresentation('car', 'tank', 'third', { hull: 0.4, range: 350 });
  assert.equal(withStatus.showHull, true);
  assert.equal(withStatus.showRange, true);
  assert.equal(hudPresentation('car', 'tank', 'third', {}).showHull, false);
});

test('flight instruments yield to cockpit while weapons remain model specific', () => {
  const fighter = hudPresentation('flight', 'fighter', 'third', { hull: 0.8 });
  assert.equal(fighter.showFlightReadouts, true);
  assert.equal(fighter.showCannon, true);
  assert.equal(fighter.showMissiles, true);
  assert.equal(fighter.showHull, true);
  const cockpit = hudPresentation('flight', 'jet', 'first', { hull: 0.8 });
  assert.equal(cockpit.showFlightReadouts, false);
  assert.equal(cockpit.showHull, false);
  assert.equal(cockpit.showCannon, false);
});

test('HUD preferences clamp invalid storage and persist normalized settings', () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.deepEqual(readHudPreferences(storage), DEFAULT_HUD_PREFERENCES);
  assert.deepEqual(writeHudPreferences({ hudScale: 9, highContrast: true, reducedMotion: 'yes' }, storage), {
    hudScale: 1.4, highContrast: true, reducedMotion: false,
  });
  assert.equal(readHudPreferences(storage).hudScale, 1.4);
  assert.equal(normalizeHudPreferences({ hudScale: 'oops' }).hudScale, 1);
  values.set('ego-world-hud-preferences-v1', '{bad');
  assert.deepEqual(readHudPreferences(storage), DEFAULT_HUD_PREFERENCES);
});
