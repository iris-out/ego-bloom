import { useMemo } from 'react';
import { formatNumber, getCharacterTier, toKST } from '../utils/tierCalculator';
import { proxyThumbnailUrl } from '../utils/imageUtils';
import { useRankingData } from '../hooks/useRankingData';
import ContributionGraph from './ContributionGraph';
import CreatorRadarChart from './CreatorRadarChart';
import { TagChips } from './ExtraCharts';
import CharCard from './ui/CharCard';

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
      { label: '총 대화량', value: formatNumber(total), unit: '회', sub: null },
      { label: '평균 캐릭터 대화', value: formatNumber(avg), unit: '회', sub: `${charCount}개 캐릭터 기준` },
      { label: '최고 대화 캐릭터', value: formatNumber(top?.interactionCount || 0), unit: '회', sub: top?.name || null },
      { label: '음성 재생', value: formatNumber(stats.voicePlayCount || 0), unit: stats.voicePlayUnit || '회', sub: null },
    ];
  }, [stats, characters]);

  if (items.length === 0) return null;

  return (
    <div className="eb-tile mb-4">
      <p className="t-label mb-3" style={{ color: 'var(--fg-2)' }}>주요 지표</p>
      {items.map((item, i) => (
        <div
          key={item.label}
          className="eb-row flex justify-between items-center py-2.5"
          style={{ borderBottom: i < items.length - 1 ? 'var(--border-w) solid var(--line)' : 'none' }}
        >
          <span className="t-body" style={{ color: 'var(--fg-2)' }}>{item.label}</span>
          <div className="text-right">
            <span className="t-figure">
              {item.value}
              <span style={{ fontSize: '0.62em', fontWeight: 600, color: 'var(--fg-2)' }}>{item.unit}</span>
            </span>
            {item.sub && <p className="t-small mt-0.5" style={{ color: 'var(--fg-3)' }}>{item.sub}</p>}
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
    <div className="eb-tile">
      <p className="t-label mb-3" style={{ color: 'var(--fg-2)' }}>장르 분포</p>
      <div className="space-y-3">
        {visible.map(item => {
          const pct = Math.round((item.count / max) * 100);
          return (
            <div key={item.subject}>
              <div className="flex justify-between items-center mb-1.5">
                <span className="t-small" style={{ color: 'var(--fg-2)' }}>{item.subject}</span>
                <span className="t-small" style={{ fontWeight: 700 }}>{item.count}개</span>
              </div>
              <div className="h-[10px]" style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-pill)' }}>
                <div className="h-full" style={{ width: `${pct}%`, background: 'var(--accent)', borderRadius: 'var(--radius-pill)' }} />
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
      desc: '무제한 대화 허용 캐릭터 비율',
    },
    {
      label: '매혹도',
      value: advanced.loyaltyRatio.toFixed(1),
      pct: Math.min(100, (advanced.loyaltyRatio / 200) * 100),
      desc: '팔로워 1인당 대화 수',
    },
    {
      label: '히트 쏠림도',
      value: `${advanced.blockbusterRatio.toFixed(1)}%`,
      pct: Math.min(100, advanced.blockbusterRatio),
      desc: '상위 2개 캐릭터 대화량 지분',
    },
  ];
  return (
    <div className="mb-4">
      <p className="t-label mb-2" style={{ color: 'var(--fg-2)' }}>심화 지표</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {items.map(item => (
          <div key={item.label} className="eb-tile">
            <p className="t-small" style={{ color: 'var(--fg-2)' }}>{item.label}</p>
            <p className="t-h2 mt-1 mb-2">{item.value}</p>
            <div className="h-[6px]" style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius-pill)' }}>
              <div className="h-full" style={{ width: `${item.pct}%`, background: 'var(--accent)', borderRadius: 'var(--radius-pill)' }} />
            </div>
            <p className="t-small mt-2" style={{ color: 'var(--fg-3)' }}>{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StatsTab({ stats, characters }) {
  const { data: rankingData } = useRankingData();
  const rankingUpdatedAt = rankingData?.updatedAt ? toKST(rankingData.updatedAt) : null;

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
    <div>
      <div className="mb-4"><ContributionGraph characters={characters} /></div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="eb-tile flex flex-col items-center">
          <p className="t-label self-start mb-2" style={{ color: 'var(--fg-2)' }}>크리에이터 분석</p>
          <CreatorRadarChart stats={stats} characters={characters} />
        </div>
        <GenreBarCard data={hashtagRadarData} />
      </div>

      <StatRowCard stats={stats} characters={characters} />
      <AdvancedGaugeCard advanced={advanced} />

      {rankedChars.length > 0 && (
        <div className="eb-tile mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="t-label" style={{ color: 'var(--fg-2)' }}>글로벌 랭킹</p>
            {rankingUpdatedAt && (
              <span className="t-small" style={{ color: 'var(--fg-3)' }}>
                {rankingUpdatedAt.getMonth() + 1}/{rankingUpdatedAt.getDate()} 업데이트
              </span>
            )}
          </div>
          <div>
            {rankedChars.map(char => {
              const tier = getCharacterTier(char.interactionCount || 0);
              const medalVar = char.globalRank === 1 ? '--t-gold' : char.globalRank === 2 ? '--t-silver' : char.globalRank === 3 ? '--t-bronze' : null;
              const zetaUrl = `https://zeta-ai.io/ko/plots/${char.id}/profile`;
              return (
                <a
                  key={char.id}
                  href={zetaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="eb-row flex items-center gap-3 py-2 no-underline"
                >
                  <CharCard
                    size="mini"
                    name={char.name}
                    imageUrl={char.imageUrl ? proxyThumbnailUrl(char.imageUrl, 96) : null}
                    rarity={tier.key}
                    interactive={false}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="t-body truncate">{char.name}</p>
                    <p className="t-small" style={{ color: 'var(--fg-3)' }}>
                      {char.trendingRank ? '트렌딩' : char.bestRank ? '베스트' : '신작'}
                    </p>
                  </div>
                  <span className="t-figure shrink-0" style={{ color: medalVar ? `var(${medalVar})` : 'var(--fg-2)' }}>
                    #{char.globalRank}
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      <TagChips characters={characters} />
    </div>
  );
}
