/** 실내 조각 수를 품질 등급으로 나누는 헬퍼다. Three 와 React 에 의존하지 않는다.
 * 실내 파일은 이 두 불리언만 보고 조각을 더한다. 등급 문자열을 직접 비교하지 않는다. */

/** 낮은 등급부터 높은 등급 순이다. 등급을 더하면 여기와 triangles.js 의 BUDGET 을 함께 고친다. */
export const QUALITY_ORDER = Object.freeze(['low', 'medium', 'high']);

/** mid 는 유리, 좌석, 손, 후드, 노브, 접촉 그림자까지다. high 는 소품과 활 프레임까지다.
 * 알 수 없는 값은 medium 으로 본다. low 만 명시적으로 걷어낸다. */
export function detailLevel(quality) {
  return { mid: quality !== 'low', high: quality === 'high' };
}
