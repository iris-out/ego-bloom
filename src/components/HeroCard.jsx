import React from 'react';
import { formatNumber } from '../utils/tierCalculator';

export default function HeroCard({ stats, characters }) {
  const following  = stats?.followingCount || 0;
  const charCount  = characters?.length ?? stats?.plotCount ?? 0;
  const voicePlays = stats?.voicePlayCount || 0;

  const items = [
    { label: '팔로잉',   value: formatNumber(following) },
    { label: '캐릭터',   value: String(charCount) },
    { label: '음성재생', value: formatNumber(voicePlays) },
  ];

  return (
    <div
      className="rounded-2xl px-4 py-4 lg:px-5 lg:py-5 mb-3 grid grid-cols-3 gap-x-4 gap-y-3"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {items.map(({ label, value }) => (
        <div key={label}>
          <p className="text-[12px] lg:text-[14px] text-white/40 mb-0.5">{label}</p>
          <p className="text-[15px] lg:text-[18px] font-bold text-white tabular-nums">{value}</p>
        </div>
      ))}
    </div>
  );
}
