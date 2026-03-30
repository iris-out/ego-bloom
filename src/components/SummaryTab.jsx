import React, { useState, useMemo } from 'react';
import ImageWithFallback from './ImageWithFallback';
import RankBadge from './RankBadge';
import { getCharacterTier, toKST, formatNumber } from '../utils/tierCalculator';
import { Search, MessageCircle, Calendar, ArrowUpAZ, X, ChevronLeft, ChevronRight } from 'lucide-react';
import CharacterDetailModal from './CharacterDetailModal';

const ITEMS_PER_PAGE = 20;

// 상대적 날짜 포맷
function formatRelativeDate(dateStr) {
  if (!dateStr) return null;
  const date = toKST(dateStr);
  if (isNaN(date.getTime())) return null;
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return '오늘';
  if (days === 1) return '1일 전';
  if (days < 7) return `${days}일 전`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}주 전`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}달 전`;
  return `${Math.floor(months / 12)}년 전`;
}

// 캐릭터 아바타 그라디언트 팔레트
const AVATAR_PALETTES = [
  { bg: 'from-indigo-500/15 to-purple-500/15', text: '#A5B4FC' },
  { bg: 'from-emerald-500/15 to-teal-500/15', text: '#6EE7B7' },
  { bg: 'from-rose-500/15 to-pink-500/15', text: '#FDA4AF' },
  { bg: 'from-amber-500/15 to-orange-500/15', text: '#FCD34D' },
  { bg: 'from-sky-500/15 to-blue-500/15', text: '#93C5FD' },
  { bg: 'from-violet-500/15 to-fuchsia-500/15', text: '#C4B5FD' },
];

// 티어 배지 아웃라인 컬러 (Outline Minimal)
const TIER_OUTLINE_COLORS = {
  x:  '#f87171',
  sr: '#f59e0b',
  r:  '#a78bfa',
  s:  '#60a5fa',
  a:  '#34d399',
  b:  '#9ca3af',
};

export default function SummaryTab({ characters, stats }) {
  const [sortKey, setSortKey] = useState('interactions');
  const [page, setPage] = useState(1);
  const [activeTags, setActiveTags] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChar, setSelectedChar] = useState(null);

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
      .slice(0, 15)
      .map(([tag, count]) => ({ tag, count }));
  }, [characters]);

  // 정렬 + 태그 필터 + 검색 필터
  const filtered = useMemo(() => {
    if (!characters) return [];
    const activeTag = activeTags[0];
    let data = [...characters];

    if (activeTag) {
      data = data.filter(c => (c.hashtags || c.tags || []).includes(activeTag));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      data = data.filter(c => (c.name || '').toLowerCase().includes(q));
    }

    if (sortKey === 'interactions') {
      data.sort((a, b) => (b.interactionCount || 0) - (a.interactionCount || 0));
    } else if (sortKey === 'newest') {
      data.sort((a, b) => toKST(b.createdAt || 0) - toKST(a.createdAt || 0));
    } else if (sortKey === 'name') {
      data.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
    }
    return data;
  }, [characters, sortKey, activeTags, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));

  if (!characters || characters.length === 0) return null;

  const safePage = Math.min(page, totalPages);
  const currentData = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const handleSortChange = (key) => { setSortKey(key); setPage(1); };
  const handleTagClick = (tag) => {
    setActiveTags(prev => (prev[0] === tag ? [] : [tag]));
    setPage(1);
  };
  const handleSearch = (e) => { setSearchQuery(e.target.value); setPage(1); };

  const sortOptions = [
    { key: 'interactions', icon: <MessageCircle size={13} />, label: '대화량' },
    { key: 'newest', icon: <Calendar size={13} />, label: '최신' },
    { key: 'name', icon: <ArrowUpAZ size={13} />, label: '이름' },
  ];

  return (
    <div className="space-y-3">
      {/* 검색 바 */}
      <div className="relative group">
        <Search
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors pointer-events-none"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearch}
          placeholder="캐릭터 검색"
          className="w-full rounded-2xl py-3.5 pl-11 pr-4 text-[13px] text-white placeholder-gray-600 focus:outline-none transition-all"
          style={{
            background: 'rgba(26, 22, 37, 0.6)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
          onFocus={e => { e.target.style.borderColor = 'rgba(139,92,246,0.4)'; e.target.style.background = 'rgba(26,22,37,0.9)'; }}
          onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.06)'; e.target.style.background = 'rgba(26,22,37,0.6)'; }}
        />
      </div>

      {/* 태그 필터 */}
      {topTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-0.5">
          {topTags.map(({ tag, count }) => {
            const isActive = activeTags[0] === tag;
            return (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className={`text-[12px] px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 ${isActive
                  ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-[0_0_10px_rgba(167,139,250,0.3)] font-bold'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)] border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                  }`}
              >
                #{tag}
                <span className={`text-[10px] ${isActive ? 'text-white/70' : 'opacity-50'}`}>{count}</span>
              </button>
            );
          })}
          {activeTags.length > 0 && (
            <button
              onClick={() => { setActiveTags([]); }}
              className="text-[12px] px-3 py-1.5 rounded-full border border-red-400/40 bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-all flex items-center gap-1.5 font-bold"
            >
              <X size={10} /> 초기화
            </button>
          )}
        </div>
      )}

      {/* 정렬 컨트롤 */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-[var(--text-tertiary)]">
          {searchQuery || activeTags.length > 0
            ? <span>{filtered.length}개 결과</span>
            : <span>{characters.length}개 캐릭터</span>
          }
        </span>
        <div className="flex gap-1 bg-[var(--bg-secondary)] p-1 rounded-xl">
          {sortOptions.map(opt => (
            <button
              key={opt.key}
              onClick={() => handleSortChange(opt.key)}
              className={`px-2.5 py-1.5 text-[13px] font-bold rounded-lg transition-all flex items-center gap-1 ${sortKey === opt.key
                ? 'bg-[var(--accent)] text-white shadow-sm'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                }`}
            >
              {opt.icon}{opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 결과 없음 */}
      {filtered.length === 0 && (
        <div className="text-center py-16 rounded-2xl border border-dashed border-[var(--border)] animate-fade-in">
          <div className="flex flex-col items-center gap-3">
            <MessageCircle size={32} className="text-[var(--text-tertiary)] opacity-30" />
            <p className="text-sm text-[var(--text-tertiary)]">
              {searchQuery ? `"${searchQuery}"에 해당하는 캐릭터가 없습니다.` : '선택한 태그를 가진 캐릭터가 없습니다.'}
            </p>
            <button
              onClick={() => { setActiveTags([]); setSearchQuery(''); }}
              className="text-xs text-[var(--accent)] font-bold hover:underline"
            >
              필터 초기화하기
            </button>
          </div>
        </div>
      )}

      {/* 페이지네이션 */}
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

      {/* 캐릭터 목록 */}
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2">
        {currentData.map((char, i) => (
          <CharacterCard
            key={char.id}
            char={char}
            rank={(safePage - 1) * ITEMS_PER_PAGE + i + 1}
            paletteIdx={((safePage - 1) * ITEMS_PER_PAGE + i) % AVATAR_PALETTES.length}
            onTagClick={handleTagClick}
            activeTags={activeTags}
            onSelect={setSelectedChar}
          />
        ))}
      </div>

      <CharacterDetailModal
        char={selectedChar}
        isOpen={!!selectedChar}
        onClose={() => setSelectedChar(null)}
      />
    </div>
  );
}

function CharacterCard({ char, rank, paletteIdx, onTagClick, activeTags, onSelect }) {
  const tier = getCharacterTier(char.interactionCount || 0);
  const tags = (char.hashtags || char.tags || []).slice(0, 2);
  const palette = AVATAR_PALETTES[paletteIdx] || AVATAR_PALETTES[0];
  const tierColor = TIER_OUTLINE_COLORS[tier.key] || TIER_OUTLINE_COLORS.b;
  const relDate = formatRelativeDate(char.createdAt || char.createdDate);

  const card = (
    <div
      className="flex items-center justify-between p-4 rounded-xl transition-all cursor-pointer hover:bg-white/[0.05] active:bg-white/[0.07]"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.04)',
        paddingTop: '20px',
        paddingBottom: '20px',
        paddingLeft: '18px',
        paddingRight: '18px',
      }}
      onClick={() => onSelect && onSelect(char)}
    >
      {/* 왼쪽: 아바타 + 정보 */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* 아바타 + 티어 배지 */}
        <div className="relative flex-shrink-0" style={{ width: 48, height: 48 }}>
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden relative border border-white/5"
            style={{ background: '#161320' }}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${palette.bg}`} />
            {char.imageUrl ? (
              <ImageWithFallback
                src={char.imageUrl}
                fallbackSrcs={(char.imageUrls || []).slice(1)}
                alt={char.name}
                className="w-full h-full object-cover relative z-10"
              />
            ) : (
              <span
                className="font-serif-kr text-lg font-bold relative z-10"
                style={{ color: palette.text }}
              >
                {(char.name || '?')[0]}
              </span>
            )}
          </div>
          {/* 티어 배지 — Outline Minimal, 아바타 하단 중앙 */}
          <span
            className="absolute left-1/2 -translate-x-1/2 -bottom-[7px] z-10 font-bold leading-none whitespace-nowrap"
            style={{
              fontSize: '9px',
              letterSpacing: '0.08em',
              padding: '2px 6px',
              borderRadius: '999px',
              background: 'rgba(11,8,18,0.92)',
              border: `1.5px solid ${tierColor}`,
              color: tierColor,
            }}
          >
            {tier.name}
          </span>
        </div>

        {/* 이름 + 태그 */}
        <div className="flex flex-col justify-center min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-gray-100 text-[14px] truncate">{char.name}</h3>
          </div>
          <div className="flex gap-1 flex-wrap">
            {tags.map(tag => (
              <button
                key={tag}
                onClick={e => { e.stopPropagation(); onTagClick(tag); }}
                className={`text-[11px] px-2 py-1 rounded-md transition-all ${
                  activeTags.includes(tag)
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                #{tag}
              </button>
            ))}
            {/* 언리밋 태그 */}
            {char.unlimitedAllowed && (
              <span className="text-[11px] px-2 py-1 rounded-md bg-violet-500/10 text-violet-300 border border-violet-500/20">
                언리밋
              </span>
            )}
            {/* 글로벌 랭크 배지 (있을 때만) */}
            {char.globalRank && (
              <RankBadge globalRank={char.globalRank} rankDiff={char.rankDiff} isNew={char.isNew} />
            )}
          </div>
        </div>
      </div>

      {/* 오른쪽: 날짜 + 대화수 */}
      <div className="flex flex-col items-end gap-0.5 shrink-0 ml-3">
        {relDate && (
          <span className="text-[12px] text-gray-500 font-medium">{relDate}</span>
        )}
        <div
          className="text-[20px] font-black tracking-tight text-white tabular-nums"
          style={{ letterSpacing: '-0.5px' }}
        >
          {formatNumber(char.interactionCount || 0)}
        </div>
      </div>
    </div>
  );

  return card;
}
