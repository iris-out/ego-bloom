/** 거울처럼 아주 작은 render target 에 그리는 패스는 도시 상세 단계를 통째로 내린다.
 * 448x168 에서는 실루엣과 상세 단계의 차이가 보이지 않는데 draw 제출과 정점 비용은 그대로다.
 * 등록하는 쪽은 WorldScene 의 CityTiles 하나이며 패스가 끝나면 반드시 null 로 풀어야 한다. */
let apply = null;

export function registerCityLod(fn) {
  apply = fn;
  return () => { if (apply === fn) apply = null; };
}

/** level 이 null 이면 각 셀이 카메라 거리로 정한 단계로 돌아간다. */
export function forceCityLod(level) {
  apply?.(level);
}
