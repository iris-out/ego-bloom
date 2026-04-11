import React, { useMemo, useEffect, useState } from 'react';
import { formatCompactNumber, formatNumber, toKST } from '../utils/tierCalculator';
import { proxyImageUrl } from '../utils/imageUtils';
import ContributionGraph from './ContributionGraph';
import CreatorRadarChart from './CreatorRadarChart';
import { WordCloud } from './ExtraCharts';

const GENRE_BUCKETS = [
  {
    label: '로맨스',
    tags: [
      '로맨스', '순애', '연애', '짝사랑', '소꿉친구', '연상', '연하', '고백', '첫사랑',
      '남친', '여사친', '동갑', '동거', '결혼', '재회', '삼각관계', '친구같은연애',
      '동갑남친', '로판', '유저바라기', '다정',
    ],
  },
  {
    label: 'BL/GL',
    tags: ['bl', 'BL', 'gl', 'GL', 'bl가능', '다공일수', '동성', '보이즈러브', '백합', '여성향'],
  },
  {
    label: '다크/피폐',
    tags: [
      '집착', '혐관', '피폐', '소유욕', '후회', '배신', '바람', '쓰레기', '양아치',
      '느와르', '흑화', '복수', '조직', '구원', '공포', '트라우마', '비련', '무리',
    ],
  },
  {
    label: '현대/학교',
    tags: [
      '대학생', '학교', '일상', '일진', '일진녀', '재벌', '현대', '고등학생', '아저씨',
      '직장', '가족', '선후배', '학원', '대학교', '현대판타지',
    ],
  },
  {
    label: '판타지',
    tags: [
      '판타지', 'sf', '이세계', '마법', '마왕', '용사', '드래곤', '요괴', '신화',
      '마녀', '악마', '슈퍼히어로', '무협', '기사', '용병',
    ],
  },
  {
    label: '성격형',
    tags: [
      '무뚝뚝', '츤데레', '철벽', '차가움', '오지콤', '능글', '여우', '싸가지',
      '존잘', '존예', '까칠', '다정', '쿨한', '얀데레',
    ],
  },
];

const GENRE_COLORS = {
  '로맨스':   '#ec4899',
  'BL/GL':    '#a78bfa',
  '다크/피폐': '#6366f1',
  '현대/학교': '#3b82f6',
  '판타지':   '#8b5cf6',
  '성격형':   '#14b8a6',
  'NTR':      '#ef4444',
};

function StatRowCard({ stats, characters }) {
  const items = useMemo(() => {
    if (!stats || !characters) return [];
    const total = stats.plotInteractionCount || 0;
    const charCount = characters.length;
    const avg = charCount > 0 ? Math.round(total / charCount) : 0;
    const top = charCount > 0
      ? [...characters].sort((a, b) => (b.interactionCount || 0) - (a.interactionCount || 0))[0]
      : null;
    return [
      { label: '총 대화량',        value: formatNumber(total),                             unit: '회', sub: null },
      { label: '평균 캐릭터 대화',  value: formatNumber(avg),                               unit: '회', sub: `${charCount}개 캐릭터 기준` },
      { label: '최고 대화 캐릭터',  value: formatCompactNumber(top?.interactionCount || 0), unit: '회', sub: top?.name || null },
      { label: '음성 재생',         value: formatNumber(stats.voicePlayCount || 0),         unit: stats.voicePlayUnit || '회', sub: null },
    ];
  }, [stats, characters]);

  return (
    <div
      className="rounded-2xl overflow-hidden mb-4"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-wider text-white/30 px-4 pt-3 pb-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        주요 지표
      </p>
      {items.map((item, i) => (
        <div
          key={item.label}
          className="flex justify-between items-center px-4 py-2.5"
          style={{ borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
        >
          <span className="text-[13px] text-white/50">{item.label}</span>
          <div className="text-right">
            <span className="text-[15px] font-bold text-white">
              {item.value}
              <span className="text-[11px] font-normal text-white/35 ml-1">{item.unit}</span>
            </span>
            {item.sub && <p className="text-[11px] text-white/30 mt-0.5">{item.sub}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function GenreBarCard({ data }) {
  if (!data || data.length === 0) return null;
  const visible = data.filter(d => d.count > 0);
  if (visible.length === 0) return null;
  const max = Math.max(1, ...visible.map(d => d.count));
  return (
    <div
      className="rounded-2xl overflow-hidden mb-4"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-wider text-white/30 px-4 pt-3 pb-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        장르 분포
      </p>
      <div className="px-4 py-2">
        {visible.map((item, i) => {
          const pct = Math.round((item.count / max) * 100);
          const color = GENRE_COLORS[item.subject] || '#a78bfa';
          return (
            <div
              key={item.subject}
              className="py-2"
              style={{ borderBottom: i < visible.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
            >
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[13px] text-white/50">{item.subject}</span>
                <span className="text-[13px] font-bold text-white">{item.count}개</span>
              </div>
              <div className="h-[5px] rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdvancedGaugeCard({ advanced }) {
  if (!advanced) return null;
  const items = [
    {
      label: '언리밋 비율',
      value: `${advanced.freedomRatio.toFixed(1)}%`,
      pct: Math.min(100, advanced.freedomRatio),
      color: '#34d399',
      desc: '무제한 대화 허용 캐릭터 비율',
    },
    {
      label: '매혹도',
      value: advanced.loyaltyRatio.toFixed(1),
      pct: Math.min(100, (advanced.loyaltyRatio / 200) * 100),
      color: '#60a5fa',
      desc: '팔로워 1인당 대화 수',
    },
    {
      label: '히트 쏠림도',
      value: `${advanced.blockbusterRatio.toFixed(1)}%`,
      pct: Math.min(100, advanced.blockbusterRatio),
      color: '#f59e0b',
      desc: '상위 2개 캐릭터 대화량 지분',
    },
  ];
  return (
    <div
      className="rounded-2xl overflow-hidden mb-4"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-wider text-white/30 px-4 pt-3 pb-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        심화 지표
      </p>
      <div className="px-4 py-2">
        {items.map((item, i) => (
          <div
            key={item.label}
            className="py-2.5"
            style={{ borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
          >
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="text-[13px] text-white/50">{item.label}</span>
              <span className="text-[15px] font-bold" style={{ color: item.color }}>{item.value}</span>
            </div>
            <div className="h-[6px] rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${item.pct}%`, background: item.color }}
              />
            </div>
            <p className="text-[11px] text-white/25 mt-1">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StatsTab({ stats, characters }) {
  const [rankingUpdatedAt, setRankingUpdatedAt] = useState(null);
  useEffect(() => {
    fetch('/data/ranking_latest.json')
      .then(res => res.json())
      .then(data => { if (data?.updatedAt) setRankingUpdatedAt(toKST(data.updatedAt)); })
      .catch(() => {});
  }, []);

  const rankedChars = useMemo(() =>
    (characters || [])
      .filter(c => c.trendingRank != null || c.bestRank != null || c.newRank != null)
      .sort((a, b) => {
        const ar = Math.min(...[a.trendingRank, a.bestRank, a.newRank].filter(x => x != null));
        const br = Math.min(...[b.trendingRank, b.bestRank, b.newRank].filter(x => x != null));
        return ar - br;
      })
  , [characters]);

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

  return (
    <div className="space-y-0">
      {/* 제작 히스토리 — 맨 위 */}
      <div className="mb-4"><ContributionGraph characters={characters} /></div>

      {/* 레이더 차트 */}
      <div
        className="rounded-2xl overflow-hidden mb-4 px-4 py-3"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mb-2">크리에이터 분석</p>
        <CreatorRadarChart stats={stats} characters={characters} />
      </div>

      <StatRowCard stats={stats} characters={characters} />
      <GenreBarCard data={hashtagRadarData} />
      <AdvancedGaugeCard advanced={advanced} />


      {rankedChars.length > 0 && (
        <div
          className="rounded-2xl overflow-hidden mb-4"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div
            className="flex items-center justify-between px-4 pt-3 pb-2"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">글로벌 랭킹</p>
            {rankingUpdatedAt && (
              <span className="text-[10px] text-white/25">
                {rankingUpdatedAt.getMonth() + 1}/{rankingUpdatedAt.getDate()} 업데이트
              </span>
            )}
          </div>
          {rankedChars.map((char, idx) => {
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
            const rankColor = idx === 0 ? '#fbbf24' : idx === 1 ? '#e2e8f0' : idx === 2 ? '#fb923c' : '#a78bfa';
            return (
              <a
                key={char.id}
                href={`https://zeta-ai.io/ko/plots/${char.id}/profile`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]"
                style={{ borderBottom: idx < rankedChars.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
              >
                <div className="w-6 text-center shrink-0">
                  {medal
                    ? <span className="text-sm">{medal}</span>
                    : <span className="text-[11px] font-black" style={{ color: rankColor }}>#{idx + 1}</span>
                  }
                </div>
                {char.imageUrl && (
                  <img
                    src={proxyImageUrl(char.imageUrl)}
                    alt={char.name}
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                    style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-white truncate">{char.name}</p>
                  <p className="text-[11px] text-white/35">
                    {char.trendingRank ? '트렌딩' : char.bestRank ? '베스트' : '신작'}
                  </p>
                </div>
                <span className="text-[15px] font-bold shrink-0" style={{ color: rankColor }}>
                  #{char.globalRank}
                </span>
              </a>
            );
          })}
        </div>
      )}

      <div className="mt-4"><WordCloud characters={characters} /></div>
    </div>
  );
}
