import React, { useMemo, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { toKST } from '../utils/tierCalculator';

const DAY_SIZE = 11;
const DAY_GAP = 2;
const CELL = DAY_SIZE + DAY_GAP;
const WEEKS = 52;

const COLORS_DARK = [
  'rgba(255,255,255,0.06)',
  '#6B46C1',
  '#805AD5',
  '#9F7AEA',
  '#B794F4',
];

const COLORS_LIGHT = [
  'rgba(0,0,0,0.06)',
  '#D6BCFA',
  '#B794F4',
  '#9F7AEA',
  '#805AD5',
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
  const { theme } = useTheme();
  const [tooltip, setTooltip] = useState(null);
  const [selectedYear, setSelectedYear] = useState(toKST().getFullYear());
  const colors = theme === 'dark' ? COLORS_DARK : COLORS_LIGHT;
  const containerRef = React.useRef(null);

  // ... (useMemo remains same)
  const { grid, months, totalCount, maxCount, years } = useMemo(() => {
    // ... same code ...
    if (!characters?.length) return { grid: [], months: [], totalCount: 0, maxCount: 0, years: [] };

    // 1. Extract Years
    const yearsSet = new Set();
    characters.forEach(c => {
      if (c.createdAt) yearsSet.add(toKST(c.createdAt).getFullYear());
    });
    const years = Array.from(yearsSet).sort((a, b) => b - a);
    if (!years.includes(toKST().getFullYear())) years.unshift(toKST().getFullYear());

    // 2. Filter by Year
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
          isSelectedYear
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
  }, [characters, selectedYear, theme]);

  if (!characters?.length) return null;

  const svgW = grid.length * CELL + 28;
  const svgH = 7 * CELL + 22;

  return (
    <div className="card p-4 sm:p-5 relative" ref={containerRef}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)]">제작 히스토리</h3>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--text-tertiary)]">
            <span className="font-semibold text-[var(--accent)]">{totalCount}</span>개 제작
          </span>

          {/* Year Filter */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="text-xs bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-2 py-1 text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-hide">
        <svg width={svgW} height={svgH} style={{ minWidth: '100%' }}>
          {months.map(({ week, label }) => (
            <text key={`m-${week}`} x={week * CELL} y={9} fill="var(--text-tertiary)" fontSize={9} fontFamily="inherit">
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
                rx={2}
                fill={!day.isSelectedYear ? 'transparent' : colors[getLevel(day.count, maxCount)]}
                className={day.isSelectedYear ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}
                onMouseEnter={(e) => {
                  if (!day.isSelectedYear) return;
                  const rect = e.target.getBoundingClientRect();
                  const container = containerRef.current.getBoundingClientRect();
                  setTooltip({
                    x: rect.right - container.left + 10,
                    y: rect.top - container.top - 10,
                    ...day
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              />
            ))
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1.5 mt-2 text-[10px] text-[var(--text-tertiary)]">
        <span>Less</span>
        {colors.slice(1).map((c, i) => ( // Skip 0 count for legend if preferred, or include all
          <div key={i} className="rounded-sm" style={{ width: 8, height: 8, backgroundColor: c }} />
        ))}
        <span>More</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-[9999] pointer-events-none bg-[rgba(0,0,0,0.9)] text-white px-3 py-2 rounded-lg text-xs shadow-xl backdrop-blur-sm whitespace-nowrap border border-white/10"
          style={{
            left: tooltip.x,
            top: tooltip.y,
          }}
        >
          <div className="font-bold mb-0.5">
            {tooltip.date.getFullYear()}년 {tooltip.date.getMonth() + 1}월 {tooltip.date.getDate()}일
          </div>
          <div className="text-[var(--accent)] font-medium mb-1">
            {tooltip.count > 0 ? `${tooltip.count}개 제작` : '제작 없음'}
          </div>
          {tooltip.chars && tooltip.chars.length > 0 && (
            <div className="mt-2 pt-2 border-t border-white/20 space-y-1 max-h-32 overflow-y-auto">
              {tooltip.chars.map((c, i) => (
                <div key={i} className="flex flex-col">
                  <span className="font-semibold">{c.name}</span>
                  {c.updatedAt && (
                    <span className="text-[10px] text-gray-300">
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
