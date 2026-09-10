import React from 'react';
import CharCard from '../ui/CharCard';
import { getPlotImageUrl, proxyThumbnailUrl } from '../../utils/imageUtils';
import { getCharacterTier } from '../../utils/tierCalculator';
import { characterZetaUrl } from '../../utils/tagCharacters';

/**
 * CharCard 로 가는 얇은 어댑터다. 희귀도는 대화 수 기준 기존 티어 유틸(getCharacterTier)에서 가져온다.
 * 카드 전체가 제타 캐릭터 페이지로 향하는 외부 링크(새 탭).
 * props: { rank, character }
 */
export default function RailCharacterCard({ rank, character }) {
  const rarity = getCharacterTier(character.interactionCount ?? 0).key;
  const cover = getPlotImageUrl(character) || character.imageUrl;
  const poster = cover ? proxyThumbnailUrl(cover, 360) : null;

  return (
    <CharCard
      name={character.name}
      imageUrl={poster}
      rarity={rarity}
      rank={rank}
      count={character.interactionCount}
      countLabel="대화"
      creator={character.creatorNickname}
      size="rail"
      href={characterZetaUrl(character.id)}
      target="_blank"
    />
  );
}
