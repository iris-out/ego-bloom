import React, { useState, useEffect, useRef } from 'react';
import { Search, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getRecentSearches, addRecentSearch, removeRecentSearch, getLastSearch, setLastSearch } from '../utils/storage';

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
      recentSearches.filter(t => t.toLowerCase().includes(input.toLowerCase())).slice(0, 5)
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
    <form ref={pillRef} onSubmit={handleSubmit} className={className} style={style}>
      <label
        className="glass-pill flex items-center w-full h-14 px-5 gap-3 shadow-[0_10px_30px_rgba(0,0,0,0.3)] relative cursor-text"
        style={{ background: focused ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.12)', transition: 'background 0.2s ease' }}
      >
        <Search size={20} className="text-white/70 shrink-0" />
        <div className="flex-1 relative">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onFocus={() => { setShowSuggestions(true); setFocused(true); }}
            onBlur={() => { setTimeout(() => setShowSuggestions(false), 200); setFocused(false); }}
            placeholder="@핸들, ID, URL 검색"
            className="w-full bg-transparent border-none text-[15px] text-white placeholder-white/40 font-light py-3 focus:outline-none"
          />
        </div>
        <button type="submit" disabled={!input.trim()}
          className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white shrink-0 hover:bg-white/20 transition-colors disabled:opacity-30">
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 stroke-current stroke-2 fill-none"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </button>
      </label>

      {showSuggestions && displayItems.length > 0 && (
        <div
          className="fixed overflow-hidden animate-fade-in"
          style={{
            ...dropdownStyle,
            zIndex: 9999,
            background: 'rgb(10, 11, 18)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
          }}
        >
          {!input.trim() && (
            <div className="px-4 pt-2.5 pb-1 text-[10px] font-semibold tracking-widest text-white/30 uppercase">최근 검색</div>
          )}
          {displayItems.map((s, i) => (
            <button key={i} type="button"
              onMouseDown={() => { setInput(s); navigate(`/profile?creator=${encodeURIComponent(s)}`); setShowSuggestions(false); }}
              className="w-full text-left px-4 py-2.5 text-[13px] text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors flex items-center gap-2">
              <History size={12} className="opacity-40" />{s}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
