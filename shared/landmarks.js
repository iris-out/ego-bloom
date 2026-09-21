/** 공공 건물의 평면 크기다. src/world/models/civicBuildings.js 의 size 와 같은 값이어야
 * 하고 tests/world/urban-plan.test.mjs 가 둘이 어긋나지 않는지 본다. 배치는 순수 모듈만
 * 읽을 수 있어 렌더러 파일을 가져올 수 없으므로 표를 여기에 따로 둔다.
 *
 * 예전에는 배치가 모든 랜드마크를 한 변 148 로 보고 자리를 잡았다. 시청은 300x260 이라
 * 제 블록을 넘어 이웃 블록과 간선 위까지 덮었고, 위에서 보면 도로가 건물을 뚫고 지났다.
 */
export const LANDMARK_SIZE = Object.freeze({
  fire: [104, 88],
  hospital: [112, 96],
  school: [128, 100],
  cityhall: [300, 260],
  library: [100, 88],
  station: [140, 96],
  stadium: [140, 140],
  park: [68, 68],
  bank: [104, 84],
  police: [108, 88],
});

/** 그 랜드마크가 차지하는 반쪽 폭이다. 가장 긴 변의 절반이라 회전과 무관하게 안전하다. */
export function landmarkHalf(key) {
  const size = LANDMARK_SIZE[key];
  if (!size) return 74;
  return Math.max(size[0], size[1]) / 2;
}
