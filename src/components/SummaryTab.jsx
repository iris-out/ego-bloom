import React, { useState, useMemo } from 'react';
import ImageWithFallback from './ImageWithFallback';
import RankBadge from './RankBadge';
import { getCharacterTier, toKST } from '../utils/tierCalculator';
import { MessageCircle, Calendar, ArrowUpAZ, X, ChevronLeft, ChevronRight } from 'lucide-react';

const ITEMS_PER_PAGE = 20;

export default function SummaryTab({ characters, stats }) {
  const [sortKey, setSortKey] = useState('interactions');
  const [page, setPage] = useState(1);
  const [activeTags, setActiveTags] = useState([]);

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

  const tagCount = useMemo(() => {
    const s = new Set();
    (characters || []).forEach(c => (c.hashtags || c.tags || []).forEach(t => t && s.add(t)));
    return s.size;
  }, [characters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));

  if (!characters || characters.length === 0) return null;

  const safePage = Math.min(page, totalPages);
  const currentData = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const handleSortChange = (key) => { setSortKey(key); setPage(1); };
  const handleTagClick = (tag) => {
    setActiveTags(prev => (prev[0] === tag ? [] : [tag]));
    setPage(1);
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
            <MessageCircle size={32} className="text-[var(--text-tertiary)] opacity-30" />
            <p className="text-sm text-[var(--text-tertiary)]">선택한 태그를 가진 캐릭터가 없습니다.</p>
            <button onClick={() => setActiveTags([])} className="text-xs text-[var(--accent)] font-bold hover:underline">필터 초기화하기</button>
          </div>
        </div>
      )}

      {/* 페이지 인디케이터 + 캐릭터 목록 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] text-[var(--text-tertiary)]">
            {(safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} / {filtered.length}개
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-tertiary)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === '…'
                  ? <span key={`ellipsis-${i}`} className="text-xs text-[var(--text-tertiary)] px-1">…</span>
                  : <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition-all ${safePage === p ? 'bg-[var(--accent)] text-white' : 'border border-[var(--border)] text-[var(--text-tertiary)] hover:border-[var(--accent)] hover:text-[var(--accent)]'}`}
                  >
                    {p}
                  </button>
              )}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-tertiary)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="card char-list">
        {currentData.map((char, i) => (
          <CharacterRow
            key={char.id}
            char={char}
            rank={(safePage - 1) * ITEMS_PER_PAGE + i + 1}
            onTagClick={handleTagClick}
            activeTags={activeTags}
          />
        ))}
      </div>
    </div>
  );
}

const TIER_COLORS_CHAR = {
  b: '#A0AEC0', a: '#48BB78', s: '#4299E1', r: '#9F7AEA', sr: '#ED8936', x: '#F56565',
};

function CharacterRow({ char, rank, onTagClick, activeTags }) {
  const tier = getCharacterTier(char.interactionCount || 0);
  const tags = (char.hashtags || char.tags || []).slice(0, 2);
  const zetaUrl = char.id ? `https://zeta-ai.io/ko/plots/${char.id}/profile` : null;
  const tierColor = TIER_COLORS_CHAR[tier.key] || '#A0AEC0';

  const inner = (
    <div className="char-item">
      <span className="char-rank">{rank}</span>
      <div className="char-thumb">
        <ImageWithFallback
          src={char.imageUrl}
          fallbackSrcs={(char.imageUrls || []).slice(1)}
          alt={char.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="char-details">
        <div className="char-name flex items-center gap-1.5">
          {char.name}
          {char.unlimitedAllowed && (
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold text-white border border-purple-400/30 leading-none" style={{ background: 'linear-gradient(135deg,#8B5CF6,#3B82F6)' }}>언리밋</span>
          )}
        </div>
        <div className="char-meta">
          {/* 티어 배지 — 컬러 배경 강조 */}
          <span
            className="text-[10px] font-black px-2 py-0.5 rounded-md text-white shrink-0"
            style={{ background: tierColor, fontSize: '11px' }}
          >
            {tier.key?.toUpperCase()}
          </span>
          {tags.map(tag => (
            <button
              key={tag}
              onClick={e => { e.preventDefault(); e.stopPropagation(); onTagClick(tag); }}
              className={`text-[10px] px-1.5 rounded border transition-all ${activeTags.includes(tag) ? 'bg-[var(--accent)] text-white border-[var(--accent)]' : 'border-[var(--border)] text-[var(--text-tertiary)] hover:border-[var(--accent)] hover:text-[var(--accent)]'}`}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <span className="text-[14px] font-black tabular-nums" style={{ color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
          {(char.interactionCount || 0).toLocaleString('ko-KR')}
        </span>
        <RankBadge globalRank={char.globalRank} rankDiff={char.rankDiff} isNew={char.isNew} />
      </div>
    </div>
  );

  return zetaUrl
    ? <a href={zetaUrl} target="_blank" rel="noopener noreferrer">{inner}</a>
    : inner;
}
