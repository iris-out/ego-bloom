import { useMemo } from 'react';

/**
 * 캐릭터 해시태그를 집계해 칩 목록으로 보여준다. 기존 WordCloud 시각효과를 대체한다.
 * (WordCloud, CreatorRadar, ActivityHourChart 는 더 쓰는 곳이 없어 제거했다.)
 */
export function TagChips({ characters }) {
  const tags = useMemo(() => {
    if (!characters) return [];
    const counts = {};

    characters.forEach(c => {
      const tagList = c.hashtags || c.tags || [];
      tagList.forEach(tag => {
        if (!tag) return;
        const normalized = String(tag).trim();
        if (normalized.length < 1) return;
        counts[normalized] = (counts[normalized] || 0) + 1;
      });
    });

    return Object.entries(counts)
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);
  }, [characters]);

  if (tags.length === 0) return null;

  return (
    <div className="eb-tile">
      <p className="t-label mb-3" style={{ color: 'var(--fg-2)' }}>자주 쓴 태그</p>
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <span key={tag.text} className="eb-chip inline-flex items-center gap-1.5">
            #{tag.text}
            <span
              className="t-label inline-flex items-center justify-center h-4 min-w-4 px-1"
              style={{ background: 'var(--accent-soft)', color: 'var(--fg)', borderRadius: 'var(--radius-pill)' }}
            >
              {tag.count}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
