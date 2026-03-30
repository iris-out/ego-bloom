
const STORAGE_KEY = 'zeta_recent_searches';
const MAX_RECENT = 4;

export const getRecentSearches = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error('Failed to load recent searches', e);
        return [];
    }
};

export const addRecentSearch = (query) => {
    if (!query) return;
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    try {
        let recents = getRecentSearches();
        // Remove existing if present to move it to the top
        recents = recents.filter(item => item !== cleanQuery);
        // Add to the beginning
        recents.unshift(cleanQuery);
        // Limit to max
        if (recents.length > MAX_RECENT) {
            recents = recents.slice(0, MAX_RECENT);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(recents));
        return recents;
    } catch (e) {
        console.error('Failed to save recent search', e);
        return [];
    }
};

export const removeRecentSearch = (query) => {
    try {
        let recents = getRecentSearches();
        recents = recents.filter(item => item !== query);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(recents));
        return recents;
    } catch (e) {
        console.error('Failed to remove recent search', e);
        return [];
    }
};

export const clearRecentSearches = () => {
    localStorage.removeItem(STORAGE_KEY);
};

// ─── Creator Badge Preference ──────────────────────────────────
const BADGE_STORAGE_KEY = 'zeta_creator_badges';

export const getCreatorBadge = (creatorId) => {
    if (!creatorId) return null;
    try {
        const stored = localStorage.getItem(BADGE_STORAGE_KEY);
        if (!stored) return null;
        const badges = JSON.parse(stored);
        return badges[creatorId] || null;
    } catch (e) {
        console.error('Failed to load creator badge', e);
        return null;
    }
};

export const saveCreatorBadge = (creatorId, badgeId) => {
    if (!creatorId || !badgeId) return;
    try {
        const stored = localStorage.getItem(BADGE_STORAGE_KEY);
        const badges = stored ? JSON.parse(stored) : {};

        // LRU-like limit to prevent unbounded growth (e.g. max 50 creators cached)
        const keys = Object.keys(badges);
        if (keys.length > 50 && !badges[creatorId]) {
            delete badges[keys[0]]; // Remove oldest
        }

        badges[creatorId] = badgeId;
        localStorage.setItem(BADGE_STORAGE_KEY, JSON.stringify(badges));
    } catch (e) {
        console.error('Failed to save creator badge', e);
    }
};

// ─── My Profile (Main Page Pinned Profile) ───────────────────
const MY_PROFILE_KEY = 'zeta_my_profile_id';
const MY_PROFILE_CACHE_KEY = 'zeta_my_profile_cache';
const MY_PROFILE_TTL = 3 * 60 * 60 * 1000; // 3 hours

export const getMyProfileId = () => {
    try {
        return localStorage.getItem(MY_PROFILE_KEY) || null;
    } catch { return null; }
};

export const setMyProfileId = (id) => {
    try {
        localStorage.setItem(MY_PROFILE_KEY, id);
    } catch (e) {
        console.error('Failed to save my profile ID', e);
    }
};

export const removeMyProfile = () => {
    try {
        localStorage.removeItem(MY_PROFILE_KEY);
        localStorage.removeItem(MY_PROFILE_CACHE_KEY);
    } catch (e) {
        console.error('Failed to remove my profile', e);
    }
};

export const getMyProfileCache = () => {
    try {
        const stored = localStorage.getItem(MY_PROFILE_CACHE_KEY);
        if (!stored) return null;
        const parsed = JSON.parse(stored);
        return parsed;
    } catch { return null; }
};

export const setMyProfileCache = (data) => {
    try {
        const payload = { ...data, _cachedAt: Date.now() };
        localStorage.setItem(MY_PROFILE_CACHE_KEY, JSON.stringify(payload));
    } catch (e) {
        console.error('Failed to cache my profile', e);
    }
};

export const isMyProfileStale = () => {
    try {
        const stored = localStorage.getItem(MY_PROFILE_CACHE_KEY);
        if (!stored) return true;
        const { _cachedAt } = JSON.parse(stored);
        if (!_cachedAt) return true;
        return Date.now() - _cachedAt > MY_PROFILE_TTL;
    } catch { return true; }
};

// ─── Last Search (session) ────────────────────────────────────
const LAST_SEARCH_KEY = 'zeta_last_search';

export const getLastSearch = () => {
    try { return sessionStorage.getItem(LAST_SEARCH_KEY) || ''; } catch { return ''; }
};

export const setLastSearch = (query) => {
    try { if (query) sessionStorage.setItem(LAST_SEARCH_KEY, query); } catch { }
};

// ─── Favorites ───────────────────────────────────────────────
const FAVORITES_KEY = 'zeta_favorites_v1';
const MAX_FAVORITES = 20;

export const getFavorites = () => {
    try {
        const stored = localStorage.getItem(FAVORITES_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch { return []; }
};

export const addFavorite = (id, nickname, handle) => {
    if (!id) return;
    try {
        let favs = getFavorites().filter(f => f.id !== id);
        favs.unshift({ id, nickname, handle });
        if (favs.length > MAX_FAVORITES) favs = favs.slice(0, MAX_FAVORITES);
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
    } catch (e) {
        console.error('Failed to add favorite', e);
    }
};

export const removeFavorite = (id) => {
    try {
        const favs = getFavorites().filter(f => f.id !== id);
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
    } catch (e) {
        console.error('Failed to remove favorite', e);
    }
};

export const isFavorite = (id) => {
    try { return getFavorites().some(f => f.id === id); } catch { return false; }
};
