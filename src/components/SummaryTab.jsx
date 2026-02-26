import React, { useState, useMemo, useEffect, useRef } from 'react';
import { TierBadge } from './TierBadge';
import ImageWithFallback from './ImageWithFallback';
import RankBadge from './RankBadge';
import { getCharacterTier, formatNumber, formatDate, toKST } from '../utils/tierCalculator';
import { ChevronLeft, ChevronRight, MessageCircle, Calendar, ArrowUpAZ, X, ExternalLink, Star, RefreshCw, BookOpen, MessageSquareText, Loader2 } from 'lucide-react';

const ITEMS_PER_PAGE = 20;

export default function SummaryTab({ characters }) {
  const [sortKey, setSortKey] = useState('interactions');
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [activeTags, setActiveTags] = useState([]); // 멀티 태그 필터
  const loaderRef = useRef(null);

  // 모든 태그 집계
  const topTags = useMemo(() => {
    if (!characters) return [];
    const counts = {};
    characters.forEach(c => {
      (c.hashtags || c.tags || []).forEach(t => {
        if (t) counts[t] = (counts[t] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15) // 더 많은 태그 표시
      .map(([tag, count]) => ({ tag, count }));
  }, [characters]);

  // 정렬 + 태그 단일 선택 필터 적용
  const filtered = useMemo(() => {
    if (!characters) return [];
    const activeTag = activeTags[0];
    let data = activeTag
      ? characters.filter(c => {
        const charTags = (c.hashtags || c.tags || []);
        return charTags.includes(activeTag);
      })
      : [...characters];

    if (sortKey === 'interactions') {
      data.sort((a, b) => (b.interactionCount || 0) - (a.interactionCount || 0));
    } else if (sortKey === 'newest') {
      data.sort((a, b) => toKST(b.createdAt || 0) - toKST(a.createdAt || 0));
    } else if (sortKey === 'name') {
      data.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
    }
    return data;
  }, [characters, sortKey, activeTags]);

  // 무한 스크롤 관찰자
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && filtered.length > visibleCount) {
        setVisibleCount(prev => prev + ITEMS_PER_PAGE);
      }
    }, { threshold: 0.1, rootMargin: '100px' });

    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [filtered.length, visibleCount]);

  if (!characters || characters.length === 0) return null;

  const currentData = filtered.slice(0, visibleCount);

  const handleSortChange = (key) => { setSortKey(key); setVisibleCount(ITEMS_PER_PAGE); };
  const handleTagClick = (tag) => {
    setActiveTags(prev => (prev[0] === tag ? [] : [tag]));
    setVisibleCount(ITEMS_PER_PAGE);
  };

  const sortOptions = [
    { key: 'interactions', icon: <MessageCircle size={13} />, label: '대화량' },
    { key: 'newest', icon: <Calendar size={13} />, label: '최신' },
    { key: 'name', icon: <ArrowUpAZ size={13} />, label: '이름' },
  ];

  return (
    <div className="space-y-3">
      {/* 태그 필터 */}
      {topTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-0.5">
          {topTags.map(({ tag, count }) => {
            const isActive = activeTags[0] === tag;
            return (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className={`text-[11px] px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 ${isActive
                  ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-[0_0_10px_rgba(var(--accent-rgb),0.3)] font-bold'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)] border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                  }`}
              >
                #{tag}
                <span className={`text-[9px] ${isActive ? 'text-white/70' : 'opacity-50'}`}>{count}</span>
              </button>
            );
          })}
          {activeTags.length > 0 && (
            <button
              onClick={() => { setActiveTags([]); setVisibleCount(ITEMS_PER_PAGE); }}
              className="text-[11px] px-3 py-1.5 rounded-full border border-red-400/40 bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-all flex items-center gap-1.5 font-bold"
            >
              <X size={10} /> 필터 초기화
            </button>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--card)] p-3 rounded-xl border border-[var(--border)] shadow-sm">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">
            {activeTags.length > 0
              ? <div className="flex items-center gap-2">
                <span className="text-[var(--text-secondary)]">검색 결과</span>
                <span className="text-[var(--text-tertiary)] font-normal text-xs">({filtered.length}개)</span>
              </div>
              : <span className="text-[var(--text-secondary)]">캐릭터 목록</span>
            }
          </h3>
        </div>

        <div className="flex gap-1 bg-[var(--bg-secondary)] p-1 rounded-lg">
          {sortOptions.map(opt => (
            <button
              key={opt.key}
              onClick={() => handleSortChange(opt.key)}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${sortKey === opt.key
                ? 'bg-[var(--accent)] text-white shadow-sm'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'
                }`}
            >
              {opt.icon}{opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 필터 결과 없음 */}
      {filtered.length === 0 && (
        <div className="text-center py-16 bg-[var(--bg-secondary)]/30 rounded-2xl border border-dashed border-[var(--border)] animate-fade-in">
          <div className="flex flex-col items-center gap-3">
            <Search size={32} className="text-[var(--text-tertiary)] opacity-30" />
            <p className="text-sm text-[var(--text-tertiary)]">선택한 태그를 가진 캐릭터가 없습니다.</p>
            <button onClick={() => setActiveTags([])} className="text-xs text-[var(--accent)] font-bold hover:underline">필터 초기화하기</button>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {currentData.map((char, i) => (
          <CharacterCard
            key={char.id}
            char={char}
            rank={i + 1}
            onTagClick={handleTagClick}
            activeTags={activeTags}
          />
        ))}
      </div>

      {/* Loader for Infinite Scroll */}
      {filtered.length > visibleCount && (
        <div ref={loaderRef} className="py-10 flex justify-center w-full">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="animate-spin text-[var(--accent)]" size={24} />
            <span className="text-[10px] text-[var(--text-tertiary)] font-bold tracking-widest uppercase">더 불러오는 중...</span>
          </div>
        </div>
      )}
    </div>
  );
}

function CharacterCard({ char, rank, onTagClick, activeTags }) {
  const tier = getCharacterTier(char.interactionCount || 0);
  const isUnlimited = char.unlimitedAllowed;
  const tags = char.hashtags || char.tags || [];
  const zetaUrl = char.id ? `https://zeta-ai.io/ko/plots/${char.id}/profile` : null;
  const interaction = char.interactionCount || 0;
  const interactionDisplay = interaction.toLocaleString('ko-KR');
  const shortDescription = char.shortDescription || '';

  const activeTagSet = new Set(activeTags);
  const prioritizedTags = tags.filter(t => activeTagSet.has(t));
  const remainingTags = tags.filter(t => !activeTagSet.has(t));
  const visibleTags = [...prioritizedTags, ...remainingTags].slice(0, 3);
  const hiddenTagCount = Math.max(0, tags.length - visibleTags.length);

  const CardWrapper = zetaUrl
    ? ({ children }) => (
      <a href={zetaUrl} target="_blank" rel="noopener noreferrer"
        className="group relative overflow-hidden rounded-xl border border-[var(--border)] transition-all duration-300 hover:-translate-y-1 block bg-[rgba(25,25,35,0.7)] backdrop-blur-md hover:shadow-[0_0_20px_rgba(var(--accent-rgb),0.2)] hover:border-[var(--accent)]">
        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none transform -translate-x-full group-hover:translate-x-full" />
        {children}
      </a>
    )
    : ({ children }) => (
      <div className="group relative overflow-hidden rounded-xl border border-[var(--border)] transition-all duration-300 block bg-[rgba(25,25,35,0.7)] backdrop-blur-md">
        {children}
      </div>
    );

  return (
    <CardWrapper>
      <div className="flex flex-col h-full bg-gradient-to-b from-transparent to-black/20">
        {/* 상단: 랭크 표시 */}
        <div className="flex justify-between items-start p-3 pb-0 relative z-10">
          <div className="bg-black/60 text-white text-[10px] font-mono px-2 py-0.5 rounded-md border border-white/10 flex items-center gap-1 shadow-sm backdrop-blur-sm">
            #{rank}
          </div>
        </div>

        {/* 중앙: 썸네일 이미지 */}
        <div className="relative px-3 pt-4 pb-2 z-0 flex items-center justify-start">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,rgba(var(--accent-rgb),0.12)_0%,transparent_65%)] pointer-events-none" />
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden shrink-0 border border-white/10 shadow-lg relative bg-black/40 group-hover:border-[var(--accent)] transition-colors duration-300 group-hover:shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)]">
            <ImageWithFallback
              src={char.imageUrl}
              fallbackSrcs={(char.imageUrls || []).slice(1)}
              alt={char.name}
              className="w-full h-full object-contain group-hover:scale-105 group-hover:saturate-110 transition-all duration-500 ease-out"
            />
            {/* 등급 뱃지 */}
            <div className="absolute bottom-1.5 right-1.5 drop-shadow-md">
              <TierBadge tierKey={tier.key} size={22} className="opacity-95 shadow-none" />
            </div>
          </div>
        </div>

        {/* 하단: 데이터 */}
        <div className="px-3 pb-3 pt-1 flex-1 flex flex-col items-start text-left z-10">
          <h4 className="font-bold text-[var(--text-primary)] text-sm sm:text-base truncate w-full mb-1 leading-tight group-hover:text-[var(--accent)] transition-colors drop-shadow-sm">
            {char.name}
          </h4>

          {shortDescription && (
            <div className="w-full mb-2 overflow-hidden">
              {shortDescription.length > 40 ? (
                <div className="marquee-track text-[11px] text-[var(--text-tertiary)]">
                  <span className="marquee-item">{shortDescription}</span>
                  <span className="marquee-item" aria-hidden="true">{shortDescription}</span>
                </div>
              ) : (
                <p className="text-[11px] text-[var(--text-tertiary)] truncate">
                  {shortDescription}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 mb-2 w-full">
            <div className="text-xl sm:text-2xl font-black text-[var(--text-primary)] tracking-tight drop-shadow-sm">
              {interactionDisplay}
            </div>
            <RankBadge
              globalRank={char.globalRank}
              rankDiff={char.rankDiff}
              isNew={char.isNew}
              className="justify-end"
            />
          </div>

          <div className="flex flex-wrap justify-start gap-1.5 mb-2 max-w-full">
            {isUnlimited && (
              <span className="text-[11px] px-2 py-0.5 rounded text-white font-bold flex items-center gap-1 shadow-sm border border-purple-400/30" style={{ background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" /></svg>
                언리밋
              </span>
            )}
            {visibleTags.length > 0 && visibleTags.map((tag, i) => {
              const isSelected = activeTags.includes(tag);
              return (
                <button
                  key={i}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTagClick(tag); }}
                  className={`text-[11px] px-2 py-0.5 rounded border transition-all ${isSelected
                    ? 'bg-[var(--accent)] text-white border-[var(--accent)] font-bold'
                    : 'bg-black/30 text-[var(--text-tertiary)] border-white/5 hover:border-[var(--accent)] hover:text-[var(--accent)] backdrop-blur-sm'
                    }`}
                >
                  #{tag}
                </button>
              );
            })}
            {hiddenTagCount > 0 && (
              <span className="text-[10px] px-1 py-0.5 text-[var(--text-tertiary)] border border-transparent">
                +{hiddenTagCount}
              </span>
            )}
          </div>

          <div className="flex w-full items-center justify-between text-[10px] text-[var(--text-secondary)] mt-auto pt-2 border-t border-white/10">
            <div className="flex items-center">
              <Calendar size={9} className="mr-1" />
              {formatDate(char.createdAt)}
            </div>
            {(char.starCount || 0) > 0 && (
              <div className="flex items-center gap-0.5">
                <Star size={9} className="text-yellow-500 fill-yellow-500" />
                {formatNumber(char.starCount)}
              </div>
            )}
          </div>
        </div>
      </div>
    </CardWrapper>
  );
}
