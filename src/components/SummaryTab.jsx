import React, { useState, useMemo } from 'react';
import { getCharacterTier, formatCompactNumber } from '../utils/tierCalculator';
import ImageWithFallback from './ImageWithFallback';
import CharacterDetailModal from './CharacterDetailModal';
import { Search } from 'lucide-react';

const ITEMS_PER_PAGE = 30;



const TIER_BADGE_STYLES = {
  B:  { color: '#A0AEC0', bg: 'rgba(160,174,192,0.15)', border: 'rgba(160,174,192,0.3)' },
  A:  { color: '#48BB78', bg: 'rgba(72,187,120,0.15)',  border: 'rgba(72,187,120,0.3)' },
  S:  { color: '#4299E1', bg: 'rgba(66,153,225,0.15)',  border: 'rgba(66,153,225,0.3)' },
  R:  { color: '#9F7AEA', bg: 'rgba(159,122,234,0.15)', border: 'rgba(159,122,234,0.3)' },
  SR: { color: '#ED8936', bg: 'rgba(237,137,54,0.15)',  border: 'rgba(237,137,54,0.3)' },
  X:  { color: '#F56565', bg: 'rgba(245,101,101,0.15)', border: 'rgba(245,101,101,0.3)' },
};

function getRankTypeBadge(char) {
  const hasTrending = char.trendingRank != null;
  const hasBest     = char.bestRank != null;
  const hasNew      = char.newRank != null;

  const types = [
    hasTrending && '트렌딩',
    hasBest     && '베스트',
    hasNew      && '신작',
  ].filter(Boolean);

  if (types.length === 0) return null;

  const isMulti = types.length > 1;
  const label   = types.join('·');
  const style   = isMulti
    ? { color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', border: 'rgba(167,139,250,0.25)' }
    : hasTrending
      ? { color: '#f87171', bg: 'rgba(239,68,68,0.15)',    border: 'rgba(239,68,68,0.25)' }
      : hasBest
        ? { color: '#fbbf24', bg: 'rgba(251,191,36,0.15)',   border: 'rgba(251,191,36,0.25)' }
        : { color: '#34d399', bg: 'rgba(52,211,153,0.15)',   border: 'rgba(52,211,153,0.25)' };

  return { label, style };
}

const SORT_OPTIONS = [
  { key: 'rank',  label: '랭킹순' },
  { key: 'chats', label: '대화량순' },
  { key: 'new',   label: '최신순' },
];

export default function SummaryTab({ characters, stats }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedChar, setSelectedChar] = useState(null);
  const [sortKey, setSortKey] = useState('rank');

  const filtered = useMemo(() => {
    if (!characters) return [];
    const q = searchQuery.trim().toLowerCase();
    const data = q
      ? characters.filter(c => (c.name || '').toLowerCase().includes(q))
      : [...characters];

    if (sortKey === 'rank') {
      return data.sort((a, b) => {
        const aRank = Math.min(...[a.trendingRank, a.bestRank, a.newRank, a.globalRank].filter(x => x != null), Infinity);
        const bRank = Math.min(...[b.trendingRank, b.bestRank, b.newRank, b.globalRank].filter(x => x != null), Infinity);
        if (aRank === Infinity && bRank === Infinity) return (b.interactionCount || 0) - (a.interactionCount || 0);
        return aRank - bRank;
      });
    }
    if (sortKey === 'new') {
      return data.sort((a, b) => {
        const aDate = a.createdAt || a.createdDate || '';
        const bDate = b.createdAt || b.createdDate || '';
        return bDate.localeCompare(aDate);
      });
    }
    // 'chats' — 기본
    return data.sort((a, b) => (b.interactionCount || 0) - (a.interactionCount || 0));
  }, [characters, searchQuery, sortKey]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  return (
    <div>
      {/* 검색 + 정렬 */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            placeholder="캐릭터 검색"
            className="w-full pl-8 pr-3 py-2 rounded-xl text-[13px] text-white placeholder-white/25 outline-none"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          />
        </div>
        <div
          className="flex items-center rounded-xl overflow-hidden shrink-0"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => { setSortKey(opt.key); setPage(1); }}
              className="px-2.5 py-2 text-[11px] font-semibold transition-colors"
              style={{
                color: sortKey === opt.key ? '#a5b4fc' : 'rgba(255,255,255,0.35)',
                background: sortKey === opt.key ? 'rgba(99,102,241,0.18)' : 'transparent',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 캐릭터 수 */}
      <p className="text-[11px] text-white/30 mb-2 px-0.5">
        {filtered.length}개 캐릭터
      </p>

      {/* 리스트 */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
      >
        {paged.map((char, idx) => {
          const tier = getCharacterTier(char.interactionCount || 0);
          const tierStyle = TIER_BADGE_STYLES[tier.name] || TIER_BADGE_STYLES.B;
          const hasRank = char.globalRank != null;
          const rankDiff = char.rankDiff ?? 0;
          const rankBadge = getRankTypeBadge(char);

          const isLast = idx === paged.length - 1;
          const hashtags = (char.hashtags || char.tags || []).slice(0, 4);

          return (
            <button
              key={char.id}
              onClick={() => setSelectedChar(char)}
              className="w-full flex items-center gap-3 px-4 text-left transition-colors hover:bg-white/[0.03]"
              style={{
                borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
                paddingTop: '13px',
                paddingBottom: '13px',
              }}
            >
              {/* 썸네일 46×46 */}
              <div className="w-[46px] h-[46px] rounded-[12px] overflow-hidden shrink-0 self-start mt-0.5">
                {char.imageUrl ? (
                  <ImageWithFallback
                    src={char.imageUrl}
                    alt={char.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <span className="text-sm font-bold text-white/40">
                      {(char.name || '?')[0]}
                    </span>
                  </div>
                )}
              </div>

              {/* 정보 영역 */}
              <div className="flex-1 min-w-0">
                {/* Row 1: 이름 + 티어 배지 + 언리밋 닷 */}
                <div className="flex items-center gap-1.5 mb-1">
                  <p className="text-[14px] font-semibold text-white truncate min-w-0">{char.name}</p>
                  <span
                    className="shrink-0 text-[11px] font-bold px-1.5 py-[2px] rounded-full"
                    style={{
                      color: tierStyle.color,
                      background: tierStyle.bg,
                      border: `1px solid ${tierStyle.border}`,
                    }}
                  >
                    {tier.name}
                  </span>
                </div>

                {/* Row 2: 대화량 */}
                <div className="flex items-baseline gap-1 mb-1.5">
                  <span className="text-[14px] font-bold text-white">
                    {formatCompactNumber(char.interactionCount || 0)}
                  </span>
                  <span className="text-[11px] text-white/35">대화</span>
                </div>

                {/* Row 3: 해시태그 */}
                {hashtags.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {hashtags.map((tag, ti) => (
                      <span
                        key={ti}
                        className="text-[10px] rounded"
                        style={{
                          color: 'rgba(255,255,255,0.4)',
                          background: 'rgba(255,255,255,0.05)',
                          padding: '1px 5px',
                        }}
                      >
                        #{String(tag).replace(/^#/, '')}
                      </span>
                    ))}
                  </div>
                )}
              </div>


              {/* 순위 + 등락 + 랭킹 타입 */}
              <div className="shrink-0 text-right self-start mt-0.5" style={{ minWidth: '52px' }}>
                {hasRank ? (
                  <>
                    <p className="text-[14px] font-bold text-white">{char.globalRank}위</p>
                    {rankDiff !== 0 ? (
                      <p
                        className="text-[11px] font-semibold mt-0.5"
                        style={{ color: rankDiff > 0 ? '#ef4444' : '#3b82f6' }}
                      >
                        {rankDiff > 0 ? `▲ ${rankDiff}` : `▼ ${Math.abs(rankDiff)}`}
                      </p>
                    ) : (
                      <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>— 유지</p>
                    )}
                    {rankBadge && (
                      <span
                        className="inline-block text-[10px] font-bold mt-1 px-1.5 py-[1px] rounded"
                        style={{
                          color: rankBadge.style.color,
                          background: rankBadge.style.bg,
                          border: `1px solid ${rankBadge.style.border}`,
                        }}
                      >
                        {rankBadge.label}
                      </span>
                    )}
                    {char.unlimitedAllowed && (
                      <span
                        className="inline-block text-[10px] font-semibold mt-1 px-1.5 py-[1px] rounded"
                        style={{
                          color: '#a5b4fc',
                          background: 'rgba(99,102,241,0.12)',
                          border: '1px solid rgba(139,92,246,0.25)',
                        }}
                      >
                        언리밋
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    {char.unlimitedAllowed && (
                      <span
                        className="inline-block text-[10px] font-semibold px-1.5 py-[1px] rounded"
                        style={{
                          color: '#a5b4fc',
                          background: 'rgba(99,102,241,0.12)',
                          border: '1px solid rgba(139,92,246,0.25)',
                        }}
                      >
                        언리밋
                      </span>
                    )}
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-[12px] text-white/50 disabled:opacity-30 transition-colors hover:bg-white/[0.06]"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            이전
          </button>
          <span className="text-[12px] text-white/40">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg text-[12px] text-white/50 disabled:opacity-30 transition-colors hover:bg-white/[0.06]"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            다음
          </button>
        </div>
      )}

      {selectedChar && (
        <CharacterDetailModal
          character={selectedChar}
          onClose={() => setSelectedChar(null)}
        />
      )}
    </div>
  );
}
