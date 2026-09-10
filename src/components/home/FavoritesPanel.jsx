import { useCallback, useState } from 'react';
import { X, Plus, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PlayerCard from '../ui/PlayerCard';
import { getFavorites, addFavorite, removeFavorite } from '../../utils/storage';

/**
 * 즐겨찾기 탭이다. 핸들로 추가하고, 추가된 제작자는 작은 선수 카드 그리드로 보여준다.
 * 카드 자체의 티어/ELO 는 저장하지 않으므로 PlayerCard 는 이름과 핸들만 채운 컴팩트 형태로 그린다.
 * @returns {JSX.Element}
 */
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
    if (favorites.some((f) => f.handle === handle)) {
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
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setStatus(null); }}
            onKeyDown={handleKeyDown}
            placeholder="@handle 로 추가"
            className="eb-input flex-1 min-w-0"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={status === 'loading' || !input.trim()}
            className="eb-btn-icon shrink-0"
            aria-label="즐겨찾기 추가"
          >
            {status === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} strokeWidth={2} />}
          </button>
        </div>
        {status === 'error' && (
          <p className="t-small px-1" style={{ color: 'var(--down)' }}>{errorMsg}</p>
        )}
      </div>

      {favorites.length === 0 ? (
        <div className="flex items-center gap-5 py-6">
          <div
            className="shrink-0"
            style={{ width: 64, height: 90, border: '2px dashed var(--line)', borderRadius: 'var(--radius-m)' }}
          />
          <div className="flex flex-col items-start gap-3">
            <p className="t-body" style={{ color: 'var(--fg-2)' }}>아직 모은 카드가 없습니다.</p>
            <button
              type="button"
              className="eb-btn eb-btn-primary"
              onClick={() => navigate('/')}
            >
              제작자 검색
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {favorites.map((creator) => {
            const id = creator.id || creator.handle;
            return (
              <div key={id} className="relative">
                <button
                  type="button"
                  onClick={(e) => handleRemove(e, id)}
                  className="eb-btn-icon absolute -top-2 -right-2 z-10"
                  style={{ width: 28, height: 28 }}
                  aria-label="즐겨찾기에서 제거"
                >
                  <X size={13} strokeWidth={2} />
                </button>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => creator.handle && navigate(`/profile?creator=${encodeURIComponent(creator.handle)}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && creator.handle) navigate(`/profile?creator=${encodeURIComponent(creator.handle)}`); }}
                  className="cursor-pointer"
                >
                  <PlayerCard
                    name={creator.nickname && creator.nickname !== creator.handle ? creator.nickname : `@${creator.handle}`}
                    handle={creator.handle}
                    compact
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
