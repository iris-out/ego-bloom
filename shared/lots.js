/** 부지 크기의 단일 출처다. 모델이 까는 포장 바닥(src/world/models/tierBuildings.js)과
 * 배치 격자(shared/worldLayout.js)가 같은 숫자를 읽어야 건물이 겹치지 않는다. */

export const LOT = 52;
export const LOT_LARGE = 66;
export const LOT_CHAMPION = 104;
export const LARGE_TIERS = ['diamond', 'master', 'grandmaster', 'champion'];

/** 필지 사이와 블록 사이에 같은 폭으로 들어가는 골목이다. 골목 도로 폭 6 에
 * 양쪽 여유 1 을 더한 최소값이라 필지가 골목 중심선에서 4 만큼 떨어진다. */
export const ALLEY = 8;

export const LOT_BY_TIER = Object.freeze({
  bronze: LOT,
  silver: LOT,
  gold: LOT,
  platinum: LOT,
  diamond: LOT_LARGE,
  master: LOT_LARGE,
  grandmaster: LOT_LARGE,
  champion: LOT_CHAMPION,
});

/** 호출부는 소문자 티어 키를 넘긴다. 모르는 값은 기본 부지로 떨어진다. */
export const lotOf = (tier) => LOT_BY_TIER[tier] ?? LOT;

/** 작은 등급부터 본다. 자리가 모자라면 한 단계 큰 부지에 얹는다. */
export const LOT_SIZES = Object.freeze([LOT, LOT_LARGE, LOT_CHAMPION]);

/** 필지 중심 사이 간격. 이웃한 두 필지 사이에 골목 하나가 남는다. */
export const slotPitch = (lot) => lot + ALLEY;

/** 챔피언 부지는 혼자 블록 하나를 쓴다. 나머지는 2x2 로 묶는다. */
export const lotsPerBlock = (lot) => (lot === LOT_CHAMPION ? 1 : 2);

/** 블록 중심 사이 간격. 블록 바깥 테두리에도 골목 반쪽이 남는다. */
export const blockPitch = (lot) => lotsPerBlock(lot) * slotPitch(lot);

/** 블록 중심에서 본 필지 중심의 국소 좌표다. */
export const blockSlots = (lot) => (lotsPerBlock(lot) === 1
  ? [[0, 0]]
  : [[-slotPitch(lot) / 2, -slotPitch(lot) / 2], [slotPitch(lot) / 2, -slotPitch(lot) / 2],
    [-slotPitch(lot) / 2, slotPitch(lot) / 2], [slotPitch(lot) / 2, slotPitch(lot) / 2]]);
