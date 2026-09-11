import { useState } from 'react';
import TierMark from './TierMark';
import Num from './Num';
import { formatEloScore, formatNumber } from '../../utils/tierCalculator';
import { getCreatorTierMeta, formatTierDivision } from '../../design/tiers';
import './PlayerCard.css';

const MEDAL_VAR = { 1: '--t-gold', 2: '--t-silver', 3: '--t-bronze' };
const UNIT_RE = /^([+-]?[\d,]+(?:\.\d+)?)(.*)$/;

/** stats 행의 숫자부/단위부를 나눠 숫자만 크게, 단위는 0.62em 로 그린다. */
function StatFigure({ value }) {
  const str = formatNumber(value);
  const m = str.match(UNIT_RE);
  const figure = m ? m[1] : str;
  const unit = m ? m[2] : '';
  return (
    <>
      {figure}
      {unit && <span style={{ fontSize: '0.62em', fontWeight: 600, color: 'var(--fg-2)' }}>{unit}</span>}
    </>
  );
}

/**
 * 제작자 선수 카드다. 1:1 아바타 위에 티어 육각 엠블럼이 겹친다.
 * compact 는 podium 의 #2/#3, 즐겨찾기 그리드처럼 핸들을 생략하고 stats 숫자도 더 작게 그린다.
 * @param {object} props
 * @param {string} props.name
 * @param {string} [props.handle] "@handle" (앞의 @ 는 이 컴포넌트가 붙인다. 값에는 @ 없이 전달).
 * @param {string} [props.avatarUrl]
 * @param {string} [props.tier] CREATOR_TIERS key. 프레임 색도 이 값을 따른다.
 * @param {number} [props.division] 1~4.
 * @param {number} [props.eloRaw] calculateCreatorScore() 의 원본 점수. formatEloScore 로 표시한다.
 * @param {{ label: string, value: string|number }[]} [props.stats] 2개 권장(대화, 팔로워).
 * @param {number} [props.rank] 있으면 좌상단에 "#N" 랭크 리본을 그린다. 1~3 은 메달 색, 4~100 은 --accent.
 * @param {boolean} [props.compact]
 * @param {string} [props.tierHref] 있으면 티어 엠블럼이 이 경로로 가는 링크가 된다(예: "/tier?creator=<handle>").
 * @param {number} [props.avatarMaxHeight] px. lg(1024px) 미만에서만 적용되는 아바타 높이 상한(모바일에서 카드가 너무 커지는 것을 막을 때).
 *   lg 이상에서는 카드가 늘어난 만큼 아바타도 같이 자라야 하므로 상한을 걸지 않는다.
 * @param {import('react').ReactNode} [props.children] ELO 아래에 렌더되는 슬롯(티어 진행 바 등).
 * @param {() => void} [props.onClick]
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
  tierHref,
  avatarMaxHeight,
  children,
  onClick,
  className = '',
}) {
  const medalVar = rank ? (MEDAL_VAR[rank] || '--accent') : null;
  const medalTextVar = rank && rank <= 3 ? '--on-tier' : '--accent-fg';
  const emblemSize = compact ? 48 : 64;
  const tierMeta = getCreatorTierMeta(tier);
  const tierLabel = formatTierDivision(tierMeta, division);
  const frameVar = tier ? `var(--t-${tier})` : 'var(--line)';
  const [avatarFailed, setAvatarFailed] = useState(false);
  const showPlaceholder = !avatarUrl || avatarFailed;
  const initial = name ? [...name][0] : '';

  return (
    <div
      className={`relative w-full h-full eb-panel overflow-visible flex flex-col ${className}`}
      style={{ borderColor: frameVar, borderWidth: 'var(--frame-w)', boxShadow: 'var(--shadow)' }}
      onClick={onClick}
    >
      {medalVar && (
        <div
          className="absolute z-10 flex items-center justify-center tabular-nums"
          style={{
            top: 12,
            left: 12,
            height: 26,
            padding: '0 10px',
            borderRadius: 999,
            background: `var(${medalVar})`,
            color: `var(${medalTextVar})`,
            border: '1px solid rgb(0 0 0 / .15)',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          #{rank}
        </div>
      )}

      <div
        className={`relative w-full overflow-hidden ${avatarMaxHeight ? 'max-lg:max-h-[var(--avatar-max-h)]' : ''}`}
        style={{
          borderRadius: 'calc(var(--radius-l) - var(--frame-w)) calc(var(--radius-l) - var(--frame-w)) 0 0',
          // aspect-ratio 는 flex-grow 와 함께 쓰면 Chrome 에서 늘어나지 않는다.
          // 대신 paddingTop 스페이서로 최소 정사각형 높이를 만들고, flex-grow 가 그 위로 실제 높이를 늘린다.
          position: 'relative',
          flex: '1 1 auto',
          minHeight: 0,
          ...(avatarMaxHeight ? { '--avatar-max-h': `${avatarMaxHeight}px` } : null),
        }}
      >
        <div aria-hidden style={{ paddingTop: '100%' }} />
        {!showPlaceholder ? (
          <img
            src={avatarUrl}
            alt={name}
            loading="lazy"
            onError={() => setAvatarFailed(true)}
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'var(--surface-2)' }}>
            <span
              className="select-none"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--fg-3)', fontSize: 40, fontWeight: 700 }}
            >
              {initial}
            </span>
          </div>
        )}
      </div>

      <div className="relative flex justify-center shrink-0" style={{ marginTop: -(emblemSize / 2) }}>
        {tierHref ? (
          <a href={tierHref} aria-label="티어 가이드 보기" className="animate-emblem-reveal inline-flex">
            <TierMark tier={tier} division={division} size={emblemSize} />
          </a>
        ) : (
          <div className="animate-emblem-reveal inline-flex">
            <TierMark tier={tier} division={division} size={emblemSize} />
          </div>
        )}
      </div>

      <div className="px-4 pb-4 pt-1 flex flex-col shrink-0 items-center text-center gap-1">
        <p
          className={`pc-tier-name truncate max-w-full ${compact ? 'text-[14px]' : 'text-[18px]'}`}
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            color: tierMeta ? `var(${tierMeta.cssVar})` : 'var(--fg-3)',
            '--tier-color': tierMeta ? `var(${tierMeta.cssVar})` : undefined,
          }}
        >
          {tierLabel}
        </p>
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

        {children && <div className="w-full mt-2">{children}</div>}

        {stats.length > 0 && (
          <div className={`mt-2 flex items-center ${compact ? 'gap-4' : 'gap-6'}`}>
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col items-center">
                <span
                  className={compact ? 'text-[18px]' : 'text-[20px] sm:text-[24px]'}
                  style={{ fontFamily: 'var(--font-display)', fontWeight: 700, lineHeight: 1.2 }}
                >
                  {typeof s.value === 'number' ? <StatFigure value={s.value} /> : s.value}
                </span>
                <span className="t-small" style={{ color: 'var(--fg-2)', fontSize: 13 }}>{s.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
