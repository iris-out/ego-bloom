/** Screen/depth gate before the more expensive solid occlusion check. */
export function actorLabelVisible(projected, distance, maxDistance = 550) {
  return Number.isFinite(distance) && distance > 1 && distance <= maxDistance
    && Number.isFinite(projected.x) && Number.isFinite(projected.y) && Number.isFinite(projected.z)
    && Math.abs(projected.x) < 0.96 && Math.abs(projected.y) < 0.92 && projected.z > -1 && projected.z < 1;
}
