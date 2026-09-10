import { useMemo } from 'react';
import { PartyPopper } from 'lucide-react';
import { proxyThumbnailUrl } from '../utils/imageUtils';
import { getBirthdayCharacters, formatBirthDate } from '../utils/birthday';

function MiniAvatar({ char }) {
  return (
    <div
      className="shrink-0 rounded-full overflow-hidden flex items-center justify-center"
      style={{ width: 48, height: 48, background: 'var(--surface-2)', border: '2px solid var(--line)' }}
    >
      {char.imageUrl ? (
        <img src={proxyThumbnailUrl(char.imageUrl, 96)} alt={char.name || ''} loading="lazy" className="w-full h-full object-cover" />
      ) : (
        <span className="t-h3">{(char.name || '?')[0]}</span>
      )}
    </div>
  );
}

/**
 * 제작자 프로필 상단 생일 축하 배너다. 오늘이 제작 기념일인 캐릭터가 없으면 아무것도 렌더링하지 않는다.
 * 폭죽 캔버스나 무한 애니메이션 없이, 진입 시 한 번만 나타난다.
 */
export default function BirthdayBanner({ characters, creatorName }) {
  const chars = useMemo(() => getBirthdayCharacters(characters), [characters]);

  if (chars.length === 0) return null;

  const single = chars.length === 1;
  const main = chars[0];
  const shown = chars.slice(0, 3);
  const rest = chars.length - shown.length;
  const ageChip = main.age >= 1 ? `${main.age}번째 생일` : '첫 생일';
  const dateStr = formatBirthDate(main.birthDate);
  const who = creatorName ? `${creatorName}님이 ` : '';

  return (
    <div
      className="eb-panel animate-emblem-reveal mt-4 flex items-center gap-4 px-5 py-4"
      role="status"
    >
      <div className="flex items-center shrink-0">
        {shown.map((c, i) => (
          <div key={c.id} style={{ marginLeft: i === 0 ? 0 : -14 }}>
            <MiniAvatar char={c} />
          </div>
        ))}
        {rest > 0 && (
          <div
            className="flex items-center justify-center t-small shrink-0"
            style={{ marginLeft: -14, width: 48, height: 48, borderRadius: '50%', background: 'var(--surface-2)', border: '2px solid var(--line)', fontWeight: 700 }}
          >
            +{rest}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="t-label inline-flex items-center gap-1" style={{ color: 'var(--fg-3)' }}>
          <PartyPopper size={12} strokeWidth={2} aria-hidden="true" />오늘의 생일
        </p>
        {single ? (
          <>
            <p className="t-h3 mt-1 truncate">
              오늘은 『{main.name}』의 생일이에요
            </p>
            <p className="t-small mt-0.5" style={{ color: 'var(--fg-2)' }}>
              {who}{dateStr}에 빚어낸 캐릭터예요. 함께 축하해 주세요.
            </p>
          </>
        ) : (
          <>
            <p className="t-h3 mt-1 truncate">
              오늘 생일을 맞은 캐릭터가 {chars.length}명 있어요
            </p>
            <p className="t-small mt-0.5" style={{ color: 'var(--fg-2)' }}>
              『{main.name}』 외 {chars.length - 1}명이 오늘 태어났어요. 함께 축하해 주세요.
            </p>
          </>
        )}
      </div>

      {single && (
        <span className="eb-chip shrink-0 whitespace-nowrap" data-selected>
          {ageChip}
        </span>
      )}
    </div>
  );
}
