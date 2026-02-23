import React, { useState, useCallback } from 'react';
import { formatNumber, getCreatorTier, getCharacterTier, calculateCreatorScore, calculateCreatorScoreRecent, calculatePercentile } from '../utils/tierCalculator';
import CreatorTierBadge from './CreatorTierBadge';
import { TierBadgeWithTooltip } from './TierBadge';
import HoverNumber from './HoverNumber';
import { Download, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';

export default function ProfileHeader({ profile, stats, characters }) {
  // ✅ 훅은 반드시 early return 이전에 선언해야 한다.
  const [tierMode, setTierMode] = useState('total'); // 'total' | 'recent'
  const [exporting, setExporting] = useState(false);
  const cardRef = React.useRef(null);

  const breakdown = React.useMemo(() => {
    if (!profile || !stats) return null;
    if (tierMode === 'total') {
      const sorted = (characters || []).sort((a, b) => (b.interactionCount || 0) - (a.interactionCount || 0));
      const top20Sum = sorted.slice(0, 20).reduce((acc, c) => acc + (c.interactionCount || 0), 0);
      const charCount = characters?.length || (stats.plotCount || 1);
      const totalInteractions = stats.plotInteractionCount || 0;
      return {
        mode: 'total',
        interactions: totalInteractions,
        followers: stats.followerCount || 0,
        avgInteractions: charCount > 0 ? totalInteractions / charCount : 0,
        voicePlays: stats.voicePlayCount || 0,
        top20Sum
      };
    } else {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);
      const recentChars = (characters || []).filter(c => {
        const date = c.createdAt || c.createdDate;
        return date && new Date(date) >= sixMonthsAgo;
      });
      const totalInteractions = recentChars.reduce((acc, c) => acc + (c.interactionCount || 0), 0);
      const charCount = recentChars.length || 1;
      const sorted = [...recentChars].sort((a, b) => (b.interactionCount || 0) - (a.interactionCount || 0));
      const top20Sum = sorted.slice(0, 20).reduce((acc, c) => acc + (c.interactionCount || 0), 0);
      return {
        mode: 'recent',
        interactions: totalInteractions,
        followers: stats.followerCount || 0,
        avgInteractions: recentChars.length > 0 ? totalInteractions / charCount : 0,
        voicePlays: stats.voicePlayCount || 0,
        top20Sum
      };
    }
  }, [tierMode, stats, characters, profile]);

  // 첫 번째 캐릭터 제작 날짜 (가장 이른 createdAt)
  const firstCharDate = React.useMemo(() => {
    if (!characters || characters.length === 0) return null;
    const dates = characters
      .map(c => c.createdAt || c.createdDate)
      .filter(Boolean)
      .map(d => new Date(d));
    if (dates.length === 0) return null;
    return new Date(Math.min(...dates));
  }, [characters]);

  // 내보내기 핸들러
  const handleExport = useCallback(async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const node = cardRef.current;
      const rect = node.getBoundingClientRect();
      // 다크/라이트 테마에 따라 직접 hex 색상 지정 (CSS var는 html-to-image에서 미지원)
      const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
      const bgColor = isDark ? '#1a1a26' : '#ffffff';
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: bgColor,
        // 실제 렌더링 크기로 고정 (reflow 방지)
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });
      const link = document.createElement('a');
      link.download = `zeta-${profile?.username || 'card'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Export failed', e);
    } finally {
      setExporting(false);
    }
  }, [profile]);

  if (!profile || !stats) return null;

  const score = tierMode === 'total'
    ? calculateCreatorScore(stats, characters)
    : calculateCreatorScoreRecent(stats, characters);

  const tier = getCreatorTier(score);
  const totalMessages = stats.plotInteractionCount || 0;
  const percentileLabel = calculatePercentile(totalMessages);

  const displayCharacters = tierMode === 'total'
    ? characters
    : (characters || []).filter(c => {
      const date = c.createdAt || c.createdDate;
      return date && new Date(date) >= new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    });

  const top20 = (displayCharacters || [])
    .sort((a, b) => (b.interactionCount || 0) - (a.interactionCount || 0))
    .slice(0, 20);

  const tierKoNames = {
    bronze: '브론즈',
    silver: '실버',
    gold: '골드',
    platinum: '플래티넘',
    diamond: '다이아몬드',
    master: '마스터',
    champion: '챔피언'
  };

  const topTags = React.useMemo(() => {
    if (!characters) return [];
    const counts = {};
    characters.forEach(c => {
      const tags = c.hashtags || c.tags || [];
      tags.forEach(t => {
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => tag);
  }, [characters]);

  return (
    <div className="card p-4 sm:p-6 relative" ref={cardRef}>
      {/* Tier Mode Selector */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex bg-[var(--bg-secondary)] rounded-full p-1 border border-[var(--border)] z-10">
        <button
          onClick={() => setTierMode('total')}
          className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${tierMode === 'total'
            ? 'bg-[var(--card)] text-[var(--text-primary)] shadow-sm'
            : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
        >
          전체
        </button>
        <button
          onClick={() => setTierMode('recent')}
          className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${tierMode === 'recent'
            ? 'bg-[var(--card)] text-[var(--text-primary)] shadow-sm'
            : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
        >
          최근 6개월
        </button>
      </div>

      {/* Export Button — 아이콘만 */}
      <button
        onClick={handleExport}
        disabled={exporting}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all disabled:opacity-50"
        title="카드 이미지로 저장"
      >
        {exporting
          ? <Loader2 size={15} className="animate-spin" />
          : <Download size={15} />
        }
      </button>

      <div className="flex items-center gap-3 sm:gap-4 mt-12 sm:mt-10">
        {/* Avatar */}
        <div className="relative shrink-0">
          <AvatarImage
            src={profile.profileImageUrl}
            alt={profile.nickname}
            fallback={(profile.nickname || '?')[0]}
            tierColor={tier.color}
          />
        </div>

        {/* Name & handle & Tags */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] truncate">
              {profile.nickname}
            </h2>
            <div className="flex gap-1">
              {topTags.map(tag => (
                <span key={tag} className="px-1.5 py-0.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] text-[10px] text-[var(--text-tertiary)]">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
          <p className="text-sm text-[var(--text-tertiary)]">@{profile.username}</p>
          {/* 계정 활동 기간 배지 — 첫 캐릭터 제작일 ~ 오늘 */}
          {firstCharDate !== null && (() => {
            const now = new Date();
            let years = now.getFullYear() - firstCharDate.getFullYear();
            let months = now.getMonth() - firstCharDate.getMonth();
            if (months < 0) { years--; months += 12; }
            const label = years > 0
              ? months > 0 ? `${years}년 ${months}개월째 활동 중` : `${years}년째 활동 중`
              : months > 0
                ? `${months}개월째 활동 중`
                : `${Math.max(1, Math.floor((now - firstCharDate) / 86400000))}일째 활동 중`;
            return (
              <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent-soft)] border border-[var(--accent)]/20 text-[10px] font-semibold text-[var(--accent)]">
                <span>🗓</span>
                {label}
              </div>
            );
          })()}
        </div>

        {/* Tier Badge */}
        <div className="text-right shrink-0 flex flex-col items-center">
          <CreatorTierBadge tier={tier} stats={stats} score={score} tierMode={tierMode} breakdown={breakdown} />
          <div className="text-sm font-bold mt-2" style={{ color: tier.color }}>
            {tier.subdivision ? `${tierKoNames[tier.key] || tier.name} ${tier.subdivision}` : (tierKoNames[tier.key] || tier.name)}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4 pt-4 border-t border-[var(--border)]">
        <StatItem label="총 대화량" value={totalMessages} />
        <StatItem label="팔로워" value={stats.followerCount || 0} />
        <StatItem label="캐릭터" value={stats.plotCount || 0} />
      </div>

      {/* Top 20 character tier badges */}
      {(top20.length > 0 || tierMode === 'recent') && (
        <div className="mt-4 pt-4 border-t border-[var(--border)]">
          <div className="text-[10px] text-[var(--text-tertiary)] uppercase mb-2">
            {tierMode === 'recent' ? '최근 캐릭터 20개 티어 (6개월)' : '최고 인기 20개 캐릭터 티어 (전체)'}
          </div>
          {top20.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {top20.map((char) => {
                const charTier = getCharacterTier(char.interactionCount || 0);
                return (
                  <TierBadgeWithTooltip
                    key={char.id}
                    tierKey={charTier.key}
                    size={22}
                    className="shrink-0"
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-[var(--text-tertiary)] py-2 text-center bg-[var(--bg-secondary)] rounded-lg">
              최근 6개월 내 제작된 캐릭터가 없습니다.
            </div>
          )}
        </div>
      )}

      {/* Progress bar */}
      {tier.nextTier && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-[var(--text-tertiary)] mb-1.5">
            <span>{tier.nextGoalLabel || tier.nextTier.name}까지</span>
            <span>{Math.floor(tier.subProgress ?? tier.progress)}%</span>
          </div>
          <div className="w-full h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${tier.gradient} transition-all duration-500`}
              style={{ width: `${tier.subProgress ?? tier.progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function AvatarImage({ src, alt, fallback, tierColor }) {
  const [err, setErr] = useState(false);
  const showImg = src && !err;

  return (
    <div
      className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden bg-[var(--card)] transition-all duration-300"
      style={{ boxShadow: `0 0 0 2.5px ${tierColor || 'var(--border)'}` }}
    >
      {showImg && (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          crossOrigin="anonymous"
          onError={() => setErr(true)}
        />
      )}
      {(!showImg) && (
        <div className="w-full h-full flex items-center justify-center text-xl font-bold text-[var(--text-secondary)]">
          {fallback}
        </div>
      )}
    </div>
  );
}

function StatItem({ label, value, sub, accentSub }) {
  return (
    <div className="text-center p-2 rounded-lg bg-[var(--bg-secondary)]/50">
      <div className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
        <HoverNumber value={value} />
      </div>
      <div className="text-[10px] sm:text-xs text-[var(--text-tertiary)] uppercase">{label}</div>
      {sub && (
        <div className={`text-[9px] font-semibold mt-0.5 ${accentSub ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`}>
          {sub}
        </div>
      )}
    </div>
  );
}
