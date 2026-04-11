import React from 'react';
import { formatNumber } from '../utils/tierCalculator';

export default function HeroCard({ stats, characters }) {
  const totalInteractions = stats?.plotInteractionCount || 0;
  const followers  = stats?.followerCount  || 0;
  const following  = stats?.followingCount || 0;
  const charCount  = characters?.length ?? stats?.plotCount ?? 0;

  const items = [
    { label: '총 대화', value: formatNumber(totalInteractions) },
    { label: '팔로워',  value: formatNumber(followers) },
    { label: '팔로잉',  value: formatNumber(following) },
    { label: '캐릭터',  value: String(charCount) },
  ];

  return (
    <div
      className="rounded-2xl px-4 py-4 mb-3 grid grid-cols-2 gap-x-4 gap-y-3"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {items.map(({ label, value }) => (
        <div key={label}>
          <p className="text-[12px] text-white/40 mb-0.5">{label}</p>
          <p className="text-[15px] font-bold text-white tabular-nums">{value}</p>
        </div>
      ))}
    </div>
  );
}
