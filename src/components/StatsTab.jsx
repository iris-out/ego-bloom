import React, { useMemo, useState } from 'react';
import { formatCompactNumber } from '../utils/tierCalculator';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

const GENRE_BUCKETS = [
  {
    label: '로맨스',
    desc: '순애·연애·짝사랑·소꿉친구·첫사랑 등 연애·감정 서사 중심',
    tags: [
      '로맨스', '순애', '연애', '짝사랑', '소꿉친구', '연상', '연하', '고백', '첫사랑',
      '남친', '여사친', '동갑', '동거', '결혼', '재회', '삼각관계', '친구같은연애',
      '동갑남친', '로판', '유저바라기', '다정',
    ],
  },
  {
    label: 'BL/GL',
    desc: '보이즈러브·백합·여성향 등 동성 커플링 태그',
    tags: ['bl', 'BL', 'gl', 'GL', 'bl가능', '다공일수', '동성', '보이즈러브', '백합', '여성향'],
  },
  {
    label: '다크/피폐',
    desc: '집착·흑화·복수·피폐·혐관 등 어두운 서사·갈등 중심',
    tags: [
      '집착', '혐관', '피폐', '소유욕', '후회', '배신', '바람', '쓰레기', '양아치',
      '느와르', '흑화', '복수', '조직', '구원', '공포', '트라우마', '비련', '무리',
    ],
  },
  {
    label: '현대/학교',
    desc: '학교·직장·재벌·일진 등 현실 배경 기반 설정',
    tags: [
      '대학생', '학교', '일상', '일진', '일진녀', '재벌', '현대', '고등학생', '아저씨',
      '직장', '가족', '선후배', '학원', '대학교', '현대판타지',
    ],
  },
  {
    label: '판타지',
    desc: '이세계·마법·무협·SF 등 비현실·장르 판타지 배경',
    tags: [
      '판타지', 'sf', '이세계', '마법', '마왕', '용사', '드래곤', '요괴', '신화',
      '마녀', '악마', '슈퍼히어로', '무협', '기사', '용병',
    ],
  },
  {
    label: '성격형',
    desc: '츤데레·얀데레·무뚝뚝·능글맞음 등 캐릭터 성격·태도 묘사',
    tags: [
      '무뚝뚝', '츤데레', '철벽', '차가움', '오지콤', '능글', '여우', '싸가지',
      '존잘', '존예', '까칠', '다정', '쿨한', '얀데레',
    ],
  },
];

function StatCard({ label, value, sub }) {
  return (
    <div className="glass-card-sm p-4">
      <div className="text-[10px] sm:text-xs text-[var(--text-tertiary)] uppercase tracking-wider mb-1">{label}</div>
      <div className="text-base sm:text-lg font-bold text-[var(--text-primary)] truncate">{value}</div>
      {sub && <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{sub}</div>}
    </div>
  );
}

export default function StatsTab({ stats, characters }) {
  const [showGenreHelp, setShowGenreHelp] = useState(false);

  // ── 심화 수치 3종 ──────────────────────────────────────
  const advanced = useMemo(() => {
    if (!stats || !characters || characters.length === 0) return null;
    const unlimitedCount = characters.filter(c => c.unlimitedAllowed).length;
    const freedomRatio = (unlimitedCount / characters.length) * 100;
    const followers = stats.followerCount || 0;
    const loyaltyRatio = followers / characters.length;
    const totalInteractions = stats.plotInteractionCount || 0;
    let blockbusterRatio = 0;
    if (totalInteractions > 0) {
      const sorted = [...characters].sort((a, b) => (b.interactionCount || 0) - (a.interactionCount || 0));
      const top2 = (sorted[0]?.interactionCount || 0) + (sorted[1]?.interactionCount || 0);
      blockbusterRatio = (top2 / totalInteractions) * 100;
    }
    return { freedomRatio, loyaltyRatio, blockbusterRatio };
  }, [stats, characters]);

  // ── 해시태그 다양성 레이더 ────────────────────────────
  const hashtagRadarData = useMemo(() => {
    if (!characters?.length) return [];
    const total = characters.length;
    const bucketEntry = ({ label, tags }) => {
      const tagSet = new Set(tags.map(t => t.toLowerCase()));
      const cnt = characters.filter(c =>
        (c.hashtags || c.tags || []).some(h => tagSet.has(String(h).toLowerCase()))
      ).length;
      return { subject: label, value: Math.round((cnt / total) * 100), count: cnt };
    };
    const base = GENRE_BUCKETS.map(bucketEntry);
    const ntr = bucketEntry({ label: 'NTR', tags: ['빼앗김', '뺏김', '뺏기'] });
    return ntr.count > 0 ? [...base, ntr] : base;
  }, [characters]);

  // ── 태그별 평균 대화량 (상위 10개 태그) ─────────────────
  const tagAvgData = useMemo(() => {
    if (!characters?.length) return [];
    const tagMap = {};
    characters.forEach(c => {
      const interactions = c.interactionCount || 0;
      (c.hashtags || c.tags || []).forEach(tag => {
        const t = String(tag).trim();
        if (!t) return;
        if (!tagMap[t]) tagMap[t] = { total: 0, count: 0 };
        tagMap[t].total += interactions;
        tagMap[t].count += 1;
      });
    });
    const entries = Object.entries(tagMap)
      .map(([tag, { total, count }]) => ({ tag, avg: Math.round(total / count), count }))
      .filter(e => e.count >= 2)
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 10);
    const maxAvg = Math.max(1, ...entries.map(e => e.avg));
    return entries.map(e => ({ ...e, pct: (e.avg / maxAvg) * 100 }));
  }, [characters]);

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* 심화 수치 3종 */}
      {advanced && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            label="매혹도"
            value={advanced.loyaltyRatio.toFixed(1)}
            sub="캐릭터 1개당 유입되는 팔로워 수"
          />
          <StatCard
            label="언리밋 비율"
            value={`${advanced.freedomRatio.toFixed(1)}%`}
            sub="무제한 대화 허용 캐릭터 비율"
          />
          <StatCard
            label="히트 쏠림도"
            value={`${advanced.blockbusterRatio.toFixed(1)}%`}
            sub="상위 2개 캐릭터의 대화량 지분"
          />
        </div>
      )}

      {/* 해시태그 다양성 레이더 */}
      {hashtagRadarData.length > 0 && (
        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)]">해시태그 다양성</h3>
            <button
              onClick={() => setShowGenreHelp(v => !v)}
              className="w-4 h-4 rounded-full border border-[var(--text-tertiary)] flex items-center justify-center text-[9px] font-bold text-[var(--text-tertiary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors shrink-0"
              aria-label="장르 분류 설명"
            >?</button>
          </div>
          <p className="text-[10px] text-[var(--text-tertiary)] mb-3">장르별 캐릭터 보유 비중 (%)</p>
          {showGenreHelp && (
            <div className="mb-3 p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--c-glass-border)] space-y-2">
              {GENRE_BUCKETS.map(b => (
                <div key={b.label} className="flex gap-2 text-[10px] leading-relaxed">
                  <span className="font-bold text-[var(--accent)] shrink-0 w-[52px]">{b.label}</span>
                  <span className="text-[var(--text-tertiary)]">{b.desc}</span>
                </div>
              ))}
              <div className="flex gap-2 text-[10px] leading-relaxed">
                <span className="font-bold text-[var(--accent)] shrink-0 w-[52px]">NTR</span>
                <span className="text-[var(--text-tertiary)]">빼앗김·뺏기 등 NTR 관련 태그 (해당 태그 보유 시만 표시)</span>
              </div>
            </div>
          )}
          <div className="w-full h-[200px] sm:h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="65%" data={hashtagRadarData}>
                <PolarGrid stroke="var(--c-glass-border)" strokeDasharray="3 3" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: 'var(--c-text-secondary)', fontSize: 10, fontWeight: 700 }}
                />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const { subject, value, count } = payload[0].payload;
                    return (
                      <div className="bg-[var(--c-glass-bg)] border border-[var(--c-glass-border)] p-2.5 rounded-lg text-xs backdrop-blur-sm">
                        <div className="font-bold text-[var(--accent)] mb-0.5">{subject}</div>
                        <div className="text-[var(--c-text-primary)] font-mono">{value}% <span className="text-[var(--c-text-tertiary)] font-sans">({count}개)</span></div>
                      </div>
                    );
                  }}
                />
                <Radar dataKey="value" stroke="#a855f7" strokeWidth={2} fill="#a855f7" fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 태그별 평균 대화량 */}
      {tagAvgData.length > 0 && (
        <div className="glass-card-sm p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">태그별 평균 대화량</h3>
          <div className="space-y-2">
            {tagAvgData.map(({ tag, avg, pct }) => (
              <div key={tag} className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--text-secondary)] w-[90px] text-right shrink-0 truncate">#{tag}</span>
                <div className="flex-1 h-4 bg-[var(--bg-secondary)] rounded-sm overflow-hidden">
                  <div className="h-full rounded-sm transition-all duration-700"
                    style={{ width: `${pct}%`, background: 'var(--accent)', opacity: 0.7 }} />
                </div>
                <span className="text-[10px] font-mono text-[var(--text-tertiary)] w-14 text-right shrink-0">
                  {formatCompactNumber(avg)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[var(--text-tertiary)] mt-3">2개 이상 보유한 태그만 표시 · 태그 보유 캐릭터 기준 평균</p>
        </div>
      )}
    </div>
  );
}
