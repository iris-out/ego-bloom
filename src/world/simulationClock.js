/** Intercept the canvas clock at its source so every simulation receives the same
 * frozen elapsed time and zero delta. Reading the real clock during pause avoids
 * a large first delta on resume. Restoring it never resets the scene clock. */
export function installSimulationClock(clock, isPaused) {
  const original = clock.getDelta;
  function getDelta() {
    const before = clock.elapsedTime;
    const delta = original.call(clock);
    if (!isPaused()) return delta;
    clock.elapsedTime = before;
    return 0;
  }
  clock.getDelta = getDelta;
  return () => { if (clock.getDelta === getDelta) clock.getDelta = original; };
}

/** Neutralize held input without losing reset/reload counters. */
export function releaseWorldControls(controls) {
  if (!controls) return;
  for (const key of ['throttle','reverse','steer','pitch','roll','yaw','cameraYaw','cameraPitch','lookYaw','lookPitch','moveX','moveY','moveZ','forward','strafe','lean']) controls[key] = 0;
  for (const key of ['brake','handbrake','fire','aim','fireCannon','fireMissile','fireBomb','boost','autopilot','jump','sprint','run','reload']) controls[key] = false;
  controls.weapon = null;
}
