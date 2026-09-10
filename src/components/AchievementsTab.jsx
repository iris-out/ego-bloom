import { useMemo, useState } from 'react';
import { computeEarnedTitles } from '../data/badges';
import Segmented from './ui/Segmented';

const CATEGORIES = [
  { value: 'all',              label: '전체' },
  { value: 'interaction',      label: '대화량' },
  { value: 'char_interaction', label: '캐릭터' },
  { value: 'follower',         label: '팔로워' },
  { value: 'creation',         label: '제작' },
  { value: 'tag',              label: '태그' },
  { value: 'activity',         label: '활동' },
];

function AchievementTile({ title }) {
  const locked = !title.earned;
  const progress = title.progress;
  const pct = progress ? Math.max(0, Math.min(100, Math.round((progress.current / progress.max) * 100))) : null;

  return (
    <div
      className="flex flex-col items-center justify-center gap-1 text-center p-2 shrink-0"
      style={{
        width: 88,
        height: 104,
        borderRadius: 'var(--radius-l)',
        background: locked ? 'transparent' : 'var(--surface)',
        border: locked ? '2px dashed var(--line)' : '2px solid var(--accent-ink)',
        opacity: locked ? 0.35 : 1,
      }}
      title={title.desc}
    >
      <span style={{ fontSize: 28, lineHeight: 1 }} aria-hidden="true">{title.emoji}</span>
      <span className="t-small line-clamp-2 max-w-full" style={{ fontWeight: 700 }}>{title.title}</span>
      {progress && (
        <div
          className="w-full mt-0.5"
          style={{ height: 3, borderRadius: 'var(--radius-pill)', background: 'var(--surface-2)', overflow: 'hidden' }}
        >
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent-ink)' }} />
        </div>
      )}
    </div>
  );
}

/**
 * 업적 탭: 칭호 스티커 시트다. 카테고리 pill 탭으로 필터링하고,
 * 88x88 타일 그리드로 획득(--accent-ink 테두리) / 미획득(dashed --line, 반투명) 을 구분한다.
 */
export default function AchievementsTab({ stats, characters }) {
  const [category, setCategory] = useState('all');
  const titles = useMemo(
    () => computeEarnedTitles({ characters, stats }),
    [characters, stats]
  );

  const earnedCount = useMemo(() => titles.filter(t => t.earned).length, [titles]);
  const totalCount = titles.length;

  const filtered = useMemo(() => {
    const list = category === 'all' ? titles : titles.filter(t => t.category === category);
    const earned = list.filter(t => t.earned);
    const locked = list.filter(t => !t.earned);
    return [...earned, ...locked];
  }, [titles, category]);

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="flex items-baseline gap-1.5">
        <span className="t-h3">{earnedCount}</span>
        <span className="t-small" style={{ color: 'var(--fg-2)' }}>/ {totalCount} 달성</span>
      </div>

      <div className="eb-scroll-x">
        <Segmented options={CATEGORIES} value={category} onChange={setCategory} aria-label="칭호 카테고리" />
      </div>

      <div className="flex flex-wrap gap-3">
        {filtered.map(t => <AchievementTile key={t.id} title={t} />)}
      </div>
    </div>
  );
}
