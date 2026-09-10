import { getCreatorTierMeta, formatTierDivision } from '../../design/tiers';

const HEX_CLIP = 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)';

/**
 * 제작자 티어 육각 엠블럼이다. 챔피언은 위에 왕관 노치가 붙는다.
 * 언랭크(tier 가 없거나 알 수 없는 키)는 --line 외곽선 육각형에 "-" 를 그린다.
 * @param {object} props
 * @param {string|null} [props.tier] CREATOR_TIERS 의 key ('bronze'...'champion'), 없으면 언랭크.
 * @param {number} [props.division] 1~4. 5 - division 만큼 pip 을 채운다. 챔피언은 무시한다.
 * @param {24|40|64} [props.size] 엠블럼 높이(px). 너비는 1.15배.
 * @param {boolean} [props.showPips] division pip 4개를 아래에 그릴지.
 * @param {string} [props.className]
 */
export default function TierMark({ tier, division, size = 40, showPips = false, className = '' }) {
  const meta = getCreatorTierMeta(tier);
  const width = Math.round(size * 1.15);
  const label = meta ? formatTierDivision(meta, division) : '언랭크';
  const filledPips = meta ? Math.max(0, Math.min(4, 5 - (division ?? 4))) : 0;

  return (
    <div className={`inline-flex flex-col items-center gap-1 ${className}`} role="img" aria-label={label}>
      {meta?.key === 'champion' && (
        <svg
          width={width * 0.6}
          height={size * 0.25}
          viewBox="0 0 60 25"
          aria-hidden="true"
          style={{ marginBottom: -Math.round(size * 0.08) }}
        >
          <path d="M0 25 L10 0 L20 15 L30 0 L40 15 L50 0 L60 25 Z" fill="var(--t-champion)" />
        </svg>
      )}

      <div
        style={{
          width,
          height: size,
          clipPath: meta ? HEX_CLIP : 'none',
          background: meta ? `var(${meta.cssVar})` : 'transparent',
        }}
        className="relative flex items-center justify-center shrink-0"
      >
        {!meta && (
          /* border-on-clip-path 로는 정육각형 외곽선이 그려지지 않으므로(가로줄만 남음)
             SVG polygon stroke 로 직접 그린다. */
          <svg
            width={width}
            height={size}
            viewBox="0 0 115 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="absolute inset-0"
          >
            <polygon
              points="25,2 75,2 113,50 75,98 25,98 2,50"
              fill="none"
              stroke="var(--line)"
              strokeWidth="4"
            />
          </svg>
        )}
        <span
          className="t-h3 select-none"
          style={{
            fontSize: size * 0.5,
            lineHeight: 1,
            color: meta ? 'var(--on-tier)' : 'var(--fg-3)',
            fontWeight: 700,
          }}
        >
          {meta ? meta.code : '-'}
        </span>
      </div>

      {showPips && meta && meta.key !== 'champion' && (
        <div className="flex items-center gap-[3px]">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: i < filledPips ? `var(${meta.cssVar})` : 'var(--line)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
