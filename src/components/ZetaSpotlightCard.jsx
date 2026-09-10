import CharCard from './ui/CharCard';
import { getCharacterTier } from '../utils/tierCalculator';
import { characterZetaUrl } from '../utils/tagCharacters';

/**
 * 전역 랭킹에 오른 캐릭터들을 카드 레일로 보여준다.
 * 예전의 단일 카드 캐러셀 대신, CharCard 를 .eb-scroll-x 슬리브에 나열한다.
 * @param {object} props
 * @param {Array} props.characters globalRank 로 이미 정렬된 캐릭터 목록.
 */
export default function ZetaSpotlightCard({ characters }) {
  if (!characters || characters.length === 0) return null;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="t-h3">랭킹에 오른 캐릭터</h2>
        <span className="t-small" style={{ color: 'var(--fg-3)' }}>{characters.length}장</span>
      </div>
      <div className="eb-scroll-x">
        {characters.map((char) => {
          const tier = getCharacterTier(char.interactionCount || 0);
          const imageUrl = char.imageUrl || char.imageUrls?.[0];
          return (
            <CharCard
              key={char.id}
              name={char.name}
              imageUrl={imageUrl}
              rarity={tier.key}
              rank={char.globalRank}
              count={char.interactionCount}
              countLabel="대화"
              size="rail"
              href={characterZetaUrl(char.id)}
              target="_blank"
            />
          );
        })}
      </div>
    </div>
  );
}
