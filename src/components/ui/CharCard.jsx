import { useState } from 'react';
import { getCharTierMeta } from '../../design/tiers';
import RarityTab from './RarityTab';
import Num from './Num';

/* rail/grid 는 너비만 고정한다. 이미지 영역은 aspect-ratio 로, 이름판은 내용
   높이로 늘어나므로 카드 전체 높이는 auto 다(3줄 이름판 클리핑 방지).
   hero 는 전체 높이가 392(모바일 280)로 고정이라 이미지 영역이 aspect-ratio 대신
   남은 공간을 flex-1 로 채운다(이름판 높이가 먼저 결정되고 이미지가 나머지를 채움). */
const SIZE_CLASS = {
  rail: 'w-32 sm:w-[152px]',
  grid: 'w-full',
  hero: 'w-[200px] h-[280px] sm:w-[280px] sm:h-[392px]',
  mini: 'w-10 h-14',
};

// hero 의 기준 비율(280x392) — width prop 으로 커스텀 폭을 줄 때 높이를 여기서 유도한다.
const HERO_RATIO = 392 / 280;

const MEDAL_VAR = { 1: '--t-gold', 2: '--t-silver', 3: '--t-bronze' };

/**
 * 트레이딩 카드 형태의 캐릭터 카드다. 프레임 색은 희귀도색, X 등급은 --foil 줄무늬를 쓴다.
 * mini 크기는 프레임과 이미지만 그리고 이름판/탭/랭크 배지를 생략한다(선택기, 미니 행용).
 * @param {object} props
 * @param {string} props.name
 * @param {string} [props.imageUrl]
 * @param {'b'|'a'|'s'|'r'|'sr'|'x'} props.rarity
 * @param {number} [props.rank] 있으면 우상단 랭크 배지. 1~3 은 금/은/동 메달 색.
 * @param {number} [props.count] 대화 수 등 대표 수치.
 * @param {string} [props.countLabel] count 뒤에 붙는 단위(예: "대화"). 생략하면 formatNumber 결과의 단위를 그대로 쓴다.
 * @param {string} [props.creator] 제작자 이름.
 * @param {boolean} [props.showRarity] false 면 좌상단 희귀도 탭(SR, R 등 텍스트)을 그리지 않는다. 프레임 색과 X 등급 foil 은 유지된다.
 * @param {boolean} [props.hideInfo] true 면 하단 이름판(이름/수치/제작자)을 그리지 않는다. 이미지가 카드 전체를 채운다.
 * @param {React.ReactNode} [props.overlay] 이미지 하단 위에 얹을 콘텐츠(비네팅, 태그 pill 등). 랭크 배지보다 아래 레이어에 그려진다.
 * @param {'rail'|'grid'|'hero'|'mini'} [props.size]
 * @param {number} [props.width] px. 있으면 size 의 기본 너비를 대체한다(hero 는 비율 유지해 높이도 함께 유도).
 * @param {string} [props.href] 있으면 <a>, 없으면 <button>. interactive=false 면 무시.
 * @param {string} [props.target] href 와 함께 쓰는 <a target>. "_blank" 면 rel 기본값을 자동으로 채운다.
 * @param {string} [props.rel]
 * @param {() => void} [props.onClick]
 * @param {boolean} [props.priority] true 면 loading="eager" + fetchPriority="high" (히어로 카드 1장 권장).
 * @param {boolean} [props.interactive] false 면 <button>/<a> 대신 <div> 로 렌더한다(다른 링크/버튼 안에 중첩할 때).
 * @param {'div'} [props.as] interactive=false 와 동등한 별칭.
 * @param {string} [props.className]
 */
export default function CharCard({
  name,
  imageUrl,
  rarity,
  rank,
  count,
  countLabel,
  creator,
  showRarity = true,
  hideInfo = false,
  overlay,
  size = 'rail',
  width,
  href,
  target,
  rel,
  onClick,
  priority = false,
  interactive = true,
  as,
  className = '',
}) {
  const meta = getCharTierMeta(rarity);
  const isMini = size === 'mini';
  const isHero = size === 'hero';
  const isStatic = as === 'div' || interactive === false;
  const Tag = isStatic ? 'div' : href ? 'a' : 'button';
  const frameBg = meta?.key === 'x' ? 'var(--foil)' : meta ? `var(${meta.cssVar})` : 'var(--line)';
  const medalVar = rank ? MEDAL_VAR[rank] : null;
  const [imageFailed, setImageFailed] = useState(false);
  const showPlaceholder = !imageUrl || imageFailed;
  const initial = name ? [...name][0] : '';
  const resolvedRel = target === '_blank' ? (rel || 'noopener noreferrer') : rel;
  const sizeStyle = width != null ? { width, height: isHero ? Math.round(width * HERO_RATIO) : undefined } : undefined;

  return (
    <Tag
      href={isStatic ? undefined : href}
      target={isStatic ? undefined : target}
      rel={isStatic ? undefined : resolvedRel}
      onClick={isStatic ? undefined : onClick}
      type={isStatic || href ? undefined : 'button'}
      className={`relative block text-left shrink-0 transition-transform duration-[120ms] ease-out ${interactive ? 'hover:-translate-y-[3px]' : ''} ${width == null ? SIZE_CLASS[size] : ''} ${className}`}
      style={sizeStyle}
    >
      <div
        className={`w-full ${isMini || isHero ? 'h-full' : ''} ${isHero ? 'flex flex-col' : ''}`}
        style={{ background: frameBg, padding: 'var(--frame-w)', borderRadius: 'var(--radius-m)', boxShadow: isMini ? 'none' : 'var(--shadow)' }}
      >
        <div
          className={`w-full ${isMini || isHero ? 'h-full' : ''} flex flex-col overflow-hidden`}
          style={{ background: 'var(--surface)', borderRadius: 'calc(var(--radius-m) - var(--frame-w))' }}
        >
          <div
            className={`relative shrink-0 w-full ${isMini ? 'h-full' : isHero ? 'flex-1 min-h-0' : 'aspect-[3/4]'}`}
          >
            {!showPlaceholder ? (
              <img
                src={imageUrl}
                alt={name}
                loading={priority ? 'eager' : 'lazy'}
                fetchPriority={priority ? 'high' : undefined}
                onError={() => setImageFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ background: 'var(--surface-2)' }}
              >
                <span
                  className="select-none"
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--fg-3)', fontSize: isMini ? 16 : 28, fontWeight: 700 }}
                >
                  {initial}
                </span>
              </div>
            )}

            {overlay}

            {!isMini && meta && showRarity && (
              <RarityTab tier={rarity} className="absolute left-0 top-0" style={{ borderRadius: '0 0 var(--radius-s) 0' }} />
            )}

            {!isMini && rank != null && (
              <div
                className="absolute top-1.5 right-1.5 flex items-center justify-center t-h3 shrink-0"
                style={{
                  width: medalVar ? 40 : 28,
                  height: medalVar ? 40 : 28,
                  borderRadius: '50%',
                  background: medalVar ? `var(${medalVar})` : 'var(--bg)',
                  border: medalVar ? 'none' : `2px solid ${frameBg}`,
                  color: medalVar ? 'var(--on-tier)' : 'var(--fg)',
                  fontSize: medalVar ? 16 : 14,
                }}
              >
                {rank}
              </div>
            )}
          </div>

          {!isMini && !hideInfo && (
            <div className={`min-w-0 flex flex-col justify-center gap-0.5 px-2.5 py-1.5 ${isHero ? 'shrink-0' : ''}`}>
              <p className="t-card-name truncate">{name}</p>
              {count != null && (
                <div className="t-figure leading-none">
                  <Num value={count} unit={countLabel} />
                </div>
              )}
              {creator && (
                <p className="t-small truncate" style={{ color: 'var(--fg-2)' }}>
                  {creator}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Tag>
  );
}
