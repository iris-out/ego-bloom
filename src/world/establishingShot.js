import { MAX_EXTENT, MIN_EXTENT } from '../../shared/urbanPlan.js';
import { getWorldBounds } from '../../shared/worldLayout.js';

/** 도시 크기가 인원수에 따라 620에서 4600 사이로 바뀐다. 절대 좌표를 쓰면
 * 42명 도시와 1000명 도시에서 그림이 달라지므로 extent 에 비례한 포즈를 쓴다. */
export const ESTABLISHING_FOV = 42;
const RATIO = Object.freeze({ x: 0.58, y: 0.30, z: 0.86, look: 0.05 });

function safeExtent(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return MIN_EXTENT;
  return Math.max(MIN_EXTENT, Math.min(MAX_EXTENT, number));
}

export function establishingPose(extent) {
  const e = safeExtent(extent);
  return {
    position: [e * RATIO.x, e * RATIO.y, e * RATIO.z],
    lookAt: [0, e * RATIO.look, 0],
    fov: ESTABLISHING_FOV,
  };
}

export function establishingPoseFor(buildings) {
  const bounds = getWorldBounds(buildings);
  // getWorldBounds 가 extent 를 직접 주지 않으면 가장 먼 건물까지의 거리를 쓴다.
  const extent = Math.max(Math.abs(bounds?.maxX || 0), Math.abs(bounds?.minX || 0),
    Math.abs(bounds?.maxZ || 0), Math.abs(bounds?.minZ || 0));
  return establishingPose(extent);
}
