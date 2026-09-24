/** The renderer and walking physics consume the same world-space triangles. */
const cache = new WeakMap();
const CELL = 32;
const cellKey = (x, z) => `${x},${z}`;

function triangleAt(triangle, x, z) {
  const [a, b, c] = triangle;
  const denominator = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
  if (Math.abs(denominator) < 1e-9) return null;
  const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / denominator;
  const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / denominator;
  if (u < -1e-7 || v < -1e-7 || u + v > 1 + 1e-7) return null;
  return u * a[1] + v * b[1] + (1 - u - v) * c[1];
}

function indexOf(riverfront) {
  let index = cache.get(riverfront);
  if (index) return index;
  index = new Map();
  for (const surface of riverfront.surfaces || []) for (const triangle of surface.triangles) {
    const entry = {
      id: surface.id, triangle,
      minX: Math.min(...triangle.map(point => point[0])), maxX: Math.max(...triangle.map(point => point[0])),
      minZ: Math.min(...triangle.map(point => point[2])), maxZ: Math.max(...triangle.map(point => point[2])),
    };
    // Include the boundary tolerance so a point on a cell edge sees the same triangles.
    for (let cx = Math.floor((entry.minX - 1e-7) / CELL); cx <= Math.floor((entry.maxX + 1e-7) / CELL); cx++) {
      for (let cz = Math.floor((entry.minZ - 1e-7) / CELL); cz <= Math.floor((entry.maxZ + 1e-7) / CELL); cz++) {
        const key = cellKey(cx, cz);
        if (!index.has(key)) index.set(key, []);
        index.get(key).push(entry);
      }
    }
  }
  cache.set(riverfront, index);
  return index;
}

/** A floor may be landed on from above, but cannot pull a walker up from below. */
export function pedestrianSurface(riverfront, x, z, previousFeetY = 0) {
  if (!riverfront || !Number.isFinite(x) || !Number.isFinite(z)) return null;
  let result = null;
  for (const entry of indexOf(riverfront).get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL))) || []) {
    if (x < entry.minX - 1e-7 || x > entry.maxX + 1e-7 || z < entry.minZ - 1e-7 || z > entry.maxZ + 1e-7) continue;
    const top = triangleAt(entry.triangle, x, z);
    // This query only reports a floor already at or below the caller's feet.
    // A legal ground step is granted explicitly by walkPhysics at its origin.
    if (top === null || !Number.isFinite(top) || top > previousFeetY + 1e-6) continue;
    if (!result || top > result.top) result = { top, id: entry.id };
  }
  return result;
}
