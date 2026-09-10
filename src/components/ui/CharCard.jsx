import { useState } from 'react';
import { getCharTierMeta } from '../../design/tiers';
import RarityTab from './RarityTab';
import Num from './Num';

/* rail/grid/hero 는 너비만 고정한다. 이미지 영역은 aspect-ratio 로,
   이름판은 내용 높이로 늘어나므로 카드 전체 높이는 auto 다(3줄 이름판 클리핑 방지). */
const SIZE_CLASS = {
  rail: 'w-32 sm:w-[152px]',
  grid: 'w-full',
  hero: 'w-[280px]',
  mini: 'w-10 h-14',
};

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
 * @param {'rail'|'grid'|'hero'|'mini'} [props.size]
 * @param {string} [props.href] 있으면 <a>, 없으면 <button>.
 * @param {() => void} [props.onClick]
 * @param {boolean} [props.priority] true 면 loading="eager" + fetchPriority="high" (히어로 카드 1장 권장).
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
  size = 'rail',
  href,
  onClick,
  priority = false,
  className = '',
}) {
  const meta = getCharTierMeta(rarity);
  const isMini = size === 'mini';
  const Tag = href ? 'a' : 'button';
  const frameBg = meta?.key === 'x' ? 'var(--foil)' : meta ? `var(${meta.cssVar})` : 'var(--line)';
  const medalVar = rank ? MEDAL_VAR[rank] : null;
  const [imageFailed, setImageFailed] = useState(false);
  const showPlaceholder = !imageUrl || imageFailed;
  const initial = name ? [...name][0] : '';

  return (
    <Tag
      href={href}
      onClick={onClick}
      type={href ? undefined : 'button'}
      className={`relative block text-left shrink-0 transition-transform duration-[120ms] ease-out hover:-translate-y-[3px] ${SIZE_CLASS[size]} ${className}`}
    >
      <div
        className={`w-full ${isMini ? 'h-full' : ''}`}
        style={{ background: frameBg, padding: 'var(--frame-w)', borderRadius: 'var(--radius-m)', boxShadow: isMini ? 'none' : 'var(--shadow)' }}
      >
        <div
          className={`w-full ${isMini ? 'h-full' : ''} flex flex-col overflow-hidden`}
          style={{ background: 'var(--surface)', borderRadius: 'calc(var(--radius-m) - var(--frame-w))' }}
        >
          <div
            className={`relative shrink-0 w-full ${isMini ? 'h-full' : 'aspect-[3/4]'}`}
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

            {!isMini && meta && (
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

          {!isMini && (
            <div className="min-w-0 flex flex-col justify-center gap-0.5 px-2.5 py-1.5">
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
