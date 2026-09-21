/** 도시 전체의 높이 상수를 한 곳에 모은 원장이다.
 * 곡선 간선, 고가 순환로, 램프, 교량, 터널, 육교에 해변 데크와 잔교까지 더해지면서
 * 값이 여섯 파일에 흩어져 어느 것이 어느 것 위를 지나는지 사람이 셀 수 없어졌다.
 * 값은 각 원본 파일에서 그대로 옮긴 것이다. 여기서 값을 바꾸면 물 판정과 착지
 * 높이가 어긋나니 상수는 그대로 두고 이 파일은 참조와 겹침 검사만 맡는다. */

export const LEVELS = Object.freeze({
  WATER: -2.8, // Ocean.jsx 맨 위 주석
  GROUND: 0, // 지면 상단
  PAVEMENT_TOP: 0.23, // UrbanScenery addSegment 보도: y .12 두께 .22
  ROAD_TOP: 0.33, // UrbanScenery addSegment 차도: y .27 두께 .12
  MARKING: 0.35, // UrbanScenery 중앙선
  RIVER_TOP: 0.18, // UrbanScenery 강 add('water', ...): y .1 두께 .16
  CAR_GROUND: 1.21, // carPhysics.js CAR_GROUND
  FLIGHT_GROUND: 2.1, // flightPhysics.js FLIGHT_GROUND
  HIGHWAY_DECK: 14, // urbanPlan.js HIGHWAY_DECK
  DECK_THICKNESS: 1.2, // roadStructures.js ROAD_STRUCTURE_DEFAULTS.deckThickness
  OVERPASS_CLEARANCE: 7, // roadStructures.js ROAD_STRUCTURE_DEFAULTS.overpassClearance
  TUNNEL_COVER: 9, // roadStructures.js ROAD_STRUCTURE_DEFAULTS.tunnelCoverHeight
});

/** 층은 아래에서 위로 물, 지면, 노면, 차량, 항공기 접지, 육교, 고가 순환로 순이다.
 * 이웃한 층은 경계를 맞대 여유가 0 이고, 육교와 고가 순환로 사이만 실제 공극이 있다. */
export const LAYERS = Object.freeze([
  { key: 'water', bottom: LEVELS.WATER, top: LEVELS.WATER, ko: '물' },
  { key: 'ground', bottom: LEVELS.WATER, top: LEVELS.GROUND, ko: '지면' },
  { key: 'road', bottom: LEVELS.GROUND, top: LEVELS.ROAD_TOP, ko: '노면' },
  { key: 'car', bottom: LEVELS.ROAD_TOP, top: LEVELS.CAR_GROUND, ko: '차량' },
  { key: 'flight', bottom: LEVELS.CAR_GROUND, top: LEVELS.FLIGHT_GROUND, ko: '항공기 접지' },
  { key: 'overpass', bottom: LEVELS.FLIGHT_GROUND, top: LEVELS.OVERPASS_CLEARANCE, ko: '육교' },
  { key: 'elevated', bottom: LEVELS.HIGHWAY_DECK - LEVELS.DECK_THICKNESS, top: LEVELS.HIGHWAY_DECK, ko: '고가 순환로' },
]);

/** 키로 층의 구간을 찾는다. 없으면 null 이다. */
export function spanOf(key) {
  const layer = LAYERS.find((item) => item.key === key);
  return layer ? { bottom: layer.bottom, top: layer.top } : null;
}

/** 두 층이 세로로 겹치는지 본다. 경계만 맞닿으면 겹침이 아니다. */
export function overlaps(a, b) {
  return a.bottom < b.top && b.bottom < a.top;
}

/** 아래 층 상단에서 위 층 하단까지의 여유다. 음수면 위 층이 아래 층을 파고든 것이다. */
export function clearanceBetween(lower, upper) {
  return upper.bottom - lower.top;
}
