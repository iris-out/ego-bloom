import Num from './ui/Num';
import Delta from './ui/Delta';
import CharCard from './ui/CharCard';
import { getCharacterTier } from '../utils/tierCalculator';

function StatTile({ label, children, delta }) {
  return (
    <div className="eb-tile flex flex-col gap-1.5">
      <span className="t-small" style={{ color: 'var(--fg-2)' }}>{label}</span>
      {children}
      {delta != null && <Delta value={delta} />}
    </div>
  );
}

/**
 * 프로필 KPI 2x2 그리드다. 누적 대화, 팔로워, 캐릭터 수, 대표 캐릭터를 보여준다.
 * @param {object} props
 * @param {object} props.stats
 * @param {Array} props.characters
 * @param {number|null} [props.interactionDelta] 성장 baseline 대비 대화 증감.
 * @param {number|null} [props.followerDelta] 성장 baseline 대비 팔로워 증감.
 * @param {object|null} [props.topCharacter] 대표(최고 대화량) 캐릭터.
 */
export default function HeroCard({ stats, characters, interactionDelta, followerDelta, topCharacter }) {
  const interactions = stats?.plotInteractionCount || 0;
  const followers = stats?.followerCount || 0;
  const charCount = characters?.length ?? stats?.plotCount ?? 0;
  const topTier = topCharacter ? getCharacterTier(topCharacter.interactionCount || 0) : null;
  const topImageUrl = topCharacter?.imageUrl || topCharacter?.imageUrls?.[0];

  return (
    <div className="grid grid-cols-2 gap-3">
      <StatTile label="누적 대화" delta={interactionDelta}>
        <Num value={interactions} size="h1" />
      </StatTile>

      <StatTile label="팔로워" delta={followerDelta}>
        <Num value={followers} size="h1" />
      </StatTile>

      <StatTile label="캐릭터">
        <Num value={charCount} size="h1" />
      </StatTile>

      <div className="eb-tile flex flex-col gap-1.5">
        <span className="t-small" style={{ color: 'var(--fg-2)' }}>대표 캐릭터</span>
        {topCharacter ? (
          <div className="flex items-center gap-2 min-w-0">
            <div style={{ width: 40, height: 56 }} className="shrink-0">
              <CharCard
                name={topCharacter.name}
                imageUrl={topImageUrl}
                rarity={topTier?.key}
                size="mini"
                interactive={false}
              />
            </div>
            <p className="t-body truncate min-w-0">{topCharacter.name}</p>
          </div>
        ) : (
          <p className="t-body" style={{ color: 'var(--fg-3)' }}>—</p>
        )}
      </div>
    </div>
  );
}
