/** 제작자 라벨을 띄울 건물을 고르는 순수 판정이다. three 와 React 에 기대지 않아 단위 테스트가
 * 좌표 변환과 가림 판정을 직접 넣는다. 그리는 쪽은 NearbyCreators.jsx 다. */

/** 화면 정규 좌표가 이 상자를 벗어나면 후보에서 뺀다. 가장자리 라벨은 어차피 잘린다. */
export const LABEL_EDGE = 0.9;
/** 가림 판정을 해 볼 후보 수다. 판정 하나가 충돌 격자를 훑으므로 상한을 둔다. */
const PROBE = 14;

/**
 * @param buildings 제작자 건물 목록
 * @param anchorOf 건물 하나의 라벨 자리를 {x, y, z} 로 돌려준다
 * @param distanceOf 건물까지의 거리
 * @param reachOf 건물마다의 최대 거리
 * @param project 라벨 자리를 화면 정규 좌표 {x, y, z} 로 바꾼다
 * @param isOccluded 라벨 자리가 다른 건물에 가리는지 본다
 * @param limit 띄울 개수
 * @param selectedId 고른 제작자는 거리와 상관없이 먼저 본다
 * @param edgeXOf 가까운 주행 건물처럼 화면 옆에 걸친 후보의 가로 허용 범위
 */
export function pickLabelIds({ buildings, anchorOf, distanceOf, reachOf, project, isOccluded, limit, selectedId = null, edgeXOf = () => LABEL_EDGE }) {
  const candidates = [];
  for (const building of buildings) {
    const distance = distanceOf(building);
    if (!(distance <= reachOf(building))) continue;
    const screen = project(anchorOf(building), building);
    if (Math.abs(screen.x) > edgeXOf(building, distance) || Math.abs(screen.y) > LABEL_EDGE || Math.abs(screen.z) > 1) continue;
    candidates.push({ building, distance });
  }
  candidates.sort((a, b) => Number(b.building.id === selectedId) - Number(a.building.id === selectedId) || a.distance - b.distance);
  const ids = [];
  for (let i = 0; i < candidates.length && i < PROBE; i += 1) {
    const building = candidates[i].building;
    if (isOccluded(anchorOf(building), building)) continue;
    ids.push(building.id);
    if (ids.length === limit) break;
  }
  return ids;
}
