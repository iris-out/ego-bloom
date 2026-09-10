import { useState, useEffect } from 'react';
import { getCharacterTier, formatCompactNumber, toKST } from '../utils/tierCalculator';
import { proxyThumbnailUrl } from '../utils/imageUtils';
import Modal from './ui/Modal';
import CharCard from './ui/CharCard';
import Num from './ui/Num';

const CACHE_PREFIX = 'char_detail_v1_';
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4시간

function getCache(id) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + id);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(CACHE_PREFIX + id); return null; }
    return data;
  } catch { return null; }
}

function setCache(id, data) {
  try { localStorage.setItem(CACHE_PREFIX + id, JSON.stringify({ ts: Date.now(), data })); } catch { /* 저장 실패는 무시한다 */ }
}

/**
 * 캐릭터 상세 모달이다. ui/Modal 을 그대로 쓴다(데스크톱 다이얼로그, 390에서 바텀시트).
 * @param {object} props
 * @param {object|null} props.char
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 */
export default function CharacterDetailModal({ char, isOpen, onClose }) {
  const [charId, setCharId] = useState(char?.id ?? null);
  const [detail, setDetail] = useState(() => (char?.id ? getCache(char.id) : null));
  const [loading, setLoading] = useState(false);

  // 캐릭터가 바뀌면 렌더 중에 즉시 초기화한다(effect 안에서 동기 setState 하는 대신
  // React 가 권장하는 "렌더링 중 상태 조정" 패턴을 쓴다).
  if ((char?.id ?? null) !== charId) {
    setCharId(char?.id ?? null);
    setDetail(char?.id ? getCache(char.id) : null);
  }

  useEffect(() => {
    if (!isOpen || !char?.id || getCache(char.id)) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- 캐시 미스일 때만 로딩 표시를 켜는 표준 fetch 패턴이다.
    setLoading(true);
    fetch(`/api/zeta/plots/${char.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) { setCache(char.id, data); setDetail(data); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen, char?.id]);

  if (!char) return null;

  const tier = getCharacterTier(char.interactionCount || 0);
  const tags = (char.hashtags || char.tags || []).slice(0, 6);

  const description =
    detail?.longDescription ||
    detail?.shortDescription ||
    char.shortDescription ||
    null;

  const createdRaw = char.createdAt || char.createdDate;
  const createdDate = createdRaw ? toKST(createdRaw) : null;
  const isValidDate = createdDate && !isNaN(createdDate.getTime());
  const dateFormatted = isValidDate
    ? `${String(createdDate.getFullYear()).slice(2)}.${String(createdDate.getMonth() + 1).padStart(2, '0')}.${String(createdDate.getDate()).padStart(2, '0')}`
    : null;
  const daysSince = isValidDate ? Math.max(1, Math.floor((toKST().getTime() - createdDate.getTime()) / 86400000)) : null;
  const avgPerDay = daysSince && char.interactionCount ? Math.round(char.interactionCount / daysSince) : null;
  const isNewChar = daysSince != null && daysSince < 30;
  const ageLabelShort = isNewChar
    ? daysSince < 1 ? '당일'
      : daysSince === 1 ? '하루'
        : daysSince < 7 ? `${daysSince}일`
          : `${Math.floor(daysSince / 7)}주`
    : null;

  const zetaUrl = char.id ? `https://zeta-ai.io/ko/plots/${char.id}/profile` : null;

  return (
    <Modal open={isOpen} onClose={onClose} title={char.name}>
      <div className="flex flex-col items-center gap-4">
        <CharCard
          name={char.name}
          imageUrl={char.imageUrl ? proxyThumbnailUrl(char.imageUrl, 400) : null}
          rarity={tier.key}
          count={char.interactionCount}
          countLabel="대화"
          size="hero"
          priority
          width={200}
        />

        {tags.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {tags.map(tag => (
              <span key={tag} className="eb-chip">#{String(tag).replace(/^#/, '')}</span>
            ))}
          </div>
        )}

        <div className="w-full min-h-[24px]">
          {loading ? (
            <div className="eb-skel space-y-2">
              <div className="eb-bone h-4 w-full" />
              <div className="eb-bone h-4 w-4/5" />
            </div>
          ) : description ? (
            <p className="t-body text-center" style={{ color: 'var(--fg-2)' }}>{description}</p>
          ) : null}
        </div>

        <div className="w-full grid grid-cols-2 gap-2">
          {dateFormatted && (
            <div className="eb-tile">
              <p className="t-label" style={{ color: 'var(--fg-2)' }}>생성일</p>
              <p className="t-h3 mt-1">{dateFormatted}</p>
            </div>
          )}
          {char.unlimitedAllowed && (
            <div className="eb-tile">
              <p className="t-label" style={{ color: 'var(--fg-2)' }}>이용 제한</p>
              <p className="t-h3 mt-1">언리밋</p>
            </div>
          )}
          {(isNewChar || (avgPerDay && avgPerDay > 0)) && (
            <div className="eb-tile">
              <p className="t-label" style={{ color: 'var(--fg-2)' }}>
                {isNewChar ? '성장 하이라이트' : '하루 평균'}
              </p>
              <p className="t-h3 mt-1">
                {isNewChar
                  ? `${ageLabelShort} 만에 ${formatCompactNumber(char.interactionCount || 0)}`
                  : <Num value={avgPerDay} unit="회" />}
              </p>
            </div>
          )}
          {detail?.starCount != null && detail.starCount > 0 && (
            <div className="eb-tile">
              <p className="t-label" style={{ color: 'var(--fg-2)' }}>즐겨찾기</p>
              <p className="t-h3 mt-1"><Num value={detail.starCount} /></p>
            </div>
          )}
        </div>

        {zetaUrl ? (
          <a
            href={zetaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="eb-btn eb-btn-primary w-full"
          >
            대화 시작하기
          </a>
        ) : (
          <button type="button" disabled className="eb-btn eb-btn-secondary w-full opacity-50">
            URL 없음
          </button>
        )}
      </div>
    </Modal>
  );
}
