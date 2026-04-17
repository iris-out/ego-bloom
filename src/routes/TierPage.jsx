import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { CREATOR_TIERS, getCreatorTier, formatNumber } from '../utils/tierCalculator';
import TierIcon from '../components/ui/TierIcon';
import { proxyThumbnailUrl } from '../utils/imageUtils';

// 티어 한국어 라벨 / 강조 색상 (tierCalculator에 name_kr이 없어 여기서 매핑)
const TIER_META = {
  bronze:   { color: '#C58356', kr: '브론즈' },
  silver:   { color: '#C8D4E0', kr: '실버' },
  gold:     { color: '#FBBF24', kr: '골드' },
  platinum: { color: '#76DDD0', kr: '플래티넘' },
  diamond:  { color: '#3B82F6', kr: '다이아몬드' },
  master:   { color: '#D946EF', kr: '마스터' },
  champion: { color: '#F97316', kr: '챔피언' },
};

// #RRGGBB → "r, g, b"
function hexToRgbTriplet(hex) {
  if (!hex) return '255,255,255';
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `${r}, ${g}, ${b}`;
}

// 챔피언부터 위에서 아래로 (unranked 제외, 역순)
const displayTiers = [...CREATOR_TIERS].filter(t => t.key !== 'unranked').reverse();

export default function TierPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const handleQuery = (searchParams.get('creator') || '').trim().toLowerCase();

  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveUser() {
      if (!handleQuery) return null;
      // 스펙은 /data/ranking_latest.json을 먼저 지시하지만, 해당 파일은 크리에이터 ELO 랭킹을
      // 포함하지 않는다. 실제 크리에이터 랭킹 소스인 /api/get-rankings 를 함께 시도한다.
      const tryEndpoints = ['/data/ranking_latest.json', '/api/get-rankings'];
      for (const url of tryEndpoints) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const data = await res.json();
          const list = Array.isArray(data)
            ? data
            : (data.rankings || data.creators || data.top || []);
          if (!Array.isArray(list) || list.length === 0) continue;

          const match = list.find(row => {
            const h = (row.handle || row.creatorHandle || '').toString().toLowerCase();
            return h === handleQuery;
          });
          if (!match) continue;

          const elo = match.elo_score ?? match.eloScore ?? match.elo ?? 0;
          return {
            handle: match.handle || match.creatorHandle || handleQuery,
            nickname: match.nickname || match.creatorNickname || match.handle || handleQuery,
            elo,
            avatarUrl: match.profile_image_url || match.profileImageUrl || match.creatorImageUrl || null,
          };
        } catch {
          /* try next */
        }
      }
      return null;
    }

    resolveUser().then(user => {
      if (!cancelled) setCurrentUser(user);
    });

    return () => { cancelled = true; };
  }, [handleQuery]);

  // 현재 티어 계산
  const tierInfo = currentUser ? getCreatorTier(currentUser.elo) : null;
  const currentMeta = tierInfo ? TIER_META[tierInfo.key] : null;
  const currentTier = tierInfo && currentMeta
    ? { key: tierInfo.key, color: currentMeta.color, name_kr: currentMeta.kr }
    : null;

  // 다음 상위 티어 찾기 (CREATOR_TIERS에서 현재보다 min이 큰 것 중 가장 작은 것)
  let nextTier = null;
  if (tierInfo) {
    const higher = CREATOR_TIERS
      .filter(t => t.key !== 'unranked' && t.min > tierInfo.min)
      .sort((a, b) => a.min - b.min);
    if (higher.length > 0) {
      const nt = higher[0];
      const meta = TIER_META[nt.key];
      nextTier = { key: nt.key, min: nt.min, name_kr: meta?.kr || nt.name };
    }
  }

  const heroAvatarSrc = currentUser?.avatarUrl
    ? (proxyThumbnailUrl(currentUser.avatarUrl, 192) || currentUser.avatarUrl)
    : null;

  return (
    <div className="bg-tier min-h-[100dvh] relative">
      {/* 헤더 */}
      <header className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.05] relative z-10">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          <ChevronLeft size={18} className="text-gray-300" />
        </button>
        <span className="text-sm font-semibold text-white/70 tracking-wider">티어 가이드</span>
      </header>

      <main className="max-w-[680px] mx-auto px-5 relative z-10 lg:max-w-[900px] lg:px-10">
        {/* ===== Hero (현재 유저) ===== */}
        {currentUser && currentTier && (
          <section
            className="flex items-center gap-5"
            style={{
              padding: '20px 0 24px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              marginBottom: '20px',
            }}
          >
            {/* 아바타 */}
            <div
              className="shrink-0 rounded-full overflow-hidden"
              style={{
                width: 72,
                height: 72,
                border: `2px solid ${currentTier.color}`,
                background: heroAvatarSrc ? '#1a1025' : 'linear-gradient(135deg, #3d2e5c, #d4a574)',
              }}
            >
              {heroAvatarSrc && (
                <img
                  src={heroAvatarSrc}
                  alt={currentUser.nickname}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              )}
            </div>

            {/* 정보 */}
            <div className="flex flex-col min-w-0">
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: '0.15em',
                  color: 'rgba(255,255,255,0.45)',
                  textTransform: 'uppercase',
                }}
              >
                현재 티어
              </span>
              <div className="flex items-baseline gap-3 mt-1">
                <span
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: currentTier.color,
                    lineHeight: 1.1,
                  }}
                >
                  {currentTier.name_kr}
                </span>
                <span
                  style={{
                    fontSize: 14,
                    color: 'rgba(255,255,255,0.65)',
                    fontFamily: "'Toss Product Sans', 'Pretendard Variable', sans-serif",
                  }}
                >
                  ELO {formatNumber(currentUser.elo)}
                </span>
              </div>
              {nextTier && (
                <span
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.45)',
                    marginTop: 6,
                  }}
                >
                  다음 티어{' '}
                  <b style={{ color: 'var(--accent, #d4a574)' }}>{nextTier.name_kr}</b>
                  까지{' '}
                  <b
                    style={{
                      color: 'rgba(255,255,255,0.75)',
                      fontFamily: "'Toss Product Sans', 'Pretendard Variable', sans-serif",
                    }}
                  >
                    {formatNumber(nextTier.min - currentUser.elo)}
                  </b>{' '}
                  남음
                </span>
              )}
            </div>
          </section>
        )}

        {/* ===== 타임라인 ===== */}
        <section
          style={{ position: 'relative', paddingLeft: 40, paddingTop: currentUser ? 0 : 8 }}
        >
          {/* 레일 */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: 16,
              top: 12,
              bottom: 12,
              width: 1,
              background: 'rgba(255,255,255,0.08)',
            }}
          />

          <ul className="flex flex-col list-none p-0 m-0">
            {displayTiers.map((tier, idx) => {
              const meta = TIER_META[tier.key];
              if (!meta) return null;

              // displayTiers는 위(챔피언) → 아래(브론즈) 순. 더 높은 티어는 idx-1에 있다.
              const higherTier = displayTiers[idx - 1];

              // ELO 범위 표기
              const minLabel = formatNumber(tier.min);
              const maxLabel = higherTier ? formatNumber(higherTier.min - 1) : null;
              const rangeLabel = maxLabel ? `${minLabel}–${maxLabel}` : `${minLabel}+`;

              const isCurrent = currentTier && currentTier.key === tier.key;
              const rgb = hexToRgbTriplet(meta.color);

              return (
                <li
                  key={tier.key}
                  style={{ position: 'relative' }}
                  className={isCurrent ? 'current' : ''}
                >
                  {/* 점(dot) */}
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      left: -32,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: isCurrent ? meta.color : 'rgba(255,255,255,0.04)',
                      border: isCurrent
                        ? `2px solid ${meta.color}`
                        : '2px solid rgba(255,255,255,0.08)',
                      boxShadow: isCurrent ? `0 0 0 4px rgba(${rgb}, 0.15)` : 'none',
                      transition: 'all 200ms ease',
                    }}
                  />

                  {/* 내용 */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: 20,
                      alignItems: 'center',
                      padding: '14px 0',
                    }}
                  >
                    {/* 좌측: 아이콘 + 이름 */}
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0 }}>
                      <div style={{ flexShrink: 0, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <TierIcon tier={tier.key} size={32} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: 15,
                            fontWeight: 600,
                            color: isCurrent ? meta.color : 'rgba(255,255,255,0.9)',
                            lineHeight: 1.3,
                          }}
                        >
                          {meta.kr}
                          {isCurrent && (
                            <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
                              {' · 지금 여기'}
                            </span>
                          )}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            color: 'rgba(255,255,255,0.45)',
                            letterSpacing: '0.1em',
                            marginTop: 2,
                          }}
                        >
                          {tier.name}
                        </span>
                      </div>
                    </div>

                    {/* 우측: ELO 범위 */}
                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: isCurrent ? meta.color : 'rgba(255,255,255,0.85)',
                          fontFamily: "'Toss Product Sans', 'Pretendard Variable', sans-serif",
                          lineHeight: 1.2,
                        }}
                      >
                        {rangeLabel}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: 'rgba(255,255,255,0.45)',
                          letterSpacing: '0.15em',
                          marginTop: 2,
                        }}
                      >
                        ELO
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ===== ELO 산식 ===== */}
        <div
          style={{
            marginTop: 32,
            marginBottom: 24,
            padding: 16,
            borderRadius: 4,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.5)',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            ELO 산식
          </div>
          <div
            style={{
              fontFamily: "'Pretendard Variable', sans-serif",
              fontSize: 12,
              color: 'rgba(255,255,255,0.7)',
              lineHeight: 1.8,
            }}
          >
            <div>총 대화수 × 3.0</div>
            <div>+ 팔로워 × 300</div>
            <div>+ 상위 20개 대화수 합계 × 0.5</div>
            <div>+ 평균 대화수 × 20.0</div>
            <div>+ 음성 재생수 × 100.0</div>
          </div>
        </div>
      </main>
    </div>
  );
}
