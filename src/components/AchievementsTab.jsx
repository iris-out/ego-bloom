import React, { useMemo } from 'react';
import { computeEarnedTitles } from '../data/badges';

// B2 에디토리얼: 카테고리 섹션 + 한 줄 한 칭호
const CATEGORIES = [
  { key: 'interaction',      emoji: '💬', label: '총 대화량' },
  { key: 'char_interaction', emoji: '📈', label: '단일 캐릭터' },
  { key: 'follower',         emoji: '👥', label: '팔로워' },
  { key: 'creation',         emoji: '🔥', label: '제작 이력' },
  { key: 'tag',              emoji: '🏷️', label: '태그' },
  { key: 'activity',         emoji: '📅', label: '활동 기간' },
];

export default function AchievementsTab({ stats, characters }) {
  const titles = useMemo(
    () => computeEarnedTitles({ characters, stats }),
    [characters, stats]
  );

  const earnedCount = useMemo(() => titles.filter(t => t.earned).length, [titles]);
  const totalCount = titles.length;
  const pct = totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0;

  // 카테고리별 분류 + 내부에서 earned-first 정렬 (stable)
  const grouped = useMemo(() => {
    const map = {};
    for (const cat of CATEGORIES) map[cat.key] = [];
    for (const t of titles) {
      if (map[t.category]) map[t.category].push(t);
    }
    // stable sort: earned 먼저, 그 뒤 locked (기존 순서 유지)
    for (const key of Object.keys(map)) {
      const earned = map[key].filter(t => t.earned);
      const locked = map[key].filter(t => !t.earned);
      map[key] = [...earned, ...locked];
    }
    return map;
  }, [titles]);

  return (
    <div className="pb-8">
      {/* ===== 상단 스트립 (b2-stats) ===== */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          padding: '16px 0 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          marginBottom: 24,
        }}
      >
        {/* 달성 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.45)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              fontWeight: 500,
            }}
          >
            달성
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <span
              style={{
                fontFamily: "'Toss Product Sans', 'Pretendard Variable', system-ui, sans-serif",
                fontSize: 22,
                fontWeight: 700,
                color: '#fff',
                lineHeight: 1,
              }}
            >
              {earnedCount}
            </span>
            <span
              style={{
                fontSize: 14,
                color: 'rgba(255,255,255,0.45)',
                fontWeight: 500,
              }}
            >
              /{totalCount}
            </span>
          </div>
        </div>

        {/* 최근 획득 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.45)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              fontWeight: 500,
            }}
          >
            최근 획득
          </span>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#fff', lineHeight: 1 }}>
            —
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div
            style={{
              width: '100%',
              height: 4,
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                background: 'var(--accent)',
                borderRadius: 4,
                transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
              }}
            />
          </div>
          <span
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.45)',
              textAlign: 'right',
            }}
          >
            {pct}% 진행
          </span>
        </div>
      </div>

      {/* ===== 카테고리 섹션들 ===== */}
      {CATEGORIES.map(cat => {
        const items = grouped[cat.key] || [];
        if (items.length === 0) return null;
        const earnedInCat = items.filter(t => t.earned).length;
        const totalInCat = items.length;

        return (
          <section key={cat.key} style={{ marginBottom: 32 }}>
            {/* 헤더 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 12,
                paddingBottom: 10,
                marginBottom: 8,
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>{cat.emoji}</span>
              <span
                style={{
                  fontFamily: "'Times New Roman', serif",
                  fontSize: 22,
                  letterSpacing: '-0.02em',
                  color: '#fff',
                  lineHeight: 1.1,
                }}
              >
                {cat.label}
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.45)',
                  letterSpacing: '0.1em',
                }}
              >
                {earnedInCat} 중 {totalInCat} 달성
              </span>
            </div>

            {/* 리스트 */}
            <div className="b2-list">
              {items.map(item => {
                const isNtr = item.id === 'ntr';
                const locked = !item.earned;
                return (
                  <div
                    key={item.id}
                    className={isNtr ? 'b2-item group' : 'b2-item'}
                    style={{
                      position: 'relative',
                      display: 'grid',
                      gridTemplateColumns: '40px 1fr auto',
                      gap: 14,
                      alignItems: 'center',
                      padding: '12px 4px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      opacity: locked ? 0.35 : 1,
                      overflow: isNtr ? 'hidden' : 'visible',
                      borderRadius: isNtr ? 4 : 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 22,
                        textAlign: 'center',
                        lineHeight: 1,
                      }}
                    >
                      {item.emoji}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: locked ? 'rgba(255,255,255,0.45)' : '#fff',
                          lineHeight: 1.2,
                          whiteSpace: 'normal',
                        }}
                      >
                        {item.title}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'rgba(255,255,255,0.65)',
                          marginTop: 3,
                          lineHeight: 1.45,
                          whiteSpace: 'normal',
                        }}
                      >
                        {item.desc}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        letterSpacing: '0.12em',
                        whiteSpace: 'nowrap',
                        color: item.earned
                          ? 'var(--accent-bright)'
                          : 'rgba(255,255,255,0.35)',
                      }}
                    >
                      {item.earned ? '달성' : '미달성'}
                    </span>

                    {/* NTR 이스터에그 오버레이 */}
                    {isNtr && (
                      <div
                        className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        style={{ background: 'rgba(185,28,28,0.82)' }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            color: '#fff',
                            textAlign: 'center',
                            padding: '0 8px',
                            lineHeight: 1.35,
                          }}
                        >
                          순애기사가 당신을
                          <br />
                          기억할 것입니다
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* b2-list responsive grid (Tailwind 4 없이 인라인 style로 처리 불가한 미디어쿼리는 <style>로) */}
      <style>{`
        .b2-list {
          display: grid;
          grid-template-columns: 1fr;
          column-gap: 32px;
          row-gap: 0;
        }
        @media (min-width: 640px) {
          .b2-list {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </div>
  );
}
