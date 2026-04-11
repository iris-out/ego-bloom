import React, { useState, useEffect } from 'react';

function useCountUpLocal(target, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const d = prefersReduced ? 0 : duration;
    if (d === 0) { setVal(target); return; }
    setVal(0);
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / d);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setVal(target);
    };
    raf = requestAnimationFrame(tick);
    return () => raf && cancelAnimationFrame(raf);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  return val;
}

export default function HeroCard({ stats, characters }) {
  const totalInteractions = stats?.plotInteractionCount || 0;
  const followers  = stats?.followerCount  || 0;
  const following  = stats?.followingCount || 0;
  const charCount  = characters?.length ?? stats?.plotCount ?? 0;

  const animInteractions = useCountUpLocal(totalInteractions, 900);
  const animFollowers    = useCountUpLocal(followers, 700);
  const animFollowing    = useCountUpLocal(following, 700);
  const animChars        = useCountUpLocal(charCount, 600);

  return (
    <div
      className="rounded-2xl px-4 py-4 mb-3"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* 히어로 숫자 */}
      <p className="text-[11px] text-white/40 mb-1">총 대화 수</p>
      <p
        className="font-black text-white leading-none mb-0.5"
        style={{ fontSize: '32px', letterSpacing: '-1.2px' }}
      >
        {animInteractions.toLocaleString('ko-KR')}
        <span className="text-[15px] font-medium text-white/40 ml-1.5">회</span>
      </p>

      {/* 팔로워 / 팔로잉 / 캐릭터 */}
      <div
        className="flex items-center mt-3 pt-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="flex items-baseline gap-1 flex-1">
          <span className="text-[13px] font-bold text-white">{animFollowers.toLocaleString('ko-KR')}</span>
          <span className="text-[10px] text-white/35">팔로워</span>
        </div>
        <div className="w-px h-3.5 mx-3" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <div className="flex items-baseline gap-1 flex-1">
          <span className="text-[13px] font-bold text-white">{animFollowing.toLocaleString('ko-KR')}</span>
          <span className="text-[10px] text-white/35">팔로잉</span>
        </div>
        <div className="w-px h-3.5 mx-3" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <div className="flex items-baseline gap-1 flex-1">
          <span className="text-[13px] font-bold text-white">{animChars.toLocaleString('ko-KR')}</span>
          <span className="text-[10px] text-white/35">캐릭터</span>
        </div>
      </div>
    </div>
  );
}
