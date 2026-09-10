import { useEffect, useRef, useState } from 'react';
import { Search, History, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getRecentSearches, addRecentSearch, getLastSearch, setLastSearch } from '../utils/storage';

/**
 * 제작자 검색 필드다. 최근 검색어를 드롭다운으로 보여주고, 제출 시 프로필로 이동한다.
 * @param {object} props
 * @param {string} [props.className]
 * @param {object} [props.style]
 * @param {boolean} [props.suggestionsAbove] 드롭다운을 필드 위로 펼칠지(모바일 하단 바용).
 */
export default function SearchPill({ className = '', style, suggestionsAbove = false }) {
  const navigate = useNavigate();
  const [input, setInput] = useState(() => getLastSearch());
  const [recentSearches, setRecentSearches] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [focused, setFocused] = useState(false);
  const pillRef = useRef(null);
  const [dropdownStyle, setDropdownStyle] = useState({});

  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  useEffect(() => {
    if (!input.trim()) { setSuggestions([]); return; }
    setSuggestions(
      recentSearches.filter((t) => t.toLowerCase().includes(input.toLowerCase())).slice(0, 5),
    );
  }, [input, recentSearches]);

  useEffect(() => {
    if (!showSuggestions || !pillRef.current) return;
    const rect = pillRef.current.getBoundingClientRect();
    if (suggestionsAbove) {
      setDropdownStyle({ left: rect.left, width: rect.width, bottom: window.innerHeight - rect.top + 8 });
    } else {
      setDropdownStyle({ left: rect.left, width: rect.width, top: rect.bottom + 8 });
    }
  }, [showSuggestions, suggestionsAbove]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) {
      const nr = addRecentSearch(input.trim());
      if (nr) setRecentSearches(nr);
      setLastSearch(input.trim());
      navigate(`/profile?creator=${encodeURIComponent(input.trim())}`);
    }
  };

  const displayItems = input.trim() ? suggestions : recentSearches.slice(0, 5);

  return (
    <form ref={pillRef} onSubmit={handleSubmit} className={`relative ${className}`} style={style}>
      <label
        className="flex items-center w-full h-10 px-3.5 gap-2 cursor-text"
        style={{
          background: 'var(--surface-2)',
          border: `2px solid ${focused ? 'var(--accent-ink)' : 'var(--line)'}`,
          borderRadius: 'var(--radius-pill)',
          transition: 'border-color 120ms ease',
        }}
      >
        <Search size={16} strokeWidth={2} className="shrink-0" style={{ color: 'var(--fg-3)' }} />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={() => { setShowSuggestions(true); setFocused(true); }}
          onBlur={() => { setTimeout(() => setShowSuggestions(false), 200); setFocused(false); }}
          placeholder="@핸들로 제작자 찾기"
          className="flex-1 min-w-0 bg-transparent border-none t-body outline-none"
          style={{ color: 'var(--fg)' }}
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="shrink-0 flex items-center justify-center disabled:opacity-30"
          style={{ width: 24, height: 24, borderRadius: '50%', color: 'var(--fg-2)' }}
          aria-label="검색"
        >
          <ArrowRight size={14} strokeWidth={2} />
        </button>
      </label>

      {showSuggestions && displayItems.length > 0 && (
        <div
          className="fixed overflow-hidden"
          style={{
            ...dropdownStyle,
            zIndex: 60,
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-m)',
            boxShadow: 'var(--shadow-overlay)',
          }}
        >
          {!input.trim() && (
            <div className="px-4 pt-2.5 pb-1 t-label" style={{ color: 'var(--fg-3)' }}>최근 검색</div>
          )}
          {displayItems.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => { setInput(s); navigate(`/profile?creator=${encodeURIComponent(s)}`); setShowSuggestions(false); }}
              className="w-full text-left px-4 py-2.5 t-small flex items-center gap-2"
              style={{ color: 'var(--fg-2)' }}
            >
              <History size={12} strokeWidth={2} style={{ color: 'var(--fg-3)' }} />{s}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
