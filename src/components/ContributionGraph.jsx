import { useMemo, useRef, useState } from 'react';
import { toKST } from '../utils/tierCalculator';

const DAY_SIZE = 12;
const DAY_GAP = 3;
const CELL = DAY_SIZE + DAY_GAP;

const LEVEL_COLORS = [
  'var(--surface-2)',
  'color-mix(in srgb, var(--accent-ink) 30%, var(--bg))',
  'color-mix(in srgb, var(--accent-ink) 55%, var(--bg))',
  'color-mix(in srgb, var(--accent-ink) 80%, var(--bg))',
  'color-mix(in srgb, var(--accent-ink) 100%, var(--bg))',
];

function getLevel(count, maxCount) {
  if (count === 0) return 0;
  if (maxCount <= 1) return 4;
  const r = count / maxCount;
  if (r >= 0.75) return 4;
  if (r >= 0.5) return 3;
  if (r >= 0.25) return 2;
  return 1;
}

export default function ContributionGraph({ characters }) {
  const [tooltip, setTooltip] = useState(null);
  const [selectedYear, setSelectedYear] = useState(toKST().getFullYear());
  const containerRef = useRef(null);

  const currentStreak = useMemo(() => {
    if (!characters?.length) return 0;
    const daySet = new Set(
      characters
        .map(c => c.createdAt || c.createdDate)
        .filter(Boolean)
        .map(d => {
          const kst = toKST(d);
          return `${kst.getFullYear()}-${kst.getMonth()}-${kst.getDate()}`;
        })
    );
    let streak = 0;
    const now = toKST();
    for (let i = 0; i < 3650; i++) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (daySet.has(key)) streak++;
      else break;
    }
    return streak;
  }, [characters]);

  const { grid, months, totalCount, maxCount, years } = useMemo(() => {
    if (!characters?.length) return { grid: [], months: [], totalCount: 0, maxCount: 0, years: [] };

    // 1. 연도 목록 추출
    const yearsSet = new Set();
    characters.forEach(c => {
      if (c.createdAt) yearsSet.add(toKST(c.createdAt).getFullYear());
    });
    const years = Array.from(yearsSet).sort((a, b) => b - a);
    if (!years.includes(toKST().getFullYear())) years.unshift(toKST().getFullYear());

    // 2. 선택된 연도로 필터
    const filteredChars = characters.filter(c => c.createdAt && toKST(c.createdAt).getFullYear() === selectedYear);

    const dateMap = {};
    filteredChars.forEach(c => {
      const d = toKST(c.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!dateMap[key]) dateMap[key] = [];
      dateMap[key].push(c);
    });

    const startOfYear = toKST(new Date(selectedYear, 0, 1));
    const endOfYear = toKST(new Date(selectedYear, 11, 31, 23, 59, 59));

    const startDate = new Date(startOfYear);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const grid = [];
    let maxCount = 0;
    const current = new Date(startDate);

    while (current <= endOfYear || current.getDay() !== 0) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const dateKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
        const chars = dateMap[dateKey] || [];
        if (chars.length > maxCount) maxCount = chars.length;

        const isSelectedYear = current.getFullYear() === selectedYear;

        week.push({
          date: new Date(current),
          dateKey,
          count: isSelectedYear ? chars.length : 0,
          chars,
          isSelectedYear,
        });
        current.setDate(current.getDate() + 1);
      }
      grid.push(week);
      if (current.getFullYear() > selectedYear && current.getDay() === 0) break;
    }

    const months = [];
    let lastMonth = -1;
    grid.forEach((week, w) => {
      const firstDay = week[0].date;
      if (firstDay.getMonth() !== lastMonth && firstDay.getFullYear() === selectedYear) {
        months.push({ week: w, label: `${firstDay.getMonth() + 1}월` });
        lastMonth = firstDay.getMonth();
      }
    });

    return { grid, months, totalCount: filteredChars.length, maxCount, years };
  }, [characters, selectedYear]);

  if (!characters?.length) return null;

  const svgW = grid.length * CELL + 28;
  const svgH = 7 * CELL + 22;

  return (
    <div className="eb-tile relative" ref={containerRef}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="t-label" style={{ color: 'var(--fg-2)' }}>제작 히스토리</p>

        <div className="flex items-center gap-3">
          {currentStreak > 0 && (
            <span className="t-small" style={{ color: 'var(--warn)', fontWeight: 700 }}>
              스트릭 {currentStreak}일
            </span>
          )}
          <span className="t-small" style={{ color: 'var(--fg-3)' }}>
            <span style={{ color: 'var(--accent-ink)', fontWeight: 700 }}>{totalCount}</span>개 제작
          </span>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="t-small px-2 py-1 outline-none"
            style={{ background: 'var(--surface-2)', border: 'var(--border-w) solid var(--line)', borderRadius: 'var(--radius-s)', color: 'var(--fg)' }}
          >
            {years.map(y => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
        </div>
      </div>

      <div className="eb-scroll-x flex justify-center">
        <svg width={svgW} height={svgH} style={{ flexShrink: 0 }}>
          {months.map(({ week, label }) => (
            <text key={`m-${week}`} x={week * CELL} y={9} fill="var(--fg-3)" fontSize={9} className="t-small">
              {label}
            </text>
          ))}
          {grid.map((week, w) =>
            week.map((day, d) => (
              <rect
                key={day.dateKey}
                x={w * CELL}
                y={14 + d * CELL}
                width={DAY_SIZE}
                height={DAY_SIZE}
                rx={3}
                fill={!day.isSelectedYear ? 'transparent' : LEVEL_COLORS[getLevel(day.count, maxCount)]}
                style={{ cursor: day.isSelectedYear ? 'pointer' : 'default' }}
                onMouseEnter={(e) => {
                  if (!day.isSelectedYear) return;
                  const rect = e.target.getBoundingClientRect();
                  const container = containerRef.current.getBoundingClientRect();
                  setTooltip({
                    x: rect.right - container.left + 10,
                    y: rect.top - container.top - 10,
                    ...day,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              />
            ))
          )}
        </svg>
      </div>

      <div className="flex items-center justify-end gap-1.5 mt-2 t-small" style={{ color: 'var(--fg-3)' }}>
        <span>Less</span>
        {LEVEL_COLORS.slice(1).map((c, i) => (
          <div key={i} style={{ width: 8, height: 8, borderRadius: 3, background: c }} />
        ))}
        <span>More</span>
      </div>

      {tooltip && (
        <div
          className="absolute z-50 pointer-events-none px-3 py-2 t-small whitespace-nowrap"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            background: 'var(--surface)',
            border: 'var(--border-w) solid var(--line)',
            borderRadius: 'var(--radius-m)',
            boxShadow: 'var(--shadow-overlay)',
            color: 'var(--fg)',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 2 }}>
            {tooltip.date.getFullYear()}년 {tooltip.date.getMonth() + 1}월 {tooltip.date.getDate()}일
          </div>
          <div style={{ color: 'var(--accent-ink)', fontWeight: 600, marginBottom: 4 }}>
            {tooltip.count > 0 ? `${tooltip.count}개 제작` : '제작 없음'}
          </div>
          {tooltip.chars && tooltip.chars.length > 0 && (
            <div className="mt-2 pt-2 space-y-1 max-h-32 overflow-y-auto" style={{ borderTop: 'var(--border-w) solid var(--line)' }}>
              {tooltip.chars.map((c, i) => (
                <div key={i} className="flex flex-col">
                  <span style={{ fontWeight: 700 }}>{c.name}</span>
                  {c.updatedAt && (
                    <span className="t-small" style={{ color: 'var(--fg-3)' }}>
                      수정: {toKST(c.updatedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
