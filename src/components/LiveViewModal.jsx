import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { formatCompactNumber, toKST } from '../utils/tierCalculator';
import { proxyImageUrl } from '../utils/imageUtils';
import { computeEarnedTitles } from '../data/badges';
import TierIcon from './ui/TierIcon';

const ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };

const TIER_COLORS_MAP = {
  bronze: '#C58356',
  silver: '#9CA3AF',
  gold: '#FBBF24',
  platinum: '#E2E8F0',
  diamond: '#3B82F6',
  master: '#D946EF',
  champion: '#F97316',
  unranked: '#718096',
};

// ============================================================
// Slide 1: 퍼플 그라디언트 — 메인 쇼케이스
// ============================================================
function Slide1({ profile, tier, score, stats, badges, activityDays, characters, vh }) {
  const tierColor = TIER_COLORS_MAP[tier.key] || TIER_COLORS_MAP.unranked;

  return (
    <div
      className="w-full flex flex-col items-center justify-start pt-14 pb-6 px-6 gap-4 relative overflow-y-auto scrollbar-hide"
      style={{ height: vh, background: 'radial-gradient(ellipse at top, rgba(88,28,135,0.4) 0%, #0B0812 60%), #0B0812' }}
    >
      {/* Noise overlay */}
      <div
        className="absolute inset-0 opacity-50 mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMiIvPjwvc3ZnPg==")`,
        }}
      />

      {/* Avatar */}
      <div className="relative z-10">
        <div className="absolute inset-0 rounded-full blur-xl opacity-50" style={{ background: 'linear-gradient(135deg, #2A52CC, #3B82F6)' }} />
        <div className="w-24 h-24 rounded-full p-[3px] relative z-10" style={{ background: 'linear-gradient(135deg, #4A7FFF, #6366F1, #3B82F6)' }}>
          <div className="w-full h-full rounded-full bg-[#0B0812] flex items-center justify-center overflow-hidden">
            {profile.profileImageUrl ? (
              <img src={proxyImageUrl(profile.profileImageUrl)} alt="" className="w-full h-full object-cover rounded-full" crossOrigin="anonymous" />
            ) : (
              <span className="text-3xl font-bold text-white">{(profile.nickname || '?')[0]}</span>
            )}
          </div>
        </div>
      </div>

      {/* Name */}
      <div className="text-center z-10">
        <h1 className="text-2xl font-bold tracking-tight text-white">{profile.nickname}</h1>
        <p className="text-sm text-purple-200/60 font-medium mt-1">@{profile.username}</p>
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 max-w-[280px] z-10">
          {badges.slice(0, 4).map(b => (
            <div
              key={b.id}
              className="px-3 py-1.5 rounded-full text-xs font-medium text-white flex items-center gap-1.5"
              style={{
                background: 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.05)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}
            >
              {b.emoji} {b.title}
            </div>
          ))}
        </div>
      )}

      {/* Tier icon */}
      <div className="flex flex-col items-center gap-2 relative z-10">
        <div className="absolute inset-0 rounded-full blur-[30px] opacity-20" style={{ background: tierColor }} />
        <div style={{ filter: `drop-shadow(0 0 15px ${tierColor}88)` }}>
          <TierIcon tier={tier.key} size={64} />
        </div>
        <div className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: tierColor }}>
          {tier.name} {ROMAN[tier.subdivision] || ''}
        </div>
      </div>

      {/* Stats */}
      <div className="z-10 w-full space-y-3">
        {activityDays > 0 && (
          <div className="text-center">
            <span className="text-xs font-medium text-purple-200/50 uppercase tracking-widest relative inline-block">
              <span className="absolute top-1/2 -left-8 w-6 h-[1px] bg-purple-200/20" />
              제작 {activityDays}일째
              <span className="absolute top-1/2 -right-8 w-6 h-[1px] bg-purple-200/20" />
            </span>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: '대화량', val: stats.plotInteractionCount },
            { label: '팔로워', val: stats.followerCount },
            { label: '캐릭터', val: characters?.length ?? stats.plotCount },
          ].map(s => (
            <div
              key={s.label}
              className="rounded-2xl p-3 flex flex-col items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.05)' }}
            >
              <span className="text-[10px] text-gray-400 mb-1 font-medium">{s.label}</span>
              <span className="text-lg font-bold text-white tracking-tight">{formatCompactNumber(s.val)}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="absolute bottom-4 text-[8px] text-white/20 tracking-widest z-10">EGO-BLOOM</p>
    </div>
  );
}

// ============================================================
// Slide 2: 블랙 미니멀 — 타이포 중심
// ============================================================
function Slide2({ profile, tier, score, stats, badges, activityDays, characters, vh }) {
  return (
    <div className="w-full flex flex-col pt-14 pb-6 px-8 relative overflow-y-auto scrollbar-hide bg-[#050505]" style={{ height: vh }}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center overflow-hidden shrink-0">
          {profile.profileImageUrl ? (
            <img src={proxyImageUrl(profile.profileImageUrl)} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
          ) : (
            <span className="text-xl font-black text-black">{(profile.nickname || '?')[0]}</span>
          )}
        </div>
        <div>
          <h1 className="text-lg font-bold text-white leading-tight">{profile.nickname}</h1>
          <p className="text-xs text-gray-500 font-mono">@{profile.username}</p>
        </div>
      </div>

      {/* Big number */}
      <div className="flex-1 flex flex-col justify-center">
        <div className="mb-6">
          <p className="text-[11px] font-mono text-gray-500 uppercase tracking-[0.3em] mb-2 border-l border-white/20 pl-3">총 대화수</p>
          <h2 className="text-[76px] font-black leading-none tracking-tighter text-white">
            {formatCompactNumber(stats.plotInteractionCount)
              .replace(/([억만천])$/, '')}
            <span className="text-gray-600 text-[60px]">
              {formatCompactNumber(stats.plotInteractionCount).match(/[억만천]$/)?.[0] || ''}
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <p className="text-[11px] font-mono text-gray-500 uppercase tracking-[0.3em] mb-2 border-l border-white/20 pl-3">팔로워</p>
            <h3 className="text-4xl font-black tracking-tight text-white">
              {formatCompactNumber(stats.followerCount).replace(/([억만천])$/, '')}
              <span className="text-gray-600">{formatCompactNumber(stats.followerCount).match(/[억만천]$/)?.[0] || ''}</span>
            </h3>
          </div>
          <div>
            <p className="text-[11px] font-mono text-gray-500 uppercase tracking-[0.3em] mb-2 border-l border-white/20 pl-3">캐릭터</p>
            <h3 className="text-4xl font-black tracking-tight text-white">{characters?.length ?? stats.plotCount ?? 0}</h3>
          </div>
        </div>

        {/* Tier + badges */}
        <div className="border-t border-white/10 pt-6 pb-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center">
                <TierIcon tier={tier.key} size={16} />
              </div>
              <span className="font-mono text-xs uppercase tracking-widest text-white">
                {tier.name} {ROMAN[tier.subdivision] || ''}
              </span>
            </div>
            {activityDays > 0 && <span className="text-[10px] text-gray-500">제작 {activityDays}일째</span>}
          </div>

          {badges.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {badges.map(b => (
                <span key={b.id} className="text-[10px] font-mono border border-white/20 px-2 py-1 rounded-sm text-gray-300">
                  {b.emoji} {b.title}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>


      <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[8px] text-white/10 tracking-widest">EGO-BLOOM</p>
    </div>
  );
}

// ============================================================
// Slide 3: 사이버펑크 그리드 — 게이밍
// ============================================================
function Slide3({ profile, tier, score, stats, badges, activityDays, characters, vh }) {
  const tierColor = TIER_COLORS_MAP[tier.key] || TIER_COLORS_MAP.unranked;

  return (
    <div
      className="w-full flex flex-col pt-16 pb-10 px-5 relative overflow-y-auto scrollbar-hide"
      style={{ height: vh, background: '#09090b', fontFamily: "'JetBrains Mono', monospace" }}
    >
      {/* Grid bg */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: 'linear-gradient(rgba(0,240,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.05) 1px, transparent 1px)',
          backgroundSize: '30px 30px',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#09090b]/80 to-[#09090b]" />

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div
            className="w-20 h-20 flex items-center justify-center relative overflow-hidden"
            style={{
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              background: '#00F0FF',
              padding: 2,
              boxShadow: '0 0 20px rgba(0,240,255,0.4)',
            }}
          >
            <div
              className="w-full h-full flex items-center justify-center overflow-hidden"
              style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', background: '#111' }}
            >
              {profile.profileImageUrl ? (
                <img src={proxyImageUrl(profile.profileImageUrl)} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
              ) : (
                <span className="text-2xl font-bold text-cyan-400" style={{ textShadow: '0 0 10px rgba(0,240,255,0.7)' }}>
                  {(profile.nickname || '?')[0]}
                </span>
              )}
            </div>
          </div>

          <div className="text-right pt-2">
            <div className="text-[13.5px] text-cyan-500 mb-1 opacity-70 border-b border-cyan-900 pb-1 uppercase tracking-widest">아이디</div>
            <h1 className="text-lg font-bold text-white uppercase italic tracking-wider">{profile.nickname}</h1>
            <p className="text-xs text-gray-400">@{profile.username}</p>
          </div>
        </div>

        {/* System alert */}
        {activityDays > 0 && (
          <div className="bg-cyan-950/30 border-l-2 border-cyan-500 p-2 mb-6 flex justify-between items-center backdrop-blur-sm">
            <span className="text-[12px] text-cyan-400 uppercase tracking-widest">알림</span>
            <span className="text-[10px] text-white uppercase tracking-widest bg-cyan-500/20 px-2 py-0.5">제작 {activityDays}일째</span>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-black/50 border border-cyan-500/30 p-3 relative" style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}>
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-cyan-500" />
            <p className="text-[11px] text-cyan-500/70 uppercase mb-1">대화수</p>
            <p className="text-2xl font-bold text-white" style={{ textShadow: '0 0 10px rgba(0,240,255,0.7)' }}>
              {formatCompactNumber(stats.plotInteractionCount)}
            </p>
          </div>
          <div className="bg-black/50 border border-purple-500/30 p-3 relative" style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}>
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-purple-500" />
            <p className="text-[11px] text-purple-500/70 uppercase mb-1">팔로워</p>
            <p className="text-2xl font-bold text-white">{formatCompactNumber(stats.followerCount)}</p>
          </div>
          <div className="bg-black/50 border border-pink-500/30 p-3 relative col-span-2" style={{ clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }}>
            <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-pink-500" />
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[11px] text-pink-500/70 uppercase mb-1">활성 캐릭터</p>
                <p className="text-2xl font-bold text-white">{characters?.length ?? stats.plotCount ?? 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Badges */}
        {badges.length > 0 && (
          <div className="mb-auto">
            <p className="text-[11px] text-gray-500 uppercase mb-3 border-b border-gray-800 pb-1">획득한 칭호</p>
            <div className="flex flex-wrap gap-2">
              {badges.map(b => (
                <div
                  key={b.id}
                  className="border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 text-[10px] px-2 py-1 uppercase flex items-center gap-1"
                  style={{ boxShadow: '0 0 10px rgba(0,240,255,0.1)' }}
                >
                  {b.emoji} {b.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tier block */}
        <div className="mt-auto">
          <div className="bg-[#050505] border border-gray-800 p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl" />

            <div className="flex justify-between items-center mb-4 relative z-10">
              <div className="flex items-center gap-3">
                <div style={{ filter: 'drop-shadow(0 0 8px rgba(0,240,255,0.8))' }}>
                  <TierIcon tier={tier.key} size={32} />
                </div>
                <div>
                  <div className="text-[11px] text-cyan-500 uppercase">현재 랭크</div>
                  <div className="text-sm font-bold text-white uppercase tracking-widest" style={{ textShadow: '0 0 10px rgba(0,240,255,0.7)' }}>
                    {tier.name} {ROMAN[tier.subdivision] || ''}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-gray-500 uppercase">랭크 점수</div>
                <div className="text-sm text-white font-mono">
                  {formatCompactNumber(score)}
                  {tier.nextGoalScore && <span className="text-gray-600 text-[10px]">/{formatCompactNumber(tier.nextGoalScore)}</span>}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[8px] text-white/10 tracking-widest z-10">EGO-BLOOM</p>
    </div>
  );
}

// ============================================================
// Slide 4: 다크 애널리틱스 — 데이터 대시보드
// ============================================================
function Slide4({ profile, tier, score, stats, badges, activityDays, characters, vh }) {
  const tierColor = TIER_COLORS_MAP[tier.key] || TIER_COLORS_MAP.unranked;
  const r = 45;

  return (
    <div className="w-full flex flex-col pt-14 pb-8 px-4 relative overflow-y-auto scrollbar-hide bg-[#0a0c10] text-gray-100" style={{ height: vh }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-5 px-2">
        <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
          Creator Overview
        </h2>
        <span className="text-[10px] font-medium bg-blue-500/20 text-blue-400 px-2 py-1 rounded-md">Live Data</span>
      </div>

      {/* Profile + creation time */}
      <div
        className="rounded-2xl p-4 mb-4 flex items-center justify-between"
        style={{ background: '#13161f', border: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden p-[2px]" style={{ background: 'linear-gradient(135deg, #4A7FFF, #6366f1)' }}>
            <div className="w-full h-full rounded-full bg-[#13161f] flex items-center justify-center overflow-hidden">
              {profile.profileImageUrl ? (
                <img src={proxyImageUrl(profile.profileImageUrl)} alt="" className="w-full h-full object-cover rounded-full" crossOrigin="anonymous" />
              ) : (
                <span className="font-bold text-lg text-white">{(profile.nickname || '?')[0]}</span>
              )}
            </div>
          </div>
          <div>
            <h1 className="font-semibold text-sm text-white leading-tight">{profile.nickname}</h1>
            <p className="text-[11px] text-gray-400">@{profile.username}</p>
          </div>
        </div>
        {activityDays > 0 && (
          <div className="text-right">
            <div className="text-[10px] text-gray-500 uppercase font-medium mb-1">Creation Time</div>
            <div className="text-xs font-semibold text-white bg-white/5 px-2 py-1 rounded border border-white/5">제작 {activityDays}일째</div>
          </div>
        )}
      </div>

      {/* Tier + followers/chars */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        {/* Circular tier */}
        <div
          className="rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden"
          style={{ background: '#13161f', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="absolute inset-0 bg-blue-500/5" />
          <div className="relative w-20 h-20 mb-2">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={r} fill="none" stroke="#1f2433" strokeWidth="8" strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <TierIcon tier={tier.key} size={20} />
              <span className="text-[8px] font-bold text-white uppercase mt-1">{tier.name}</span>
              <span className="text-[7px] text-gray-400">{ROMAN[tier.subdivision] || ''}</span>
            </div>
          </div>
          <div className="text-[10px] text-gray-400 font-medium">Rank Status</div>
        </div>

        {/* Followers + chars */}
        <div className="flex flex-col gap-3">
          <div
            className="rounded-2xl p-4 flex-1 flex flex-col justify-center relative overflow-hidden"
            style={{ background: '#13161f', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div className="text-[10px] text-gray-400 font-medium mb-1">Followers</div>
            <div className="text-2xl font-bold text-white">{formatCompactNumber(stats.followerCount)}</div>
          </div>
          <div
            className="rounded-2xl p-4 flex-1 flex flex-col justify-center"
            style={{ background: '#13161f', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div className="text-[10px] text-gray-400 font-medium mb-1">Characters</div>
            <div className="text-2xl font-bold text-white">{characters?.length ?? stats.plotCount ?? 0}</div>
          </div>
        </div>
      </div>

      {/* Total conversations */}
      <div
        className="rounded-2xl p-4 mb-3"
        style={{ background: '#13161f', border: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="flex justify-between items-center mb-2">
          <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Total Conversations</div>
          <div className="text-lg font-bold text-white">{formatCompactNumber(stats.plotInteractionCount)}</div>
        </div>
        {/* Decorative chart line */}
        <div className="w-full h-10 relative">
          <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-full">
            <defs>
              <linearGradient id="chartGrad4" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ec4899" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0 30 L0 15 Q 10 5, 20 12 T 40 20 T 60 10 T 80 18 T 100 5 L100 30 Z" fill="url(#chartGrad4)" />
            <path d="M0 15 Q 10 5, 20 12 T 40 20 T 60 10 T 80 18 T 100 5" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" />
            <circle cx="100" cy="5" r="3" fill="#ec4899" stroke="#13161f" strokeWidth="2" />
          </svg>
        </div>
      </div>

      {/* Milestones / badges */}
      {badges.length > 0 && (
        <div
          className="rounded-2xl p-4 mb-auto"
          style={{ background: '#13161f', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-3">Key Milestones</div>
          <div className="grid grid-cols-2 gap-2">
            {badges.slice(0, 4).map(b => (
              <div key={b.id} className="flex items-center gap-2 bg-white/5 p-2 rounded-lg border border-white/5">
                <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-[12px]">{b.emoji}</div>
                <span className="text-[10px] font-medium text-gray-200 truncate">{b.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}


      <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[8px] text-white/10 tracking-widest">EGO-BLOOM</p>
    </div>
  );
}

const SLIDES = [
  { id: 'showcase', component: Slide1 },
  { id: 'minimal', component: Slide2 },
  { id: 'cyberpunk', component: Slide3 },
  { id: 'analytics', component: Slide4 },
];

export default function LiveViewModal({ isOpen, onClose, characters, stats, profile, tier, score }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const sliderRef = useRef(null);
  const touchStartX = useRef(null);
  const isScrolling = useRef(false);

  const badges = useMemo(() => {
    if (!characters || !stats) return [];
    return computeEarnedTitles({ characters, stats }).filter(b => b.earned);
  }, [characters, stats]);

  const activityDays = useMemo(() => {
    if (!characters) return 0;
    const dates = characters
      .map(c => c.createdAt || c.createdDate)
      .filter(Boolean)
      .map(d => toKST(d).getTime())
      .filter(t => !isNaN(t));
    if (dates.length === 0) return 0;
    return Math.floor((toKST().getTime() - Math.min(...dates)) / 86400000);
  }, [characters]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [isOpen]);

  // Sync scroll → dot index
  const handleScroll = useCallback(() => {
    if (!sliderRef.current || isScrolling.current) return;
    const el = sliderRef.current;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setCurrentIdx(idx);
  }, []);

  // Navigate by index
  const goTo = useCallback((idx) => {
    if (!sliderRef.current) return;
    isScrolling.current = true;
    sliderRef.current.scrollTo({ left: idx * sliderRef.current.clientWidth, behavior: 'smooth' });
    setCurrentIdx(idx);
    setTimeout(() => { isScrolling.current = false; }, 400);
  }, []);

  // Tap zones: left half = prev, right half = next
  const handleTap = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 2) {
      goTo(Math.max(0, currentIdx - 1));
    } else {
      goTo(Math.min(SLIDES.length - 1, currentIdx + 1));
    }
  }, [currentIdx, goTo]);

  // Touch swipe
  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleWheel = useCallback((e) => { e.stopPropagation(); }, []);

  const handleTouchEnd = useCallback((e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      if (dx < 0) goTo(Math.min(SLIDES.length - 1, currentIdx + 1));
      else goTo(Math.max(0, currentIdx - 1));
    }
    touchStartX.current = null;
  }, [currentIdx, goTo]);

  if (!isOpen) return null;

  const slideProps = {
    profile: profile || {},
    tier: tier || {},
    score: score || 0,
    stats: stats || {},
    badges,
    activityDays,
    characters: characters || [],
  };

  const VH = '100vh';

  return (
    <div
      className="fixed z-[9999] bg-black"
      style={{ top: 0, left: 0, width: '100vw', height: VH }}
    >
      {/* Story-style wrapper: full screen on mobile, full-height 9:16 centered on desktop */}
      <div
        className="absolute overflow-hidden"
        style={{
          top: 0,
          height: VH,
          left: '50%',
          transform: 'translateX(-50%)',
          width: `min(calc(${VH} * 9 / 16), 100vw)`,
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-[10000] w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4 text-white" />
        </button>

        {/* Dot indicators */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-2 pointer-events-none">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full transition-all duration-300"
              style={{
                width: 48,
                background: i === currentIdx ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.3)',
              }}
            />
          ))}
        </div>

        {/* Slider */}
        <div
          ref={sliderRef}
          onScroll={handleScroll}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
          className="flex overflow-x-auto overflow-y-hidden scrollbar-hide"
          style={{ width: '100%', height: VH, scrollSnapType: 'x mandatory', scrollBehavior: 'auto', overscrollBehavior: 'contain' }}
        >
          {SLIDES.map(({ id, component: SlideComponent }) => (
            <div
              key={id}
              className="shrink-0"
              style={{ width: '100%', height: VH, scrollSnapAlign: 'center' }}
              onClick={handleTap}
            >
              <SlideComponent {...slideProps} vh={VH} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
