import React, { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { CREATOR_TIERS, getCreatorTier, formatEloScore } from '../utils/tierCalculator';
import { getCreatorTierMeta } from '../design/tiers';
import TierMark from '../components/ui/TierMark';
import { useCreatorRankings } from '../hooks/useCreatorRankings';
import { proxyThumbnailUrl } from '../utils/imageUtils';

// 챔피언부터 위에서 아래로 (unranked 제외, 역순)
const displayTiers = [...CREATOR_TIERS].filter(t => t.key !== 'unranked').reverse();

const DIVISION_LABELS = ['IV', 'III', 'II', 'I'];

const ELO_FORMULA_ROWS = [
  { label: '총 대화수', weight: '× 3.0' },
  { label: '팔로워', weight: '× 300.0' },
  { label: '상위 20개 캐릭터 대화수 합계', weight: '× 0.5' },
  { label: '평균 대화수', weight: '× 20.0' },
  { label: '음성 재생수', weight: '× 100.0' },
];

/** tier.min 부터 next.min 까지를 4등분해 IV~I 구간의 시작 임계값을 만든다. */
function divisionThresholds(tier, nextTier) {
  if (!nextTier) return null;
  const range = nextTier.min - tier.min;
  return DIVISION_LABELS.map((label, i) => ({
    label,
    threshold: tier.min + range * (i / 4),
  }));
}

export default function TierPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const handleQuery = (searchParams.get('creator') || '').trim().toLowerCase();

  // 크리에이터 ELO 랭킹의 실제 소스는 /api/get-rankings 다 (ranking_latest.json 에는
  // 크리에이터 ELO 랭킹이 없다). useCreatorRankings 가 이 fetch 를 캐시와 함께 담당한다.
  const { data: rankingData } = useCreatorRankings();

  const currentUser = useMemo(() => {
    if (!handleQuery || !rankingData) return null;
    const list = Array.isArray(rankingData)
      ? rankingData
      : (rankingData.rankings || rankingData.creators || rankingData.top || []);
    if (!Array.isArray(list)) return null;

    const match = list.find(row => {
      const h = (row.handle || row.creatorHandle || '').toString().toLowerCase();
      return h === handleQuery;
    });
    if (!match) return null;

    const elo = match.elo_score ?? match.eloScore ?? match.elo ?? 0;
    return {
      handle: match.handle || match.creatorHandle || handleQuery,
      nickname: match.nickname || match.creatorNickname || match.handle || handleQuery,
      elo,
      avatarUrl: match.profile_image_url || match.profileImageUrl || match.creatorImageUrl || null,
    };
  }, [handleQuery, rankingData]);

  // 현재 티어 계산
  const tierInfo = currentUser ? getCreatorTier(currentUser.elo) : null;
  const currentMeta = tierInfo ? getCreatorTierMeta(tierInfo.key) : null;

  // 다음 상위 티어 찾기 (CREATOR_TIERS에서 현재보다 min이 큰 것 중 가장 작은 것)
  let nextTier = null;
  if (tierInfo) {
    const higher = CREATOR_TIERS
      .filter(t => t.key !== 'unranked' && t.min > tierInfo.min)
      .sort((a, b) => a.min - b.min);
    if (higher.length > 0) {
      const nt = higher[0];
      const meta = getCreatorTierMeta(nt.key);
      nextTier = { key: nt.key, min: nt.min, name_kr: meta?.ko || nt.name };
    }
  }

  const heroAvatarSrc = currentUser?.avatarUrl
    ? (proxyThumbnailUrl(currentUser.avatarUrl, 192) || currentUser.avatarUrl)
    : null;

  return (
    <div className="bg-bg min-h-[100dvh]">
      <header className="flex items-center gap-3 px-5 py-4 border-b border-line max-w-[680px] mx-auto lg:max-w-[900px] lg:px-10">
        <button
          onClick={() => navigate('/')}
          className="eb-btn eb-btn-secondary"
          aria-label="홈으로 돌아가기"
        >
          <ChevronLeft size={16} />
          홈
        </button>
        <span className="t-h3 text-fg">티어 가이드</span>
      </header>

      <main className="max-w-[680px] mx-auto px-5 py-6 lg:max-w-[900px] lg:px-10">
        {/* ===== 현재 유저 ===== */}
        {currentUser && currentMeta && (
          <section className="eb-tile flex items-center gap-5 mb-6">
            <TierMark tier={currentMeta.key} division={tierInfo.subdivision} size={64} showPips />

            <div className="flex flex-col min-w-0 gap-1">
              <span className="t-label text-fg-3">현재 티어</span>
              <div className="flex items-center gap-3">
                {heroAvatarSrc && (
                  <img
                    src={heroAvatarSrc}
                    alt={currentUser.nickname}
                    className="shrink-0 w-9 h-9 rounded-full object-cover border-2 border-line"
                    loading="lazy"
                  />
                )}
                <span className="t-h1 text-fg">{currentMeta.ko}</span>
                <span className="t-figure text-fg-2">ELO {formatEloScore(currentUser.elo)}</span>
              </div>
              {nextTier && (
                <span className="t-small text-fg-2">
                  다음 티어 <span className="text-accent-ink font-semibold">{nextTier.name_kr}</span>까지{' '}
                  <span className="t-figure text-fg">{formatEloScore(nextTier.min - currentUser.elo)}</span> 남음
                </span>
              )}
            </div>
          </section>
        )}

        {/* ===== 티어 사다리 ===== */}
        <section className="flex flex-col gap-3">
          {displayTiers.map((tier, idx) => {
            const meta = getCreatorTierMeta(tier.key);
            if (!meta) return null;

            // displayTiers는 위(챔피언) → 아래(브론즈) 순. 더 높은 티어는 idx-1에 있다.
            const higherTier = displayTiers[idx - 1];
            const minLabel = formatEloScore(tier.min);
            const maxLabel = higherTier ? formatEloScore(higherTier.min - 1) : null;
            const rangeLabel = maxLabel ? `${minLabel} - ${maxLabel}` : `${minLabel}+`;

            const isCurrent = currentMeta && currentMeta.key === tier.key;
            const thresholds = divisionThresholds(tier, higherTier);

            return (
              <div
                key={tier.key}
                className="eb-panel eb-row flex items-center gap-4 p-4"
                style={isCurrent ? { borderColor: 'var(--accent-ink)' } : undefined}
              >
                <TierMark tier={tier.key} size={64} />

                <div className="flex flex-col min-w-0 flex-1 gap-1">
                  <h3 className="t-h3 text-fg min-w-0 truncate">
                    {meta.ko}
                    {isCurrent && <span className="t-small text-fg-2"> · 지금 여기</span>}
                  </h3>
                  <div className="t-small text-fg-3 tabular-nums shrink-0 sm:hidden">{rangeLabel} ELO</div>
                  {thresholds && (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 sm:flex sm:flex-wrap sm:gap-x-3 sm:gap-y-0">
                      {thresholds.map(d => (
                        <span key={d.label} className="t-small text-fg-3 tabular-nums">
                          {d.label} {formatEloScore(d.threshold)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-right shrink-0 hidden sm:block">
                  <div className="t-figure text-fg tabular-nums">{rangeLabel}</div>
                  <div className="t-label text-fg-3">ELO</div>
                </div>
              </div>
            );
          })}
        </section>

        {/* ===== ELO 산식 ===== */}
        <section className="eb-tile mt-8">
          <h2 className="t-label text-fg-3 mb-3">ELO 산식</h2>
          <table className="w-full text-left">
            <tbody>
              {ELO_FORMULA_ROWS.map(row => (
                <tr key={row.label} className="border-b border-line last:border-b-0">
                  <td className="t-body text-fg-2 py-1.5 pr-4">{row.label}</td>
                  <td className="t-body text-fg py-1.5 text-right tabular-nums">{row.weight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
