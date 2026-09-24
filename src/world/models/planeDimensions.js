/** 기체 외곽 치수다. 충돌 여유, Airport.jsx 주차 좌표, FLIGHT_GROUND 2.1 이 이
 * 값에 묶여 있다. 실루엣을 다듬어도 이 숫자는 바꾸지 않는다.
 * wheelBottom 은 접지면이다. 2.1 에서 이 값을 더하면 활주로 높이가 0 이 된다. */
export const PLANE_DIMENSIONS = Object.freeze({
  airship: { span: 13.6, length: 34, wheelBottom: -1.9 },
  jet: { span: 20, length: 12.2, wheelBottom: -1.9 },
  bomber: { span: 30, length: 22.8, wheelBottom: -1.9 },
  prop: { span: 11.6, length: 10, wheelBottom: -1.9 },
  // 전투기는 다른 기체 사이에서 너무 작아 보여 12퍼센트 키웠다. 모델도 같은 배율로 그린다.
  fighter: { span: 12.3, length: 16.8, wheelBottom: -1.9 },
  // 요격기는 Me 262 를 따라 전투기보다 작고 짧다.
  interceptor: { span: 9.6, length: 11.4, wheelBottom: -1.9 },
  helicopter: { span: 13.6, length: 12.8, wheelBottom: -1.9 },
});

export function dimensionsOf(plane) {
  return PLANE_DIMENSIONS[plane] || PLANE_DIMENSIONS.jet;
}

/** 동체 프로파일이다. [반지름, z] 쌍을 코에서 꼬리로 늘어놓은 것이고 LatheGeometry
 * 가 이걸 돌린다. 캡슐 하나와 달리 노즈가 뾰족하고 테일콘이 가늘어진다. */
export const FUSELAGE_PROFILE = Object.freeze([
  [0.02, -6.1], [0.34, -5.6], [0.66, -4.9], [0.92, -3.9], [1.06, -2.6],
  [1.1, -0.8], [1.1, 1.4], [1.02, 3.0], [0.82, 4.3], [0.5, 5.3], [0.16, 6.1],
]);

/** 날개 익형이다. 뿌리는 0.42, 끝은 0.12 로 좁아진다. 균일 압출이 아니다. */
export const WING_THICKNESS = Object.freeze({ root: 0.42, tip: 0.12 });
