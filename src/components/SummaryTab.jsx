import React, { useState, useMemo } from 'react';
import { TierBadge } from './TierBadge';
import ImageWithFallback from './ImageWithFallback';
import { getCharacterTier, formatNumber, formatDate, toKST } from '../utils/tierCalculator';
import { ChevronLeft, ChevronRight, MessageCircle, Calendar, ArrowUpAZ, X, ExternalLink, Star, RefreshCw, BookOpen, MessageSquareText } from 'lucide-react';

const ITEMS_PER_PAGE = 20;

export default function SummaryTab({ characters }) {
  const [sortKey, setSortKey] = useState('interactions');
  const [page, setPage] = useState(1);
  const [activeTag, setActiveTag] = useState(null); // 태그 필터

  // 모든 태그 집계 (상위 10개)
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
      .slice(0, 12)
      .map(([tag, count]) => ({ tag, count }));
  }, [characters]);

  // 정렬 + 태그 필터 적용
  const filtered = useMemo(() => {
    if (!characters) return [];
    let data = activeTag
      ? characters.filter(c => (c.hashtags || c.tags || []).includes(activeTag))
      : [...characters];
    if (sortKey === 'interactions') {
      data.sort((a, b) => (b.interactionCount || 0) - (a.interactionCount || 0));
    } else if (sortKey === 'newest') {
      data.sort((a, b) => toKST(b.createdAt || 0) - toKST(a.createdAt || 0));
    } else if (sortKey === 'name') {
      data.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
    }
    return data;
  }, [characters, sortKey, activeTag]);

  if (!characters || characters.length === 0) return null;

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const currentData = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleSortChange = (key) => { setSortKey(key); setPage(1); };
  const handleTagClick = (tag) => {
    setActiveTag(prev => prev === tag ? null : tag);
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
          {topTags.map(({ tag, count }) => (
            <button
              key={tag}
              onClick={() => handleTagClick(tag)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${activeTag === tag
                ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm'
                : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)] border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                }`}
            >
              #{tag}
              <span className="ml-1 opacity-60 text-[10px]">{count}</span>
            </button>
          ))}
          {activeTag && (
            <button
              onClick={() => { setActiveTag(null); setPage(1); }}
              className="text-xs px-2.5 py-1 rounded-full border border-red-400/40 bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-all flex items-center gap-1"
            >
              <X size={10} /> 필터 해제
            </button>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--card)] p-3 rounded-xl border border-[var(--border)] shadow-sm">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">
            {activeTag
              ? <><span className="text-[var(--accent)]">#{activeTag}</span> <span className="text-[var(--text-tertiary)] font-normal">({filtered.length})</span></>
              : <>캐릭터 <span className="text-[var(--text-tertiary)] font-normal">({formatNumber(characters.length)})</span></>
            }
          </h3>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={() => handlePageChange(page - 1)} disabled={page === 1}
                className="p-1 rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)] disabled:opacity-30 hover:bg-[var(--accent)] hover:text-white transition-colors">
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-mono text-[var(--text-tertiary)] w-12 text-center">{page} / {totalPages}</span>
              <button onClick={() => handlePageChange(page + 1)} disabled={page === totalPages}
                className="p-1 rounded bg-[var(--bg-secondary)] text-[var(--text-secondary)] disabled:opacity-30 hover:bg-[var(--accent)] hover:text-white transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-1 bg-[var(--bg-secondary)] p-1 rounded-lg">
          {sortOptions.map(opt => (
            <button
              key={opt.key}
              onClick={() => handleSortChange(opt.key)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${sortKey === opt.key
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
        <div className="text-center py-10 text-[var(--text-tertiary)] text-sm bg-[var(--bg-secondary)]/30 rounded-xl border border-dashed border-[var(--border)]">
          #{activeTag} 태그를 가진 캐릭터가 없습니다.
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {currentData.map((char, i) => (
          <CharacterCard
            key={char.id}
            char={char}
            rank={(page - 1) * ITEMS_PER_PAGE + i + 1}
            onTagClick={handleTagClick}
            activeTag={activeTag}
          />
        ))}
      </div>
    </div>
  );
}

function CharacterCard({ char, rank, onTagClick, activeTag }) {
  const tier = getCharacterTier(char.interactionCount || 0);
  const isUnlimited = char.unlimitedAllowed;
  const tags = char.hashtags || char.tags || [];
  const zetaUrl = char.id ? `https://zeta-ai.io/ko/plots/${char.id}/profile` : null;

  const CardWrapper = zetaUrl
    ? ({ children }) => (
      <a href={zetaUrl} target="_blank" rel="noopener noreferrer"
        className="group relative overflow-hidden rounded-xl bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] transition-all hover:shadow-lg hover:-translate-y-0.5 block">
        {children}
      </a>
    )
    : ({ children }) => (
      <div className="group relative overflow-hidden rounded-xl bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)] transition-all hover:shadow-md">
        {children}
      </div>
    );

  return (
    <CardWrapper>
      <div className="p-3 sm:p-4 flex items-start gap-3">
        {/* Rank Badge */}
        <div className="absolute top-0 left-0 bg-[var(--bg-secondary)] text-[var(--text-tertiary)] text-[10px] font-mono px-2 py-0.5 rounded-br-lg border-b border-r border-[var(--border)] z-10 flex items-center gap-1">
          #{rank}
        </div>

        {/* Zeta 링크 아이콘 */}
        {zetaUrl && (
          <div className="absolute top-1.5 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <ExternalLink size={10} className="text-[var(--accent)]" />
          </div>
        )}

        {/* Thumbnail */}
        <div className="w-14 h-14 sm:w-18 sm:h-18 rounded-xl overflow-hidden bg-[var(--bg-secondary)] shrink-0 border border-[var(--border)] shadow-sm mt-3 relative" style={{ width: 64, height: 64 }}>
          <ImageWithFallback
            src={char.imageUrl}
            fallbackSrcs={(char.imageUrls || []).slice(1)}
            alt={char.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute -bottom-1 -right-1 bg-[var(--card)] rounded-tl-lg p-0.5 shadow-sm">
            <TierBadge tierKey={tier.key} size={16} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pt-2">
          <h4 className="font-bold text-[var(--text-primary)] text-sm sm:text-base truncate mb-0.5 leading-tight group-hover:text-[var(--accent)] transition-colors">
            {char.name}
          </h4>

          <div className="flex items-baseline gap-2 mb-1.5">
            <div className="text-lg sm:text-xl font-black text-[var(--accent-bright)] tracking-tight">
              {(char.interactionCount || 0).toLocaleString()}
            </div>
            {(char.starCount || 0) > 0 && (
              <div className="flex items-center gap-0.5 text-[10px] text-[var(--text-tertiary)]">
                <Star size={9} className="text-yellow-400 fill-yellow-400" />
                {formatNumber(char.starCount)}
              </div>
            )}
          </div>

          <p className="text-xs text-[var(--text-secondary)] line-clamp-1 mb-1.5 opacity-80">
            {char.shortDescription || '설명이 없습니다.'}
          </p>

          {/* Hashtags — 클릭 가능 */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {tags.slice(0, 3).map((tag, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onTagClick(tag); }}
                  className={`text-[9px] px-1.5 py-0.5 rounded border transition-all ${activeTag === tag
                    ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)] border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                    }`}
                >
                  #{tag}
                </button>
              ))}
              {isUnlimited && (
                <span className="text-[9px] px-1.5 py-0.5 rounded text-white font-semibold flex items-center gap-0.5" style={{ background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)' }}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" /></svg>
                  언리밋
                </span>
              )}
            </div>
          )}



          <div className="flex items-center text-[9px] text-[var(--text-tertiary)] border-t border-[var(--border)] pt-1.5 border-dashed">
            <Calendar size={9} className="mr-1" />
            {formatDate(char.createdAt)} 제작
          </div>
        </div>
      </div>
    </CardWrapper>
  );
}
