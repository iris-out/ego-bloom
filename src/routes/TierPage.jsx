import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { CREATOR_TIERS, formatNumber } from '../utils/tierCalculator';
import TierIcon from '../components/ui/TierIcon';

const TIER_META = {
  bronze:   { color: '#C58356', kr: '브론즈' },
  silver:   { color: '#9CA3AF', kr: '실버' },
  gold:     { color: '#FBBF24', kr: '골드' },
  platinum: { color: '#E2E8F0', kr: '플래티넘' },
  diamond:  { color: '#3B82F6', kr: '다이아몬드' },
  master:   { color: '#D946EF', kr: '마스터' },
  champion: { color: '#F97316', kr: '챔피언' },
};

const displayTiers = [...CREATOR_TIERS].filter(t => t.key !== 'unranked').reverse();

export default function TierPage() {
  const navigate = useNavigate();

  return (
    <div className="bg-tier min-h-[100dvh] relative">
      <div className="fixed top-0 left-1/4 w-[600px] h-[400px] bg-indigo-900/10 rounded-full blur-[120px] pointer-events-none" />

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

      {/* 티어 목록 */}
      <main className="max-w-[680px] mx-auto px-5 py-4 relative z-10">
        <div className="flex flex-col divide-y divide-white/[0.04]">
          {displayTiers.map((tier, idx) => {
            const meta = TIER_META[tier.key];
            if (!meta) return null;
            const nextTier = displayTiers[idx - 1];
            const eloMax = nextTier ? formatNumber(nextTier.min - 1) : null;
            const eloMin = tier.min > 0 ? formatNumber(tier.min) : '0';

            return (
              <div
                key={tier.key}
                className="flex items-center gap-4 py-4"
              >
                {/* 티어 아이콘 */}
                <div className="w-12 h-12 flex items-center justify-center shrink-0">
                  <TierIcon tier={tier.key} size={44} />
                </div>

                {/* 이름 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[15px] font-bold text-white">{tier.name}</span>
                    <span className="text-[12px] font-medium" style={{ color: meta.color }}>{meta.kr}</span>
                  </div>
                  {/* 서브티어 표시 */}
                  <div className="flex gap-1 mt-1">
                    {[1, 2, 3, 4].map(sub => (
                      <span
                        key={sub}
                        className="text-[10px] px-1.5 py-0.5 rounded font-mono text-white/40 border border-white/[0.06]"
                        style={{ background: `${meta.color}10` }}
                      >
                        {sub === 1 ? 'I' : sub === 2 ? 'II' : sub === 3 ? 'III' : 'IV'}
                      </span>
                    ))}
                  </div>
                </div>

                {/* ELO 범위 */}
                <div className="text-right shrink-0">
                  <span className="text-[13px] font-mono font-semibold" style={{ color: meta.color }}>
                    {eloMin}{eloMax ? `–${eloMax}` : '+'}
                  </span>
                  <div className="text-[10px] text-white/30 mt-0.5">ELO</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ELO 산식 */}
        <div className="mt-6 rounded-xl p-4 text-[12px] text-white/40 leading-relaxed" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="text-[11px] text-white/30 font-mono uppercase tracking-wider mb-2">ELO 산식</div>
          <div className="font-mono space-y-1 text-white/50">
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
