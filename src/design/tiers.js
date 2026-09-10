/**
 * 제작자 티어(ELO)와 캐릭터 티어(대화 수) 의 표시용 메타데이터다.
 * 점수 구간 계산은 src/utils/tierCalculator.js 가 그대로 담당한다.
 * 색상은 항상 src/index.css 의 CSS 커스텀 프로퍼티로 참조한다 (JSX 안에 hex 없음).
 */

/** @typedef {{ key: string, ko: string, code: string, cssVar: string }} CreatorTierMeta */
/** @typedef {{ key: string, label: string, cssVar: string }} CharTierMeta */

/** @type {CreatorTierMeta[]} */
export const CREATOR_TIERS = [
  { key: 'bronze', ko: '브론즈', code: 'B', cssVar: '--t-bronze' },
  { key: 'silver', ko: '실버', code: 'S', cssVar: '--t-silver' },
  { key: 'gold', ko: '골드', code: 'G', cssVar: '--t-gold' },
  { key: 'platinum', ko: '플래티넘', code: 'P', cssVar: '--t-platinum' },
  { key: 'diamond', ko: '다이아몬드', code: 'D', cssVar: '--t-diamond' },
  { key: 'master', ko: '마스터', code: 'M', cssVar: '--t-master' },
  { key: 'champion', ko: '챔피언', code: 'C', cssVar: '--t-champion' },
];

/** @type {CharTierMeta[]} */
export const CHAR_TIERS = [
  { key: 'b', label: 'B', cssVar: '--c-b' },
  { key: 'a', label: 'A', cssVar: '--c-a' },
  { key: 's', label: 'S', cssVar: '--c-s' },
  { key: 'r', label: 'R', cssVar: '--c-r' },
  { key: 'sr', label: 'SR', cssVar: '--c-sr' },
  { key: 'x', label: 'X', cssVar: '--c-x' },
];

/**
 * 키(또는 tierCalculator.js 가 반환하는 title/name) 로 제작자 티어 메타를 찾는다.
 * @param {string|null|undefined} key
 * @returns {CreatorTierMeta|null} unranked 나 알 수 없는 키는 null.
 */
export function getCreatorTierMeta(key) {
  if (!key) return null;
  const norm = String(key).toLowerCase();
  return CREATOR_TIERS.find((t) => t.key === norm) ?? null;
}

/**
 * 키로 캐릭터 티어 메타를 찾는다.
 * @param {string|null|undefined} key
 * @returns {CharTierMeta|null}
 */
export function getCharTierMeta(key) {
  if (!key) return null;
  const norm = String(key).toLowerCase();
  return CHAR_TIERS.find((t) => t.key === norm) ?? null;
}

/** 로마 숫자가 아닌 division 표기(챔피언 제외 1~4)를 한글 티어명과 함께 만든다. */
export function formatTierDivision(meta, division) {
  if (!meta) return '언랭크';
  if (meta.key === 'champion') return meta.ko;
  const roman = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' }[division] ?? '';
  return roman ? `${meta.ko} ${roman}` : meta.ko;
}
