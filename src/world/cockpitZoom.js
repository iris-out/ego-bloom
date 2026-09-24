const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/** Wheel-up narrows the cockpit FOV. Normalize DOM pixel, line and page units. */
export function wheelFovOffset(offset, deltaY, deltaMode = 0) {
  const current = Number.isFinite(offset) ? offset : 0;
  if (!Number.isFinite(deltaY)) return current;
  const pixels = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? 800 : 1);
  return clamp(current + clamp(pixels / 50, -4, 4), -12, 8);
}

export function cockpitZoomFov(base, offset) {
  return clamp(base + clamp(Number.isFinite(offset) ? offset : 0, -12, 8), 24, 96);
}

/** Time-based response keeps wheel zoom smooth without moving the driver's eye. */
export function approachFov(current, target, delta) {
  const dt = Number.isFinite(delta) ? clamp(delta, 0, .05) : 0;
  const next = current + (target - current) * (1 - Math.exp(-12 * dt));
  return Math.abs(next - target) < .001 ? target : next;
}
