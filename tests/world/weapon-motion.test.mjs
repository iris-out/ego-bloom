import test from 'node:test';
import assert from 'node:assert/strict';
import { actionPose, reloadPose } from '../../src/world/weaponMotion.js';

test('each firearm has a bounded, weapon-specific cycling action', () => {
  const pistol = actionPose('pistol', 1), smg = actionPose('smg', 1), sniper = actionPose('sniper', 1), shotgun = actionPose('shotgun', 1);
  assert.ok(pistol.slide > 0 && smg.slide > 0, 'self-loading weapons cycle their slides');
  assert.equal(sniper.slide, 0, 'bolt action rifle does not pretend to have a slide');
  assert.ok(sniper.bolt > pistol.bolt, 'sniper cycles a visible bolt');
  assert.equal(shotgun.slide, 0, 'pump shotgun has no slide');
  assert.equal(shotgun.bolt, 0, 'pump shotgun has no bolt');
  assert.ok(shotgun.pump > 0, 'pump shotgun racks its fore-end instead');
  assert.ok(shotgun.pump > pistol.slide, 'pump throw is bigger than a slide cycle');
  for (const pose of [pistol, smg, sniper, shotgun]) {
    assert.ok(pose.flash >= 0 && pose.flash <= 1, 'muzzle flash exposure is normalized');
    assert.ok(pose.kick >= 0 && pose.kick <= 1, 'kick is normalized');
  }
});

test('reload choreography reaches the magazine change at mid-cycle and returns home', () => {
  for (const weapon of ['pistol', 'smg', 'sniper', 'shotgun']) {
    const start = reloadPose(weapon, 0), middle = reloadPose(weapon, 0.5), finish = reloadPose(weapon, 1);
    assert.equal(start.dip, 0, `${weapon} starts at rest`);
    assert.equal(finish.dip, 0, `${weapon} finishes at rest`);
    assert.ok(middle.dip > 0.9, `${weapon} lowers at the magazine change`);
    assert.ok(middle.magazine > 0.4, `${weapon} visibly moves its magazine or bolt`);
  }
  assert.ok(reloadPose('sniper', 0.5).bolt > reloadPose('pistol', 0.5).bolt,
    'sniper reload includes a distinct bolt stroke');
});
