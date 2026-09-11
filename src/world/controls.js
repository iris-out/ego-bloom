export const safeDelta = (delta) => Number.isFinite(delta) ? Math.max(0, Math.min(delta, 0.05)) : 0;
export const damping = (delta, speed = 6) => 1 - Math.exp(-speed * safeDelta(delta));
export function altitudeInput(keys) {
  return Number(['KeyE', 'Space', 'ShiftLeft', 'ShiftRight'].some((key) => keys.has(key)))
    - Number(['KeyQ', 'ControlLeft', 'ControlRight'].some((key) => keys.has(key)));
}
export function boundedTarget(target, extent) {
  const limit = Number.isFinite(extent) && extent > 0 ? extent : 180;
  const x = Number.isFinite(target?.x) ? target.x : 0;
  const y = Number.isFinite(target?.y) ? target.y : 4;
  const z = Number.isFinite(target?.z) ? target.z : 0;
  return {
    x: Math.max(-limit, Math.min(limit, x)),
    y: Math.max(2, Math.min(140, y)),
    z: Math.max(-limit, Math.min(limit, z)),
  };
}

export function focusPose(focus, extent) {
  const target = boundedTarget({ x: focus.x, y: focus.y ?? 4, z: focus.z }, extent);
  if (target.x === 0 && target.z === 0 && !focus.height) return { target, position: { x: 150, y: 155, z: 185 } };
  const height = Number.isFinite(focus.height) ? Math.max(12, Math.min(220, focus.height)) : 40;
  const distance = Math.max(130, height * 2.5);
  return { target, position: { x: target.x + distance * 0.65, y: target.y + distance * 0.66, z: target.z + distance * 0.85 } };
}
