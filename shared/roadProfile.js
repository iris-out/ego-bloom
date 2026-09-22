/** Road policy shared by lane paint and AI tracks. Speeds here are km/h;
 * simulation consumers convert once to world metres/second. */
export const ROAD_PROFILE = Object.freeze(Object.fromEntries(Object.entries({
  highway: { lanes: 6, minKmh: 75, maxKmh: 90 },
  arterial: { lanes: 6, minKmh: 60, maxKmh: 90 },
  collector: { lanes: 2, minKmh: 35, maxKmh: 50 },
  lane: { lanes: 2, minKmh: 35, maxKmh: 50 },
  alley: { lanes: 1, minKmh: 20, maxKmh: 30 },
}).map(([kind, profile]) => [kind, Object.freeze(profile)])));

/** Offsets are measured outward from the canonical centreline. Big roads reserve
 * space for the existing 1.1-wide median and shoulders without widening lots. */
export function roadLaneLayout(kind, width) {
  const profile = ROAD_PROFILE[kind] || ROAD_PROFILE.lane;
  const lanesPerDirection = Math.max(1, profile.lanes / 2);
  const big = profile.lanes === 6;
  const centerInset = big ? .65 : 0;
  const edgeOffset = width / 2 - (big ? .7 : 0);
  const laneWidth = (edgeOffset - centerInset) / lanesPerDirection;
  return {
    lanesPerDirection, laneWidth, centerInset, edgeOffset,
    laneOffsets: Array.from({ length: lanesPerDirection }, (_, i) => centerInset + laneWidth * (i + .5)),
    dividerOffsets: Array.from({ length: lanesPerDirection - 1 }, (_, i) => centerInset + laneWidth * (i + 1)),
  };
}
