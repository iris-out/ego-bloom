import { useState } from 'react';
import TierMark from './TierMark';
import Num from './Num';
import { formatEloScore } from '../../utils/tierCalculator';

const MEDAL_VAR = { 1: '--t-gold', 2: '--t-silver', 3: '--t-bronze' };

/**
 * 제작자 선수 카드다. 1:1 아바타 위에 티어 육각 엠블럼이 겹친다.
 * compact 는 podium 의 #2/#3, 즐겨찾기 그리드처럼 아바타/엠블럼/이름/ELO 만 그린다.
 * @param {object} props
 * @param {string} props.name
 * @param {string} [props.handle] "@handle" (앞의 @ 는 이 컴포넌트가 붙인다. 값에는 @ 없이 전달).
 * @param {string} [props.avatarUrl]
 * @param {string} [props.tier] CREATOR_TIERS key. 프레임 색도 이 값을 따른다.
 * @param {number} [props.division] 1~4.
 * @param {number} [props.eloRaw] calculateCreatorScore() 의 원본 점수. formatEloScore 로 표시한다.
 * @param {{ label: string, value: string|number }[]} [props.stats] 2개 권장(대화, 팔로워).
 * @param {number} [props.rank] 1~3 이면 좌상단에 랭크 리본을 그린다.
 * @param {boolean} [props.compact]
 * @param {string} [props.className]
 */
export default function PlayerCard({
  name,
  handle,
  avatarUrl,
  tier,
  division,
  eloRaw,
  stats = [],
  rank,
  compact = false,
  className = '',
}) {
  const medalVar = rank ? MEDAL_VAR[rank] : null;
  const frameVar = tier ? `var(--t-${tier})` : 'var(--line)';
  const [avatarFailed, setAvatarFailed] = useState(false);
  const showPlaceholder = !avatarUrl || avatarFailed;
  const initial = name ? [...name][0] : '';

  return (
    <div
      className={`relative w-full eb-panel overflow-visible ${className}`}
      style={{ borderColor: frameVar, borderWidth: 'var(--frame-w)', boxShadow: 'var(--shadow)' }}
    >
      {medalVar && (
        <div
          className="t-label absolute left-0 top-0 z-10 flex items-center h-6 px-2.5"
          style={{ background: `var(${medalVar})`, color: 'var(--on-tier)', borderRadius: '0 0 var(--radius-s) 0' }}
        >
          {rank}위
        </div>
      )}

      <div className="relative aspect-square w-full overflow-hidden" style={{ borderRadius: 'calc(var(--radius-l) - var(--frame-w)) calc(var(--radius-l) - var(--frame-w)) 0 0' }}>
        {!showPlaceholder ? (
          <img
            src={avatarUrl}
            alt={name}
            loading="lazy"
            onError={() => setAvatarFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--surface-2)' }}>
            <span
              className="select-none"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--fg-3)', fontSize: 40, fontWeight: 700 }}
            >
              {initial}
            </span>
          </div>
        )}
      </div>

      <div className="relative flex justify-center" style={{ marginTop: -24 }}>
        <div
          className="animate-emblem-reveal"
          style={{ background: 'var(--surface)', borderRadius: '50%', padding: 3 }}
        >
          <TierMark tier={tier} division={division} size={48} />
        </div>
      </div>

      <div className="px-4 pb-4 pt-1 flex flex-col items-center text-center gap-1">
        <p className="t-h2 truncate max-w-full">{name}</p>
        {handle && !compact && (
          <p className="t-small truncate max-w-full" style={{ color: 'var(--fg-2)' }}>
            @{handle}
          </p>
        )}

        <div className="mt-2 flex flex-col items-center">
          <span className="t-label" style={{ color: 'var(--fg-3)' }}>ELO</span>
          <span className="t-display" style={{ fontSize: 32, lineHeight: '36px' }}>
            {formatEloScore(eloRaw)}
          </span>
        </div>

        {!compact && stats.length > 0 && (
          <div className="mt-2 flex items-center gap-6">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col items-center">
                <span className="t-figure" style={{ fontSize: 16 }}>
                  {typeof s.value === 'number' ? <Num value={s.value} size="body" /> : s.value}
                </span>
                <span className="t-small" style={{ color: 'var(--fg-2)' }}>{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
