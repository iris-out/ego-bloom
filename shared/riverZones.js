/** 강까지의 거리로 구역을 정한다. 핵(cityNodes) 이 동심원으로 등급을 정하는 것과
 * 별개로, 핵 밖 땅은 이 표를 따른다. 강이 굽어 있으므로 띠도 같이 휘어서
 * 층층이 쌓인 줄무늬로 보이지 않는다.
 *
 * 남북을 다르게 짠다. 북안은 강변 공원이 좁고 곧바로 저층 구시가지가 시작되며 상가가
 * 많이 섞인다. 남안은 공원이 세 배 넓고 그 뒤에 아파트 단지, 그다음 상업 축이 온다.
 * 같은 거리에서 다른 것이 보여야 강 하나를 두고 두 도시가 마주 본다.
 */
import { riverBank, riverClearance } from './river.js';

/** to 는 강변 여유(공원과 강변도로) 바깥에서 잰 거리이며 extent 비율이다.
 * mix 는 그 띠에 상가가 얼마나 섞이는지를 0에서 1 사이로 적은 값이고
 * npcBuildings 의 density 어휘로 옮겨진다. lift 는 티어 높이에 곱하는 값이다.
 */
export const RIVER_BANDS = Object.freeze({
  north: Object.freeze([
    { key: 'oldtown', ko: '구시가지', to: 0.26, density: 'dense', mix: 0.55, lift: 0.72 },
    { key: 'nshop', ko: '재래 상가', to: 0.42, density: 'dense', mix: 0.70, lift: 0.88 },
    { key: 'nhome', ko: '저층 주거', to: 0.66, density: 'mixed', mix: 0.35, lift: 0.80 },
    { key: 'nedge', ko: '북부 외곽', to: 1.00, density: 'open', mix: 0.22, lift: 0.66 },
  ]),
  south: Object.freeze([
    { key: 'apt', ko: '아파트 단지', to: 0.30, density: 'apartment', mix: 0.20, lift: 1.18 },
    { key: 'sshop', ko: '상업 축', to: 0.42, density: 'tower', mix: 0.62, lift: 1.05 },
    { key: 'shome', ko: '남부 주거', to: 1.00, density: 'mixed', mix: 0.30, lift: 0.86 },
  ]),
});

const LAST = Object.freeze({
  north: RIVER_BANDS.north[RIVER_BANDS.north.length - 1],
  south: RIVER_BANDS.south[RIVER_BANDS.south.length - 1],
});

/** 그 좌표가 어느 강 대역인지 돌려준다. 강이나 강변 공원 안이면 null 이다.
 * 그 자리는 배치가 통째로 비우므로 대역을 물을 일이 없다.
 */
export function riverZoneAt(extent, x, z) {
  const bank = riverBank(extent, x, z);
  const clearance = riverClearance(extent, x, bank.side);
  const distance = Math.abs(bank.delta) - clearance;
  if (distance < 0) return null;
  const side = bank.side < 0 ? 'north' : 'south';
  const ratio = distance / Math.max(1, extent);
  for (const band of RIVER_BANDS[side]) if (ratio < band.to) return { ...band, side, distance, ratio };
  return { ...LAST[side], side, distance, ratio };
}

/** 배경 건물 종류를 고를 때 쓰는 density 어휘다. 모르는 값이 오면 mixed 로 떨어진다. */
export function riverDensityAt(extent, x, z) {
  return riverZoneAt(extent, x, z)?.density || 'mixed';
}

/** 티어 높이에 곱하는 값이다. 북안은 눌러 저층으로, 남안 아파트 띠는 올려
 * 강변에 같은 높이가 늘어서게 만든다. 곱만 하고 상한은 호출부가 정한다. */
export function riverLift(extent, x, z) {
  return riverZoneAt(extent, x, z)?.lift ?? 1;
}
