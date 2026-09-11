import { useId } from 'react';
import { getCreatorTierMeta, formatTierDivision, CREATOR_TIERS } from '../../design/tiers';
import './TierMark.css';

const TIER_ORDER = CREATOR_TIERS.map((t) => t.key);
const tierAtLeast = (key, target) => TIER_ORDER.indexOf(key) >= TIER_ORDER.indexOf(target);

// 뱃지는 항상 이 박스 안에 그린다. 리스트에서 서로 다른 티어끼리도 정렬이 맞아야 하기 때문이다.
const VB_W = 120;
const VB_H = 100;
const CX = 60;
const CY = 51;
const HEX_W = 70;
const HEX_H = 62;
const THICKNESS_DY = 6;

/** flat-top(양옆이 뾰족한) 육각형 꼭짓점을 만든다. */
function hexPoints(cx, cy, w, h) {
  const hw = w / 2;
  const hh = h / 2;
  return [
    [cx - hw * 0.5, cy - hh],
    [cx + hw * 0.5, cy - hh],
    [cx + hw, cy],
    [cx + hw * 0.5, cy + hh],
    [cx - hw * 0.5, cy + hh],
    [cx - hw, cy],
  ];
}

/** n 꼭짓점 별(스파이크) 좌표를 만든다. rotation 은 라디안, 기본은 첫 꼭짓점이 위를 향하게. */
function starPoints(cx, cy, spikes, outerR, innerR, rotation = -Math.PI / 2) {
  const pts = [];
  const step = Math.PI / spikes;
  let angle = rotation;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
    angle += step;
  }
  return pts;
}

const toAttr = (pts) => pts.map(([x, y]) => `${x},${y}`).join(' ');

const HEX_MAIN = hexPoints(CX, CY, HEX_W, HEX_H);
const HEX_DARK = hexPoints(CX, CY + THICKNESS_DY, HEX_W, HEX_H);
const HEX_PANEL = hexPoints(CX, CY, HEX_W * 0.74, HEX_H * 0.74);
const HEX_RIM = hexPoints(CX, CY, HEX_W * 0.9, HEX_H * 0.9);
const STAR_MAIN = toAttr(starPoints(CX, CY, 5, 13, 5.6));
// 좌상단 베벨 하이라이트: 왼쪽 꼭짓점, 상단좌 꼭짓점, 중심을 잇는 삼각형이다.
const HIGHLIGHT_FACET = toAttr([HEX_MAIN[5], HEX_MAIN[0], [CX, CY]]);

const CROWN_THICKNESS_DY = 3;
const CROWN_DIAMOND = { halfW: 6, spikes: [{ cx: 48, apexY: 12 }, { cx: 60, apexY: 8 }, { cx: 72, apexY: 12 }] };
const CROWN_CHAMPION = {
  halfW: 5,
  spikes: [
    { cx: 40, apexY: 16 },
    { cx: 50, apexY: 8 },
    { cx: 60, apexY: 2 },
    { cx: 70, apexY: 8 },
    { cx: 80, apexY: 16 },
  ],
};
/** 왕관 스파이크 삼각형이다. dy 를 주면 두께(bevel) 용 그림자 사본이 된다. */
function spikeTriangle(cx, halfW, apexY, dy = 0) {
  return toAttr([[cx - halfW, 22 + dy], [cx, apexY + dy], [cx + halfW, 22 + dy]]);
}

const GEM_POINTS = toAttr([[60, 0], [63, 4], [60, 8], [57, 4]]);

const mirrorTransform = `translate(${VB_W},0) scale(-1,1)`;

// 오른쪽 날개 깃털 하나의 사양이다. root 는 육각형 옆면에 물리는 지점, tip 은 바깥으로 뻗는 끝.
// 배열 순서는 아래(짧다) -> 위(길다) 이며, 티어별로 뒤에서 몇 개를 뽑아 쓴다(위쪽이 더 눈에 띈다).
const WING_BLADE_SPECS = [
  { rootX: 88, rootY: 58, rootHalfW: 4.5, tipX: 99, tipY: 52, tipHalfW: 2 },
  { rootX: 88, rootY: 49, rootHalfW: 5, tipX: 108, tipY: 36, tipHalfW: 2 },
  { rootX: 88, rootY: 41, rootHalfW: 5.5, tipX: 116, tipY: 18, tipHalfW: 2 },
];
const WING_THICKNESS_DY = 4;

function pickWingBlades(count) {
  return count > 0 ? WING_BLADE_SPECS.slice(WING_BLADE_SPECS.length - count) : [];
}

/** 날개 깃털 하나(쐐기꼴)를 만든다. dy 를 주면 두께용 그림자 사본이 된다. */
function wingBladePolygon({ rootX, rootY, rootHalfW, tipX, tipY, tipHalfW }, dy = 0) {
  return toAttr([
    [rootX, rootY - rootHalfW + dy],
    [tipX, tipY - tipHalfW + dy],
    [tipX, tipY + tipHalfW + dy],
    [rootX, rootY + rootHalfW + dy],
  ]);
}

/** 깃털 위쪽 가장자리를 따라가는 얇은 하이라이트 조각이다. */
function wingHighlightPolygon({ rootX, rootY, rootHalfW, tipX, tipY, tipHalfW }) {
  return toAttr([
    [rootX, rootY - rootHalfW],
    [tipX, tipY - tipHalfW],
    [tipX, tipY - tipHalfW * 0.4],
    [rootX, rootY - rootHalfW * 0.4],
  ]);
}

// 리본 배너: 가운데 띠 + 좌우 꼬리(끝이 뾰족한 V 컷). 오른쪽은 mirrorTransform 으로 만든다.
const RIBBON_BAND = toAttr([[34, 80], [86, 80], [86, 88], [34, 88]]);
const RIBBON_TAIL_D = 'M26,86 L52,86 L52,94 L36,100 L24,92 Z';
const RIBBON_FOLD_D = 'M50,86 L52,86 L40,100 L37,98 Z';

const RAY_COUNT = 12;
const RAYS = Array.from({ length: RAY_COUNT }, (_, i) => {
  const angle = (i * 2 * Math.PI) / RAY_COUNT;
  return [CX, CY, CX + Math.cos(angle) * 50, CY + Math.sin(angle) * 50];
});

function fourPointStar(cx, cy, r) {
  return toAttr(starPoints(cx, cy, 4, r, r * 0.3, 0));
}

// [x, y] 뱃지 외곽의 빈 공간에 두는 위치다. 티어가 올라갈수록 순서대로 추가된다.
const SPARKLE_SLOTS = [
  [96, 30],
  [26, 74],
  [88, 74],
  [30, 26],
];

/**
 * 제작자 티어 육각 엠블럼이다. 두께가 있는 비셜 육각형 + 내부 패널 + 별로 구성되고,
 * 티어가 올라갈수록 날개, 왕관 스파이크, 리본, glow, 반짝임(sparkle) 이 순서대로 붙는다.
 * 언랭크(tier 가 없거나 알 수 없는 키)는 --line 외곽선 육각형에 흐린 별만 그린다.
 * @param {object} props
 * @param {string|null} [props.tier] CREATOR_TIERS 의 key ('bronze'...'champion'), 없으면 언랭크.
 * @param {number} [props.division] 1~4. 5 - division 만큼 pip 을 채운다. 챔피언은 무시한다.
 * @param {number} [props.size] 엠블럼 렌더 높이(px). 너비는 1.2배. 24/32/56px 를 기준으로 디테일이 줄어든다.
 * @param {boolean} [props.showPips] division pip 4개를 아래에 그릴지.
 * @param {string} [props.className]
 */
export default function TierMark({ tier, division, size = 40, showPips = false, className = '', ...rest }) {
  const meta = getCreatorTierMeta(tier);
  const width = size * 1.2;
  const label = meta ? formatTierDivision(meta, division) : '언랭크';
  const filledPips = meta ? Math.max(0, Math.min(4, 5 - (division ?? 4))) : 0;
  const gradId = useId();

  const key = meta?.key;
  const hasRim = meta && tierAtLeast(key, 'silver');
  const hasWings = meta && tierAtLeast(key, 'gold');
  const wingsBig = meta && tierAtLeast(key, 'platinum');
  const hasGlow = meta && tierAtLeast(key, 'platinum');
  const hasCrown = meta && tierAtLeast(key, 'diamond');
  const crownData = key === 'champion' ? CROWN_CHAMPION : CROWN_DIAMOND;
  const hasRibbon = meta && tierAtLeast(key, 'master');
  const hasRays = key === 'champion';
  const hasGem = key === 'champion';
  const sparkleCount = key === 'champion' ? 4 : key === 'master' ? 3 : key === 'diamond' ? 2 : 0;
  const glowOpacity = key === 'champion' ? 0.55 : key === 'master' ? 0.42 : key === 'diamond' ? 0.32 : key === 'platinum' ? 0.22 : 0;

  // 사이즈 구간별 디테일: 32px 미만은 glow/rays/sparkle 을 뺀다. 56px 이상만 반짝임이 twinkle 한다.
  const showGlow = hasGlow && size >= 32;
  const showRays = hasRays && size >= 56;
  const showSparkles = sparkleCount > 0 && size >= 32;
  const twinkle = size >= 56;

  // 날개 깃털 수: platinum+ 는 3장, gold 는 2장. 24px 미만에서는 한 장씩 줄여 실루엣만 남긴다.
  const wingBladeCount = !meta ? 0 : wingsBig ? (size < 32 ? 2 : 3) : hasWings ? (size < 32 ? 1 : 2) : 0;
  const wingBlades = pickWingBlades(wingBladeCount);

  const base = meta ? `var(${meta.cssVar})` : null;
  const dark = meta ? `color-mix(in srgb, var(${meta.cssVar}) 62%, black)` : null;
  const panel = meta ? `color-mix(in srgb, var(${meta.cssVar}) 82%, black)` : null;
  const light = meta ? `color-mix(in srgb, var(${meta.cssVar}) 45%, white)` : null;

  return (
    <div className={`inline-flex flex-col items-center gap-1 ${className}`} role="img" aria-label={label} {...rest}>
      <svg width={width} height={size} viewBox={`0 0 ${VB_W} ${VB_H}`} aria-hidden="true" className="shrink-0">
        {showRays && (
          <g style={{ stroke: light, strokeWidth: 1.2, opacity: 0.3 }}>
            {RAYS.map(([x1, y1, x2, y2], i) => (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
            ))}
          </g>
        )}

        {showGlow && (
          <>
            <radialGradient id={`${gradId}-glow`}>
              <stop offset="0%" stopColor={base} stopOpacity={glowOpacity} />
              <stop offset="100%" stopColor={base} stopOpacity="0" />
            </radialGradient>
            <ellipse cx={CX} cy={CY} rx={56} ry={46} fill={`url(#${gradId}-glow)`} />
          </>
        )}

        {hasRibbon && (
          <>
            <path d={RIBBON_TAIL_D} style={{ fill: light }} />
            <path d={RIBBON_TAIL_D} transform={mirrorTransform} style={{ fill: light }} />
            <polygon points={RIBBON_BAND} style={{ fill: light }} />
            <path d={RIBBON_FOLD_D} style={{ fill: dark, opacity: 0.85 }} />
            <path d={RIBBON_FOLD_D} transform={mirrorTransform} style={{ fill: dark, opacity: 0.85 }} />
          </>
        )}

        {hasCrown &&
          crownData.spikes.map((s, i) => (
            <g key={i}>
              <polygon points={spikeTriangle(s.cx, crownData.halfW, s.apexY, CROWN_THICKNESS_DY)} style={{ fill: dark }} />
              <polygon points={spikeTriangle(s.cx, crownData.halfW, s.apexY)} style={{ fill: light }} />
            </g>
          ))}
        {hasGem && <polygon points={GEM_POINTS} style={{ fill: light }} />}

        {wingBlades.map((b, i) => (
          <g key={i}>
            <polygon points={wingBladePolygon(b, WING_THICKNESS_DY)} style={{ fill: dark }} />
            <polygon points={wingBladePolygon(b)} style={{ fill: light }} />
            <polygon points={wingHighlightPolygon(b)} style={{ fill: '#fff', opacity: 0.3 }} />
          </g>
        ))}
        <g transform={mirrorTransform}>
          {wingBlades.map((b, i) => (
            <g key={i}>
              <polygon points={wingBladePolygon(b, WING_THICKNESS_DY)} style={{ fill: dark }} />
              <polygon points={wingBladePolygon(b)} style={{ fill: light }} />
              <polygon points={wingHighlightPolygon(b)} style={{ fill: '#fff', opacity: 0.3 }} />
            </g>
          ))}
        </g>

        {meta ? (
          <>
            <polygon points={toAttr(HEX_DARK)} style={{ fill: dark }} />
            <polygon points={toAttr(HEX_MAIN)} style={{ fill: base }} />
            <polygon points={HIGHLIGHT_FACET} style={{ fill: '#fff', opacity: 0.28 }} />
            {hasRim && (
              <polygon points={toAttr(HEX_RIM)} fill="none" style={{ stroke: light, strokeWidth: 1, opacity: 0.6 }} />
            )}
            <polygon points={toAttr(HEX_PANEL)} style={{ fill: panel }} />
            <polygon points={STAR_MAIN} style={{ fill: light }} />
          </>
        ) : (
          <polygon points={toAttr(HEX_MAIN)} fill="none" style={{ stroke: 'var(--line)', strokeWidth: 4 }} />
        )}

        {!meta && <polygon points={STAR_MAIN} style={{ fill: 'var(--fg-3)', opacity: 0.5 }} />}

        {showSparkles &&
          SPARKLE_SLOTS.slice(0, sparkleCount).map(([sx, sy], i) => (
            <path
              key={i}
              d={fourPointStar(sx, sy, 4)}
              style={{ fill: '#fff', animationDelay: `${i * 0.35}s` }}
              className={twinkle ? 'tm-sparkle-twinkle' : ''}
              opacity={twinkle ? undefined : 0.85}
            />
          ))}
      </svg>

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
