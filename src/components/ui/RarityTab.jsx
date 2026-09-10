import { getCharTierMeta } from '../../design/tiers';

/**
 * 캐릭터 희귀도 칩이다. 카드의 좌상단 탭으로도, 목록/모달에서 단독 칩으로도 쓴다.
 * X 등급은 --c-x 단색을 쓴다(프레임 쪽 foil 은 CharCard 가 따로 그린다).
 * @param {object} props
 * @param {'b'|'a'|'s'|'r'|'sr'|'x'} props.tier
 * @param {string} [props.className]
 * @param {object} [props.style] 카드 좌상단에 얹을 때 모서리만 override 한다(예: '0 0 var(--radius-s) 0').
 */
export default function RarityTab({ tier, className = '', style }) {
  const meta = getCharTierMeta(tier);
  if (!meta) return null;

  return (
    <span
      className={`t-label inline-flex items-center justify-center h-5 px-1.5 ${className}`}
      style={{ background: `var(${meta.cssVar})`, color: 'var(--on-tier)', borderRadius: 'var(--radius-s)', ...style }}
    >
      {meta.label}
    </span>
  );
}
