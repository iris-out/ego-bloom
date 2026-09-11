import { useMemo, useState } from 'react';
import { HeartCrack } from 'lucide-react';
import { computeEarnedTitles } from '../data/badges';
import Segmented from './ui/Segmented';
import './AchievementsTab.css';

const CATEGORIES = [
  { value: 'all',              label: '전체' },
  { value: 'interaction',      label: '대화량' },
  { value: 'char_interaction', label: '캐릭터' },
  { value: 'follower',         label: '팔로워' },
  { value: 'creation',         label: '제작' },
  { value: 'tag',              label: '태그' },
  { value: 'activity',         label: '활동' },
];

/** 사랑 파괴자가 달성되면 순애보 / 오직 순애만 은(아직 미달성이라면) 영구히 달성
 *  불가능해지므로 박살난 카드로 표시한다. 편도 관계라 반대 방향은 별도로 TAUNT_RULES 가 맡는다. */
const SHATTER_RULES = [
  { when: 'ntr', shatter: ['sunae', 'purelove'] },
];

/** 순애보 / 오직 순애만 을 달성해도 사랑 파괴자를 딸 수는 있다. 이 경우 사랑 파괴자
 *  카드는 그대로 두되, 호버(또는 탭)하면 카드 안에 조롱 메시지를 띄운다. */
const TAUNT_RULES = [
  { when: ['sunae', 'purelove'], target: 'ntr', message: '순애보인 당신에게 이런 업적은 어울리지 않아요' },
];

function getBlocker(title, byId) {
  if (title.earned) return null;
  for (const rule of SHATTER_RULES) {
    if (rule.shatter.includes(title.id) && byId[rule.when]?.earned) return byId[rule.when];
  }
  return null;
}

function getTaunt(title, byId) {
  for (const rule of TAUNT_RULES) {
    if (rule.target !== title.id) continue;
    const triggeredBy = rule.when.find(id => byId[id]?.earned);
    if (triggeredBy) return { message: rule.message, by: byId[triggeredBy] };
  }
  return null;
}

/* 카드를 가로지르는 균열 폴리라인(위 -> 아래, % 좌표). 왼쪽/오른쪽 clip-path 가
   이 점들을 그대로 공유해야 두 조각이 어긋남 없이 맞물린다. */
const CRACK_POINTS = [
  [58, 0], [64, 15], [50, 30], [62, 45], [46, 62], [58, 80], [52, 100],
];

function polyStr(points) {
  return points.map(([x, y]) => `${x}% ${y}%`).join(', ');
}

const CLIP_LEFT = `polygon(0% 0%, ${polyStr(CRACK_POINTS)}, 0% 100%)`;
const CLIP_RIGHT = `polygon(100% 0%, 100% 100%, ${polyStr([...CRACK_POINTS].reverse())})`;

/* 균열 주변에 흩어진 작은 파편 삼각형들. */
const SHARDS = [
  { points: '56,10 62,13 58,18', rotate: -12, cx: 58, cy: 13 },
  { points: '48,33 54,29 53,37', rotate: 10,  cx: 51, cy: 33 },
  { points: '60,48 66,44 63,53', rotate: -8,  cx: 63, cy: 48 },
  { points: '44,65 50,61 49,70', rotate: 14,  cx: 47, cy: 65 },
  { points: '56,83 61,80 59,88', rotate: -6,  cx: 58, cy: 83 },
];

function useOnceAnimate() {
  const [shouldAnimate] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  return shouldAnimate;
}

function ShatterCardContent({ title, reason }) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="eb-shatter-emoji" style={{ fontSize: 28, lineHeight: 1 }}>{title.emoji}</span>
        <span
          className="t-label shrink-0"
          style={{ padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--surface-2)', color: 'var(--fg-3)' }}
        >
          미달성
        </span>
      </div>
      <p className="t-h3 line-clamp-2" style={{ color: 'var(--fg-3)' }}>{title.title}</p>
      <p className="t-small line-clamp-3" style={{ color: 'var(--fg-3)' }}>{reason}</p>
      <span className="eb-shatter-chip t-label">
        <HeartCrack size={12} aria-hidden="true" />
        박살남
      </span>
    </>
  );
}

/** 상호 배타로 영원히 획득 불가한 업적 카드다. 균열 clip-path 로 두 조각을 갈라
 * 반대 방향으로 밀어내고, 마운트 시 한 번 벌어지는 애니메이션을 재생한다. */
function ShatteredCard({ title, blockedBy }) {
  const animate = useOnceAnimate();
  const reason = `${blockedBy.title}를 달성해 받을 수 없는 업적입니다`;
  const ariaLabel = `${title.title}, 획득 불가: ${blockedBy.title} 달성`;

  return (
    <div
      className="eb-shatter-card"
      data-broken="true"
      data-animate={animate ? 'true' : 'false'}
      role="group"
      aria-label={ariaLabel}
    >
      {/* 실제 카드 높이를 잡기 위한 레이아웃 전용 스페이서. 내용은 아래 두 반쪽에 있다. */}
      <div className="flex flex-col gap-2 p-3" style={{ opacity: 0 }} aria-hidden="true">
        <ShatterCardContent title={title} reason={reason} />
      </div>

      <div className="eb-shatter-half eb-shatter-half--left" style={{ clipPath: CLIP_LEFT }} aria-hidden="true">
        <ShatterCardContent title={title} reason={reason} />
      </div>
      <div className="eb-shatter-half eb-shatter-half--right" style={{ clipPath: CLIP_RIGHT }} aria-hidden="true">
        <ShatterCardContent title={title} reason={reason} />
      </div>

      <svg className="eb-shatter-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polyline className="eb-shatter-crackline" points={CRACK_POINTS.map(([x, y]) => `${x},${y}`).join(' ')} />
        {SHARDS.map((s, i) => (
          <polygon key={i} className="eb-shatter-shard" points={s.points} transform={`rotate(${s.rotate} ${s.cx} ${s.cy})`} />
        ))}
      </svg>
    </div>
  );
}

function AchievementCard({ title }) {
  const locked = !title.earned;
  const progress = title.progress;
  const pct = progress ? Math.max(0, Math.min(100, Math.round((progress.current / progress.max) * 100))) : null;
  const desc = title.desc || title.description || '';
  const charCount = title.chars?.length || 0;

  return (
    <div
      className="eb-achievement-card flex flex-col gap-2 p-3"
      style={{
        borderRadius: 'var(--radius-l)',
        background: locked ? 'transparent' : 'var(--surface)',
        border: locked ? '2px dashed var(--line)' : '2px solid var(--accent-ink)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span style={{ fontSize: 28, lineHeight: 1, opacity: locked ? 0.45 : 1 }} aria-hidden="true">{title.emoji}</span>
        <span
          className="t-label shrink-0"
          style={{
            padding: '2px 8px',
            borderRadius: 'var(--radius-pill)',
            background: locked ? 'var(--surface-2)' : 'color-mix(in srgb, var(--accent) 22%, transparent)',
            color: locked ? 'var(--fg-3)' : 'var(--accent-ink)',
          }}
        >
          {locked ? '미달성' : '달성'}
        </span>
      </div>

      <p className="t-h3 line-clamp-2" style={{ color: locked ? 'var(--fg-2)' : 'var(--fg)' }}>{title.title}</p>
      {desc && (
        <p className="t-small line-clamp-3" style={{ color: locked ? 'var(--fg-3)' : 'var(--fg-2)' }}>{desc}</p>
      )}

      {charCount > 0 && (
        <span
          className="t-label self-start"
          style={{ padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--surface-2)', color: 'var(--fg-2)' }}
        >
          캐릭터 {charCount}개
        </span>
      )}

      {progress && (
        <div className="flex items-center gap-2 mt-auto pt-1">
          <div className="flex-1" style={{ height: 6, borderRadius: 'var(--radius-pill)', background: 'var(--surface-2)', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)' }} />
          </div>
          <span className="t-label shrink-0" style={{ color: 'var(--fg-3)' }}>{pct}%</span>
        </div>
      )}
    </div>
  );
}

/** 사랑 파괴자 카드처럼 반대쪽 배타 업적이 이미 달성돼 조롱 메시지를 띄워야 하는 카드다.
 * 카드 자체는 평소와 같은 상태(달성/미달성, 진행률)로 렌더링하고, 호버 / 포커스 시
 * 짙은 빨간 오버레이가 카드 위를 덮는다. 터치 기기(hover 불가)에서는 탭으로 토글한다. */
function TauntableCard({ title, taunt }) {
  const [tapped, setTapped] = useState(false);
  const descId = `eb-taunt-${title.id}`;

  return (
    <div
      className={`eb-taunt-card${tapped ? ' eb-taunt-card--active' : ''}`}
      tabIndex={0}
      aria-describedby={descId}
      onClick={() => setTapped(v => !v)}
    >
      <AchievementCard title={title} />
      <div className="eb-taunt-overlay" id={descId}>
        <HeartCrack size={18} className="eb-taunt-icon" aria-hidden="true" />
        <p className="eb-taunt-text">{taunt.message}</p>
      </div>
    </div>
  );
}

/**
 * 업적 탭: 칭호 정보 카드 시트다. 카테고리 pill 탭으로 필터링하고,
 * 이모지 + 제목 + 설명(+ 진행률) 을 담은 카드 그리드로 달성(--accent-ink 테두리) / 미달성(dashed --line) 을 구분한다.
 * 사랑 파괴자가 달성되면 순애보 / 오직 순애만 은 영구히 불가능해지므로 박살난 카드로 표시하고
 * 미달성 그룹 맨 앞에 정렬한다. 반대로 순애보 / 오직 순애만 을 먼저 달성해도 사랑 파괴자는
 * 여전히 달성 가능하므로, 그 경우 사랑 파괴자 카드는 그대로 두고 호버 조롱 메시지만 붙인다.
 */
export default function AchievementsTab({ stats, characters }) {
  const [category, setCategory] = useState('all');
  const titles = useMemo(
    () => computeEarnedTitles({ characters, stats }),
    [characters, stats]
  );

  const byId = useMemo(() => Object.fromEntries(titles.map(t => [t.id, t])), [titles]);

  const earnedCount = useMemo(() => titles.filter(t => t.earned).length, [titles]);
  const totalCount = titles.length;

  const filtered = useMemo(() => {
    const list = category === 'all' ? titles : titles.filter(t => t.category === category);
    const earned = list.filter(t => t.earned);
    const locked = list.filter(t => !t.earned);
    const blocked = locked.filter(t => getBlocker(t, byId));
    const normalLocked = locked.filter(t => !getBlocker(t, byId));
    return [...earned, ...blocked, ...normalLocked];
  }, [titles, category, byId]);

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="flex items-baseline gap-1.5">
        <span className="t-h3">{earnedCount}</span>
        <span className="t-small" style={{ color: 'var(--fg-2)' }}>/ {totalCount} 달성</span>
      </div>

      <div className="eb-scroll-x">
        <Segmented options={CATEGORIES} value={category} onChange={setCategory} aria-label="칭호 카테고리" />
      </div>

      <div className="grid grid-cols-2 min-[900px]:grid-cols-3 min-[1200px]:grid-cols-4 gap-3">
        {filtered.map(t => {
          const blocker = getBlocker(t, byId);
          if (blocker) return <ShatteredCard key={t.id} title={t} blockedBy={blocker} />;
          const taunt = getTaunt(t, byId);
          if (taunt) return <TauntableCard key={t.id} title={t} taunt={taunt} />;
          return <AchievementCard key={t.id} title={t} />;
        })}
      </div>
    </div>
  );
}
