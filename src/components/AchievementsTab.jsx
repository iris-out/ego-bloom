import React, { useMemo, useState } from 'react';
import { computeEarnedTitles } from '../data/badges';
import { TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';

// 발자취 계열 ID 그룹
const MILESTONE_GROUPS = [
  {
    key: 'follower',
    label: '팔로워 발자취',
    emoji: '👥',
    color: 'rgba(96,165,250,',
    ids: ['follower_100', 'follower_1k', 'follower_5k', 'superstar'],
    thresholds: ['100명', '1천명', '5천명', '1만명'],
  },
  {
    key: 'total_chat',
    label: '총 대화량 발자취',
    emoji: '💬',
    color: 'rgba(251,191,36,',
    ids: ['1k', '10k', '100k', '1m', '10m', '100m_total'],
    thresholds: ['1천', '1만', '10만', '100만', '1천만', '1억'],
  },
  {
    key: 'char_chat',
    label: '캐릭터 대화 발자취',
    emoji: '📈',
    color: 'rgba(45,212,191,',
    ids: ['char_10k', 'char_100k', 'char_500k', 'platinum', 'char_10m', '100m_zeta'],
    thresholds: ['1만', '10만', '50만', '100만', '1천만', '1억'],
  },
  {
    key: 'streak',
    label: '연속 제작 발자취',
    emoji: '🔥',
    color: 'rgba(249,115,22,',
    ids: ['streak_3', 'streak_7', 'streak_14'],
    thresholds: ['3일', '7일', '14일'],
  },
  {
    key: 'daily',
    label: '하루 제작 발자취',
    emoji: '📅',
    color: 'rgba(6,182,212,',
    ids: ['daily_2', 'daily_4', 'daily_6'],
    thresholds: ['2개', '4개', '6개'],
  },
];

const MILESTONE_ID_SET = new Set(MILESTONE_GROUPS.flatMap(g => g.ids));

const COLOR_MAP = {
  pink:    { bg: 'rgba(236,72,153,',  border: 'rgba(236,72,153,',  text: '#f472b6' },
  red:     { bg: 'rgba(239,68,68,',   border: 'rgba(239,68,68,',   text: '#f87171' },
  blue:    { bg: 'rgba(59,130,246,',  border: 'rgba(59,130,246,',  text: '#60a5fa' },
  emerald: { bg: 'rgba(16,185,129,',  border: 'rgba(16,185,129,',  text: '#6ee7b7' },
  yellow:  { bg: 'rgba(234,179,8,',   border: 'rgba(234,179,8,',   text: '#fde68a' },
  amber:   { bg: 'rgba(245,158,11,',  border: 'rgba(245,158,11,',  text: '#fbbf24' },
  cyan:    { bg: 'rgba(6,182,212,',   border: 'rgba(6,182,212,',   text: '#22d3ee' },
  violet:  { bg: 'rgba(139,92,246,',  border: 'rgba(139,92,246,',  text: '#a78bfa' },
  indigo:  { bg: 'rgba(99,102,241,',  border: 'rgba(99,102,241,',  text: '#818cf8' },
  purple:  { bg: 'rgba(168,85,247,',  border: 'rgba(168,85,247,',  text: '#c084fc' },
  slate:   { bg: 'rgba(100,116,139,', border: 'rgba(100,116,139,', text: '#94a3b8' },
  teal:    { bg: 'rgba(20,184,166,',  border: 'rgba(20,184,166,',  text: '#2dd4bf' },
  orange:  { bg: 'rgba(249,115,22,',  border: 'rgba(249,115,22,',  text: '#fb923c' },
  sky:     { bg: 'rgba(14,165,233,',  border: 'rgba(14,165,233,',  text: '#38bdf8' },
  rose:    { bg: 'rgba(244,63,94,',   border: 'rgba(244,63,94,',   text: '#fb7185' },
  lime:    { bg: 'rgba(132,204,22,',  border: 'rgba(132,204,22,',  text: '#a3e635' },
  gradient:{ bg: 'rgba(167,139,250,', border: 'rgba(167,139,250,', text: '#a78bfa' },
};

// ===== ① 달성률 헤더 =====
function ProgressHeader({ earned, total }) {
  const pct = total > 0 ? Math.round((earned / total) * 100) : 0;
  return (
    <div className="glass-card-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-[var(--text-primary)]">칭호 달성률</span>
        <span className="text-xs font-mono text-[var(--accent)] font-bold">{earned} / {total}</span>
      </div>
      <div className="w-full h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[var(--accent)] to-indigo-400 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-[var(--text-tertiary)] mt-1.5 font-medium">
        {earned === total && total > 0 ? '🎉 모든 칭호 달성!' : `${total - earned}개 더 획득 가능`}
      </p>
    </div>
  );
}

// ===== ③ 발자취 계열 카드 — 노드-라인 트랙 =====
function MilestoneGroupCard({ group, titleMap }) {
  const steps = group.ids.map((id, i) => ({
    id,
    badge: titleMap[id],
    threshold: group.thresholds[i],
    earned: titleMap[id]?.earned ?? false,
  }));
  const c = group.color; // e.g. 'rgba(96,165,250,'
  const toRgb = (rgba) => rgba.replace('rgba(', 'rgb(').replace(/,$/, ')');
  const colorSolid = toRgb(c);

  return (
    <div
      className="rounded-xl overflow-hidden mb-2"
      style={{ background: `${c}0.06)`, border: `1px solid ${c}0.20)` }}
    >
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: `1px solid ${c}0.12)` }}>
        <span className="text-sm">{group.emoji}</span>
        <span className="text-[11px] font-bold" style={{ color: colorSolid }}>
          {group.label}
        </span>
      </div>

      {/* 노드-라인 트랙 */}
      <div className="px-3 py-3 flex items-start gap-0">
        {steps.map((s, i) => (
          <React.Fragment key={s.id}>
            {/* 노드 */}
            <div className="flex flex-col items-center gap-1.5" style={{ minWidth: 0, flex: 1 }}>
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black shrink-0"
                style={s.earned
                  ? { background: colorSolid, color: '#fff', boxShadow: `0 0 6px ${c}0.6)` }
                  : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.25)' }
                }
              >
                {s.earned ? '✓' : i + 1}
              </div>
              <span
                className="text-[9px] text-center leading-tight px-0.5 truncate w-full"
                style={{ color: s.earned ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.28)' }}
              >
                {s.threshold}
              </span>
            </div>

            {/* 라인 (마지막 노드 뒤엔 없음) */}
            {i < steps.length - 1 && (
              <div
                className="h-[2px] mt-[9px] rounded-full shrink-0"
                style={{
                  flex: 0.4,
                  minWidth: 8,
                  background: s.earned ? colorSolid : 'rgba(255,255,255,0.06)',
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ===== ⑤ 다음 목표 프리뷰 =====
function NextGoalPreview({ titles }) {
  const near = useMemo(() => {
    return titles
      .filter(t => !t.earned && t.progress?.max > 0)
      .map(t => ({ ...t, ratio: t.progress.current / t.progress.max }))
      .sort((a, b) => b.ratio - a.ratio)[0];
  }, [titles]);

  if (!near) return null;

  return (
    <div className="glass-card-sm p-3">
      <p className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <TrendingUp size={11} /> 다음 목표
      </p>
      <div className="flex items-center gap-3">
        <span className="text-lg shrink-0 grayscale opacity-60">{near.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[12px] font-bold text-white/70">{near.title}</span>
            <span className="text-[10px] text-[var(--accent)] font-mono shrink-0 ml-2">
              {Math.round(near.ratio * 100)}%
            </span>
          </div>
          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.round(near.ratio * 100)}%`,
                background: 'linear-gradient(to right, var(--accent), var(--accent-bright))',
                transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
              }}
            />
          </div>
          <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
            {near.progress.label}: {near.progress.current.toLocaleString()} / {near.progress.max.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

// ===== ⑥ 미획득 아코디언 =====
function UnearnedAccordion({ titles, colorMap }) {
  const [open, setOpen] = useState(false);
  const unearned = titles.filter(t => !t.earned);
  const preview = unearned.slice(0, 3).map(t => t.emoji);

  if (unearned.length === 0) return null;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-sm">🔒</span>
        <span className="text-[12px] text-[var(--text-tertiary)]">미획득 칭호 {unearned.length}개</span>
        <div className="ml-auto flex items-center gap-1">
          {preview.map((e, i) => (
            <span key={i} className="text-sm grayscale opacity-40">{e}</span>
          ))}
          <span className="ml-1 text-[var(--text-tertiary)]">
            {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </span>
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {unearned.map(t => {
            const c = colorMap[t.color] || colorMap.slate;
            return (
              <div key={t.id} className="flex items-start gap-2 p-2.5 rounded-lg opacity-50"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-lg shrink-0 grayscale">{t.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-bold text-white/40">{t.title}</div>
                  <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{t.desc}</div>
                  {t.progress && (
                    <div className="mt-1.5">
                      <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[var(--accent)] opacity-50"
                          style={{ width: `${Math.min(100, (t.progress.current / t.progress.max) * 100)}%` }} />
                      </div>
                      <p className="text-[9px] text-white/25 mt-0.5">
                        {t.progress.current.toLocaleString()} / {t.progress.max.toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===== 메인 AchievementsTab =====
export default function AchievementsTab({ stats, characters }) {
  const titles = useMemo(
    () => computeEarnedTitles({ characters, stats }),
    [characters, stats]
  );

  const earned = useMemo(() => titles.filter(t => t.earned), [titles]);

  const titleMap = useMemo(() =>
    Object.fromEntries(titles.map(t => [t.id, t])),
    [titles]
  );

  // 획득 배지: 발자취·태그 제외
  const otherEarned = useMemo(() =>
    earned.filter(t => !MILESTONE_ID_SET.has(t.id) && t.category !== 'tag'),
    [earned]
  );

  // 태그 업적 배지
  const tagEarned = useMemo(() =>
    earned.filter(t => !MILESTONE_ID_SET.has(t.id) && t.category === 'tag'),
    [earned]
  );

  return (
    <div className="space-y-4 pb-8">
      {/* ① 달성률 헤더 */}
      <ProgressHeader earned={earned.length} total={titles.length} />

      {/* ③ 발자취 계열 카드 */}
      <div className="space-y-2">
        {MILESTONE_GROUPS.map(g => (
          <MilestoneGroupCard key={g.key} group={g} titleMap={titleMap} />
        ))}
      </div>

      {/* ④ 획득한 칭호 (발자취·태그 제외) */}
      {otherEarned.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-2 px-1">
            획득한 칭호
          </p>
          <div className="grid grid-cols-2 gap-2">
            {otherEarned.map(b => {
              const c = COLOR_MAP[b.color] || COLOR_MAP.slate;
              return (
                <div key={b.id}
                  className="flex items-center gap-2.5 p-3 rounded-xl"
                  style={{ background: `${c.bg}0.15)`, border: `1px solid ${c.border}0.3)` }}
                >
                  <span className="text-xl shrink-0"
                    style={{ filter: `drop-shadow(0 0 4px ${c.border}0.5))` }}>
                    {b.emoji}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold truncate" style={{ color: c.text }}>{b.title}</div>
                    <div className="text-[11px] text-[var(--text-tertiary)] truncate">{b.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ④-b 태그 칭호 */}
      {tagEarned.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-2 px-1">
            태그 칭호
          </p>
          <div className="grid grid-cols-2 gap-2">
            {tagEarned.map(b => {
              const c = COLOR_MAP[b.color] || COLOR_MAP.slate;
              const isNtr = b.id === 'ntr';
              return (
                <div key={b.id}
                  className={`relative flex items-center gap-2.5 p-3 rounded-xl overflow-hidden${isNtr ? ' group' : ''}`}
                  style={{ background: `${c.bg}0.15)`, border: `1px solid ${c.border}0.3)` }}
                >
                  <span className="text-xl shrink-0"
                    style={{ filter: `drop-shadow(0 0 4px ${c.border}0.5))` }}>
                    {b.emoji}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold truncate" style={{ color: c.text }}>{b.title}</div>
                    <div className="text-[11px] text-[var(--text-tertiary)] truncate">{b.desc}</div>
                  </div>
                  {isNtr && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ background: 'rgba(185,28,28,0.82)' }}>
                      <span className="text-[12px] text-white text-center px-2 leading-snug">
                        순애기사가 당신을<br />기억할 것입니다
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ⑤ 다음 목표 */}
      <NextGoalPreview titles={titles} />

      {/* ⑥ 미획득 아코디언 */}
      <UnearnedAccordion titles={titles} colorMap={COLOR_MAP} />
    </div>
  );
}
