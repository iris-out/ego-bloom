const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

/**
 * Normalizes both endpoint bridges and the old axis/centre/length shape into the
 * oriented segment used by rendering, collision, water and map consumers.
 */
export function bridgeSegment(bridge = {}) {
  const hasEndpoints = [bridge.x1, bridge.z1, bridge.x2, bridge.z2].every(Number.isFinite);
  let x1, z1, x2, z2;
  if (hasEndpoints) {
    ({ x1, z1, x2, z2 } = bridge);
  } else {
    const x = finite(bridge.x), z = finite(bridge.z);
    const half = Math.max(0, finite(bridge.length, 80)) / 2;
    if (bridge.axis === 'x') {
      x1 = x - half; z1 = z; x2 = x + half; z2 = z;
    } else {
      x1 = x; z1 = z - half; x2 = x; z2 = z + half;
    }
  }
  const dx = x2 - x1, dz = z2 - z1;
  const length = Math.hypot(dx, dz);
  const ux = length ? dx / length : 0, uz = length ? dz / length : 1;
  return {
    ...bridge,
    x1, z1, x2, z2,
    cx: (x1 + x2) / 2, cz: (z1 + z2) / 2,
    length, width: Math.max(0, finite(bridge.width, 15)),
    rotation: Math.atan2(dx, dz),
    ux, uz, px: -uz, pz: ux,
  };
}

/** True when a point falls within the canonical deck rectangle. */
export function onBridge(bridge, x, z, margin = 0) {
  const segment = bridgeSegment(bridge);
  const rx = finite(x) - segment.cx, rz = finite(z) - segment.cz;
  const along = rx * segment.ux + rz * segment.uz;
  const across = rx * segment.px + rz * segment.pz;
  return Math.abs(along) <= Math.max(0, segment.length / 2 + finite(margin))
    && Math.abs(across) <= Math.max(0, segment.width / 2 + finite(margin));
}
