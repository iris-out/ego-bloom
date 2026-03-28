import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Plus, X } from 'lucide-react';
import {
  getMyProfileId,
  setMyProfileId,
  removeMyProfile,
  getMyProfileCache,
  setMyProfileCache,
  isMyProfileStale,
} from '../utils/storage';
import { formatCompactNumber } from '../utils/tierCalculator';
import { proxyImageUrl } from '../utils/imageUtils';

export default function MyProfileCard() {
  const navigate = useNavigate();
  const [profileId, setProfileId] = useState(getMyProfileId);
  const [profileData, setProfileData] = useState(getMyProfileCache);
  const [loading, setLoading] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const resolveId = useCallback(async (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('@')) {
      const handle = trimmed.slice(1);
      const res = await fetch(`/api/resolve-handle?handle=${encodeURIComponent(handle)}`);
      if (!res.ok) throw new Error('핸들을 찾을 수 없습니다');
      const data = await res.json();
      return data.id;
    }
    return trimmed;
  }, []);

  const fetchProfile = useCallback(async (id) => {
    setLoading(true);
    setError(null);
    try {
      const [userRes, statsRes] = await Promise.all([
        fetch(`/api/zeta/users/${id}`),
        fetch(`/api/zeta/creators/${id}/stats`),
      ]);
      if (!userRes.ok || !statsRes.ok) throw new Error('프로필을 불러올 수 없습니다');
      const user = await userRes.json();
      const stats = await statsRes.json();
      const data = {
        id,
        nickname: user.nickname || user.username,
        username: user.username,
        profileImageUrl: user.profileImageUrl,
        followerCount: stats.followerCount ?? 0,
        plotInteractionCount: stats.plotInteractionCount ?? 0,
        plotCount: stats.plotCount ?? 0,
      };
      setProfileData(data);
      setMyProfileCache(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch on mount if stale
  useEffect(() => {
    if (profileId && isMyProfileStale()) {
      fetchProfile(profileId);
    }
  }, [profileId, fetchProfile]);

  // Focus input when shown
  useEffect(() => {
    if (showInput) inputRef.current?.focus();
  }, [showInput]);

  const handleRegister = async () => {
    if (!inputValue.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const id = await resolveId(inputValue);
      if (!id) throw new Error('유효하지 않은 입력입니다');
      setMyProfileId(id);
      setProfileId(id);
      setShowInput(false);
      setInputValue('');
      await fetchProfile(id);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    removeMyProfile();
    setProfileId(null);
    setProfileData(null);
    setError(null);
  };

  const handleRefresh = (e) => {
    e.stopPropagation();
    if (profileId) fetchProfile(profileId);
  };

  // ─── Empty state ───
  if (!profileId) {
    return (
      <div className="relative rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] backdrop-blur-sm p-4">
        {showInput ? (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                placeholder="크리에이터 ID 또는 @핸들"
                className="flex-1 min-w-0 rounded-lg bg-white/[0.05] border border-white/[0.08] px-3 py-1.5 text-sm text-white/80 placeholder-white/30 outline-none focus:border-purple-500/40 transition-colors"
              />
              <button
                onClick={handleRegister}
                disabled={loading}
                className="shrink-0 rounded-lg bg-purple-500/20 border border-purple-500/30 px-3 py-1.5 text-xs text-purple-300 hover:bg-purple-500/30 transition-colors disabled:opacity-50"
              >
                {loading ? '...' : '등록'}
              </button>
            </div>
            {error && <p className="text-xs text-red-400/80">{error}</p>}
            <button
              onClick={() => { setShowInput(false); setError(null); setInputValue(''); }}
              className="text-xs text-white/30 hover:text-white/50 transition-colors self-start"
            >
              취소
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowInput(true)}
            className="flex items-center justify-center gap-2 w-full py-2 text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            <Plus size={16} />
            <span>내 프로필 등록</span>
          </button>
        )}
      </div>
    );
  }

  // ─── Loading skeleton ───
  if (loading && !profileData) {
    return (
      <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] backdrop-blur-sm p-4 animate-pulse">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-white/[0.06]" />
          <div className="flex flex-col gap-1.5">
            <div className="w-24 h-3.5 rounded bg-white/[0.06]" />
            <div className="w-16 h-2.5 rounded bg-white/[0.04]" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="w-10 h-3.5 rounded bg-white/[0.06]" />
              <div className="w-8 h-2.5 rounded bg-white/[0.04]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Profile card ───
  const avatarUrl = profileData?.profileImageUrl
    ? proxyImageUrl(profileData.profileImageUrl)
    : null;

  return (
    <div
      onClick={() => navigate(`/profile?creator=${profileId}`)}
      className="relative rounded-2xl border border-white/[0.05] bg-white/[0.02] backdrop-blur-sm p-4 cursor-pointer hover:bg-white/[0.04] transition-colors group"
    >
      {/* Avatar + name */}
      <div className="flex items-center gap-3 mb-3">
        <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/40 to-violet-600/40 p-[2px]">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <div className="w-full h-full rounded-full bg-white/[0.06]" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white/90 truncate">
            {profileData?.nickname || '—'}
          </p>
          {profileData?.username && (
            <p className="text-xs text-white/40 truncate">@{profileData.username}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        {[
          { label: '대화량', value: profileData?.plotInteractionCount },
          { label: '팔로워', value: profileData?.followerCount },
          { label: '캐릭터', value: profileData?.plotCount },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col items-center">
            <span className="text-sm font-semibold text-white/80">
              {value != null ? formatCompactNumber(value) : '—'}
            </span>
            <span className="text-[10px] text-white/35">{label}</span>
          </div>
        ))}
      </div>

      {error && (
        <p className="mb-2 text-[10px] text-red-400/70 text-center">{error}</p>
      )}

      {/* Bottom-right action buttons */}
      <div className="flex justify-end gap-1 border-t border-white/[0.04] pt-2 mt-1">
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors disabled:opacity-50"
          aria-label="새로고침"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          새로고침
        </button>
        <button
          onClick={handleRemove}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-white/40 hover:text-red-400/70 hover:bg-red-500/[0.06] transition-colors"
          aria-label="프로필 제거"
        >
          <X size={11} />
          삭제
        </button>
      </div>
    </div>
  );
}
