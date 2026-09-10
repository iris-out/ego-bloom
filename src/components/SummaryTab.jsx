import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { getCharacterTier } from '../utils/tierCalculator';
import CharCard from './ui/CharCard';
import Segmented from './ui/Segmented';
import CharacterDetailModal from './CharacterDetailModal';
import { proxyThumbnailUrl } from '../utils/imageUtils';

const ITEMS_PER_PAGE = 30;

const SORT_OPTIONS = [
  { value: 'rank', label: '랭킹순' },
  { value: 'chats', label: '대화량순' },
  { value: 'new', label: '최신순' },
];

export default function SummaryTab({ characters }) {
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
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-3)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            placeholder="캐릭터 검색"
            className="eb-input w-full pl-9"
          />
        </div>
        <Segmented options={SORT_OPTIONS} value={sortKey} onChange={(v) => { setSortKey(v); setPage(1); }} aria-label="정렬" />
      </div>

      <p className="t-small mb-3" style={{ color: 'var(--fg-3)' }}>
        {filtered.length}개 캐릭터
      </p>

      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {paged.map((char, idx) => {
          const tier = getCharacterTier(char.interactionCount || 0);
          const globalIndex = (page - 1) * ITEMS_PER_PAGE + idx + 1;
          return (
            <CharCard
              key={char.id}
              size="grid"
              name={char.name}
              imageUrl={char.imageUrl ? proxyThumbnailUrl(char.imageUrl, 256) : null}
              rarity={tier.key}
              rank={char.globalRank ?? undefined}
              count={char.interactionCount}
              countLabel="대화"
              onClick={() => setSelectedChar(char)}
              priority={globalIndex === 1}
            />
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-6">
          <button
            type="button"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="eb-btn eb-btn-secondary disabled:opacity-30"
          >
            이전
          </button>
          <span className="t-small" style={{ color: 'var(--fg-2)' }}>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="eb-btn eb-btn-secondary disabled:opacity-30"
          >
            다음
          </button>
        </div>
      )}

      <CharacterDetailModal
        char={selectedChar}
        isOpen={!!selectedChar}
        onClose={() => setSelectedChar(null)}
      />
    </div>
  );
}
