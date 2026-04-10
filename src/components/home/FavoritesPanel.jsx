import React, { useState, useCallback } from 'react';
import { Star, X, Plus, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getFavorites, addFavorite, removeFavorite } from '../../utils/storage';

export default function FavoritesPanel() {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState(() => getFavorites());
  const [input, setInput] = useState('');
  const [status, setStatus] = useState(null); // null | 'loading' | 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const refresh = () => setFavorites(getFavorites());

  const handleAdd = useCallback(async () => {
    const handle = input.trim().replace(/^@/, '');
    if (!handle) return;
    if (favorites.some(f => f.handle === handle)) {
      setErrorMsg('이미 추가된 핸들입니다');
      setStatus('error');
      return;
    }
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch(`/api/resolve-handle?handle=${encodeURIComponent(handle)}`);
      if (!res.ok) throw new Error('not_found');
      const { id } = await res.json();
      if (!id) throw new Error('not_found');
      addFavorite(id, handle, handle);
      setInput('');
      setStatus(null);
      refresh();
    } catch {
      setErrorMsg('크리에이터를 찾을 수 없습니다');
      setStatus('error');
    }
  }, [input, favorites]);

  const handleRemove = (e, id) => {
    e.stopPropagation();
    removeFavorite(id);
    refresh();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAdd();
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 입력창 */}
      <div className="flex flex-col gap-1">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={input}
            onChange={e => { setInput(e.target.value); setStatus(null); }}
            onKeyDown={handleKeyDown}
            placeholder="@handle 로 추가"
            className="flex-1 bg-white/[0.07] border border-white/[0.12] rounded-lg px-3 py-1.5 text-[13px] text-white/80 placeholder-white/25 outline-none focus:border-indigo-500/50"
          />
          <button
            onClick={handleAdd}
            disabled={status === 'loading' || !input.trim()}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-500/30 border border-indigo-400/40 text-indigo-300 hover:bg-indigo-500/50 disabled:opacity-40 transition-colors shrink-0"
          >
            {status === 'loading'
              ? <Loader2 size={14} className="animate-spin" />
              : <Plus size={14} />}
          </button>
        </div>
        {status === 'error' && (
          <p className="text-[11px] text-red-400/80 px-1">{errorMsg}</p>
        )}
      </div>

      {/* 목록 */}
      {favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
            <Star size={20} className="text-white/20" />
          </div>
          <p className="text-[13px] text-white/30">즐겨찾기한 크리에이터가 없습니다</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {favorites.map((creator) => (
            <div
              key={creator.id || creator.handle}
              onClick={() => creator.handle && navigate(`/profile?creator=${encodeURIComponent(creator.handle)}`)}
              className="flex items-center gap-3 py-2 px-3 rounded-xl bg-white/5 border border-white/[0.08] hover:bg-white/[0.10] cursor-pointer transition-colors group"
            >
              <Star size={13} className="text-yellow-400/60 shrink-0" />
              <span className="text-[13px] font-medium text-white flex-1 truncate">
                {creator.nickname && creator.nickname !== creator.handle ? creator.nickname : `@${creator.handle}`}
              </span>
              <span className="text-[11px] text-white/30 truncate hidden group-hover:hidden">
                {creator.nickname !== creator.handle ? `@${creator.handle}` : ''}
              </span>
              <button
                onClick={(e) => handleRemove(e, creator.id || creator.handle)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-white/30 hover:text-red-400 shrink-0"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
